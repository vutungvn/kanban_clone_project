import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardMember, BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { BOARD_NOT_FOUND, BoardAccessService } from './board-access.service';
import { DEFAULT_LABEL_COLORS } from './boards.constants';
import { byPosition, cardInclude, listInclude, notArchived, toCard, toList } from './card-shape';
import type { CreateBoardDto, UpdateBoardDto } from './dto/board.dto';

export const memberUserSelect = { id: true, name: true, email: true, avatarUrl: true } as const satisfies Prisma.UserSelect;

type MemberWithUser = BoardMember & { user: Prisma.UserGetPayload<{ select: typeof memberUserSelect }> };

/** BoardMember + user → dạng trả về cho client (BoardMemberDto). */
export const toMember = ({ user, role }: MemberWithUser) => ({ ...user, role });

export const withMembers = {
  members: {
    include: { user: { select: memberUserSelect } },
    orderBy: { joinedAt: 'asc' },
  },
} as const satisfies Prisma.BoardInclude;

const withListsAndCards = {
  ...withMembers,
  labels: { orderBy: { createdAt: 'asc' } },
  lists: { where: notArchived, orderBy: byPosition, include: listInclude },
} as const satisfies Prisma.BoardInclude;

export type BoardWithMembers = Prisma.BoardGetPayload<{ include: typeof withMembers }>;

/** Ghép board + quan hệ của user hiện tại (sao, vai trò, lần xem) thành dạng trả về cho client. */
export function toSummary(board: BoardWithMembers, me: BoardMember) {
  return {
    id: board.id,
    title: board.title,
    background: board.background,
    starred: me.starred,
    role: me.role,
    createdAt: board.createdAt,
    lastViewedAt: me.lastViewedAt,
    members: board.members.map(toMember),
  };
}

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      include: { board: { include: withMembers } },
      orderBy: { board: { createdAt: 'desc' } },
    });
    return memberships.map((m) => toSummary(m.board, m));
  }

  async create(userId: string, dto: CreateBoardDto) {
    const board = await this.prisma.board.create({
      data: {
        title: dto.title,
        background: dto.background,
        ownerId: userId,
        // Người tạo là quản trị viên của bảng
        members: { create: { userId, role: BoardRole.ADMIN } },
        // createdAt lệch nhau 1ms để nhãn giữ đúng thứ tự màu
        labels: {
          create: DEFAULT_LABEL_COLORS.map((color, i) => ({ color, createdAt: new Date(Date.now() + i) })),
        },
      },
      include: withMembers,
    });
    return toSummary(board, board.members[0]);
  }

  /** Chi tiết bảng kèm nhãn, list & card. Đồng thời ghi nhận "vừa xem" cho user. */
  async findOne(boardId: string, userId: string) {
    await this.access.require(boardId, userId);
    const me = await this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { lastViewedAt: new Date() },
    });
    const board = await this.prisma.board.findUnique({ where: { id: boardId }, include: withListsAndCards });
    if (!board) throw new NotFoundException(BOARD_NOT_FOUND);
    return { ...toSummary(board, me), updatedAt: board.updatedAt, labels: board.labels, lists: board.lists.map(toList) };
  }

  async update(boardId: string, userId: string, dto: UpdateBoardDto) {
    const me = await this.access.require(boardId, userId, BoardRole.ADMIN);
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: { title: dto.title, background: dto.background },
      include: withMembers,
    });
    this.realtime.boardChanged(boardId);
    return toSummary(board, me);
  }

  /** Xoá bảng — list, card, nhãn, thành viên bị xoá theo (onDelete: Cascade). */
  async remove(boardId: string, userId: string) {
    await this.access.require(boardId, userId, BoardRole.ADMIN);
    const files = await this.storage.keysOf({ card: { list: { boardId } } });
    await this.prisma.board.delete({ where: { id: boardId } });
    this.realtime.boardDeleted(boardId);
    void this.storage.discard(files);
  }

  /** Danh sách (chưa lưu trữ) của bảng + số thẻ — gọn nhẹ, dùng cho ô chọn đích khi di chuyển / sao chép. */
  async listSummaries(boardId: string, userId: string) {
    await this.access.require(boardId, userId);
    const lists = await this.prisma.list.findMany({
      where: { boardId, ...notArchived },
      orderBy: byPosition,
      select: { id: true, title: true, _count: { select: { cards: { where: notArchived } } } },
    });
    return lists.map(({ _count, ...list }) => ({ ...list, cardCount: _count.cards }));
  }

  /** Mục đã lưu trữ của bảng: thẻ lưu trữ riêng lẻ + danh sách lưu trữ. Mọi vai trò đều xem được. */
  async archive(boardId: string, userId: string) {
    await this.access.require(boardId, userId);
    const archived = { not: null };
    const [cards, lists] = await Promise.all([
      this.prisma.card.findMany({
        where: { archivedAt: archived, list: { boardId } },
        orderBy: { archivedAt: 'desc' },
        include: { ...cardInclude, list: { select: { title: true, archivedAt: true } } },
      }),
      this.prisma.list.findMany({
        where: { boardId, archivedAt: archived },
        orderBy: { archivedAt: 'desc' },
        include: { _count: { select: { cards: { where: notArchived } } } },
      }),
    ]);
    return {
      cards: cards.map(({ list, ...card }) => ({ ...toCard(card), listTitle: list.title, listArchived: !!list.archivedAt })),
      lists: lists.map(({ _count, ...list }) => ({ ...list, cardCount: _count.cards })),
    };
  }

  async setStarred(boardId: string, userId: string, starred: boolean) {
    await this.access.require(boardId, userId);
    const me = await this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { starred },
    });
    return { starred: me.starred };
  }
}

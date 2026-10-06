import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardMember, BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BOARD_NOT_FOUND, BoardAccessService } from './board-access.service';
import type { CreateBoardDto, UpdateBoardDto } from './dto/board.dto';

const withMembers = {
  members: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  },
} as const satisfies Prisma.BoardInclude;

const byPosition = [{ position: 'asc' }, { createdAt: 'asc' }] as const satisfies Prisma.ListOrderByWithRelationInput[];

const withListsAndCards = {
  ...withMembers,
  lists: {
    orderBy: byPosition,
    include: { cards: { orderBy: byPosition } },
  },
} as const satisfies Prisma.BoardInclude;

type BoardWithMembers = Prisma.BoardGetPayload<{ include: typeof withMembers }>;

/** Ghép board + quan hệ của user hiện tại (sao, vai trò, lần xem) thành dạng trả về cho client. */
function toSummary(board: BoardWithMembers, me: BoardMember) {
  return {
    id: board.id,
    title: board.title,
    background: board.background,
    starred: me.starred,
    role: me.role,
    createdAt: board.createdAt,
    lastViewedAt: me.lastViewedAt,
    members: board.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
    })),
  };
}

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
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
      },
      include: withMembers,
    });
    return toSummary(board, board.members[0]);
  }

  /** Chi tiết bảng kèm list & card. Đồng thời ghi nhận "vừa xem" cho user. */
  async findOne(boardId: string, userId: string) {
    await this.access.require(boardId, userId);
    const me = await this.prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { lastViewedAt: new Date() },
    });
    const board = await this.prisma.board.findUnique({ where: { id: boardId }, include: withListsAndCards });
    if (!board) throw new NotFoundException(BOARD_NOT_FOUND);
    return { ...toSummary(board, me), updatedAt: board.updatedAt, lists: board.lists };
  }

  async update(boardId: string, userId: string, dto: UpdateBoardDto) {
    const me = await this.access.require(boardId, userId, BoardRole.ADMIN);
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: { title: dto.title, background: dto.background },
      include: withMembers,
    });
    return toSummary(board, me);
  }

  /** Xoá bảng — list, card, thành viên bị xoá theo (onDelete: Cascade). */
  async remove(boardId: string, userId: string) {
    await this.access.require(boardId, userId, BoardRole.ADMIN);
    await this.prisma.board.delete({ where: { id: boardId } });
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

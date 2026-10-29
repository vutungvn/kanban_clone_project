import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardMember, BoardRole, BoardVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
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
  workspace: { select: { id: true, name: true } },
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
    visibility: board.visibility,
    workspace: board.workspace,
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
    private readonly workspaces: WorkspaceAccessService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      include: { board: { include: withMembers } },
      orderBy: { board: { createdAt: 'desc' } },
    });
    return memberships.map((m) => toSummary(m.board, m));
  }

  /** Không chọn không gian → không gian mình tham gia sớm nhất (không còn không gian nào → tạo không gian cá nhân). */
  async create(userId: string, dto: CreateBoardDto) {
    const workspaceId = await this.workspaces.forNewBoard(userId, dto.workspaceId);
    const board = await this.prisma.board.create({
      data: {
        title: dto.title,
        background: dto.background,
        ownerId: userId,
        workspaceId,
        visibility: dto.visibility,
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
    // Khách = thành viên bảng không thuộc không gian chứa bảng
    const inWorkspace = await this.prisma.workspaceMember.findMany({
      where: { workspaceId: board.workspaceId, userId: { in: board.members.map((m) => m.userId) } },
      select: { userId: true },
    });
    const workspaceMemberIds = new Set(inWorkspace.map((m) => m.userId));
    return {
      ...toSummary(board, me),
      members: board.members.map((m) => ({ ...toMember(m), guest: !workspaceMemberIds.has(m.userId) })),
      updatedAt: board.updatedAt,
      labels: board.labels,
      lists: board.lists.map(toList),
    };
  }

  /**
   * Chỉ ADMIN của bảng. Đổi chế độ hiển thị / chuyển sang không gian khác (phải là thành viên không gian đích;
   * thành viên bảng giữ nguyên — ai không thuộc không gian mới thành khách ở đó).
   */
  async update(boardId: string, userId: string, dto: UpdateBoardDto) {
    const me = await this.access.require(boardId, userId, BoardRole.ADMIN);
    const before = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId }, select: { workspaceId: true, visibility: true } });
    const moving = dto.workspaceId !== undefined && dto.workspaceId !== before.workspaceId;
    if (moving) await this.workspaces.require(dto.workspaceId!, userId);
    const board = await this.prisma.board.update({
      where: { id: boardId },
      data: { title: dto.title, background: dto.background, visibility: dto.visibility, workspaceId: moving ? dto.workspaceId : undefined },
      include: withMembers,
    });
    this.realtime.boardChanged(boardId);
    if (moving || board.visibility !== before.visibility) {
      await this.workspaceAudienceChanged(boardId, [before.workspaceId, board.workspaceId], userId);
    }
    return toSummary(board, me);
  }

  /**
   * Bảng đổi không gian / chế độ hiển thị → thành viên bảng (nhóm bảng trên trang /boards) và thành viên các không gian
   * liên quan (danh sách "bảng có thể tham gia") tải lại.
   */
  private async workspaceAudienceChanged(boardId: string, workspaceIds: string[], actorId: string) {
    const [boardMembers, workspaceMembers] = await Promise.all([
      this.prisma.boardMember.findMany({ where: { boardId }, select: { userId: true } }),
      this.prisma.workspaceMember.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { userId: true } }),
    ]);
    const userIds = new Set([...boardMembers, ...workspaceMembers].map((m) => m.userId));
    for (const id of userIds) this.realtime.toUser(id, 'workspaces:changed', { boardId }, id === actorId);
  }

  /** Bảng chế độ Không gian mà mình thuộc không gian nhưng chưa là thành viên bảng → được xem tóm tắt / tham gia. */
  private async joinable(boardId: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        title: true,
        background: true,
        visibility: true,
        workspaceId: true,
        workspace: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });
    if (!board) throw new NotFoundException(BOARD_NOT_FOUND);
    const member = await this.prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } } });
    if (member) return { board, member };
    if (board.visibility !== BoardVisibility.WORKSPACE) throw new NotFoundException(BOARD_NOT_FOUND);
    const inWorkspace = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: board.workspaceId, userId } },
    });
    if (!inWorkspace) throw new NotFoundException(BOARD_NOT_FOUND);
    return { board, member: null };
  }

  /** Tóm tắt bảng cho màn "Tham gia bảng" (khi mở link bảng chế độ Không gian mà chưa là thành viên). */
  async preview(boardId: string, userId: string) {
    const { board, member } = await this.joinable(boardId, userId);
    return {
      id: board.id,
      title: board.title,
      background: board.background,
      workspace: board.workspace,
      memberCount: board._count.members,
      isMember: !!member,
    };
  }

  /** Tham gia bảng chế độ Không gian với vai trò MEMBER. Đã là thành viên → trả về như cũ. */
  async join(boardId: string, userId: string) {
    const { member } = await this.joinable(boardId, userId);
    const me =
      member ??
      (await this.prisma.boardMember.upsert({
        where: { boardId_userId: { boardId, userId } },
        create: { boardId, userId, role: BoardRole.MEMBER },
        update: {},
      }));
    if (!member) {
      // Đang chờ duyệt qua liên kết mời thì không cần nữa
      await this.prisma.boardJoinRequest.deleteMany({ where: { boardId, userId } });
      this.realtime.boardChanged(boardId);
    }
    const board = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId }, include: withMembers });
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

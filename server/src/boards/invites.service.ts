import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole, NotificationType } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BoardAccessService, lockBoard } from './board-access.service';
import { memberUserSelect, toMember } from './boards.service';
import type { ApproveJoinRequestDto, CreateInviteLinkDto, UpdateInviteLinkDto } from './dto/invite.dto';
import { ALREADY_MEMBER } from './members.service';

export const INVITE_INVALID = 'Liên kết không hợp lệ hoặc đã bị tắt';
export const LINK_DISABLED = 'Liên kết mời đang tắt';
export const REQUEST_NOT_FOUND = 'Yêu cầu không còn tồn tại';

const linkSelect = { inviteToken: true, inviteRole: true, inviteRequiresApproval: true } as const;

type LinkFields = { inviteToken: string | null; inviteRole: BoardRole; inviteRequiresApproval: boolean };

const toLink = (b: LinkFields) =>
  b.inviteToken ? { token: b.inviteToken, role: b.inviteRole, requiresApproval: b.inviteRequiresApproval } : null;

/** 32 byte ngẫu nhiên → 43 ký tự base64url, không thể đoán / dò. */
const newToken = () => randomBytes(32).toString('base64url');

/**
 * Liên kết mời (mỗi bảng 1 link, tạo lại = thu hồi link cũ) và yêu cầu tham gia
 * (khi link ở chế độ "cần duyệt").
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ===== ADMIN quản lý liên kết =====

  async getLink(boardId: string, actorId: string) {
    await this.access.require(boardId, actorId, BoardRole.ADMIN);
    const board = await this.prisma.board.findUniqueOrThrow({ where: { id: boardId }, select: linkSelect });
    return toLink(board);
  }

  /** Tạo mới hoặc tạo lại (token mới → link cũ hết hiệu lực ngay). */
  createLink(boardId: string, actorId: string, dto: CreateInviteLinkDto) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      const board = await tx.board.update({
        where: { id: boardId },
        data: { inviteToken: newToken(), inviteRole: dto.role, inviteRequiresApproval: dto.requiresApproval },
        select: linkSelect,
      });
      return toLink(board);
    });
  }

  /** Đổi vai trò / chế độ duyệt, giữ nguyên token. */
  updateLink(boardId: string, actorId: string, dto: UpdateInviteLinkDto) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      const current = await tx.board.findUniqueOrThrow({ where: { id: boardId }, select: linkSelect });
      if (!current.inviteToken) throw new NotFoundException(LINK_DISABLED);
      const board = await tx.board.update({
        where: { id: boardId },
        data: { inviteRole: dto.role, inviteRequiresApproval: dto.requiresApproval },
        select: linkSelect,
      });
      return toLink(board);
    });
  }

  /** Tắt liên kết. Yêu cầu đang chờ vẫn giữ để ADMIN duyệt. */
  disableLink(boardId: string, actorId: string) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      await tx.board.update({ where: { id: boardId }, data: { inviteToken: null } });
    });
  }

  // ===== Người nhận mở liên kết =====

  /** Xem trước: chỉ tên, phông nền, số thành viên + trạng thái của chính mình. */
  async preview(token: string, userId: string) {
    const board = await this.prisma.board.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        title: true,
        background: true,
        ...linkSelect,
        _count: { select: { members: true } },
        members: { where: { userId }, select: { userId: true } },
        joinRequests: { where: { userId }, select: { userId: true } },
      },
    });
    if (!board) throw new NotFoundException(INVITE_INVALID);
    return {
      board: { id: board.id, title: board.title, background: board.background, memberCount: board._count.members },
      role: board.inviteRole,
      requiresApproval: board.inviteRequiresApproval,
      status: board.members.length ? 'MEMBER' : board.joinRequests.length ? 'PENDING' : 'NONE',
    } as const;
  }

  /**
   * Tham gia ngay, hoặc gửi yêu cầu nếu link cần duyệt. Gọi lại nhiều lần vẫn an toàn:
   * đã là thành viên → giữ nguyên vai trò hiện tại (không bao giờ bị hạ quyền vì mở link).
   */
  async join(token: string, userId: string) {
    const found = await this.prisma.board.findUnique({ where: { inviteToken: token }, select: { id: true } });
    if (!found) throw new NotFoundException(INVITE_INVALID);
    const boardId = found.id;

    const result = await this.prisma.$transaction(async (tx) => {
      await lockBoard(tx, boardId);
      // Đọc lại sau khi khoá: link có thể vừa bị tắt / tạo lại
      const board = await tx.board.findUnique({ where: { id: boardId }, select: linkSelect });
      if (!board || board.inviteToken !== token) throw new NotFoundException(INVITE_INVALID);

      const key = { boardId_userId: { boardId, userId } };
      if (await tx.boardMember.findUnique({ where: key })) return { status: 'MEMBER', boardId } as const;

      if (board.inviteRequiresApproval) {
        const existing = await tx.boardJoinRequest.findUnique({ where: key });
        if (!existing) await tx.boardJoinRequest.create({ data: { boardId, userId } });
        return { status: 'PENDING', boardId, requested: !existing } as const;
      }
      await tx.boardMember.create({ data: { boardId, userId, role: board.inviteRole } });
      await tx.boardJoinRequest.deleteMany({ where: { boardId, userId } });
      return { status: 'MEMBER', boardId, joined: true } as const;
    });
    // Người mới vào bảng → ai đang mở bảng thấy ngay thành viên mới
    if ('joined' in result) this.realtime.boardChanged(boardId);
    // Yêu cầu mới → báo cho các ADMIN của bảng
    if ('requested' in result && result.requested) {
      const [admins, boardTitle] = await Promise.all([
        this.prisma.boardMember.findMany({ where: { boardId, role: BoardRole.ADMIN }, select: { userId: true } }),
        this.notifications.boardTitle(boardId),
      ]);
      await this.notifications.notify(
        admins.map((a) => ({ userId: a.userId, actorId: userId, type: NotificationType.JOIN_REQUESTED, boardId, data: { boardTitle } })),
      );
    }
    return { status: result.status, boardId };
  }

  /** Người gửi tự huỷ yêu cầu của mình (không có yêu cầu cũng coi như xong). */
  async cancelRequest(token: string, userId: string) {
    const board = await this.prisma.board.findUnique({ where: { inviteToken: token }, select: { id: true } });
    if (!board) throw new NotFoundException(INVITE_INVALID);
    await this.prisma.boardJoinRequest.deleteMany({ where: { boardId: board.id, userId } });
  }

  // ===== ADMIN duyệt yêu cầu =====

  async listRequests(boardId: string, actorId: string) {
    await this.access.require(boardId, actorId, BoardRole.ADMIN);
    const requests = await this.prisma.boardJoinRequest.findMany({
      where: { boardId },
      include: { user: { select: memberUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
    return requests.map(({ user, createdAt }) => ({ user, createdAt }));
  }

  /** Duyệt: tạo thành viên + xoá yêu cầu. 2 ADMIN cùng duyệt → người sau nhận 404. */
  approve(boardId: string, actorId: string, userId: string, dto: ApproveJoinRequestDto) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      const key = { boardId_userId: { boardId, userId } };
      const request = await tx.boardJoinRequest.findUnique({ where: key });
      if (!request) throw new NotFoundException(REQUEST_NOT_FOUND);
      await tx.boardJoinRequest.delete({ where: key });

      // Đã vào bảng bằng cách khác (vd được mời thẳng) → chỉ dọn yêu cầu.
      // Không ném lỗi ở đây: lỗi sẽ rollback cả việc xoá yêu cầu.
      if (await tx.boardMember.findUnique({ where: key })) return null;

      const member = await tx.boardMember.create({
        data: { boardId, userId, role: dto.role },
        include: { user: { select: memberUserSelect } },
      });
      return toMember(member);
    }).then(async (member) => {
      if (!member) throw new ConflictException(ALREADY_MEMBER);
      this.realtime.boardChanged(boardId);
      await this.notifications.notify([
        {
          userId,
          actorId,
          type: NotificationType.JOIN_APPROVED,
          boardId,
          data: { boardTitle: await this.notifications.boardTitle(boardId), role: member.role },
        },
      ]);
      return member;
    });
  }

  async reject(boardId: string, actorId: string, userId: string) {
    await this.access.require(boardId, actorId, BoardRole.ADMIN);
    const { count } = await this.prisma.boardJoinRequest.deleteMany({ where: { boardId, userId } });
    if (count === 0) throw new NotFoundException(REQUEST_NOT_FOUND);
  }
}

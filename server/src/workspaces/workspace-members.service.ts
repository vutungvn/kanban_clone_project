import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole, NotificationType, Prisma, WorkspaceRole, type WorkspaceMember } from '@prisma/client';
import { lockBoard } from '../boards/board-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { InviteWorkspaceMemberDto, UpdateWorkspaceMemberDto } from './dto/workspace-member.dto';
import { WorkspaceAccessService } from './workspace-access.service';

export const USER_NOT_FOUND = 'Không tìm thấy người dùng với email này';
export const ALREADY_WORKSPACE_MEMBER = 'Người này đã là thành viên của không gian';
export const WORKSPACE_MEMBER_NOT_FOUND = 'Không tìm thấy thành viên';
export const LAST_WORKSPACE_ADMIN = 'Không gian cần ít nhất một quản trị viên';
export const LAST_WORKSPACE_ADMIN_LEAVE = 'Bạn là quản trị viên duy nhất. Hãy chỉ định quản trị viên khác trước khi rời không gian';

const personSelect = { id: true, name: true, email: true, avatarUrl: true } as const satisfies Prisma.UserSelect;

const toMember = ({ user, role, joinedAt }: WorkspaceMember & { user: Prisma.UserGetPayload<{ select: typeof personSelect }> }) => ({
  ...user,
  role,
  joinedAt,
});

/**
 * Thành viên không gian: danh sách (kèm khách), mời theo email, đổi vai trò, xoá / tự rời.
 * Quy tắc: không gian luôn còn ít nhất 1 quản trị viên. Mọi thay đổi chạy trong WorkspaceAccessService.withLock.
 * Quyền trong từng bảng không đổi theo không gian — chỉ khi xoá kèm `fromBoards` mới gỡ khỏi các bảng.
 */
@Injectable()
export class WorkspaceMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Thành viên + khách. Khách = thành viên bảng của không gian mà không thuộc không gian; chỉ tính các bảng
   * người xem cũng là thành viên (không lộ tên bảng riêng tư mình không vào được).
   */
  async list(workspaceId: string, userId: string) {
    await this.access.require(workspaceId, userId);
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { joinedAt: 'asc' },
      include: { user: { select: personSelect } },
    });
    const memberIds = members.map((m) => m.userId);
    const boards = await this.prisma.board.findMany({
      where: { workspaceId, members: { some: { userId } } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, members: { where: { userId: { notIn: memberIds } }, select: { user: { select: personSelect } } } },
    });
    const guests = new Map<string, Prisma.UserGetPayload<{ select: typeof personSelect }> & { boards: { id: string; title: string }[] }>();
    for (const board of boards) {
      for (const { user } of board.members) {
        const guest = guests.get(user.id) ?? { ...user, boards: [] };
        guest.boards.push({ id: board.id, title: board.title });
        guests.set(user.id, guest);
      }
    }
    return {
      members: members.map(toMember),
      guests: [...guests.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    };
  }

  /** Chỉ quản trị viên. Mời khách (đang ở bảng của không gian) → thành thành viên, các bảng giữ nguyên. */
  async invite(workspaceId: string, actorId: string, dto: InviteWorkspaceMemberDto) {
    const member = await this.access.withLock(workspaceId, actorId, WorkspaceRole.ADMIN, async (tx) => {
      const user = await tx.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (!user) throw new NotFoundException(USER_NOT_FOUND);
      const existing = await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } } });
      if (existing) throw new ConflictException(ALREADY_WORKSPACE_MEMBER);
      return toMember(
        await tx.workspaceMember.create({ data: { workspaceId, userId: user.id, role: dto.role }, include: { user: { select: personSelect } } }),
      );
    });
    await this.changed(workspaceId, actorId, [member.id]);
    await this.notify(workspaceId, actorId, member.id, NotificationType.WORKSPACE_INVITED, member.role);
    return member;
  }

  /** Chỉ quản trị viên. Hạ quyền quản trị viên cuối cùng → 400. */
  async updateRole(workspaceId: string, actorId: string, userId: string, dto: UpdateWorkspaceMemberDto) {
    let changed = false;
    const member = await this.access.withLock(workspaceId, actorId, WorkspaceRole.ADMIN, async (tx) => {
      const target = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { user: { select: personSelect } },
      });
      if (!target) throw new NotFoundException(WORKSPACE_MEMBER_NOT_FOUND);
      if (target.role === dto.role) return toMember(target);
      changed = true;
      if (target.role === WorkspaceRole.ADMIN) await this.ensureOtherAdmin(tx, target, LAST_WORKSPACE_ADMIN);
      return toMember(
        await tx.workspaceMember.update({
          where: { workspaceId_userId: { workspaceId, userId } },
          data: { role: dto.role },
          include: { user: { select: personSelect } },
        }),
      );
    });
    if (changed) {
      await this.changed(workspaceId, actorId);
      if (userId !== actorId) await this.notify(workspaceId, actorId, userId, NotificationType.WORKSPACE_ROLE_CHANGED, dto.role);
    }
    return member;
  }

  /**
   * Quản trị viên xoá người khác; ai cũng tự rời được (trừ quản trị viên cuối cùng).
   * `fromBoards` (chỉ khi xoá người khác): gỡ khỏi mọi bảng của không gian (kể cả các thẻ được giao, thông báo của bảng);
   * họ là ADMIN duy nhất của bảng nào → người thực hiện thành ADMIN bảng đó để bảng không mất quản trị.
   * Không `fromBoards` / tự rời: vẫn ở các bảng, thành khách.
   */
  async remove(workspaceId: string, actorId: string, userId: string, fromBoards: boolean) {
    const self = userId === actorId;
    const removeBoards = fromBoards && !self;
    const removedFrom = await this.access.withLock(
      workspaceId,
      actorId,
      self ? WorkspaceRole.MEMBER : WorkspaceRole.ADMIN,
      async (tx, me) => {
        const target = self ? me : await tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
        if (!target) throw new NotFoundException(WORKSPACE_MEMBER_NOT_FOUND);
        if (target.role === WorkspaceRole.ADMIN) await this.ensureOtherAdmin(tx, target, self ? LAST_WORKSPACE_ADMIN_LEAVE : LAST_WORKSPACE_ADMIN);
        await tx.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
        if (!removeBoards) return [];

        const boards = await tx.board.findMany({ where: { workspaceId, members: { some: { userId } } }, select: { id: true } });
        for (const { id: boardId } of boards) {
          await lockBoard(tx, boardId);
          const otherAdmins = await tx.boardMember.count({ where: { boardId, role: BoardRole.ADMIN, NOT: { userId } } });
          if (!otherAdmins) {
            await tx.boardMember.upsert({
              where: { boardId_userId: { boardId, userId: actorId } },
              create: { boardId, userId: actorId, role: BoardRole.ADMIN },
              update: { role: BoardRole.ADMIN },
            });
          }
          await tx.boardMember.delete({ where: { boardId_userId: { boardId, userId } } });
          await tx.cardMember.deleteMany({ where: { userId, card: { list: { boardId } } } });
        }
        return boards.map((b) => b.id);
      },
    );

    for (const boardId of removedFrom) {
      await this.realtime.memberRemoved(boardId, userId);
      await this.notifications.removeForBoard(userId, boardId);
    }
    await this.changed(workspaceId, actorId, [userId]);
    if (!self) await this.notify(workspaceId, actorId, userId, NotificationType.WORKSPACE_REMOVED);
    return { removedFromBoards: removedFrom.length };
  }

  private async ensureOtherAdmin(tx: Prisma.TransactionClient, target: WorkspaceMember, message: string) {
    const others = await tx.workspaceMember.count({
      where: { workspaceId: target.workspaceId, role: WorkspaceRole.ADMIN, NOT: { userId: target.userId } },
    });
    if (!others) throw new BadRequestException(message);
  }

  /** Thành viên (và `extra`: người vừa vào / vừa bị xoá) tải lại danh sách không gian + bảng. Tab vừa thao tác tự cập nhật. */
  private async changed(workspaceId: string, actorId: string, extra: string[] = []) {
    const members = await this.prisma.workspaceMember.findMany({ where: { workspaceId }, select: { userId: true } });
    const userIds = new Set([...members.map((m) => m.userId), ...extra]);
    for (const userId of userIds) this.realtime.toUser(userId, 'workspaces:changed', { workspaceId }, userId === actorId);
  }

  private async notify(workspaceId: string, actorId: string, userId: string, type: NotificationType, role?: WorkspaceRole) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    await this.notifications.notify([
      { userId, actorId, type, data: { workspaceId, workspaceName: workspace?.name ?? '', ...(role && { role }) } },
    ]);
  }
}

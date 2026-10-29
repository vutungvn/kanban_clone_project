import { BadRequestException, Injectable } from '@nestjs/common';
import { BoardVisibility, Prisma, WorkspaceRole, type WorkspaceMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { StorageService } from '../storage/storage.service';
import type { CreateWorkspaceDto, DeleteWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';
import { WorkspaceAccessService } from './workspace-access.service';

/** Số không gian tối đa mỗi người tạo (chống spam) */
export const MAX_CREATED_WORKSPACES = 10;
export const TOO_MANY_WORKSPACES = `Mỗi người tạo được tối đa ${MAX_CREATED_WORKSPACES} không gian làm việc`;
export const CONFIRM_NAME_MISMATCH = 'Tên xác nhận không khớp với tên không gian';

const workspaceInclude = { _count: { select: { members: true, boards: true } } } as const satisfies Prisma.WorkspaceInclude;

type WorkspaceWithCount = Prisma.WorkspaceGetPayload<{ include: typeof workspaceInclude }>;

/** Không gian + quan hệ của user hiện tại → WorkspaceDto. */
const toWorkspace = (workspace: WorkspaceWithCount, me: WorkspaceMember) => ({
  id: workspace.id,
  name: workspace.name,
  description: workspace.description,
  role: me.role,
  memberCount: workspace._count.members,
  boardCount: workspace._count.boards,
  createdAt: workspace.createdAt,
  joinedAt: me.joinedAt,
});

/** Không gian làm việc: danh sách, tạo, xem, sửa tên / mô tả, bảng có thể tham gia, xoá. Thành viên: WorkspaceMembersService. */
@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { workspace: { include: workspaceInclude } },
    });
    return memberships.map((m) => toWorkspace(m.workspace, m));
  }

  async findOne(workspaceId: string, userId: string) {
    const me = await this.access.require(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: workspaceInclude });
    return toWorkspace(workspace, me);
  }

  /** Người tạo là ADMIN. */
  async create(userId: string, dto: CreateWorkspaceDto) {
    const created = await this.prisma.workspace.count({ where: { createdById: userId } });
    if (created >= MAX_CREATED_WORKSPACES) throw new BadRequestException(TOO_MANY_WORKSPACES);
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
        createdById: userId,
        members: { create: { userId, role: WorkspaceRole.ADMIN } },
      },
      include: { ...workspaceInclude, members: { where: { userId } } },
    });
    // Các tab khác của chính mình cập nhật sidebar / menu
    this.realtime.toUser(userId, 'workspaces:changed', { workspaceId: workspace.id }, true);
    return toWorkspace(workspace, workspace.members[0]);
  }

  /** Chỉ ADMIN. Thành viên không gian tải lại danh sách không gian; ai đang mở bảng của không gian thấy tên mới. */
  async update(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    const me = await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name, description: dto.description },
      include: { ...workspaceInclude, members: { select: { userId: true } }, boards: { select: { id: true } } },
    });
    for (const m of workspace.members) this.realtime.toUser(m.userId, 'workspaces:changed', { workspaceId }, m.userId === userId);
    for (const b of workspace.boards) this.realtime.boardChanged(b.id);
    return toWorkspace(workspace, me);
  }

  /** Bảng chế độ Không gian của không gian mà mình chưa tham gia — hiện ở trang không gian kèm nút "Tham gia". */
  async joinableBoards(workspaceId: string, userId: string) {
    await this.access.require(workspaceId, userId);
    const boards = await this.prisma.board.findMany({
      where: { workspaceId, visibility: BoardVisibility.WORKSPACE, members: { none: { userId } } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, background: true, _count: { select: { members: true } } },
    });
    return boards.map(({ _count, ...board }) => ({ ...board, memberCount: _count.members }));
  }

  /**
   * Xoá không gian — chỉ ADMIN, phải gõ lại đúng tên. Xoá vĩnh viễn MỌI bảng của không gian (kể cả bảng riêng tư mình
   * không vào), cùng danh sách, thẻ, tệp đính kèm, hoạt động, thông báo của các bảng đó. Mẫu bảng không bị ảnh hưởng.
   */
  async remove(workspaceId: string, userId: string, dto: DeleteWorkspaceDto) {
    await this.access.require(workspaceId, userId, WorkspaceRole.ADMIN);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: {
        name: true,
        members: { select: { userId: true } },
        boards: { select: { id: true, members: { select: { userId: true } } } },
      },
    });
    if (dto.name.trim() !== workspace.name) throw new BadRequestException(CONFIRM_NAME_MISMATCH);

    const files = await this.storage.keysOf({ card: { list: { board: { workspaceId } } } });
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    for (const board of workspace.boards) this.realtime.boardDeleted(board.id);
    void this.storage.discard(files);

    // Thành viên không gian + mọi người trong các bảng (kể cả khách) tải lại danh sách không gian / bảng
    const userIds = new Set([...workspace.members, ...workspace.boards.flatMap((b) => b.members)].map((m) => m.userId));
    for (const id of userIds) this.realtime.toUser(id, 'workspaces:changed', { workspaceId }, id === userId);
    return { deletedBoards: workspace.boards.length };
  }
}

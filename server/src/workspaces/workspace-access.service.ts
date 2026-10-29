import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WorkspaceRole, type WorkspaceMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const WORKSPACE_NOT_FOUND = 'Không tìm thấy không gian làm việc';
export const WORKSPACE_ADMIN_ONLY = 'Chỉ quản trị viên của không gian mới được thực hiện thao tác này';

const ROLE_RANK: Record<WorkspaceRole, number> = { MEMBER: 0, ADMIN: 1 };

/** "Nguyễn Văn An" → "Không gian của An" — tên không gian cá nhân (tạo lúc đăng ký / khi không còn không gian nào). */
export const personalWorkspaceName = (userName: string) => `Không gian của ${userName.trim().split(/\s+/).pop() ?? userName}`;

/** Dữ liệu tạo không gian cá nhân cho 1 user (user là ADMIN). */
export const personalWorkspaceData = (userId: string, userName: string) =>
  ({
    name: personalWorkspaceName(userName),
    createdById: userId,
    members: { create: { userId, role: WorkspaceRole.ADMIN } },
  }) satisfies Prisma.WorkspaceUncheckedCreateInput;

/** Kiểm tra quyền trong không gian — dùng chung cho các module (bảng, mẫu...). */
@Injectable()
export class WorkspaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Phải là thành viên (không phải → 404, không lộ không gian có tồn tại); `minRole` = ADMIN → 403 nếu chỉ là MEMBER. */
  async require(workspaceId: string, userId: string, minRole: WorkspaceRole = WorkspaceRole.MEMBER, db: Prisma.TransactionClient = this.prisma) {
    const membership = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!membership) throw new NotFoundException(WORKSPACE_NOT_FOUND);
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) throw new ForbiddenException(WORKSPACE_ADMIN_ONLY);
    return membership;
  }

  /**
   * Chạy `fn` trong transaction đã khoá dòng không gian, sau khi kiểm tra quyền người thao tác (đọc lại sau khi khoá).
   * Mọi thay đổi thành viên của cùng 1 không gian chạy lần lượt — vd 2 quản trị viên hạ quyền nhau cùng lúc
   * không làm không gian mất hết quản trị viên.
   */
  withLock<T>(
    workspaceId: string,
    actorId: string,
    minRole: WorkspaceRole,
    fn: (tx: Prisma.TransactionClient, me: WorkspaceMember) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`;
        if (!rows.length) throw new NotFoundException(WORKSPACE_NOT_FOUND);
        const me = await this.require(workspaceId, actorId, minRole, tx);
        return fn(tx, me);
      },
      // Xoá khỏi mọi bảng của không gian → nhiều câu lệnh; nới thời gian chờ mặc định (5s)
      { timeout: 30_000 },
    );
  }

  /**
   * Không gian chứa bảng mới: `workspaceId` (phải là thành viên) hoặc không gian mình tham gia sớm nhất.
   * Không còn không gian nào (đã rời / xoá hết) → tạo lại không gian cá nhân.
   */
  async forNewBoard(userId: string, workspaceId?: string) {
    if (workspaceId) {
      await this.require(workspaceId, userId);
      return workspaceId;
    }
    const first = await this.prisma.workspaceMember.findFirst({ where: { userId }, orderBy: { joinedAt: 'asc' } });
    if (first) return first.workspaceId;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    const workspace = await this.prisma.workspace.create({ data: personalWorkspaceData(userId, user.name) });
    return workspace.id;
  }
}

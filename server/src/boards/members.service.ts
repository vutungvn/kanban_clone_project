import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardMember, BoardRole, Prisma } from '@prisma/client';
import { BoardAccessService } from './board-access.service';
import { memberUserSelect, toMember } from './boards.service';
import type { InviteMemberDto, UpdateMemberDto } from './dto/member.dto';

export const USER_NOT_FOUND = 'Không tìm thấy người dùng với email này';
export const ALREADY_MEMBER = 'Người này đã là thành viên của bảng';
export const MEMBER_NOT_FOUND = 'Không tìm thấy thành viên';
export const LAST_ADMIN = 'Bảng cần ít nhất một quản trị viên';
export const LAST_ADMIN_LEAVE = 'Bạn là quản trị viên duy nhất. Hãy chỉ định quản trị viên khác hoặc xoá bảng';

const withUser = { user: { select: memberUserSelect } } as const satisfies Prisma.BoardMemberInclude;

/**
 * Mời, đổi vai trò, xoá thành viên. Quy tắc: bảng luôn còn ít nhất 1 ADMIN.
 * Chạy trong BoardAccessService.withLock (khoá dòng board) để các thay đổi đồng thời không giẫm lên nhau.
 */
@Injectable()
export class MembersService {
  constructor(private readonly access: BoardAccessService) {}

  invite(boardId: string, actorId: string, dto: InviteMemberDto) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      const user = await tx.user.findUnique({ where: { email: dto.email }, select: { id: true } });
      if (!user) throw new NotFoundException(USER_NOT_FOUND);

      const existing = await tx.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: user.id } } });
      if (existing) throw new ConflictException(ALREADY_MEMBER);

      const member = await tx.boardMember.create({ data: { boardId, userId: user.id, role: dto.role }, include: withUser });
      // Đang chờ duyệt qua liên kết mà được mời thẳng → yêu cầu không còn cần nữa
      await tx.boardJoinRequest.deleteMany({ where: { boardId, userId: user.id } });
      return toMember(member);
    });
  }

  updateRole(boardId: string, actorId: string, userId: string, dto: UpdateMemberDto) {
    return this.access.withLock(boardId, actorId, BoardRole.ADMIN, async (tx) => {
      const target = await tx.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } }, include: withUser });
      if (!target) throw new NotFoundException(MEMBER_NOT_FOUND);
      if (target.role === dto.role) return toMember(target);
      if (target.role === BoardRole.ADMIN) await this.ensureOtherAdmin(tx, target, LAST_ADMIN);

      const member = await tx.boardMember.update({
        where: { boardId_userId: { boardId, userId } },
        data: { role: dto.role },
        include: withUser,
      });
      return toMember(member);
    });
  }

  /** ADMIN xoá người khác; ai cũng tự rời bảng được (trừ ADMIN cuối cùng). */
  remove(boardId: string, actorId: string, userId: string) {
    const self = userId === actorId;
    return this.access.withLock(boardId, actorId, self ? BoardRole.VIEWER : BoardRole.ADMIN, async (tx, me) => {
      const target = self ? me : await tx.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } } });
      if (!target) throw new NotFoundException(MEMBER_NOT_FOUND);
      if (target.role === BoardRole.ADMIN) await this.ensureOtherAdmin(tx, target, self ? LAST_ADMIN_LEAVE : LAST_ADMIN);

      await tx.boardMember.delete({ where: { boardId_userId: { boardId, userId } } });
    });
  }

  private async ensureOtherAdmin(tx: Prisma.TransactionClient, target: BoardMember, message: string) {
    const others = await tx.boardMember.count({
      where: { boardId: target.boardId, role: BoardRole.ADMIN, NOT: { userId: target.userId } },
    });
    if (others === 0) throw new BadRequestException(message);
  }
}

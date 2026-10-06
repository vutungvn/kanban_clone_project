import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_RANK } from './boards.constants';

export const BOARD_NOT_FOUND = 'Không tìm thấy bảng';

/**
 * Kiểm tra quyền của user trên một board.
 * Không phải thành viên → 404 (không để lộ board có tồn tại hay không).
 * Là thành viên nhưng vai trò thấp hơn yêu cầu → 403.
 */
@Injectable()
export class BoardAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @param notFoundMessage thông báo khi không phải thành viên — truyền vào khi đang thao tác
   *   trên list/card để lỗi khớp với tài nguyên user gọi ("Không tìm thấy thẻ"...)
   */
  async require(
    boardId: string,
    userId: string,
    minRole: BoardRole = BoardRole.VIEWER,
    notFoundMessage = BOARD_NOT_FOUND,
  ) {
    const membership = await this.prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
    if (!membership) throw new NotFoundException(notFoundMessage);
    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(
        minRole === BoardRole.ADMIN
          ? 'Chỉ quản trị viên của bảng mới được thực hiện thao tác này'
          : 'Bạn chỉ có quyền xem bảng này',
      );
    }
    return membership;
  }
}

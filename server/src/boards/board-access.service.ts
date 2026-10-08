import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardMember, BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_RANK } from './boards.constants';

export const BOARD_NOT_FOUND = 'Không tìm thấy bảng';

/** Khoá dòng board đến hết transaction. Trả về false nếu bảng không tồn tại. */
export async function lockBoard(tx: Prisma.TransactionClient, boardId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM boards WHERE id = ${boardId} FOR UPDATE`;
  return rows.length > 0;
}

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
   * @param db truyền transaction client khi cần kiểm tra quyền bên trong transaction
   */
  async require(
    boardId: string,
    userId: string,
    minRole: BoardRole = BoardRole.VIEWER,
    notFoundMessage = BOARD_NOT_FOUND,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const membership = await db.boardMember.findUnique({
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

  /**
   * Chạy `fn` trong transaction đã khoá dòng board, sau khi kiểm tra quyền của người thao tác
   * (đọc lại sau khi khoá). Mọi thay đổi thành viên / liên kết mời của cùng 1 bảng vì thế chạy
   * lần lượt — vd 2 ADMIN hạ quyền nhau cùng lúc không làm bảng mất hết ADMIN.
   */
  withLock<T>(
    boardId: string,
    actorId: string,
    minRole: BoardRole,
    fn: (tx: Prisma.TransactionClient, me: BoardMember) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockBoard(tx, boardId))) throw new NotFoundException(BOARD_NOT_FOUND);
      const me = await this.require(boardId, actorId, minRole, BOARD_NOT_FOUND, tx);
      return fn(tx, me);
    });
  }
}

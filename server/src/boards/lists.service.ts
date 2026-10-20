import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardAccessService } from './board-access.service';
import { POSITION_GAP } from './boards.constants';
import type { CreateListDto, MoveListDto, UpdateListDto } from './dto/list.dto';
import { byPosition, listInclude, toList } from './card-shape';
import { placeAt } from './position';

export const LIST_NOT_FOUND = 'Không tìm thấy danh sách';

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  /** Thêm danh sách vào cuối bảng. */
  async create(boardId: string, userId: string, dto: CreateListDto) {
    await this.access.require(boardId, userId, BoardRole.MEMBER);
    const { _max } = await this.prisma.list.aggregate({ where: { boardId }, _max: { position: true } });
    const list = await this.prisma.list.create({
      data: { boardId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
    });
    return { ...list, cards: [] };
  }

  async update(listId: string, userId: string, dto: UpdateListDto) {
    await this.requireEditable(listId, userId);
    const list = await this.prisma.list.update({ where: { id: listId }, data: { title: dto.title }, include: listInclude });
    return toList(list);
  }

  /** Kéo thả: chuyển danh sách tới vị trí `index` trong bảng. */
  async move(listId: string, userId: string, dto: MoveListDto) {
    const boardId = await this.requireEditable(listId, userId);
    return this.prisma.$transaction(async (tx) => {
      const siblings = await tx.list.findMany({
        where: { boardId, NOT: { id: listId } },
        orderBy: byPosition,
        select: { id: true, position: true },
      });
      const { position, rebalanced } = placeAt(siblings, dto.index, listId);
      if (rebalanced) {
        for (const item of rebalanced) {
          await tx.list.update({ where: { id: item.id }, data: { position: item.position } });
        }
      }
      return toList(await tx.list.update({ where: { id: listId }, data: { position }, include: listInclude }));
    });
  }

  /** Xoá danh sách và toàn bộ thẻ bên trong. */
  async remove(listId: string, userId: string) {
    await this.requireEditable(listId, userId);
    await this.prisma.list.delete({ where: { id: listId } });
  }

  /** Kiểm tra quyền sửa danh sách, trả về boardId. */
  private async requireEditable(listId: string, userId: string) {
    const list = await this.prisma.list.findUnique({ where: { id: listId }, select: { boardId: true } });
    if (!list) throw new NotFoundException(LIST_NOT_FOUND);
    await this.access.require(list.boardId, userId, BoardRole.MEMBER, LIST_NOT_FOUND);
    return list.boardId;
  }
}

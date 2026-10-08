import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardAccessService } from './board-access.service';
import { POSITION_GAP } from './boards.constants';
import type { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';
import { LIST_NOT_FOUND } from './lists.service';
import { placeAt } from './position';

export const CARD_NOT_FOUND = 'Không tìm thấy thẻ';

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  /** Thêm thẻ vào cuối danh sách. */
  async create(listId: string, userId: string, dto: CreateCardDto) {
    const list = await this.prisma.list.findUnique({ where: { id: listId }, select: { boardId: true } });
    if (!list) throw new NotFoundException(LIST_NOT_FOUND);
    await this.access.require(list.boardId, userId, BoardRole.MEMBER, LIST_NOT_FOUND);

    const { _max } = await this.prisma.card.aggregate({ where: { listId }, _max: { position: true } });
    return this.prisma.card.create({
      data: { listId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
    });
  }

  async update(cardId: string, userId: string, dto: UpdateCardDto) {
    await this.requireEditable(cardId, userId);
    return this.prisma.card.update({
      where: { id: cardId },
      data: { title: dto.title, description: dto.description },
    });
  }

  /** Kéo thả: chuyển thẻ tới vị trí `index` của danh sách `listId` (cùng bảng). */
  async move(cardId: string, userId: string, dto: MoveCardDto) {
    const boardId = await this.requireEditable(cardId, userId);
    const target = await this.prisma.list.findUnique({ where: { id: dto.listId }, select: { boardId: true } });
    // Chỉ cho chuyển trong cùng bảng; list của bảng khác coi như không tồn tại
    if (!target || target.boardId !== boardId) throw new NotFoundException(LIST_NOT_FOUND);

    return this.prisma.$transaction(async (tx) => {
      const siblings = await tx.card.findMany({
        where: { listId: dto.listId, NOT: { id: cardId } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, position: true },
      });
      const { position, rebalanced } = placeAt(siblings, dto.index, cardId);
      if (rebalanced) {
        for (const item of rebalanced) {
          await tx.card.update({ where: { id: item.id }, data: { position: item.position } });
        }
      }
      return tx.card.update({ where: { id: cardId }, data: { listId: dto.listId, position } });
    });
  }

  async remove(cardId: string, userId: string) {
    await this.requireEditable(cardId, userId);
    await this.prisma.card.delete({ where: { id: cardId } });
  }

  private async requireEditable(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { list: { select: { boardId: true } } },
    });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);
    return card.list.boardId;
  }
}

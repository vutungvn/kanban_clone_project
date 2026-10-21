import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { POSITION_GAP } from './boards.constants';
import { byPosition } from './card-shape';
import { CARD_NOT_FOUND } from './cards.service';
import type {
  CreateChecklistDto,
  CreateChecklistItemDto,
  UpdateChecklistDto,
  UpdateChecklistItemDto,
} from './dto/checklist.dto';

export const CHECKLIST_NOT_FOUND = 'Không tìm thấy checklist';
export const CHECKLIST_ITEM_NOT_FOUND = 'Không tìm thấy mục trong checklist';

/**
 * Checklist trong thẻ và các mục của nó. Mọi thao tác cần vai trò MEMBER trở lên.
 * Ghi lịch sử khi thêm / xoá checklist và tích / bỏ tích mục (đổi tên thì không).
 */
@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly activities: ActivitiesService,
  ) {}

  /** Thêm checklist vào cuối thẻ. */
  async create(cardId: string, userId: string, dto: CreateChecklistDto) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, select: { list: { select: { boardId: true } } } });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);

    const boardId = card.list.boardId;
    const { _max } = await this.prisma.checklist.aggregate({ where: { cardId }, _max: { position: true } });
    return this.prisma.$transaction(async (tx) => {
      const checklist = await tx.checklist.create({
        data: { cardId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
        include: { items: true },
      });
      await this.activities.log(tx, { boardId, cardId, userId, type: ActivityType.CHECKLIST_ADDED, data: { title: dto.title } });
      return checklist;
    });
  }

  async update(checklistId: string, userId: string, dto: UpdateChecklistDto) {
    await this.requireChecklist(checklistId, userId);
    return this.prisma.checklist.update({
      where: { id: checklistId },
      data: { title: dto.title },
      include: { items: { orderBy: byPosition } },
    });
  }

  /** Xoá checklist và mọi mục bên trong. */
  async remove(checklistId: string, userId: string) {
    const checklist = await this.requireChecklist(checklistId, userId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.checklist.deleteMany({ where: { id: checklistId } });
      if (!count) return;
      await this.activities.log(tx, {
        boardId: checklist.boardId,
        cardId: checklist.cardId,
        userId,
        type: ActivityType.CHECKLIST_REMOVED,
        data: { title: checklist.title },
      });
    });
  }

  /** Thêm mục vào cuối checklist. */
  async addItem(checklistId: string, userId: string, dto: CreateChecklistItemDto) {
    await this.requireChecklist(checklistId, userId);
    const { _max } = await this.prisma.checklistItem.aggregate({ where: { checklistId }, _max: { position: true } });
    return this.prisma.checklistItem.create({
      data: { checklistId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
    });
  }

  /** Đổi nội dung và/hoặc đánh dấu hoàn thành. */
  async updateItem(itemId: string, userId: string, dto: UpdateChecklistItemDto) {
    const current = await this.requireItem(itemId, userId);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.checklistItem.update({
        where: { id: itemId },
        data: { title: dto.title, completed: dto.completed },
      });
      if (dto.completed !== undefined && dto.completed !== current.completed) {
        await this.activities.log(tx, {
          boardId: current.boardId,
          cardId: current.cardId,
          userId,
          type: dto.completed ? ActivityType.CHECKLIST_ITEM_COMPLETED : ActivityType.CHECKLIST_ITEM_UNCOMPLETED,
          data: { title: item.title, checklist: current.checklistTitle },
        });
      }
      return item;
    });
  }

  async removeItem(itemId: string, userId: string) {
    await this.requireItem(itemId, userId);
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
  }

  private async requireChecklist(checklistId: string, userId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      select: { title: true, cardId: true, card: { select: { list: { select: { boardId: true } } } } },
    });
    if (!checklist) throw new NotFoundException(CHECKLIST_NOT_FOUND);
    const boardId = checklist.card.list.boardId;
    await this.access.require(boardId, userId, BoardRole.MEMBER, CHECKLIST_NOT_FOUND);
    return { boardId, cardId: checklist.cardId, title: checklist.title };
  }

  private async requireItem(itemId: string, userId: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: {
        completed: true,
        checklist: { select: { title: true, cardId: true, card: { select: { list: { select: { boardId: true } } } } } },
      },
    });
    if (!item) throw new NotFoundException(CHECKLIST_ITEM_NOT_FOUND);
    const boardId = item.checklist.card.list.boardId;
    await this.access.require(boardId, userId, BoardRole.MEMBER, CHECKLIST_ITEM_NOT_FOUND);
    return { boardId, cardId: item.checklist.cardId, checklistTitle: item.checklist.title, completed: item.completed };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

/** Checklist trong thẻ và các mục của nó. Mọi thao tác cần vai trò MEMBER trở lên. */
@Injectable()
export class ChecklistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  /** Thêm checklist vào cuối thẻ. */
  async create(cardId: string, userId: string, dto: CreateChecklistDto) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, select: { list: { select: { boardId: true } } } });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);

    const { _max } = await this.prisma.checklist.aggregate({ where: { cardId }, _max: { position: true } });
    return this.prisma.checklist.create({
      data: { cardId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
      include: { items: true },
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
    await this.requireChecklist(checklistId, userId);
    await this.prisma.checklist.delete({ where: { id: checklistId } });
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
    await this.requireItem(itemId, userId);
    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { title: dto.title, completed: dto.completed },
    });
  }

  async removeItem(itemId: string, userId: string) {
    await this.requireItem(itemId, userId);
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
  }

  private async requireChecklist(checklistId: string, userId: string) {
    const checklist = await this.prisma.checklist.findUnique({
      where: { id: checklistId },
      select: { card: { select: { list: { select: { boardId: true } } } } },
    });
    if (!checklist) throw new NotFoundException(CHECKLIST_NOT_FOUND);
    await this.access.require(checklist.card.list.boardId, userId, BoardRole.MEMBER, CHECKLIST_NOT_FOUND);
  }

  private async requireItem(itemId: string, userId: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { checklist: { select: { card: { select: { list: { select: { boardId: true } } } } } } },
    });
    if (!item) throw new NotFoundException(CHECKLIST_ITEM_NOT_FOUND);
    await this.access.require(item.checklist.card.list.boardId, userId, BoardRole.MEMBER, CHECKLIST_ITEM_NOT_FOUND);
  }
}

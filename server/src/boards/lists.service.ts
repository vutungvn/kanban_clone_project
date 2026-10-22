import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { POSITION_GAP } from './boards.constants';
import { COPY_ALL, copyCard, copySourceInclude } from './card-copy';
import { byPosition, listInclude, notArchived, toList } from './card-shape';
import type { CopyListDto, CreateListDto, MoveListDto, UpdateListDto } from './dto/list.dto';
import { placeAt } from './position';

export const LIST_NOT_FOUND = 'Không tìm thấy danh sách';

@Injectable()
export class ListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
    private readonly activities: ActivitiesService,
  ) {}

  /** Thêm danh sách vào cuối bảng. */
  async create(boardId: string, userId: string, dto: CreateListDto) {
    await this.access.require(boardId, userId, BoardRole.MEMBER);
    const { _max } = await this.prisma.list.aggregate({ where: { boardId }, _max: { position: true } });
    const list = await this.prisma.list.create({
      data: { boardId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
    });
    this.realtime.boardChanged(boardId);
    return { ...list, cards: [] };
  }

  async update(listId: string, userId: string, dto: UpdateListDto) {
    const boardId = await this.requireEditable(listId, userId);
    const list = await this.prisma.list.update({ where: { id: listId }, data: { title: dto.title }, include: listInclude });
    this.realtime.boardChanged(boardId);
    return toList(list);
  }

  /** Kéo thả: chuyển danh sách tới vị trí `index` trong bảng. */
  async move(listId: string, userId: string, dto: MoveListDto) {
    const boardId = await this.requireEditable(listId, userId);
    const list = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.list.findMany({
        where: { boardId, NOT: { id: listId }, ...notArchived },
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
    this.realtime.boardChanged(boardId);
    return list;
  }

  /** Lưu trữ / khôi phục danh sách (cùng mọi thẻ bên trong). Giữ nguyên vị trí nên khôi phục là về chỗ cũ. */
  async setArchived(listId: string, userId: string, archived: boolean) {
    const boardId = await this.requireEditable(listId, userId);
    const list = await this.prisma.list.update({
      where: { id: listId },
      data: { archivedAt: archived ? new Date() : null },
      include: listInclude,
    });
    this.realtime.boardChanged(boardId);
    return toList(list);
  }

  /** Lưu trữ mọi thẻ đang hiện trong danh sách (danh sách vẫn giữ). */
  async archiveCards(listId: string, userId: string) {
    const boardId = await this.requireEditable(listId, userId);
    const count = await this.prisma.$transaction(async (tx) => {
      const cards = await tx.card.findMany({ where: { listId, ...notArchived }, select: { id: true, list: { select: { title: true } } } });
      if (!cards.length) return 0;
      await tx.card.updateMany({ where: { id: { in: cards.map((c) => c.id) } }, data: { archivedAt: new Date() } });
      await this.activities.logMany(
        tx,
        cards.map((c) => ({ boardId, cardId: c.id, userId, type: ActivityType.CARD_ARCHIVED, data: { listTitle: c.list.title } })),
      );
      return cards.length;
    });
    if (count) this.realtime.boardChanged(boardId);
    return { count };
  }

  /** Sao chép danh sách (đặt ngay bên phải) kèm mọi thẻ đang hiện — giữ nhãn, thành viên, checklist, ngày. */
  async copy(listId: string, userId: string, dto: CopyListDto) {
    const boardId = await this.requireEditable(listId, userId);
    const list = await this.prisma.$transaction(
      async (tx) => {
        const siblings = await tx.list.findMany({ where: { boardId, ...notArchived }, orderBy: byPosition, select: { id: true, position: true } });
        const index = siblings.findIndex((l) => l.id === listId);
        if (index < 0) throw new NotFoundException(LIST_NOT_FOUND); // danh sách gốc đã bị lưu trữ
        const placeholder = 'new-list';
        const { position, rebalanced } = placeAt(siblings, index + 1, placeholder);
        for (const item of rebalanced ?? []) {
          if (item.id !== placeholder) await tx.list.update({ where: { id: item.id }, data: { position: item.position } });
        }
        const copy = await tx.list.create({ data: { boardId, title: dto.title, position } });

        const cards = await tx.card.findMany({ where: { listId, ...notArchived }, orderBy: byPosition, include: copySourceInclude });
        for (const source of cards) {
          const card = await copyCard(tx, source, { listId: copy.id, position: source.position, title: source.title, keep: COPY_ALL });
          await this.activities.log(tx, {
            boardId,
            cardId: card.id,
            userId,
            type: ActivityType.CARD_COPIED,
            data: { sourceTitle: source.title, listTitle: dto.title },
          });
        }
        return toList(await tx.list.findUniqueOrThrow({ where: { id: copy.id }, include: listInclude }));
      },
      // Danh sách nhiều thẻ → nhiều câu lệnh; nới thời gian chờ mặc định (5s)
      { timeout: 30_000 },
    );
    this.realtime.boardChanged(boardId);
    return list;
  }

  /** Xoá danh sách và toàn bộ thẻ bên trong. */
  async remove(listId: string, userId: string) {
    const boardId = await this.requireEditable(listId, userId);
    await this.prisma.list.delete({ where: { id: listId } });
    this.realtime.boardChanged(boardId);
  }

  /** Kiểm tra quyền sửa danh sách, trả về boardId. */
  private async requireEditable(listId: string, userId: string) {
    const list = await this.prisma.list.findUnique({ where: { id: listId }, select: { boardId: true } });
    if (!list) throw new NotFoundException(LIST_NOT_FOUND);
    await this.access.require(list.boardId, userId, BoardRole.MEMBER, LIST_NOT_FOUND);
    return list.boardId;
  }
}

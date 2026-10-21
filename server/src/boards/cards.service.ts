import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole, NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { CARD_NOT_FOUND, POSITION_GAP } from './boards.constants';
import { byPosition, cardInclude, toCard } from './card-shape';
import type { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';
import { LIST_NOT_FOUND } from './lists.service';
import { placeAt } from './position';

export { CARD_NOT_FOUND };
export const LABEL_NOT_FOUND = 'Không tìm thấy nhãn';
export const NOT_BOARD_MEMBER = 'Người này không phải thành viên của bảng';
export const START_AFTER_DUE = 'Ngày bắt đầu phải trước hoặc bằng hạn chót';
export const NO_DUE_DATE = 'Thẻ chưa có hạn chót';

/** Vi phạm khoá ngoại — thẻ / nhãn vừa bị xoá giữa chừng. */
const isForeignKeyError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';

/** undefined = không đổi, null = xoá. */
const toDate = (value: string | null | undefined, current: Date | null) =>
  value === undefined ? current : value === null ? null : new Date(value);

const sameDate = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly activities: ActivitiesService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Báo cho những người đang được giao thẻ (trừ người thao tác). */
  private async notifyAssignees(cardId: string, actorId: string, type: NotificationType, data: Prisma.InputJsonObject = {}) {
    const ctx = await this.notifications.cardContext(cardId);
    if (!ctx) return;
    await this.notifications.notify(
      ctx.assigneeIds.map((userId) => ({ userId, actorId, type, boardId: ctx.boardId, cardId, data: { ...ctx.data, ...data } })),
    );
  }

  /** Thêm thẻ vào cuối danh sách. */
  async create(listId: string, userId: string, dto: CreateCardDto) {
    const list = await this.prisma.list.findUnique({ where: { id: listId }, select: { boardId: true, title: true } });
    if (!list) throw new NotFoundException(LIST_NOT_FOUND);
    await this.access.require(list.boardId, userId, BoardRole.MEMBER, LIST_NOT_FOUND);

    const { _max } = await this.prisma.card.aggregate({ where: { listId }, _max: { position: true } });
    const card = await this.prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: { listId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
        include: cardInclude,
      });
      await this.activities.log(tx, {
        boardId: list.boardId,
        cardId: card.id,
        userId,
        type: ActivityType.CARD_CREATED,
        data: { listTitle: list.title },
      });
      return toCard(card);
    });
    this.realtime.boardChanged(list.boardId, card.id);
    return card;
  }

  /**
   * Sửa tiêu đề, mô tả, ngày. Ngày bắt đầu phải <= hạn chót (so cả với giá trị đang lưu).
   * Ghi lịch sử khi đổi tên, đổi ngày, đánh dấu hoàn thành (không ghi khi sửa mô tả).
   */
  async update(cardId: string, userId: string, dto: UpdateCardDto) {
    const current = await this.requireEditable(cardId, userId);
    const startDate = toDate(dto.startDate, current.startDate);
    const dueDate = toDate(dto.dueDate, current.dueDate);
    if (startDate && dueDate && startDate > dueDate) throw new BadRequestException(START_AFTER_DUE);
    if (dto.dueComplete && !dueDate) throw new BadRequestException(NO_DUE_DATE);

    const base = { boardId: current.boardId, cardId, userId };
    const card = await this.prisma.$transaction(async (tx) => {
      const card = await tx.card.update({
        where: { id: cardId },
        data: {
          title: dto.title,
          description: dto.description,
          startDate: dto.startDate === undefined ? undefined : startDate,
          dueDate: dto.dueDate === undefined ? undefined : dueDate,
          // Xoá hạn chót → bỏ luôn trạng thái hoàn thành
          dueComplete: dueDate ? dto.dueComplete : false,
        },
        include: cardInclude,
      });

      if (dto.title !== undefined && dto.title !== current.title) {
        await this.activities.log(tx, { ...base, type: ActivityType.CARD_RENAMED, data: { from: current.title, to: dto.title } });
      }
      if (!sameDate(startDate, current.startDate) || !sameDate(dueDate, current.dueDate)) {
        await this.activities.log(tx, {
          ...base,
          type: ActivityType.DATES_CHANGED,
          data: { startDate: startDate?.toISOString() ?? null, dueDate: dueDate?.toISOString() ?? null },
        });
      }
      if (dto.dueComplete !== undefined && dueDate && dto.dueComplete !== current.dueComplete) {
        await this.activities.log(tx, { ...base, type: ActivityType.DUE_COMPLETE_CHANGED, data: { complete: dto.dueComplete } });
      }
      return toCard(card);
    });
    this.realtime.boardChanged(current.boardId, cardId);
    if (!sameDate(dueDate, current.dueDate)) {
      await this.notifyAssignees(cardId, userId, NotificationType.CARD_DUE_CHANGED, { dueDate: dueDate?.toISOString() ?? null });
    }
    return card;
  }

  /** Kéo thả: chuyển thẻ tới vị trí `index` của danh sách `listId` (cùng bảng). Sang danh sách khác thì ghi lịch sử. */
  async move(cardId: string, userId: string, dto: MoveCardDto) {
    const current = await this.requireEditable(cardId, userId);
    const target = await this.prisma.list.findUnique({ where: { id: dto.listId }, select: { boardId: true, title: true } });
    // Chỉ cho chuyển trong cùng bảng; list của bảng khác coi như không tồn tại
    if (!target || target.boardId !== current.boardId) throw new NotFoundException(LIST_NOT_FOUND);

    const card = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.card.findMany({
        where: { listId: dto.listId, NOT: { id: cardId } },
        orderBy: byPosition,
        select: { id: true, position: true },
      });
      const { position, rebalanced } = placeAt(siblings, dto.index, cardId);
      if (rebalanced) {
        for (const item of rebalanced) {
          await tx.card.update({ where: { id: item.id }, data: { position: item.position } });
        }
      }
      const card = await tx.card.update({
        where: { id: cardId },
        data: { listId: dto.listId, position },
        include: cardInclude,
      });
      if (current.listId !== dto.listId) {
        await this.activities.log(tx, {
          boardId: current.boardId,
          cardId,
          userId,
          type: ActivityType.CARD_MOVED,
          data: { fromList: current.listTitle, toList: target.title },
        });
      }
      return toCard(card);
    });
    this.realtime.boardChanged(current.boardId, cardId);
    if (current.listId !== dto.listId) {
      await this.notifyAssignees(cardId, userId, NotificationType.CARD_MOVED, {
        fromList: current.listTitle,
        toList: target.title,
      });
    }
    return card;
  }

  async remove(cardId: string, userId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    await this.prisma.card.delete({ where: { id: cardId } });
    this.realtime.boardChanged(boardId, cardId);
  }

  /** Gắn nhãn (của cùng bảng) vào thẻ. Đã gắn rồi thì bỏ qua. */
  async addLabel(cardId: string, userId: string, labelId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    const label = await this.prisma.label.findUnique({ where: { id: labelId }, select: { boardId: true, name: true, color: true } });
    if (!label || label.boardId !== boardId) throw new NotFoundException(LABEL_NOT_FOUND);
    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.cardLabel.createMany({ data: { cardId, labelId }, skipDuplicates: true });
        if (count) {
          await this.activities.log(tx, {
            boardId,
            cardId,
            userId,
            type: ActivityType.LABEL_ADDED,
            data: { name: label.name, color: label.color },
          });
        }
      });
    } catch (e) {
      if (isForeignKeyError(e)) throw new NotFoundException(LABEL_NOT_FOUND);
      throw e;
    }
    this.realtime.boardChanged(boardId, cardId);
  }

  /** Gỡ nhãn khỏi thẻ. Chưa gắn thì bỏ qua. */
  async removeLabel(cardId: string, userId: string, labelId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    await this.prisma.$transaction(async (tx) => {
      const link = await tx.cardLabel.findUnique({
        where: { cardId_labelId: { cardId, labelId } },
        select: { label: { select: { name: true, color: true } } },
      });
      // deleteMany: 2 request gỡ cùng lúc thì request sau xoá 0 dòng thay vì lỗi
      const { count } = await tx.cardLabel.deleteMany({ where: { cardId, labelId } });
      if (!link || !count) return;
      await this.activities.log(tx, {
        boardId,
        cardId,
        userId,
        type: ActivityType.LABEL_REMOVED,
        data: { name: link.label.name, color: link.label.color },
      });
    });
    this.realtime.boardChanged(boardId, cardId);
  }

  /**
   * Giao thẻ cho 1 thành viên của bảng. Đã giao rồi thì bỏ qua.
   * Chạy trong khoá bảng để không chen giữa lúc người đó bị xoá khỏi bảng (xoá thành viên cũng gỡ khỏi mọi thẻ).
   */
  async addMember(cardId: string, actorId: string, memberId: string) {
    const { boardId } = await this.requireEditable(cardId, actorId);
    const added = await this.access.withLock(boardId, actorId, BoardRole.MEMBER, async (tx) => {
      const member = await tx.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: memberId } },
        select: { user: { select: { name: true } } },
      });
      if (!member) throw new NotFoundException(NOT_BOARD_MEMBER);
      try {
        const { count } = await tx.cardMember.createMany({ data: { cardId, userId: memberId }, skipDuplicates: true });
        if (count) {
          await this.activities.log(tx, {
            boardId,
            cardId,
            userId: actorId,
            type: ActivityType.MEMBER_ADDED,
            data: { userId: memberId, name: member.user.name },
          });
        }
        return count > 0;
      } catch (e) {
        if (isForeignKeyError(e)) throw new NotFoundException(CARD_NOT_FOUND);
        throw e;
      }
    });
    this.realtime.boardChanged(boardId, cardId);
    if (added) await this.notifyOne(cardId, actorId, memberId, NotificationType.CARD_ASSIGNED);
  }

  /** Báo cho 1 người về thẻ (vd vừa được giao / bị gỡ). */
  private async notifyOne(cardId: string, actorId: string, userId: string, type: NotificationType) {
    const ctx = await this.notifications.cardContext(cardId);
    if (ctx) await this.notifications.notify([{ userId, actorId, type, boardId: ctx.boardId, cardId, data: ctx.data }]);
  }

  /** Bỏ giao thẻ. Chưa được giao thì bỏ qua. */
  async removeMember(cardId: string, actorId: string, memberId: string) {
    const { boardId } = await this.requireEditable(cardId, actorId);
    const removed = await this.prisma.$transaction(async (tx) => {
      const link = await tx.cardMember.findUnique({
        where: { cardId_userId: { cardId, userId: memberId } },
        select: { user: { select: { name: true } } },
      });
      const { count } = await tx.cardMember.deleteMany({ where: { cardId, userId: memberId } });
      if (!link || !count) return false;
      await this.activities.log(tx, {
        boardId,
        cardId,
        userId: actorId,
        type: ActivityType.MEMBER_REMOVED,
        data: { userId: memberId, name: link.user.name },
      });
      return true;
    });
    this.realtime.boardChanged(boardId, cardId);
    if (removed) await this.notifyOne(cardId, actorId, memberId, NotificationType.CARD_UNASSIGNED);
  }

  /** Kiểm tra quyền sửa thẻ, trả về bảng / danh sách chứa thẻ + các giá trị cần so khi ghi lịch sử. */
  private async requireEditable(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        title: true,
        startDate: true,
        dueDate: true,
        dueComplete: true,
        listId: true,
        list: { select: { boardId: true, title: true } },
      },
    });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);
    const { list, ...rest } = card;
    return { ...rest, boardId: list.boardId, listTitle: list.title };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BoardAccessService } from './board-access.service';
import { POSITION_GAP } from './boards.constants';
import { byPosition, cardInclude, toCard } from './card-shape';
import type { CreateCardDto, MoveCardDto, UpdateCardDto } from './dto/card.dto';
import { LIST_NOT_FOUND } from './lists.service';
import { placeAt } from './position';

export const CARD_NOT_FOUND = 'Không tìm thấy thẻ';
export const LABEL_NOT_FOUND = 'Không tìm thấy nhãn';
export const NOT_BOARD_MEMBER = 'Người này không phải thành viên của bảng';
export const START_AFTER_DUE = 'Ngày bắt đầu phải trước hoặc bằng hạn chót';
export const NO_DUE_DATE = 'Thẻ chưa có hạn chót';

/** Vi phạm khoá ngoại — thẻ / nhãn vừa bị xoá giữa chừng. */
const isForeignKeyError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';

/** undefined = không đổi, null = xoá. */
const toDate = (value: string | null | undefined, current: Date | null) =>
  value === undefined ? current : value === null ? null : new Date(value);

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
    const card = await this.prisma.card.create({
      data: { listId, title: dto.title, position: (_max.position ?? 0) + POSITION_GAP },
      include: cardInclude,
    });
    return toCard(card);
  }

  /** Sửa tiêu đề, mô tả, ngày. Ngày bắt đầu phải <= hạn chót (so cả với giá trị đang lưu). */
  async update(cardId: string, userId: string, dto: UpdateCardDto) {
    const current = await this.requireEditable(cardId, userId);
    const startDate = toDate(dto.startDate, current.startDate);
    const dueDate = toDate(dto.dueDate, current.dueDate);
    if (startDate && dueDate && startDate > dueDate) throw new BadRequestException(START_AFTER_DUE);
    if (dto.dueComplete && !dueDate) throw new BadRequestException(NO_DUE_DATE);

    const card = await this.prisma.card.update({
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
    return toCard(card);
  }

  /** Kéo thả: chuyển thẻ tới vị trí `index` của danh sách `listId` (cùng bảng). */
  async move(cardId: string, userId: string, dto: MoveCardDto) {
    const { boardId } = await this.requireEditable(cardId, userId);
    const target = await this.prisma.list.findUnique({ where: { id: dto.listId }, select: { boardId: true } });
    // Chỉ cho chuyển trong cùng bảng; list của bảng khác coi như không tồn tại
    if (!target || target.boardId !== boardId) throw new NotFoundException(LIST_NOT_FOUND);

    return this.prisma.$transaction(async (tx) => {
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
      return toCard(card);
    });
  }

  async remove(cardId: string, userId: string) {
    await this.requireEditable(cardId, userId);
    await this.prisma.card.delete({ where: { id: cardId } });
  }

  /** Gắn nhãn (của cùng bảng) vào thẻ. Đã gắn rồi thì bỏ qua. */
  async addLabel(cardId: string, userId: string, labelId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    const label = await this.prisma.label.findUnique({ where: { id: labelId }, select: { boardId: true } });
    if (!label || label.boardId !== boardId) throw new NotFoundException(LABEL_NOT_FOUND);
    try {
      await this.prisma.cardLabel.createMany({ data: { cardId, labelId }, skipDuplicates: true });
    } catch (e) {
      if (isForeignKeyError(e)) throw new NotFoundException(LABEL_NOT_FOUND);
      throw e;
    }
  }

  /** Gỡ nhãn khỏi thẻ. Chưa gắn thì bỏ qua. */
  async removeLabel(cardId: string, userId: string, labelId: string) {
    await this.requireEditable(cardId, userId);
    await this.prisma.cardLabel.deleteMany({ where: { cardId, labelId } });
  }

  /**
   * Giao thẻ cho 1 thành viên của bảng. Đã giao rồi thì bỏ qua.
   * Chạy trong khoá bảng để không chen giữa lúc người đó bị xoá khỏi bảng (xoá thành viên cũng gỡ khỏi mọi thẻ).
   */
  async addMember(cardId: string, actorId: string, memberId: string) {
    const { boardId } = await this.requireEditable(cardId, actorId);
    await this.access.withLock(boardId, actorId, BoardRole.MEMBER, async (tx) => {
      const member = await tx.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberId } } });
      if (!member) throw new NotFoundException(NOT_BOARD_MEMBER);
      try {
        await tx.cardMember.createMany({ data: { cardId, userId: memberId }, skipDuplicates: true });
      } catch (e) {
        if (isForeignKeyError(e)) throw new NotFoundException(CARD_NOT_FOUND);
        throw e;
      }
    });
  }

  /** Bỏ giao thẻ. Chưa được giao thì bỏ qua. */
  async removeMember(cardId: string, actorId: string, memberId: string) {
    await this.requireEditable(cardId, actorId);
    await this.prisma.cardMember.deleteMany({ where: { cardId, userId: memberId } });
  }

  /** Kiểm tra quyền sửa thẻ, trả về bảng chứa thẻ + ngày hiện tại. */
  private async requireEditable(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { startDate: true, dueDate: true, list: { select: { boardId: true } } },
    });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);
    return { boardId: card.list.boardId, startDate: card.startDate, dueDate: card.dueDate };
  }
}

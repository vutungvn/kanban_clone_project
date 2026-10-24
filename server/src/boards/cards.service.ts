import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole, NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { isImageType } from '../storage/files';
import { StorageService } from '../storage/storage.service';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { CARD_NOT_FOUND, POSITION_GAP } from './boards.constants';
import { boardMemberIds, mapLabelsToBoard, rehomeCards } from './board-transfer';
import { copyCard, copySourceInclude } from './card-copy';
import { byPosition, cardInclude, notArchived, toCard } from './card-shape';
import type { CopyCardDto, CreateCardDto, MoveCardDto, SetCoverDto, UpdateCardDto } from './dto/card.dto';
import { LIST_NOT_FOUND } from './lists.service';
import { placeAt } from './position';

export { CARD_NOT_FOUND };
export const LABEL_NOT_FOUND = 'Không tìm thấy nhãn';
export const NOT_BOARD_MEMBER = 'Người này không phải thành viên của bảng';
export const START_AFTER_DUE = 'Ngày bắt đầu phải trước hoặc bằng hạn chót';
export const NO_DUE_DATE = 'Thẻ chưa có hạn chót';
export const ATTACHMENT_NOT_FOUND = 'Không tìm thấy tệp đính kèm';
export const COVER_REQUIRED = 'Vui lòng chọn 1 màu hoặc 1 ảnh làm ảnh bìa';
export const COVER_NOT_IMAGE = 'Chỉ dùng được ảnh JPG, PNG, GIF, WEBP làm ảnh bìa';

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
    private readonly storage: StorageService,
  ) {}

  /** Báo cho những người đang được giao thẻ (trừ người thao tác). */
  private async notifyAssignees(cardId: string, actorId: string, type: NotificationType, data: Prisma.InputJsonObject = {}) {
    const ctx = await this.notifications.cardContext(cardId);
    if (!ctx || ctx.archived) return;
    await this.notifications.notify(
      ctx.assigneeIds.map((userId) => ({ userId, actorId, type, boardId: ctx.boardId, cardId, data: { ...ctx.data, ...data } })),
    );
  }

  /** Thêm thẻ vào cuối danh sách. */
  async create(listId: string, userId: string, dto: CreateCardDto) {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: { boardId: true, title: true, archivedAt: true },
    });
    if (!list || list.archivedAt) throw new NotFoundException(LIST_NOT_FOUND);
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
    const target = await this.requireTargetList(dto.listId, current.boardId, userId);
    const crossBoard = target.boardId !== current.boardId;

    const card = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.card.findMany({
        where: { listId: dto.listId, NOT: { id: cardId }, ...notArchived },
        orderBy: byPosition,
        select: { id: true, position: true },
      });
      const { position, rebalanced } = placeAt(siblings, dto.index, cardId);
      if (rebalanced) {
        for (const item of rebalanced) {
          await tx.card.update({ where: { id: item.id }, data: { position: item.position } });
        }
      }
      await tx.card.update({ where: { id: cardId }, data: { listId: dto.listId, position } });
      if (crossBoard) {
        // Nhãn, người được giao, lịch sử, thông báo → theo bảng đích
        await rehomeCards(tx, [cardId], target.boardId);
        await this.activities.log(tx, {
          boardId: target.boardId,
          cardId,
          userId,
          type: ActivityType.CARD_TRANSFERRED,
          data: { fromBoard: current.boardTitle, toBoard: target.boardTitle, fromList: current.listTitle, toList: target.title },
        });
      } else if (current.listId !== dto.listId) {
        await this.activities.log(tx, {
          boardId: current.boardId,
          cardId,
          userId,
          type: ActivityType.CARD_MOVED,
          data: { fromList: current.listTitle, toList: target.title },
        });
      }
      return toCard(await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude }));
    });
    this.realtime.boardChanged(current.boardId, cardId);
    if (crossBoard) this.realtime.boardChanged(target.boardId, cardId);
    if (current.listId !== dto.listId) {
      await this.notifyAssignees(cardId, userId, NotificationType.CARD_MOVED, {
        fromList: current.listTitle,
        toList: target.title,
        ...(crossBoard && { fromBoard: current.boardTitle }),
      });
    }
    return card;
  }

  /** Chi tiết 1 thẻ (kể cả đã lưu trữ) — mở thẻ qua link khi thẻ không có trên bảng. Mọi vai trò. */
  async findOne(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      include: { ...cardInclude, list: { select: { boardId: true, title: true, archivedAt: true } } },
    });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.VIEWER, CARD_NOT_FOUND);
    const { list, ...rest } = card;
    return { ...toCard(rest), boardId: list.boardId, listTitle: list.title, listArchived: !!list.archivedAt };
  }

  /** Lưu trữ / khôi phục thẻ. Thẻ giữ nguyên vị trí nên khôi phục là về đúng chỗ cũ. */
  async setArchived(cardId: string, userId: string, archived: boolean) {
    const current = await this.requireEditable(cardId, userId);
    if (!!current.archivedAt === archived) return this.findOne(cardId, userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.card.update({ where: { id: cardId }, data: { archivedAt: archived ? new Date() : null } });
      await this.activities.log(tx, {
        boardId: current.boardId,
        cardId,
        userId,
        type: archived ? ActivityType.CARD_ARCHIVED : ActivityType.CARD_RESTORED,
        data: { listTitle: current.listTitle },
      });
    });
    this.realtime.boardChanged(current.boardId, cardId);
    return this.findOne(cardId, userId);
  }

  /**
   * Sao chép thẻ sang vị trí `index` của danh sách `listId` (cùng bảng). Mô tả luôn được giữ;
   * nhãn / thành viên / checklist / ngày tuỳ chọn; bình luận và lịch sử thì không.
   */
  async copy(cardId: string, userId: string, dto: CopyCardDto) {
    const current = await this.requireEditable(cardId, userId);
    const target = await this.requireTargetList(dto.listId, current.boardId, userId);
    const crossBoard = target.boardId !== current.boardId;
    const source = await this.prisma.card.findUniqueOrThrow({ where: { id: cardId }, include: copySourceInclude });

    const card = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.card.findMany({
        where: { listId: dto.listId, ...notArchived },
        orderBy: byPosition,
        select: { id: true, position: true },
      });
      const placeholder = 'new-card';
      const { position, rebalanced } = placeAt(siblings, dto.index, placeholder);
      for (const item of rebalanced ?? []) {
        if (item.id !== placeholder) await tx.card.update({ where: { id: item.id }, data: { position: item.position } });
      }
      const card = await copyCard(tx, source, {
        listId: dto.listId,
        position,
        title: dto.title,
        keep: {
          labels: dto.keepLabels,
          members: dto.keepMembers,
          checklists: dto.keepChecklists,
          dates: dto.keepDates,
          attachments: dto.keepAttachments,
        },
        // Sang bảng khác: nhãn ghép theo tên + màu, chỉ giữ người được giao là thành viên bảng đích
        ...(crossBoard && {
          labelMap: await mapLabelsToBoard(tx, dto.keepLabels ? source.labels.map((l) => l.label) : [], target.boardId),
          memberIds: await boardMemberIds(tx, target.boardId),
        }),
      });
      await this.activities.log(tx, {
        boardId: target.boardId,
        cardId: card.id,
        userId,
        type: ActivityType.CARD_COPIED,
        data: { sourceTitle: current.title, listTitle: target.title, ...(crossBoard && { fromBoard: current.boardTitle }) },
      });
      return toCard(card);
    });
    this.realtime.boardChanged(target.boardId, card.id);
    return card;
  }

  async remove(cardId: string, userId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    const files = await this.storage.keysOf({ cardId });
    await this.prisma.card.delete({ where: { id: cardId } });
    this.realtime.boardChanged(boardId, cardId);
    void this.storage.discard(files);
  }

  /** Đặt ảnh bìa: 1 màu hoặc 1 ảnh đính kèm của chính thẻ (thay cho ảnh bìa cũ). */
  async setCover(cardId: string, userId: string, dto: SetCoverDto) {
    if (!dto.color === !dto.attachmentId) throw new BadRequestException(COVER_REQUIRED);
    const { boardId } = await this.requireEditable(cardId, userId);
    if (dto.attachmentId) {
      const file = await this.prisma.attachment.findUnique({ where: { id: dto.attachmentId }, select: { cardId: true, mimeType: true } });
      if (!file || file.cardId !== cardId) throw new NotFoundException(ATTACHMENT_NOT_FOUND);
      if (!isImageType(file.mimeType)) throw new BadRequestException(COVER_NOT_IMAGE);
    }
    try {
      await this.prisma.card.update({
        where: { id: cardId },
        data: { coverColor: dto.color ?? null, coverAttachmentId: dto.attachmentId ?? null },
      });
    } catch (e) {
      if (isForeignKeyError(e)) throw new NotFoundException(ATTACHMENT_NOT_FOUND); // ảnh vừa bị xoá
      throw e;
    }
    this.realtime.boardChanged(boardId, cardId);
  }

  async removeCover(cardId: string, userId: string) {
    const { boardId } = await this.requireEditable(cardId, userId);
    await this.prisma.card.update({ where: { id: cardId }, data: { coverColor: null, coverAttachmentId: null } });
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

  /**
   * Danh sách đích khi di chuyển / sao chép: chưa lưu trữ. Ở bảng khác thì người thao tác phải là MEMBER trở lên
   * ở bảng đó (không phải thành viên → 404 như thể không tồn tại; chỉ được xem → 403).
   */
  private async requireTargetList(listId: string, sourceBoardId: string, userId: string) {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: { boardId: true, title: true, archivedAt: true, board: { select: { title: true } } },
    });
    if (!list || list.archivedAt) throw new NotFoundException(LIST_NOT_FOUND);
    if (list.boardId !== sourceBoardId) await this.access.require(list.boardId, userId, BoardRole.MEMBER, LIST_NOT_FOUND);
    return { boardId: list.boardId, title: list.title, boardTitle: list.board.title };
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
        archivedAt: true,
        listId: true,
        list: { select: { boardId: true, title: true, board: { select: { title: true } } } },
      },
    });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);
    const { list, ...rest } = card;
    return { ...rest, boardId: list.boardId, listTitle: list.title, boardTitle: list.board.title };
  }
}

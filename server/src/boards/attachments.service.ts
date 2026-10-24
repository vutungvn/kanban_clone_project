import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { fileNameOf, isImageType, type UploadedFileData } from '../storage/files';
import { StorageService } from '../storage/storage.service';
import { ActivitiesService } from './activities.service';
import { BoardAccessService } from './board-access.service';
import { CARD_NOT_FOUND } from './boards.constants';
import { cardInclude, toAttachment, toCard } from './card-shape';
import { ATTACHMENT_NOT_FOUND } from './cards.service';

export { ATTACHMENT_NOT_FOUND };
export const FILE_REQUIRED = 'Vui lòng chọn tệp';

const isForeignKeyError = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';

/**
 * Tệp đính kèm của thẻ. Mọi thao tác cần vai trò MEMBER trở lên.
 * Ghi lịch sử khi đính kèm / xoá tệp (đổi tên thì không).
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly activities: ActivitiesService,
    private readonly realtime: RealtimeService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Tải tệp lên nơi lưu rồi ghi vào thẻ. Ảnh (JPG / PNG / GIF / WEBP) mà thẻ chưa có ảnh bìa → tự làm ảnh bìa.
   * Ghi DB lỗi (vd thẻ vừa bị xoá) → xoá tệp vừa tải lên.
   */
  async upload(cardId: string, userId: string, file: UploadedFileData | undefined) {
    if (!file?.size) throw new BadRequestException(FILE_REQUIRED);
    const boardId = await this.requireCard(cardId, userId);
    const name = fileNameOf(file);
    const mimeType = file.mimetype || 'application/octet-stream';
    const stored = await this.storage.upload({ buffer: file.buffer, mimeType, name });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({ data: { cardId, name, mimeType, size: file.size, ...stored } });
        if (isImageType(mimeType)) {
          await tx.card.updateMany({
            where: { id: cardId, coverColor: null, coverAttachmentId: null },
            data: { coverAttachmentId: attachment.id },
          });
        }
        await this.activities.log(tx, {
          boardId,
          cardId,
          userId,
          type: ActivityType.ATTACHMENT_ADDED,
          data: { attachmentId: attachment.id, name },
        });
        const card = await tx.card.findUniqueOrThrow({ where: { id: cardId }, include: cardInclude });
        return { attachment: toAttachment(attachment), card: toCard(card) };
      });
      this.realtime.boardChanged(boardId, cardId);
      return result;
    } catch (e) {
      void this.storage.discard([stored.storageKey]);
      if (isForeignKeyError(e)) throw new NotFoundException(CARD_NOT_FOUND);
      throw e;
    }
  }

  async rename(id: string, userId: string, name: string) {
    const { boardId, cardId } = await this.requireAttachment(id, userId);
    const attachment = await this.prisma.attachment.update({ where: { id }, data: { name } });
    this.realtime.boardChanged(boardId, cardId);
    return toAttachment(attachment);
  }

  /** Xoá khỏi thẻ (đang là ảnh bìa thì thẻ hết ảnh bìa). Tệp thật chỉ bị xoá khi không còn thẻ nào dùng. */
  async remove(id: string, userId: string) {
    const file = await this.requireAttachment(id, userId);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attachment.deleteMany({ where: { id } });
      if (!count) return;
      await this.activities.log(tx, {
        boardId: file.boardId,
        cardId: file.cardId,
        userId,
        type: ActivityType.ATTACHMENT_REMOVED,
        data: { name: file.name },
      });
    });
    this.realtime.boardChanged(file.boardId, file.cardId);
    void this.storage.discard([file.storageKey]);
  }

  private async requireCard(cardId: string, userId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, select: { list: { select: { boardId: true } } } });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, BoardRole.MEMBER, CARD_NOT_FOUND);
    return card.list.boardId;
  }

  private async requireAttachment(id: string, userId: string) {
    const file = await this.prisma.attachment.findUnique({
      where: { id },
      select: { cardId: true, name: true, storageKey: true, card: { select: { list: { select: { boardId: true } } } } },
    });
    if (!file) throw new NotFoundException(ATTACHMENT_NOT_FOUND);
    const boardId = file.card.list.boardId;
    await this.access.require(boardId, userId, BoardRole.MEMBER, ATTACHMENT_NOT_FOUND);
    return { boardId, cardId: file.cardId, name: file.name, storageKey: file.storageKey };
  }
}

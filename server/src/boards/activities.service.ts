import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole, NotificationType, Prisma } from '@prisma/client';
import { excerpt, NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { markActivity } from '../realtime/request-context';
import { RealtimeService } from '../realtime/realtime.service';
import { BoardAccessService } from './board-access.service';
import { CARD_NOT_FOUND } from './boards.constants';
import type { ListActivitiesQueryDto } from './dto/activity.dto';
import { findMentions } from './mentions';

export const COMMENT_NOT_FOUND = 'Không tìm thấy bình luận';
export const NOT_COMMENT_AUTHOR = 'Bạn chỉ sửa được bình luận của mình';
export const CANNOT_DELETE_COMMENT = 'Chỉ người viết hoặc quản trị viên mới xoá được bình luận';

type Db = Prisma.TransactionClient | PrismaService;

export interface ActivityInput {
  boardId: string;
  cardId: string;
  userId: string;
  type: Exclude<ActivityType, 'COMMENT'>;
  data: Prisma.InputJsonObject;
}

const activityInclude = { user: { select: { id: true, name: true, avatarUrl: true } } } as const satisfies Prisma.ActivityInclude;

type ActivityWithUser = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

const toActivity = ({ boardId: _boardId, userId: _userId, ...activity }: ActivityWithUser) => activity;

/**
 * Lịch sử hoạt động của thẻ + bình luận (bình luận là hoạt động type COMMENT).
 * Các service khác gọi `log` (trong cùng transaction với thay đổi) để ghi lại thao tác.
 */
@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Thông báo cho bình luận: người được nhắc tên → COMMENT_MENTION; người được giao thẻ (chưa được nhắc)
   * → CARD_COMMENT. Khi sửa (`previousText`) chỉ báo cho người MỚI được nhắc tên.
   */
  private async notifyComment(cardId: string, actorId: string, text: string, previousText?: string) {
    const ctx = await this.notifications.cardContext(cardId);
    if (!ctx || ctx.archived) return;
    const mentioned = findMentions(text, ctx.boardMembers);
    if (previousText !== undefined) {
      for (const id of findMentions(previousText, ctx.boardMembers)) mentioned.delete(id);
    }
    const data = { ...ctx.data, text: excerpt(text) };
    const base = { actorId, boardId: ctx.boardId, cardId, data };
    await this.notifications.notify([
      ...[...mentioned].map((userId) => ({ ...base, userId, type: NotificationType.COMMENT_MENTION })),
      ...(previousText === undefined
        ? ctx.assigneeIds.filter((id) => !mentioned.has(id)).map((userId) => ({ ...base, userId, type: NotificationType.CARD_COMMENT }))
        : []),
    ]);
  }

  log(db: Db, input: ActivityInput) {
    markActivity(input.boardId);
    return db.activity.create({ data: input });
  }

  logMany(db: Db, inputs: ActivityInput[]) {
    for (const input of inputs) markActivity(input.boardId);
    return db.activity.createMany({ data: inputs });
  }

  /** Mới nhất trước, phân trang theo cursor (id). Mọi thành viên của bảng đều xem được. */
  async list(cardId: string, userId: string, query: ListActivitiesQueryDto) {
    await this.requireCard(cardId, userId, BoardRole.VIEWER);
    const rows = await this.prisma.activity.findMany({
      where: { cardId, ...(query.filter === 'comments' && { type: ActivityType.COMMENT }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: activityInclude,
    });
    const page = rows.slice(0, query.limit);
    return {
      activities: page.map(toActivity),
      nextCursor: rows.length > query.limit ? page[page.length - 1].id : null,
    };
  }

  async addComment(cardId: string, userId: string, text: string) {
    const boardId = await this.requireCard(cardId, userId, BoardRole.MEMBER);
    const activity = await this.prisma.activity.create({
      data: { boardId, cardId, userId, type: ActivityType.COMMENT, text },
      include: activityInclude,
    });
    markActivity(boardId);
    this.realtime.boardChanged(boardId, cardId);
    await this.notifyComment(cardId, userId, text);
    return toActivity(activity);
  }

  /** Chỉ người viết sửa được (và vẫn phải có quyền MEMBER trong bảng). */
  async updateComment(id: string, userId: string, text: string) {
    const comment = await this.requireComment(id, userId, BoardRole.MEMBER);
    if (comment.userId !== userId) throw new ForbiddenException(NOT_COMMENT_AUTHOR);
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { text, editedAt: new Date() },
      include: activityInclude,
    });
    this.realtime.boardChanged(comment.boardId, comment.cardId);
    await this.notifyComment(comment.cardId, userId, text, comment.text ?? '');
    return toActivity(activity);
  }

  /** Người viết (MEMBER trở lên) hoặc ADMIN của bảng. */
  async removeComment(id: string, userId: string) {
    const comment = await this.requireComment(id, userId, BoardRole.MEMBER);
    if (comment.userId !== userId && comment.role !== BoardRole.ADMIN) throw new ForbiddenException(CANNOT_DELETE_COMMENT);
    await this.prisma.activity.delete({ where: { id } });
    this.realtime.boardChanged(comment.boardId, comment.cardId);
  }

  private async requireCard(cardId: string, userId: string, minRole: BoardRole) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId }, select: { list: { select: { boardId: true } } } });
    if (!card) throw new NotFoundException(CARD_NOT_FOUND);
    await this.access.require(card.list.boardId, userId, minRole, CARD_NOT_FOUND);
    return card.list.boardId;
  }

  /** Bình luận + vai trò của người đang thao tác trong bảng. */
  private async requireComment(id: string, userId: string, minRole: BoardRole) {
    const comment = await this.prisma.activity.findUnique({
      where: { id },
      select: { type: true, boardId: true, cardId: true, userId: true, text: true },
    });
    if (!comment || comment.type !== ActivityType.COMMENT) throw new NotFoundException(COMMENT_NOT_FOUND);
    const me = await this.access.require(comment.boardId, userId, minRole, COMMENT_NOT_FOUND);
    return { userId: comment.userId, boardId: comment.boardId, cardId: comment.cardId, text: comment.text, role: me.role };
  }
}

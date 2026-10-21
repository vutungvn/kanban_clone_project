import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, BoardRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BoardAccessService } from './board-access.service';
import { CARD_NOT_FOUND } from './boards.constants';
import type { ListActivitiesQueryDto } from './dto/activity.dto';

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
  ) {}

  log(db: Db, input: ActivityInput) {
    return db.activity.create({ data: input });
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
    this.realtime.boardChanged(boardId, cardId);
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
      select: { type: true, boardId: true, cardId: true, userId: true },
    });
    if (!comment || comment.type !== ActivityType.COMMENT) throw new NotFoundException(COMMENT_NOT_FOUND);
    const me = await this.access.require(comment.boardId, userId, minRole, COMMENT_NOT_FOUND);
    return { userId: comment.userId, boardId: comment.boardId, cardId: comment.cardId, role: me.role };
  }
}

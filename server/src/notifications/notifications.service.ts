import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import type { ListNotificationsQueryDto } from './dto/notification.dto';

export const NOTIFICATION_NOT_FOUND = 'Không tìm thấy thông báo';

/** Độ dài tối đa của trích đoạn bình luận lưu trong thông báo */
const EXCERPT_LENGTH = 200;

export const excerpt = (text: string) => (text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH - 1)}…` : text);

export interface NotifyInput {
  /** Người nhận — trùng `actorId` thì bỏ qua (không tự báo cho mình) */
  userId: string;
  actorId: string;
  type: NotificationType;
  /** Thông báo về không gian làm việc không gắn bảng */
  boardId?: string;
  cardId?: string;
  data: Prisma.InputJsonObject;
}

const notificationInclude = { actor: { select: { id: true, name: true, avatarUrl: true } } } as const satisfies Prisma.NotificationInclude;

type NotificationWithActor = Prisma.NotificationGetPayload<{ include: typeof notificationInclude }>;

const toNotification = ({ userId: _userId, actorId: _actorId, ...notification }: NotificationWithActor) => notification;

/**
 * Thông báo cá nhân. Các service khác gọi `notify` SAU khi thay đổi đã lưu xong;
 * thông báo mới được đẩy ngay qua socket (phòng riêng của người nhận).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Tạo + đẩy realtime. Lỗi chỉ ghi log — thông báo là phụ, không làm hỏng thao tác chính. */
  async notify(inputs: NotifyInput[]) {
    const seen = new Set<string>();
    for (const input of inputs) {
      const key = `${input.userId}:${input.type}`;
      if (input.userId === input.actorId || seen.has(key)) continue;
      seen.add(key);
      await this.create(input);
    }
  }

  /** Thông báo của hệ thống (không có người gây ra, `actor` = null) — vd nhắc hạn chót. */
  async notifySystem(inputs: Omit<NotifyInput, 'actorId'>[]) {
    for (const input of inputs) await this.create(input);
  }

  private async create(input: Omit<NotifyInput, 'actorId'> & { actorId?: string }) {
    try {
      const notification = await this.prisma.notification.create({ data: input, include: notificationInclude });
      this.realtime.toUser(input.userId, 'notification:new', toNotification(notification));
    } catch (e) {
      this.logger.warn(`Không tạo được thông báo ${input.type} cho ${input.userId}: ${String(e)}`);
    }
  }

  /** Thẻ + bảng + người được giao + thành viên bảng — dùng để quyết định ai nhận và nội dung thông báo. */
  async cardContext(cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        title: true,
        archivedAt: true,
        members: { select: { userId: true } },
        list: {
          select: {
            archivedAt: true,
            board: {
              select: {
                id: true,
                title: true,
                members: { select: { userId: true, user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
    if (!card) return null;
    const { board } = card.list;
    return {
      boardId: board.id,
      cardId,
      /** Thẻ (hoặc danh sách chứa thẻ) đã lưu trữ → không gửi thông báo về thay đổi của thẻ */
      archived: !!card.archivedAt || !!card.list.archivedAt,
      assigneeIds: card.members.map((m) => m.userId),
      boardMembers: board.members.map((m) => ({ id: m.userId, name: m.user.name })),
      /** Phần chung của `data` */
      data: { boardTitle: board.title, cardTitle: card.title },
    };
  }

  async boardTitle(boardId: string) {
    const board = await this.prisma.board.findUnique({ where: { id: boardId }, select: { title: true } });
    return board?.title ?? '';
  }

  /** Mới nhất trước, phân trang theo cursor (id). */
  async list(userId: string, query: ListNotificationsQueryDto) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(query.filter === 'unread' && { readAt: null }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: notificationInclude,
    });
    const page = rows.slice(0, query.limit);
    return {
      notifications: page.map(toNotification),
      nextCursor: rows.length > query.limit ? page[page.length - 1].id : null,
    };
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Đánh dấu đã đọc / chưa đọc. Chỉ chủ thông báo; các tab khác của người đó được báo để cập nhật. */
  async markRead(id: string, userId: string, read: boolean) {
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: read ? new Date() : null },
    });
    if (!count) throw new NotFoundException(NOTIFICATION_NOT_FOUND);
    this.realtime.toUser(userId, 'notifications:changed', {}, true);
    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id }, include: notificationInclude });
    return toNotification(notification);
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (count) this.realtime.toUser(userId, 'notifications:changed', {}, true);
    return { count };
  }

  /** Rời / bị xoá khỏi bảng → bỏ thông báo của bảng đó (không còn xem được nội dung). */
  async removeForBoard(userId: string, boardId: string) {
    const { count } = await this.prisma.notification.deleteMany({ where: { userId, boardId } });
    if (count) this.realtime.toUser(userId, 'notifications:changed', {});
  }
}

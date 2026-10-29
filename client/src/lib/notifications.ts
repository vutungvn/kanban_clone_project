import { api } from './api';
import type { BoardRole } from './boards-api';
import { formatDayTime } from './card-dates';

export type NotificationType =
  | 'CARD_ASSIGNED'
  | 'CARD_UNASSIGNED'
  | 'CARD_COMMENT'
  | 'COMMENT_MENTION'
  | 'CARD_DUE_CHANGED'
  | 'CARD_DUE_SOON'
  | 'CARD_OVERDUE'
  | 'CARD_MOVED'
  | 'BOARD_INVITED'
  | 'ROLE_CHANGED'
  | 'JOIN_REQUESTED'
  | 'JOIN_APPROVED';

/** Thông báo cá nhân. `data` chụp lại tên bảng / thẻ... lúc tạo (xem NotificationDto trên Swagger). */
export interface Notification {
  id: string;
  type: NotificationType;
  data: Record<string, unknown>;
  boardId: string | null;
  cardId: string | null;
  /** null = chưa đọc */
  readAt: string | null;
  createdAt: string;
  /** null nếu tài khoản đã bị xoá hoặc là thông báo của hệ thống (xem isSystemNotification) */
  actor: { id: string; name: string; avatarUrl: string | null } | null;
}

export type NotificationFilter = 'all' | 'unread';

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const notificationsApi = {
  /** Mới nhất trước; `cursor` = `nextCursor` của trang trước */
  list: (filter: NotificationFilter, cursor?: string | null) => {
    const query = new URLSearchParams({ filter, limit: '15', ...(cursor && { cursor }) });
    return api<{ notifications: Notification[]; nextCursor: string | null }>(`/notifications?${query}`);
  },
  unreadCount: () => api<{ count: number }>('/notifications/unread-count').then((r) => r.count),
  markRead: (id: string, read: boolean) =>
    api<{ notification: Notification }>(`/notifications/${encodeURIComponent(id)}`, send('PATCH', { read })).then(
      (r) => r.notification,
    ),
  markAllRead: () => api<{ count: number }>('/notifications/read-all', send('POST')),
};

const ROLE_LABEL: Record<BoardRole, string> = { ADMIN: 'Quản trị viên', MEMBER: 'Thành viên', VIEWER: 'Người xem' };

/** Đoạn câu: `strong` = tên thẻ / bảng / vai trò in đậm. */
export type Segment = { text: string; strong?: boolean };

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const role = (value: unknown) => ROLE_LABEL[value as BoardRole] ?? str(value);

/** Thông báo của hệ thống (nhắc hạn chót) — không có người gây ra, câu mô tả đứng một mình. */
export const isSystemNotification = (n: Notification) => n.type === 'CARD_DUE_SOON' || n.type === 'CARD_OVERDUE';

/** Câu mô tả (sau tên người gây ra; thông báo hệ thống thì đứng một mình). Dùng cho cả danh sách thông báo và toast. */
export function describeNotification(n: Notification): Segment[] {
  const d = n.data;
  const card = { text: str(d.cardTitle), strong: true };
  const board = { text: str(d.boardTitle), strong: true };
  switch (n.type) {
    case 'CARD_ASSIGNED':
      return [{ text: 'đã giao cho bạn thẻ ' }, card];
    case 'CARD_UNASSIGNED':
      return [{ text: 'đã gỡ bạn khỏi thẻ ' }, card];
    case 'CARD_COMMENT':
      return [{ text: 'đã bình luận trên thẻ ' }, card];
    case 'COMMENT_MENTION':
      return [{ text: 'đã nhắc đến bạn trong thẻ ' }, card];
    case 'CARD_DUE_CHANGED':
      return typeof d.dueDate === 'string'
        ? [{ text: 'đã đặt hạn chót của thẻ ' }, card, { text: ' là ' }, { text: formatDayTime(d.dueDate), strong: true }]
        : [{ text: 'đã gỡ hạn chót của thẻ ' }, card];
    case 'CARD_DUE_SOON':
      return [{ text: 'Thẻ ' }, card, { text: ' sắp hết hạn lúc ' }, { text: formatDayTime(str(d.dueDate)), strong: true }];
    case 'CARD_OVERDUE':
      return [{ text: 'Thẻ ' }, card, { text: ' đã quá hạn từ ' }, { text: formatDayTime(str(d.dueDate)), strong: true }];
    case 'CARD_MOVED':
      if (typeof d.fromBoard === 'string') {
        return [{ text: 'đã chuyển thẻ ' }, card, { text: ' từ bảng ' }, { text: d.fromBoard, strong: true }, { text: ' sang bảng ' }, board];
      }
      return [
        { text: 'đã chuyển thẻ ' },
        card,
        { text: ' từ ' },
        { text: str(d.fromList), strong: true },
        { text: ' sang ' },
        { text: str(d.toList), strong: true },
      ];
    case 'BOARD_INVITED':
      return [{ text: 'đã thêm bạn vào bảng ' }, board, { text: ' với vai trò ' }, { text: role(d.role), strong: true }];
    case 'ROLE_CHANGED':
      return [{ text: 'đã đổi vai trò của bạn trong bảng ' }, board, { text: ' thành ' }, { text: role(d.role), strong: true }];
    case 'JOIN_REQUESTED':
      return [{ text: 'muốn tham gia bảng ' }, board];
    case 'JOIN_APPROVED':
      return [{ text: 'đã duyệt yêu cầu tham gia bảng ' }, board, { text: ' của bạn' }];
    default:
      return [{ text: 'có cập nhật mới' }];
  }
}

export const actorName = (n: Notification) => n.actor?.name ?? 'Người dùng đã bị xoá';

/** "An đã giao cho bạn thẻ Thiết kế" / "Thẻ Thiết kế sắp hết hạn lúc ..." — dùng cho toast. */
export function notificationText(n: Notification) {
  const text = describeNotification(n)
    .map((s) => s.text)
    .join('');
  return isSystemNotification(n) ? text : `${actorName(n)} ${text}`;
}

/** Trang cần mở khi bấm vào thông báo. */
export function notificationHref(n: Notification) {
  if (!n.boardId) return null;
  return n.cardId ? `/b/${n.boardId}?card=${encodeURIComponent(n.cardId)}` : `/b/${n.boardId}`;
}

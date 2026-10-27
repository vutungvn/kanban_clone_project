'use client';

import { Bell, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { formatFull, formatRelative } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import {
  actorName,
  describeNotification,
  notificationHref,
  notificationsApi,
  notificationText,
  type Notification,
  type NotificationFilter,
} from '@/lib/notifications';
import { getSocket } from '@/lib/realtime';
import { HEADER_ICON_BUTTON } from './styles';

/**
 * Số chưa đọc + danh sách thông báo. Thông báo mới đến qua socket (`notification:new`):
 * tăng số, hiện toast, chèn lên đầu danh sách. Đọc ở tab khác (`notifications:changed`) → tải lại.
 */
function useNotifications(filter: NotificationFilter, open: boolean) {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadingMore, setLoadingMore] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then(setUnread, () => undefined);
  }, []);

  const loadFirstPage = useCallback(() => {
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    notificationsApi.list(filter).then(
      (page) => {
        setItems(page.notifications);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      },
      () => setStatus('error'),
    );
  }, [filter]);

  useEffect(refreshCount, [refreshCount]);

  // Mở menu / đổi bộ lọc → tải trang đầu
  useEffect(() => {
    if (open) loadFirstPage();
  }, [open, loadFirstPage]);

  useEffect(() => {
    const socket = getSocket();
    const onNew = (n: Notification) => {
      setUnread((c) => c + 1);
      setItems((prev) => (prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
      toast.info(notificationText(n));
    };
    const onChanged = () => {
      refreshCount();
      if (openRef.current) loadFirstPage();
    };
    socket.on('notification:new', onNew);
    socket.on('notifications:changed', onChanged);
    // Nối lại sau khi mất mạng → có thể đã lỡ thông báo
    socket.on('connect', onChanged);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notifications:changed', onChanged);
      socket.off('connect', onChanged);
    };
  }, [refreshCount, loadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list(filter, nextCursor);
      setItems((prev) => [...prev, ...page.notifications.filter((n) => !prev.some((p) => p.id === n.id))]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  };

  /** Đổi giao diện ngay; lỗi thì hoàn tác. */
  const setRead = async (n: Notification, read: boolean) => {
    if (!!n.readAt === read) return;
    const readAt = read ? new Date().toISOString() : null;
    setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, readAt } : p)));
    setUnread((c) => Math.max(0, c + (read ? -1 : 1)));
    try {
      await notificationsApi.markRead(n.id, read);
    } catch (e) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? n : p)));
      setUnread((c) => Math.max(0, c + (read ? 1 : -1)));
      toast.error(errorMessage(e));
    }
  };

  const markAllRead = async () => {
    const before = { items, unread };
    const now = new Date().toISOString();
    setItems((prev) => prev.map((p) => (p.readAt ? p : { ...p, readAt: now })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch (e) {
      setItems(before.items);
      setUnread(before.unread);
      toast.error(errorMessage(e));
    }
  };

  // Lọc "chưa đọc": mục vừa đánh dấu đã đọc vẫn để nguyên tới lần tải sau (tránh danh sách nhảy dưới con trỏ)
  return { unread, items, nextCursor, status, loadingMore, loadMore, setRead, markAllRead, reload: loadFirstPage };
}

export function NotificationsMenu() {
  const { anchor, toggle, close } = usePopoverAnchor();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const n = useNotifications(filter, !!anchor);
  const router = useRouter();

  const openNotification = (item: Notification) => {
    void n.setRead(item, true);
    const href = notificationHref(item);
    close();
    if (href) router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={n.unread ? `Thông báo, ${n.unread} chưa đọc` : 'Thông báo'}
        title="Thông báo"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className={cn(HEADER_ICON_BUTTON, 'relative')}
      >
        <Bell size={20} />
        {n.unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-navy">
            {n.unread > 99 ? '99+' : n.unread}
          </span>
        )}
      </button>

      <Popover anchor={anchor} onClose={close} label="Thông báo" align="end" width={380}>
        <PopoverHeader title="Thông báo" onClose={close} />
        <div className="-mt-1 mb-2 flex items-center justify-between gap-2 px-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-subtle">
            <input
              type="checkbox"
              role="switch"
              checked={filter === 'unread'}
              onChange={(e) => setFilter(e.target.checked ? 'unread' : 'all')}
              className="h-4 w-4 accent-brand"
            />
            Chỉ hiện chưa đọc
          </label>
          <button
            type="button"
            onClick={() => void n.markAllRead()}
            disabled={n.unread === 0}
            className="rounded px-1.5 py-1 text-xs font-medium text-brand transition-colors hover:bg-surface-low disabled:cursor-default disabled:text-ink-subtle/60 disabled:hover:bg-transparent"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        <div className="-mx-3 max-h-[min(70vh,520px)] overflow-y-auto border-t border-surface-high">
          {n.status === 'loading' || n.status === 'idle' ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-subtle">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải...
            </p>
          ) : n.status === 'error' ? (
            <div className="py-8 text-center text-sm text-ink-subtle">
              Không tải được thông báo.{' '}
              <button type="button" onClick={n.reload} className="font-medium text-brand hover:underline">
                Thử lại
              </button>
            </div>
          ) : n.items.length === 0 ? (
            <EmptyState unreadOnly={filter === 'unread'} />
          ) : (
            <ul>
              {n.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => openNotification(item)}
                  onToggleRead={() => void n.setRead(item, !item.readAt)}
                />
              ))}
            </ul>
          )}
          {n.status === 'ready' && n.nextCursor && (
            <div className="border-t border-surface-high p-2">
              <button
                type="button"
                onClick={() => void n.loadMore()}
                disabled={n.loadingMore}
                className="h-8 w-full rounded text-sm font-medium text-ink-subtle transition-colors hover:bg-surface-low disabled:opacity-60"
              >
                {n.loadingMore ? 'Đang tải...' : 'Xem thông báo cũ hơn'}
              </button>
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}

function NotificationRow({ item, onOpen, onToggleRead }: { item: Notification; onOpen: () => void; onToggleRead: () => void }) {
  const unread = !item.readAt;
  const cardRelated = typeof item.data.cardTitle === 'string';
  const quote = typeof item.data.text === 'string' ? item.data.text : null;

  return (
    <li className={cn('group relative border-b border-surface-low last:border-0', unread && 'bg-brand/4')}>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 py-3 pr-10 pl-3 text-left transition-colors hover:bg-surface-low"
      >
        {item.actor ? (
          <Avatar name={item.actor.name} seed={item.actor.id} src={item.actor.avatarUrl} size={32} className="shrink-0" />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-full bg-surface-high" aria-hidden />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug wrap-break-word">
            <strong className="font-semibold">{actorName(item)}</strong>{' '}
            {describeNotification(item).map((s, i) =>
              s.strong ? (
                <strong key={i} className="font-semibold">
                  {s.text}
                </strong>
              ) : (
                <span key={i} className="text-ink-subtle">
                  {s.text}
                </span>
              ),
            )}
          </span>
          {quote && (
            <span className="mt-1.5 line-clamp-2 block rounded-md bg-card px-2 py-1 text-xs wrap-break-word text-ink shadow-[0_0_0_1px_var(--color-hairline)]">
              {quote}
            </span>
          )}
          <span className="mt-1 block text-xs text-ink-subtle">
            <time dateTime={item.createdAt} title={formatFull(item.createdAt)}>
              {formatRelative(item.createdAt)}
            </time>
            {cardRelated && typeof item.data.boardTitle === 'string' && <> · {item.data.boardTitle}</>}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleRead}
        aria-label={unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
        title={unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
        className="absolute top-3 right-2 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-surface-mid"
      >
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full transition-colors',
            unread ? 'bg-brand' : 'bg-transparent ring-1 ring-outline/50 group-hover:ring-outline',
          )}
        />
      </button>
    </li>
  );
}

function EmptyState({ unreadOnly }: { unreadOnly: boolean }) {
  return (
    <div className="flex flex-col items-center px-4 pt-6 pb-8 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-mid text-brand">
        <Bell size={26} />
      </span>
      <p className="text-sm font-semibold">{unreadOnly ? 'Bạn đã đọc hết thông báo' : 'Không có thông báo nào'}</p>
      <p className="mt-1 text-xs text-ink-subtle">
        Bạn sẽ nhận thông báo khi có người nhắc tới bạn, giao thẻ cho bạn hoặc bình luận trên thẻ của bạn.
      </p>
    </div>
  );
}

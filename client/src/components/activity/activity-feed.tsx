'use client';

import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { describeActivity } from '@/components/board/describe-activity';
import { errorMessage } from '@/lib/api';
import { backgroundClass } from '@/lib/board-backgrounds';
import { addDays, formatDay, formatFull, formatRelative, toDateInput } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { meApi, type FeedActivity, type FeedScope } from '@/lib/me-api';
import { useRefreshOnReturn } from '@/lib/use-refresh-on-return';

/**
 * Tải hoạt động các bảng tôi tham gia, có "Tải thêm". Đổi scope / bảng thì tải lại từ đầu;
 * quay lại tab cũng tải lại trang đầu (không realtime).
 */
export function useFeed(scope: FeedScope, boardId: string | null, pageSize = 20) {
  const [items, setItems] = useState<FeedActivity[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bỏ kết quả của lần tải cũ khi người dùng đã đổi bộ lọc
  const seq = useRef(0);

  const reload = useCallback(() => {
    const id = ++seq.current;
    meApi.activities({ scope, boardId, limit: pageSize }).then(
      (page) => {
        if (id !== seq.current) return;
        setItems(page.activities);
        setNextCursor(page.nextCursor);
        setError(null);
      },
      (e) => id === seq.current && setError(errorMessage(e)),
    );
  }, [scope, boardId, pageSize]);

  useEffect(() => {
    setItems(null);
    reload();
  }, [reload]);
  useRefreshOnReturn(reload);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const id = seq.current;
    setLoadingMore(true);
    try {
      const page = await meApi.activities({ scope, boardId, cursor: nextCursor, limit: pageSize });
      if (id !== seq.current) return;
      setItems((list) => [...(list ?? []), ...page.activities]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, [scope, boardId, pageSize, nextCursor, loadingMore]);

  return { items, error, hasMore: !!nextCursor, loadingMore, loadMore };
}

/** "Hôm nay" / "Hôm qua" / "25 thg 10" */
function dayLabel(iso: string) {
  const day = toDateInput(new Date(iso));
  if (day === toDateInput(new Date())) return 'Hôm nay';
  if (day === toDateInput(addDays(new Date(), -1))) return 'Hôm qua';
  return formatDay(iso);
}

/** Danh sách hoạt động; `groupByDay` gom theo ngày (trang Hoạt động), không thì liền một mạch (Trang chủ). */
export function ActivityFeedList({ items, groupByDay = false }: { items: FeedActivity[]; groupByDay?: boolean }) {
  if (!groupByDay) {
    return (
      <ul className="flex flex-col gap-4">
        {items.map((a) => (
          <FeedItem key={a.id} activity={a} />
        ))}
      </ul>
    );
  }
  const days: { label: string; items: FeedActivity[] }[] = [];
  for (const a of items) {
    const label = dayLabel(a.createdAt);
    if (days.at(-1)?.label === label) days.at(-1)!.items.push(a);
    else days.push({ label, items: [a] });
  }
  return (
    <div className="flex flex-col gap-6">
      {days.map((d) => (
        <section key={d.label} aria-label={d.label}>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">{d.label}</h3>
          <ul className="flex flex-col gap-4">
            {d.items.map((a) => (
              <FeedItem key={a.id} activity={a} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FeedItem({ activity: a }: { activity: FeedActivity }) {
  const href = `/b/${a.board.id}?card=${encodeURIComponent(a.card.id)}`;
  const name = a.user?.name ?? 'Người dùng đã bị xoá';
  return (
    <li className="flex items-start gap-3">
      {a.user ? (
        <Avatar name={a.user.name} seed={a.user.id} src={a.user.avatarUrl} size={32} className="shrink-0" />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-surface-high" aria-hidden />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="wrap-break-word text-ink">
          <strong className="font-semibold">{name}</strong>{' '}
          {a.type === 'COMMENT' ? 'đã bình luận' : describeActivity(a, [])}
        </p>
        {a.type === 'COMMENT' && a.text && (
          <Link
            href={href}
            className="mt-1.5 block rounded-lg bg-card px-3 py-2 text-ink shadow-[0_0_0_1px_var(--color-hairline)] transition-colors hover:bg-surface-low"
          >
            <span className="line-clamp-3 whitespace-pre-wrap">{a.text}</span>
          </Link>
        )}
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-subtle">
          <Link href={href} className="max-w-full truncate font-medium text-ink hover:text-brand hover:underline">
            {a.card.title}
          </Link>
          <span aria-hidden>·</span>
          <span className="flex min-w-0 items-center gap-1">
            <span aria-hidden className={cn('h-2.5 w-2.5 shrink-0 rounded-sm bg-linear-to-br', backgroundClass(a.board.background))} />
            <Link href={`/b/${a.board.id}`} className="truncate hover:text-ink hover:underline">
              {a.board.title}
            </Link>
          </span>
          <span aria-hidden>·</span>
          <time dateTime={a.createdAt} title={formatFull(a.createdAt)}>
            {formatRelative(a.createdAt)}
          </time>
        </p>
      </div>
    </li>
  );
}

/** Đang tải / lỗi / trống / nút "Tải thêm" — dùng chung cho Trang chủ và trang Hoạt động. */
export function FeedStatus({
  items,
  error,
  empty,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: FeedActivity[] | null;
  error: string | null;
  empty: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  if (error && !items) return <p className="rounded-lg bg-danger-soft/40 px-3 py-2 text-sm text-danger">{error}</p>;
  if (!items) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-subtle" aria-busy>
        <LoaderCircle size={16} className="animate-spin" />
        Đang tải...
      </p>
    );
  }
  if (!items.length) return <p className="rounded-lg bg-surface-low px-4 py-6 text-center text-sm text-ink-subtle">{empty}</p>;
  if (!hasMore || !onLoadMore) return null;
  return (
    <button
      type="button"
      onClick={onLoadMore}
      disabled={loadingMore}
      className="flex h-9 items-center justify-center gap-2 self-center rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:opacity-60"
    >
      {loadingMore && <LoaderCircle size={16} className="animate-spin" />}
      {loadingMore ? 'Đang tải...' : 'Tải thêm'}
    </button>
  );
}

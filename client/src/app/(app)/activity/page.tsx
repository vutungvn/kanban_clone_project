'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { ActivityFeedList, FeedStatus, useFeed } from '@/components/activity/activity-feed';
import { useAuth } from '@/components/auth-provider';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { useBoards } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import type { FeedScope } from '@/lib/me-api';

const TABS: { value: FeedScope; label: string }[] = [
  { value: 'all', label: 'Tất cả bảng' },
  { value: 'mine', label: 'Của tôi' },
];

// useSearchParams cần nằm trong Suspense để Next.js dựng sẵn được trang
export default function ActivityPage() {
  return (
    <Suspense>
      <ActivityView />
    </Suspense>
  );
}

/** URL của trang theo bộ lọc — bỏ tham số mặc định cho gọn */
const activityHref = (scope: FeedScope, boardId: string) => {
  const query = new URLSearchParams({ ...(scope === 'mine' && { scope }), ...(boardId && { board: boardId }) }).toString();
  return query ? `/activity?${query}` : '/activity';
};

/**
 * /activity?scope=all|mine&board=... — hoạt động trên các bảng tôi tham gia.
 * Bộ lọc nằm trên URL: mở từ menu tài khoản ("Hoạt động" → tab "Của tôi") luôn là mọi bảng; đổi tab giữ bảng đang lọc.
 */
function ActivityView() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const router = useRouter();
  const params = useSearchParams();
  const scope: FeedScope = params.get('scope') === 'mine' ? 'mine' : 'all';
  const boardId = params.get('board') ?? '';
  const boards = useBoards();
  const sortedBoards = useMemo(() => [...boards].sort((a, b) => a.title.localeCompare(b.title, 'vi')), [boards]);
  const feed = useFeed(scope, boardId || null);
  if (!user) return null;

  return (
    <div className="flex">
      <BoardsSidebar userName={user.name} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-semibold text-ink">Hoạt động</h1>
            <p className="mt-1 text-sm text-ink-subtle">Những gì vừa xảy ra trên các thẻ thuộc bảng bạn tham gia.</p>
          </header>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Phạm vi" className="flex gap-1 rounded-lg bg-surface-low p-1">
              {TABS.map((t) => (
                <Link
                  key={t.value}
                  href={activityHref(t.value, boardId)}
                  replace
                  scroll={false}
                  aria-current={scope === t.value ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    scope === t.value ? 'bg-card text-brand shadow-sm' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <select
              value={boardId}
              onChange={(e) => router.replace(activityHref(scope, e.target.value), { scroll: false })}
              aria-label="Lọc theo bảng"
              className="h-9 rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
            >
              <option value="">Tất cả bảng</option>
              {sortedBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          {feed.items && feed.items.length > 0 && <ActivityFeedList items={feed.items} groupByDay />}
          <FeedStatus
            items={feed.items}
            error={feed.error}
            empty={
              scope === 'mine'
                ? `Bạn chưa có hoạt động nào${boardId ? ' trên bảng này' : ''}.`
                : `Chưa có hoạt động nào trên ${boardId ? 'bảng này' : 'các bảng của bạn'}.`
            }
            hasMore={feed.hasMore}
            loadingMore={feed.loadingMore}
            onLoadMore={() => void feed.loadMore()}
          />
        </div>
      </main>
    </div>
  );
}

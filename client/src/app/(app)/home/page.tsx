'use client';

import { Activity, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { ActivityFeedList, FeedStatus, useFeed } from '@/components/activity/activity-feed';
import { useAuth } from '@/components/auth-provider';
import { givenName } from '@/components/avatar';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { MyCardsSection } from '@/components/home/my-cards';
import { backgroundClass } from '@/lib/board-backgrounds';
import type { BoardSummary } from '@/lib/boards-api';
import { compareRecent, useBoards } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

/** Trang chủ: thẻ được giao cho tôi (mọi bảng) + hoạt động mới nhất + bảng gắn sao / xem gần đây. */
export default function HomePage() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  if (!user) return null;

  return (
    <div className="flex">
      <BoardsSidebar userName={user.name} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-300 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
          <header>
            <h1 className="text-2xl font-semibold text-ink">Chào {givenName(user.name)} 👋</h1>
            <p className="mt-1 text-sm text-ink-subtle">Việc của bạn trên mọi bảng, gom về một chỗ.</p>
          </header>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <MyCardsSection />
            <aside className="flex flex-col gap-8">
              <RecentActivity />
              <QuickBoards />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function RecentActivity() {
  const { items, error, freshIds } = useFeed('all', null, { pageSize: 5, latestOnly: true });
  return (
    <section aria-labelledby="recent-activity-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recent-activity-title" className="flex items-center gap-2 text-base font-semibold text-ink">
          <Activity size={20} className="text-ink-subtle" />
          Hoạt động gần đây
        </h2>
        <Link href="/activity" className="text-sm font-medium text-brand hover:text-brand-hover hover:underline">
          Xem tất cả
        </Link>
      </div>
      {items && items.length > 0 && <ActivityFeedList items={items} freshIds={freshIds} />}
      <FeedStatus items={items} error={error} empty="Chưa có hoạt động nào trên các bảng của bạn." />
    </section>
  );
}

const QUICK_LIMIT = 5;

/** Bảng đã gắn sao + bảng xem gần đây (dữ liệu danh sách bảng đã có sẵn). */
function QuickBoards() {
  const boards = useBoards();
  const starred = useMemo(() => boards.filter((b) => b.starred).sort((a, b) => a.title.localeCompare(b.title, 'vi')), [boards]);
  const recent = useMemo(
    () =>
      boards
        .filter((b) => b.lastViewedAt)
        .sort(compareRecent)
        .slice(0, QUICK_LIMIT),
    [boards],
  );
  if (!starred.length && !recent.length) return null;
  return (
    <div className="flex flex-col gap-6">
      {starred.length > 0 && <BoardLinks title="Bảng đã gắn sao" icon={Star} boards={starred} />}
      {recent.length > 0 && <BoardLinks title="Xem gần đây" icon={Clock} boards={recent} />}
    </div>
  );
}

function BoardLinks({ title, icon: Icon, boards }: { title: string; icon: typeof Star; boards: BoardSummary[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <Icon size={14} />
        {title}
      </h2>
      <ul className="flex flex-col gap-1">
        {boards.map((b) => (
          <li key={b.id}>
            <Link href={`/b/${b.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink transition-colors hover:bg-surface-low">
              <span aria-hidden className={cn('h-6 w-8 shrink-0 rounded bg-linear-to-br', backgroundClass(b.background))} />
              <span className="truncate font-medium">{b.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

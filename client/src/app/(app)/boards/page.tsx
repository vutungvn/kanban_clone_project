'use client';

import { ChevronDown, LayoutDashboard, Lock, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { givenName } from '@/components/avatar';
import {
  applyBoardFilter,
  BoardFilterButton,
  countActiveFilters,
  EMPTY_FILTER,
  type BoardFilter,
} from '@/components/boards/board-filter';
import { BoardTile, CreateBoardTile } from '@/components/boards/board-tile';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { CreateBoardPopover } from '@/components/boards/create-board-popover';
import { usePopoverAnchor } from '@/components/popover';
import { compareRecent, useBoards } from '@/lib/boards-store';

type SortKey = 'recent' | 'alpha';

export default function BoardsPage() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const boards = useBoards();
  const createBoard = usePopoverAnchor();
  const [sort, setSort] = useState<SortKey>('recent');
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);

  const visible = useMemo(
    () =>
      applyBoardFilter(boards, filter).sort(
        sort === 'alpha' ? (a, b) => a.title.localeCompare(b.title, 'vi') : compareRecent,
      ),
    [boards, filter, sort],
  );

  if (!user) return null;
  const filtering = countActiveFilters(filter) > 0;
  // Khi đã lọc "chỉ bảng gắn sao" thì mục "Đã đánh dấu sao" bị trùng → ẩn đi
  const starred = filter.starredOnly ? [] : visible.filter((b) => b.starred);
  const name = givenName(user.name);

  return (
    <div className="flex">
      <BoardsSidebar userName={user.name} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-300 flex-col gap-8 px-6 py-8 lg:px-10">
          {/* Thông tin không gian làm việc + thanh công cụ */}
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-hover text-lg font-semibold text-white shadow-sm select-none">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight">Không gian làm việc của {name}</h1>
                  <span className="rounded-full bg-surface-high px-2 py-0.5 text-[11px] font-medium text-brand-hover">
                    Không gian cá nhân
                  </span>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle">
                  <Lock size={12} />
                  Riêng tư
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sắp xếp"
                  className="h-8 cursor-pointer appearance-none rounded bg-surface-low pr-8 pl-3 text-sm font-medium text-ink-subtle shadow-sm transition-colors outline-none hover:bg-surface-mid hover:text-ink focus:shadow-[0_0_0_2px_var(--color-brand)]"
                >
                  <option value="recent">Xem gần đây nhất</option>
                  <option value="alpha">Tên A–Z</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute top-2 right-2 text-ink-subtle" />
              </div>
              <BoardFilterButton value={filter} onChange={setFilter} />
              <button
                type="button"
                onClick={createBoard.toggle}
                className="flex h-8 items-center gap-1.5 rounded bg-brand px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
              >
                <Plus size={18} />
                Tạo bảng
              </button>
            </div>
          </header>

          {starred.length > 0 && (
            <BoardSection icon={<Star size={20} className="text-amber-500" fill="currentColor" />} title="Đã đánh dấu sao">
              {starred.map((board) => (
                <BoardTile key={board.id} board={board} />
              ))}
            </BoardSection>
          )}

          <BoardSection
            icon={<LayoutDashboard size={20} className="text-ink-subtle" />}
            title="Bảng của bạn"
            aside={filtering ? `${visible.length}/${boards.length} bảng` : `${boards.length} bảng`}
            empty={
              filtering && visible.length === 0 ? (
                <>
                  Không có bảng nào khớp với bộ lọc.{' '}
                  <button
                    type="button"
                    onClick={() => setFilter(EMPTY_FILTER)}
                    className="font-semibold text-brand hover:underline"
                  >
                    Xoá bộ lọc
                  </button>
                </>
              ) : undefined
            }
          >
            {visible.map((board) => (
              <BoardTile key={board.id} board={board} />
            ))}
            {!filtering && <CreateBoardTile onClick={createBoard.toggle} />}
          </BoardSection>
        </div>
      </main>

      <CreateBoardPopover anchor={createBoard.anchor} onClose={createBoard.close} />
    </div>
  );
}

function BoardSection({
  icon,
  title,
  aside,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  aside?: string;
  empty?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </h2>
        {aside && <span className="text-xs font-medium text-ink-subtle">{aside}</span>}
      </div>
      {empty ? (
        <div className="rounded-lg bg-surface-low px-4 py-6 text-center text-sm text-ink-subtle">{empty}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{children}</div>
      )}
    </section>
  );
}

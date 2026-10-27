'use client';

import { ListFilter, Star } from 'lucide-react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import type { BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { matchesQuery } from '@/lib/search';

export interface BoardFilter {
  query: string;
  starredOnly: boolean;
}

export const EMPTY_FILTER: BoardFilter = { query: '', starredOnly: false };

export function countActiveFilters(f: BoardFilter) {
  return (f.query.trim() ? 1 : 0) + (f.starredOnly ? 1 : 0);
}

export function applyBoardFilter(boards: BoardSummary[], f: BoardFilter) {
  return boards.filter((b) => matchesQuery(b.title, f.query) && (!f.starredOnly || b.starred));
}

export function BoardFilterButton({
  value,
  onChange,
}: {
  value: BoardFilter;
  onChange: (next: BoardFilter) => void;
}) {
  const { anchor, toggle, close } = usePopoverAnchor();
  const activeCount = countActiveFilters(value);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded px-3 text-sm font-medium shadow-sm transition-colors',
          activeCount > 0
            ? 'bg-surface-high text-brand-hover hover:bg-surface-highest'
            : 'bg-surface-low text-ink-subtle hover:bg-surface-mid hover:text-ink aria-expanded:bg-surface-mid',
        )}
      >
        <ListFilter size={18} />
        Lọc bảng
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      <Popover anchor={anchor} onClose={close} label="Lọc bảng" align="end">
        <PopoverHeader title="Lọc bảng" onClose={close} />

        <label htmlFor="board-filter-query" className="mb-1.5 block text-xs font-semibold">
          Từ khoá
        </label>
        <input
          id="board-filter-query"
          type="search"
          autoFocus
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') close();
          }}
          placeholder="Nhập tên bảng..."
          className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] transition-shadow outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
        />
        <p className="mt-1.5 text-xs text-ink-subtle">Tìm theo tên bảng, không phân biệt dấu.</p>

        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-surface-low">
          <input
            type="checkbox"
            checked={value.starredOnly}
            onChange={(e) => onChange({ ...value, starredOnly: e.target.checked })}
            className="h-4 w-4 accent-brand"
          />
          <Star size={16} className="text-amber-500" fill="currentColor" />
          Chỉ bảng đã đánh dấu sao
        </label>

        <div className="-mx-3 mt-2 border-t border-surface-high px-3 pt-3">
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTER)}
            disabled={activeCount === 0}
            className="h-8 w-full rounded bg-surface-low text-sm font-medium text-ink transition-colors hover:bg-surface-mid disabled:cursor-not-allowed disabled:text-outline disabled:hover:bg-surface-low"
          >
            Xoá bộ lọc
          </button>
        </div>
      </Popover>
    </>
  );
}

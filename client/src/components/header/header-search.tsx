'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { BOARD_BACKGROUNDS } from '@/lib/board-backgrounds';
import { compareRecent, useBoards } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { matchesQuery } from '@/lib/search';

const MAX_RESULTS = 8;
const RECENT_COUNT = 5;

/** Ô tìm kiếm board trên header. Phím "/" để focus, ↑ ↓ Enter để chọn. */
export function HeaderSearch() {
  const boards = useBoards();
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const hasQuery = query.trim().length > 0;
  const results = useMemo(() => {
    const sorted = [...boards].sort(compareRecent);
    return hasQuery
      ? sorted.filter((b) => matchesQuery(b.title, query)).slice(0, MAX_RESULTS)
      : sorted.slice(0, RECENT_COUNT);
  }, [boards, query, hasQuery]);

  // Phím tắt "/" (trừ khi đang gõ trong ô nhập khác)
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function goTo(boardId: string) {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    router.push(`/b/${boardId}`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      goTo(results[active].id);
    }
  }

  const showList = open && (results.length > 0 || hasQuery);

  return (
    <div ref={wrapperRef} className="group relative hidden sm:block">
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute top-4 left-2.5 -translate-y-1/2 text-white/60 group-focus-within:text-ink-subtle"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listboxId}-${active}` : undefined}
        aria-label="Tìm kiếm bảng"
        placeholder="Tìm kiếm..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-8 w-52 rounded bg-white/15 pr-8 pl-8 text-xs text-white transition-all outline-none placeholder:text-white/60 hover:bg-white/20 focus:bg-white focus:text-ink focus:placeholder:text-outline lg:w-64"
      />
      <kbd className="pointer-events-none absolute top-4 right-2 -translate-y-1/2 rounded border border-white/30 px-1.5 text-[10px] leading-4 text-white/70 group-focus-within:hidden">
        /
      </kbd>

      {showList && (
        <div className="absolute top-full right-0 z-50 mt-1.5 w-80 rounded-lg bg-white p-2 text-ink shadow-[0_8px_24px_rgba(9,30,66,0.2),0_0_1px_rgba(9,30,66,0.31)]">
          <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
            {hasQuery ? 'Bảng' : 'Đã xem gần đây'}
          </p>
          {results.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-subtle">Không tìm thấy bảng nào khớp với &quot;{query.trim()}&quot;.</p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Kết quả tìm kiếm">
              {results.map((board, i) => (
                <li
                  key={board.id}
                  id={`${listboxId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerEnter={() => setActive(i)}
                  // mousedown thay vì click để không bị blur input trước
                  onMouseDown={(e) => {
                    e.preventDefault();
                    goTo(board.id);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 text-sm',
                    i === active && 'bg-surface-mid',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('h-6 w-8 shrink-0 rounded bg-linear-to-br', BOARD_BACKGROUNDS[board.background].className)}
                  />
                  <span className="truncate">{board.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

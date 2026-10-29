'use client';

import { ArrowRight, LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { CardResultContent, CommentResultContent, Highlighted } from '@/components/search/search-results';
import { backgroundClass } from '@/lib/board-backgrounds';
import { compareRecent, useBoards, type BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import {
  cardHref,
  matchesQuery,
  MIN_SEARCH_LENGTH,
  searchPageHref,
  type CardSearchResult,
  type CommentSearchResult,
} from '@/lib/search';
import { useSearchResults } from '@/lib/use-search';
import { HEADER_ICON_BUTTON } from './styles';

const MAX_BOARD_RESULTS = 4;
const RECENT_COUNT = 5;
/** Số thẻ / bình luận mỗi nhóm trong dropdown — xem hết ở trang /search */
const SERVER_RESULTS = 5;

/** 1 dòng chọn được trong dropdown (↑ ↓ đi qua mọi nhóm) */
type Option =
  | { kind: 'board'; href: string; board: BoardSummary }
  | { kind: 'card'; href: string; card: CardSearchResult }
  | { kind: 'comment'; href: string; comment: CommentSearchResult }
  | { kind: 'all'; href: string };

const optionKey = (o: Option) =>
  o.kind === 'board' ? `b:${o.board.id}` : o.kind === 'card' ? `c:${o.card.id}` : o.kind === 'comment' ? `m:${o.comment.id}` : 'all';

/**
 * Ô tìm kiếm trên header: bảng (lọc ngay trên client) + thẻ / bình luận (server, full-text search, từ 2 ký tự).
 * Phím "/" để focus, ↑ ↓ Enter để chọn; "Xem tất cả kết quả" → trang /search. Màn hình nhỏ: nút kính lúp mở /search.
 */
export function HeaderSearch() {
  const boards = useBoards();
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const searchServer = trimmed.length >= MIN_SEARCH_LENGTH;
  const search = useSearchResults(searchServer ? { q: trimmed, limit: SERVER_RESULTS } : null);
  const cards = searchServer ? (search.data?.cards ?? null) : null;
  const comments = searchServer ? (search.data?.comments ?? null) : null;

  const boardResults = useMemo(() => {
    const sorted = [...boards].sort(compareRecent);
    return hasQuery
      ? sorted.filter((b) => matchesQuery(b.title, query)).slice(0, MAX_BOARD_RESULTS)
      : sorted.slice(0, RECENT_COUNT);
  }, [boards, query, hasQuery]);

  const options = useMemo<Option[]>(
    () => [
      ...boardResults.map((board) => ({ kind: 'board' as const, href: `/b/${board.id}`, board })),
      ...(cards?.items ?? []).map((card) => ({ kind: 'card' as const, href: cardHref(card.board.id, card.id), card })),
      ...(comments?.items ?? []).map((comment) => ({
        kind: 'comment' as const,
        href: cardHref(comment.board.id, comment.card.id),
        comment,
      })),
      ...(searchServer ? [{ kind: 'all' as const, href: searchPageHref(trimmed) }] : []),
    ],
    [boardResults, cards, comments, searchServer, trimmed],
  );
  const activeIndex = Math.min(active, options.length - 1);

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

  function goTo(href: string) {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!options.length) return;
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[activeIndex]) goTo(options[activeIndex].href);
      else if (searchServer) goTo(searchPageHref(trimmed));
    }
  }

  const loadingServer = searchServer && search.loading && !search.data;
  const nothingFound =
    hasQuery && !boardResults.length && (!searchServer || (!search.loading && !search.error && !cards?.total && !comments?.total));
  const showList = open && (options.length > 0 || hasQuery);

  /** Thuộc tính chung của 1 dòng chọn được (`key` truyền riêng) */
  const optionProps = (option: Option, className?: string) => {
    const i = options.indexOf(option);
    return {
      id: `${listboxId}-${i}`,
      role: 'option' as const,
      'aria-selected': i === activeIndex,
      onPointerEnter: () => setActive(i),
      // mousedown thay vì click để không bị blur input trước
      onMouseDown: (e: MouseEvent) => {
        e.preventDefault();
        goTo(option.href);
      },
      className: cn('flex cursor-pointer items-start gap-3 rounded px-2 py-1.5', i === activeIndex && 'bg-surface-mid', className),
    };
  };

  return (
    <>
      <Link href="/search" aria-label="Tìm kiếm" className={cn(HEADER_ICON_BUTTON, 'sm:hidden')}>
        <Search size={18} />
      </Link>

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
          aria-activedescendant={showList && options[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-label="Tìm kiếm bảng, thẻ, bình luận"
          placeholder="Tìm kiếm..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-8 w-52 rounded bg-white/15 pr-8 pl-8 text-xs text-white transition-all outline-none placeholder:text-white/60 hover:bg-white/20 focus:bg-card focus:text-ink focus:placeholder:text-outline lg:w-64"
        />
        <kbd className="pointer-events-none absolute top-4 right-2 -translate-y-1/2 rounded border border-white/30 px-1.5 text-[10px] leading-4 text-white/70 group-focus-within:hidden">
          /
        </kbd>

        {showList && (
          <div className="absolute top-full right-0 z-50 mt-1.5 max-h-[min(75vh,640px)] w-[26rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg bg-card p-2 text-ink shadow-[0_8px_24px_rgba(9,30,66,0.2),0_0_0_1px_var(--color-hairline)]">
            <ul id={listboxId} role="listbox" aria-label="Kết quả tìm kiếm">
              {boardResults.length > 0 && (
                <Section title={hasQuery ? 'Bảng' : 'Đã xem gần đây'}>
                  {options
                    .filter((o) => o.kind === 'board')
                    .map((o) => (
                      <li key={optionKey(o)} {...optionProps(o)}>
                        <span aria-hidden className={cn('h-6 w-8 shrink-0 rounded bg-linear-to-br', backgroundClass(o.board.background))} />
                        <span className="truncate text-sm">
                          <Highlighted text={o.board.title} query={trimmed} />
                        </span>
                      </li>
                    ))}
                </Section>
              )}

              {cards && cards.items.length > 0 && (
                <Section title="Thẻ" total={cards.total} shown={cards.items.length}>
                  {options
                    .filter((o) => o.kind === 'card')
                    .map((o) => (
                      <li key={optionKey(o)} {...optionProps(o)}>
                        <CardResultContent card={o.card} query={trimmed} />
                      </li>
                    ))}
                </Section>
              )}

              {comments && comments.items.length > 0 && (
                <Section title="Bình luận" total={comments.total} shown={comments.items.length}>
                  {options
                    .filter((o) => o.kind === 'comment')
                    .map((o) => (
                      <li key={optionKey(o)} {...optionProps(o)}>
                        <CommentResultContent comment={o.comment} query={trimmed} />
                      </li>
                    ))}
                </Section>
              )}

              {hasQuery && !searchServer && (
                <li role="presentation" className="px-2 py-2 text-xs text-ink-subtle">
                  Gõ ít nhất {MIN_SEARCH_LENGTH} ký tự để tìm cả thẻ và bình luận.
                </li>
              )}
              {loadingServer && (
                <li role="presentation" className="flex items-center gap-2 px-2 py-2 text-xs text-ink-subtle">
                  <LoaderCircle size={14} className="animate-spin" />
                  Đang tìm thẻ và bình luận...
                </li>
              )}
              {searchServer && search.error && (
                <li role="presentation" className="px-2 py-2 text-xs text-danger">
                  {search.error}
                </li>
              )}
              {nothingFound && (
                <li role="presentation" className="px-2 py-3 text-sm text-ink-subtle">
                  Không tìm thấy kết quả nào cho &quot;{trimmed}&quot;.
                </li>
              )}

              {options
                .filter((o) => o.kind === 'all')
                .map((o) => (
                  <li key={optionKey(o)} {...optionProps(o, 'mt-1 items-center border-t border-surface-high pt-2.5 text-sm text-brand')}>
                    <Search size={15} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">Xem tất cả kết quả cho &quot;{trimmed}&quot;</span>
                    <ArrowRight size={15} aria-hidden className="shrink-0" />
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

/** Tiêu đề nhóm + các dòng. `total` > `shown` → hiện tổng số (xem hết ở trang /search). */
function Section({ title, total, shown, children }: { title: string; total?: number; shown?: number; children: ReactNode }) {
  return (
    <li role="presentation" className="mb-1 last:mb-0">
      <p className="flex items-center justify-between px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
        <span>{title}</span>
        {total !== undefined && shown !== undefined && total > shown && <span className="font-medium tracking-normal normal-case">{total} kết quả</span>}
      </p>
      <ul role="group" aria-label={title}>
        {children}
      </ul>
    </li>
  );
}

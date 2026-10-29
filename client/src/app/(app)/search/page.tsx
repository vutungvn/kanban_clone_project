'use client';

import { LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { CardResultContent, CommentResultContent } from '@/components/search/search-results';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { useBoards } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import {
  cardHref,
  MIN_SEARCH_LENGTH,
  searchApi,
  type CardSearchResult,
  type CommentSearchResult,
} from '@/lib/search';
import { useSearchResults } from '@/lib/use-search';

type Tab = 'cards' | 'comments';

const PAGE_SIZE = 20;
/** Chờ ngần này sau lần gõ cuối mới đổi URL (→ tìm lại) */
const TYPING_DEBOUNCE_MS = 300;

interface Filters {
  q: string;
  tab: Tab;
  boardId: string;
  archived: boolean;
}

/** URL của trang theo bộ lọc — bỏ tham số mặc định cho gọn */
const searchHref = ({ q, tab, boardId, archived }: Filters) => {
  const query = new URLSearchParams({
    ...(q && { q }),
    ...(tab === 'comments' && { type: tab }),
    ...(boardId && { board: boardId }),
    ...(archived && { archived: '1' }),
  }).toString();
  return query ? `/search?${query}` : '/search';
};

// useSearchParams cần nằm trong Suspense để Next.js dựng sẵn được trang
export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}

/**
 * /search?q=...&type=comments&board=...&archived=1 — kết quả đầy đủ của tìm kiếm toàn cục.
 * Bộ lọc nằm trên URL (mở từ "Xem tất cả kết quả" trên header, chia sẻ / quay lại được).
 */
function SearchView() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const router = useRouter();
  const params = useSearchParams();
  const filters: Filters = {
    q: (params.get('q') ?? '').trim(),
    tab: params.get('type') === 'comments' ? 'comments' : 'cards',
    boardId: params.get('board') ?? '',
    archived: params.get('archived') === '1',
  };
  const setFilters = (next: Partial<Filters>) => router.replace(searchHref({ ...filters, ...next }), { scroll: false });

  const boards = useBoards();
  const sortedBoards = useMemo(() => [...boards].sort((a, b) => a.title.localeCompare(b.title, 'vi')), [boards]);

  // Ô nhập: gõ xong mới đổi URL. URL đổi từ nơi khác (vd ô tìm kiếm trên header) → cập nhật ô nhập.
  const [input, setInput] = useState(filters.q);
  useEffect(() => setInput(filters.q), [filters.q]);
  useEffect(() => {
    const value = input.trim();
    if (value === filters.q) return;
    const timer = setTimeout(() => setFilters({ q: value }), TYPING_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, filters.q]); // không đưa setFilters vào: hàm mới mỗi lần render

  const ready = filters.q.length >= MIN_SEARCH_LENGTH;
  const searchParams = { q: filters.q, boardId: filters.boardId || null, archived: filters.archived, limit: PAGE_SIZE };
  const search = useSearchResults(ready ? searchParams : null, 0);
  const pageKey = JSON.stringify(searchParams);

  // "Tải thêm": các trang sau của từng tab, gắn với bộ lọc hiện tại (đổi bộ lọc → bỏ)
  const [more, setMore] = useState<{ key: string; cards: CardSearchResult[]; comments: CommentSearchResult[] }>({
    key: '',
    cards: [],
    comments: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = more.key === pageKey ? more : { key: pageKey, cards: [], comments: [] };
  // Kết quả của bộ lọc cũ (đang tải bộ lọc mới) → coi như chưa có
  const fresh = search.dataKey === pageKey ? search.data : null;
  const cards = fresh?.cards ? [...fresh.cards.items, ...extra.cards] : [];
  const comments = fresh?.comments ? [...fresh.comments.items, ...extra.comments] : [];
  const totals = { cards: fresh?.cards?.total ?? 0, comments: fresh?.comments?.total ?? 0 };
  const shown = filters.tab === 'cards' ? cards.length : comments.length;

  async function loadMore() {
    const tab = filters.tab;
    setLoadingMore(true);
    try {
      const page = await searchApi.search({ ...searchParams, type: tab, offset: shown });
      setMore((prev) => {
        const base = prev.key === pageKey ? prev : { key: pageKey, cards: [], comments: [] };
        if (tab === 'cards') {
          const known = new Set(cards.map((c) => c.id));
          return { ...base, cards: [...base.cards, ...(page.cards?.items ?? []).filter((c) => !known.has(c.id))] };
        }
        const known = new Set(comments.map((c) => c.id));
        return { ...base, comments: [...base.comments, ...(page.comments?.items ?? []).filter((c) => !known.has(c.id))] };
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex">
      <BoardsSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-semibold text-ink">Tìm kiếm</h1>
            <p className="mt-1 text-sm text-ink-subtle">Tìm thẻ (tiêu đề, mô tả) và bình luận trên mọi bảng bạn tham gia.</p>
          </header>

          <label className="relative block">
            <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus={!filters.q}
              placeholder="Nhập từ khoá, vd: thiet ke trang chu"
              aria-label="Từ khoá tìm kiếm"
              className="h-11 w-full rounded-lg bg-card pr-3 pl-10 text-[15px] text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Loại kết quả" className="flex gap-1 rounded-lg bg-surface-low p-1">
              {(['cards', 'comments'] as const).map((tab) => (
                <Link
                  key={tab}
                  href={searchHref({ ...filters, tab })}
                  replace
                  scroll={false}
                  aria-current={filters.tab === tab ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    filters.tab === tab ? 'bg-card text-brand shadow-sm' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  {tab === 'cards' ? 'Thẻ' : 'Bình luận'}
                  {fresh && <span className="ml-1.5 text-xs font-normal text-ink-subtle">{totals[tab]}</span>}
                </Link>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={filters.archived}
                  onChange={(e) => setFilters({ archived: e.target.checked })}
                  className="h-4 w-4 accent-brand"
                />
                Gồm cả thẻ đã lưu trữ
              </label>
              <select
                value={filters.boardId}
                onChange={(e) => setFilters({ boardId: e.target.value })}
                aria-label="Lọc theo bảng"
                className="h-9 max-w-56 rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
              >
                <option value="">Tất cả bảng</option>
                {sortedBoards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!ready ? (
            <Hint>Nhập ít nhất {MIN_SEARCH_LENGTH} ký tự để tìm thẻ và bình luận.</Hint>
          ) : search.error ? (
            <Hint tone="danger">{search.error}</Hint>
          ) : !fresh ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-ink-subtle">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tìm...
            </p>
          ) : shown === 0 ? (
            <Hint>
              Không tìm thấy {filters.tab === 'cards' ? 'thẻ' : 'bình luận'} nào khớp với &quot;{filters.q}&quot;.
              <span className="mt-2 block text-xs">
                Mẹo: mọi từ đều phải có; mỗi từ khớp phần đầu của từ (&quot;thiet k&quot; ra &quot;Thiết kế&quot;, nhưng &quot;iet&quot; thì không)
                {!filters.archived && '; bật "Gồm cả thẻ đã lưu trữ" để tìm cả thẻ đã lưu trữ'}.
              </span>
            </Hint>
          ) : (
            <section aria-label="Kết quả" className="flex flex-col gap-3">
              <ul className="overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_var(--color-hairline)]">
                {filters.tab === 'cards'
                  ? cards.map((card) => (
                      <ResultRow key={card.id} href={cardHref(card.board.id, card.id)}>
                        <CardResultContent card={card} query={filters.q} large />
                      </ResultRow>
                    ))
                  : comments.map((comment) => (
                      <ResultRow key={comment.id} href={cardHref(comment.board.id, comment.card.id)}>
                        <CommentResultContent comment={comment} query={filters.q} large />
                      </ResultRow>
                    ))}
              </ul>
              {shown < totals[filters.tab] && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="mx-auto inline-flex h-9 items-center gap-2 rounded bg-surface-mid px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-high disabled:opacity-60"
                >
                  {loadingMore && <LoaderCircle size={16} className="animate-spin" />}
                  Tải thêm ({totals[filters.tab] - shown})
                </button>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function ResultRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li className="border-b border-surface-low last:border-0">
      <Link href={href} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-low">
        {children}
      </Link>
    </li>
  );
}

function Hint({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <p className={cn('rounded-xl bg-card px-4 py-8 text-center text-sm shadow-[0_0_0_1px_var(--color-hairline)]', tone === 'danger' ? 'text-danger' : 'text-ink-subtle')}>
      {children}
    </p>
  );
}

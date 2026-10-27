'use client';

import { CheckSquare, ChevronDown, Clock, ListTodo, MessageSquare, Paperclip, SquareCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LabelChip } from '@/components/board/card-ui';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { backgroundClass } from '@/lib/board-backgrounds';
import { cardsApi } from '@/lib/boards-api';
import { DUE_STATUS_CLASS, DUE_STATUS_LABEL, dueStatus, formatCardDates } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { groupMyCards, meApi, MY_CARD_GROUPS, type MyCard, type MyCardGroup } from '@/lib/me-api';
import { useRefreshOnReturn } from '@/lib/use-refresh-on-return';

const SELECT =
  'h-8 rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]';

/** Màu chấm đầu mỗi nhóm */
const GROUP_DOT: Record<MyCardGroup, string> = {
  overdue: 'bg-danger',
  today: 'bg-[#f5cd47]',
  week: 'bg-brand',
  later: 'bg-outline',
  noDue: 'bg-surface-highest',
  done: 'bg-success',
};

function useMyCards() {
  const [cards, setCards] = useState<MyCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    meApi.cards().then(
      (list) => {
        setCards(list);
        setError(null);
      },
      (e) => setError(errorMessage(e)),
    );
  }, []);

  useEffect(reload, [reload]);
  useRefreshOnReturn(reload);

  /** Tick hoàn thành ngay trên trang chủ: đổi giao diện trước, lỗi thì trả lại. */
  const setDone = useCallback(async (card: MyCard, dueComplete: boolean) => {
    const update = (value: boolean) => setCards((list) => list?.map((c) => (c.id === card.id ? { ...c, dueComplete: value } : c)) ?? null);
    update(dueComplete);
    try {
      await cardsApi.update(card.id, { dueComplete });
    } catch (e) {
      update(!dueComplete);
      toast.error(errorMessage(e));
    }
  }, []);

  return { cards, error, reload, setDone };
}

/** Trang chủ — thẻ được giao cho tôi từ mọi bảng, nhóm theo hạn chót. */
export function MyCardsSection() {
  const { cards, error, setDone } = useMyCards();
  const [boardId, setBoardId] = useState('');
  const [showDone, setShowDone] = useState(false);

  const boards = useMemo(() => {
    const map = new Map((cards ?? []).map((c) => [c.board.id, c.board.title]));
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [cards]);
  const groups = useMemo(
    () => groupMyCards((cards ?? []).filter((c) => !boardId || c.board.id === boardId)),
    [cards, boardId],
  );
  const openCount = (cards ?? []).filter((c) => !boardId || c.board.id === boardId).length - groups.done.length;

  return (
    <section aria-labelledby="my-cards-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-cards-title" className="flex items-center gap-2 text-base font-semibold text-ink">
          <ListTodo size={20} className="text-ink-subtle" />
          Thẻ của tôi
          {cards && <span className="rounded-full bg-surface-high px-2 text-xs font-semibold text-ink-subtle">{openCount}</span>}
        </h2>
        {boards.length > 1 && (
          <select value={boardId} onChange={(e) => setBoardId(e.target.value)} aria-label="Lọc theo bảng" className={SELECT}>
            <option value="">Tất cả bảng</option>
            {boards.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <p className="rounded-lg bg-danger-soft/40 px-3 py-2 text-sm text-danger">{error}</p>
      ) : !cards ? (
        <div className="flex flex-col gap-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-low" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          {MY_CARD_GROUPS.filter((g) => g.key !== 'done' && groups[g.key].length > 0).map((g) => (
            <CardGroup key={g.key} group={g.key} title={g.title} cards={groups[g.key]} onToggleDone={setDone} />
          ))}
          {openCount === 0 && <p className="text-sm text-ink-subtle">Không còn việc nào đang chờ 🎉</p>}
          {groups.done.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex items-center gap-1.5 self-start rounded px-1 text-sm font-medium text-ink-subtle transition-colors hover:text-ink"
              >
                <ChevronDown size={16} className={cn('transition-transform', !showDone && '-rotate-90')} />
                {showDone ? 'Ẩn' : 'Hiện'} thẻ đã hoàn thành ({groups.done.length})
              </button>
              {showDone && <CardGroup group="done" title="Đã hoàn thành" cards={groups.done} onToggleDone={setDone} />}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-low px-6 py-10 text-center">
      <CheckSquare size={32} className="text-ink-subtle" />
      <p className="font-medium text-ink">Chưa có thẻ nào được giao cho bạn</p>
      <p className="max-w-sm text-sm text-ink-subtle">Khi bạn được thêm vào "Thành viên" của một thẻ, thẻ đó sẽ hiện ở đây — gom từ mọi bảng.</p>
    </div>
  );
}

function CardGroup({
  group,
  title,
  cards,
  onToggleDone,
}: {
  group: MyCardGroup;
  title: string;
  cards: MyCard[];
  onToggleDone: (card: MyCard, done: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <span className={cn('h-2 w-2 rounded-full', GROUP_DOT[group])} aria-hidden />
        {title}
        <span className="font-normal normal-case">({cards.length})</span>
      </h3>
      <ul className="flex flex-col gap-2">
        {cards.map((card) => (
          <MyCardRow key={card.id} card={card} onToggleDone={onToggleDone} />
        ))}
      </ul>
    </div>
  );
}

function MyCardRow({ card, onToggleDone }: { card: MyCard; onToggleDone: (card: MyCard, done: boolean) => void }) {
  const status = dueStatus(card);
  const dates = formatCardDates(card);
  // Người chỉ xem không sửa được thẻ; chưa có hạn chót thì không có gì để "hoàn thành"
  const canTick = card.board.role !== 'VIEWER' && !!card.dueDate;

  return (
    <li className="group relative flex items-stretch overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-transparent transition-shadow hover:shadow-md hover:ring-brand/60">
      <span aria-hidden className={cn('w-1.5 shrink-0 bg-linear-to-b', backgroundClass(card.board.background))} />
      {canTick && (
        <label className="flex shrink-0 cursor-pointer items-start pt-3.5 pl-3" title={card.dueComplete ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}>
          <input
            type="checkbox"
            checked={card.dueComplete}
            onChange={(e) => onToggleDone(card, e.target.checked)}
            aria-label={`Hoàn thành thẻ "${card.title}"`}
            className="h-4 w-4 cursor-pointer accent-success"
          />
        </label>
      )}
      <Link href={`/b/${card.board.id}?card=${encodeURIComponent(card.id)}`} className="min-w-0 flex-1 px-3 py-2.5 outline-none focus-visible:bg-surface-low">
        {card.labels.length > 0 && (
          <span className="mb-1 flex flex-wrap gap-1">
            {card.labels.map((l) => (
              <LabelChip key={l.id} label={l} size="xs" />
            ))}
          </span>
        )}
        <span className={cn('block text-sm font-medium wrap-break-word text-ink', card.dueComplete && 'text-ink-subtle line-through')}>
          {card.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-subtle">
          {card.board.title} · {card.list.title}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-subtle">
          {dates && (
            <span
              title={status ? (DUE_STATUS_LABEL[status] ?? 'Hạn chót') : 'Ngày bắt đầu'}
              className={cn('flex h-6 items-center gap-1 rounded px-1.5', status ? DUE_STATUS_CLASS[status] : 'bg-surface-low')}
            >
              <Clock size={14} aria-hidden />
              {dates}
            </span>
          )}
          {card.checklist.total > 0 && (
            <span
              title="Việc cần làm"
              className={cn('flex h-6 items-center gap-1 rounded px-1.5', card.checklist.done === card.checklist.total && 'bg-success text-white')}
            >
              <SquareCheck size={14} aria-hidden />
              {card.checklist.done}/{card.checklist.total}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="flex h-6 items-center gap-1 px-1" title="Bình luận">
              <MessageSquare size={14} aria-hidden />
              {card.commentCount}
            </span>
          )}
          {card.attachmentCount > 0 && (
            <span className="flex h-6 items-center gap-1 px-1" title="Tệp đính kèm">
              <Paperclip size={14} aria-hidden />
              {card.attachmentCount}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

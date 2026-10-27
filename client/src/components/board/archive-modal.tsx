'use client';

import { Archive, LoaderCircle, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Modal, ModalCloseButton } from '@/components/modal';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { boardsApi, cardsApi, listsApi, type BoardArchive, type BoardDetail, type CardWithList } from '@/lib/boards-api';
import { formatFull, formatRelative } from '@/lib/card-dates';
import { cn } from '@/lib/cn';
import { matchesQuery } from '@/lib/search';
import type { BoardActions } from '@/lib/use-board';
import { resolveCard } from './card-badges';
import { useOpenCard } from './card-detail-modal';
import { LabelChip } from './card-ui';

type Tab = 'cards' | 'lists';

const ROW_BUTTON =
  'flex h-8 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Mục "Đã lưu trữ" của bảng: thẻ lưu trữ riêng lẻ + danh sách đã lưu trữ.
 * Thành viên (MEMBER trở lên) khôi phục / xoá vĩnh viễn được; người xem chỉ xem.
 * Tự tải lại khi bảng thay đổi (vd vừa lưu trữ thêm, người khác khôi phục).
 */
export function ArchiveModal({ board, actions, onClose }: { board: BoardDetail; actions: BoardActions; onClose: () => void }) {
  const canManage = board.role !== 'VIEWER';
  const openCard = useOpenCard();
  const [tab, setTab] = useState<Tab>('cards');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<BoardArchive | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    boardsApi.archive(board.id).then(
      (archive) => {
        setData(archive);
        setError(false);
      },
      () => setError(true),
    );
  }, [board.id]);

  // Lần đầu + mỗi khi bảng đổi (lists đổi tham chiếu sau mỗi lần cập nhật)
  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [load, board.lists]);

  const cards = data?.cards.filter((c) => matchesQuery(`${c.title} ${c.listTitle}`, query)) ?? [];
  const lists = data?.lists.filter((l) => matchesQuery(l.title, query)) ?? [];

  /** Chạy thao tác, lỗi thì toast; xong thì tải lại danh sách lưu trữ. */
  const run = async (task: () => Promise<unknown>, success: string) => {
    try {
      await task();
      toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    load();
  };

  return (
    <Modal label="Mục đã lưu trữ" onClose={onClose} className="max-w-152 p-6">
      <ModalCloseButton onClick={onClose} />
      <h2 className="mb-4 flex items-center gap-2 pr-10 text-xl font-semibold">
        <Archive size={22} className="text-ink-subtle" />
        Mục đã lưu trữ
      </h2>

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'cards' ? 'Tìm thẻ đã lưu trữ...' : 'Tìm danh sách đã lưu trữ...'}
          aria-label="Tìm mục đã lưu trữ"
          className="h-9 w-full rounded bg-card pr-3 pl-9 text-sm shadow-[0_0_0_1px_var(--color-hairline)] outline-none placeholder:text-outline focus:shadow-[0_0_0_2px_var(--color-brand)]"
        />
      </div>

      <div role="tablist" aria-label="Loại mục" className="mb-2 flex gap-5 border-b border-surface-high text-sm font-medium">
        {(
          [
            ['cards', 'Thẻ', data?.cards.length],
            ['lists', 'Danh sách', data?.lists.length],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              '-mb-px border-b-2 pb-2 transition-colors',
              tab === value ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-subtle hover:text-ink',
            )}
          >
            {label}
            {count !== undefined && ` (${count})`}
          </button>
        ))}
      </div>

      <div className="-mx-2 max-h-[55vh] overflow-y-auto px-2">
        {error ? (
          <p className="py-8 text-center text-sm text-ink-subtle">
            Không tải được mục đã lưu trữ.{' '}
            <button type="button" onClick={load} className="font-medium text-brand hover:underline">
              Thử lại
            </button>
          </p>
        ) : !data ? (
          <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-subtle">
            <LoaderCircle size={16} className="animate-spin" />
            Đang tải...
          </p>
        ) : tab === 'cards' ? (
          cards.length === 0 ? (
            <Empty text={query ? 'Không có thẻ nào khớp.' : 'Chưa có thẻ nào được lưu trữ.'} />
          ) : (
            <ul className="flex flex-col gap-2 py-1">
              {cards.map((card) => (
                <ArchivedCardRow
                  key={card.id}
                  card={card}
                  board={board}
                  canManage={canManage}
                  onOpen={() => {
                    onClose();
                    openCard(card.id);
                  }}
                  onRestore={() => run(() => actions.restoreCard(card.id), `Đã khôi phục thẻ "${card.title}"`)}
                  onDelete={() => run(() => cardsApi.remove(card.id), `Đã xoá thẻ "${card.title}"`)}
                />
              ))}
            </ul>
          )
        ) : lists.length === 0 ? (
          <Empty text={query ? 'Không có danh sách nào khớp.' : 'Chưa có danh sách nào được lưu trữ.'} />
        ) : (
          <ul className="flex flex-col py-1">
            {lists.map((list) => (
              <li key={list.id} className="flex items-center gap-3 border-b border-surface-low py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{list.title}</p>
                  <p className="text-xs text-ink-subtle">
                    {list.cardCount} thẻ · lưu trữ{' '}
                    <time dateTime={list.archivedAt ?? undefined} title={list.archivedAt ? formatFull(list.archivedAt) : undefined}>
                      {list.archivedAt ? formatRelative(list.archivedAt) : ''}
                    </time>
                  </p>
                </div>
                {canManage && (
                  <RowActions
                    deleteLabel={`danh sách "${list.title}"${list.cardCount ? ` cùng ${list.cardCount} thẻ` : ''}`}
                    onRestore={() => run(() => actions.restoreList(list.id), `Đã khôi phục danh sách "${list.title}"`)}
                    onDelete={() => run(() => listsApi.remove(list.id), `Đã xoá danh sách "${list.title}"`)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!canManage && <p className="mt-3 text-xs text-ink-subtle">Bạn chỉ có quyền xem bảng này nên không khôi phục / xoá được.</p>}
    </Modal>
  );
}

function ArchivedCardRow({
  card,
  board,
  canManage,
  onOpen,
  onRestore,
  onDelete,
}: {
  card: CardWithList;
  board: BoardDetail;
  canManage: boolean;
  onOpen: () => void;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { labels } = resolveCard(card, board.labels, board.members);
  return (
    <li className="flex items-center gap-3 rounded-lg bg-surface-low p-2.5">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {labels.length > 0 && (
          <span className="mb-1 flex flex-wrap gap-1">
            {labels.map((l) => (
              <LabelChip key={l.id} label={l} size="xs" />
            ))}
          </span>
        )}
        <span className="block truncate text-sm font-medium hover:underline">{card.title}</span>
        <span className="block text-xs text-ink-subtle">
          trong {card.listTitle}
          {card.listArchived && ' (danh sách đã lưu trữ)'} · lưu trữ{' '}
          <time dateTime={card.archivedAt ?? undefined} title={card.archivedAt ? formatFull(card.archivedAt) : undefined}>
            {card.archivedAt ? formatRelative(card.archivedAt) : ''}
          </time>
        </span>
      </button>
      {canManage && <RowActions deleteLabel={`thẻ "${card.title}"`} onRestore={onRestore} onDelete={onDelete} />}
    </li>
  );
}

/** Khôi phục + Xoá (bấm Xoá lần 1 → đổi thành "Xác nhận xoá"). */
function RowActions({
  deleteLabel,
  onRestore,
  onDelete,
}: {
  deleteLabel: string;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const wrap = (task: () => Promise<void>) => async () => {
    setPending(true);
    await task();
    setPending(false);
  };

  return (
    <span className="flex shrink-0 items-center gap-1">
      {confirming ? (
        <>
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={cn(ROW_BUTTON, 'hover:bg-black/5')}>
            Huỷ
          </button>
          <button
            type="button"
            onClick={wrap(onDelete)}
            disabled={pending}
            aria-label={`Xác nhận xoá vĩnh viễn ${deleteLabel}`}
            className={cn(ROW_BUTTON, 'bg-danger text-white hover:opacity-90')}
          >
            <Trash2 size={14} />
            Xác nhận xoá
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={wrap(onRestore)} disabled={pending} className={cn(ROW_BUTTON, 'bg-card text-ink shadow-sm hover:bg-surface-mid')}>
            <RotateCcw size={14} />
            Khôi phục
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending}
            aria-label={`Xoá vĩnh viễn ${deleteLabel}`}
            title="Xoá vĩnh viễn"
            className={cn(ROW_BUTTON, 'px-2 text-danger hover:bg-danger-soft/40')}
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-mid text-ink-subtle">
        <Archive size={22} />
      </span>
      <p className="text-sm text-ink-subtle">{text}</p>
    </div>
  );
}

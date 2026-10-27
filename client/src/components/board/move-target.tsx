'use client';

import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { boardsApi, type BoardDetail, type ListSummary } from '@/lib/boards-api';
import { useBoards } from '@/lib/boards-store';

/** Ô chọn trong các popover di chuyển / sao chép */
export const SELECT_CLASS =
  'h-9 w-full rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)] disabled:bg-surface-low disabled:text-ink-subtle';

export interface TargetBoard {
  id: string;
  title: string;
}

/** Bảng có thể chọn làm đích: bảng đang mở trước, rồi các bảng mình có quyền sửa (A → Z). */
export function useTargetBoards(current: BoardDetail): TargetBoard[] {
  const boards = useBoards();
  return useMemo(
    () => [
      { id: current.id, title: current.title },
      ...boards
        .filter((b) => b.id !== current.id && b.role !== 'VIEWER')
        .sort((a, b) => a.title.localeCompare(b.title, 'vi'))
        .map((b) => ({ id: b.id, title: b.title })),
    ],
    [boards, current.id, current.title],
  );
}

/**
 * Danh sách của bảng đích. Bảng đang mở: lấy ngay từ dữ liệu có sẵn.
 * Bảng khác: tải bản rút gọn qua API (tên + số thẻ).
 */
export function useTargetLists(boardId: string, current: BoardDetail) {
  const [remote, setRemote] = useState<{ boardId: string; lists: ListSummary[] | null; error: string | null }>({
    boardId: '',
    lists: null,
    error: null,
  });
  const sameBoard = boardId === current.id;

  useEffect(() => {
    if (sameBoard) return;
    let cancelled = false;
    setRemote({ boardId, lists: null, error: null });
    boardsApi.lists(boardId).then(
      (lists) => !cancelled && setRemote({ boardId, lists, error: null }),
      (e) => !cancelled && setRemote({ boardId, lists: null, error: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [boardId, sameBoard]);

  if (sameBoard) {
    return {
      lists: current.lists.map((l) => ({ id: l.id, title: l.title, cardCount: l.cards.length })),
      loading: false,
      error: null,
    };
  }
  const ready = remote.boardId === boardId;
  return {
    lists: ready ? remote.lists : null,
    loading: !ready || (!remote.lists && !remote.error),
    error: ready ? remote.error : null,
  };
}

/** Ô chọn bảng đích. */
export function BoardSelect({
  boards,
  value,
  currentId,
  onChange,
}: {
  boards: TargetBoard[];
  value: string;
  currentId: string;
  onChange: (boardId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-subtle">
      Bảng
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLASS}>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
            {b.id === currentId ? ' (hiện tại)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

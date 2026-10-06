'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from './api';
import type { BoardBackground } from './board-backgrounds';
import { boardsApi, cardsApi, listsApi, toSummary, type BoardDetail, type Card, type List } from './boards-api';
import { boardsStore } from './boards-store';

type Status = 'loading' | 'ready' | 'not-found' | 'error';

const mapList = (board: BoardDetail, listId: string, fn: (list: List) => List): BoardDetail => ({
  ...board,
  lists: board.lists.map((l) => (l.id === listId ? fn(l) : l)),
});

const mapCard = (board: BoardDetail, cardId: string, fn: (card: Card) => Card): BoardDetail => ({
  ...board,
  lists: board.lists.map((l) => ({ ...l, cards: l.cards.map((c) => (c.id === cardId ? fn(c) : c)) })),
});

/**
 * Tải 1 board kèm list/card và cung cấp các thao tác chỉnh sửa.
 * Sửa/xoá: đổi giao diện ngay rồi gọi API, lỗi thì hoàn tác + toast.
 * Thêm mới: chờ API trả về (cần id thật) rồi mới hiển thị; lỗi ném ra cho nơi gọi xử lý.
 */
export function useBoard(boardId: string) {
  const [board, setBoardState] = useState<BoardDetail | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Luôn giữ bản mới nhất để chụp lại trước khi sửa (phục vụ hoàn tác)
  const boardRef = useRef<BoardDetail | null>(null);

  const commit = useCallback((next: BoardDetail | null) => {
    boardRef.current = next;
    setBoardState(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    boardsApi
      .get(boardId)
      .then((detail) => {
        if (cancelled) return;
        commit(detail);
        setStatus('ready');
        // Đồng bộ "vừa xem", tên, sao... vào danh sách bảng
        boardsStore.upsert(toSummary(detail));
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setStatus('not-found');
        } else {
          setError(errorMessage(e));
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [boardId, reloadKey, commit]);

  /** Áp thay đổi lên giao diện ngay, gọi API; lỗi → trả lại trạng thái trước đó. */
  const optimistic = useCallback(
    async (change: (b: BoardDetail) => BoardDetail, request: () => Promise<unknown>) => {
      const snapshot = boardRef.current;
      if (!snapshot) return;
      commit(change(snapshot));
      try {
        await request();
      } catch (e) {
        commit(snapshot);
        toast.error(errorMessage(e));
      }
    },
    [commit],
  );

  const actions = useMemo(
    () => ({
      reload: () => setReloadKey((k) => k + 1),

      /** Cập nhật cục bộ trạng thái sao (nút sao tự gọi API qua boardsStore). */
      setStarredLocal: (starred: boolean) => {
        if (boardRef.current) commit({ ...boardRef.current, starred });
      },

      updateBoard: (input: { title?: string; background?: BoardBackground }) =>
        optimistic(
          (b) => ({ ...b, ...input }),
          async () => boardsStore.upsert(await boardsApi.update(boardId, input)),
        ),

      deleteBoard: async () => {
        await boardsApi.remove(boardId);
        boardsStore.remove(boardId);
      },

      addList: async (title: string) => {
        const list = await listsApi.create(boardId, title);
        const current = boardRef.current;
        if (current) commit({ ...current, lists: [...current.lists, list] });
      },

      renameList: (listId: string, title: string) =>
        optimistic(
          (b) => mapList(b, listId, (l) => ({ ...l, title })),
          () => listsApi.rename(listId, title),
        ),

      deleteList: (listId: string) =>
        optimistic(
          (b) => ({ ...b, lists: b.lists.filter((l) => l.id !== listId) }),
          () => listsApi.remove(listId),
        ),

      addCard: async (listId: string, title: string) => {
        const card = await cardsApi.create(listId, title);
        const current = boardRef.current;
        if (current) commit(mapList(current, listId, (l) => ({ ...l, cards: [...l.cards, card] })));
      },

      updateCard: (cardId: string, input: { title?: string; description?: string | null }) =>
        optimistic(
          (b) => mapCard(b, cardId, (c) => ({ ...c, ...input })),
          () => cardsApi.update(cardId, input),
        ),

      deleteCard: (cardId: string) =>
        optimistic(
          (b) => ({ ...b, lists: b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })) }),
          () => cardsApi.remove(cardId),
        ),
    }),
    [boardId, commit, optimistic],
  );

  return { board, status, error, actions };
}

export type BoardActions = ReturnType<typeof useBoard>['actions'];

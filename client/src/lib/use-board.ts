'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from './api';
import type { BoardBackground } from './board-backgrounds';
import {
  boardsApi,
  cardsApi,
  checklistsApi,
  joinRequestsApi,
  labelsApi,
  listsApi,
  membersApi,
  toSummary,
  type BoardDetail,
  type BoardMember,
  type BoardRole,
  type Card,
  type CardInput,
  type Checklist,
  type ChecklistItem,
  type List,
} from './boards-api';
import { boardsStore } from './boards-store';
import type { LabelColor } from './labels';

type Status = 'loading' | 'ready' | 'not-found' | 'error';

const mapList = (board: BoardDetail, listId: string, fn: (list: List) => List): BoardDetail => ({
  ...board,
  lists: board.lists.map((l) => (l.id === listId ? fn(l) : l)),
});

/** Quyền đã bị đổi (403) hoặc bị xoá khỏi bảng / dữ liệu đã bị xoá (404) */
const isAccessError = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 404);

const mapCard = (board: BoardDetail, cardId: string, fn: (card: Card) => Card): BoardDetail => ({
  ...board,
  lists: board.lists.map((l) => ({ ...l, cards: l.cards.map((c) => (c.id === cardId ? fn(c) : c)) })),
});

/** Áp `fn` cho mọi thẻ của bảng (vd gỡ 1 nhãn / 1 thành viên khỏi tất cả). */
const mapAllCards = (board: BoardDetail, fn: (card: Card) => Card): BoardDetail => ({
  ...board,
  lists: board.lists.map((l) => ({ ...l, cards: l.cards.map(fn) })),
});

const mapChecklist = (board: BoardDetail, checklistId: string, fn: (checklist: Checklist) => Checklist) =>
  mapAllCards(board, (c) =>
    c.checklists.some((cl) => cl.id === checklistId)
      ? { ...c, checklists: c.checklists.map((cl) => (cl.id === checklistId ? fn(cl) : cl)) }
      : c,
  );

const mapChecklistItem = (board: BoardDetail, itemId: string, fn: (item: ChecklistItem) => ChecklistItem) =>
  mapAllCards(board, (c) =>
    c.checklists.some((cl) => cl.items.some((i) => i.id === itemId))
      ? {
          ...c,
          checklists: c.checklists.map((cl) => ({ ...cl, items: cl.items.map((i) => (i.id === itemId ? fn(i) : i)) })),
        }
      : c,
  );

/** Thêm / bỏ `value` khỏi mảng id (không trùng lặp). */
const toggleId = (ids: string[], value: string, on: boolean) =>
  on ? (ids.includes(value) ? ids : [...ids, value]) : ids.filter((id) => id !== value);

/**
 * Tải 1 board kèm list/card và cung cấp các thao tác chỉnh sửa.
 * Sửa/xoá: đổi giao diện ngay rồi gọi API, lỗi thì hoàn tác + toast.
 * Thêm mới: chờ API trả về (cần id thật) rồi mới hiển thị; lỗi ném ra cho nơi gọi xử lý.
 * Lỗi 403/404 khi thao tác → tải lại bảng để giao diện khớp quyền hiện tại (bị hạ quyền, bị xoá khỏi bảng...).
 */
export function useBoard(boardId: string) {
  const meId = useAuth().user?.id;
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
          boardsStore.remove(boardId);
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

  /** Tải lại ngầm từ server. Không còn là thành viên → màn "Không tìm thấy bảng". */
  const resync = useCallback(() => {
    boardsApi
      .get(boardId)
      .then((detail) => {
        commit(detail);
        boardsStore.upsert(toSummary(detail));
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          boardsStore.remove(boardId);
          setStatus('not-found');
        }
      });
  }, [boardId, commit]);

  /** Đồng bộ thành viên / vai trò mới nhất sang danh sách bảng (trang /boards). */
  const syncSummary = useCallback(() => {
    if (boardRef.current) boardsStore.upsert(toSummary(boardRef.current));
  }, []);

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
        if (isAccessError(e)) resync();
      }
    },
    [commit, resync],
  );

  /** Thêm mới thất bại vì quyền → tải lại; lỗi vẫn ném ra cho nơi gọi hiển thị. */
  const create = useCallback(
    async <T,>(request: () => Promise<T>) => {
      try {
        return await request();
      } catch (e) {
        if (isAccessError(e)) resync();
        throw e;
      }
    },
    [resync],
  );

  /** Thêm thành viên vừa vào bảng vào giao diện + danh sách bảng. */
  const addMember = useCallback(
    (member: BoardMember) => {
      const current = boardRef.current;
      if (current) {
        commit({ ...current, members: [...current.members.filter((m) => m.id !== member.id), member] });
        syncSummary();
      }
      return member;
    },
    [commit, syncSummary],
  );

  /** Kéo thả thất bại: trả về thứ tự cũ ngay, rồi tải lại ngầm từ server để chắc chắn khớp DB. */
  const rollbackMove = useCallback(
    (rollback: List[], e: unknown) => {
      if (boardRef.current) commit({ ...boardRef.current, lists: rollback });
      toast.error(errorMessage(e));
      resync();
    },
    [commit, resync],
  );

  const actions = useMemo(
    () => ({
      reload: () => setReloadKey((k) => k + 1),

      /** Kéo thả: hiển thị thứ tự tạm trong lúc đang kéo (chưa gọi API). */
      previewLists: (lists: List[]) => {
        if (boardRef.current) commit({ ...boardRef.current, lists });
      },

      /** Thả danh sách — giao diện đã ở thứ tự mới; `rollback` là thứ tự trước khi kéo. */
      persistListMove: async (listId: string, index: number, rollback: List[]) => {
        try {
          await listsApi.move(listId, index);
        } catch (e) {
          rollbackMove(rollback, e);
        }
      },

      /** Thả thẻ — tương tự, có thể sang danh sách khác. */
      persistCardMove: async (cardId: string, listId: string, index: number, rollback: List[]) => {
        try {
          await cardsApi.move(cardId, listId, index);
        } catch (e) {
          rollbackMove(rollback, e);
        }
      },

      /** Chuyển thẻ bằng menu "Di chuyển" (không kéo thả): `index` không tính chính thẻ đó. */
      moveCard: async (cardId: string, listId: string, index: number) => {
        const current = boardRef.current;
        const card = current?.lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
        if (!current || !card) return;
        const rollback = current.lists;
        const without = rollback.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) }));
        const target = without.find((l) => l.id === listId);
        if (!target) return;
        const at = Math.min(index, target.cards.length);
        if (card.listId === listId && rollback.find((l) => l.id === listId)?.cards[at]?.id === cardId) return;
        const cards = [...target.cards];
        cards.splice(at, 0, { ...card, listId });
        commit({ ...current, lists: without.map((l) => (l.id === listId ? { ...l, cards } : l)) });
        try {
          await cardsApi.move(cardId, listId, at);
        } catch (e) {
          rollbackMove(rollback, e);
        }
      },

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
        const list = await create(() => listsApi.create(boardId, title));
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
        const card = await create(() => cardsApi.create(listId, title));
        const current = boardRef.current;
        if (current) commit(mapList(current, listId, (l) => ({ ...l, cards: [...l.cards, card] })));
      },

      /** Sửa tiêu đề, mô tả, ngày. Xoá hạn chót thì bỏ luôn "hoàn thành" (giống server). */
      updateCard: (cardId: string, input: CardInput) =>
        optimistic(
          (b) =>
            mapCard(b, cardId, (c) => {
              const next = { ...c, ...input };
              return next.dueDate ? next : { ...next, dueComplete: false };
            }),
          () => cardsApi.update(cardId, input),
        ),

      /** Gắn / gỡ nhãn của thẻ. */
      setCardLabel: (cardId: string, labelId: string, on: boolean) =>
        optimistic(
          (b) => mapCard(b, cardId, (c) => ({ ...c, labelIds: toggleId(c.labelIds, labelId, on) })),
          () => cardsApi.setLabel(cardId, labelId, on),
        ),

      /** Giao / bỏ giao thẻ cho 1 thành viên của bảng. */
      setCardMember: (cardId: string, userId: string, on: boolean) =>
        optimistic(
          (b) => mapCard(b, cardId, (c) => ({ ...c, memberIds: toggleId(c.memberIds, userId, on) })),
          () => cardsApi.setMember(cardId, userId, on),
        ),

      /** Tạo nhãn — chờ API (cần id thật); lỗi ném ra để hiện trong popover. */
      createLabel: async (input: { name: string; color: LabelColor }) => {
        const label = await create(() => labelsApi.create(boardId, input));
        const current = boardRef.current;
        if (current) commit({ ...current, labels: [...current.labels, label] });
        return label;
      },

      updateLabel: (labelId: string, input: { name?: string; color?: LabelColor }) =>
        optimistic(
          (b) => ({ ...b, labels: b.labels.map((l) => (l.id === labelId ? { ...l, ...input } : l)) }),
          () => labelsApi.update(labelId, input),
        ),

      /** Xoá nhãn khỏi bảng — đồng thời gỡ khỏi mọi thẻ. */
      deleteLabel: (labelId: string) =>
        optimistic(
          (b) =>
            mapAllCards({ ...b, labels: b.labels.filter((l) => l.id !== labelId) }, (c) =>
              c.labelIds.includes(labelId) ? { ...c, labelIds: c.labelIds.filter((id) => id !== labelId) } : c,
            ),
          () => labelsApi.remove(labelId),
        ),

      addChecklist: async (cardId: string, title: string) => {
        const checklist = await create(() => checklistsApi.create(cardId, title));
        const current = boardRef.current;
        if (current) commit(mapCard(current, cardId, (c) => ({ ...c, checklists: [...c.checklists, checklist] })));
        return checklist;
      },

      renameChecklist: (checklistId: string, title: string) =>
        optimistic(
          (b) => mapChecklist(b, checklistId, (cl) => ({ ...cl, title })),
          () => checklistsApi.rename(checklistId, title),
        ),

      deleteChecklist: (checklistId: string) =>
        optimistic(
          (b) => mapAllCards(b, (c) => ({ ...c, checklists: c.checklists.filter((cl) => cl.id !== checklistId) })),
          () => checklistsApi.remove(checklistId),
        ),

      addChecklistItem: async (checklistId: string, title: string) => {
        const item = await create(() => checklistsApi.addItem(checklistId, title));
        const current = boardRef.current;
        if (current) commit(mapChecklist(current, checklistId, (cl) => ({ ...cl, items: [...cl.items, item] })));
      },

      updateChecklistItem: (itemId: string, input: { title?: string; completed?: boolean }) =>
        optimistic(
          (b) => mapChecklistItem(b, itemId, (i) => ({ ...i, ...input })),
          () => checklistsApi.updateItem(itemId, input),
        ),

      deleteChecklistItem: (itemId: string) =>
        optimistic(
          (b) =>
            mapAllCards(b, (c) => ({
              ...c,
              checklists: c.checklists.map((cl) => ({ ...cl, items: cl.items.filter((i) => i.id !== itemId) })),
            })),
          () => checklistsApi.removeItem(itemId),
        ),

      deleteCard: (cardId: string) =>
        optimistic(
          (b) => ({ ...b, lists: b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })) }),
          () => cardsApi.remove(cardId),
        ),

      /** Mời theo email — chờ API (cần dữ liệu thật); lỗi ném ra để hiện dưới ô nhập. */
      inviteMember: async (email: string, role: BoardRole) => addMember(await create(() => membersApi.invite(boardId, email, role))),

      /** Duyệt yêu cầu tham gia — lỗi ném ra (vd ADMIN khác vừa duyệt / từ chối trước). */
      approveJoinRequest: async (userId: string, role: BoardRole) =>
        addMember(await create(() => joinRequestsApi.approve(boardId, userId, role))),

      /** Đổi vai trò; đổi của chính mình thì quyền trên giao diện đổi theo ngay. */
      changeMemberRole: (userId: string, role: BoardRole) =>
        optimistic(
          (b) => ({
            ...b,
            role: userId === meId ? role : b.role,
            members: b.members.map((m) => (m.id === userId ? { ...m, role } : m)),
          }),
          async () => {
            await membersApi.updateRole(boardId, userId, role);
            syncSummary();
          },
        ),

      /** Xoá thành viên — server gỡ người đó khỏi mọi thẻ nên giao diện cũng gỡ theo. */
      removeMember: (userId: string) =>
        optimistic(
          (b) =>
            mapAllCards({ ...b, members: b.members.filter((m) => m.id !== userId) }, (c) =>
              c.memberIds.includes(userId) ? { ...c, memberIds: c.memberIds.filter((id) => id !== userId) } : c,
            ),
          async () => {
            await membersApi.remove(boardId, userId);
            syncSummary();
          },
        ),

      /** Rời bảng — chờ API rồi mới bỏ bảng khỏi danh sách; lỗi ném ra (vd ADMIN cuối cùng). */
      leaveBoard: async () => {
        if (!meId) return;
        await membersApi.remove(boardId, meId);
        boardsStore.remove(boardId);
      },
    }),
    [boardId, meId, addMember, commit, create, optimistic, rollbackMove, syncSummary],
  );

  return { board, status, error, actions };
}

export type BoardActions = ReturnType<typeof useBoard>['actions'];

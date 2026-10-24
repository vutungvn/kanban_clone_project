'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { toast } from '@/components/toast';
import { ApiError, errorMessage } from './api';
import type { BoardBackground } from './board-backgrounds';
import {
  attachmentsApi,
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
  type CopyCardInput,
  type CoverInput,
  type ListSort,
  type Checklist,
  type ChecklistItem,
  type List,
} from './boards-api';
import { boardsStore } from './boards-store';
import { sortCards } from './card-sort';
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

  /**
   * Đồng bộ với thay đổi từ người khác (realtime) mà không giẫm lên thao tác của chính mình:
   * - pending: số request của mình đang chạy; ops: tổng số thao tác đã bắt đầu
   * - held: đang kéo thả (giao diện đang ở thứ tự tạm)
   * - stale: có thay đổi trên server chưa tải về (vì đang bận) → tải khi rảnh
   */
  const sync = useRef({
    pending: 0,
    ops: 0,
    held: false,
    stale: false,
    seq: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  /** Tải lại ngầm từ server. Không còn là thành viên → màn "Không tìm thấy bảng". */
  const resync = useCallback(
    function run() {
      const s = sync.current;
      const seq = ++s.seq;
      const ops = s.ops;
      boardsApi
        .get(boardId)
        .then((detail) => {
          if (seq !== s.seq) return; // đã có lần tải mới hơn
          // Trong lúc tải mình lại thao tác → dữ liệu này có thể thiếu thao tác đó → bỏ, tải lại khi rảnh
          if (s.ops !== ops || s.pending > 0 || s.held) {
            s.stale = true;
            if (s.pending === 0 && !s.held) run();
            return;
          }
          s.stale = false;
          commit(detail);
          boardsStore.upsert(toSummary(detail));
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 404) {
            boardsStore.remove(boardId);
            setStatus('not-found');
          }
        });
    },
    [boardId, commit],
  );

  /** Bắt đầu / kết thúc 1 request của mình. Xong hết mà có thay đổi đang chờ → tải lại. */
  const begin = useCallback(() => {
    sync.current.pending++;
    sync.current.ops++;
  }, []);
  const end = useCallback(() => {
    const s = sync.current;
    s.pending--;
    if (s.pending === 0 && !s.held && s.stale) resync();
  }, [resync]);

  useEffect(() => {
    const s = sync.current;
    return () => clearTimeout(s.timer);
  }, []);

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
      begin();
      try {
        await request();
      } catch (e) {
        commit(snapshot);
        toast.error(errorMessage(e));
        if (isAccessError(e)) resync();
      } finally {
        end();
      }
    },
    [begin, commit, end, resync],
  );

  /** Thêm mới thất bại vì quyền → tải lại; lỗi vẫn ném ra cho nơi gọi hiển thị. */
  const create = useCallback(
    async <T,>(request: () => Promise<T>) => {
      begin();
      try {
        return await request();
      } catch (e) {
        if (isAccessError(e)) resync();
        throw e;
      } finally {
        end();
      }
    },
    [begin, end, resync],
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

      /** Tải lại ngầm (không hiện màn tải) — vd thao tác ngoài useBoard gặp 403/404. */
      resync,

      /** Realtime: người khác vừa sửa bảng → tải lại (gom các sự kiện dồn dập; đang bận thì để sau). */
      remoteChanged: () => {
        const s = sync.current;
        clearTimeout(s.timer);
        s.timer = setTimeout(() => {
          if (s.pending > 0 || s.held) s.stale = true;
          else resync();
        }, 250);
      },

      /** Kéo thả: giữ nguyên giao diện trong lúc kéo; thả xong mới áp thay đổi từ người khác. */
      holdSync: (held: boolean) => {
        const s = sync.current;
        s.held = held;
        // Chờ request lưu vị trí kịp bắt đầu (được gọi ngay lúc thả) rồi mới xét
        if (!held) setTimeout(() => s.pending === 0 && !s.held && s.stale && resync(), 0);
      },

      /** Bình luận do useCardActivity gọi API riêng → chỉ cập nhật số bình luận trên thẻ. */
      changeCommentCount: (cardId: string, delta: number) => {
        const current = boardRef.current;
        if (current) commit(mapCard(current, cardId, (c) => ({ ...c, commentCount: Math.max(0, c.commentCount + delta) })));
      },

      /** Kéo thả: hiển thị thứ tự tạm trong lúc đang kéo (chưa gọi API). */
      previewLists: (lists: List[]) => {
        if (boardRef.current) commit({ ...boardRef.current, lists });
      },

      /** Thả danh sách — giao diện đã ở thứ tự mới; `rollback` là thứ tự trước khi kéo. */
      persistListMove: async (listId: string, index: number, rollback: List[]) => {
        begin();
        try {
          await listsApi.move(listId, index);
        } catch (e) {
          rollbackMove(rollback, e);
        } finally {
          end();
        }
      },

      /** Thả thẻ — tương tự, có thể sang danh sách khác. */
      persistCardMove: async (cardId: string, listId: string, index: number, rollback: List[]) => {
        begin();
        try {
          await cardsApi.move(cardId, listId, index);
        } catch (e) {
          rollbackMove(rollback, e);
        } finally {
          end();
        }
      },

      /**
       * Chuyển thẻ bằng menu "Di chuyển" (không kéo thả): `index` không tính chính thẻ đó.
       * `listId` thuộc bảng khác → thẻ biến khỏi bảng này. Trả về false nếu lỗi (đã hoàn tác + toast).
       */
      moveCard: async (cardId: string, listId: string, index: number) => {
        const current = boardRef.current;
        const card = current?.lists.flatMap((l) => l.cards).find((c) => c.id === cardId);
        if (!current || !card) return false;
        const rollback = current.lists;
        const without = rollback.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) }));
        const target = without.find((l) => l.id === listId);
        let at = index;
        if (target) {
          at = Math.min(index, target.cards.length);
          if (card.listId === listId && rollback.find((l) => l.id === listId)?.cards[at]?.id === cardId) return true;
          const cards = [...target.cards];
          cards.splice(at, 0, { ...card, listId });
          commit({ ...current, lists: without.map((l) => (l.id === listId ? { ...l, cards } : l)) });
        } else {
          commit({ ...current, lists: without }); // sang bảng khác
        }
        begin();
        try {
          await cardsApi.move(cardId, listId, at);
          return true;
        } catch (e) {
          rollbackMove(rollback, e);
          return false;
        } finally {
          end();
        }
      },

      /**
       * Di chuyển danh sách bằng menu: cùng bảng → đổi vị trí (`index` không tính chính nó);
       * bảng khác → danh sách (kèm thẻ) biến khỏi bảng này. Trả về false nếu lỗi.
       */
      moveList: async (listId: string, boardId: string, index: number) => {
        const current = boardRef.current;
        const list = current?.lists.find((l) => l.id === listId);
        if (!current || !list) return false;
        const rollback = current.lists;
        const others = rollback.filter((l) => l.id !== listId);
        const sameBoard = boardId === current.id;
        if (sameBoard) {
          const lists = [...others];
          lists.splice(Math.min(index, lists.length), 0, list);
          if (lists.every((l, i) => l.id === rollback[i].id)) return true;
          commit({ ...current, lists });
        } else {
          commit({ ...current, lists: others });
        }
        begin();
        try {
          await listsApi.move(listId, index, sameBoard ? undefined : boardId);
          return true;
        } catch (e) {
          rollbackMove(rollback, e);
          return false;
        } finally {
          end();
        }
      },

      /** Sắp xếp thẻ trong danh sách (một lần, lưu thứ tự mới). */
      sortList: (listId: string, by: ListSort) =>
        optimistic(
          (b) => mapList(b, listId, (l) => ({ ...l, cards: sortCards(l.cards, by) })),
          () => listsApi.sort(listId, by),
        ),

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

      /**
       * Đính kèm tệp — chờ API (cần id thật), `onProgress` báo tiến độ gửi lên. Lấy danh sách tệp + ảnh bìa
       * từ thẻ server trả về (ảnh đầu tiên có thể vừa thành ảnh bìa). Lỗi ném ra cho nơi gọi.
       */
      uploadAttachment: async (cardId: string, file: File, onProgress?: (fraction: number) => void) => {
        const { attachment, card } = await create(() => attachmentsApi.upload(cardId, file, onProgress));
        const current = boardRef.current;
        if (current) {
          commit(
            mapCard(current, cardId, (c) => ({
              ...c,
              attachments: card.attachments,
              coverColor: card.coverColor,
              coverAttachmentId: card.coverAttachmentId,
            })),
          );
        }
        return attachment;
      },

      renameAttachment: (attachmentId: string, name: string) =>
        optimistic(
          (b) =>
            mapAllCards(b, (c) =>
              c.attachments.some((a) => a.id === attachmentId)
                ? { ...c, attachments: c.attachments.map((a) => (a.id === attachmentId ? { ...a, name } : a)) }
                : c,
            ),
          () => attachmentsApi.rename(attachmentId, name),
        ),

      /** Xoá tệp; đang là ảnh bìa thì thẻ hết ảnh bìa (giống server). */
      deleteAttachment: (attachmentId: string) =>
        optimistic(
          (b) =>
            mapAllCards(b, (c) =>
              c.attachments.some((a) => a.id === attachmentId)
                ? {
                    ...c,
                    attachments: c.attachments.filter((a) => a.id !== attachmentId),
                    coverAttachmentId: c.coverAttachmentId === attachmentId ? null : c.coverAttachmentId,
                  }
                : c,
            ),
          () => attachmentsApi.remove(attachmentId),
        ),

      /** Đặt / gỡ ảnh bìa (màu hoặc ảnh đính kèm — không có cả hai). */
      setCardCover: (cardId: string, cover: CoverInput) =>
        optimistic(
          (b) =>
            mapCard(b, cardId, (c) => ({
              ...c,
              coverColor: cover && 'color' in cover ? cover.color : null,
              coverAttachmentId: cover && 'attachmentId' in cover ? cover.attachmentId : null,
            })),
          () => cardsApi.setCover(cardId, cover),
        ),

      /** Lưu trữ thẻ: biến khỏi bảng ngay (vẫn mở được qua link / mục "Đã lưu trữ"). */
      archiveCard: (cardId: string) =>
        optimistic(
          (b) => ({ ...b, lists: b.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })) }),
          () => cardsApi.setArchived(cardId, true),
        ),

      /** Khôi phục thẻ: chờ API rồi tải lại bảng (thẻ về đúng vị trí cũ). Lỗi ném ra cho nơi gọi. */
      restoreCard: async (cardId: string) => {
        await create(() => cardsApi.setArchived(cardId, false));
        resync();
      },

      /** Sao chép thẻ — chờ API (cần id thật) rồi chèn vào đúng vị trí. Lỗi ném ra để hiện trong popover. */
      copyCard: async (cardId: string, input: CopyCardInput) => {
        const card = await create(() => cardsApi.copy(cardId, input));
        const current = boardRef.current;
        if (current) {
          commit(
            mapList(current, input.listId, (l) => {
              const cards = [...l.cards];
              cards.splice(Math.min(input.index, cards.length), 0, card);
              return { ...l, cards };
            }),
          );
        }
        return card;
      },

      archiveList: (listId: string) =>
        optimistic(
          (b) => ({ ...b, lists: b.lists.filter((l) => l.id !== listId) }),
          () => listsApi.setArchived(listId, true),
        ),

      restoreList: async (listId: string) => {
        await create(() => listsApi.setArchived(listId, false));
        resync();
      },

      /** Lưu trữ mọi thẻ trong danh sách (danh sách vẫn giữ). */
      archiveAllCards: (listId: string) =>
        optimistic(
          (b) => mapList(b, listId, (l) => ({ ...l, cards: [] })),
          () => listsApi.archiveCards(listId),
        ),

      /** Sao chép danh sách — bản sao (kèm thẻ) nằm ngay bên phải bản gốc. */
      copyList: async (listId: string, title: string) => {
        const list = await create(() => listsApi.copy(listId, title));
        const current = boardRef.current;
        if (current) {
          const lists = [...current.lists];
          const at = lists.findIndex((l) => l.id === listId);
          lists.splice(at < 0 ? lists.length : at + 1, 0, list);
          commit({ ...current, lists });
        }
        return list;
      },

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
    [boardId, meId, addMember, begin, commit, create, end, optimistic, resync, rollbackMove, syncSummary],
  );

  return { board, status, error, actions };
}

export type BoardActions = ReturnType<typeof useBoard>['actions'];

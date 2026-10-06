import { useEffect, useSyncExternalStore } from 'react';
import { errorMessage } from './api';
import { boardsApi, type BoardInput, type BoardSummary } from './boards-api';

export type { BoardSummary } from './boards-api';

/*
 * Danh sách bảng của user, dùng chung cho trang /boards, ô tìm kiếm trên header...
 * Tải 1 lần rồi giữ trong bộ nhớ; các thao tác (tạo, gắn sao, đổi tên, xoá) cập nhật
 * vào đây để mọi nơi hiển thị đồng bộ mà không phải tải lại.
 */

interface BoardsState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  boards: BoardSummary[];
  error: string | null;
}

const INITIAL: BoardsState = { status: 'idle', boards: [], error: null };

let state: BoardsState = INITIAL;
let loading: Promise<void> | null = null;
/** Tăng mỗi lần reset → bỏ qua kết quả tải của phiên đăng nhập trước */
let generation = 0;
const listeners = new Set<() => void>();

function setState(patch: Partial<BoardsState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function setBoards(update: (boards: BoardSummary[]) => BoardSummary[]) {
  setState({ boards: update(state.boards) });
}

export const boardsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: () => state,

  /** Tải danh sách nếu chưa có (force = tải lại). */
  load(force = false): Promise<void> {
    if (loading) return loading;
    if (state.status === 'ready' && !force) return Promise.resolve();

    const gen = generation;
    if (state.status !== 'ready') setState({ status: 'loading', error: null });
    loading = boardsApi
      .list()
      .then((boards) => {
        if (gen === generation) setState({ status: 'ready', boards, error: null });
      })
      .catch((e) => {
        if (gen === generation) setState({ status: 'error', error: errorMessage(e) });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  },

  /** Xoá dữ liệu khi đăng nhập / đăng xuất — tránh lộ bảng của tài khoản trước. */
  reset() {
    generation++;
    loading = null;
    state = INITIAL;
    listeners.forEach((listener) => listener());
  },

  async create(input: BoardInput) {
    const board = await boardsApi.create(input);
    boardsStore.upsert(board);
    return board;
  },

  /** Đổi giao diện ngay, gọi API sau; lỗi thì trả lại như cũ và ném lỗi ra ngoài. */
  async setStarred(id: string, starred: boolean) {
    setBoards((boards) => boards.map((b) => (b.id === id ? { ...b, starred } : b)));
    try {
      await boardsApi.setStarred(id, starred);
    } catch (e) {
      setBoards((boards) => boards.map((b) => (b.id === id ? { ...b, starred: !starred } : b)));
      throw e;
    }
  },

  /** Thêm mới hoặc cập nhật 1 bảng (vd sau khi đổi tên, hoặc vừa mở trang chi tiết). */
  upsert(board: BoardSummary) {
    setBoards((boards) =>
      boards.some((b) => b.id === board.id)
        ? boards.map((b) => (b.id === board.id ? { ...b, ...board } : b))
        : [board, ...boards],
    );
  },

  remove(id: string) {
    setBoards((boards) => boards.filter((b) => b.id !== id));
  },
};

/** Sắp xếp: mở gần đây nhất lên trước (chưa mở bao giờ thì tính theo ngày tạo). */
export function compareRecent(a: BoardSummary, b: BoardSummary) {
  return Date.parse(b.lastViewedAt ?? b.createdAt) - Date.parse(a.lastViewedAt ?? a.createdAt);
}

/** Trạng thái đầy đủ (status, error) — tự tải khi component mount. */
export function useBoardsState() {
  const snapshot = useSyncExternalStore(boardsStore.subscribe, boardsStore.getSnapshot, boardsStore.getSnapshot);
  useEffect(() => {
    void boardsStore.load();
  }, []);
  return snapshot;
}

export function useBoards() {
  return useBoardsState().boards;
}

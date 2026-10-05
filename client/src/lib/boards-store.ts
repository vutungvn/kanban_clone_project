import { useSyncExternalStore } from 'react';
import type { BoardBackground } from './board-backgrounds';

/*
 * ⚠️ DỮ LIỆU GIẢ LẬP — server chưa có API boards.
 * Các hàm giữ dạng async và trả về đúng kiểu dữ liệu dự kiến của API, để khi có
 * backend chỉ cần thay phần thân bằng api('/boards', ...). Dữ liệu chỉ sống trong
 * bộ nhớ: tải lại trang là mất các bảng vừa tạo.
 */

export interface BoardMemberSummary {
  id: string;
  name: string;
}

export interface BoardSummary {
  id: string;
  title: string;
  background: BoardBackground;
  /** Đánh dấu sao — theo từng user */
  starred: boolean;
  createdAt: string;
  /** Lần cuối user hiện tại mở board — dùng cho sắp xếp "gần đây" */
  lastViewedAt: string | null;
  members: BoardMemberSummary[];
}

export interface CreateBoardInput {
  title: string;
  background: BoardBackground;
}

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

const HA = { id: 'mock-ha', name: 'Ngọc Hà' };
const LONG = { id: 'mock-long', name: 'Tuấn Long' };
const MAI = { id: 'mock-mai', name: 'Thanh Mai' };

let boards: BoardSummary[] = [
  { id: 'mock-website', title: 'Dự án Website', background: 'blue', starred: true, createdAt: minutesAgo(9000), lastViewedAt: minutesAgo(5), members: [HA, LONG] },
  { id: 'mock-marketing', title: 'Marketing Q4', background: 'sunset', starred: false, createdAt: minutesAgo(7000), lastViewedAt: minutesAgo(120), members: [MAI] },
  { id: 'mock-mobile', title: 'App Mobile', background: 'purple', starred: true, createdAt: minutesAgo(6000), lastViewedAt: minutesAgo(60), members: [LONG] },
  { id: 'mock-hiring', title: 'Tuyển dụng', background: 'green', starred: false, createdAt: minutesAgo(5000), lastViewedAt: minutesAgo(1440), members: [HA, MAI, LONG] },
  { id: 'mock-personal', title: 'Kế hoạch cá nhân', background: 'teal', starred: false, createdAt: minutesAgo(3000), lastViewedAt: null, members: [] },
];

const listeners = new Set<() => void>();

function setBoards(next: BoardSummary[]) {
  boards = next;
  listeners.forEach((listener) => listener());
}

export const boardsStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: () => boards,

  async create(input: CreateBoardInput, owner: BoardMemberSummary): Promise<BoardSummary> {
    await delay();
    const board: BoardSummary = {
      id: crypto.randomUUID(),
      ...input,
      starred: false,
      createdAt: new Date().toISOString(),
      lastViewedAt: null,
      members: [owner],
    };
    setBoards([board, ...boards]);
    return board;
  },

  /** Cập nhật lạc quan: đổi UI ngay rồi mới "gọi API". */
  async setStarred(id: string, starred: boolean) {
    setBoards(boards.map((b) => (b.id === id ? { ...b, starred } : b)));
    await delay();
  },

  markViewed(id: string) {
    if (!boards.some((b) => b.id === id)) return;
    setBoards(boards.map((b) => (b.id === id ? { ...b, lastViewedAt: new Date().toISOString() } : b)));
  },
};

/** Sắp xếp: mở gần đây nhất lên trước (chưa mở bao giờ thì tính theo ngày tạo). */
export function compareRecent(a: BoardSummary, b: BoardSummary) {
  return Date.parse(b.lastViewedAt ?? b.createdAt) - Date.parse(a.lastViewedAt ?? a.createdAt);
}

export function useBoards() {
  return useSyncExternalStore(boardsStore.subscribe, boardsStore.getSnapshot, boardsStore.getSnapshot);
}

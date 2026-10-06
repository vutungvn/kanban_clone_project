import { api } from './api';
import type { BoardBackground } from './board-backgrounds';

// Kiểu dữ liệu khớp với response của API (xem Swagger: /api/docs)

export type BoardRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface BoardMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: BoardRole;
}

export interface BoardSummary {
  id: string;
  title: string;
  background: BoardBackground;
  /** Đánh dấu sao — của riêng user hiện tại */
  starred: boolean;
  /** Vai trò của user hiện tại trong bảng */
  role: BoardRole;
  createdAt: string;
  /** Lần cuối user hiện tại mở bảng */
  lastViewedAt: string | null;
  members: BoardMember[];
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cards: Card[];
}

export interface BoardDetail extends BoardSummary {
  updatedAt: string;
  lists: List[];
}

export interface BoardInput {
  title: string;
  background: BoardBackground;
}

const id = (value: string) => encodeURIComponent(value);
const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const boardsApi = {
  list: () => api<{ boards: BoardSummary[] }>('/boards').then((r) => r.boards),
  get: (boardId: string) => api<{ board: BoardDetail }>(`/boards/${id(boardId)}`).then((r) => r.board),
  create: (input: BoardInput) => api<{ board: BoardSummary }>('/boards', send('POST', input)).then((r) => r.board),
  update: (boardId: string, input: Partial<BoardInput>) =>
    api<{ board: BoardSummary }>(`/boards/${id(boardId)}`, send('PATCH', input)).then((r) => r.board),
  remove: (boardId: string) => api<void>(`/boards/${id(boardId)}`, send('DELETE')),
  setStarred: (boardId: string, starred: boolean) =>
    api<{ starred: boolean }>(`/boards/${id(boardId)}/star`, send('PUT', { starred })),
};

export const listsApi = {
  create: (boardId: string, title: string) =>
    api<{ list: List }>(`/boards/${id(boardId)}/lists`, send('POST', { title })).then((r) => r.list),
  rename: (listId: string, title: string) =>
    api<{ list: List }>(`/lists/${id(listId)}`, send('PATCH', { title })).then((r) => r.list),
  remove: (listId: string) => api<void>(`/lists/${id(listId)}`, send('DELETE')),
};

export const cardsApi = {
  create: (listId: string, title: string) =>
    api<{ card: Card }>(`/lists/${id(listId)}/cards`, send('POST', { title })).then((r) => r.card),
  update: (cardId: string, input: { title?: string; description?: string | null }) =>
    api<{ card: Card }>(`/cards/${id(cardId)}`, send('PATCH', input)).then((r) => r.card),
  remove: (cardId: string) => api<void>(`/cards/${id(cardId)}`, send('DELETE')),
};

/** Lấy phần "tóm tắt" của board chi tiết — để đồng bộ vào danh sách bảng. */
export function toSummary({ lists: _lists, updatedAt: _updatedAt, ...summary }: BoardDetail): BoardSummary {
  return summary;
}

import { api } from './api';
import type { BoardBackground } from './board-backgrounds';

// Kiểu dữ liệu khớp với response của API (xem Swagger: /api/docs)

export type BoardRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface BoardMember {
  id: string;
  name: string;
  email: string;
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

/** Liên kết mời — null = đang tắt */
export interface InviteLink {
  token: string;
  role: Extract<BoardRole, 'MEMBER' | 'VIEWER'>;
  requiresApproval: boolean;
}

/** Xem trước khi mở /invite/:token — không chứa nội dung bảng */
export interface InvitePreview {
  board: { id: string; title: string; background: BoardBackground; memberCount: number };
  role: InviteLink['role'];
  requiresApproval: boolean;
  /** Trạng thái của user hiện tại */
  status: 'NONE' | 'PENDING' | 'MEMBER';
}

export interface JoinRequest {
  user: Omit<BoardMember, 'role'>;
  createdAt: string;
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

export const membersApi = {
  /** Mời người đã có tài khoản theo email (chỉ ADMIN) */
  invite: (boardId: string, email: string, role: BoardRole) =>
    api<{ member: BoardMember }>(`/boards/${id(boardId)}/members`, send('POST', { email, role })).then((r) => r.member),
  updateRole: (boardId: string, userId: string, role: BoardRole) =>
    api<{ member: BoardMember }>(`/boards/${id(boardId)}/members/${id(userId)}`, send('PATCH', { role })).then(
      (r) => r.member,
    ),
  /** userId là chính mình = rời bảng */
  remove: (boardId: string, userId: string) => api<void>(`/boards/${id(boardId)}/members/${id(userId)}`, send('DELETE')),
};

export const inviteLinkApi = {
  get: (boardId: string) => api<{ link: InviteLink | null }>(`/boards/${id(boardId)}/invite-link`).then((r) => r.link),
  /** Tạo mới / tạo lại — luôn ra token mới, link cũ hết hiệu lực */
  create: (boardId: string, input: Omit<InviteLink, 'token'>) =>
    api<{ link: InviteLink }>(`/boards/${id(boardId)}/invite-link`, send('PUT', input)).then((r) => r.link),
  /** Đổi cài đặt, giữ nguyên token */
  update: (boardId: string, input: Partial<Omit<InviteLink, 'token'>>) =>
    api<{ link: InviteLink }>(`/boards/${id(boardId)}/invite-link`, send('PATCH', input)).then((r) => r.link),
  disable: (boardId: string) => api<void>(`/boards/${id(boardId)}/invite-link`, send('DELETE')),
};

export const joinRequestsApi = {
  list: (boardId: string) =>
    api<{ requests: JoinRequest[] }>(`/boards/${id(boardId)}/join-requests`).then((r) => r.requests),
  approve: (boardId: string, userId: string, role: BoardRole) =>
    api<{ member: BoardMember }>(`/boards/${id(boardId)}/join-requests/${id(userId)}/approve`, send('POST', { role })).then(
      (r) => r.member,
    ),
  reject: (boardId: string, userId: string) =>
    api<void>(`/boards/${id(boardId)}/join-requests/${id(userId)}`, send('DELETE')),
};

/** Phía người nhận liên kết mời */
export const invitesApi = {
  preview: (token: string) => api<{ invite: InvitePreview }>(`/invites/${id(token)}`).then((r) => r.invite),
  /** Tham gia ngay, hoặc gửi yêu cầu nếu link cần duyệt */
  join: (token: string) =>
    api<{ status: 'PENDING' | 'MEMBER'; boardId: string }>(`/invites/${id(token)}/join`, send('POST')),
  cancelRequest: (token: string) => api<void>(`/invites/${id(token)}/request`, send('DELETE')),
};

/** Đường dẫn đầy đủ để gửi cho người khác */
export const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

export const listsApi = {
  create: (boardId: string, title: string) =>
    api<{ list: List }>(`/boards/${id(boardId)}/lists`, send('POST', { title })).then((r) => r.list),
  rename: (listId: string, title: string) =>
    api<{ list: List }>(`/lists/${id(listId)}`, send('PATCH', { title })).then((r) => r.list),
  remove: (listId: string) => api<void>(`/lists/${id(listId)}`, send('DELETE')),
  /** index: vị trí mới trong bảng (không tính chính danh sách đó) — server tự tính position */
  move: (listId: string, index: number) =>
    api<{ list: List }>(`/lists/${id(listId)}/move`, send('PATCH', { index })).then((r) => r.list),
};

export const cardsApi = {
  create: (listId: string, title: string) =>
    api<{ card: Card }>(`/lists/${id(listId)}/cards`, send('POST', { title })).then((r) => r.card),
  update: (cardId: string, input: { title?: string; description?: string | null }) =>
    api<{ card: Card }>(`/cards/${id(cardId)}`, send('PATCH', input)).then((r) => r.card),
  remove: (cardId: string) => api<void>(`/cards/${id(cardId)}`, send('DELETE')),
  /** Chuyển thẻ tới vị trí `index` của danh sách `listId` (cùng bảng) */
  move: (cardId: string, listId: string, index: number) =>
    api<{ card: Card }>(`/cards/${id(cardId)}/move`, send('PATCH', { listId, index })).then((r) => r.card),
};

/** Lấy phần "tóm tắt" của board chi tiết — để đồng bộ vào danh sách bảng. */
export function toSummary({ lists: _lists, updatedAt: _updatedAt, ...summary }: BoardDetail): BoardSummary {
  return summary;
}

import { api, upload } from './api';
import type { BoardBackground } from './board-backgrounds';
import type { LabelColor } from './labels';

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

/** Nhãn của bảng — dùng chung cho mọi thẻ. `name` có thể rỗng (nhãn chỉ có màu). */
export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
}

/** Tệp đính kèm của thẻ. `previewUrl`: ảnh thu nhỏ — null nếu không phải ảnh JPG / PNG / GIF / WEBP. */
export interface Attachment {
  id: string;
  cardId: string;
  name: string;
  url: string;
  previewUrl: string | null;
  mimeType: string;
  /** Byte */
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  position: number;
  startDate: string | null;
  dueDate: string | null;
  /** Đã hoàn thành hạn chót */
  dueComplete: boolean;
  /** Thời điểm lưu trữ — thẻ trên bảng luôn là null */
  archivedAt: string | null;
  /** ID nhãn — chi tiết ở `board.labels` */
  labelIds: string[];
  /** ID thành viên được giao — chi tiết ở `board.members` */
  memberIds: string[];
  checklists: Checklist[];
  /** Mới nhất trước */
  attachments: Attachment[];
  /** Ảnh bìa: 1 màu (key màu chuẩn của nhãn) HOẶC 1 ảnh trong `attachments` */
  coverColor: string | null;
  coverAttachmentId: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Đặt ảnh bìa: màu hoặc ảnh đính kèm; null = gỡ */
export type CoverInput = { color: string } | { attachmentId: string } | null;

export type ActivityType =
  | 'COMMENT'
  | 'CARD_CREATED'
  | 'CARD_RENAMED'
  | 'CARD_MOVED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'DATES_CHANGED'
  | 'DUE_COMPLETE_CHANGED'
  | 'CHECKLIST_ADDED'
  | 'CHECKLIST_REMOVED'
  | 'CHECKLIST_ITEM_COMPLETED'
  | 'CHECKLIST_ITEM_UNCOMPLETED'
  | 'CARD_ARCHIVED'
  | 'CARD_RESTORED'
  | 'CARD_COPIED'
  | 'CARD_TRANSFERRED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED';

/**
 * Một mục trong lịch sử hoạt động của thẻ. Bình luận là type COMMENT (nội dung ở `text`).
 * `data` chụp lại tên nhãn / danh sách / thành viên lúc xảy ra — xem mô tả ActivityDto trên Swagger.
 */
export interface Activity {
  id: string;
  cardId: string;
  type: ActivityType;
  data: Record<string, unknown>;
  text: string | null;
  editedAt: string | null;
  createdAt: string;
  /** null nếu tài khoản đã bị xoá */
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export type ActivityFilter = 'all' | 'comments';

/** Các trường sửa được qua PATCH /cards/:id. Ngày gửi ISO; `null` = xoá. */
export interface CardInput {
  title?: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  dueComplete?: boolean;
}

export interface List {
  id: string;
  boardId: string;
  title: string;
  position: number;
  /** Thời điểm lưu trữ — danh sách trên bảng luôn là null */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cards: Card[];
}

/** Thẻ kèm tên danh sách — dùng cho thẻ không có trên bảng (đã lưu trữ, nằm trong danh sách đã lưu trữ). */
export interface CardWithList extends Card {
  /** Bảng chứa thẻ — có thể khác bảng đang mở nếu thẻ vừa được chuyển đi */
  boardId: string;
  listTitle: string;
  listArchived: boolean;
}

/** Danh sách rút gọn — chọn nơi di chuyển / sao chép sang bảng khác */
export interface ListSummary {
  id: string;
  title: string;
  cardCount: number;
}

/** Kiểu sắp xếp thẻ trong danh sách */
export type ListSort = 'newest' | 'oldest' | 'due' | 'title';

/** Mục "Đã lưu trữ" của bảng */
export interface BoardArchive {
  cards: CardWithList[];
  lists: (Omit<List, 'cards'> & { cardCount: number })[];
}

/** Sao chép thẻ: phần nào được giữ (mô tả luôn giữ) */
export interface CopyCardInput {
  title: string;
  listId: string;
  /** Vị trí trong danh sách đích, tính từ 0 */
  index: number;
  keepLabels: boolean;
  keepMembers: boolean;
  keepChecklists: boolean;
  keepDates: boolean;
  keepAttachments: boolean;
}

export interface BoardDetail extends BoardSummary {
  updatedAt: string;
  labels: Label[];
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
  /** Thẻ + danh sách đã lưu trữ */
  archive: (boardId: string) => api<BoardArchive>(`/boards/${id(boardId)}/archive`),
  /** Danh sách (chưa lưu trữ) + số thẻ — chọn đích khi di chuyển / sao chép */
  lists: (boardId: string) => api<{ lists: ListSummary[] }>(`/boards/${id(boardId)}/lists`).then((r) => r.lists),
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
  /** index: vị trí mới (không tính chính danh sách đó). `boardId`: chuyển sang bảng khác (thẻ đi theo). */
  move: (listId: string, index: number, boardId?: string) =>
    api<{ list: List }>(`/lists/${id(listId)}/move`, send('PATCH', { index, ...(boardId && { boardId }) })).then((r) => r.list),
  /** Sắp xếp thẻ một lần, lưu thứ tự mới */
  sort: (listId: string, by: ListSort) =>
    api<{ list: List }>(`/lists/${id(listId)}/sort`, send('POST', { by })).then((r) => r.list),
  setArchived: (listId: string, archived: boolean) =>
    api<{ list: List }>(`/lists/${id(listId)}/${archived ? 'archive' : 'restore'}`, send('POST')).then((r) => r.list),
  /** Lưu trữ mọi thẻ đang hiện trong danh sách */
  archiveCards: (listId: string) => api<{ count: number }>(`/lists/${id(listId)}/archive-cards`, send('POST')),
  /** Bản sao đặt ngay bên phải, kèm mọi thẻ */
  copy: (listId: string, title: string) =>
    api<{ list: List }>(`/lists/${id(listId)}/copy`, send('POST', { title })).then((r) => r.list),
};

export const cardsApi = {
  /** Kể cả thẻ đã lưu trữ */
  get: (cardId: string) => api<{ card: CardWithList }>(`/cards/${id(cardId)}`).then((r) => r.card),
  setArchived: (cardId: string, archived: boolean) =>
    api<{ card: CardWithList }>(`/cards/${id(cardId)}/${archived ? 'archive' : 'restore'}`, send('POST')).then((r) => r.card),
  copy: (cardId: string, input: CopyCardInput) =>
    api<{ card: Card }>(`/cards/${id(cardId)}/copy`, send('POST', input)).then((r) => r.card),
  create: (listId: string, title: string) =>
    api<{ card: Card }>(`/lists/${id(listId)}/cards`, send('POST', { title })).then((r) => r.card),
  update: (cardId: string, input: CardInput) =>
    api<{ card: Card }>(`/cards/${id(cardId)}`, send('PATCH', input)).then((r) => r.card),
  remove: (cardId: string) => api<void>(`/cards/${id(cardId)}`, send('DELETE')),
  /** Chuyển thẻ tới vị trí `index` của danh sách `listId` (cùng bảng) */
  move: (cardId: string, listId: string, index: number) =>
    api<{ card: Card }>(`/cards/${id(cardId)}/move`, send('PATCH', { listId, index })).then((r) => r.card),
  /** Gắn / gỡ nhãn — đã gắn / chưa gắn thì server bỏ qua */
  setLabel: (cardId: string, labelId: string, on: boolean) =>
    api<void>(`/cards/${id(cardId)}/labels/${id(labelId)}`, send(on ? 'PUT' : 'DELETE')),
  /** Giao / bỏ giao thẻ cho thành viên của bảng */
  setMember: (cardId: string, userId: string, on: boolean) =>
    api<void>(`/cards/${id(cardId)}/members/${id(userId)}`, send(on ? 'PUT' : 'DELETE')),
  setCover: (cardId: string, cover: CoverInput) =>
    api<void>(`/cards/${id(cardId)}/cover`, cover ? send('PUT', cover) : send('DELETE')),
};

export const attachmentsApi = {
  /** Trả về cả thẻ sau khi đính kèm (ảnh đầu tiên của thẻ chưa có ảnh bìa sẽ thành ảnh bìa) */
  upload: (cardId: string, file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return upload<{ attachment: Attachment; card: Card }>(`/cards/${id(cardId)}/attachments`, form, onProgress);
  },
  rename: (attachmentId: string, name: string) =>
    api<{ attachment: Attachment }>(`/attachments/${id(attachmentId)}`, send('PATCH', { name })).then((r) => r.attachment),
  remove: (attachmentId: string) => api<void>(`/attachments/${id(attachmentId)}`, send('DELETE')),
};

export const activitiesApi = {
  /** Mới nhất trước; `cursor` = `nextCursor` của trang trước */
  list: (cardId: string, filter: ActivityFilter, cursor?: string | null) => {
    const query = new URLSearchParams({ filter, limit: '20', ...(cursor && { cursor }) });
    return api<{ activities: Activity[]; nextCursor: string | null }>(`/cards/${id(cardId)}/activities?${query}`);
  },
  addComment: (cardId: string, text: string) =>
    api<{ activity: Activity }>(`/cards/${id(cardId)}/comments`, send('POST', { text })).then((r) => r.activity),
  updateComment: (commentId: string, text: string) =>
    api<{ activity: Activity }>(`/comments/${id(commentId)}`, send('PATCH', { text })).then((r) => r.activity),
  removeComment: (commentId: string) => api<void>(`/comments/${id(commentId)}`, send('DELETE')),
};

export const labelsApi = {
  create: (boardId: string, input: { name: string; color: LabelColor }) =>
    api<{ label: Label }>(`/boards/${id(boardId)}/labels`, send('POST', input)).then((r) => r.label),
  update: (labelId: string, input: { name?: string; color?: LabelColor }) =>
    api<{ label: Label }>(`/labels/${id(labelId)}`, send('PATCH', input)).then((r) => r.label),
  /** Xoá khỏi bảng và gỡ khỏi mọi thẻ */
  remove: (labelId: string) => api<void>(`/labels/${id(labelId)}`, send('DELETE')),
};

export const checklistsApi = {
  create: (cardId: string, title: string) =>
    api<{ checklist: Checklist }>(`/cards/${id(cardId)}/checklists`, send('POST', { title })).then((r) => r.checklist),
  rename: (checklistId: string, title: string) =>
    api<{ checklist: Checklist }>(`/checklists/${id(checklistId)}`, send('PATCH', { title })).then((r) => r.checklist),
  remove: (checklistId: string) => api<void>(`/checklists/${id(checklistId)}`, send('DELETE')),
  addItem: (checklistId: string, title: string) =>
    api<{ item: ChecklistItem }>(`/checklists/${id(checklistId)}/items`, send('POST', { title })).then((r) => r.item),
  updateItem: (itemId: string, input: { title?: string; completed?: boolean }) =>
    api<{ item: ChecklistItem }>(`/checklist-items/${id(itemId)}`, send('PATCH', input)).then((r) => r.item),
  removeItem: (itemId: string) => api<void>(`/checklist-items/${id(itemId)}`, send('DELETE')),
};

/** Lấy phần "tóm tắt" của board chi tiết — để đồng bộ vào danh sách bảng. */
export function toSummary({ lists: _lists, labels: _labels, updatedAt: _updatedAt, ...summary }: BoardDetail): BoardSummary {
  return summary;
}

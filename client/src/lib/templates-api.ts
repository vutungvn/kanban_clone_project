import { api } from './api';
import type { BoardBackground } from './board-backgrounds';
import type { BoardInput, BoardSummary } from './boards-api';

/** Mẫu bảng (không kèm nội dung) — xem TemplateSummaryDto trên Swagger */
export interface TemplateSummary {
  /** Mẫu có sẵn: slug (vd "scrum"); mẫu của tôi: CUID */
  id: string;
  /** Mẫu có sẵn — không sửa / xoá được */
  builtin: boolean;
  title: string;
  description: string;
  /** Nhóm của mẫu có sẵn; mẫu của tôi = null */
  category: string | null;
  background: BoardBackground;
  /** Tên các danh sách */
  lists: string[];
  cardCount: number;
  /** Lúc lưu (mẫu có sẵn = null) */
  createdAt: string | null;
}

export interface TemplateCard {
  title: string;
  description?: string;
  /** Vị trí trong `TemplateContent.labels` */
  labels?: number[];
  coverColor?: string;
  checklists?: { title: string; items: string[] }[];
}

export interface TemplateContent {
  labels: { name: string; color: string }[];
  lists: { title: string; cards: TemplateCard[] }[];
}

export interface TemplateDetail extends TemplateSummary {
  content: TemplateContent;
}

export interface SaveTemplateInput {
  title: string;
  description?: string;
  /** false: chỉ lưu khung (danh sách + nhãn) */
  keepCards: boolean;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const templatesApi = {
  list: () => api<{ builtin: TemplateSummary[]; mine: TemplateSummary[] }>('/templates'),
  get: (id: string) => api<{ template: TemplateDetail }>(`/templates/${encodeURIComponent(id)}`).then((r) => r.template),
  /** Dùng qua boardsStore.createFromTemplate để bảng mới vào ngay danh sách bảng */
  createBoard: (id: string, input: BoardInput & { keepCards: boolean }) =>
    api<{ board: BoardSummary }>(`/templates/${encodeURIComponent(id)}/boards`, send('POST', input)).then((r) => r.board),
  saveFromBoard: (boardId: string, input: SaveTemplateInput) =>
    api<{ template: TemplateSummary }>(`/boards/${encodeURIComponent(boardId)}/template`, send('POST', input)).then((r) => r.template),
  update: (id: string, input: Partial<Pick<TemplateSummary, 'title' | 'description' | 'background'>>) =>
    api<{ template: TemplateSummary }>(`/templates/${encodeURIComponent(id)}`, send('PATCH', input)).then((r) => r.template),
  remove: (id: string) => api<void>(`/templates/${encodeURIComponent(id)}`, send('DELETE')),
};

export const templateMeta = (t: Pick<TemplateSummary, 'lists' | 'cardCount'>) => `${t.lists.length} danh sách · ${t.cardCount} thẻ`;

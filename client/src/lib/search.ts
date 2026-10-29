import { api } from './api';
import type { BoardBackground } from './board-backgrounds';

/** Bỏ dấu tiếng Việt + chữ thường, để gõ "du an" vẫn tìm ra "Dự án". */
export function normalizeText(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function matchesQuery(text: string, query: string) {
  const q = normalizeText(query.trim());
  return !q || normalizeText(text).includes(q);
}

// ---------- Tìm kiếm toàn cục (thẻ + bình luận, server dùng full-text search) ----------

/** Gõ từ ngần này ký tự mới tìm thẻ / bình luận trên server */
export const MIN_SEARCH_LENGTH = 2;

const WORD = /[\p{L}\p{N}]+/gu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** "Thiết kế trang-chủ" → ["thiet", "ke", "trang", "chu"] — cùng cách tách từ với server. */
export function searchTerms(query: string) {
  return [...new Set((query.match(WORD) ?? []).map(normalizeText).filter(Boolean))];
}

export type HighlightPart = { text: string; match: boolean };

/**
 * Tách `text` thành các đoạn, đánh dấu phần khớp từ khoá để in đậm: đầu từ khớp tiền tố với 1 từ khoá
 * (giống server), không phân biệt dấu — gõ "thiet" thì in đậm "Thiết" trong chuỗi gốc có dấu.
 */
export function highlight(text: string, query: string): HighlightPart[] {
  const terms = searchTerms(query);
  if (!terms.length || !text) return [{ text, match: false }];
  // Bỏ dấu từng ký tự, nhớ vị trí gốc để đổi chỗ khớp trên chuỗi bỏ dấu về chuỗi gốc
  let folded = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = normalizeText(text[i]);
    folded += f;
    for (let k = 0; k < f.length; k++) origin.push(i);
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const term of terms) {
    for (let i = folded.indexOf(term); i >= 0; i = folded.indexOf(term, i + 1)) {
      if (i > 0 && WORD_CHAR.test(folded[i - 1])) continue;
      const end = origin[i + term.length] ?? text.length;
      for (let j = origin[i]; j < end; j++) marked[j] = true;
    }
  }
  const parts: HighlightPart[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) last.text += text[i];
    else parts.push({ text: text[i], match: marked[i] });
  }
  return parts;
}

/** Bảng kèm kết quả — đủ để hiện tên + màu nền */
export interface SearchBoardRef {
  id: string;
  title: string;
  background: BoardBackground;
}

/** Thẻ khớp từ khoá — xem CardSearchResultDto trên Swagger */
export interface CardSearchResult {
  id: string;
  title: string;
  /** title: mọi từ khoá có trong tiêu đề; description: có từ chỉ nằm trong mô tả */
  matchedIn: 'title' | 'description';
  /** Đoạn trích mô tả quanh chỗ khớp (chỉ khi matchedIn = description) */
  excerpt: string | null;
  dueDate: string | null;
  dueComplete: boolean;
  /** Thẻ hoặc danh sách chứa thẻ đã lưu trữ */
  archived: boolean;
  list: { id: string; title: string };
  board: SearchBoardRef;
}

/** Bình luận khớp từ khoá */
export interface CommentSearchResult {
  id: string;
  /** Đoạn trích quanh chỗ khớp */
  excerpt: string;
  createdAt: string;
  /** null nếu tài khoản đã bị xoá */
  author: { id: string; name: string; avatarUrl: string | null } | null;
  card: { id: string; title: string; archived: boolean };
  board: SearchBoardRef;
}

export interface SearchGroup<T> {
  items: T[];
  /** Tổng số kết quả (mọi trang) */
  total: number;
}

export interface SearchResponse {
  cards?: SearchGroup<CardSearchResult>;
  comments?: SearchGroup<CommentSearchResult>;
}

export type SearchType = 'all' | 'cards' | 'comments';

export interface SearchParams {
  q: string;
  type?: SearchType;
  boardId?: string | null;
  /** Gồm cả thẻ đã lưu trữ */
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export const searchApi = {
  search: (params: SearchParams, signal?: AbortSignal) => {
    const query = new URLSearchParams({
      q: params.q,
      type: params.type ?? 'all',
      limit: String(params.limit ?? 10),
      offset: String(params.offset ?? 0),
      ...(params.boardId && { boardId: params.boardId }),
      ...(params.archived && { archived: 'true' }),
    });
    return api<SearchResponse>(`/search?${query}`, { signal });
  },
};

/** Link mở modal thẻ trên bảng */
export const cardHref = (boardId: string, cardId: string) => `/b/${boardId}?card=${encodeURIComponent(cardId)}`;

/** Trang kết quả đầy đủ */
export const searchPageHref = (q: string) => `/search?q=${encodeURIComponent(q.trim())}`;

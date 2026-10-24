import type { Card, ListSort } from './boards-api';

export const LIST_SORT_OPTIONS: { value: ListSort; label: string }[] = [
  { value: 'newest', label: 'Ngày tạo (mới nhất trước)' },
  { value: 'oldest', label: 'Ngày tạo (cũ nhất trước)' },
  { value: 'due', label: 'Hạn chót (gần nhất trước)' },
  { value: 'title', label: 'Tên thẻ (A → Z)' },
];

const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

const COMPARE: Record<ListSort, (a: Card, b: Card) => number> = {
  newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  oldest: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  // Không có hạn chót xếp cuối, giữ thứ tự tạo
  due: (a, b) => time(a.dueDate) - time(b.dueDate) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  title: (a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base', numeric: true }),
};

/** Cùng quy tắc với server (lists.service.ts → sort) — để giao diện đổi ngay trước khi server trả lời. */
export const sortCards = (cards: Card[], by: ListSort) => [...cards].sort(COMPARE[by]);

import { api } from './api';
import type { BoardBackground } from './board-backgrounds';
import type { Activity, BoardRole } from './boards-api';
import { addDays, toDateInput } from './card-dates';

/** Bảng kèm thẻ / hoạt động — đủ để hiện tên + màu nền */
export interface BoardRef {
  id: string;
  title: string;
  background: BoardBackground;
}

/** Thẻ được giao cho tôi (Trang chủ) — xem MyCardDto trên Swagger */
export interface MyCard {
  id: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  dueComplete: boolean;
  /** Lúc mình được giao thẻ */
  assignedAt: string;
  list: { id: string; title: string };
  board: BoardRef & { role: BoardRole };
  labels: { id: string; name: string; color: string }[];
  checklist: { done: number; total: number };
  commentCount: number;
  attachmentCount: number;
}

/** 1 dòng trên trang Hoạt động */
export interface FeedActivity extends Activity {
  card: { id: string; title: string };
  board: BoardRef;
}

export type FeedScope = 'all' | 'mine';

export const meApi = {
  cards: () => api<{ cards: MyCard[] }>('/me/cards').then((r) => r.cards),
  activities: (input: { scope: FeedScope; boardId?: string | null; cursor?: string | null; limit?: number }) => {
    const query = new URLSearchParams({
      scope: input.scope,
      limit: String(input.limit ?? 20),
      ...(input.boardId && { boardId: input.boardId }),
      ...(input.cursor && { cursor: input.cursor }),
    });
    return api<{ activities: FeedActivity[]; nextCursor: string | null }>(`/me/activities?${query}`);
  },
};

// ---------- Nhóm thẻ theo hạn chót (theo giờ trên máy) ----------

export type MyCardGroup = 'overdue' | 'today' | 'week' | 'later' | 'noDue' | 'done';

export const MY_CARD_GROUPS: { key: MyCardGroup; title: string }[] = [
  { key: 'overdue', title: 'Quá hạn' },
  { key: 'today', title: 'Hôm nay' },
  { key: 'week', title: '7 ngày tới' },
  { key: 'later', title: 'Sau đó' },
  { key: 'noDue', title: 'Không có hạn' },
  { key: 'done', title: 'Đã hoàn thành' },
];

const time = (iso: string) => new Date(iso).getTime();

/**
 * - Quá hạn: đã qua hạn, chưa hoàn thành (quá hạn lâu nhất trước)
 * - Hôm nay: hạn trong hôm nay, chưa tới giờ · 7 ngày tới · Sau đó (hạn gần trước)
 * - Không có hạn (được giao gần đây trước) · Đã hoàn thành (hạn gần đây nhất trước)
 */
export function groupMyCards(cards: MyCard[], now = Date.now()): Record<MyCardGroup, MyCard[]> {
  const groups: Record<MyCardGroup, MyCard[]> = { overdue: [], today: [], week: [], later: [], noDue: [], done: [] };
  const today = toDateInput(new Date(now));
  const weekEnd = addDays(new Date(now), 7).getTime();
  for (const card of cards) {
    if (!card.dueDate) groups.noDue.push(card);
    else if (card.dueComplete) groups.done.push(card);
    else if (time(card.dueDate) < now) groups.overdue.push(card);
    else if (toDateInput(new Date(card.dueDate)) === today) groups.today.push(card);
    else if (time(card.dueDate) <= weekEnd) groups.week.push(card);
    else groups.later.push(card);
  }
  const byDue = (a: MyCard, b: MyCard) => time(a.dueDate!) - time(b.dueDate!);
  groups.overdue.sort(byDue);
  groups.today.sort(byDue);
  groups.week.sort(byDue);
  groups.later.sort(byDue);
  groups.done.sort((a, b) => byDue(b, a));
  groups.noDue.sort((a, b) => time(b.assignedAt) - time(a.assignedAt));
  return groups;
}

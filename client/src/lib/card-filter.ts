import type { BoardDetail, Card, List } from './boards-api';
import { dueStatus } from './card-dates';
import { normalizeText } from './search';

/** Giá trị đặc biệt: "Không có thành viên" / "Không có nhãn" */
export const NONE = 'none';

/** Lọc theo hạn chót: không có / quá hạn / trong 24 giờ tới / trong 7 ngày tới / đã hoàn thành */
export type DueFilter = 'none' | 'overdue' | 'day' | 'week' | 'complete';

/**
 * Bộ lọc thẻ trên bảng. Trong cùng một nhóm: khớp một trong các lựa chọn (HOẶC);
 * giữa các nhóm: phải khớp tất cả (VÀ). Nhóm để trống = không lọc theo nhóm đó.
 */
export interface CardFilter {
  keyword: string;
  /** ID thành viên hoặc NONE */
  members: string[];
  due: DueFilter[];
  /** ID nhãn hoặc NONE */
  labels: string[];
}

export const EMPTY_FILTER: CardFilter = { keyword: '', members: [], due: [], labels: [] };

/** Số điều kiện đang bật (từ khoá tính là 1). */
export const filterCount = (f: CardFilter) =>
  (f.keyword.trim() ? 1 : 0) + f.members.length + f.due.length + f.labels.length;

const DAY = 24 * 60 * 60 * 1000;

function matchesDue(card: Card, option: DueFilter, now: number) {
  if (option === 'none') return !card.dueDate;
  if (option === 'complete') return !!card.dueDate && card.dueComplete;
  const status = dueStatus(card, now);
  if (option === 'overdue') return status === 'overdue';
  if (!card.dueDate || card.dueComplete || status === 'overdue') return false;
  const left = new Date(card.dueDate).getTime() - now;
  return left < (option === 'day' ? DAY : 7 * DAY);
}

export function matchesFilter(card: Card, filter: CardFilter, board: Pick<BoardDetail, 'labels' | 'members'>, now = Date.now()) {
  const keyword = normalizeText(filter.keyword.trim());
  if (keyword) {
    // Tìm trong tiêu đề, mô tả, tên nhãn, tên thành viên của thẻ
    const text = [
      card.title,
      card.description ?? '',
      ...board.labels.filter((l) => card.labelIds.includes(l.id)).map((l) => l.name),
      ...board.members.filter((m) => card.memberIds.includes(m.id)).map((m) => m.name),
    ].join('\n');
    if (!normalizeText(text).includes(keyword)) return false;
  }
  if (
    filter.members.length &&
    !filter.members.some((id) => (id === NONE ? card.memberIds.length === 0 : card.memberIds.includes(id)))
  ) {
    return false;
  }
  if (
    filter.labels.length &&
    !filter.labels.some((id) => (id === NONE ? card.labelIds.length === 0 : card.labelIds.includes(id)))
  ) {
    return false;
  }
  if (filter.due.length && !filter.due.some((option) => matchesDue(card, option, now))) return false;
  return true;
}

/** Danh sách sau khi lọc thẻ (danh sách vẫn giữ nguyên, kể cả khi không còn thẻ nào khớp). */
export function filterLists(board: BoardDetail, filter: CardFilter): { lists: List[]; matched: number } {
  const now = Date.now();
  let matched = 0;
  const lists = board.lists.map((list) => {
    const cards = list.cards.filter((card) => matchesFilter(card, filter, board, now));
    matched += cards.length;
    return { ...list, cards };
  });
  return { lists, matched };
}

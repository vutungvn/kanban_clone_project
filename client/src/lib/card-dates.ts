import type { Card } from './boards-api';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Trạng thái hạn chót:
 * - complete: đã đánh dấu hoàn thành
 * - overdue: đã quá hạn
 * - soon: còn dưới 24 giờ
 * - normal: còn xa
 */
export type DueStatus = 'complete' | 'overdue' | 'soon' | 'normal';

export function dueStatus(card: Pick<Card, 'dueDate' | 'dueComplete'>, now = Date.now()): DueStatus | null {
  if (!card.dueDate) return null;
  if (card.dueComplete) return 'complete';
  const left = new Date(card.dueDate).getTime() - now;
  if (left < 0) return 'overdue';
  return left < DAY ? 'soon' : 'normal';
}

export const DUE_STATUS_LABEL: Record<DueStatus, string | null> = {
  complete: 'Hoàn thành',
  overdue: 'Quá hạn',
  soon: 'Sắp hết hạn',
  normal: null,
};

/** Màu badge hạn chót trên thẻ / trong modal. */
export const DUE_STATUS_CLASS: Record<DueStatus, string> = {
  complete: 'bg-success text-white',
  overdue: 'bg-danger text-white',
  soon: 'bg-[#f5cd47] text-[#172b4d]',
  normal: '',
};

const SHORT = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' });
const WITH_YEAR = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** "25 thg 10" — thêm năm nếu khác năm hiện tại. */
export function formatDay(iso: string) {
  const date = new Date(iso);
  return (date.getFullYear() === new Date().getFullYear() ? SHORT : WITH_YEAR).format(date);
}

/** "25 thg 10, 10:00" */
export const formatDayTime = (iso: string) => `${formatDay(iso)}, ${TIME.format(new Date(iso))}`;

/** Khoảng ngày hiển thị trên thẻ: "20 thg 10 - 25 thg 10", chỉ bắt đầu: "Bắt đầu: 20 thg 10". */
export function formatCardDates(card: Pick<Card, 'startDate' | 'dueDate'>) {
  if (card.startDate && card.dueDate) return `${formatDay(card.startDate)} - ${formatDay(card.dueDate)}`;
  if (card.dueDate) return formatDay(card.dueDate);
  if (card.startDate) return `Bắt đầu: ${formatDay(card.startDate)}`;
  return null;
}

// ----- Chuyển đổi cho <input type="date"> / <input type="time"> (theo giờ máy người dùng) -----

const pad = (n: number) => String(n).padStart(2, '0');

/** Date → "2026-10-25" */
export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Date → "10:00" */
export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** "2026-10-25" + "10:00" (giờ địa phương) → Date; sai định dạng → null. */
export function fromInputs(day: string, time = '00:00'): Date | null {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return null;
  const date = new Date(y, m - 1, d, hh, mm);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** "vừa xong", "5 phút trước", "3 giờ trước", "hôm qua lúc 10:00", rồi "20 thg 10, 10:00". */
export function formatRelative(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const diff = now - date.getTime();
  if (diff < 60_000) return 'vừa xong';
  if (diff < HOUR) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < DAY && date.getDate() === new Date(now).getDate()) return `${Math.floor(diff / HOUR)} giờ trước`;
  if (toDateInput(date) === toDateInput(addDays(new Date(now), -1))) return `hôm qua lúc ${TIME.format(date)}`;
  return formatDayTime(iso);
}

/** "20 thg 10, 2026 lúc 10:28" — tooltip thời điểm đầy đủ. */
export const formatFull = (iso: string) => `${WITH_YEAR.format(new Date(iso))} lúc ${TIME.format(new Date(iso))}`;

import { POSITION_GAP } from './boards.constants';

/**
 * Khoảng cách nhỏ nhất giữa 2 position liền kề. Chia đôi liên tục (kéo thả nhiều lần vào
 * cùng 1 khe) sẽ làm khoảng cách nhỏ dần → dưới ngưỡng này thì đánh số lại cả danh sách.
 */
const MIN_GAP = 1e-6;

/**
 * Tính position để chèn vào giữa `before` và `after` (một trong hai có thể không có).
 * Trả về null nếu khe quá hẹp — nơi gọi cần đánh số lại.
 */
export function positionBetween(before?: number, after?: number): number | null {
  if (before === undefined && after === undefined) return POSITION_GAP;
  if (before === undefined) return after! / 2 >= MIN_GAP ? after! / 2 : null;
  if (after === undefined) return before + POSITION_GAP;
  return after - before >= MIN_GAP * 2 ? (before + after) / 2 : null;
}

/**
 * Xác định position cho phần tử được chèn vào `siblings` (đã sắp xếp, không gồm chính nó) tại `index`.
 * Nếu khe quá hẹp: trả về `rebalanced` — thứ tự mới của toàn bộ phần tử, position = 1024, 2048, ...
 */
export function placeAt(siblings: { id: string; position: number }[], index: number, movingId: string) {
  const i = Math.max(0, Math.min(index, siblings.length));
  const position = positionBetween(siblings[i - 1]?.position, siblings[i]?.position);
  if (position !== null) return { position, rebalanced: null };

  const ordered = siblings.map((s) => s.id);
  ordered.splice(i, 0, movingId);
  return {
    position: (i + 1) * POSITION_GAP,
    rebalanced: ordered.map((id, k) => ({ id, position: (k + 1) * POSITION_GAP })),
  };
}

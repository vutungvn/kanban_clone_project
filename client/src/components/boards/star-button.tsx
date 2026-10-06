'use client';

import { Star } from 'lucide-react';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import { boardsStore, type BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

/**
 * Nút đánh dấu sao. Chưa đánh dấu thì chỉ hiện khi hover vào phần tử cha có class `group`
 * (luôn hiện trên màn hình cảm ứng).
 * `onChange` để nơi dùng cập nhật state riêng (vd trang chi tiết bảng) — được gọi ngay, và gọi lại khi hoàn tác.
 */
export function StarButton({
  board,
  alwaysVisible = false,
  onChange,
  className,
}: {
  board: Pick<BoardSummary, 'id' | 'title' | 'starred'>;
  alwaysVisible?: boolean;
  onChange?: (starred: boolean) => void;
  className?: string;
}) {
  async function toggle() {
    const next = !board.starred;
    onChange?.(next);
    try {
      await boardsStore.setStarred(board.id, next);
    } catch (e) {
      onChange?.(!next);
      toast.error(errorMessage(e));
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={board.starred}
      aria-label={board.starred ? `Bỏ đánh dấu sao "${board.title}"` : `Đánh dấu sao "${board.title}"`}
      title={board.starred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
      className={cn(
        'rounded p-1 transition hover:scale-110 hover:bg-white/20 focus-visible:opacity-100',
        board.starred
          ? 'text-amber-300'
          : cn('text-white', !alwaysVisible && 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100'),
        className,
      )}
    >
      <Star size={16} fill={board.starred ? 'currentColor' : 'none'} />
    </button>
  );
}

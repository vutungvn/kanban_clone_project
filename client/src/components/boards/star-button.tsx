'use client';

import { Star } from 'lucide-react';
import { boardsStore, type BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

/**
 * Nút đánh dấu sao. Chưa đánh dấu thì chỉ hiện khi hover vào phần tử cha có class `group`
 * (luôn hiện trên màn hình cảm ứng).
 */
export function StarButton({
  board,
  alwaysVisible = false,
  className,
}: {
  board: Pick<BoardSummary, 'id' | 'title' | 'starred'>;
  alwaysVisible?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => void boardsStore.setStarred(board.id, !board.starred)}
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

import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent } from 'react';
import { Avatar } from '@/components/avatar';
import { backgroundClass } from '@/lib/board-backgrounds';
import type { BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { StarButton } from './star-button';

const MAX_AVATARS = 3;

export function BoardTile({ board }: { board: BoardSummary }) {
  const extraMembers = board.members.length - MAX_AVATARS;

  return (
    <div
      className={cn(
        'group relative h-24 overflow-hidden rounded-lg bg-linear-to-r p-3 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        backgroundClass(board.background),
      )}
    >
      <div aria-hidden className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-transparent" />

      {/* Link phủ toàn bộ ô; nút sao nằm trên (z-20) nên không lồng button trong link */}
      <Link
        href={`/b/${board.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="sr-only">{board.title}</span>
      </Link>

      <div className="pointer-events-none relative flex h-full flex-col justify-between">
        <h3 className="line-clamp-2 pr-6 text-base leading-snug font-semibold tracking-tight drop-shadow-sm">{board.title}</h3>
        {board.members.length > 0 && (
          <div className="flex -space-x-1.5">
            {board.members.slice(0, MAX_AVATARS).map((m) => (
              <Avatar key={m.id} name={m.name} seed={m.id} size={20} className="ring-2 ring-white/60" />
            ))}
            {extraMembers > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/30 px-1 text-[10px] font-semibold ring-2 ring-white/60">
                +{extraMembers}
              </span>
            )}
          </div>
        )}
      </div>

      <StarButton board={board} className="absolute right-2 bottom-2 z-20" />
    </div>
  );
}

export function CreateBoardTile({ onClick }: { onClick: (e: MouseEvent<HTMLElement>) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-24 flex-col items-center justify-center gap-2 rounded-lg bg-surface-low text-sm text-ink transition-colors hover:bg-surface-mid"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded bg-white text-brand shadow-sm">
        <Plus size={18} />
      </span>
      Tạo bảng mới
    </button>
  );
}

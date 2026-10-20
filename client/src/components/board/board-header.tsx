'use client';

import { ListFilter, Lock, MoreHorizontal, SquareKanban, Trash2, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, givenName } from '@/components/avatar';
import { BackgroundPicker } from '@/components/boards/background-picker';
import { StarButton } from '@/components/boards/star-button';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { errorMessage } from '@/lib/api';
import type { BoardBackground } from '@/lib/board-backgrounds';
import type { BoardDetail, BoardMember } from '@/lib/boards-api';
import { EMPTY_FILTER, filterCount, type CardFilter } from '@/lib/card-filter';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { CardFilterPopoverContent } from './card-filter-popover';
import { InlineTitle } from './inline-title';
import { ShareBoardModal } from './share-board-modal';

const ICON_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded text-white/90 transition-colors hover:bg-white/15 hover:text-white aria-expanded:bg-white/20';

export function BoardHeader({
  board,
  actions,
  filter,
  matched,
  onFilterChange,
}: {
  board: BoardDetail;
  actions: BoardActions;
  filter: CardFilter;
  /** Số thẻ khớp bộ lọc (chỉ dùng khi đang lọc) */
  matched: number;
  onFilterChange: (filter: CardFilter) => void;
}) {
  const isAdmin = board.role === 'ADMIN';
  const owner = board.members.find((m) => m.role === 'ADMIN') ?? board.members[0];
  const menu = usePopoverAnchor();
  const filterMenu = usePopoverAnchor();
  const filtering = filterCount(filter) > 0;
  const [sharing, setSharing] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-black/25 px-4 text-white backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-1.5">
        <InlineTitle
          as="h1"
          value={board.title}
          editable={isAdmin}
          label="tên bảng"
          maxLength={100}
          onSave={(title) => void actions.updateBoard({ title })}
          className="max-w-[40vw] truncate rounded px-2.5 py-1 text-base font-semibold tracking-tight hover:bg-white/10"
          inputClassName="h-8 w-64 bg-white px-2.5 text-base font-semibold text-ink ring-2 ring-brand"
        />
        <StarButton board={board} alwaysVisible onChange={actions.setStarredLocal} className="flex h-8 w-8 items-center justify-center" />
        <span className="mx-1 h-5 w-px bg-white/20" />
        <span className="hidden items-center gap-1.5 rounded bg-white/20 px-3 py-1.5 text-sm font-medium shadow-sm sm:flex">
          <SquareKanban size={18} />
          Bảng
        </span>
        {owner && (
          <span className="hidden items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 text-xs text-white/90 md:flex">
            <Lock size={14} className="text-white/70" />
            Không gian của {givenName(owner.name)}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <MemberStack members={board.members} onClick={() => setSharing(true)} />
        <button
          type="button"
          onClick={() => setSharing(true)}
          aria-haspopup="dialog"
          aria-label="Chia sẻ bảng"
          className="flex h-8 items-center gap-1.5 rounded bg-white px-2.5 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-surface-low sm:px-3"
        >
          <UserPlus size={18} />
          <span className="hidden sm:inline">Chia sẻ</span>
        </button>
        {/* Luôn giữ cùng 1 nút mở popover (đổi kiểu khi đang lọc) để popover không mất chỗ neo */}
        <div className={cn('flex h-8 items-center rounded', filtering && 'bg-white text-sm font-medium text-ink shadow-sm')}>
          <button
            type="button"
            onClick={filterMenu.toggle}
            aria-haspopup="dialog"
            aria-expanded={!!filterMenu.anchor}
            aria-label={filtering ? `Lọc thẻ: ${filterCount(filter)} điều kiện, ${matched} thẻ khớp` : 'Lọc thẻ'}
            title="Lọc thẻ"
            className={
              filtering
                ? 'flex h-full items-center gap-1.5 rounded-l pr-1.5 pl-2.5 transition-colors hover:bg-surface-low'
                : ICON_BUTTON
            }
          >
            <ListFilter size={filtering ? 18 : 19} />
            {filtering && (
              <>
                <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{filterCount(filter)}</span>
                <span className="hidden whitespace-nowrap sm:inline">{matched} thẻ</span>
              </>
            )}
          </button>
          {filtering && (
            <button
              type="button"
              onClick={() => onFilterChange(EMPTY_FILTER)}
              aria-label="Xoá bộ lọc"
              title="Xoá bộ lọc"
              className="flex h-full items-center rounded-r border-l border-surface-high px-1.5 text-ink-subtle transition-colors hover:bg-surface-low hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={menu.toggle}
          aria-label="Menu bảng"
          aria-haspopup="dialog"
          aria-expanded={!!menu.anchor}
          className={ICON_BUTTON}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>

      <Popover anchor={filterMenu.anchor} onClose={filterMenu.close} label="Lọc thẻ" align="end" width={340}>
        <CardFilterPopoverContent board={board} filter={filter} onChange={onFilterChange} onClose={filterMenu.close} />
      </Popover>

      <Popover anchor={menu.anchor} onClose={menu.close} label="Menu bảng" align="end" width={320}>
        <BoardMenuContent board={board} actions={actions} onClose={menu.close} />
      </Popover>

      {sharing && <ShareBoardModal board={board} actions={actions} onClose={() => setSharing(false)} />}
    </header>
  );
}

function MemberStack({ members, onClick }: { members: BoardMember[]; onClick: () => void }) {
  const shown = members.slice(0, 3);
  const extra = members.length - shown.length;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${members.length} thành viên — xem và quản lý`}
      title="Thành viên của bảng"
      className="flex -space-x-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {shown.map((m) => (
        <Avatar key={m.id} name={m.name} seed={m.id} size={28} className="ring-2 ring-white/30" />
      ))}
      {extra > 0 && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-high px-1 text-[11px] font-medium text-ink ring-2 ring-white/30">
          +{extra}
        </span>
      )}
    </button>
  );
}

function BoardMenuContent({ board, actions, onClose }: { board: BoardDetail; actions: BoardActions; onClose: () => void }) {
  const router = useRouter();
  const isAdmin = board.role === 'ADMIN';
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteBoard() {
    setDeleting(true);
    try {
      await actions.deleteBoard();
      toast.success(`Đã xoá bảng "${board.title}"`);
      router.replace('/boards');
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(false);
    }
  }

  if (confirming) {
    return (
      <>
        <PopoverHeader title="Xoá bảng?" onClose={onClose} />
        <p className="px-1 text-sm text-ink-subtle">
          Bảng <strong className="text-ink">&quot;{board.title}&quot;</strong> cùng toàn bộ danh sách và thẻ sẽ bị xoá vĩnh
          viễn, không thể khôi phục.
        </p>
        <button
          type="button"
          onClick={() => void deleteBoard()}
          disabled={deleting}
          className="mt-3 h-9 w-full rounded bg-danger text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {deleting ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
        </button>
      </>
    );
  }

  return (
    <>
      <PopoverHeader title="Menu" onClose={onClose} />
      <BackgroundPicker
        value={board.background}
        disabled={!isAdmin}
        onChange={(background: BoardBackground) => void actions.updateBoard({ background })}
      />
      <hr className="-mx-3 my-3 border-surface-high" />
      {isAdmin ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/40"
        >
          <Trash2 size={16} />
          Xoá bảng
        </button>
      ) : (
        <p className="px-1 text-xs text-ink-subtle">Chỉ quản trị viên của bảng mới có thể đổi phông nền hoặc xoá bảng.</p>
      )}
    </>
  );
}

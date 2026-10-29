'use client';

import { Check, LoaderCircle, Lock, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { VISIBILITY_OPTIONS, type BoardDetail, type BoardVisibility } from '@/lib/boards-api';
import { cn } from '@/lib/cn';
import type { BoardActions } from '@/lib/use-board';
import { useWorkspaces } from '@/lib/workspaces-store';

const CHIP = 'hidden max-w-60 items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 text-xs text-white/90 md:flex';

const VisibilityIcon = ({ visibility }: { visibility: BoardVisibility }) =>
  visibility === 'PRIVATE' ? (
    <Lock size={14} className="shrink-0 text-white/70" aria-label="Riêng tư" />
  ) : (
    <Users size={14} className="shrink-0 text-white/70" aria-label="Hiển thị với không gian" />
  );

/**
 * Chip "không gian · chế độ hiển thị" trên header bảng.
 * ADMIN của bảng: bấm để đổi chế độ hiển thị / chuyển sang không gian khác (mình phải thuộc không gian đích).
 * Người khác: thuộc không gian → link sang trang không gian; không thuộc → nhãn "Khách".
 */
export function BoardPlacement({ board, actions }: { board: BoardDetail; actions: BoardActions }) {
  const workspaces = useWorkspaces();
  const menu = usePopoverAnchor();
  const member = workspaces.some((w) => w.id === board.workspace.id);
  const label = VISIBILITY_OPTIONS.find((o) => o.value === board.visibility)?.label ?? '';
  const title = `Không gian ${board.workspace.name} · ${label}`;
  const content = (
    <>
      <VisibilityIcon visibility={board.visibility} />
      <span className="truncate">{board.workspace.name}</span>
      {!member && <span className="shrink-0 rounded bg-white/20 px-1 text-[10px] font-medium">Khách</span>}
    </>
  );

  if (board.role === 'ADMIN') {
    return (
      <>
        <button
          type="button"
          onClick={menu.toggle}
          aria-haspopup="dialog"
          aria-expanded={!!menu.anchor}
          title={`${title} — bấm để đổi`}
          className={cn(CHIP, 'transition-colors hover:bg-white/20 aria-expanded:bg-white/25')}
        >
          {content}
        </button>
        <Popover anchor={menu.anchor} onClose={menu.close} label="Không gian và chế độ hiển thị" width={320}>
          {/* Form mount lại mỗi lần mở → lấy giá trị hiện tại */}
          <PlacementForm board={board} actions={actions} onClose={menu.close} />
        </Popover>
      </>
    );
  }
  return member ? (
    <Link href={`/w/${board.workspace.id}`} title={title} className={cn(CHIP, 'transition-colors hover:bg-white/20')}>
      {content}
    </Link>
  ) : (
    <span title={`Bạn là khách của không gian ${board.workspace.name}`} className={CHIP}>
      {content}
    </span>
  );
}

function PlacementForm({ board, actions, onClose }: { board: BoardDetail; actions: BoardActions; onClose: () => void }) {
  const workspaces = useWorkspaces();
  const [visibility, setVisibility] = useState(board.visibility);
  const [workspaceId, setWorkspaceId] = useState(board.workspace.id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Là khách của không gian hiện tại (ADMIN bảng nhưng không thuộc không gian) → vẫn hiện để giữ nguyên được
  const options = workspaces.some((w) => w.id === board.workspace.id) ? workspaces : [board.workspace, ...workspaces];
  const moving = workspaceId !== board.workspace.id;
  const unchanged = !moving && visibility === board.visibility;

  async function save() {
    if (unchanged || pending) return;
    setPending(true);
    setError(null);
    try {
      await actions.updatePlacement({
        ...(visibility !== board.visibility && { visibility }),
        ...(moving && { workspaceId }),
      });
      const target = options.find((w) => w.id === workspaceId)?.name;
      toast.success(moving ? `Đã chuyển bảng sang "${target}"` : 'Đã đổi chế độ hiển thị');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <>
      <PopoverHeader title="Không gian và chế độ hiển thị" onClose={onClose} />
      <label htmlFor="board-workspace-move" className="mb-1.5 block text-xs font-semibold">
        Không gian làm việc
      </label>
      <select
        id="board-workspace-move"
        value={workspaceId}
        onChange={(e) => setWorkspaceId(e.target.value)}
        className="h-9 w-full rounded bg-card px-2 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
      >
        {options.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.id === board.workspace.id ? ' (hiện tại)' : ''}
          </option>
        ))}
      </select>
      {moving && (
        <p className="mt-1.5 text-xs text-ink-subtle">Thành viên bảng giữ nguyên; ai không thuộc không gian mới sẽ thành khách ở đó.</p>
      )}

      <p className="mt-3 mb-1.5 text-xs font-semibold">Chế độ hiển thị</p>
      <div role="radiogroup" aria-label="Chế độ hiển thị" className="flex flex-col gap-1">
        {VISIBILITY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={visibility === o.value}
            onClick={() => setVisibility(o.value)}
            className={cn(
              'flex items-start gap-2 rounded px-2 py-2 text-left transition-colors hover:bg-surface-low',
              visibility === o.value && 'bg-surface-low',
            )}
          >
            {o.value === 'PRIVATE' ? <Lock size={16} className="mt-0.5 shrink-0 text-ink-subtle" /> : <Users size={16} className="mt-0.5 shrink-0 text-ink-subtle" />}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">{o.label}</span>
              <span className="block text-xs text-ink-subtle">{o.description}</span>
            </span>
            {visibility === o.value && <Check size={16} className="mt-0.5 shrink-0 text-brand" />}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={unchanged || pending}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
      >
        {pending && <LoaderCircle size={16} className="animate-spin" />}
        Lưu
      </button>
    </>
  );
}

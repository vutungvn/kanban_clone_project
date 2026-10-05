'use client';

import { Check, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Popover, PopoverHeader } from '@/components/popover';
import { Alert } from '@/components/ui';
import { BACKGROUND_KEYS, BOARD_BACKGROUNDS, type BoardBackground } from '@/lib/board-backgrounds';
import { boardsStore, type BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

export function CreateBoardPopover({
  anchor,
  onClose,
  onCreated,
}: {
  anchor: HTMLElement | null;
  onClose: () => void;
  onCreated?: (board: BoardSummary) => void;
}) {
  return (
    <Popover anchor={anchor} onClose={onClose} label="Tạo bảng">
      {/* Form mount lại mỗi lần mở → tự reset state */}
      <CreateBoardForm onClose={onClose} onCreated={onCreated} />
    </Popover>
  );
}

function CreateBoardForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (board: BoardSummary) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState<BoardBackground>('blue');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed || !user || pending) return;
    setPending(true);
    setError(null);
    try {
      const board = await boardsStore.create({ title: trimmed, background }, { id: user.id, name: user.name });
      onCreated?.(board);
      onClose();
    } catch {
      setError('Không thể tạo bảng, vui lòng thử lại');
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <PopoverHeader title="Tạo bảng" onClose={onClose} />

      <BoardPreview background={background} />

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-xs font-semibold">Phông nền</legend>
        <div className="grid grid-cols-6 gap-1.5">
          {BACKGROUND_KEYS.map((key) => {
            const selected = key === background;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setBackground(key)}
                aria-label={BOARD_BACKGROUNDS[key].label}
                aria-pressed={selected}
                title={BOARD_BACKGROUNDS[key].label}
                className={cn(
                  'flex h-8 items-center justify-center rounded bg-linear-to-br text-white transition hover:opacity-90',
                  BOARD_BACKGROUNDS[key].className,
                  selected && 'ring-2 ring-brand ring-offset-1',
                )}
              >
                {selected && <Check size={14} strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="board-title" className="mt-3 mb-1.5 block text-xs font-semibold">
        Tiêu đề bảng <span className="text-danger">*</span>
      </label>
      <input
        id="board-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="h-9 w-full rounded bg-white px-3 text-sm text-ink shadow-[0_0_0_1px_rgba(9,30,66,0.14)] transition-shadow outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
      />
      {!trimmed && <p className="mt-1.5 text-xs text-ink-subtle">👋 Tiêu đề bảng là bắt buộc</p>}

      {error && (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <button
        type="submit"
        disabled={!trimmed || pending}
        className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-surface-mid disabled:text-outline"
      >
        {pending && <LoaderCircle size={16} className="animate-spin" />}
        Tạo mới
      </button>
    </form>
  );
}

/** Ảnh xem trước: phông nền + 3 cột list thu nhỏ */
function BoardPreview({ background }: { background: BoardBackground }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-24 justify-center gap-1.5 rounded bg-linear-to-br pt-3 transition-colors',
        BOARD_BACKGROUNDS[background].className,
      )}
    >
      {['h-12', 'h-16', 'h-9'].map((h) => (
        <div key={h} className={cn('w-14 rounded-sm bg-white/70', h)} />
      ))}
    </div>
  );
}

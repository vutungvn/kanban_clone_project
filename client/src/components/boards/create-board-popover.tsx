'use client';

import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Popover, PopoverHeader } from '@/components/popover';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { BOARD_BACKGROUNDS, type BoardBackground } from '@/lib/board-backgrounds';
import { boardsStore, type BoardSummary } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { BackgroundPicker } from './background-picker';

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
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [background, setBackground] = useState<BoardBackground>('blue');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const board = await boardsStore.create({ title: trimmed, background });
      onCreated?.(board);
      onClose();
      // Giống Trello: tạo xong mở luôn bảng mới
      router.push(`/b/${board.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <PopoverHeader title="Tạo bảng" onClose={onClose} />

      <BoardPreview background={background} />

      <div className="mt-3">
        <BackgroundPicker value={background} onChange={setBackground} />
      </div>

      <label htmlFor="board-title" className="mt-3 mb-1.5 block text-xs font-semibold">
        Tiêu đề bảng <span className="text-danger">*</span>
      </label>
      <input
        id="board-title"
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={100}
        className="h-9 w-full rounded bg-card px-3 text-sm text-ink shadow-[0_0_0_1px_var(--color-hairline)] transition-shadow outline-none focus:shadow-[0_0_0_2px_var(--color-brand)]"
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
      <Link
        href="/templates"
        onClick={onClose}
        className="mt-2 flex h-9 w-full items-center justify-center rounded text-sm font-medium text-ink transition-colors hover:bg-surface-low"
      >
        Bắt đầu từ mẫu →
      </Link>
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
        <div key={h} className={cn('w-14 rounded-sm bg-card/70', h)} />
      ))}
    </div>
  );
}

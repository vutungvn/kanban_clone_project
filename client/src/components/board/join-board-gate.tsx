'use client';

import { LoaderCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from '@/components/toast';
import { Alert } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { backgroundClass } from '@/lib/board-backgrounds';
import { boardsApi, type BoardPreview } from '@/lib/boards-api';
import { boardsStore } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

/**
 * Mở link bảng mà không phải thành viên: bảng chế độ Không gian + mình thuộc không gian → màn "Tham gia bảng";
 * còn lại (riêng tư / không tồn tại / không thuộc không gian) → `notFound`.
 */
export function JoinBoardGate({ boardId, notFound, onJoined }: { boardId: string; notFound: ReactNode; onJoined: () => void }) {
  const [preview, setPreview] = useState<BoardPreview | null | 'none'>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    boardsApi.preview(boardId).then(
      (p) => {
        if (cancelled) return;
        // Vừa được thêm vào bảng ở nơi khác → mở thẳng bảng
        if (p.isMember) onJoined();
        else setPreview(p);
      },
      () => !cancelled && setPreview('none'),
    );
    return () => {
      cancelled = true;
    };
  }, [boardId, onJoined]);

  async function join() {
    setPending(true);
    setError(null);
    try {
      const board = await boardsApi.join(boardId);
      boardsStore.upsert(board);
      toast.success(`Đã tham gia bảng "${board.title}"`);
      onJoined();
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  if (preview === null) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <LoaderCircle size={24} className="animate-spin text-ink-subtle" aria-label="Đang tải" />
      </div>
    );
  }
  if (preview === 'none') return <>{notFound}</>;

  return (
    <div className={cn('flex h-[calc(100vh-3rem)] items-center justify-center bg-linear-to-br px-4', backgroundClass(preview.background))}>
      <div className="w-full max-w-sm rounded-xl bg-card p-6 text-center text-ink shadow-[0_20px_48px_rgba(9,30,66,0.35)]">
        <p className="text-xs font-semibold tracking-wider text-ink-subtle uppercase">Không gian {preview.workspace.name}</p>
        <h1 className="mt-2 text-xl font-semibold wrap-break-word">{preview.title}</h1>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-ink-subtle">
          <Users size={15} />
          {preview.memberCount} thành viên
        </p>
        <p className="mt-4 text-sm text-ink-subtle">Bảng này hiển thị với mọi thành viên không gian. Tham gia để xem và làm việc trên bảng.</p>
        {error && (
          <div className="mt-3 text-left">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <button
          type="button"
          onClick={() => void join()}
          disabled={pending}
          className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded bg-brand text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending && <LoaderCircle size={16} className="animate-spin" />}
          Tham gia bảng
        </button>
        <Link href={`/w/${preview.workspace.id}`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
          Về trang không gian
        </Link>
      </div>
    </div>
  );
}

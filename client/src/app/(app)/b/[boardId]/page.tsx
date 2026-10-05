'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { StarButton } from '@/components/boards/star-button';
import { BOARD_BACKGROUNDS } from '@/lib/board-backgrounds';
import { boardsStore, useBoards } from '@/lib/boards-store';
import { cn } from '@/lib/cn';

/** Trang board tạm — chỉ có header. Danh sách & thẻ làm ở bước sau. */
export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const board = useBoards().find((b) => b.id === boardId);

  useEffect(() => {
    boardsStore.markViewed(boardId);
  }, [boardId]);

  if (!board) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-24 text-center">
        <p className="text-lg font-semibold">Không tìm thấy bảng</p>
        <p className="text-sm text-ink-subtle">Bảng không tồn tại hoặc bạn không có quyền truy cập.</p>
        <Link href="/boards" className="mt-2 text-sm font-semibold text-brand hover:underline">
          ← Về danh sách bảng
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-[calc(100vh-3rem)] flex-col bg-linear-to-br',
        BOARD_BACKGROUNDS[board.background].className,
      )}
    >
      <div className="flex h-14 items-center gap-1 bg-black/25 px-4 text-white backdrop-blur-sm">
        <h1 className="px-1 text-lg font-bold">{board.title}</h1>
        <StarButton board={board} alwaysVisible />
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="rounded-lg bg-white/15 px-4 py-3 text-sm text-white backdrop-blur-sm">
          Giao diện danh sách &amp; thẻ sẽ được làm ở bước tiếp theo.
        </p>
      </div>
    </div>
  );
}

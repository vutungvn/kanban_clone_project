'use client';

import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BoardCanvas } from '@/components/board/board-canvas';
import { BoardHeader } from '@/components/board/board-header';
import { CardDetailModal, useCardParam } from '@/components/board/card-detail-modal';
import { JoinBoardGate } from '@/components/board/join-board-gate';
import { backgroundClass } from '@/lib/board-backgrounds';
import { EMPTY_FILTER, filterCount, filterLists } from '@/lib/card-filter';
import { cn } from '@/lib/cn';
import { useBoard } from '@/lib/use-board';
import { useBoardRealtime } from '@/lib/use-board-realtime';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { board, status, error, actions } = useBoard(boardId);
  useBoardRealtime(boardId, actions);
  const cardParam = useCardParam();
  const [filter, setFilter] = useState(EMPTY_FILTER);
  // Đang lọc: danh sách chỉ còn thẻ khớp (null = không lọc)
  const filtered = useMemo(() => (board && filterCount(filter) > 0 ? filterLists(board, filter) : null), [board, filter]);

  // Sang bảng khác → bỏ lọc (nhãn / thành viên của bảng cũ không còn ý nghĩa)
  useEffect(() => setFilter(EMPTY_FILTER), [boardId]);

  useEffect(() => {
    if (board) document.title = `${board.title} | Kanban`;
  }, [board]);

  if (status === 'loading') return <BoardLoading />;

  if (status === 'not-found') {
    // Bảng chế độ Không gian mà mình thuộc không gian → cho tham gia; còn lại báo không tìm thấy
    return (
      <JoinBoardGate
        key={boardId}
        boardId={boardId}
        onJoined={actions.reload}
        notFound={
          <CenteredMessage title="Không tìm thấy bảng" description="Bảng không tồn tại hoặc bạn không phải thành viên của bảng.">
            <Link href="/boards" className="text-sm font-semibold text-brand hover:underline">
              ← Về danh sách bảng
            </Link>
          </CenteredMessage>
        }
      />
    );
  }

  if (status === 'error' || !board) {
    return (
      <CenteredMessage title="Không tải được bảng" description={error ?? undefined}>
        <button type="button" onClick={actions.reload} className="text-sm font-semibold text-brand hover:underline">
          Thử lại
        </button>
      </CenteredMessage>
    );
  }

  return (
    <div className={cn('flex h-[calc(100vh-3rem)] flex-col bg-linear-to-br', backgroundClass(board.background))}>
      <BoardHeader board={board} actions={actions} filter={filter} matched={filtered?.matched ?? 0} onFilterChange={setFilter} />
      <BoardCanvas board={board} actions={actions} filteredLists={filtered?.lists ?? null} />
      {cardParam.cardId && (
        <CardDetailModal key={cardParam.cardId} board={board} cardId={cardParam.cardId} actions={actions} onClose={cardParam.close} />
      )}
    </div>
  );
}

function BoardLoading() {
  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col bg-linear-to-br from-slate-500 to-slate-400" aria-busy="true">
      <div className="flex h-14 items-center bg-black/25 px-4">
        <div className="h-6 w-48 animate-pulse rounded bg-white/30" />
      </div>
      <div className="flex items-start gap-3 px-4 pt-3">
        {[180, 260, 120].map((h) => (
          <div key={h} style={{ height: h }} className="w-68 animate-pulse rounded-xl bg-white/30" />
        ))}
        <LoaderCircle size={24} className="mt-4 animate-spin text-white" aria-label="Đang tải bảng" />
      </div>
    </div>
  );
}

function CenteredMessage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-24 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {description && <p className="text-sm text-ink-subtle">{description}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

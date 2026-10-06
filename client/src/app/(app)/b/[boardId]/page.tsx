'use client';

import { LayoutPanelLeft, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { BoardHeader } from '@/components/board/board-header';
import { AddListComposer } from '@/components/board/composers';
import { ListColumn } from '@/components/board/list-column';
import { backgroundClass } from '@/lib/board-backgrounds';
import { cn } from '@/lib/cn';
import { useBoard } from '@/lib/use-board';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { board, status, error, actions } = useBoard(boardId);

  useEffect(() => {
    if (board) document.title = `${board.title} | Kanban`;
  }, [board]);

  if (status === 'loading') return <BoardLoading />;

  if (status === 'not-found') {
    return (
      <CenteredMessage title="Không tìm thấy bảng" description="Bảng không tồn tại hoặc bạn không phải thành viên của bảng.">
        <Link href="/boards" className="text-sm font-semibold text-brand hover:underline">
          ← Về danh sách bảng
        </Link>
      </CenteredMessage>
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

  const canEdit = board.role !== 'VIEWER';
  const empty = board.lists.length === 0;

  return (
    <div className={cn('flex h-[calc(100vh-3rem)] flex-col bg-linear-to-br', backgroundClass(board.background))}>
      <BoardHeader board={board} actions={actions} />

      {/* Canvas: cuộn ngang; mỗi cột tự cuộn dọc */}
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-4 pt-3 pb-4">
        {board.lists.map((list) => (
          <ListColumn key={list.id} list={list} canEdit={canEdit} actions={actions} />
        ))}

        {canEdit && <AddListComposer onAdd={actions.addList} hasLists={!empty} defaultOpen={empty} />}

        {empty &&
          (canEdit ? (
            <div className="flex w-68 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-dashed border-white/40 bg-white/10 px-4 py-6 text-center text-white/80">
              <LayoutPanelLeft size={22} />
              <p className="text-[11px] font-semibold tracking-wider uppercase">Bảng còn trống</p>
              <p className="text-xs">Tạo danh sách đầu tiên như &quot;Cần làm&quot;, &quot;Đang làm&quot; hoặc &quot;Hoàn thành&quot;.</p>
            </div>
          ) : (
            <p className="rounded-lg bg-black/20 px-4 py-3 text-sm text-white">Bảng chưa có danh sách nào.</p>
          ))}
      </div>
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

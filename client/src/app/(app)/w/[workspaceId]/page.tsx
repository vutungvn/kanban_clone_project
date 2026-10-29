'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { BoardTile, CreateBoardTile } from '@/components/boards/board-tile';
import { CreateBoardPopover } from '@/components/boards/create-board-popover';
import { usePopoverAnchor } from '@/components/popover';
import { WorkspacePage } from '@/components/workspaces/workspace-page';
import { compareRecent, useBoardsState } from '@/lib/boards-store';

/** /w/:id — các bảng của không gian mà mình là thành viên bảng (mở gần đây trước). */
export default function WorkspaceBoardsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { boards, status } = useBoardsState();
  const createBoard = usePopoverAnchor();
  const inWorkspace = useMemo(
    () => boards.filter((b) => b.workspace.id === workspaceId).sort(compareRecent),
    [boards, workspaceId],
  );

  return (
    <WorkspacePage workspaceId={workspaceId}>
      {() => (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-ink">
            Bảng của bạn trong không gian
            {status === 'ready' && <span className="ml-2 text-sm font-normal text-ink-subtle">{inWorkspace.length}</span>}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {status !== 'ready'
              ? Array.from({ length: 4 }, (_, i) => <div key={i} aria-hidden className="h-24 animate-pulse rounded-lg bg-surface-mid" />)
              : inWorkspace.map((board) => <BoardTile key={board.id} board={board} />)}
            {status === 'ready' && <CreateBoardTile onClick={createBoard.toggle} />}
          </div>
          <CreateBoardPopover anchor={createBoard.anchor} onClose={createBoard.close} workspaceId={workspaceId} />
        </section>
      )}
    </WorkspacePage>
  );
}

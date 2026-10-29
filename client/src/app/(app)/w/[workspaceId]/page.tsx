'use client';

import { LoaderCircle, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardTile, CreateBoardTile } from '@/components/boards/board-tile';
import { CreateBoardPopover } from '@/components/boards/create-board-popover';
import { usePopoverAnchor } from '@/components/popover';
import { toast } from '@/components/toast';
import { WorkspacePage } from '@/components/workspaces/workspace-page';
import { errorMessage } from '@/lib/api';
import { backgroundClass } from '@/lib/board-backgrounds';
import { boardsApi } from '@/lib/boards-api';
import { boardsStore, compareRecent, useBoardsState } from '@/lib/boards-store';
import { cn } from '@/lib/cn';
import { getSocket } from '@/lib/realtime';
import { workspacesApi, type JoinableBoard } from '@/lib/workspaces-api';

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4';

/**
 * /w/:id — bảng của không gian: bảng mình đã tham gia (mở gần đây trước) +
 * bảng chế độ Không gian mình chưa tham gia (nút "Tham gia").
 */
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
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-ink">
              Bảng của bạn trong không gian
              {status === 'ready' && <span className="ml-2 text-sm font-normal text-ink-subtle">{inWorkspace.length}</span>}
            </h2>
            <div className={GRID}>
              {status !== 'ready'
                ? Array.from({ length: 4 }, (_, i) => <div key={i} aria-hidden className="h-24 animate-pulse rounded-lg bg-surface-mid" />)
                : inWorkspace.map((board) => <BoardTile key={board.id} board={board} />)}
              {status === 'ready' && <CreateBoardTile onClick={createBoard.toggle} />}
            </div>
            <CreateBoardPopover anchor={createBoard.anchor} onClose={createBoard.close} workspaceId={workspaceId} />
          </section>
          <JoinableBoards workspaceId={workspaceId} />
        </>
      )}
    </WorkspacePage>
  );
}

/** Bảng chế độ Không gian mình chưa tham gia. Có bảng đổi chế độ / chuyển không gian (realtime) → tải lại. */
function JoinableBoards({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [boards, setBoards] = useState<JoinableBoard[] | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(() => {
    workspacesApi.joinableBoards(workspaceId).then(setBoards, () => setBoards([]));
  }, [workspaceId]);
  useEffect(load, [load]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('workspaces:changed', load);
    return () => {
      socket.off('workspaces:changed', load);
    };
  }, [load]);

  async function join(board: JoinableBoard) {
    setJoining(board.id);
    try {
      boardsStore.upsert(await boardsApi.join(board.id));
      toast.success(`Đã tham gia bảng "${board.title}"`);
      router.push(`/b/${board.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setJoining(null);
      load();
    }
  }

  if (!boards?.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Bảng khác trong không gian</h2>
        <p className="text-sm text-ink-subtle">Bảng hiển thị với mọi thành viên không gian — tham gia để xem và làm việc.</p>
      </div>
      <div className={GRID}>
        {boards.map((board) => (
          <div key={board.id} className={cn('flex h-24 flex-col justify-between rounded-lg bg-linear-to-r p-3 text-white shadow-sm', backgroundClass(board.background))}>
            <h3 className="line-clamp-2 text-base leading-snug font-semibold tracking-tight drop-shadow-sm">{board.title}</h3>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs text-white/85">
                <Users size={13} />
                {board.memberCount}
              </span>
              <button
                type="button"
                onClick={() => void join(board)}
                disabled={!!joining}
                className="inline-flex h-7 items-center gap-1.5 rounded bg-white/90 px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-white disabled:opacity-60"
              >
                {joining === board.id && <LoaderCircle size={13} className="animate-spin" />}
                Tham gia
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

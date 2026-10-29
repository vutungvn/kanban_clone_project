"use client";

import { ChevronDown, Plus, Settings, Star, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  applyBoardFilter,
  BoardFilterButton,
  countActiveFilters,
  EMPTY_FILTER,
  type BoardFilter,
} from "@/components/boards/board-filter";
import { BoardTile, CreateBoardTile } from "@/components/boards/board-tile";
import { BoardsSidebar } from "@/components/boards/boards-sidebar";
import { CreateBoardPopover } from "@/components/boards/create-board-popover";
import { usePopoverAnchor } from "@/components/popover";
import { WorkspaceLogo } from "@/components/workspaces/workspace-logo";
import { boardsStore, compareRecent, useBoardsState } from "@/lib/boards-store";
import { WORKSPACE_ROLE_LABEL } from "@/lib/workspaces-api";
import { useWorkspacesState } from "@/lib/workspaces-store";

type SortKey = "recent" | "alpha";

/**
 * /boards — mọi bảng của tôi, nhóm theo không gian làm việc: "Đã đánh dấu sao", mỗi không gian 1 khối,
 * cuối cùng "Bảng khách" (bảng thuộc không gian mình không tham gia).
 */
export default function BoardsPage() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const { boards, status: rawStatus, error: loadError } = useBoardsState();
  const { workspaces } = useWorkspacesState();
  const status = rawStatus === "idle" ? "loading" : rawStatus;
  const createBoard = usePopoverAnchor();
  // Không gian chọn sẵn khi bấm "Tạo bảng" trong khối của 1 không gian
  const [createIn, setCreateIn] = useState<string | undefined>();
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);

  const visible = useMemo(
    () =>
      applyBoardFilter(boards, filter).sort(
        sort === "alpha"
          ? (a, b) => a.title.localeCompare(b.title, "vi")
          : compareRecent,
      ),
    [boards, filter, sort],
  );

  if (!user) return null;
  const filtering = countActiveFilters(filter) > 0;
  // Khi đã lọc "chỉ bảng gắn sao" thì mục "Đã đánh dấu sao" bị trùng → ẩn đi
  const starred = filter.starredOnly ? [] : visible.filter((b) => b.starred);
  const memberOf = new Set(workspaces.map((w) => w.id));
  const guestBoards = visible.filter((b) => !memberOf.has(b.workspace.id));

  const openCreate = (e: MouseEvent<HTMLElement>, workspaceId?: string) => {
    setCreateIn(workspaceId);
    createBoard.toggle(e);
  };

  return (
    <div className="flex">
      <BoardsSidebar />

      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-300 flex-col gap-8 px-6 py-8 lg:px-10">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Bảng của bạn</h1>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {status === "ready"
                  ? filtering
                    ? `${visible.length}/${boards.length} bảng khớp bộ lọc`
                    : `${boards.length} bảng trong ${workspaces.length} không gian làm việc`
                  : "Đang tải..."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sắp xếp"
                  className="h-8 cursor-pointer appearance-none rounded bg-surface-low pr-8 pl-3 text-sm font-medium text-ink-subtle shadow-sm transition-colors outline-none hover:bg-surface-mid hover:text-ink focus:shadow-[0_0_0_2px_var(--color-brand)]"
                >
                  <option value="recent">Xem gần đây nhất</option>
                  <option value="alpha">Tên A–Z</option>
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute top-2 right-2 text-ink-subtle"
                />
              </div>
              <BoardFilterButton value={filter} onChange={setFilter} />
              <button
                type="button"
                onClick={(e) => openCreate(e)}
                className="flex h-8 items-center gap-1.5 rounded bg-brand px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
              >
                <Plus size={18} />
                Tạo bảng
              </button>
            </div>
          </header>

          {status === "error" ? (
            <p className="rounded-lg bg-surface-low px-4 py-6 text-center text-sm text-ink-subtle">
              {loadError}{" "}
              <button
                type="button"
                onClick={() => void boardsStore.load(true)}
                className="font-semibold text-brand hover:underline"
              >
                Thử lại
              </button>
            </p>
          ) : status === "loading" ? (
            <BoardSection icon={null} title="">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-24 animate-pulse rounded-lg bg-surface-mid"
                />
              ))}
            </BoardSection>
          ) : (
            <>
              {filtering && visible.length === 0 && (
                <p className="rounded-lg bg-surface-low px-4 py-6 text-center text-sm text-ink-subtle">
                  Không có bảng nào khớp với bộ lọc.{" "}
                  <button
                    type="button"
                    onClick={() => setFilter(EMPTY_FILTER)}
                    className="font-semibold text-brand hover:underline"
                  >
                    Xoá bộ lọc
                  </button>
                </p>
              )}

              {starred.length > 0 && (
                <BoardSection
                  icon={<Star size={20} className="text-amber-500" fill="currentColor" />}
                  title="Đã đánh dấu sao"
                >
                  {starred.map((board) => (
                    <BoardTile key={board.id} board={board} />
                  ))}
                </BoardSection>
              )}

              {workspaces.map((workspace) => {
                const inWorkspace = visible.filter((b) => b.workspace.id === workspace.id);
                // Đang lọc thì ẩn không gian không có bảng khớp
                if (filtering && !inWorkspace.length) return null;
                return (
                  <BoardSection
                    key={workspace.id}
                    icon={<WorkspaceLogo workspace={workspace} size={28} />}
                    title={workspace.name}
                    aside={
                      <div className="flex items-center gap-1">
                        <span className="mr-1 text-xs text-ink-subtle">{WORKSPACE_ROLE_LABEL[workspace.role]}</span>
                        <Link
                          href={`/w/${workspace.id}/settings`}
                          className="flex h-8 items-center gap-1.5 rounded bg-surface-low px-2.5 text-xs font-medium text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
                        >
                          <Settings size={14} />
                          Cài đặt
                        </Link>
                      </div>
                    }
                    titleHref={`/w/${workspace.id}`}
                  >
                    {inWorkspace.map((board) => (
                      <BoardTile key={board.id} board={board} />
                    ))}
                    {!filtering && <CreateBoardTile onClick={(e) => openCreate(e, workspace.id)} />}
                  </BoardSection>
                );
              })}

              {guestBoards.length > 0 && (
                <BoardSection
                  icon={<Users size={20} className="text-ink-subtle" />}
                  title="Bảng khách"
                  aside={
                    <span className="text-xs text-ink-subtle">
                      Bảng thuộc không gian bạn không tham gia
                    </span>
                  }
                >
                  {guestBoards.map((board) => (
                    <BoardTile key={board.id} board={board} />
                  ))}
                </BoardSection>
              )}
            </>
          )}
        </div>
      </main>

      <CreateBoardPopover
        anchor={createBoard.anchor}
        onClose={createBoard.close}
        workspaceId={createIn}
      />
    </div>
  );
}

function BoardSection({
  icon,
  title,
  titleHref,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  /** Tiêu đề là link (vd sang trang của không gian) */
  titleHref?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            {icon}
            {titleHref ? (
              <Link href={titleHref} className="truncate hover:underline">
                {title}
              </Link>
            ) : (
              <span className="truncate">{title}</span>
            )}
          </h2>
          {aside}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

'use client';

import { LoaderCircle, Settings, SquareKanban, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BoardsSidebar } from '@/components/boards/boards-sidebar';
import { cn } from '@/lib/cn';
import { WORKSPACE_ROLE_LABEL, type Workspace } from '@/lib/workspaces-api';
import { useWorkspacesState } from '@/lib/workspaces-store';
import { WorkspaceLogo } from './workspace-logo';

/**
 * Khung chung của các trang /w/:id/... — sidebar, đầu trang (logo, tên, mô tả, vai trò) và tab Bảng / Cài đặt.
 * Không gian không có trong danh sách của mình (không tồn tại / không phải thành viên) → báo không tìm thấy.
 */
export function WorkspacePage({ workspaceId, children }: { workspaceId: string; children: (workspace: Workspace) => ReactNode }) {
  const { workspaces, status, error } = useWorkspacesState();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const pathname = usePathname();

  return (
    <div className="flex">
      <BoardsSidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto flex w-full max-w-300 flex-col gap-6 px-6 py-8 lg:px-10">
          {workspace ? (
            <>
              <header className="flex flex-col gap-4 border-b border-surface-high pb-5">
                <div className="flex items-start gap-4">
                  <WorkspaceLogo workspace={workspace} size={56} className="rounded-lg" />
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{workspace.name}</h1>
                    {workspace.description && <p className="mt-1 text-sm whitespace-pre-line text-ink-subtle">{workspace.description}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-subtle">
                      <Users size={13} />
                      {workspace.memberCount} thành viên · Bạn là {WORKSPACE_ROLE_LABEL[workspace.role].toLowerCase()}
                    </p>
                  </div>
                </div>
                <nav aria-label="Không gian làm việc" className="flex gap-1">
                  <Tab href={`/w/${workspace.id}`} active={pathname === `/w/${workspace.id}`} icon={<SquareKanban size={16} />}>
                    Bảng
                  </Tab>
                  <Tab href={`/w/${workspace.id}/members`} active={pathname === `/w/${workspace.id}/members`} icon={<Users size={16} />}>
                    Thành viên
                  </Tab>
                  <Tab href={`/w/${workspace.id}/settings`} active={pathname === `/w/${workspace.id}/settings`} icon={<Settings size={16} />}>
                    Cài đặt
                  </Tab>
                </nav>
              </header>
              {children(workspace)}
            </>
          ) : status === 'error' ? (
            <p className="py-16 text-center text-sm text-danger">{error}</p>
          ) : status === 'ready' ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <h1 className="text-lg font-semibold text-ink">Không tìm thấy không gian làm việc</h1>
              <p className="text-sm text-ink-subtle">Không gian này không tồn tại hoặc bạn không phải thành viên.</p>
              <Link href="/boards" className="text-sm font-semibold text-brand hover:underline">
                Về trang Bảng
              </Link>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-ink-subtle">
              <LoaderCircle size={16} className="animate-spin" />
              Đang tải...
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Tab({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-surface-high text-brand-hover' : 'text-ink-subtle hover:bg-surface-low hover:text-ink',
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

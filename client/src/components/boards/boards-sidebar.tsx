'use client';

import {
  Activity,
  Award,
  ChevronDown,
  House,
  LayoutDashboard,
  LayoutTemplate,
  Plus,
  Settings,
  SquareKanban,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ComingSoonBadge } from '@/components/ui';
import { CreateWorkspaceModal } from '@/components/workspaces/create-workspace-modal';
import { WorkspaceLogo } from '@/components/workspaces/workspace-logo';
import { cn } from '@/lib/cn';
import type { Workspace } from '@/lib/workspaces-api';
import { useWorkspacesState } from '@/lib/workspaces-store';

type NavItem = { icon: LucideIcon; label: string; href?: string };

// Mục không có href = chưa có trang → hiển thị "Sắp có". Mục đang mở sáng theo đường dẫn hiện tại.
const MAIN_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Bảng', href: '/boards' },
  { icon: House, label: 'Trang chủ', href: '/home' },
  { icon: Activity, label: 'Hoạt động', href: '/activity' },
  { icon: LayoutTemplate, label: 'Mẫu', href: '/templates' },
];

const workspaceNav = (workspace: Workspace): NavItem[] => [
  { icon: SquareKanban, label: 'Bảng', href: `/w/${workspace.id}` },
  // Giai đoạn 2: trang Thành viên
  { icon: Users, label: 'Thành viên' },
  { icon: Settings, label: 'Cài đặt', href: `/w/${workspace.id}/settings` },
];

/** Không gian đang xem theo đường dẫn /w/:id/... */
const workspaceIdOf = (pathname: string) => pathname.match(/^\/w\/([^/]+)/)?.[1] ?? null;

export function BoardsSidebar() {
  const pathname = usePathname();
  const { workspaces, status } = useWorkspacesState();
  const [creating, setCreating] = useState(false);
  // Mặc định mở không gian đang xem (hoặc không gian đầu tiên); người dùng tự đóng / mở các mục khác
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const current = workspaceIdOf(pathname) ?? workspaces[0]?.id;
  const isOpen = (id: string) => toggled[id] ?? id === current;

  return (
    <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col justify-between overflow-y-auto bg-card px-2 py-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)] lg:flex">
      <div>
        <nav aria-label="Điều hướng chính" className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <SidebarLink key={item.label} item={item} size="lg" />
          ))}
        </nav>

        <div className="mx-2 my-3 h-px bg-surface-high" />

        <div className="flex items-center justify-between px-3 py-1">
          <p className="text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">Không gian làm việc</p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Tạo không gian làm việc"
            title="Tạo không gian làm việc"
            className="rounded p-0.5 text-ink-subtle transition-colors hover:bg-surface-high hover:text-ink"
          >
            <Plus size={16} />
          </button>
        </div>

        {status !== 'ready' && !workspaces.length && (
          <div aria-hidden className="mx-3 mt-1 h-8 animate-pulse rounded bg-surface-mid" />
        )}
        {workspaces.map((workspace) => {
          const open = isOpen(workspace.id);
          const navId = `workspace-nav-${workspace.id}`;
          return (
            <div key={workspace.id} className="mt-0.5">
              <button
                type="button"
                onClick={() => setToggled((t) => ({ ...t, [workspace.id]: !open }))}
                aria-expanded={open}
                aria-controls={navId}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-high"
              >
                <WorkspaceLogo workspace={workspace} />
                <span className="flex-1 truncate text-left font-medium" title={workspace.name}>
                  {workspace.name}
                </span>
                <ChevronDown size={18} className={cn('shrink-0 text-ink-subtle transition-transform', !open && '-rotate-90')} />
              </button>
              {open && (
                <nav id={navId} aria-label={workspace.name} className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-6">
                  {workspaceNav(workspace).map((item) => (
                    <SidebarLink key={item.label} item={item} size="sm" />
                  ))}
                </nav>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-low p-2.5">
        <Award size={22} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">Nâng cấp Kanban</p>
          <p className="text-xs text-ink-subtle">Mở khóa bảng vô hạn</p>
        </div>
        <ComingSoonBadge />
      </div>

      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
    </aside>
  );
}

function SidebarLink({ item, size }: { item: NavItem; size: 'lg' | 'sm' }) {
  const { icon: Icon, label, href } = item;
  const pathname = usePathname();
  const active = pathname === href;
  const base = cn(
    'flex items-center rounded transition-colors',
    size === 'lg' ? 'gap-2 px-3 py-2 text-sm' : 'gap-2 px-2 py-1.5 text-xs',
  );
  const iconSize = size === 'lg' ? 20 : 16;

  if (!href) {
    return (
      <span aria-disabled className={cn(base, 'cursor-not-allowed text-ink-subtle/70')}>
        <Icon size={iconSize} />
        <span className="flex-1">{label}</span>
        <ComingSoonBadge />
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        active ? 'bg-surface-high font-bold text-brand-hover' : 'text-ink-subtle hover:bg-surface-high hover:text-ink',
      )}
    >
      <Icon size={iconSize} />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

'use client';

import {
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
import { useState } from 'react';
import { givenName } from '@/components/avatar';
import { ComingSoonBadge } from '@/components/ui';
import { cn } from '@/lib/cn';

type NavItem = { icon: LucideIcon; label: string; href?: string; active?: boolean };

// Mục không có href = chưa có trang → hiển thị "Sắp có"
const MAIN_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Bảng', href: '/boards', active: true },
  { icon: LayoutTemplate, label: 'Mẫu' },
  { icon: House, label: 'Trang chủ' },
];

const WORKSPACE_NAV: NavItem[] = [
  { icon: SquareKanban, label: 'Bảng công việc chính', href: '/boards' },
  { icon: Users, label: 'Thành viên' },
  { icon: Settings, label: 'Cài đặt' },
];

export function BoardsSidebar({ userName }: { userName: string }) {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const name = givenName(userName);

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
            disabled
            aria-label="Tạo không gian làm việc (sắp có)"
            title="Tạo không gian làm việc — Sắp có"
            className="cursor-not-allowed rounded p-0.5 text-ink-subtle/60"
          >
            <Plus size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setWorkspaceOpen((v) => !v)}
          aria-expanded={workspaceOpen}
          aria-controls="workspace-nav"
          className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-high"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-success text-[11px] font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 truncate text-left font-medium">Không gian của {name}</span>
          <ChevronDown
            size={18}
            className={cn('text-ink-subtle transition-transform', !workspaceOpen && '-rotate-90')}
          />
        </button>

        {workspaceOpen && (
          <nav id="workspace-nav" aria-label="Không gian làm việc" className="mt-1 flex flex-col gap-0.5 pl-6">
            {WORKSPACE_NAV.map((item) => (
              <SidebarLink key={item.label} item={item} size="sm" />
            ))}
          </nav>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-low p-2.5">
        <Award size={22} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">Nâng cấp Kanban</p>
          <p className="text-xs text-ink-subtle">Mở khóa bảng vô hạn</p>
        </div>
        <ComingSoonBadge />
      </div>
    </aside>
  );
}

function SidebarLink({ item, size }: { item: NavItem; size: 'lg' | 'sm' }) {
  const { icon: Icon, label, href, active } = item;
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

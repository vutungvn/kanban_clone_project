'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { CreateBoardPopover } from '@/components/boards/create-board-popover';
import { Logo } from '@/components/logo';
import { usePopoverAnchor } from '@/components/popover';
import { AccountMenu } from './account-menu';
import { HeaderSearch } from './header-search';
import { HelpMenu } from './help-menu';
import { NotificationsMenu } from './notifications-menu';
import { WorkspaceMenu } from './workspace-menu';

export function AppHeader() {
  const createBoard = usePopoverAnchor();

  return (
    <header className="sticky top-0 z-40 h-12 bg-navy text-white shadow-[0_1px_8px_rgba(0,0,0,0.08)]">
      <div className="flex h-full items-center justify-between gap-3 px-3">
        <div className="flex items-center gap-2">
          <Link href="/boards" className="mr-1 flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-white/10">
            <Logo size={28} />
            <span className="text-sm font-semibold tracking-tight">Kanban</span>
          </Link>
          <WorkspaceMenu />
          <button
            type="button"
            onClick={createBoard.toggle}
            aria-expanded={!!createBoard.anchor}
            className="ml-1 flex h-8 items-center gap-1.5 rounded bg-brand px-3 text-sm font-medium shadow-sm transition-colors hover:bg-brand-hover"
          >
            <Plus size={18} />
            Tạo mới
          </button>
        </div>

        <div className="flex items-center gap-2">
          <HeaderSearch />
          <NotificationsMenu />
          <HelpMenu />
          <AccountMenu />
        </div>
      </div>

      <CreateBoardPopover anchor={createBoard.anchor} onClose={createBoard.close} />
    </header>
  );
}

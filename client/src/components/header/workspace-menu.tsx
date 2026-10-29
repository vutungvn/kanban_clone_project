'use client';

import { Check, ChevronDown, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { CreateWorkspaceModal } from '@/components/workspaces/create-workspace-modal';
import { WorkspaceLogo } from '@/components/workspaces/workspace-logo';
import { WORKSPACE_ROLE_LABEL } from '@/lib/workspaces-api';
import { useWorkspacesState } from '@/lib/workspaces-store';
import { HEADER_TEXT_BUTTON } from './styles';

/** Menu chuyển nhanh giữa các không gian của mình + tạo không gian mới. */
export function WorkspaceMenu() {
  const { anchor, toggle, close } = usePopoverAnchor();
  const { workspaces, status } = useWorkspacesState();
  const [creating, setCreating] = useState(false);
  const current = usePathname().match(/^\/w\/([^/]+)/)?.[1];

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className={`${HEADER_TEXT_BUTTON} hidden md:flex`}
      >
        Không gian làm việc
        <ChevronDown size={16} />
      </button>

      <Popover anchor={anchor} onClose={close} label="Không gian làm việc">
        <PopoverHeader title="Không gian làm việc" onClose={close} />
        <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">Không gian của bạn</p>
        {status !== 'ready' && !workspaces.length ? (
          <div aria-hidden className="mx-1 h-10 animate-pulse rounded bg-surface-mid" />
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {workspaces.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/w/${w.id}`}
                  onClick={close}
                  aria-current={w.id === current ? 'page' : undefined}
                  className="flex items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-surface-mid"
                >
                  <WorkspaceLogo workspace={w} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{w.name}</span>
                    <span className="block text-xs text-ink-subtle">
                      {WORKSPACE_ROLE_LABEL[w.role]} · {w.memberCount} thành viên
                    </span>
                  </span>
                  {w.id === current && <Check size={16} className="shrink-0 text-brand" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <hr className="-mx-3 my-2 border-surface-high" />
        <button
          type="button"
          onClick={() => {
            close();
            setCreating(true);
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm transition-colors hover:bg-surface-mid"
        >
          <Plus size={16} className="text-ink-subtle" />
          Tạo không gian làm việc
        </button>
      </Popover>

      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
    </>
  );
}

'use client';

import { Check, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { givenName } from '@/components/avatar';
import { Popover, PopoverHeader, usePopoverAnchor } from '@/components/popover';
import { HEADER_TEXT_BUTTON } from './styles';

/** Hiện tại mỗi user có 1 không gian cá nhân; chừa sẵn chỗ cho nhiều không gian sau này. */
export function WorkspaceMenu() {
  const { user } = useAuth();
  const { anchor, toggle, close } = usePopoverAnchor();
  if (!user) return null;
  const name = givenName(user.name);

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
        <p className="px-1 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">
          Không gian hiện tại
        </p>
        <Link
          href="/boards"
          onClick={close}
          className="flex items-center gap-3 rounded px-2 py-2 transition-colors hover:bg-surface-mid"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-success text-sm font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">Không gian của {name}</span>
            <span className="block text-xs text-ink-subtle">Không gian cá nhân</span>
          </span>
          <Check size={16} className="text-brand" />
        </Link>
      </Popover>
    </>
  );
}

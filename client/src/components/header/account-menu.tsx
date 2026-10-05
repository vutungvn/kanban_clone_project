'use client';

import { ChevronRight, CircleUser, History, LogOut, Palette, Settings, X, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Popover, usePopoverAnchor } from '@/components/popover';
import { ComingSoonBadge } from '@/components/ui';

/** Các mục chưa có chức năng — hiển thị cho đủ bố cục, đánh dấu "Sắp có". */
const UPCOMING_ITEMS: { icon: LucideIcon; label: string; hint?: string }[] = [
  { icon: CircleUser, label: 'Hồ sơ và hiển thị' },
  { icon: History, label: 'Hoạt động' },
  { icon: Settings, label: 'Cài đặt' },
  { icon: Palette, label: 'Giao diện', hint: 'Sáng / Tối' },
];

export function AccountMenu() {
  const { user, logout } = useAuth();
  const { anchor, toggle, close } = usePopoverAnchor();
  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="Tài khoản"
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        className="rounded-full transition hover:ring-2 hover:ring-white/40 aria-expanded:ring-2 aria-expanded:ring-white/60"
      >
        <Avatar name={user.name} seed={user.id} size={32} />
      </button>

      <Popover anchor={anchor} onClose={close} label="Tài khoản" align="end">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">Tài khoản</p>
          <button
            type="button"
            onClick={close}
            aria-label="Đóng"
            className="rounded p-1 text-ink-subtle transition-colors hover:bg-surface-mid hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-3 pb-3">
          <Avatar name={user.name} seed={user.id} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-subtle">{user.email}</p>
          </div>
        </div>

        <ul className="-mx-3 border-t border-surface-high px-1 py-1.5">
          {UPCOMING_ITEMS.map(({ icon: Icon, label, hint }) => (
            <li key={label}>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center gap-3 rounded px-2 py-2 text-left text-sm text-ink/70"
              >
                <Icon size={18} className="text-ink-subtle" />
                <span className="flex-1">{label}</span>
                {hint && <span className="text-xs text-ink-subtle">({hint})</span>}
                <ComingSoonBadge />
                {hint && <ChevronRight size={16} className="text-ink-subtle" />}
              </button>
            </li>
          ))}
        </ul>

        <div className="-mx-3 border-t border-surface-high px-1 pt-1.5">
          <button
            type="button"
            onClick={() => {
              close();
              void logout();
            }}
            className="flex w-full items-center gap-3 rounded px-2 py-2 text-sm text-danger transition-colors hover:bg-danger-soft/40"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </Popover>
    </>
  );
}

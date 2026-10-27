'use client';

import { CircleUser, History, LogOut, Monitor, Moon, Palette, ShieldCheck, Sun, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { Popover, usePopoverAnchor } from '@/components/popover';
import { cn } from '@/lib/cn';
import { THEME_OPTIONS, useTheme, type ThemePreference } from '@/lib/theme';

const LINKS: { icon: LucideIcon; label: string; href: string }[] = [
  { icon: CircleUser, label: 'Hồ sơ và hiển thị', href: '/account?tab=profile' },
  { icon: ShieldCheck, label: 'Bảo mật và đăng nhập', href: '/account?tab=security' },
  { icon: History, label: 'Hoạt động', href: '/activity?scope=mine' },
];

const THEME_ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

const MENU_ITEM = 'flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-low';

export function AccountMenu() {
  const { user, logout } = useAuth();
  const { anchor, toggle, close } = usePopoverAnchor();
  const [theme, setTheme] = useTheme();
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
        <Avatar name={user.name} seed={user.id} src={user.avatarUrl} size={32} />
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
          <Avatar name={user.name} seed={user.id} src={user.avatarUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-subtle">{user.email}</p>
          </div>
        </div>

        <ul className="-mx-3 border-t border-surface-high px-1 py-1.5">
          {LINKS.map(({ icon: Icon, label, href }) => (
            <li key={href}>
              <Link href={href} onClick={close} className={MENU_ITEM}>
                <Icon size={18} className="text-ink-subtle" />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="-mx-3 border-t border-surface-high px-3 py-2.5">
          <p className="mb-2 flex items-center gap-2 text-sm text-ink">
            <Palette size={18} className="text-ink-subtle" />
            Giao diện
          </p>
          <div role="radiogroup" aria-label="Giao diện" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-low p-1">
            {THEME_OPTIONS.map(({ value, label }) => {
              const Icon = THEME_ICONS[value];
              const selected = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  title={label}
                  className={cn(
                    'flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors',
                    selected ? 'bg-card text-brand shadow-sm' : 'text-ink-subtle hover:text-ink',
                  )}
                >
                  <Icon size={14} />
                  {value === 'system' ? 'Hệ thống' : label}
                </button>
              );
            })}
          </div>
        </div>

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

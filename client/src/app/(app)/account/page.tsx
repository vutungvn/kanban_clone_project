'use client';

import { Palette, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppearanceSection } from '@/components/account/appearance-section';
import { ProfileSection } from '@/components/account/profile-section';
import { SecuritySection } from '@/components/account/security-section';
import { useAuth } from '@/components/auth-provider';
import { Avatar } from '@/components/avatar';
import { cn } from '@/lib/cn';

type AccountTab = 'profile' | 'security' | 'appearance';

const TABS: { value: AccountTab; label: string; icon: LucideIcon }[] = [
  { value: 'profile', label: 'Hồ sơ', icon: UserRound },
  { value: 'security', label: 'Bảo mật và đăng nhập', icon: ShieldCheck },
  { value: 'appearance', label: 'Giao diện', icon: Palette },
];

const isTab = (value: string | null): value is AccountTab => TABS.some((t) => t.value === value);

// useSearchParams cần nằm trong Suspense để Next.js dựng sẵn được trang
export default function AccountPage() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}

/** Trang tài khoản: /account?tab=profile|security|appearance */
function Account() {
  const { user } = useAuth(); // layout đảm bảo đã có user
  const param = useSearchParams().get('tab');
  const tab: AccountTab = isTab(param) ? param : 'profile';
  if (!user) return null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-8 flex items-center gap-4">
        <Avatar name={user.name} seed={user.id} src={user.avatarUrl} size={56} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-ink">{user.name}</h1>
          <p className="truncate text-sm text-ink-subtle">{user.email}</p>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-8">
        <nav aria-label="Cài đặt tài khoản" className="-mx-1 flex gap-1 overflow-x-auto px-1 md:flex-col md:overflow-visible">
          {TABS.map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              href={`/account?tab=${value}`}
              replace
              scroll={false}
              aria-current={tab === value ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === value ? 'bg-surface-high text-brand' : 'text-ink hover:bg-surface-low',
              )}
            >
              <Icon size={18} className={tab === value ? 'text-brand' : 'text-ink-subtle'} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0">
          {tab === 'profile' && <ProfileSection />}
          {tab === 'security' && <SecuritySection />}
          {tab === 'appearance' && <AppearanceSection />}
        </div>
      </div>
    </main>
  );
}

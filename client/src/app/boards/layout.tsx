'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Spinner } from '@/components/ui';

export default function BoardsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <Spinner />;

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between bg-blue-700 px-4 text-white">
        <span className="text-lg font-bold">Kanban</span>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="hidden text-sm sm:inline">{user.name}</span>
          <button
            onClick={logout}
            className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium transition hover:bg-white/25"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

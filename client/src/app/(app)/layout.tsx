'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppHeader } from '@/components/header/app-header';
import { useAuth } from '@/components/auth-provider';
import { Spinner } from '@/components/ui';

/** Khung chung cho các trang cần đăng nhập: chặn khi chưa có user + header. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <Spinner />;

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader />
      {children}
    </div>
  );
}

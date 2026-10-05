'use client';

import { useAuth } from '@/components/auth-provider';

export default function BoardsPage() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Xin chào, {user?.name} 👋</h1>
      <p className="text-slate-600">Danh sách board sẽ hiển thị ở đây (Phase 2).</p>
    </section>
  );
}

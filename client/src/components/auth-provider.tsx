'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, LoginInput, RegisterInput, User } from '@/lib/auth';
import { boardsStore } from '@/lib/boards-store';
import { disconnectSocket } from '@/lib/realtime';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(({ user }) => setUser(user))
      // Không set null ở đây: tránh ghi đè user nếu người dùng vừa đăng nhập trong lúc request đang chạy
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const { user } = await authApi.login(input);
    boardsStore.reset();
    setUser(user);
  }, []);

  // Đăng ký không tạo phiên đăng nhập → không set user
  const register = useCallback(async (input: RegisterInput) => {
    await authApi.register(input);
  }, []);

  const logout = useCallback(async () => {
    // Dù server lỗi vẫn đưa người dùng về trang đăng nhập
    await authApi.logout().catch(() => undefined);
    boardsStore.reset(); // không để lộ bảng của tài khoản này cho người đăng nhập sau
    disconnectSocket();
    setUser(null);
    router.replace('/login');
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

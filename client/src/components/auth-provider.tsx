'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, LoginInput, RegisterInput, User } from '@/lib/auth';
import { boardsStore } from '@/lib/boards-store';
import { workspacesStore } from '@/lib/workspaces-store';
import { disconnectSocket, getSocket } from '@/lib/realtime';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  /** Trả về true nếu phải xác minh email trước khi đăng nhập */
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Thông tin tài khoản vừa đổi (tên, ảnh đại diện) */
  updateUser: (user: User) => void;
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
    workspacesStore.reset();
    setUser(user);
  }, []);

  // Đăng ký không tạo phiên đăng nhập → không set user
  const register = useCallback(async (input: RegisterInput) => {
    const { verificationRequired } = await authApi.register(input);
    return verificationRequired;
  }, []);

  const logout = useCallback(async () => {
    // Dù server lỗi vẫn đưa người dùng về trang đăng nhập
    await authApi.logout().catch(() => undefined);
    boardsStore.reset(); // không để lộ bảng của tài khoản này cho người đăng nhập sau
    workspacesStore.reset();
    disconnectSocket();
    setUser(null);
    router.replace('/login');
    router.refresh();
  }, [router]);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const socket = getSocket();
    // Tab khác của mình đổi tên / ảnh đại diện → tải lại
    const onAccountUpdated = () => {
      authApi
        .me()
        .then(({ user }) => setUser(user))
        .catch(() => undefined);
    };
    // Phiên này bị đăng xuất từ thiết bị khác (hoặc đổi mật khẩu ở nơi khác)
    const onRevoked = () => void logout();
    // Không gian vừa tạo / đổi tên (tab khác, quản trị viên khác) → tải lại cả bảng (tên không gian trên ô bảng)
    const onWorkspacesChanged = () => {
      void workspacesStore.load(true);
      void boardsStore.load(true);
    };
    socket.on('account:updated', onAccountUpdated);
    socket.on('session:revoked', onRevoked);
    socket.on('workspaces:changed', onWorkspacesChanged);
    return () => {
      socket.off('account:updated', onAccountUpdated);
      socket.off('session:revoked', onRevoked);
      socket.off('workspaces:changed', onWorkspacesChanged);
    };
  }, [userId, logout]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser: setUser }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

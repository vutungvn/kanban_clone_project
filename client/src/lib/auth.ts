import { api } from './api';
import { isSafeNextPath } from './safe-path';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

type UserResponse = { user: User };

export const authApi = {
  register: (input: RegisterInput) =>
    api<UserResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    api<UserResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  me: () => api<UserResponse>('/auth/me'),
};

/** Lấy ?next= từ URL, chỉ chấp nhận đường dẫn nội bộ. */
export function getSafeNextPath(fallback = '/boards') {
  const next = new URLSearchParams(window.location.search).get('next');
  return isSafeNextPath(next) ? next : fallback;
}

/** Link giữa đăng nhập ↔ đăng ký, giữ lại `next` (vd đang mở liên kết mời). */
export function authHref(path: '/login' | '/register', next: string | null, params: Record<string, string> = {}) {
  const query = new URLSearchParams(params);
  if (isSafeNextPath(next)) query.set('next', next);
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

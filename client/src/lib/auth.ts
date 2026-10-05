import { api } from './api';

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

/** Lấy ?next= từ URL, chỉ chấp nhận đường dẫn nội bộ (chống open redirect). */
export function getSafeNextPath(fallback = '/boards') {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

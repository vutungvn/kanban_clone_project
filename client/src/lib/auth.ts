import { api, upload } from './api';
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

/** 1 thiết bị / trình duyệt đang đăng nhập */
export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  /** Lần làm mới phiên gần nhất (~15 phút / lần khi đang dùng) */
  lastActiveAt: string;
  /** Thiết bị đang dùng */
  current: boolean;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const accountApi = {
  updateProfile: (name: string) => api<UserResponse>('/account/profile', json('PATCH', { name })).then((r) => r.user),
  setAvatar: (file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return upload<UserResponse>('/account/avatar', form, onProgress).then((r) => r.user);
  },
  removeAvatar: () => api<UserResponse>('/account/avatar', json('DELETE')).then((r) => r.user),
  /** Trả về số thiết bị khác bị đăng xuất */
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ count: number }>('/account/password', json('PUT', { currentPassword, newPassword })).then((r) => r.count),
  sessions: () => api<{ sessions: Session[] }>('/account/sessions').then((r) => r.sessions),
  revokeSession: (id: string) => api<void>(`/account/sessions/${encodeURIComponent(id)}`, json('DELETE')),
  /** Trả về số thiết bị bị đăng xuất */
  revokeOtherSessions: () => api<{ count: number }>('/account/sessions', json('DELETE')).then((r) => r.count),
};

/** "Chrome trên Windows" từ User-Agent — đủ để nhận ra thiết bị, không cần chính xác tuyệt đối. */
export function describeUserAgent(ua: string | null) {
  if (!ua) return { browser: 'Trình duyệt không rõ', os: 'thiết bị không rõ', mobile: false };
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /node|undici|curl|Postman/i.test(ua)
              ? 'Công cụ / API'
              : 'Trình duyệt khác';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'thiết bị khác';
  return { browser, os, mobile: /Mobile|Android|iPhone|iPad/.test(ua) };
}

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

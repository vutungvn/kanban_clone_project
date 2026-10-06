const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Các endpoint này không được tự refresh khi 401 (tránh vòng lặp / nuốt lỗi sai mật khẩu)
const NO_REFRESH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Thông báo lỗi hiển thị cho người dùng từ một lỗi bất kỳ. */
export function errorMessage(e: unknown) {
  return e instanceof ApiError ? e.message : 'Không thể kết nối tới máy chủ';
}

let refreshing: Promise<boolean> | null = null;

/** Gộp các lần refresh đồng thời thành 1 request. */
function refreshSession() {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (res.status === 401 && retry && !NO_REFRESH_PATHS.includes(path) && (await refreshSession())) {
    return api<T>(path, init, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(res.status, message ?? 'Đã có lỗi xảy ra, vui lòng thử lại');
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

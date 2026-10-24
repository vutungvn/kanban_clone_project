export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/** Id socket realtime của tab này — gửi kèm để server không báo ngược thay đổi của chính tab (xem lib/realtime.ts). */
let getSocketId: () => string | undefined = () => undefined;
export const setSocketIdGetter = (getter: () => string | undefined) => {
  getSocketId = getter;
};

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
export function refreshSession() {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Lỗi từ response không thành công → ApiError với câu thông báo của server. */
function toApiError(status: number, body: { message?: string | string[] } | null) {
  // Rate limit: server trả "ThrottlerException: Too Many Requests" — đổi sang câu dễ hiểu
  if (status === 429) return new ApiError(429, 'Bạn thao tác quá nhanh, vui lòng thử lại sau 1 phút');
  const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
  return new ApiError(status, message ?? 'Đã có lỗi xảy ra, vui lòng thử lại');
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const socketId = getSocketId();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(socketId && { 'X-Socket-Id': socketId }), ...init.headers },
  });

  if (res.status === 401 && retry && !NO_REFRESH_PATHS.includes(path) && (await refreshSession())) {
    return api<T>(path, init, false);
  }

  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Gửi tệp (multipart, POST) kèm tiến độ 0 → 1 — fetch chưa báo được tiến độ gửi lên nên dùng XHR.
 * Hết phiên (401) → làm mới rồi gửi lại 1 lần, giống `api`.
 */
export async function upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  const send = () =>
    new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}${path}`);
      xhr.withCredentials = true;
      const socketId = getSocketId();
      if (socketId) xhr.setRequestHeader('X-Socket-Id', socketId);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      xhr.onerror = () => reject(new TypeError('Network error'));
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // Không phải JSON (vd proxy trả trang lỗi)
        }
        resolve({ status: xhr.status, body });
      };
      xhr.send(form);
    });

  let res = await send();
  if (res.status === 401 && (await refreshSession())) res = await send();
  if (res.status < 200 || res.status >= 300) throw toApiError(res.status, res.body as { message?: string } | null);
  return res.body as T;
}

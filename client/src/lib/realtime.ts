"use client";

import { io, type Socket } from "socket.io-client";
import { API_URL, refreshSession, setSocketIdGetter, api } from "./api";

/** Địa chỉ server cho socket. Deploy: domain Render (Vercel không chuyển tiếp WebSocket). Dev: lấy từ API_URL. */
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || new URL(API_URL).origin;

/** Sự kiện server gửi khi bảng thay đổi (chỉ báo, không kèm dữ liệu — client tự tải lại). */
export interface BoardEvent {
  boardId: string;
  /** Thẻ bị ảnh hưởng (nếu có) */
  cardId?: string;
}

let socket: Socket | null = null;
let refreshing = false;

/**
 * Kết nối realtime dùng chung cho cả app (namespace `/realtime`, xác thực bằng cookie như API).
 * Access token hết hạn → server từ chối ("unauthorized") → refresh phiên rồi kết nối lại 1 lần.
 */
export function getSocket() {
  if (socket) return socket;
  const s = io(`${SOCKET_URL}/realtime`, {
    withCredentials: true,
    transports: ["websocket"],
    // Mỗi lần kết nối / kết nối lại: xin token ngắn hạn qua API (khác domain thì socket không có cookie)
    auth: (cb) => {
      api<{ token: string }>("/auth/socket-token")
        .then(({ token }) => cb({ token }))
        .catch(() => cb({}));
    },
  });

  s.on("connect_error", (err) => {
    // Lỗi xác thực: socket.io không tự thử lại → refresh rồi kết nối lại. Lỗi mạng: socket.io tự thử lại.
    if (err.message !== "unauthorized" || refreshing) return;
    refreshing = true;
    void refreshSession()
      .then((ok) => ok && s.connect())
      .finally(() => {
        refreshing = false;
      });
  });
  setSocketIdGetter(() => (s.connected ? s.id : undefined));
  socket = s;
  return s;
}

/** Đăng xuất: ngắt kết nối để tài khoản sau không nhận sự kiện của tài khoản trước. */
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  setSocketIdGetter(() => undefined);
}

// ----- Báo cho các thành phần đang mở 1 thẻ (vd mục Hoạt động trong modal) -----

const cardListeners = new Set<(event: BoardEvent) => void>();

export function onCardEvent(listener: (event: BoardEvent) => void) {
  cardListeners.add(listener);
  return () => {
    cardListeners.delete(listener);
  };
}

export const emitCardEvent = (event: BoardEvent) =>
  cardListeners.forEach((listener) => listener(event));

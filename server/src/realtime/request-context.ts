import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/** Client gửi id socket của tab hiện tại để server không gửi sự kiện ngược về chính tab vừa thao tác. */
export const SOCKET_ID_HEADER = 'x-socket-id';

interface RequestContext {
  socketId?: string;
  /** Các bảng vừa có hoạt động mới trong request này — báo realtime sau khi xử lý xong (xem ActivityEventsInterceptor) */
  activityBoards: Set<string>;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Middleware Express: giữ thông tin của request hiện tại cho tới khi xử lý xong (kể cả qua await). */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers[SOCKET_ID_HEADER];
  storage.run({ socketId: typeof header === 'string' ? header : undefined, activityBoards: new Set() }, next);
}

/** Socket của tab gửi request đang xử lý (nếu có). */
export const currentSocketId = () => storage.getStore()?.socketId;

/** Ghi nhận bảng vừa có hoạt động mới (gọi trong transaction — chưa báo ngay vì có thể còn rollback). */
export const markActivity = (boardId: string) => storage.getStore()?.activityBoards.add(boardId);

/** Lấy (và xoá) các bảng có hoạt động mới của request hiện tại. */
export function takeActivityBoards() {
  const boards = storage.getStore()?.activityBoards;
  if (!boards?.size) return [];
  const list = [...boards];
  boards.clear();
  return list;
}

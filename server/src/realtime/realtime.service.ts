import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { currentSocketId } from './request-context';

/** Phòng socket của 1 bảng — mọi người đang mở bảng đó. */
export const boardRoom = (boardId: string) => `board:${boardId}`;

/** Phòng riêng của 1 người — mọi tab đang đăng nhập (vào tự động khi kết nối). */
export const userRoom = (userId: string) => `user:${userId}`;

/** Dữ liệu gắn vào mỗi socket sau khi xác thực. */
export interface SocketData {
  userId: string;
  sessionId: string;
}

/** Sự kiện server → client */
export interface BoardChangedEvent {
  boardId: string;
  /** Thẻ bị ảnh hưởng (nếu có) — modal đang mở thẻ này tải lại phần Hoạt động */
  cardId?: string;
}

/**
 * Phát sự kiện realtime cho những người đang mở bảng. Chỉ báo "bảng đã đổi" (không gửi dữ liệu) —
 * client tự tải lại qua API nên luôn đúng quyền và không lộ dữ liệu cho người vừa mất quyền.
 * Không gửi lại cho tab vừa thao tác (header X-Socket-Id).
 */
@Injectable()
export class RealtimeService {
  private server?: Namespace;

  constructor(private readonly prisma: PrismaService) {}

  /** Gateway gọi khi khởi tạo xong namespace. */
  attach(server: Namespace) {
    this.server = server;
  }

  private toBoard(boardId: string) {
    if (!this.server) return null;
    const socketId = currentSocketId();
    const room = this.server.to(boardRoom(boardId));
    return socketId ? room.except(socketId) : room;
  }

  boardChanged(boardId: string, cardId?: string) {
    this.toBoard(boardId)?.emit('board:changed', { boardId, ...(cardId && { cardId }) } satisfies BoardChangedEvent);
  }

  /** Bảng bị xoá: báo rồi đưa mọi socket ra khỏi phòng. */
  boardDeleted(boardId: string) {
    this.toBoard(boardId)?.emit('board:deleted', { boardId });
    this.server?.in(boardRoom(boardId)).socketsLeave(boardRoom(boardId));
  }

  /** Gửi riêng cho 1 người (mọi tab). `exceptOrigin`: bỏ qua tab vừa gửi request (vd đồng bộ "đã đọc"). */
  toUser(userId: string, event: string, payload: unknown, exceptOrigin = false) {
    if (!this.server) return;
    const socketId = exceptOrigin ? currentSocketId() : undefined;
    const room = this.server.to(userRoom(userId));
    (socketId ? room.except(socketId) : room).emit(event, payload);
  }

  /**
   * Bảng có hoạt động mới → báo cho mọi thành viên (qua phòng riêng, không cần đang mở bảng) để trang Hoạt động /
   * Trang chủ tải phần mới. Gửi cả tab vừa thao tác: tab đó có thể đang ở bảng, còn trang Hoạt động mở ở tab khác.
   */
  async activityAdded(boardIds: string[]) {
    if (!this.server || !boardIds.length) return;
    const members = await this.prisma.boardMember.findMany({ where: { boardId: { in: boardIds } }, select: { boardId: true, userId: true } });
    for (const m of members) this.server.to(userRoom(m.userId)).emit('activity:new', { boardId: m.boardId });
  }

  /** Các phiên bị đăng xuất từ xa: báo cho tab của phiên đó (tự đăng xuất) rồi ngắt kết nối. */
  async sessionsRevoked(userId: string, sessionIds: string[]) {
    if (!this.server || !sessionIds.length) return;
    const sockets = await this.server.in(userRoom(userId)).fetchSockets();
    for (const socket of sockets) {
      if (!sessionIds.includes((socket.data as SocketData).sessionId)) continue;
      socket.emit('session:revoked', {});
      socket.disconnect(true);
    }
  }

  /** 1 người rời / bị xoá khỏi bảng: báo riêng cho họ và đưa ra khỏi phòng; người khác nhận "bảng đã đổi". */
  async memberRemoved(boardId: string, userId: string) {
    if (!this.server) return;
    const origin = currentSocketId();
    const sockets = await this.server.in(boardRoom(boardId)).fetchSockets();
    for (const socket of sockets) {
      if ((socket.data as SocketData).userId !== userId) continue;
      // Tab vừa bấm "Rời bảng" tự chuyển trang, không cần báo
      if (socket.id !== origin) socket.emit('board:removed', { boardId });
      socket.leave(boardRoom(boardId));
    }
    this.boardChanged(boardId);
  }
}

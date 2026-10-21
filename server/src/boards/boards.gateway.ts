import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { ACCESS_COOKIE, JwtPayload } from '../auth/auth.types';
import { boardRoom, RealtimeService, SocketData } from '../realtime/realtime.service';
import { BoardAccessService } from './board-access.service';

/** Lấy 1 cookie từ header "a=1; b=2" của handshake. */
function readCookie(header: string | undefined, name: string) {
  for (const part of header?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Socket realtime của bảng — namespace `/realtime`.
 * Kết nối: xác thực bằng cookie access_token (hoặc `auth.token`); sai / hết hạn → lỗi "unauthorized"
 * (client gọi /auth/refresh rồi kết nối lại). `board:join` kiểm tra quyền thành viên trước khi vào phòng.
 * Server → client: `board:changed`, `board:deleted`, `board:removed` (xem RealtimeService).
 */
@WebSocketGateway({ namespace: 'realtime' })
export class BoardsGateway implements OnGatewayInit {
  constructor(
    private readonly jwt: JwtService,
    private readonly access: BoardAccessService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Namespace) {
    this.realtime.attach(server);
    server.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown } | undefined;
      const token =
        readCookie(socket.handshake.headers.cookie, ACCESS_COOKIE) ?? (typeof auth?.token === 'string' ? auth.token : undefined);
      if (!token) return next(new Error('unauthorized'));
      this.jwt
        .verifyAsync<JwtPayload>(token)
        .then((payload) => {
          (socket.data as SocketData).userId = payload.sub;
          next();
        })
        .catch(() => next(new Error('unauthorized')));
    });
  }

  /** Vào phòng của bảng (mọi vai trò). Trả về `{ ok }` qua ack. */
  @SubscribeMessage('board:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() boardId: unknown) {
    if (typeof boardId !== 'string') return { ok: false };
    try {
      await this.access.require(boardId, (socket.data as SocketData).userId);
    } catch {
      return { ok: false };
    }
    await socket.join(boardRoom(boardId));
    return { ok: true };
  }

  @SubscribeMessage('board:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() boardId: unknown) {
    if (typeof boardId === 'string') await socket.leave(boardRoom(boardId));
    return { ok: true };
  }
}

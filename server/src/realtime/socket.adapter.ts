import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** socket.io dùng chung CORS với HTTP (CLIENT_URL + cookie). */
export class SocketAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly clientUrl: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, cors: { origin: this.clientUrl, credentials: true } });
  }
}

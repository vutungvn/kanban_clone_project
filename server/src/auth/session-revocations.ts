import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Phiên vừa bị thu hồi (đăng xuất thiết bị khác, đổi mật khẩu, đăng xuất). Refresh token đã bị xoá trong DB,
 * nhưng access token (JWT) vẫn hợp lệ tới khi hết hạn → guard từ chối các phiên trong danh sách này.
 * Chỉ cần nhớ trong thời gian sống của access token. Lưu trong bộ nhớ (server chạy 1 instance);
 * server khởi động lại thì token cũ còn dùng được tối đa 1 lần sống của access token.
 */
@Injectable()
export class SessionRevocations {
  private readonly revoked = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(config: ConfigService) {
    this.ttlMs = Number(config.get('ACCESS_TOKEN_TTL_MINUTES', 15)) * 60_000;
  }

  add(sessionIds: string[]) {
    const now = Date.now();
    for (const [id, until] of this.revoked) if (until < now) this.revoked.delete(id);
    for (const id of sessionIds) this.revoked.set(id, now + this.ttlMs);
  }

  has(sessionId: string) {
    const until = this.revoked.get(sessionId);
    return until !== undefined && until > Date.now();
  }
}

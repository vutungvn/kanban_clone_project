import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, AuthRequest, JwtPayload } from '../auth.types';
import { SessionRevocations } from '../session-revocations';

/** Đọc access token từ cookie (web) hoặc header Authorization: Bearer (tool/test). */
export function extractAccessToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const [type, token] = req.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly revocations: SessionRevocations,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = extractAccessToken(req);
    if (!token) throw new UnauthorizedException('Chưa đăng nhập');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn');
    }
    if (this.revocations.has(payload.sid)) throw new UnauthorizedException('Phiên đăng nhập đã bị đăng xuất');
    req.user = { id: payload.sub, sessionId: payload.sid };
    return true;
  }
}

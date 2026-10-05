import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, AuthRequest, JwtPayload } from '../auth.types';

/** Đọc access token từ cookie (web) hoặc header Authorization: Bearer (tool/test). */
export function extractAccessToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  if (cookieToken) return cookieToken;
  const [type, token] = req.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = extractAccessToken(req);
    if (!token) throw new UnauthorizedException('Chưa đăng nhập');

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { id: payload.sub, sessionId: payload.sid };
      return true;
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn');
    }
  }
}

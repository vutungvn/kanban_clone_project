import type { Request } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

export interface JwtPayload {
  sub: string; // userId
  sid: string; // sessionId
}

export interface AuthUser {
  id: string;
  sessionId: string;
}

export type AuthRequest = Request & { user: AuthUser };

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

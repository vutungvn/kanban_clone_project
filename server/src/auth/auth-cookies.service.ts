import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { ACCESS_COOKIE, AuthTokens, REFRESH_COOKIE } from './auth.types';

@Injectable()
export class AuthCookiesService {
  private readonly baseOptions: CookieOptions;
  private readonly accessMaxAge: number;
  private readonly refreshMaxAge: number;

  constructor(config: ConfigService) {
    this.baseOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.get('COOKIE_SECURE') === 'true',
      domain: config.get<string>('COOKIE_DOMAIN') || undefined,
      path: '/',
    };
    this.accessMaxAge = Number(config.get('ACCESS_TOKEN_TTL_MINUTES', 15)) * 60 * 1000;
    this.refreshMaxAge = Number(config.get('REFRESH_TOKEN_TTL_DAYS', 7)) * 24 * 60 * 60 * 1000;
  }

  set(res: Response, tokens: AuthTokens) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...this.baseOptions, maxAge: this.accessMaxAge });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...this.baseOptions, maxAge: this.refreshMaxAge });
  }

  clear(res: Response) {
    res.clearCookie(ACCESS_COOKIE, this.baseOptions);
    res.clearCookie(REFRESH_COOKIE, this.baseOptions);
  }
}

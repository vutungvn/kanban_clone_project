import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';

export const CRON_SECRET_HEADER = 'x-cron-secret';
export const INVALID_CRON_SECRET = 'Sai hoặc thiếu cron secret';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

/** Endpoint cho job hẹn giờ bên ngoài: header `x-cron-secret` phải khớp CRON_SECRET. Chưa đặt CRON_SECRET → luôn từ chối. */
@Injectable()
export class CronSecretGuard implements CanActivate {
  private readonly secret: string | undefined;

  constructor(config: ConfigService) {
    this.secret = config.get<string>('CRON_SECRET') || undefined;
  }

  canActivate(context: ExecutionContext) {
    const provided = context.switchToHttp().getRequest<Request>().header(CRON_SECRET_HEADER);
    // So sánh hash (cùng độ dài) bằng timingSafeEqual — không lộ secret qua thời gian phản hồi
    if (!this.secret || !provided || !timingSafeEqual(sha256(provided), sha256(this.secret))) {
      throw new UnauthorizedException(INVALID_CRON_SECRET);
    }
    return true;
  }
}

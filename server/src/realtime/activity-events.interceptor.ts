import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { takeActivityBoards } from './request-context';

/**
 * Sau khi request xử lý xong (transaction đã commit) mới báo "có hoạt động mới" cho các bảng được ghi nhận
 * bằng markActivity — tránh báo rồi dữ liệu lại bị rollback. Request lỗi thì không báo.
 */
@Injectable()
export class ActivityEventsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityEventsInterceptor.name);

  constructor(private readonly realtime: RealtimeService) {}

  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      tap(() => {
        const boards = takeActivityBoards();
        if (boards.length) {
          this.realtime.activityAdded(boards).catch((e: unknown) => this.logger.warn(`Không báo được hoạt động mới: ${String(e)}`));
        }
      }),
    );
  }
}

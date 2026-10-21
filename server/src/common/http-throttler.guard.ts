import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/** Rate limit chỉ cho HTTP — guard toàn cục cũng chạy cho socket (realtime) nhưng không đọc được IP request ở đó. */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext) {
    return context.getType() !== 'http' || super.shouldSkip(context);
  }
}

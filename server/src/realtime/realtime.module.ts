import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityEventsInterceptor } from './activity-events.interceptor';
import { RealtimeService } from './realtime.service';

/** Global: mọi service thay đổi dữ liệu bảng đều cần phát sự kiện realtime. Gateway nằm ở BoardsModule. */
@Global()
@Module({
  providers: [RealtimeService, { provide: APP_INTERCEPTOR, useClass: ActivityEventsInterceptor }],
  exports: [RealtimeService],
})
export class RealtimeModule {}

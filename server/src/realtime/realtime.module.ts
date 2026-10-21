import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

/** Global: mọi service thay đổi dữ liệu bảng đều cần phát sự kiện realtime. Gateway nằm ở BoardsModule. */
@Global()
@Module({
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}

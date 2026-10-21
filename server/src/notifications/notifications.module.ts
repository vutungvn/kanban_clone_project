import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  // BoardsModule dùng để gửi thông báo khi có thay đổi
  exports: [NotificationsService],
})
export class NotificationsModule {}

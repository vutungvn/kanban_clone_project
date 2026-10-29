import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CronSecretGuard } from './cron-secret.guard';
import { DueRemindersController } from './due-reminders.controller';
import { DueRemindersService } from './due-reminders.service';

/** Job chạy định kỳ: nhắc hạn chót. */
@Module({
  imports: [NotificationsModule],
  controllers: [DueRemindersController],
  providers: [DueRemindersService, CronSecretGuard],
})
export class RemindersModule {}

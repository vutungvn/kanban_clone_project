import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** Global: gửi email từ bất kỳ module nào (xác thực, sau này là thông báo). */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

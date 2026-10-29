import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiProperty, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { CRON_SECRET_HEADER, CronSecretGuard, INVALID_CRON_SECRET } from './cron-secret.guard';
import { DueRemindersService, type DueRemindersResult } from './due-reminders.service';

class DueRemindersResultDto implements DueRemindersResult {
  @ApiProperty({ example: 2, description: 'Số thẻ vừa nhắc "sắp hết hạn"' })
  dueSoon: number;

  @ApiProperty({ example: 1, description: 'Số thẻ vừa nhắc "quá hạn"' })
  overdue: number;

  @ApiProperty({ example: 3, description: 'Số email đã gửi (mỗi người tối đa 1 email / lượt)' })
  emails: number;
}

/** Endpoint cho job hẹn giờ bên ngoài (GitHub Actions) — không dùng đăng nhập mà dùng CRON_SECRET. */
@ApiTags('Internal')
@Controller('internal/due-reminders')
export class DueRemindersController {
  constructor(private readonly reminders: DueRemindersService) {}

  @ApiOperation({
    summary: 'Quét nhắc hạn chót 1 lượt',
    description:
      'Gửi thông báo + email cho người được giao các thẻ còn dưới 24 giờ hoặc vừa quá hạn. ' +
      'Gọi lặp lại / song song vẫn an toàn: mỗi mốc chỉ gửi 1 lần cho mỗi hạn chót.',
  })
  @ApiHeader({ name: CRON_SECRET_HEADER, required: true, description: 'Giá trị biến môi trường CRON_SECRET' })
  @ApiOkResponse({ type: DueRemindersResultDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sai / thiếu header, hoặc server chưa đặt CRON_SECRET',
    example: { statusCode: 401, message: INVALID_CRON_SECRET, error: 'Unauthorized' },
  })
  @UseGuards(CronSecretGuard)
  @HttpCode(HttpStatus.OK)
  @Post('run')
  run() {
    return this.reminders.run();
  }
}

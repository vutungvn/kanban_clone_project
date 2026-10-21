import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiAuth, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import {
  ListNotificationsQueryDto,
  MarkReadDto,
  NotificationResponseDto,
  NotificationsResponseDto,
  UnreadCountDto,
} from './dto/notification.dto';
import { NOTIFICATION_NOT_FOUND, NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @ApiOperation({
    summary: 'Thông báo của tôi',
    description:
      'Mới nhất trước, phân trang bằng `cursor`. Thông báo mới cũng được đẩy qua socket (`notification:new`, namespace `/realtime`).',
  })
  @ApiOkResponse({ type: NotificationsResponseDto })
  @ApiValidationError(['filter phải là một trong: all, unread'])
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(user.id, query);
  }

  @ApiOperation({ summary: 'Số thông báo chưa đọc' })
  @ApiOkResponse({ type: UnreadCountDto })
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @ApiOperation({ summary: 'Đánh dấu tất cả đã đọc' })
  @ApiOkResponse({ type: UnreadCountDto, description: '`count`: số thông báo vừa được đánh dấu' })
  @HttpCode(HttpStatus.OK)
  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @ApiOperation({ summary: 'Đánh dấu đã đọc / chưa đọc' })
  @ApiParam({ name: 'id', description: 'ID thông báo' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiValidationError(['read phải là true hoặc false'])
  @ApiNotFound(NOTIFICATION_NOT_FOUND, 'Không tồn tại hoặc không phải thông báo của bạn')
  @Patch(':id')
  async markRead(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return { notification: await this.notifications.markRead(id, user.id, dto.read) };
  }
}

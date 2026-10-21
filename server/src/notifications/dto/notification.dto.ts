import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const NOTIFICATION_FILTERS = ['all', 'unread'] as const;
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

// ===== Request =====

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_FILTERS, default: 'all', description: '`unread`: chỉ thông báo chưa đọc' })
  @IsOptional()
  @IsIn(NOTIFICATION_FILTERS, { message: `filter phải là một trong: ${NOTIFICATION_FILTERS.join(', ')}` })
  filter: NotificationFilter = 'all';

  @ApiPropertyOptional({ description: 'Lấy các thông báo cũ hơn thông báo có id này (`nextCursor` của trang trước)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit phải là số nguyên' })
  @Min(1, { message: 'limit tối thiểu là 1' })
  @Max(50, { message: 'limit tối đa là 50' })
  limit: number = 20;
}

export class MarkReadDto {
  @ApiProperty({ example: true, description: 'false = đánh dấu chưa đọc' })
  @IsBoolean({ message: 'read phải là true hoặc false' })
  read: boolean;
}

// ===== Response =====

export class NotificationActorDto {
  @ApiProperty({ example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  name: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;
}

export class NotificationDto {
  @ApiProperty({ example: 'cmgnoti00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ enum: NotificationType, example: NotificationType.COMMENT_MENTION })
  type: NotificationType;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { boardTitle: 'Dự án Website', cardTitle: 'Thiết kế trang chủ', text: '@Bình xem giúp mình nhé' },
    description:
      'Dữ liệu chụp lại lúc tạo: luôn có `boardTitle`; thông báo về thẻ có `cardTitle`; ' +
      'CARD_COMMENT / COMMENT_MENTION `{ text }` (trích đoạn), CARD_DUE_CHANGED `{ dueDate }`, ' +
      'CARD_MOVED `{ fromList, toList }`, BOARD_INVITED / ROLE_CHANGED / JOIN_APPROVED `{ role }`',
  })
  data: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true, example: 'cmgboard0000vq8h3b1c2d4e' })
  boardId: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'cmgcard00000vq8h3b1c2d4e' })
  cardId: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null, description: 'null = chưa đọc' })
  readAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: NotificationActorDto, nullable: true, description: 'Người gây ra; null nếu tài khoản đã bị xoá' })
  actor: NotificationActorDto | null;
}

export class NotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto], description: 'Mới nhất trước' })
  notifications: NotificationDto[];

  @ApiProperty({ type: String, nullable: true, example: null, description: 'Truyền vào `cursor` để lấy trang tiếp; null = hết' })
  nextCursor: string | null;
}

export class NotificationResponseDto {
  @ApiProperty({ type: NotificationDto })
  notification: NotificationDto;
}

export class UnreadCountDto {
  @ApiProperty({ example: 3 })
  count: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { trimString } from '../../common/transforms';
import { MAX_COMMENT } from '../boards.constants';

export const ACTIVITY_FILTERS = ['all', 'comments'] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number];

// ===== Request =====

export class ListActivitiesQueryDto {
  @ApiPropertyOptional({ enum: ACTIVITY_FILTERS, default: 'all', description: '`comments`: chỉ bình luận' })
  @IsOptional()
  @IsIn(ACTIVITY_FILTERS, { message: `filter phải là một trong: ${ACTIVITY_FILTERS.join(', ')}` })
  filter: ActivityFilter = 'all';

  @ApiPropertyOptional({ description: 'Lấy các hoạt động cũ hơn hoạt động có id này (`nextCursor` của trang trước)' })
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

export class CommentDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_COMMENT, example: 'Mình đã cập nhật thiết kế, mọi người xem giúp nhé.', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung bình luận' })
  @MaxLength(MAX_COMMENT, { message: `Bình luận tối đa ${MAX_COMMENT} ký tự` })
  text: string;
}

// ===== Response =====

export class ActivityUserDto {
  @ApiProperty({ example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  name: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;
}

export class ActivityDto {
  @ApiProperty({ example: 'cmgact000000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  cardId: string;

  @ApiProperty({ enum: ActivityType, example: ActivityType.LABEL_ADDED })
  type: ActivityType;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { name: 'Gấp', color: 'red_bold' },
    description:
      'Dữ liệu chụp lại lúc xảy ra, tuỳ `type`: CARD_CREATED `{ listTitle }`, CARD_RENAMED `{ from, to }`, ' +
      'CARD_MOVED `{ fromList, toList }`, LABEL_* `{ name, color }`, MEMBER_* `{ userId, name }`, ' +
      'DATES_CHANGED `{ startDate, dueDate }`, DUE_COMPLETE_CHANGED `{ complete }`, CHECKLIST_* `{ title }`, ' +
      'CHECKLIST_ITEM_* `{ title, checklist }`',
  })
  data: Record<string, unknown>;

  @ApiProperty({ type: String, nullable: true, example: null, description: 'Nội dung bình luận (chỉ với COMMENT)' })
  text: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null, description: 'Lần sửa bình luận gần nhất' })
  editedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: ActivityUserDto, nullable: true, description: 'Người thực hiện; null nếu tài khoản đã bị xoá' })
  user: ActivityUserDto | null;
}

export class ActivitiesResponseDto {
  @ApiProperty({ type: [ActivityDto], description: 'Mới nhất trước' })
  activities: ActivityDto[];

  @ApiProperty({ type: String, nullable: true, example: null, description: 'Truyền vào `cursor` để lấy trang tiếp; null = hết' })
  nextCursor: string | null;
}

export class ActivityResponseDto {
  @ApiProperty({ type: ActivityDto })
  activity: ActivityDto;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BoardRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ActivityDto } from './activity.dto';

export const ACTIVITY_SCOPES = ['all', 'mine'] as const;
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number];

// ===== Request =====

export class ListMyActivitiesQueryDto {
  @ApiPropertyOptional({ enum: ACTIVITY_SCOPES, default: 'all', description: '`all`: của mọi người; `mine`: chỉ việc mình đã làm' })
  @IsOptional()
  @IsIn(ACTIVITY_SCOPES, { message: `scope phải là một trong: ${ACTIVITY_SCOPES.join(', ')}` })
  scope: ActivityScope = 'all';

  @ApiPropertyOptional({ description: 'Chỉ lấy của 1 bảng (phải là thành viên, không thì trả danh sách rỗng)' })
  @IsOptional()
  @IsString()
  boardId?: string;

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

// ===== Response =====

export class MyBoardRefDto {
  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Dự án A' })
  title: string;

  @ApiProperty({ example: 'blue', description: 'Key phông nền' })
  background: string;
}

export class MyCardBoardDto extends MyBoardRefDto {
  @ApiProperty({ enum: BoardRole, description: 'Vai trò của mình trong bảng (VIEWER không tick hoàn thành được)' })
  role: BoardRole;
}

export class MyCardLabelDto {
  @ApiProperty({ example: 'cmglabel0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Gấp' })
  name: string;

  @ApiProperty({ example: 'red' })
  color: string;
}

export class MyCardDto {
  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Thiết kế trang chủ' })
  title: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startDate: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  dueComplete: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Lúc mình được giao thẻ' })
  assignedAt: Date;

  @ApiProperty({ example: { id: 'cmglist00000vq8h3b1c2d4e', title: 'Đang làm' } })
  list: { id: string; title: string };

  @ApiProperty({ type: MyCardBoardDto })
  board: MyCardBoardDto;

  @ApiProperty({ type: [MyCardLabelDto], description: 'Theo thứ tự nhãn của bảng' })
  labels: MyCardLabelDto[];

  @ApiProperty({ example: { done: 2, total: 5 }, description: 'Tiến độ mọi checklist của thẻ' })
  checklist: { done: number; total: number };

  @ApiProperty({ example: 3 })
  commentCount: number;

  @ApiProperty({ example: 1 })
  attachmentCount: number;
}

export class MyCardsResponseDto {
  @ApiProperty({ type: [MyCardDto] })
  cards: MyCardDto[];
}

export class FeedActivityDto extends ActivityDto {
  @ApiProperty({ example: { id: 'cmgcard00000vq8h3b1c2d4e', title: 'Thiết kế trang chủ' } })
  card: { id: string; title: string };

  @ApiProperty({ type: MyBoardRefDto })
  board: MyBoardRefDto;
}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedActivityDto], description: 'Mới nhất trước' })
  activities: FeedActivityDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Truyền vào `cursor` để lấy trang tiếp; null = hết' })
  nextCursor: string | null;
}

import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { BoardRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms';
import { WorkspaceRefDto } from '../../workspaces/dto/workspace.dto';
import { BOARD_BACKGROUNDS, MAX_BOARD_TITLE, type BoardBackground } from '../boards.constants';
import { CardWithListDto } from './card.dto';
import { LabelDto } from './label.dto';
import { ListDto } from './list.dto';

// ===== Request =====

export class CreateBoardDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_BOARD_TITLE, example: 'Dự án Website', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tiêu đề bảng' })
  @MaxLength(MAX_BOARD_TITLE, { message: `Tiêu đề bảng tối đa ${MAX_BOARD_TITLE} ký tự` })
  title: string;

  @ApiProperty({ enum: BOARD_BACKGROUNDS, example: 'blue', description: 'Key phông nền dựng sẵn' })
  @IsIn(BOARD_BACKGROUNDS, { message: `Phông nền phải là một trong: ${BOARD_BACKGROUNDS.join(', ')}` })
  background: BoardBackground;

  @ApiPropertyOptional({
    example: 'cmgws0000000vq8h3b1c2d4e',
    description: 'Không gian chứa bảng (phải là thành viên). Bỏ trống → không gian mình tham gia sớm nhất',
  })
  @IsOptional()
  @IsString()
  workspaceId?: string;
}

/** Mọi trường đều tuỳ chọn — chỉ gửi trường cần đổi (chưa chuyển bảng sang không gian khác được). */
export class UpdateBoardDto extends PartialType(OmitType(CreateBoardDto, ['workspaceId'] as const)) {}

export class StarBoardDto {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'starred phải là true hoặc false' })
  starred: boolean;
}

// ===== Response =====

export class BoardMemberDto {
  @ApiProperty({ example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  name: string;

  @ApiProperty({ format: 'email', example: 'an.nguyen@example.com', description: 'Chỉ thành viên cùng bảng mới thấy' })
  email: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;

  @ApiProperty({ enum: BoardRole, example: BoardRole.ADMIN })
  role: BoardRole;
}

export class BoardSummaryDto {
  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Dự án Website' })
  title: string;

  @ApiProperty({ enum: BOARD_BACKGROUNDS, example: 'blue' })
  background: string;

  @ApiProperty({ example: false, description: 'User hiện tại đã đánh dấu sao chưa' })
  starred: boolean;

  @ApiProperty({ enum: BoardRole, example: BoardRole.ADMIN, description: 'Vai trò của user hiện tại' })
  role: BoardRole;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-01-16T09:00:00.000Z',
    description: 'Lần cuối user hiện tại mở bảng (cập nhật khi gọi GET /boards/{id})',
  })
  lastViewedAt: Date | null;

  @ApiProperty({ type: WorkspaceRefDto, description: 'Không gian chứa bảng (có thể là không gian mình không thuộc — khi đó mình là khách)' })
  workspace: WorkspaceRefDto;

  @ApiProperty({ type: [BoardMemberDto] })
  members: BoardMemberDto[];
}

export class BoardDetailMemberDto extends BoardMemberDto {
  @ApiProperty({ example: false, description: 'Khách: không thuộc không gian chứa bảng' })
  guest: boolean;
}

export class BoardDetailDto extends OmitType(BoardSummaryDto, ['members'] as const) {
  @ApiProperty({ type: [BoardDetailMemberDto] })
  members: BoardDetailMemberDto[];

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [LabelDto], description: 'Nhãn của bảng, theo thứ tự tạo' })
  labels: LabelDto[];

  @ApiProperty({ type: [ListDto], description: 'Các danh sách kèm thẻ, đã sắp theo position' })
  lists: ListDto[];
}

export class ArchivedListDto extends OmitType(ListDto, ['cards'] as const) {
  @ApiProperty({ example: 4, description: 'Số thẻ (chưa lưu trữ) trong danh sách' })
  cardCount: number;
}

export class BoardArchiveResponseDto {
  @ApiProperty({ type: [CardWithListDto], description: 'Thẻ đã lưu trữ, mới lưu trữ trước' })
  cards: CardWithListDto[];

  @ApiProperty({ type: [ArchivedListDto], description: 'Danh sách đã lưu trữ, mới lưu trữ trước' })
  lists: ArchivedListDto[];
}

export class BoardsResponseDto {
  @ApiProperty({ type: [BoardSummaryDto] })
  boards: BoardSummaryDto[];
}

export class BoardSummaryResponseDto {
  @ApiProperty({ type: BoardSummaryDto })
  board: BoardSummaryDto;
}

export class BoardDetailResponseDto {
  @ApiProperty({ type: BoardDetailDto })
  board: BoardDetailDto;
}

export class StarResponseDto {
  @ApiProperty({ example: true })
  starred: boolean;
}

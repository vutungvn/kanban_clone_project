import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { blankToNull, trimString } from '../../common/transforms';
import { MAX_CARD_DESCRIPTION, MAX_CARD_TITLE } from '../boards.constants';
import { ChecklistDto } from './checklist.dto';

const CardTitleRules = () =>
  applyDecorators(
    Transform(trimString),
    IsString(),
    IsNotEmpty({ message: 'Vui lòng nhập tiêu đề thẻ' }),
    MaxLength(MAX_CARD_TITLE, { message: `Tiêu đề thẻ tối đa ${MAX_CARD_TITLE} ký tự` }),
  );

export class CreateCardDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_CARD_TITLE, example: 'Thiết kế trang chủ', description: 'Tự động trim' })
  @CardTitleRules()
  title: string;
}

export class UpdateCardDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: MAX_CARD_TITLE, example: 'Thiết kế trang chủ (bản 2)' })
  @IsOptional()
  @CardTitleRules()
  title?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: MAX_CARD_DESCRIPTION,
    example: 'Làm theo thiết kế trên Stitch, ưu tiên bản desktop.',
    description: 'Gửi `null` hoặc chuỗi rỗng để xoá mô tả',
  })
  @Transform(blankToNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CARD_DESCRIPTION, { message: `Mô tả tối đa ${MAX_CARD_DESCRIPTION} ký tự` })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-20T00:00:00.000Z',
    description: 'Ngày bắt đầu (ISO 8601). Gửi `null` để xoá. Phải trước hoặc bằng hạn chót',
  })
  @Transform(blankToNull)
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    example: '2026-10-25T10:00:00.000Z',
    description: 'Hạn chót (ISO 8601). Gửi `null` để xoá — `dueComplete` cũng tự về false',
  })
  @Transform(blankToNull)
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Hạn chót không hợp lệ' })
  dueDate?: string | null;

  @ApiPropertyOptional({ example: true, description: 'Đánh dấu hoàn thành hạn chót (cần thẻ có hạn chót)' })
  @IsOptional()
  @IsBoolean({ message: 'dueComplete phải là true hoặc false' })
  dueComplete?: boolean;
}

export class CopyCardDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_CARD_TITLE, example: 'Thiết kế trang chủ (bản sao)', description: 'Tên thẻ mới' })
  @CardTitleRules()
  title: string;

  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e', description: 'Danh sách đích (cùng bảng, chưa lưu trữ)' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn danh sách đích' })
  listId: string;

  @ApiProperty({ minimum: 0, example: 0, description: 'Vị trí trong danh sách đích, tính từ 0. Lớn hơn số thẻ → đặt cuối.' })
  @IsInt({ message: 'index phải là số nguyên' })
  @Min(0, { message: 'index không được âm' })
  index: number;

  @ApiPropertyOptional({ default: true, description: 'Giữ nhãn' })
  @IsOptional()
  @IsBoolean({ message: 'keepLabels phải là true hoặc false' })
  keepLabels: boolean = true;

  @ApiPropertyOptional({ default: true, description: 'Giữ thành viên được giao' })
  @IsOptional()
  @IsBoolean({ message: 'keepMembers phải là true hoặc false' })
  keepMembers: boolean = true;

  @ApiPropertyOptional({ default: true, description: 'Giữ checklist (kèm trạng thái các mục)' })
  @IsOptional()
  @IsBoolean({ message: 'keepChecklists phải là true hoặc false' })
  keepChecklists: boolean = true;

  @ApiPropertyOptional({ default: true, description: 'Giữ ngày bắt đầu / hạn chót' })
  @IsOptional()
  @IsBoolean({ message: 'keepDates phải là true hoặc false' })
  keepDates: boolean = true;
}

export class MoveCardDto {
  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e', description: 'Danh sách đích (phải cùng bảng; có thể là danh sách hiện tại)' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn danh sách đích' })
  listId: string;

  @ApiProperty({
    minimum: 0,
    example: 0,
    description: 'Vị trí mới trong danh sách đích, tính từ 0 (không tính chính thẻ đang kéo). Lớn hơn số thẻ → đặt cuối.',
  })
  @IsInt({ message: 'index phải là số nguyên' })
  @Min(0, { message: 'index không được âm' })
  index: number;
}

export class CardDto {
  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e' })
  listId: string;

  @ApiProperty({ example: 'Thiết kế trang chủ' })
  title: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  description: string | null;

  @ApiProperty({ example: 1024, description: 'Thứ tự trong danh sách (tăng dần)' })
  position: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  startDate: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-10-25T10:00:00.000Z' })
  dueDate: Date | null;

  @ApiProperty({ example: false })
  dueComplete: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null, description: 'Thời điểm lưu trữ; null = đang hiện trên bảng' })
  archivedAt: Date | null;

  @ApiProperty({ type: [String], example: ['cmglabel0000vq8h3b1c2d4e'], description: 'ID nhãn — chi tiết nằm ở `board.labels`' })
  labelIds: string[];

  @ApiProperty({ type: [String], example: ['cmg9x2k7a0000vq8h3b1c2d4e'], description: 'ID thành viên được giao — chi tiết nằm ở `board.members`' })
  memberIds: string[];

  @ApiProperty({ example: 2, description: 'Số bình luận' })
  commentCount: number;

  @ApiProperty({ type: () => [ChecklistDto], description: 'Các checklist kèm mục, đã sắp theo position' })
  checklists: ChecklistDto[];

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;
}

export class CardResponseDto {
  @ApiProperty({ type: CardDto })
  card: CardDto;
}

/** Thẻ kèm tên danh sách — dùng khi thẻ không có trong dữ liệu bảng (đã lưu trữ, mở qua link). */
export class CardWithListDto extends CardDto {
  @ApiProperty({ example: 'Cần làm' })
  listTitle: string;

  @ApiProperty({ example: false, description: 'Danh sách chứa thẻ đã bị lưu trữ' })
  listArchived: boolean;
}

export class CardWithListResponseDto {
  @ApiProperty({ type: CardWithListDto })
  card: CardWithListDto;
}

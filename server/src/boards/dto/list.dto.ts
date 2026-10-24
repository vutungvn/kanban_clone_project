import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { trimString } from '../../common/transforms';
import { MAX_LIST_TITLE } from '../boards.constants';
import { CardDto } from './card.dto';

export class CreateListDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_LIST_TITLE, example: 'Cần làm', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên danh sách' })
  @MaxLength(MAX_LIST_TITLE, { message: `Tên danh sách tối đa ${MAX_LIST_TITLE} ký tự` })
  title: string;
}

/** Hiện chỉ đổi được tên. */
export class UpdateListDto extends CreateListDto {}

/** Tên của danh sách bản sao. */
export class CopyListDto extends CreateListDto {}

export class MoveListDto {
  @ApiProperty({
    minimum: 0,
    example: 0,
    description: 'Vị trí mới trong bảng, tính từ 0 (không tính chính danh sách đang kéo). Lớn hơn số danh sách → đặt cuối.',
  })
  @IsInt({ message: 'index phải là số nguyên' })
  @Min(0, { message: 'index không được âm' })
  index: number;

  @ApiPropertyOptional({
    example: 'cmgboard0000vq8h3b1c2d4e',
    description:
      'Chuyển sang bảng khác (cần quyền MEMBER ở cả 2 bảng). Thẻ đi theo danh sách; nhãn được ghép theo tên + màu, ' +
      'người được giao không thuộc bảng đích bị gỡ. Bỏ trống = cùng bảng.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn bảng đích' })
  boardId?: string;
}

export const LIST_SORTS = ['newest', 'oldest', 'due', 'title'] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export class SortListDto {
  @ApiProperty({
    enum: LIST_SORTS,
    example: 'due',
    description: '`newest` / `oldest`: theo ngày tạo; `due`: hạn chót gần nhất trước (không có hạn chót xếp cuối); `title`: tên A–Z',
  })
  @IsIn(LIST_SORTS, { message: `Kiểu sắp xếp phải là một trong: ${LIST_SORTS.join(', ')}` })
  by: ListSort;
}

export class ListSummaryDto {
  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Cần làm' })
  title: string;

  @ApiProperty({ example: 4, description: 'Số thẻ đang hiện' })
  cardCount: number;
}

export class ListSummariesResponseDto {
  @ApiProperty({ type: [ListSummaryDto], description: 'Danh sách chưa lưu trữ, theo thứ tự trên bảng' })
  lists: ListSummaryDto[];
}

export class ListDto {
  @ApiProperty({ example: 'cmglist00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  boardId: string;

  @ApiProperty({ example: 'Cần làm' })
  title: string;

  @ApiProperty({ example: 1024, description: 'Thứ tự trong bảng (tăng dần)' })
  position: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null, description: 'Thời điểm lưu trữ; null = đang hiện trên bảng' })
  archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [CardDto], description: 'Các thẻ, đã sắp theo position' })
  cards: CardDto[];
}

export class ListResponseDto {
  @ApiProperty({ type: ListDto })
  list: ListDto;
}

export class ArchiveCountDto {
  @ApiProperty({ example: 3, description: 'Số thẻ vừa được lưu trữ' })
  count: number;
}

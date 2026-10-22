import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
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

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { blankToNull, trimString } from '../../common/transforms';
import { MAX_CARD_DESCRIPTION, MAX_CARD_TITLE } from '../boards.constants';

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

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;
}

export class CardResponseDto {
  @ApiProperty({ type: CardDto })
  card: CardDto;
}

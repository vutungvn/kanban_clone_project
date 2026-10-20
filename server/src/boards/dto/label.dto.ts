import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms';
import { LABEL_COLORS, MAX_LABEL_NAME } from '../boards.constants';

// ===== Request =====

export class CreateLabelDto {
  @ApiPropertyOptional({
    maxLength: MAX_LABEL_NAME,
    example: 'Ưu tiên cao',
    default: '',
    description: 'Tự động trim. Bỏ trống = nhãn chỉ có màu',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LABEL_NAME, { message: `Tên nhãn tối đa ${MAX_LABEL_NAME} ký tự` })
  name?: string;

  @ApiProperty({ enum: LABEL_COLORS, example: 'red', description: 'Key màu dựng sẵn' })
  @IsIn(LABEL_COLORS, { message: 'Màu nhãn không hợp lệ' })
  color: string;
}

/** Chỉ gửi trường cần đổi. */
export class UpdateLabelDto extends PartialType(CreateLabelDto) {}

// ===== Response =====

export class LabelDto {
  @ApiProperty({ example: 'cmglabel0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  boardId: string;

  @ApiProperty({ example: 'Ưu tiên cao', description: 'Có thể rỗng' })
  name: string;

  @ApiProperty({ enum: LABEL_COLORS, example: 'red' })
  color: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;
}

export class LabelResponseDto {
  @ApiProperty({ type: LabelDto })
  label: LabelDto;
}

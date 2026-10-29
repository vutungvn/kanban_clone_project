import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { BOARD_BACKGROUNDS, MAX_BOARD_TITLE, type BoardBackground } from '../../boards/boards.constants';
import { CreateBoardDto } from '../../boards/dto/board.dto';
import { trimString } from '../../common/transforms';

export const MAX_TEMPLATE_DESCRIPTION = 500;

// ===== Request =====

export class CreateBoardFromTemplateDto extends CreateBoardDto {
  @ApiPropertyOptional({ default: true, description: 'false: chỉ tạo danh sách + nhãn, bỏ các thẻ của mẫu' })
  @IsOptional()
  @IsBoolean({ message: 'keepCards phải là true hoặc false' })
  keepCards: boolean = true;
}

export class SaveTemplateDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_BOARD_TITLE, example: 'Quy trình phát hành', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên mẫu' })
  @MaxLength(MAX_BOARD_TITLE, { message: `Tên mẫu tối đa ${MAX_BOARD_TITLE} ký tự` })
  title: string;

  @ApiPropertyOptional({ maxLength: MAX_TEMPLATE_DESCRIPTION, example: 'Các bước kiểm tra trước mỗi lần phát hành', description: 'Tự động trim' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_TEMPLATE_DESCRIPTION, { message: `Mô tả tối đa ${MAX_TEMPLATE_DESCRIPTION} ký tự` })
  description?: string;

  @ApiPropertyOptional({ default: true, description: 'false: chỉ lưu khung (danh sách + nhãn), không lưu thẻ' })
  @IsOptional()
  @IsBoolean({ message: 'keepCards phải là true hoặc false' })
  keepCards: boolean = true;
}

class TemplateFieldsDto extends PickType(SaveTemplateDto, ['title', 'description'] as const) {
  @ApiProperty({ enum: BOARD_BACKGROUNDS, example: 'green', description: 'Phông nền mặc định cho bảng tạo từ mẫu' })
  @IsIn(BOARD_BACKGROUNDS, { message: `Phông nền phải là một trong: ${BOARD_BACKGROUNDS.join(', ')}` })
  background: BoardBackground;
}

/** Chỉ gửi trường cần đổi. */
export class UpdateTemplateDto extends PartialType(TemplateFieldsDto) {}

// ===== Response =====

export class TemplateSummaryDto {
  @ApiProperty({ example: 'scrum', description: 'Mẫu có sẵn: slug cố định; mẫu của tôi: CUID' })
  id: string;

  @ApiProperty({ example: true, description: 'Mẫu có sẵn (không sửa / xoá được)' })
  builtin: boolean;

  @ApiProperty({ example: 'Scrum' })
  title: string;

  @ApiProperty({ example: 'Quản lý Product Backlog, Sprint và các nghi thức Scrum.' })
  description: string;

  @ApiProperty({ type: String, nullable: true, example: 'Phát triển phần mềm', description: 'Nhóm của mẫu có sẵn; mẫu của tôi = null' })
  category: string | null;

  @ApiProperty({ enum: BOARD_BACKGROUNDS, example: 'purple' })
  background: string;

  @ApiProperty({ type: [String], example: ['Product Backlog', 'Sprint Backlog', 'Đang làm'], description: 'Tên các danh sách (xem trước)' })
  lists: string[];

  @ApiProperty({ example: 7, description: 'Tổng số thẻ' })
  cardCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Lúc lưu (mẫu có sẵn = null)' })
  createdAt: Date | null;
}

export class TemplateDetailDto extends TemplateSummaryDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      '`{ labels: [{ name, color }], lists: [{ title, cards: [{ title, description?, labels?: number[], coverColor?, checklists?: [{ title, items: string[] }] }] }] }` — ' +
      '`cards[].labels` là vị trí trong mảng `labels`',
  })
  content: Record<string, unknown>;
}

export class TemplatesResponseDto {
  @ApiProperty({ type: [TemplateSummaryDto], description: 'Mẫu có sẵn, theo thứ tự cố định' })
  builtin: TemplateSummaryDto[];

  @ApiProperty({ type: [TemplateSummaryDto], description: 'Mẫu của tôi, mới lưu trước' })
  mine: TemplateSummaryDto[];
}

export class TemplateResponseDto {
  @ApiProperty({ type: TemplateSummaryDto })
  template: TemplateSummaryDto;
}

export class TemplateDetailResponseDto {
  @ApiProperty({ type: TemplateDetailDto })
  template: TemplateDetailDto;
}

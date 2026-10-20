import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms';
import { MAX_CHECKLIST_ITEM_TITLE, MAX_CHECKLIST_TITLE } from '../boards.constants';

const TitleRules = (max: number, required: string, tooLong: string) =>
  applyDecorators(Transform(trimString), IsString(), IsNotEmpty({ message: required }), MaxLength(max, { message: tooLong }));

const ChecklistTitleRules = () =>
  TitleRules(MAX_CHECKLIST_TITLE, 'Vui lòng nhập tên checklist', `Tên checklist tối đa ${MAX_CHECKLIST_TITLE} ký tự`);

const ItemTitleRules = () =>
  TitleRules(MAX_CHECKLIST_ITEM_TITLE, 'Vui lòng nhập nội dung mục', `Nội dung mục tối đa ${MAX_CHECKLIST_ITEM_TITLE} ký tự`);

// ===== Request =====

export class CreateChecklistDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_CHECKLIST_TITLE, example: 'Việc cần làm', description: 'Tự động trim' })
  @ChecklistTitleRules()
  title: string;
}

/** Hiện chỉ đổi được tên. */
export class UpdateChecklistDto extends CreateChecklistDto {}

export class CreateChecklistItemDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_CHECKLIST_ITEM_TITLE, example: 'Viết test cho API', description: 'Tự động trim' })
  @ItemTitleRules()
  title: string;
}

export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: MAX_CHECKLIST_ITEM_TITLE, example: 'Viết test cho API (e2e)' })
  @IsOptional()
  @ItemTitleRules()
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'completed phải là true hoặc false' })
  completed?: boolean;
}

// ===== Response =====

export class ChecklistItemDto {
  @ApiProperty({ example: 'cmgitem00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgchk000000vq8h3b1c2d4e' })
  checklistId: string;

  @ApiProperty({ example: 'Viết test cho API' })
  title: string;

  @ApiProperty({ example: false })
  completed: boolean;

  @ApiProperty({ example: 1024, description: 'Thứ tự trong checklist (tăng dần)' })
  position: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;
}

export class ChecklistDto {
  @ApiProperty({ example: 'cmgchk000000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  cardId: string;

  @ApiProperty({ example: 'Việc cần làm' })
  title: string;

  @ApiProperty({ example: 1024, description: 'Thứ tự trong thẻ (tăng dần)' })
  position: number;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: [ChecklistItemDto], description: 'Các mục, đã sắp theo position' })
  items: ChecklistItemDto[];
}

export class ChecklistResponseDto {
  @ApiProperty({ type: ChecklistDto })
  checklist: ChecklistDto;
}

export class ChecklistItemResponseDto {
  @ApiProperty({ type: ChecklistItemDto })
  item: ChecklistItemDto;
}

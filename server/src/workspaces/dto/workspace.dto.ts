import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms';

export const MAX_WORKSPACE_NAME = 100;
export const MAX_WORKSPACE_DESCRIPTION = 500;

// ===== Request =====

export class CreateWorkspaceDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_WORKSPACE_NAME, example: 'Đội Marketing', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên không gian' })
  @MaxLength(MAX_WORKSPACE_NAME, { message: `Tên không gian tối đa ${MAX_WORKSPACE_NAME} ký tự` })
  name: string;

  @ApiPropertyOptional({ maxLength: MAX_WORKSPACE_DESCRIPTION, example: 'Các chiến dịch và nội dung của đội Marketing', description: 'Tự động trim' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(MAX_WORKSPACE_DESCRIPTION, { message: `Mô tả tối đa ${MAX_WORKSPACE_DESCRIPTION} ký tự` })
  description?: string;
}

/** Chỉ gửi trường cần đổi. */
export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {}

// ===== Response =====

/** Không gian kèm thông tin của user hiện tại. */
export class WorkspaceDto {
  @ApiProperty({ example: 'cmgws0000000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Đội Marketing' })
  name: string;

  @ApiProperty({ example: '' })
  description: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.ADMIN, description: 'Vai trò của user hiện tại trong không gian' })
  role: WorkspaceRole;

  @ApiProperty({ example: 3, description: 'Số thành viên của không gian' })
  memberCount: number;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Lúc user hiện tại tham gia — danh sách sắp theo trường này' })
  joinedAt: Date;
}

export class WorkspacesResponseDto {
  @ApiProperty({ type: [WorkspaceDto], description: 'Không gian mình là thành viên, tham gia sớm trước (không gian cá nhân thường đứng đầu)' })
  workspaces: WorkspaceDto[];
}

export class WorkspaceResponseDto {
  @ApiProperty({ type: WorkspaceDto })
  workspace: WorkspaceDto;
}

/** Không gian chứa bảng — kèm trong BoardSummaryDto. */
export class WorkspaceRefDto {
  @ApiProperty({ example: 'cmgws0000000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Đội Marketing' })
  name: string;
}

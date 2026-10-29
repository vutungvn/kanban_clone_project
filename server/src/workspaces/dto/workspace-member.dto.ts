import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../auth/dto/register.dto';
import { queryBoolean } from '../../common/transforms';

const ROLE_MESSAGE = `Vai trò phải là một trong: ${Object.values(WorkspaceRole).join(', ')}`;

// ===== Request =====

export class InviteWorkspaceMemberDto {
  @ApiProperty({ format: 'email', maxLength: 255, example: 'binh.tran@example.com', description: 'Email của người đã có tài khoản. Tự động trim và chuyển về chữ thường' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  @IsEnum(WorkspaceRole, { message: ROLE_MESSAGE })
  role: WorkspaceRole;
}

export class UpdateWorkspaceMemberDto {
  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.ADMIN })
  @IsEnum(WorkspaceRole, { message: ROLE_MESSAGE })
  role: WorkspaceRole;
}

export class RemoveWorkspaceMemberQueryDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'true: xoá cả khỏi mọi bảng của không gian (chỉ khi xoá người khác; tự rời thì luôn giữ các bảng — thành khách). ' +
      'Họ là quản trị viên duy nhất của bảng nào → người thực hiện được đặt làm quản trị viên của bảng đó.',
  })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean({ message: 'fromBoards phải là true hoặc false' })
  fromBoards: boolean = false;
}

// ===== Response =====

class PersonDto {
  @ApiProperty({ example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Trần Thị Bình' })
  name: string;

  @ApiProperty({ format: 'email', example: 'binh.tran@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;
}

export class WorkspaceMemberDto extends PersonDto {
  @ApiProperty({ enum: WorkspaceRole, example: WorkspaceRole.MEMBER })
  role: WorkspaceRole;

  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt: Date;
}

class GuestBoardDto {
  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Chiến dịch Q4' })
  title: string;
}

export class WorkspaceGuestDto extends PersonDto {
  @ApiProperty({ type: [GuestBoardDto], description: 'Các bảng của không gian mà khách tham gia (chỉ bảng bạn cũng là thành viên)' })
  boards: GuestBoardDto[];
}

export class WorkspaceMembersResponseDto {
  @ApiProperty({ type: [WorkspaceMemberDto], description: 'Tham gia sớm trước' })
  members: WorkspaceMemberDto[];

  @ApiProperty({
    type: [WorkspaceGuestDto],
    description: 'Khách: thành viên của bảng thuộc không gian nhưng không thuộc không gian — chỉ tính các bảng bạn cũng là thành viên',
  })
  guests: WorkspaceGuestDto[];
}

export class WorkspaceMemberResponseDto {
  @ApiProperty({ type: WorkspaceMemberDto })
  member: WorkspaceMemberDto;
}

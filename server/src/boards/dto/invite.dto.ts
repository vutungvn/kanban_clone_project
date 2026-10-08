import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { BoardRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn } from 'class-validator';
import { BOARD_BACKGROUNDS } from '../boards.constants';
import { BoardMemberDto } from './board.dto';

/** Liên kết chỉ cấp được vai trò thấp — muốn cấp ADMIN thì mời trực tiếp. */
export const LINK_ROLES = [BoardRole.MEMBER, BoardRole.VIEWER] as const;

// ===== Request =====

export class CreateInviteLinkDto {
  @ApiProperty({ enum: LINK_ROLES, example: BoardRole.MEMBER, description: 'Vai trò người vào qua link nhận được' })
  @IsIn(LINK_ROLES, { message: 'Liên kết chỉ cấp được vai trò MEMBER hoặc VIEWER' })
  role: BoardRole;

  @ApiProperty({ example: false, description: 'true: người mở link gửi yêu cầu, ADMIN duyệt mới vào được bảng' })
  @IsBoolean({ message: 'requiresApproval phải là true hoặc false' })
  requiresApproval: boolean;
}

/** Đổi cài đặt, giữ nguyên token. */
export class UpdateInviteLinkDto extends PartialType(CreateInviteLinkDto) {}

export class ApproveJoinRequestDto {
  @ApiProperty({ enum: BoardRole, example: BoardRole.MEMBER, description: 'ADMIN chủ động chọn nên được cấp mọi vai trò' })
  @IsEnum(BoardRole, { message: `Vai trò phải là một trong: ${Object.values(BoardRole).join(', ')}` })
  role: BoardRole;
}

// ===== Response =====

export class InviteLinkDto {
  @ApiProperty({ example: 'Qm9hcmRJbnZpdGVUb2tlbkV4YW1wbGUxMjM0NTY3ODk', description: 'Ghép thành URL /invite/{token}' })
  token: string;

  @ApiProperty({ enum: LINK_ROLES, example: BoardRole.MEMBER })
  role: BoardRole;

  @ApiProperty({ example: false })
  requiresApproval: boolean;
}

export class InviteLinkResponseDto {
  @ApiProperty({ type: InviteLinkDto, nullable: true, description: 'null = liên kết đang tắt' })
  link: InviteLinkDto | null;
}

class InviteBoardDto {
  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'Dự án Website' })
  title: string;

  @ApiProperty({ enum: BOARD_BACKGROUNDS, example: 'blue' })
  background: string;

  @ApiProperty({ example: 4 })
  memberCount: number;
}

export class InvitePreviewDto {
  @ApiProperty({ type: InviteBoardDto, description: 'Chỉ thông tin để xem trước — không có danh sách, thẻ, thành viên' })
  board: InviteBoardDto;

  @ApiProperty({ enum: LINK_ROLES, example: BoardRole.MEMBER, description: 'Vai trò sẽ nhận khi tham gia' })
  role: BoardRole;

  @ApiProperty({ example: false })
  requiresApproval: boolean;

  @ApiProperty({
    enum: ['NONE', 'PENDING', 'MEMBER'],
    example: 'NONE',
    description: 'Trạng thái của user hiện tại: chưa tham gia / đang chờ duyệt / đã là thành viên',
  })
  status: 'NONE' | 'PENDING' | 'MEMBER';
}

export class InvitePreviewResponseDto {
  @ApiProperty({ type: InvitePreviewDto })
  invite: InvitePreviewDto;
}

export class JoinResultDto {
  @ApiProperty({ enum: ['PENDING', 'MEMBER'], example: 'MEMBER' })
  status: 'PENDING' | 'MEMBER';

  @ApiProperty({ example: 'cmgboard0000vq8h3b1c2d4e' })
  boardId: string;
}

class JoinRequestUserDto extends OmitType(BoardMemberDto, ['role'] as const) {}

export class JoinRequestDto {
  @ApiProperty({ type: JoinRequestUserDto })
  user: JoinRequestUserDto;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;
}

export class JoinRequestsResponseDto {
  @ApiProperty({ type: [JoinRequestDto], description: 'Cũ nhất trước' })
  requests: JoinRequestDto[];
}

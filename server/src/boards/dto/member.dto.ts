import { ApiProperty } from '@nestjs/swagger';
import { BoardRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../auth/dto/register.dto';
import { BoardMemberDto } from './board.dto';

const ROLE_MESSAGE = `Vai trò phải là một trong: ${Object.values(BoardRole).join(', ')}`;

// ===== Request =====

export class InviteMemberDto {
  @ApiProperty({
    format: 'email',
    maxLength: 255,
    example: 'binh.tran@example.com',
    description: 'Email của người đã có tài khoản. Tự động trim và chuyển về chữ thường',
  })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ enum: BoardRole, example: BoardRole.MEMBER })
  @IsEnum(BoardRole, { message: ROLE_MESSAGE })
  role: BoardRole;
}

export class UpdateMemberDto {
  @ApiProperty({ enum: BoardRole, example: BoardRole.VIEWER })
  @IsEnum(BoardRole, { message: ROLE_MESSAGE })
  role: BoardRole;
}

// ===== Response =====

export class MemberResponseDto {
  @ApiProperty({ type: BoardMemberDto })
  member: BoardMemberDto;
}

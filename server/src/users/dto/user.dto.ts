import { ApiProperty } from '@nestjs/swagger';
import type { PublicUser } from '../users.service';

/** Thông tin công khai của user (không có passwordHash) — dùng cho tài liệu Swagger. */
export class UserDto implements PublicUser {
  @ApiProperty({ description: 'CUID', example: 'cmg9x2k7a0000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ format: 'email', example: 'an.nguyen@example.com' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn An' })
  name: string;

  @ApiProperty({ type: String, nullable: true, format: 'uri', example: null })
  avatarUrl: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-01-15T08:35:00.000Z', description: 'Lúc xác minh email; null = chưa xác minh' })
  emailVerifiedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;
}

export class UserResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}

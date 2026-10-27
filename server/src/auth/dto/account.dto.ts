import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../../common/transforms';

export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 50, example: 'Nguyễn Văn An', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên' })
  @MaxLength(50, { message: 'Tên tối đa 50 ký tự' })
  name: string;
}

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', example: 'matkhau123' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu hiện tại' })
  currentPassword: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72, example: 'matkhaumoi456' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  // bcrypt chỉ dùng 72 byte đầu tiên
  @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
  newPassword: string;
}

export class SessionDto {
  @ApiProperty({ example: 'cmgsess00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
  })
  userAgent: string | null;

  @ApiProperty({ type: String, nullable: true, example: '113.161.20.15' })
  ipAddress: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Lúc đăng nhập' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Lần hoạt động gần nhất (cập nhật mỗi lần làm mới token)' })
  lastActiveAt: Date;

  @ApiProperty({ example: true, description: 'Là phiên đang gọi API này' })
  current: boolean;
}

export class SessionsResponseDto {
  @ApiProperty({ type: [SessionDto], description: 'Phiên hiện tại trước, rồi theo lần hoạt động gần nhất' })
  sessions: SessionDto[];
}

export class RevokedCountResponseDto {
  @ApiProperty({ example: 2, description: 'Số thiết bị đã bị đăng xuất' })
  count: number;
}

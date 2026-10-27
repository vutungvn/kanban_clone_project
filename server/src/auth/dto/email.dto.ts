import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserResponseDto } from '../../users/dto/user.dto';
import { NextPath } from './next-path';
import { normalizeEmail } from './register.dto';

export class EmailDto {
  @ApiProperty({ format: 'email', example: 'an.nguyen@example.com', description: 'Tự động trim và chuyển về chữ thường' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;
}

export class ResendVerificationDto extends EmailDto {
  @ApiPropertyOptional({ example: '/invite/abc123', description: 'Trang mở tiếp sau khi xác minh + đăng nhập' })
  @IsOptional()
  @IsString()
  @NextPath()
  next?: string;
}

export class TokenDto {
  @ApiProperty({ description: 'Token trong liên kết email' })
  @IsString()
  @IsNotEmpty({ message: 'Thiếu token' })
  @MaxLength(200)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72, example: 'matkhaumoi456' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  // bcrypt chỉ dùng 72 byte đầu tiên
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password: string;
}

export class RegisterResponseDto extends UserResponseDto {
  @ApiProperty({ example: true, description: 'true = phải bấm link trong email trước khi đăng nhập' })
  verificationRequired: boolean;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ format: 'email', example: 'an.nguyen@example.com', description: 'Email vừa xác minh — điền sẵn ở trang đăng nhập' })
  email: string;
}

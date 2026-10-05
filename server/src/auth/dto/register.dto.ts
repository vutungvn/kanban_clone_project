import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @ApiProperty({
    format: 'email',
    maxLength: 255,
    example: 'an.nguyen@example.com',
    description: 'Tự động trim và chuyển về chữ thường',
  })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 1, maxLength: 50, example: 'Nguyễn Văn An', description: 'Tự động trim' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên' })
  @MaxLength(50, { message: 'Tên tối đa 50 ký tự' })
  name: string;

  @ApiProperty({ format: 'password', minLength: 8, maxLength: 72, example: 'matkhau123' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  // bcrypt chỉ dùng 72 byte đầu tiên
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  password: string;
}

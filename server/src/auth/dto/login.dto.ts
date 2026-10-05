import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { normalizeEmail } from './register.dto';

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'an.nguyen@example.com' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @ApiProperty({ format: 'password', example: 'matkhau123' })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  password: string;
}

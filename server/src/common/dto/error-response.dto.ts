import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Định dạng lỗi mặc định của NestJS — chỉ dùng cho tài liệu Swagger. */
export class ErrorResponseDto {
  @ApiProperty({ example: 401, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description: 'Thông báo lỗi; là mảng khi lỗi validate (400)',
    example: 'Chưa đăng nhập',
  })
  message: string | string[];

  @ApiPropertyOptional({ example: 'Unauthorized', description: 'Tên lỗi HTTP' })
  error?: string;
}

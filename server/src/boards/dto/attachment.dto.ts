import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../common/transforms';
import { MAX_ATTACHMENT_NAME } from '../../storage/files';

export class RenameAttachmentDto {
  @ApiProperty({ minLength: 1, maxLength: MAX_ATTACHMENT_NAME, example: 'Bản thiết kế v2.pdf', description: 'Tự động trim' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên tệp' })
  @MaxLength(MAX_ATTACHMENT_NAME, { message: `Tên tệp tối đa ${MAX_ATTACHMENT_NAME} ký tự` })
  name: string;
}

export class AttachmentDto {
  @ApiProperty({ example: 'cmgfile00000vq8h3b1c2d4e' })
  id: string;

  @ApiProperty({ example: 'cmgcard00000vq8h3b1c2d4e' })
  cardId: string;

  @ApiProperty({ example: 'Bản thiết kế.pdf', description: 'Tên tệp gốc (đổi được)' })
  name: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/raw/upload/v1/kanban/3f1c....pdf',
    description: 'Địa chỉ tệp gốc — ai có link đều mở được',
  })
  url: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://res.cloudinary.com/demo/image/upload/c_limit,w_600,f_auto,q_auto/v1/kanban/abc',
    description: 'Ảnh thu nhỏ (rộng tối đa 600px). null nếu không phải ảnh JPG / PNG / GIF / WEBP',
  })
  previewUrl: string | null;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 524288, description: 'Dung lượng (byte)' })
  size: number;

  @ApiProperty({ type: Number, nullable: true, example: null, description: 'Chiều rộng ảnh (px)' })
  width: number | null;

  @ApiProperty({ type: Number, nullable: true, example: null, description: 'Chiều cao ảnh (px)' })
  height: number | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-15T08:30:00.000Z' })
  createdAt: Date;
}

export class AttachmentResponseDto {
  @ApiProperty({ type: AttachmentDto })
  attachment: AttachmentDto;
}

import { ArgumentsHost, Catch, HttpStatus, PayloadTooLargeException, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/** Multer báo "File too large" (tiếng Anh) khi vượt giới hạn → đổi sang câu tiếng Việt. Dùng: @UseFilters(new FileTooLargeFilter('...')) */
@Catch(PayloadTooLargeException)
export class FileTooLargeFilter implements ExceptionFilter {
  constructor(private readonly message: string) {}

  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.PAYLOAD_TOO_LARGE)
      .json({ statusCode: HttpStatus.PAYLOAD_TOO_LARGE, message: this.message, error: 'Payload Too Large' });
  }
}

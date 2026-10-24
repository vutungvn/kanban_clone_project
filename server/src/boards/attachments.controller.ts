import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  type ExceptionFilter,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiAuth, ApiForbidden, ApiNotFound, ApiValidationError } from '../common/swagger/api-responses';
import { MAX_ATTACHMENT_SIZE, type UploadedFileData } from '../storage/files';
import { UPLOAD_FAILED } from '../storage/storage.service';
import { ATTACHMENT_NOT_FOUND, AttachmentsService, FILE_REQUIRED } from './attachments.service';
import { CARD_NOT_FOUND } from './boards.constants';
import { AttachmentResponseDto, RenameAttachmentDto } from './dto/attachment.dto';
import { UploadAttachmentResponseDto } from './dto/card.dto';

const VIEWER_FORBIDDEN = 'Bạn chỉ có quyền xem bảng này';
const FILE_TOO_LARGE = `Tệp tối đa ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB`;

/** Multer báo "File too large" (tiếng Anh) khi vượt giới hạn → đổi sang câu tiếng Việt. */
@Catch(PayloadTooLargeException)
class FileTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.PAYLOAD_TOO_LARGE)
      .json({ statusCode: HttpStatus.PAYLOAD_TOO_LARGE, message: FILE_TOO_LARGE, error: 'Payload Too Large' });
  }
}

@ApiTags('Attachments')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @ApiOperation({
    summary: 'Đính kèm tệp vào thẻ',
    description:
      `Gửi multipart/form-data, trường \`file\` (1 tệp, tối đa ${MAX_ATTACHMENT_SIZE / 1024 / 1024} MB). ` +
      'Ảnh JPG / PNG / GIF / WEBP có ảnh thu nhỏ; thẻ chưa có ảnh bìa thì ảnh vừa tải lên thành ảnh bìa. Cần vai trò MEMBER trở lên.',
  })
  @ApiParam({ name: 'cardId', description: 'ID thẻ' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ type: UploadAttachmentResponseDto })
  @ApiValidationError([FILE_REQUIRED])
  @ApiPayloadTooLargeResponse({
    type: ErrorResponseDto,
    description: 'Tệp quá lớn',
    example: { statusCode: 413, message: FILE_TOO_LARGE, error: 'Payload Too Large' },
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'Không lưu được tệp (lỗi Cloudinary / chưa cấu hình)',
    example: { statusCode: 503, message: UPLOAD_FAILED, error: 'Service Unavailable' },
  })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(CARD_NOT_FOUND)
  @UseFilters(FileTooLargeFilter)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 } }))
  @Post('cards/:cardId/attachments')
  upload(@CurrentUser() user: AuthUser, @Param('cardId') cardId: string, @UploadedFile() file: UploadedFileData | undefined) {
    return this.attachments.upload(cardId, user.id, file);
  }

  @ApiOperation({ summary: 'Đổi tên tệp đính kèm' })
  @ApiParam({ name: 'id', description: 'ID tệp đính kèm' })
  @ApiOkResponse({ type: AttachmentResponseDto })
  @ApiValidationError(['Vui lòng nhập tên tệp'])
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(ATTACHMENT_NOT_FOUND)
  @Patch('attachments/:id')
  async rename(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RenameAttachmentDto) {
    return { attachment: await this.attachments.rename(id, user.id, dto.name) };
  }

  @ApiOperation({ summary: 'Xoá tệp đính kèm', description: 'Đang là ảnh bìa thì thẻ hết ảnh bìa.' })
  @ApiParam({ name: 'id', description: 'ID tệp đính kèm' })
  @ApiNoContentResponse({ description: 'Đã xoá' })
  @ApiForbidden(VIEWER_FORBIDDEN)
  @ApiNotFound(ATTACHMENT_NOT_FOUND)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('attachments/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.attachments.remove(id, user.id);
  }
}

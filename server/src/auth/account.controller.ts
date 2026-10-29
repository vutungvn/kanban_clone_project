import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { ApiAuth, ApiValidationError } from '../common/swagger/api-responses';
import { FileTooLargeFilter } from '../storage/file-too-large.filter';
import { MAX_AVATAR_SIZE, type UploadedFileData } from '../storage/files';
import { UserResponseDto } from '../users/dto/user.dto';
import { AVATAR_NOT_IMAGE, AVATAR_REQUIRED, UsersService } from '../users/users.service';
import { AuthService, CANNOT_REVOKE_CURRENT, SAME_PASSWORD, SESSION_NOT_FOUND, WRONG_PASSWORD } from './auth.service';
import type { AuthUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  ChangePasswordDto,
  RevokedCountResponseDto,
  SessionsResponseDto,
  UpdateNotificationSettingsDto,
  UpdateProfileDto,
} from './dto/account.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

const AVATAR_TOO_LARGE = `Ảnh đại diện tối đa ${MAX_AVATAR_SIZE / 1024 / 1024} MB`;

/** Hồ sơ (tên, ảnh đại diện), cài đặt thông báo, mật khẩu và các phiên đăng nhập của chính mình. */
@ApiTags('Account')
@ApiAuth()
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @ApiOperation({ summary: 'Đổi tên hiển thị' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiValidationError(['Vui lòng nhập tên', 'Tên tối đa 50 ký tự'])
  @Patch('profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return { user: await this.users.updateName(user.id, dto.name) };
  }

  @ApiOperation({ summary: 'Cài đặt thông báo', description: 'Bật / tắt email nhắc hạn chót. Thông báo trong app không tắt được.' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiValidationError(['emailDueReminders phải là true hoặc false'])
  @Patch('notifications')
  async updateNotificationSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateNotificationSettingsDto) {
    return { user: await this.users.updateNotificationSettings(user.id, dto) };
  }

  @ApiOperation({
    summary: 'Đổi ảnh đại diện',
    description:
      `Gửi multipart/form-data, trường \`file\`: JPG / PNG / GIF / WEBP, tối đa ${MAX_AVATAR_SIZE / 1024 / 1024} MB. ` +
      'Ảnh được cắt vuông 256px (ưu tiên khuôn mặt). Ảnh cũ bị xoá.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiValidationError([AVATAR_REQUIRED, AVATAR_NOT_IMAGE])
  @ApiPayloadTooLargeResponse({
    type: ErrorResponseDto,
    description: 'Ảnh quá lớn',
    example: { statusCode: 413, message: AVATAR_TOO_LARGE, error: 'Payload Too Large' },
  })
  @UseFilters(new FileTooLargeFilter(AVATAR_TOO_LARGE))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_SIZE, files: 1 } }))
  @HttpCode(HttpStatus.OK)
  @Post('avatar')
  async setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedFileData | undefined) {
    return { user: await this.users.setAvatar(user.id, file) };
  }

  @ApiOperation({ summary: 'Gỡ ảnh đại diện', description: 'Quay về avatar chữ cái đầu.' })
  @ApiOkResponse({ type: UserResponseDto })
  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthUser) {
    return { user: await this.users.removeAvatar(user.id) };
  }

  @ApiOperation({
    summary: 'Đổi mật khẩu',
    description: 'Cần mật khẩu hiện tại. Đổi xong thì mọi thiết bị khác bị đăng xuất (thiết bị này vẫn giữ đăng nhập).',
  })
  @ApiOkResponse({ type: RevokedCountResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: `Sai mật khẩu hiện tại ("${WRONG_PASSWORD}"), mật khẩu mới trùng mật khẩu cũ ("${SAME_PASSWORD}"), hoặc dữ liệu không hợp lệ`,
    example: { statusCode: 400, message: WRONG_PASSWORD, error: 'Bad Request' },
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Vượt quá 5 request/phút/IP' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put('password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return { count: await this.auth.changePassword(user.id, user.sessionId, dto) };
  }

  @ApiOperation({ summary: 'Các phiên đăng nhập', description: 'Mọi thiết bị đang đăng nhập (còn hạn). `current` = thiết bị này.' })
  @ApiOkResponse({ type: SessionsResponseDto })
  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    return { sessions: await this.auth.listSessions(user.id, user.sessionId) };
  }

  @ApiOperation({
    summary: 'Đăng xuất mọi thiết bị khác',
    description: 'Thiết bị này vẫn giữ đăng nhập. Các tab đang mở trên thiết bị khác tự về trang đăng nhập.',
  })
  @ApiOkResponse({ type: RevokedCountResponseDto })
  @HttpCode(HttpStatus.OK)
  @Delete('sessions')
  async revokeOthers(@CurrentUser() user: AuthUser) {
    return { count: await this.auth.revokeOtherSessions(user.id, user.sessionId) };
  }

  @ApiOperation({ summary: 'Đăng xuất 1 thiết bị', description: 'Không dùng cho phiên hiện tại (dùng `POST /auth/logout`).' })
  @ApiParam({ name: 'id', description: 'ID phiên' })
  @ApiNoContentResponse({ description: 'Đã đăng xuất thiết bị đó' })
  @ApiValidationError([CANNOT_REVOKE_CURRENT])
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Phiên không tồn tại hoặc không phải của bạn',
    example: { statusCode: 404, message: SESSION_NOT_FOUND, error: 'Not Found' },
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  async revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.auth.revokeSession(user.id, id, user.sessionId);
  }
}

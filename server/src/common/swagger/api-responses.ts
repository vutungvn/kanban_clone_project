import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ACCESS_COOKIE } from '../../auth/auth.types';
import { ErrorResponseDto } from '../dto/error-response.dto';

/** Endpoint cần đăng nhập (JwtAuthGuard): khoá trên Swagger + response 401. */
export const ApiAuth = () =>
  applyDecorators(
    ApiCookieAuth(ACCESS_COOKIE),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      type: ErrorResponseDto,
      description: 'Chưa đăng nhập hoặc access token hết hạn',
      example: { statusCode: 401, message: 'Access token không hợp lệ hoặc đã hết hạn', error: 'Unauthorized' },
    }),
  );

export const ApiNotFound = (message: string, description = 'Không tồn tại hoặc bạn không phải thành viên của bảng') =>
  ApiNotFoundResponse({
    type: ErrorResponseDto,
    description,
    example: { statusCode: 404, message, error: 'Not Found' },
  });

export const ApiForbidden = (message: string, description = 'Vai trò trong bảng không đủ quyền') =>
  ApiForbiddenResponse({
    type: ErrorResponseDto,
    description,
    example: { statusCode: 403, message, error: 'Forbidden' },
  });

export const ApiValidationError = (messages: string[]) =>
  ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Dữ liệu gửi lên không hợp lệ',
    example: { statusCode: 400, message: messages, error: 'Bad Request' },
  });

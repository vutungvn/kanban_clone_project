import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/auth.types';

export const SWAGGER_PATH = 'api/docs';

const DESCRIPTION = `
REST API cho ứng dụng Kanban.

### Xác thực

API dùng **cookie httpOnly**, client không cần tự lưu token:

| Cookie | Nội dung | Thời hạn |
| --- | --- | --- |
| \`${ACCESS_COOKIE}\` | JWT access token | 15 phút |
| \`${REFRESH_COOKIE}\` | Refresh token \`sessionId.secret\` | 7 ngày (gia hạn mỗi lần refresh) |

**Test trên trang này:** gọi \`POST /auth/login\` → trình duyệt tự lưu cookie → các endpoint có ổ khoá
dùng được ngay, không cần bấm *Authorize*. Khi access token hết hạn (401), gọi \`POST /auth/refresh\`.

Với Postman/curl có thể gửi header \`Authorization: Bearer <access_token>\` thay cho cookie
(giá trị token lấy từ cookie \`${ACCESS_COOKIE}\` sau khi đăng nhập).

### Định dạng lỗi

Mọi lỗi trả về \`{ statusCode, message, error }\`. Lỗi validate (400) có \`message\` là mảng chuỗi.

### Rate limit

Mặc định 100 request/phút/IP; \`/auth/register\` và \`/auth/login\` giới hạn 5 request/phút/IP (vượt quá → 429).
`;

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Kanban API')
    .setDescription(DESCRIPTION)
    .setVersion('0.1.0')
    .addServer('/api')
    .addCookieAuth(ACCESS_COOKIE, { type: 'apiKey', in: 'cookie', description: 'JWT access token' }, ACCESS_COOKIE)
    .addCookieAuth(REFRESH_COOKIE, { type: 'apiKey', in: 'cookie', description: 'Refresh token' }, REFRESH_COOKIE)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token (thay cho cookie)' })
    .addTag('Health', 'Kiểm tra trạng thái server')
    .addTag('Auth', 'Đăng ký, đăng nhập, quản lý phiên')
    .build();

  // Path trong document không chứa prefix "/api" vì đã khai báo ở servers
  const document = SwaggerModule.createDocument(app, config, { ignoreGlobalPrefix: true });

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'Kanban API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}

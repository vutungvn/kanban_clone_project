import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/auth.types';

export const SWAGGER_PATH = 'api/docs';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Kanban API')
    .setDescription('REST API cho ứng dụng Kanban.')
    .setVersion('0.1.0')
    .addServer('/api')
    .addCookieAuth(ACCESS_COOKIE, { type: 'apiKey', in: 'cookie', description: 'JWT access token' }, ACCESS_COOKIE)
    .addCookieAuth(REFRESH_COOKIE, { type: 'apiKey', in: 'cookie', description: 'Refresh token' }, REFRESH_COOKIE)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token (thay cho cookie)' })
    .addTag('Health', 'Kiểm tra trạng thái server')
    .addTag('Auth', 'Đăng ký, đăng nhập, quản lý phiên')
    .addTag('Boards', 'Bảng công việc')
    .addTag('Members', 'Thành viên của bảng: mời, đổi vai trò, xoá / rời bảng')
    .addTag('Invites', 'Liên kết mời vào bảng và yêu cầu tham gia')
    .addTag('Lists', 'Danh sách (cột) trong bảng')
    .addTag('Cards', 'Thẻ công việc trong danh sách: nội dung, ngày, gắn nhãn, giao thành viên')
    .addTag('Labels', 'Nhãn của bảng (dùng chung cho mọi thẻ)')
    .addTag('Checklists', 'Checklist trong thẻ và các mục của nó')
    .addTag('Activities', 'Bình luận và lịch sử hoạt động của thẻ')
    .addTag('Notifications', 'Thông báo cá nhân')
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

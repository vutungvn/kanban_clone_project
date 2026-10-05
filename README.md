# Kanban Clone

Ứng dụng quản lý dự án dạng Kanban board (kiểu Trello/Jira).

| Phần      | Công nghệ                                 |
| --------- | ----------------------------------------- |
| Server    | NestJS 11, Prisma 6, socket.io (phase sau) |
| Database  | PostgreSQL 16 (Docker)                    |
| Client    | Next.js 15 (App Router), Tailwind CSS 4   |

## Cấu trúc

```
├── docker-compose.yml   # PostgreSQL
├── server/              # NestJS API  → http://localhost:4000/api
│                        # Swagger UI  → http://localhost:4000/api/docs
└── client/              # Next.js     → http://localhost:3000
```

## Chạy dự án

```bash
# 1. Database
docker compose up -d

# 2. Server
cd server
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm install
npx prisma migrate dev        # áp dụng migration có sẵn trong prisma/migrations
npm run start:dev

# 3. Client (terminal khác)
cd client
cp .env.example .env.local    # PowerShell: Copy-Item .env.example .env.local
npm install
npm run dev
```

Mở http://localhost:3000. Các biến môi trường được mô tả trong `server/.env.example` và `client/.env.example` (`.env`, `.env.local` không được commit).

## Tài liệu API (Swagger)

Khi server đang chạy:

| URL                                    | Nội dung                                   |
| -------------------------------------- | ------------------------------------------ |
| http://localhost:4000/api/docs         | Swagger UI — xem tài liệu và test API      |
| http://localhost:4000/api/docs-json    | OpenAPI 3 (JSON) — import vào Postman/Insomnia |

Test endpoint cần đăng nhập ngay trên Swagger UI:

1. `POST /auth/register` → tạo tài khoản (nếu chưa có).
2. `POST /auth/login` → server set cookie `access_token` + `refresh_token`; trình duyệt tự lưu.
3. Gọi các endpoint có ổ khoá (vd `GET /auth/me`) — cookie được gửi kèm tự động, **không cần** bấm *Authorize*.
4. Access token hết hạn sau 15 phút → gọi `POST /auth/refresh`.

> Dùng Postman/curl: có thể gửi header `Authorization: Bearer <token>` thay cho cookie (lấy token từ cookie `access_token`).

Swagger mặc định bật, tự tắt khi `NODE_ENV=production`; ghi đè bằng biến `SWAGGER_ENABLED=true|false`.

### Viết tài liệu cho endpoint mới

Cấu hình chung nằm ở [`server/src/swagger.ts`](server/src/swagger.ts). Quy ước khi thêm controller/DTO:

- Controller: `@ApiTags('<Nhóm>')` (khai báo nhóm mới bằng `.addTag()` trong `swagger.ts`).
- Mỗi endpoint: `@ApiOperation({ summary, description })` + một decorator response cho **mỗi** status code có thể trả về (`@ApiOkResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, ...). Response lỗi dùng `type: ErrorResponseDto` kèm `example`.
- Endpoint cần đăng nhập (`JwtAuthGuard`): thêm `@ApiCookieAuth('access_token')` và `@ApiBearerAuth()`.
- DTO request: mọi field có `@ApiProperty({ example, ... })`, khai báo `minLength`/`maxLength`/`format` khớp với rule `class-validator`.
- DTO response: tạo class riêng (vd [`UserDto`](server/src/users/dto/user.dto.ts)) — không trả entity Prisma trực tiếp.

## Xác thực (Phase 1)

| Method | Endpoint             | Mô tả                                        |
| ------ | -------------------- | -------------------------------------------- |
| POST   | `/api/auth/register` | Đăng ký `{ name, email, password }` (không tự đăng nhập) |
| POST   | `/api/auth/login`    | Đăng nhập `{ email, password }`              |
| POST   | `/api/auth/refresh`  | Cấp access token mới từ refresh token cookie |
| POST   | `/api/auth/logout`   | Xoá session + cookie                         |
| GET    | `/api/auth/me`       | Thông tin user hiện tại (cần đăng nhập)      |

Cơ chế:

- **Access token**: JWT 15 phút, lưu trong cookie `httpOnly` `access_token`.
- **Refresh token**: chuỗi ngẫu nhiên `sessionId.secret`, cookie `httpOnly` `refresh_token`, 7 ngày (gia hạn trượt mỗi lần refresh). DB chỉ lưu hash SHA-256 trong bảng `sessions`.
- **Đăng xuất** xoá session trong DB → refresh token bị vô hiệu ngay lập tức.
- Client tự gọi `/auth/refresh` khi gặp 401 rồi thử lại request.
- Rate limit: register/login 5 lần/phút/IP.
- Route cần bảo vệ trên server: dùng `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`.

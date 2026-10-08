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

## Bảng, danh sách, thẻ (Phase 2)

| Method | Endpoint                       | Mô tả                                             | Quyền tối thiểu |
| ------ | ------------------------------ | ------------------------------------------------- | --------------- |
| GET    | `/api/boards`                  | Bảng của tôi (kèm sao, lần xem gần nhất)          | —               |
| POST   | `/api/boards`                  | Tạo bảng `{ title, background }`                  | —               |
| GET    | `/api/boards/:id`              | Chi tiết bảng kèm danh sách + thẻ                 | VIEWER          |
| PATCH  | `/api/boards/:id`              | Đổi tên / phông nền                               | ADMIN           |
| DELETE | `/api/boards/:id`              | Xoá bảng (xoá theo danh sách, thẻ)                | ADMIN           |
| PUT    | `/api/boards/:id/star`         | Đánh dấu sao `{ starred }`                        | VIEWER          |
| POST   | `/api/boards/:boardId/lists`   | Thêm danh sách vào cuối bảng                      | MEMBER          |
| PATCH  | `/api/lists/:id`               | Đổi tên danh sách                                 | MEMBER          |
| DELETE | `/api/lists/:id`               | Xoá danh sách và thẻ bên trong                    | MEMBER          |
| POST   | `/api/lists/:listId/cards`     | Thêm thẻ vào cuối danh sách                       | MEMBER          |
| PATCH  | `/api/cards/:id`               | Sửa tiêu đề / mô tả thẻ                           | MEMBER          |
| DELETE | `/api/cards/:id`               | Xoá thẻ                                           | MEMBER          |
| PATCH  | `/api/lists/:id/move`          | Kéo thả danh sách `{ index }`                     | MEMBER          |
| PATCH  | `/api/cards/:id/move`          | Kéo thả thẻ `{ listId, index }` (cùng bảng)       | MEMBER          |
| POST   | `/api/boards/:boardId/members` | Mời người đã có tài khoản `{ email, role }`       | ADMIN           |
| PATCH  | `/api/boards/:boardId/members/:userId` | Đổi vai trò `{ role }`                    | ADMIN           |
| DELETE | `/api/boards/:boardId/members/:userId` | Xoá thành viên; `userId` là chính mình = rời bảng | ADMIN (rời bảng: mọi vai trò) |
| GET / PUT / PATCH / DELETE | `/api/boards/:boardId/invite-link` | Xem / tạo lại (token mới) / đổi cài đặt (giữ token) / tắt liên kết mời | ADMIN |
| GET    | `/api/boards/:boardId/join-requests` | Yêu cầu tham gia đang chờ                   | ADMIN           |
| POST   | `/api/boards/:boardId/join-requests/:userId/approve` | Duyệt `{ role }`              | ADMIN           |
| DELETE | `/api/boards/:boardId/join-requests/:userId` | Từ chối                               | ADMIN           |
| GET    | `/api/invites/:token`          | Xem trước lời mời (tên, phông nền, số thành viên, trạng thái của tôi) | Đã đăng nhập |
| POST   | `/api/invites/:token/join`     | Tham gia ngay, hoặc gửi yêu cầu nếu link cần duyệt | Đã đăng nhập |
| DELETE | `/api/invites/:token/request`  | Huỷ yêu cầu của tôi                               | Đã đăng nhập    |

- Người tạo bảng là `ADMIN`. Không phải thành viên → **404**; thiếu quyền → **403**.
- Thành viên: chỉ mời được email đã đăng ký (trim + chữ thường; chưa có tài khoản → 404, đã ở trong bảng → 409). Bảng luôn còn ít nhất 1 `ADMIN` — hạ quyền / xoá / rời bảng của ADMIN cuối cùng → **400**. Mọi thay đổi thành viên của 1 bảng chạy lần lượt (khoá dòng `boards` bằng `SELECT ... FOR UPDATE` trong transaction, kiểm tra quyền người thao tác sau khi khoá) nên 2 ADMIN hạ quyền nhau cùng lúc vẫn còn 1 ADMIN. Mời thành viên giới hạn 20 request/phút/IP.
- Liên kết mời: mỗi bảng 1 link (`boards.inviteToken`, 32 byte ngẫu nhiên), không hết hạn — muốn thu hồi thì tạo lại (token mới) hoặc tắt. Link chỉ cấp `MEMBER` / `VIEWER`. Đã là thành viên mà mở link → giữ nguyên vai trò. Chế độ "cần duyệt" (`inviteRequiresApproval`): mở link chỉ tạo yêu cầu trong `board_join_requests`, ADMIN duyệt (chọn vai trò, kể cả ADMIN) hoặc từ chối (người gửi gửi lại được). Mời thẳng bằng email / vào thẳng qua link → yêu cầu đang chờ tự xoá. Tắt hoặc tạo lại link không xoá yêu cầu đang chờ. `/invites/:token` giới hạn 30 request/phút/IP.
- Thứ tự danh sách / thẻ lưu bằng `position` (số thực, cách nhau 1024). Kéo thả: client chỉ gửi `index` (vị trí mới, không tính chính phần tử đó); server đọc thứ tự hiện tại trong DB, đặt position = trung bình 2 phần tử kề bên (chỉ cập nhật 1 dòng). Khi khe quá hẹp (< 1e-6) thì đánh số lại cả danh sách.
- Kéo thả trên client dùng `@dnd-kit` (`components/board/board-canvas.tsx`): chuột (kéo sau 5px — bấm thường vẫn là click), cảm ứng (giữ 200ms), bàn phím (Space nhấc / mũi tên / Space thả / Esc huỷ). Trong lúc kéo chỉ đổi giao diện; khi thả mới gọi API, lỗi thì hoàn tác + tải lại ngầm.
- Modal chi tiết thẻ (`components/board/card-detail-modal.tsx`): bấm thẻ (hoặc Enter) để mở; thẻ đang mở nằm trên URL `/b/:boardId?card=:cardId` nên gửi link được. Sửa tiêu đề, mô tả (Ctrl+Enter lưu), di chuyển sang danh sách/vị trí khác, xoá thẻ. Esc / bấm nền / nút X để đóng. Nút bút chì trên thẻ vẫn là sửa nhanh. Thành viên, nhãn, ngày, checklist, bình luận... hiện nhãn "Sắp có" (chưa có API).
- Chia sẻ bảng (`components/board/share-board-modal.tsx`, mở từ nút "Chia sẻ" hoặc cụm avatar trên header): ADMIN mời theo email, đổi vai trò, xoá thành viên; mọi người xem danh sách và tự rời bảng. Tự hạ quyền / xoá / rời bảng đều có bước xác nhận. Liên kết chia sẻ và yêu cầu tham gia: "Sắp có".
- Trang `/invite/:token`: xem trước bảng → "Tham gia bảng" / "Gửi yêu cầu tham gia" / đang chờ duyệt ("Kiểm tra lại", "Huỷ yêu cầu") / đã là thành viên. Chưa đăng nhập → `/login?next=...`, đi qua trang đăng ký vẫn giữ `next`; `next` chỉ nhận đường dẫn nội bộ (`lib/safe-path.ts`, chặn `//` và `/\`).
- Quyền thay đổi khi đang mở bảng (bị hạ quyền, bị xoá khỏi bảng): API trả 403/404 → `useBoard` hoàn tác, hiện toast rồi tải lại bảng — giao diện chuyển sang chỉ xem hoặc màn "Không tìm thấy bảng".
- Client: `lib/boards-store.ts` giữ danh sách bảng dùng chung; `lib/use-board.ts` quản lý 1 bảng — sửa/xoá cập nhật giao diện ngay rồi gọi API, lỗi thì hoàn tác và hiện toast.

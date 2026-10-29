# Kanban

Ứng dụng quản lý công việc theo bảng Kanban, cộng tác thời gian thực.

**Demo:** https://kanban-clone-project.vercel.app

## Tính năng chính

- **Tài khoản:** đăng ký kèm xác minh email, quên mật khẩu, quản lý phiên đăng nhập trên các thiết bị, ảnh đại diện, giao diện sáng / tối.
- **Không gian làm việc:** nhóm bảng theo đội. Không gian có thành viên (Quản trị / Thành viên) và khách. Bảng có 2 chế độ: Riêng tư, hoặc hiển thị với không gian (thành viên tự tham gia được).
- **Bảng:** danh sách và thẻ kéo thả (chuột, cảm ứng, bàn phím). Phân quyền ADMIN / MEMBER / VIEWER, mời qua email hoặc liên kết (có thể bật duyệt), lưu trữ và khôi phục.
- **Thẻ:** mô tả, nhãn, người được giao, ngày bắt đầu / hạn chót, checklist, tệp đính kèm, ảnh bìa, bình luận có `@nhắc tên`, lịch sử hoạt động. Sao chép thẻ, chuyển thẻ sang bảng khác.
- **Thời gian thực:** thay đổi trên bảng, thông báo trong app và trang Hoạt động cập nhật ngay qua Socket.IO.
- **Nhắc hạn chót:** job định kỳ báo khi thẻ còn dưới 24 giờ hoặc đã quá hạn, gửi cả thông báo trong app lẫn email (tắt được email).
- **Tìm kiếm toàn cục:** tìm bảng, thẻ (tiêu đề, mô tả) và bình luận bằng full-text search của Postgres, không phân biệt dấu.
- **Mẫu bảng:** 6 mẫu có sẵn (Kanban, Scrum…) và lưu bảng của mình thành mẫu.
- **Trang chủ:** các thẻ được giao cho mình, nhóm theo hạn chót.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| Client | Next.js 15 (App Router), React 19, Tailwind CSS 4, dnd-kit, Socket.IO client |
| Server | NestJS 11, Prisma 6, PostgreSQL 16, Socket.IO, Swagger |
| Lưu trữ tệp | Cloudinary (dev: thư mục `server/uploads/`) |
| Email | Brevo HTTP API hoặc SMTP |
| Hạ tầng | Vercel (client), Render (server), Neon (Postgres), GitHub Actions (CI/CD, cron) |

## Cấu trúc thư mục

```
client/                 Next.js
  src/app/              Các trang: (auth) đăng nhập / đăng ký..., (app) bảng, không gian, tài khoản...
  src/components/       Giao diện theo khu vực: board, boards, header, workspaces, templates...
  src/lib/              Gọi API, store, realtime, tiện ích
server/                 NestJS
  prisma/               schema.prisma + migrations
  src/                  Mỗi thư mục là 1 module: auth, boards, workspaces, notifications,
                        search, templates, reminders, realtime, storage, mail...
.github/workflows/      ci.yml (CI + deploy), due-reminders.yml (cron nhắc hạn)
docker-compose.yml      Postgres cho môi trường dev
```

## Chạy ở máy local

Yêu cầu: Node.js 24, Docker.

```bash
# 1. Database
docker compose up -d

# 2. Server — http://localhost:4000/api
cd server
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev

# 3. Client — http://localhost:3000 (terminal khác)
cd client
cp .env.example .env.local
npm install
npm run dev
```

Khi dev, mọi biến tuỳ chọn có thể để trống:
- Không cấu hình SMTP / Brevo → email chỉ in ra log, không bắt xác minh email.
- Không cấu hình Cloudinary → tệp đính kèm lưu vào `server/uploads/`.

**Tài liệu API (Swagger):** http://localhost:4000/api/docs

## Biến môi trường

Danh sách đầy đủ, kèm giải thích từng biến, nằm trong [server/.env.example](server/.env.example) và [client/.env.example](client/.env.example).

| Biến | Nơi đặt | Ghi chú |
|---|---|---|
| `DATABASE_URL` | server | Chuỗi kết nối Postgres |
| `JWT_ACCESS_SECRET` | server | Chuỗi ngẫu nhiên dài khi deploy |
| `CLIENT_URL` | server | Địa chỉ client (CORS, link trong email) |
| `COOKIE_SECURE` | server | `true` khi chạy HTTPS |
| `CLOUDINARY_*` | server | Bắt buộc khi deploy (ổ đĩa của Render bị xoá mỗi lần deploy) |
| `BREVO_API_KEY`, `MAIL_FROM` | server | Gửi email trên Render (gói free chặn SMTP) |
| `CRON_SECRET` | server + GitHub | Bảo vệ endpoint nhắc hạn chót |
| `NEXT_PUBLIC_API_URL`, `API_PROXY_TARGET`, `NEXT_PUBLIC_SOCKET_URL` | client | Khi deploy: client gọi `/api` trên chính domain, Next.js chuyển tiếp sang server |

## Deploy và CI/CD

Mỗi lần push lên `main`, workflow [ci.yml](.github/workflows/ci.yml) chạy:

1. Typecheck và build server, client.
2. Chạy toàn bộ migration lên database trống và kiểm tra `schema.prisma` khớp với migration.
3. Deploy server lên Render, chờ deploy xong rồi kiểm tra `/api/health`.
4. Deploy client lên Vercel, rồi kiểm tra toàn hệ thống qua proxy.

**Migration trên production:** lệnh build hoặc pre-deploy của service Render phải có `npx prisma migrate deploy`. Với migration có chuyển dữ liệu, nên tạo branch sao lưu trên Neon trước khi merge.

**Nhắc hạn chót:** gói free của Render cho server ngủ khi không có request, nên [due-reminders.yml](.github/workflows/due-reminders.yml) gọi endpoint nội bộ mỗi 15 phút để đánh thức server và quét hạn chót. Có thể chạy tay ở tab **Actions → Nhắc hạn chót → Run workflow**.

**GitHub Secrets cần có:**

| Secret | Dùng cho |
|---|---|
| `RENDER_API_KEY`, `RENDER_SERVICE_ID` | Deploy server |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Deploy client |
| `CRON_SECRET` | Cron nhắc hạn chót (cùng giá trị với biến trên Render) |

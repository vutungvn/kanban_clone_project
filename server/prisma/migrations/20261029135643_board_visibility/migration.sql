-- Chế độ hiển thị của bảng (giai đoạn 3 không gian làm việc).
-- Bảng đã có → PRIVATE: không ai thấy thêm bảng nào so với trước khi deploy.
-- Bảng tạo sau → mặc định WORKSPACE (thành viên không gian thấy và tự tham gia được).

-- CreateEnum
CREATE TYPE "BoardVisibility" AS ENUM ('PRIVATE', 'WORKSPACE');

-- AlterTable: thêm cột với mặc định PRIVATE để điền cho bảng cũ, rồi đổi mặc định sang WORKSPACE
ALTER TABLE "boards" ADD COLUMN "visibility" "BoardVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "boards" ALTER COLUMN "visibility" SET DEFAULT 'WORKSPACE';

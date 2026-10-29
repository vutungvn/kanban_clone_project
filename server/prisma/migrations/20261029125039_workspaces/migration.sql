-- Không gian làm việc (giai đoạn 1): mỗi bảng thuộc 1 không gian; mỗi user có 1 không gian cá nhân.
-- Dữ liệu cũ: tạo "Không gian của <tên>" cho MỌI user (user là ADMIN), gán mỗi bảng vào không gian của người tạo bảng.
-- Quyền vào bảng không đổi (vẫn theo board_members) — thành viên khác của bảng trở thành "khách" của không gian đó.

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- Không gian cá nhân cho mọi user. Tên theo tên gọi (chữ cuối của họ tên), giống giao diện cũ "Không gian của An".
-- Mỗi user đúng 1 dòng (createdById) → dùng để gán bảng ở bước dưới.
INSERT INTO "workspaces" ("id", "name", "description", "createdById", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       'Không gian của ' || regexp_replace(btrim(u."name"), '^.*\s', ''),
       '',
       u."id",
       u."createdAt",
       CURRENT_TIMESTAMP
FROM "users" u;

INSERT INTO "workspace_members" ("workspaceId", "userId", "role", "joinedAt")
SELECT w."id", w."createdById", 'ADMIN', w."createdAt"
FROM "workspaces" w;

-- Bảng cũ → không gian cá nhân của người tạo bảng
ALTER TABLE "boards" ADD COLUMN "workspaceId" TEXT;

UPDATE "boards" b
SET "workspaceId" = w."id"
FROM "workspaces" w
WHERE w."createdById" = b."ownerId";

ALTER TABLE "boards" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "workspaces_createdById_idx" ON "workspaces"("createdById");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE INDEX "boards_workspaceId_idx" ON "boards"("workspaceId");

-- AddForeignKey
ALTER TABLE "boards" ADD CONSTRAINT "boards_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

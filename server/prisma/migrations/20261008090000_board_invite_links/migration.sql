-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "inviteRequiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteRole" "BoardRole" NOT NULL DEFAULT 'MEMBER',
ADD COLUMN     "inviteToken" TEXT;

-- CreateTable
CREATE TABLE "board_join_requests" (
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "board_join_requests_pkey" PRIMARY KEY ("boardId","userId")
);

-- CreateIndex
CREATE INDEX "board_join_requests_userId_idx" ON "board_join_requests"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "boards_inviteToken_key" ON "boards"("inviteToken");

-- AddForeignKey
ALTER TABLE "board_join_requests" ADD CONSTRAINT "board_join_requests_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_join_requests" ADD CONSTRAINT "board_join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


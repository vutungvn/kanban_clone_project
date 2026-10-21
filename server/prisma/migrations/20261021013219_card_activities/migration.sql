-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('COMMENT', 'CARD_CREATED', 'CARD_RENAMED', 'CARD_MOVED', 'LABEL_ADDED', 'LABEL_REMOVED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'DATES_CHANGED', 'DUE_COMPLETE_CHANGED', 'CHECKLIST_ADDED', 'CHECKLIST_REMOVED', 'CHECKLIST_ITEM_COMPLETED', 'CHECKLIST_ITEM_UNCOMPLETED');

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ActivityType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "text" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_cardId_createdAt_idx" ON "activities"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "activities_boardId_createdAt_idx" ON "activities"("boardId", "createdAt");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

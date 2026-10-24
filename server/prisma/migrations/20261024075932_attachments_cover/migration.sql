-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'ATTACHMENT_ADDED';
ALTER TYPE "ActivityType" ADD VALUE 'ATTACHMENT_REMOVED';

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "coverAttachmentId" TEXT,
ADD COLUMN     "coverColor" TEXT;

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_cardId_createdAt_idx" ON "attachments"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "attachments_storageKey_idx" ON "attachments"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "cards_coverAttachmentId_key" ON "cards"("coverAttachmentId");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_coverAttachmentId_fkey" FOREIGN KEY ("coverAttachmentId") REFERENCES "attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;


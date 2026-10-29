-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CARD_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CARD_OVERDUE';

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "dueSoonNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailDueReminders" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "cards_dueDate_idx" ON "cards"("dueDate");

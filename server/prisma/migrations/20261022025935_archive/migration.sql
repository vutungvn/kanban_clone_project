-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'CARD_ARCHIVED';
ALTER TYPE "ActivityType" ADD VALUE 'CARD_RESTORED';
ALTER TYPE "ActivityType" ADD VALUE 'CARD_COPIED';

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lists" ADD COLUMN     "archivedAt" TIMESTAMP(3);

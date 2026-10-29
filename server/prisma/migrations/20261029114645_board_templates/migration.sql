-- CreateTable
CREATE TABLE "board_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "background" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_templates_ownerId_createdAt_idx" ON "board_templates"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "board_templates" ADD CONSTRAINT "board_templates_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

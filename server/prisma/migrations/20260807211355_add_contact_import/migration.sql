-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'IMPORT';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "notes" TEXT;

-- CreateTable
CREATE TABLE "ContactImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactImportBatch_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContactImportBatch" ADD CONSTRAINT "ContactImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

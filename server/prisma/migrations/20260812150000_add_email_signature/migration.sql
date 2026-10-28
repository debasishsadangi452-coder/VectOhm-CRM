-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailSignatureHtml" TEXT;

-- CreateTable
CREATE TABLE "EmailSignatureImage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSignatureImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSignatureImage_ownerId_idx" ON "EmailSignatureImage"("ownerId");

-- AddForeignKey
ALTER TABLE "EmailSignatureImage" ADD CONSTRAINT "EmailSignatureImage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

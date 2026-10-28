-- CreateEnum
CREATE TYPE "BulkSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "BulkEmailCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkEmailCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkEmailRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "status" "BulkSendStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkEmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkEmailRecipient_campaignId_status_idx" ON "BulkEmailRecipient"("campaignId", "status");

-- CreateIndex
CREATE INDEX "BulkEmailRecipient_status_createdAt_idx" ON "BulkEmailRecipient"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BulkEmailCampaign" ADD CONSTRAINT "BulkEmailCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkEmailCampaign" ADD CONSTRAINT "BulkEmailCampaign_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkEmailRecipient" ADD CONSTRAINT "BulkEmailRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BulkEmailCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkEmailRecipient" ADD CONSTRAINT "BulkEmailRecipient_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

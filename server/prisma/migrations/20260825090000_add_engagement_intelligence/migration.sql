-- Engagement Intelligence Phase 1: a unified EngagementEvent feed (email
-- sent/opened/clicked, deal/task/activity milestones) that lead scoring,
-- notifications, and the future Engagement Center dashboard all read from.
-- Also adds click-tracking columns to BulkEmailRecipient/SequenceSend
-- (mirroring their existing open-tracking columns) and reserves
-- providerMessageId/threadId on both for Phase 4 reply-linking.

-- CreateEnum
CREATE TYPE "EngagementEventType" AS ENUM ('EMAIL_SENT', 'EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_REPLIED', 'FOLLOWUP_SCHEDULED', 'FOLLOWUP_SENT', 'FOLLOWUP_DISMISSED', 'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'MEETING_BOOKED', 'CALL_LOGGED', 'TASK_COMPLETED', 'SEQUENCE_STARTED', 'SEQUENCE_COMPLETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMAIL_OPENED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMAIL_CLICKED';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "engagementScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "engagementTier" TEXT NOT NULL DEFAULT 'COLD';

-- AlterTable
ALTER TABLE "BulkEmailRecipient" ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "threadId" TEXT;

-- AlterTable
ALTER TABLE "SequenceSend" ADD COLUMN     "clickedAt" TIMESTAMP(3),
ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "EngagementEvent" (
    "id" TEXT NOT NULL,
    "type" "EngagementEventType" NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "campaignId" TEXT,
    "sequenceId" TEXT,
    "recipientId" TEXT,
    "ownerId" TEXT,
    "departmentId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EngagementEvent_contactId_idx" ON "EngagementEvent"("contactId");

-- CreateIndex
CREATE INDEX "EngagementEvent_dealId_idx" ON "EngagementEvent"("dealId");

-- CreateIndex
CREATE INDEX "EngagementEvent_campaignId_idx" ON "EngagementEvent"("campaignId");

-- CreateIndex
CREATE INDEX "EngagementEvent_sequenceId_idx" ON "EngagementEvent"("sequenceId");

-- CreateIndex
CREATE INDEX "EngagementEvent_ownerId_occurredAt_idx" ON "EngagementEvent"("ownerId", "occurredAt");

-- CreateIndex
CREATE INDEX "EngagementEvent_type_occurredAt_idx" ON "EngagementEvent"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BulkEmailCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementEvent" ADD CONSTRAINT "EngagementEvent_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

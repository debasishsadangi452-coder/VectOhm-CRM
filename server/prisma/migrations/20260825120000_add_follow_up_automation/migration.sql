-- Engagement Intelligence Phase 2: FollowUpTask is created automatically on
-- first email open (EngagementEventsService), then picked up by
-- FollowUpAutomationService's cron. followUpMode on Campaign/Sequence
-- controls whether that's a notify-only nudge (Manual, the default), an
-- AI-drafted-for-review nudge (Assisted), or an auto-sent follow-up
-- (Automated, opt-in only).

-- CreateEnum
CREATE TYPE "FollowUpMode" AS ENUM ('MANUAL', 'ASSISTED', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'COMPLETED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EMAIL_FOLLOWUP_DUE';

-- AlterTable
ALTER TABLE "BulkEmailCampaign" ADD COLUMN     "followUpMode" "FollowUpMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Sequence" ADD COLUMN     "followUpMode" "FollowUpMode" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT,
    "contactId" TEXT NOT NULL,
    "recipientId" TEXT,
    "campaignId" TEXT,
    "sequenceId" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT NOT NULL,
    "aiDraftSubject" TEXT,
    "aiDraftBody" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpTask_assignedTo_status_dueAt_idx" ON "FollowUpTask"("assignedTo", "status", "dueAt");

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "EngagementEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BulkEmailCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


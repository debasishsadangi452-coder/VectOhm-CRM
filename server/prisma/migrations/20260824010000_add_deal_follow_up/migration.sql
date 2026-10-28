-- Rep-set follow-up reminder on Deal, plus a FOLLOW_UP_DUE notification type
-- so DealFollowUpsService's hourly cron can notify + email the deal owner.
ALTER TABLE "Deal" ADD COLUMN "followUpAt" TIMESTAMP(3);
ALTER TABLE "Deal" ADD COLUMN "followUpNotifiedAt" TIMESTAMP(3);

ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_UP_DUE';

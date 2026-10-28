-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_EARLY';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "shiftStart" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN "shiftEnd" TEXT NOT NULL DEFAULT '19:00';

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "earlyByMin" INTEGER,
ADD COLUMN "earlyReason" TEXT;

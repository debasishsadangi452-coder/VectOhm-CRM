-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_ABSENT';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_NO_CLOCKOUT';
ALTER TYPE "NotificationType" ADD VALUE 'ATTENDANCE_REPEAT_LATE';

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "autoClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoClosedAt" TIMESTAMP(3),
ADD COLUMN "correctedClockOutAt" TIMESTAMP(3),
ADD COLUMN "correctionNote" TEXT,
ADD COLUMN "correctionSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsenceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHoliday_date_key" ON "CompanyHoliday"("date");

-- CreateIndex
CREATE INDEX "AbsenceRecord_date_idx" ON "AbsenceRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AbsenceRecord_userId_date_key" ON "AbsenceRecord"("userId", "date");

-- AddForeignKey
ALTER TABLE "AbsenceRecord" ADD CONSTRAINT "AbsenceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

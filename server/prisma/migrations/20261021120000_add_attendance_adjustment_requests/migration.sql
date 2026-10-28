-- CreateEnum
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "adjustmentRequestId" TEXT;

-- CreateTable
CREATE TABLE "AttendanceAdjustmentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "forDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceAdjustmentRequest_status_createdAt_idx" ON "AttendanceAdjustmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAdjustmentRequest_userId_forDate_idx" ON "AttendanceAdjustmentRequest"("userId", "forDate");

-- AddForeignKey
ALTER TABLE "AttendanceAdjustmentRequest" ADD CONSTRAINT "AttendanceAdjustmentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustmentRequest" ADD CONSTRAINT "AttendanceAdjustmentRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

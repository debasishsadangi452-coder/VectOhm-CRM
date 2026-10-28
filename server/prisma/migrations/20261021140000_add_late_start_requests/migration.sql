-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "approvedLateStartId" TEXT;

-- CreateTable
CREATE TABLE "LateStartRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "forDay" TEXT NOT NULL,
    "expectedLateMin" INTEGER NOT NULL,
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LateStartRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LateStartRequest_status_createdAt_idx" ON "LateStartRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LateStartRequest_userId_forDay_idx" ON "LateStartRequest"("userId", "forDay");

-- AddForeignKey
ALTER TABLE "LateStartRequest" ADD CONSTRAINT "LateStartRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateStartRequest" ADD CONSTRAINT "LateStartRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

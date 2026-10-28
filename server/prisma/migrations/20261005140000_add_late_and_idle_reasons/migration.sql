-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "lateByMin" INTEGER,
ADD COLUMN "lateReason" TEXT,
ADD COLUMN "lateReasonAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "IdleEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "idleStartedAt" TIMESTAMP(3) NOT NULL,
    "idleMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdleEvent_workSessionId_idx" ON "IdleEvent"("workSessionId");

-- CreateIndex
CREATE INDEX "IdleEvent_userId_idleStartedAt_idx" ON "IdleEvent"("userId", "idleStartedAt");

-- AddForeignKey
ALTER TABLE "IdleEvent" ADD CONSTRAINT "IdleEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdleEvent" ADD CONSTRAINT "IdleEvent_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

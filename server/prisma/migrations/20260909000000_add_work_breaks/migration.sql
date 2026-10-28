-- AlterTable
ALTER TABLE "WorkSession" ADD COLUMN "lastBreakEndedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WorkBreak" (
    "id" TEXT NOT NULL,
    "workSessionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationMin" INTEGER,
    "autoEnded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkBreak_workSessionId_idx" ON "WorkBreak"("workSessionId");

-- AddForeignKey
ALTER TABLE "WorkBreak" ADD CONSTRAINT "WorkBreak_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

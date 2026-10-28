-- CreateTable
CREATE TABLE "ScreenRecording" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workSessionId" TEXT,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenRecording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenRecording_userId_startedAt_idx" ON "ScreenRecording"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ScreenRecording_startedAt_idx" ON "ScreenRecording"("startedAt");

-- AddForeignKey
ALTER TABLE "ScreenRecording" ADD CONSTRAINT "ScreenRecording_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecording" ADD CONSTRAINT "ScreenRecording_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ScreenCapture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workSessionId" TEXT,
    "storagePath" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenCapture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenCapture_userId_capturedAt_idx" ON "ScreenCapture"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "ScreenCapture_capturedAt_idx" ON "ScreenCapture"("capturedAt");

-- AddForeignKey
ALTER TABLE "ScreenCapture" ADD CONSTRAINT "ScreenCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenCapture" ADD CONSTRAINT "ScreenCapture_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

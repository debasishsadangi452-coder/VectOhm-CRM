-- CreateTable
CREATE TABLE "ActivityPing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workSessionId" TEXT,
    "idleSeconds" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityPing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityPing_userId_capturedAt_idx" ON "ActivityPing"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "ActivityPing_capturedAt_idx" ON "ActivityPing"("capturedAt");

-- AddForeignKey
ALTER TABLE "ActivityPing" ADD CONSTRAINT "ActivityPing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPing" ADD CONSTRAINT "ActivityPing_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "WorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

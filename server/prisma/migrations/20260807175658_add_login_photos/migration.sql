-- CreateTable
CREATE TABLE "LoginPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginEventId" TEXT,
    "storagePath" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginPhoto_userId_capturedAt_idx" ON "LoginPhoto"("userId", "capturedAt");

-- CreateIndex
CREATE INDEX "LoginPhoto_capturedAt_idx" ON "LoginPhoto"("capturedAt");

-- AddForeignKey
ALTER TABLE "LoginPhoto" ADD CONSTRAINT "LoginPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginPhoto" ADD CONSTRAINT "LoginPhoto_loginEventId_fkey" FOREIGN KEY ("loginEventId") REFERENCES "LoginEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

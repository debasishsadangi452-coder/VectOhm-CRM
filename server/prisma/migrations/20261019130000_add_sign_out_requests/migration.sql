-- CreateEnum
CREATE TYPE "SignOutRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "SignOutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SignOutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),

    CONSTRAINT "SignOutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignOutRequest_status_createdAt_idx" ON "SignOutRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SignOutRequest_userId_createdAt_idx" ON "SignOutRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "SignOutRequest" ADD CONSTRAINT "SignOutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignOutRequest" ADD CONSTRAINT "SignOutRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

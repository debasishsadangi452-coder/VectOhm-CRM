-- Adds CompanyGrowthSignal: a reviewable "this company looks like it's
-- expanding" signal for Sales (hiring velocity, computed from existing
-- HiringSignal data, plus Claude-classified news articles). Nothing emails
-- anyone until a Sales user explicitly accepts a signal -- see
-- CompanyGrowthService.accept(). Generated via `prisma migrate diff`
-- against the local dev DB, same approach as this repo's other migrations
-- (see 20260926221500_add_hiring_signals's own comment for why).

-- CreateEnum
CREATE TYPE "CompanyGrowthSignalType" AS ENUM ('HIRING_VELOCITY', 'NEWS_EXPANSION', 'NEWS_FUNDING', 'NEWS_DEAL');

-- CreateEnum
CREATE TYPE "CompanyGrowthSignalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'COMPANY_GROWTH_SIGNAL';

-- CreateTable
CREATE TABLE "CompanyGrowthSignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "CompanyGrowthSignalType" NOT NULL,
    "status" "CompanyGrowthSignalStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sequenceId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyGrowthSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyGrowthSignal_companyId_detectedAt_idx" ON "CompanyGrowthSignal"("companyId", "detectedAt");

-- CreateIndex
CREATE INDEX "CompanyGrowthSignal_status_detectedAt_idx" ON "CompanyGrowthSignal"("status", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGrowthSignal_companyId_type_sourceUrl_key" ON "CompanyGrowthSignal"("companyId", "type", "sourceUrl");

-- AddForeignKey
ALTER TABLE "CompanyGrowthSignal" ADD CONSTRAINT "CompanyGrowthSignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyGrowthSignal" ADD CONSTRAINT "CompanyGrowthSignal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

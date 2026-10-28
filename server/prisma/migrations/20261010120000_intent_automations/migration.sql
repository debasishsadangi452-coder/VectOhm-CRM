-- CreateEnum
CREATE TYPE "IntentAutomationSource" AS ENUM ('HIRING', 'NEWS', 'BOTH');

-- CreateEnum
CREATE TYPE "IntentAutomationFrequency" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY');

-- CreateEnum
CREATE TYPE "IntentAutomationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "IntentOutreachStatus" AS ENUM ('PENDING_APPROVAL', 'SENT', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "IntentAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" "IntentAutomationSource" NOT NULL,
    "roles" TEXT[],
    "location" TEXT,
    "newsKeywords" TEXT,
    "newsCategory" TEXT,
    "newsDaysBack" INTEGER NOT NULL DEFAULT 30,
    "frequency" "IntentAutomationFrequency" NOT NULL DEFAULT 'DAILY',
    "timeOfDay" TEXT NOT NULL DEFAULT '09:00',
    "weekday" INTEGER,
    "autoSend" BOOLEAN NOT NULL DEFAULT false,
    "dailyCap" INTEGER NOT NULL DEFAULT 25,
    "cooldownDays" INTEGER NOT NULL DEFAULT 30,
    "offerDescription" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'friendly and professional',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentAutomationRun" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'SCHEDULE',
    "status" "IntentAutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "leadsFound" INTEGER NOT NULL DEFAULT 0,
    "queued" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "IntentAutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentAutomationOutreach" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "runId" TEXT,
    "companyName" TEXT NOT NULL,
    "companyDomain" TEXT,
    "contactName" TEXT NOT NULL,
    "contactTitle" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactId" TEXT,
    "signalType" TEXT NOT NULL,
    "signalTitle" TEXT NOT NULL,
    "signalUrl" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "IntentOutreachStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentAutomationOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentAutomation_isActive_nextRunAt_idx" ON "IntentAutomation"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "IntentAutomationRun_automationId_startedAt_idx" ON "IntentAutomationRun"("automationId", "startedAt");

-- CreateIndex
CREATE INDEX "IntentAutomationOutreach_automationId_createdAt_idx" ON "IntentAutomationOutreach"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "IntentAutomationOutreach_contactEmail_createdAt_idx" ON "IntentAutomationOutreach"("contactEmail", "createdAt");

-- CreateIndex
CREATE INDEX "IntentAutomationOutreach_status_idx" ON "IntentAutomationOutreach"("status");

-- AddForeignKey
ALTER TABLE "IntentAutomation" ADD CONSTRAINT "IntentAutomation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentAutomationRun" ADD CONSTRAINT "IntentAutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "IntentAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentAutomationOutreach" ADD CONSTRAINT "IntentAutomationOutreach_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "IntentAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentAutomationOutreach" ADD CONSTRAINT "IntentAutomationOutreach_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntentAutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

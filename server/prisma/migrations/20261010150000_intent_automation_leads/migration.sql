-- CreateEnum
CREATE TYPE "IntentLeadOutcome" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "IntentAutomationLead" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyDomain" TEXT,
    "companyLocation" TEXT,
    "signalType" TEXT NOT NULL,
    "signalTitle" TEXT NOT NULL,
    "signalUrl" TEXT,
    "signalDetail" TEXT,
    "signalDate" TIMESTAMP(3),
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactEmail" TEXT,
    "contactLinkedin" TEXT,
    "outcome" "IntentLeadOutcome" NOT NULL,
    "skipReason" TEXT,
    "outreachId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentAutomationLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentAutomationLead_automationId_createdAt_idx" ON "IntentAutomationLead"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "IntentAutomationLead_runId_idx" ON "IntentAutomationLead"("runId");

-- AddForeignKey
ALTER TABLE "IntentAutomationLead" ADD CONSTRAINT "IntentAutomationLead_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "IntentAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentAutomationLead" ADD CONSTRAINT "IntentAutomationLead_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntentAutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

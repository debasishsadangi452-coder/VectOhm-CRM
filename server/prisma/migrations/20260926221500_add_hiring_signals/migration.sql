-- Adds HiringSignalAutomation + HiringSignal for the intent-based BDR
-- outreach module: a recruiter/Sales-configured rule that discovers
-- companies with fresh hiring activity (Greenhouse/Ashby/Lever/Adzuna --
-- deliberately no LinkedIn, see the model's doc comment in schema.prisma)
-- and chains into the existing ApolloService enrichment + SequencesService
-- enrollment flow. Generated via `prisma migrate diff` against the local dev
-- DB rather than `prisma migrate dev`, since this repo still carries the
-- pre-existing local migration-history drift documented in
-- 20260913000000_recover_bug_seo_task_qa_schema -- same recovery approach
-- used by 20260913010000_add_job_board_connections.

-- CreateEnum
CREATE TYPE "HiringSignalSource" AS ENUM ('GREENHOUSE', 'ASHBY', 'LEVER', 'ADZUNA');

-- CreateTable
CREATE TABLE "HiringSignalAutomation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "industries" TEXT[],
    "locations" TEXT[],
    "keywords" TEXT,
    "adzunaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adzunaRoleKeywords" TEXT[],
    "targetTitles" TEXT[],
    "sequenceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringSignalAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringSignal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "automationId" TEXT,
    "source" "HiringSignalSource" NOT NULL,
    "externalJobId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "jobUrl" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HiringSignal_companyId_source_externalJobId_key" ON "HiringSignal"("companyId", "source", "externalJobId");

-- AddForeignKey
ALTER TABLE "HiringSignalAutomation" ADD CONSTRAINT "HiringSignalAutomation_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "Sequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringSignalAutomation" ADD CONSTRAINT "HiringSignalAutomation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringSignal" ADD CONSTRAINT "HiringSignal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringSignal" ADD CONSTRAINT "HiringSignal_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "HiringSignalAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

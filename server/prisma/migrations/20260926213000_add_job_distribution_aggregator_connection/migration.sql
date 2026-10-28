-- Adds JobDistributionAggregatorConnection: a single set of credentials for
-- a job-distribution aggregator (Broadbean, Appcast, JobTarget, etc.) that
-- fans one posting out to many boards, as an alternative to the per-board
-- JobBoardConnection partnerships which are out of reach for a single
-- company. Generated via `prisma migrate diff` against the local dev DB
-- rather than `prisma migrate dev`, since this repo still carries the
-- pre-existing local migration-history drift documented in
-- 20260913000000_recover_bug_seo_task_qa_schema -- same recovery approach
-- used by 20260913010000_add_job_board_connections.

-- CreateTable
CREATE TABLE "JobDistributionAggregatorConnection" (
    "id" TEXT NOT NULL DEFAULT 'job-distribution-aggregator-connection',
    "provider" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDistributionAggregatorConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobDistributionAggregatorConnection" ADD CONSTRAINT "JobDistributionAggregatorConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Adds JobBoardConnection for the Recruitment panel's per-board API key
-- settings (LinkedIn/Naukri/Glassdoor). Generated via `prisma migrate diff`
-- against the local dev DB rather than `prisma migrate dev`, since this repo
-- still carries the pre-existing local migration-history drift documented in
-- 20260913000000_recover_bug_seo_task_qa_schema -- same recovery approach.

-- CreateTable
CREATE TABLE "JobBoardConnection" (
    "board" "JobBoard" NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBoardConnection_pkey" PRIMARY KEY ("board")
);

-- AddForeignKey
ALTER TABLE "JobBoardConnection" ADD CONSTRAINT "JobBoardConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


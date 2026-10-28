-- Job board syndication: replaces the unused flat linkedinUrl/naukriUrl/
-- indeedUrl/glassdoorUrl columns on JobPosting (never set by any DTO, only
-- ever seeded) with a real per-board status model. See
-- server/src/modules/job-board-syndication.
--
-- Generated via `prisma migrate diff --from-url <local-db> --to-schema-datamodel
-- schema.prisma --script` rather than `prisma migrate dev`, because the local
-- dev database already has pre-existing drift from migrations missing in
-- this directory (see 20260826090001_add_recruitment_ros_tables for the
-- same situation) -- same recovery approach as that migration.

-- CreateEnum
CREATE TYPE "JobBoard" AS ENUM ('LINKEDIN', 'NAUKRI', 'INDEED', 'GLASSDOOR');

-- CreateEnum
CREATE TYPE "JobBoardListingStatus" AS ENUM ('PENDING', 'POSTED', 'FAILED');

-- AlterTable
ALTER TABLE "JobPosting" DROP COLUMN "glassdoorUrl",
DROP COLUMN "indeedUrl",
DROP COLUMN "linkedinUrl",
DROP COLUMN "naukriUrl";

-- CreateTable
CREATE TABLE "JobBoardListing" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "board" "JobBoard" NOT NULL,
    "status" "JobBoardListingStatus" NOT NULL DEFAULT 'PENDING',
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "errorMessage" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobBoardListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobBoardListing_jobPostingId_board_key" ON "JobBoardListing"("jobPostingId", "board");

-- AddForeignKey
ALTER TABLE "JobBoardListing" ADD CONSTRAINT "JobBoardListing_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Adds real, shared tables for the job-detail-panel's collaboration
-- sub-entities (tasks, activity log, email merges, submissions, notes,
-- documents) -- these previously lived only in each browser's localStorage,
-- so they were never actually shared across users/devices despite the
-- Ceipal CRM otherwise being backend-connected.
--
-- Generated via `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
-- (no live database needed), with this migration's copy of the
-- already-applied-elsewhere Vendor/Lead column additions
-- (20260916140000_add_vendor_lead_quick_create_fields) removed since that
-- migration already covers them. No local dev database was reachable this
-- session either, same as the two prior hand-written migrations in this
-- series.

-- CreateEnum
CREATE TYPE "JobActivityType" AS ENUM ('CREATION', 'STATUS_CHANGE', 'BOARD', 'TASK', 'SUBMISSION', 'BROADCAST', 'GENERAL');

-- CreateTable
CREATE TABLE "JobTask" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "dueDate" TEXT,
    "timeZone" TEXT,
    "assignedTo" TEXT,
    "assignedBy" TEXT,
    "status" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobActivity" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "JobActivityType" NOT NULL DEFAULT 'GENERAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEmailMerge" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "searchString" TEXT,
    "zipLocation" TEXT,
    "subject" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEmailMerge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSubmission" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "candidateId" TEXT,
    "name" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "contact" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL,
    "statusLabel" TEXT,
    "payRate" TEXT,
    "billRate" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobNote" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "action" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDocument" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "size" TEXT,
    "addedBy" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTask" ADD CONSTRAINT "JobTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEmailMerge" ADD CONSTRAINT "JobEmailMerge_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEmailMerge" ADD CONSTRAINT "JobEmailMerge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission" ADD CONSTRAINT "JobSubmission_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission" ADD CONSTRAINT "JobSubmission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission" ADD CONSTRAINT "JobSubmission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobNote" ADD CONSTRAINT "JobNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Recovers four generations of schema changes (bug tracking + tester
-- workflow, task QA fields, SEO hub + marketing campaigns, and related enum
-- additions) that were applied to a local dev database via `prisma db push`
-- at some point and never captured as committed migration files -- so they
-- were never deployed to production. Confirmed via
-- `prisma migrate diff --from-url <production-db> --to-schema-datamodel
-- schema.prisma --script` run against the live production database (see
-- server/src/modules/job-board-syndication's deploy investigation), the same
-- recovery technique already used for 20260826090001_add_recruitment_ros_tables.
--
-- The only non-additive change here is SeoBacklink.status being dropped and
-- recreated under a new enum type (BacklinkStatus -> BacklinkVerificationStatus)
-- -- verified safe: production's SeoBacklink table has zero rows. Every other
-- change is a new table or a nullable/defaulted column addition on an
-- existing table, so this cannot lose data in production's current state.
--
-- Confirmed clean (empty diff) against the local dev database before being
-- committed -- local already has this exact schema from the same undocumented
-- history, so this migration is resolved there via `prisma migrate resolve
-- --applied` rather than re-run.

-- CreateEnum
CREATE TYPE "BugSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'TO_BE_TESTED', 'RETESTING', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "BacklinkVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'LOST');

-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OVERDUE');

-- AlterEnum
BEGIN;
CREATE TYPE "ContentBriefStatus_new" AS ENUM ('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'PUBLISHED');
ALTER TABLE "public"."SeoContentBrief" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SeoContentBrief" ALTER COLUMN "status" TYPE "ContentBriefStatus_new" USING ("status"::text::"ContentBriefStatus_new");
ALTER TYPE "ContentBriefStatus" RENAME TO "ContentBriefStatus_old";
ALTER TYPE "ContentBriefStatus_new" RENAME TO "ContentBriefStatus";
DROP TYPE "public"."ContentBriefStatus_old";
ALTER TABLE "SeoContentBrief" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'READY_FOR_TESTING';
ALTER TYPE "TaskStatus" ADD VALUE 'CHANGES_REQUIRED';

-- AlterTable
ALTER TABLE "SeoBacklink" ADD COLUMN     "anchorText" TEXT,
ADD COLUMN     "linkType" TEXT NOT NULL DEFAULT 'DOFOLLOW',
ADD COLUMN     "loggedById" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "spamScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifiedById" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "BacklinkVerificationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "SeoContentBrief" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "outlineJson" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "publishDate" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "secondaryKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slaStatus" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
ADD COLUMN     "targetWordCount" INTEGER NOT NULL DEFAULT 1500;

-- AlterTable
ALTER TABLE "SeoKeyword" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "searchIntent" TEXT DEFAULT 'INFORMATIONAL';

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "testerId" TEXT,
ADD COLUMN     "testingApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "testingNotes" TEXT;

-- AlterTable
ALTER TABLE "TaskUpdate" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "blockers" TEXT,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nextPlan" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "workCompleted" TEXT;

-- AlterTable
ALTER TABLE "TimeLog" ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "subtaskId" TEXT;

-- DropEnum
DROP TYPE "BacklinkStatus";

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bug" (
    "id" TEXT NOT NULL,
    "bugNumber" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taskId" TEXT NOT NULL,
    "subtaskId" TEXT,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "severity" "BugSeverity" NOT NULL DEFAULT 'MEDIUM',
    "priority" "BugPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BugStatus" NOT NULL DEFAULT 'OPEN',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugComment" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugActivityLog" (
    "id" TEXT NOT NULL,
    "bugId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION DEFAULT 0,
    "spent" DOUBLE PRECISION DEFAULT 0,
    "targetLeads" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "projectId" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBriefQaCheck" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "checkItem" TEXT NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBriefQaCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPerformanceMetric" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rankingPosition" INTEGER,
    "leadsGenerated" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKpiGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKpiGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_userId_key" ON "TaskAssignee"("taskId", "userId");

-- CreateIndex
CREATE INDEX "Bug_taskId_idx" ON "Bug"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPerformanceMetric_briefId_key" ON "ContentPerformanceMetric"("briefId");

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugComment" ADD CONSTRAINT "BugComment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugComment" ADD CONSTRAINT "BugComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugActivityLog" ADD CONSTRAINT "BugActivityLog_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugActivityLog" ADD CONSTRAINT "BugActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklink" ADD CONSTRAINT "SeoBacklink_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklink" ADD CONSTRAINT "SeoBacklink_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklink" ADD CONSTRAINT "SeoBacklink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBriefQaCheck" ADD CONSTRAINT "ContentBriefQaCheck_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPerformanceMetric" ADD CONSTRAINT "ContentPerformanceMetric_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "SeoContentBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKpiGoal" ADD CONSTRAINT "SeoKpiGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKpiGoal" ADD CONSTRAINT "SeoKpiGoal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;


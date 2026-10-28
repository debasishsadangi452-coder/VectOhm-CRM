-- CreateEnum
CREATE TYPE "EpicStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PLANNED', 'RELEASED', 'FAILED');

-- CreateEnum
CREATE TYPE "BacklinkStatus" AS ENUM ('ACTIVE', 'LOST');

-- CreateEnum
CREATE TYPE "ContentBriefStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "seoSourceKeywordId" TEXT;

-- AlterTable
ALTER TABLE "GitCommit" ADD COLUMN     "buildStatus" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "epicId" TEXT,
ADD COLUMN     "releaseId" TEXT,
ADD COLUMN     "taskNumber" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubUsername" TEXT;

-- CreateTable
CREATE TABLE "Epic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EpicStatus" NOT NULL DEFAULT 'PLANNING',
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Epic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PLANNED',
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "difficulty" INTEGER NOT NULL DEFAULT 0,
    "currentRank" INTEGER,
    "targetRank" INTEGER,
    "url" TEXT,
    "projectId" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoBacklink" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "domainAuthority" INTEGER NOT NULL DEFAULT 0,
    "status" "BacklinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoBacklink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContentBrief" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetKeyword" TEXT NOT NULL,
    "status" "ContentBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "assigneeId" TEXT,
    "content" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoCompetitor" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "da" INTEGER NOT NULL DEFAULT 0,
    "traffic" INTEGER NOT NULL DEFAULT 0,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProjectMembers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProjectMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProjectMembers_B_index" ON "_ProjectMembers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUsername_key" ON "User"("githubUsername");

-- AddForeignKey
ALTER TABLE "Epic" ADD CONSTRAINT "Epic_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES "Epic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_seoSourceKeywordId_fkey" FOREIGN KEY ("seoSourceKeywordId") REFERENCES "SeoKeyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoAudit" ADD CONSTRAINT "SeoAudit_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoBacklink" ADD CONSTRAINT "SeoBacklink_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContentBrief" ADD CONSTRAINT "SeoContentBrief_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoCompetitor" ADD CONSTRAINT "SeoCompetitor_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectMembers" ADD CONSTRAINT "_ProjectMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProjectMembers" ADD CONSTRAINT "_ProjectMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


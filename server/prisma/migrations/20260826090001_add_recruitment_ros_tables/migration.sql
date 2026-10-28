-- Recruitment Operating System (ROS), part 2 of 2: AI match scoring, risk
-- profiles, talent pools, and a recruiter task queue on top of the existing
-- JobPosting/Candidate/Interview/Offer models. Depends on the enum values
-- added in the sibling migration (…_add_recruitment_ros_enums) being
-- already committed -- see that file for why this is split in two.
--
-- This migration was missing entirely from the Pratyush branch merge
-- (schema.prisma had these changes committed with no accompanying
-- migration.sql) -- generated via `prisma migrate diff --from-url
-- <live-db> --to-schema-datamodel schema.prisma --script` against the
-- actual dev database rather than hand-written, so it reflects exactly
-- what the live DB was missing.

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "aiMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "candidateCode" TEXT,
ADD COLUMN     "cultureMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 86.0,
ADD COLUMN     "currentCompany" TEXT,
ADD COLUMN     "currentSalary" DOUBLE PRECISION,
ADD COLUMN     "currentTitle" TEXT,
ADD COLUMN     "expMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 85.0,
ADD COLUMN     "expectedSalary" DOUBLE PRECISION,
ADD COLUMN     "fitBadge" "FitBadge" NOT NULL DEFAULT 'GOLD_FIT',
ADD COLUMN     "jobBoardUrl" TEXT,
ADD COLUMN     "locMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 90.0,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "noticeMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 82.0,
ADD COLUMN     "noticePeriodDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "salaryMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 80.0,
ADD COLUMN     "skillMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 88.0,
ADD COLUMN     "skills" TEXT[],
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "totalExperienceYears" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "stage" SET DEFAULT 'SOURCED';

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "aiTranscriptSummary" TEXT,
ADD COLUMN     "communicationRating" INTEGER DEFAULT 4,
ADD COLUMN     "cultureFitRating" INTEGER DEFAULT 4,
ADD COLUMN     "meetingUrl" TEXT,
ADD COLUMN     "overallRecommendation" TEXT,
ADD COLUMN     "problemSolvingRating" INTEGER DEFAULT 4,
ADD COLUMN     "recordingUrl" TEXT,
ADD COLUMN     "technicalRating" INTEGER DEFAULT 4;

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "budgetMax" DOUBLE PRECISION,
ADD COLUMN     "budgetMin" DOUBLE PRECISION,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "filledHeadcount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "glassdoorUrl" TEXT,
ADD COLUMN     "indeedUrl" TEXT,
ADD COLUMN     "jobCode" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "minExperienceYears" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "naukriUrl" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'HIGH',
ADD COLUMN     "skillsRequired" TEXT[],
ADD COLUMN     "targetHeadcount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "targetJoiningDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "approvalState" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "joiningBonus" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "offerCode" TEXT,
ADD COLUMN     "offerExpiryDate" TIMESTAMP(3),
ADD COLUMN     "stockOptions" TEXT,
ADD COLUMN     "targetJoiningDate" TIMESTAMP(3),
ADD COLUMN     "variablePay" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateTable
CREATE TABLE "CandidateRiskProfile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "offerDeclineRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "ghostingRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "counterOfferRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "joiningFailureRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "primaryRiskFactor" TEXT,
    "recommendedMitigation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateRiskProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentPool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentPoolMember" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruiterTaskQueue" (
    "id" TEXT NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "candidateId" TEXT,
    "actionType" TEXT NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruiterTaskQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitmentHealthMetric" (
    "id" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "globalHealthScore" DOUBLE PRECISION NOT NULL,
    "pipelineFreshnessScore" DOUBLE PRECISION NOT NULL,
    "offerAcceptanceScore" DOUBLE PRECISION NOT NULL,
    "joiningSuccessScore" DOUBLE PRECISION NOT NULL,
    "interviewSlaScore" DOUBLE PRECISION NOT NULL,
    "hiringVelocityScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecruitmentHealthMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateRiskProfile_candidateId_key" ON "CandidateRiskProfile"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "TalentPool_name_key" ON "TalentPool"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TalentPoolMember_poolId_candidateId_key" ON "TalentPoolMember"("poolId", "candidateId");

-- CreateIndex
CREATE INDEX "RecruiterTaskQueue_recruiterId_isCompleted_priorityScore_idx" ON "RecruiterTaskQueue"("recruiterId", "isCompleted", "priorityScore");

-- AddForeignKey
ALTER TABLE "CandidateRiskProfile" ADD CONSTRAINT "CandidateRiskProfile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPool" ADD CONSTRAINT "TalentPool_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolMember" ADD CONSTRAINT "TalentPoolMember_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "TalentPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolMember" ADD CONSTRAINT "TalentPoolMember_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterTaskQueue" ADD CONSTRAINT "RecruiterTaskQueue_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruiterTaskQueue" ADD CONSTRAINT "RecruiterTaskQueue_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

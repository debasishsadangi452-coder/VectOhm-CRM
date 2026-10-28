-- AlterEnum
ALTER TYPE "BugStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "BugStatus" ADD VALUE 'REWORK_REQUIRED';
ALTER TYPE "BugStatus" ADD VALUE 'FIXED';

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN "fixSummary" TEXT,
ADD COLUMN "rootCause" TEXT,
ADD COLUMN "testingNotes" TEXT,
ADD COLUMN "prLink" TEXT,
ADD COLUMN "fixAttachmentUrl" TEXT,
ADD COLUMN "fixSubmittedAt" TIMESTAMP(3),
ADD COLUMN "fixSubmittedById" TEXT,
ADD COLUMN "managerComments" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedById" TEXT;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_fixSubmittedById_fkey" FOREIGN KEY ("fixSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

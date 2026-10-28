-- CreateEnum
CREATE TYPE "TimeLogStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "TimeLog" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "TimeLogStatus" NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "TimeLog" ADD CONSTRAINT "TimeLog_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "DealApprovalStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "approvalStatus" "DealApprovalStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "monthlyTarget" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlyTarget" INTEGER;

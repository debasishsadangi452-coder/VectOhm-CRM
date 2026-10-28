-- AlterTable
ALTER TABLE "GitCommit" ADD COLUMN     "isPR" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prNumber" INTEGER,
ADD COLUMN     "prStatus" TEXT;

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "pinnedAt" TIMESTAMP(3);

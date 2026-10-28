-- AlterTable
ALTER TABLE "BulkEmailRecipient" ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SequenceSend" ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openedAt" TIMESTAMP(3);

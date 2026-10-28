-- DropForeignKey
ALTER TABLE "SequenceSend" DROP CONSTRAINT "SequenceSend_stepId_fkey";

-- AlterTable
ALTER TABLE "SequenceSend" ALTER COLUMN "stepId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SequenceSend" ADD CONSTRAINT "SequenceSend_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "SequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

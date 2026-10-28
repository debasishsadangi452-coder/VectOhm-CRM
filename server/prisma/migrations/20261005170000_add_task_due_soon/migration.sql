-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DUE_SOON';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "dueSoonNotifiedFor" TIMESTAMP(3);

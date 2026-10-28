-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UPDATE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_UPDATE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TASK_MESSAGE_RECEIVED';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskMessageType" AS ENUM ('OVERDUE_MESSAGE', 'GENERAL_MESSAGE', 'UPDATE_REQUEST', 'TASK_UPDATE', 'REPLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "overdueNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastUpdateRequestAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskMessage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "senderId" TEXT,
    "recipientId" TEXT,
    "message" TEXT NOT NULL,
    "messageType" "TaskMessageType" NOT NULL DEFAULT 'GENERAL_MESSAGE',
    "status" "TaskStatus",
    "progress" INTEGER,
    "workCompleted" TEXT,
    "currentWork" TEXT,
    "blockers" TEXT,
    "expectedCompletion" TIMESTAMP(3),
    "teamChatMessageId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskMessage_taskId_createdAt_idx" ON "TaskMessage"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "TaskMessage_senderId_idx" ON "TaskMessage"("senderId");
CREATE INDEX IF NOT EXISTS "TaskMessage_recipientId_idx" ON "TaskMessage"("recipientId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TaskMessage" ADD CONSTRAINT "TaskMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
CREATE TYPE "LinkedInConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CHECKPOINT_REQUIRED', 'RATE_LIMITED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LinkedInActionType" AS ENUM ('PROFILE_VIEW', 'CONNECTION_REQUEST', 'DIRECT_MESSAGE', 'INMAIL');

-- CreateEnum
CREATE TYPE "LinkedInActionStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'ACCEPTED', 'REPLIED');

-- CreateTable
CREATE TABLE "UserLinkedInConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "accountName" TEXT,
    "profileUrn" TEXT,
    "profileUrl" TEXT,
    "profilePicUrl" TEXT,
    "accessToken" TEXT,
    "status" "LinkedInConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "dailyInviteLimit" INTEGER NOT NULL DEFAULT 20,
    "dailyMessageLimit" INTEGER NOT NULL DEFAULT 50,
    "invitesSentToday" INTEGER NOT NULL DEFAULT 0,
    "messagesSentToday" INTEGER NOT NULL DEFAULT 0,
    "lastResetDate" TEXT NOT NULL DEFAULT '',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLinkedInConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInAction" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "contactId" TEXT,
    "candidateId" TEXT,
    "leadId" TEXT,
    "actionType" "LinkedInActionType" NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "messageBody" TEXT,
    "status" "LinkedInActionStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedInMessage" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUrn" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderPicUrl" TEXT,
    "recipientUrn" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "isOutbound" BOOLEAN NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    "candidateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLinkedInConnection_userId_key" ON "UserLinkedInConnection"("userId");

-- CreateIndex
CREATE INDEX "LinkedInAction_connectionId_status_scheduledFor_idx" ON "LinkedInAction"("connectionId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "LinkedInMessage_connectionId_conversationId_idx" ON "LinkedInMessage"("connectionId", "conversationId");

-- CreateIndex
CREATE INDEX "LinkedInMessage_contactId_idx" ON "LinkedInMessage"("contactId");

-- AddForeignKey
ALTER TABLE "UserLinkedInConnection" ADD CONSTRAINT "UserLinkedInConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInAction" ADD CONSTRAINT "LinkedInAction_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "UserLinkedInConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInMessage" ADD CONSTRAINT "LinkedInMessage_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "UserLinkedInConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

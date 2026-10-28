-- Lets UserEmailConnection hold an OAuth-connected mailbox (Google/
-- Microsoft) alongside the existing SMTP app-password connections -- the
-- SMTP columns become optional since an OAuth row doesn't use them. New
-- SyncedEmail table stores messages pulled in by EmailSyncEngineService's
-- polling cron, linked to a Contact by address match.

-- CreateEnum
CREATE TYPE "EmailConnectionType" AS ENUM ('SMTP', 'OAUTH_GOOGLE', 'OAUTH_MICROSOFT');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('SENT', 'RECEIVED');

-- AlterTable
ALTER TABLE "UserEmailConnection" ADD COLUMN     "connectionType" "EmailConnectionType" NOT NULL DEFAULT 'SMTP',
ADD COLUMN     "encryptedRefreshToken" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "oauthAccessToken" TEXT,
ADD COLUMN     "oauthExpiresAt" TIMESTAMP(3),
ADD COLUMN     "oauthScope" TEXT,
ADD COLUMN     "providerAccountEmail" TEXT,
ADD COLUMN     "refreshTokenAuthTag" TEXT,
ADD COLUMN     "refreshTokenIv" TEXT,
ADD COLUMN     "syncCursor" TEXT,
ALTER COLUMN "smtpHost" DROP NOT NULL,
ALTER COLUMN "smtpPort" DROP NOT NULL,
ALTER COLUMN "smtpSecure" DROP NOT NULL,
ALTER COLUMN "smtpSecure" DROP DEFAULT,
ALTER COLUMN "smtpUsername" DROP NOT NULL,
ALTER COLUMN "encryptedPassword" DROP NOT NULL,
ALTER COLUMN "passwordIv" DROP NOT NULL,
ALTER COLUMN "passwordAuthTag" DROP NOT NULL,
ALTER COLUMN "fromEmail" DROP NOT NULL;

-- CreateTable
CREATE TABLE "SyncedEmail" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncedEmail_contactId_idx" ON "SyncedEmail"("contactId");

-- CreateIndex
CREATE INDEX "SyncedEmail_dealId_idx" ON "SyncedEmail"("dealId");

-- CreateIndex
CREATE INDEX "SyncedEmail_threadId_idx" ON "SyncedEmail"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncedEmail_connectionId_providerMessageId_key" ON "SyncedEmail"("connectionId", "providerMessageId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- AddForeignKey
ALTER TABLE "SyncedEmail" ADD CONSTRAINT "SyncedEmail_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "UserEmailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncedEmail" ADD CONSTRAINT "SyncedEmail_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncedEmail" ADD CONSTRAINT "SyncedEmail_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;


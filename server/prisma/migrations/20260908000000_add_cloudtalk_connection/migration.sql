-- CreateTable
CREATE TABLE "CloudTalkConnection" (
    "id" TEXT NOT NULL DEFAULT 'cloudtalk-connection',
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "encryptedApiSecret" TEXT NOT NULL,
    "apiSecretIv" TEXT NOT NULL,
    "apiSecretAuthTag" TEXT NOT NULL,
    "webhookSecret" TEXT,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudTalkConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CloudTalkConnection" ADD CONSTRAINT "CloudTalkConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

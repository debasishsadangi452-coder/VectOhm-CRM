-- CreateTable
CREATE TABLE "UserEmailConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpUsername" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "passwordIv" TEXT NOT NULL,
    "passwordAuthTag" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailConnection_userId_key" ON "UserEmailConnection"("userId");

-- AddForeignKey
ALTER TABLE "UserEmailConnection" ADD CONSTRAINT "UserEmailConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

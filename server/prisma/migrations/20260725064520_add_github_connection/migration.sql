-- CreateEnum
CREATE TYPE "GithubAccountType" AS ENUM ('USER', 'ORG');

-- CreateTable
CREATE TABLE "GithubConnection" (
    "id" TEXT NOT NULL DEFAULT 'github-connection',
    "accountType" "GithubAccountType" NOT NULL DEFAULT 'ORG',
    "accountLogin" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "tokenAuthTag" TEXT NOT NULL,
    "connectedByEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubConnection_pkey" PRIMARY KEY ("id")
);

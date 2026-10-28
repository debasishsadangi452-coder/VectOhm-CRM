-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('MANUAL', 'APOLLO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "apolloId" TEXT,
ADD COLUMN     "employeeCount" INTEGER,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "apolloId" TEXT,
ADD COLUMN     "enrichedAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "source" "LeadSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "ApolloConnection" (
    "id" TEXT NOT NULL DEFAULT 'apollo-connection',
    "encryptedApiKey" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApolloConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_apolloId_key" ON "Company"("apolloId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_apolloId_key" ON "Contact"("apolloId");

-- AddForeignKey
ALTER TABLE "ApolloConnection" ADD CONSTRAINT "ApolloConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

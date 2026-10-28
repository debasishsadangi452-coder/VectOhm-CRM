-- CreateTable
CREATE TABLE "IntentSearchRecord" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT,
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentSearchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentDiscoveredJob" (
    "id" TEXT NOT NULL,
    "searchRecordId" TEXT,
    "externalJobId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "jobUrl" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyLocation" TEXT,
    "companyDomain" TEXT,
    "salary" TEXT,
    "jobDescription" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'ADZUNA',
    "initialDecisionMaker" JSONB,
    "enriched" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentDiscoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentEnrichedContact" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyDomain" TEXT,
    "personName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT NOT NULL,
    "departmentCategory" TEXT NOT NULL DEFAULT 'FOUNDER_EXEC',
    "email" TEXT,
    "linkedinUrl" TEXT,
    "apolloId" TEXT,
    "sourceJobTitle" TEXT,
    "sourceJobUrl" TEXT,
    "discoveredJobId" TEXT,
    "contactId" TEXT,
    "sequenceEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "autoEnrolledSequenceId" TEXT,
    "sequenceName" TEXT,
    "enrolledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentEnrichedContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntentSearchRecord_createdAt_idx" ON "IntentSearchRecord"("createdAt");

-- CreateIndex
CREATE INDEX "IntentDiscoveredJob_searchRecordId_idx" ON "IntentDiscoveredJob"("searchRecordId");

-- CreateIndex
CREATE INDEX "IntentDiscoveredJob_companyName_idx" ON "IntentDiscoveredJob"("companyName");

-- CreateIndex
CREATE INDEX "IntentEnrichedContact_companyName_idx" ON "IntentEnrichedContact"("companyName");

-- CreateIndex
CREATE INDEX "IntentEnrichedContact_email_idx" ON "IntentEnrichedContact"("email");

-- CreateIndex
CREATE INDEX "IntentEnrichedContact_createdAt_idx" ON "IntentEnrichedContact"("createdAt");

-- AddForeignKey
ALTER TABLE "IntentSearchRecord" ADD CONSTRAINT "IntentSearchRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentDiscoveredJob" ADD CONSTRAINT "IntentDiscoveredJob_searchRecordId_fkey" FOREIGN KEY ("searchRecordId") REFERENCES "IntentSearchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentEnrichedContact" ADD CONSTRAINT "IntentEnrichedContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentEnrichedContact" ADD CONSTRAINT "IntentEnrichedContact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

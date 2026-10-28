-- Companies signalling an ERP purchase through their own job postings.
CREATE TABLE "ErpBuyerSignal" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "postedAt" TIMESTAMP(3),
    "url" TEXT,
    "stage" TEXT NOT NULL,
    "matchedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpBuyerSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErpBuyerSignal_source_externalId_key" ON "ErpBuyerSignal"("source", "externalId");
CREATE INDEX "ErpBuyerSignal_companyName_idx" ON "ErpBuyerSignal"("companyName");
CREATE INDEX "ErpBuyerSignal_stage_idx" ON "ErpBuyerSignal"("stage");
CREATE INDEX "ErpBuyerSignal_postedAt_idx" ON "ErpBuyerSignal"("postedAt");

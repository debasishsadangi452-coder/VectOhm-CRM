-- Public ERP tenders from open government feeds (CanadaBuys, SAM.gov).
CREATE TABLE "ErpTender" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "buyerName" TEXT,
    "buyerRegion" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "noticeUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "matchedTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpTender_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ErpTender_source_externalId_key" ON "ErpTender"("source", "externalId");
CREATE INDEX "ErpTender_closesAt_idx" ON "ErpTender"("closesAt");
CREATE INDEX "ErpTender_status_idx" ON "ErpTender"("status");
CREATE INDEX "ErpTender_country_idx" ON "ErpTender"("country");

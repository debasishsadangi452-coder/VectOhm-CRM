-- CreateEnum
CREATE TYPE "IntentSignalTier" AS ENUM ('ERP_AI_VIP', 'ENTERPRISE_HIGH', 'STANDARD_GROWTH');

-- CreateTable
CREATE TABLE "ScrapedIntentArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "rawContent" TEXT,
    "keySnippet" TEXT,
    "tier" "IntentSignalTier" NOT NULL DEFAULT 'STANDARD_GROWTH',
    "isErpAiPriority" BOOLEAN NOT NULL DEFAULT false,
    "intentScore" INTEGER NOT NULL DEFAULT 70,
    "erpVendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aiKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetedRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "companyName" TEXT,
    "companyDomain" TEXT,
    "companyId" TEXT,
    "discoveredById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "decisionMaker" JSONB,
    "aiDraftedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapedIntentArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedIntentArticle_url_key" ON "ScrapedIntentArticle"("url");

-- CreateIndex
CREATE INDEX "ScrapedIntentArticle_tier_idx" ON "ScrapedIntentArticle"("tier");

-- CreateIndex
CREATE INDEX "ScrapedIntentArticle_isErpAiPriority_idx" ON "ScrapedIntentArticle"("isErpAiPriority");

-- CreateIndex
CREATE INDEX "ScrapedIntentArticle_companyId_idx" ON "ScrapedIntentArticle"("companyId");

-- CreateIndex
CREATE INDEX "ScrapedIntentArticle_discoveredById_idx" ON "ScrapedIntentArticle"("discoveredById");

-- AddForeignKey
ALTER TABLE "ScrapedIntentArticle" ADD CONSTRAINT "ScrapedIntentArticle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapedIntentArticle" ADD CONSTRAINT "ScrapedIntentArticle_discoveredById_fkey" FOREIGN KEY ("discoveredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

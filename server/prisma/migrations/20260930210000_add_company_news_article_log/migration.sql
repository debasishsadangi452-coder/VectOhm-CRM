-- Adds CompanyNewsArticleLog: a permanent record of every article NewsAPI
-- returned during a news scan, independent of whether Claude classified it
-- as a real signal. Exists so the news pipeline is auditable even when
-- ANTHROPIC_API_KEY isn't set yet (classified stays false, relevant stays
-- null -- the row still gets written, proving the NewsAPI half is actually
-- working) and so the same article never gets re-classified twice. See
-- CompanyGrowthService.scanCompanyNews. Generated via `prisma migrate diff`
-- against the local dev DB, same approach as this repo's other migrations.

-- CreateTable
CREATE TABLE "CompanyNewsArticleLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceName" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "classified" BOOLEAN NOT NULL DEFAULT false,
    "relevant" BOOLEAN,
    "signalType" "CompanyGrowthSignalType",

    CONSTRAINT "CompanyNewsArticleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyNewsArticleLog_companyId_fetchedAt_idx" ON "CompanyNewsArticleLog"("companyId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNewsArticleLog_companyId_url_key" ON "CompanyNewsArticleLog"("companyId", "url");

-- AddForeignKey
ALTER TABLE "CompanyNewsArticleLog" ADD CONSTRAINT "CompanyNewsArticleLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

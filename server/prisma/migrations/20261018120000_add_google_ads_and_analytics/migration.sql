-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "gclid" TEXT,
ADD COLUMN "wbraid" TEXT,
ADD COLUMN "gbraid" TEXT,
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "utmTerm" TEXT,
ADD COLUMN "utmContent" TEXT,
ADD COLUMN "landingPage" TEXT;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "gclid" TEXT,
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmCampaign" TEXT;

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "campaignId" TEXT,
ADD COLUMN "gclid" TEXT;

-- AlterTable
ALTER TABLE "MarketingCampaign" ADD COLUMN "googleAdsCampaignId" TEXT;

-- CreateTable
CREATE TABLE "GoogleAdsConnection" (
    "id" TEXT NOT NULL DEFAULT 'google-ads-connection',
    "customerAccountId" TEXT NOT NULL DEFAULT '',
    "managerAccountId" TEXT,
    "encryptedRefreshToken" TEXT,
    "refreshTokenIv" TEXT,
    "refreshTokenAuthTag" TEXT,
    "developerToken" TEXT,
    "conversionActionId" TEXT,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAdsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAnalyticsConnection" (
    "id" TEXT NOT NULL DEFAULT 'ga4-connection',
    "propertyId" TEXT NOT NULL DEFAULT '',
    "encryptedServiceAccountKey" TEXT,
    "keyIv" TEXT,
    "keyAuthTag" TEXT,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAnalyticsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAdsCampaignMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "googleCampaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgCpc" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "crmCampaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleAdsCampaignMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAnalyticsMetric" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "domain" TEXT NOT NULL DEFAULT 'venusglobaltech.com',
    "sessionSource" TEXT NOT NULL DEFAULT 'google',
    "sessionMedium" TEXT NOT NULL DEFAULT 'cpc',
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "avgSessionDuration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleAnalyticsMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineConversionLog" (
    "id" TEXT NOT NULL,
    "gclid" TEXT NOT NULL,
    "conversionName" TEXT NOT NULL,
    "conversionTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "dealId" TEXT,
    "candidateId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineConversionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleAdsCampaignMetric_googleCampaignId_date_idx" ON "GoogleAdsCampaignMetric"("googleCampaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAdsCampaignMetric_date_googleCampaignId_key" ON "GoogleAdsCampaignMetric"("date", "googleCampaignId");

-- CreateIndex
CREATE INDEX "GoogleAnalyticsMetric_date_domain_idx" ON "GoogleAnalyticsMetric"("date", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAnalyticsMetric_date_domain_sessionSource_sessionMediu_key" ON "GoogleAnalyticsMetric"("date", "domain", "sessionSource", "sessionMedium");

-- CreateIndex
CREATE INDEX "OfflineConversionLog_gclid_idx" ON "OfflineConversionLog"("gclid");

-- CreateIndex
CREATE INDEX "OfflineConversionLog_dealId_idx" ON "OfflineConversionLog"("dealId");

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsConnection" ADD CONSTRAINT "GoogleAdsConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAnalyticsConnection" ADD CONSTRAINT "GoogleAnalyticsConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoogleAdsCampaignMetric" ADD CONSTRAINT "GoogleAdsCampaignMetric_crmCampaignId_fkey" FOREIGN KEY ("crmCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineConversionLog" ADD CONSTRAINT "OfflineConversionLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineConversionLog" ADD CONSTRAINT "OfflineConversionLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

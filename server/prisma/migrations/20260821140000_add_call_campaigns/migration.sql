-- Power-dialer calling lists (see server/src/modules/telephony/call-campaigns.service.ts).

-- CreateEnum
CREATE TYPE "CallCampaignLeadStatus" AS ENUM ('PENDING', 'CALLING', 'DONE');

-- CreateTable
CREATE TABLE "CallCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallCampaignLead" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "status" "CallCampaignLeadStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallCampaignLead_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Call" ADD COLUMN "campaignId" TEXT;

-- CreateIndex
CREATE INDEX "CallCampaign_departmentId_idx" ON "CallCampaign"("departmentId");
CREATE UNIQUE INDEX "CallCampaignLead_campaignId_contactId_key" ON "CallCampaignLead"("campaignId", "contactId");
CREATE INDEX "CallCampaignLead_campaignId_status_idx" ON "CallCampaignLead"("campaignId", "status");
CREATE INDEX "CallCampaignLead_assignedToId_status_idx" ON "CallCampaignLead"("assignedToId", "status");
CREATE INDEX "Call_campaignId_idx" ON "Call"("campaignId");

-- AddForeignKey
ALTER TABLE "CallCampaign" ADD CONSTRAINT "CallCampaign_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallCampaign" ADD CONSTRAINT "CallCampaign_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CallCampaignLead" ADD CONSTRAINT "CallCampaignLead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CallCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallCampaignLead" ADD CONSTRAINT "CallCampaignLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CallCampaignLead" ADD CONSTRAINT "CallCampaignLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CallCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

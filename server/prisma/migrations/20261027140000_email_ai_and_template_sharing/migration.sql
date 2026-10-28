-- Email templates: who can see them (private / department / everyone) and whether the AI wrote the first draft.
-- Campaigns: optional per-recipient AI personalisation.

-- CreateEnum
CREATE TYPE "EmailTemplateVisibility" AS ENUM ('PRIVATE', 'DEPARTMENT', 'EVERYONE');

-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "visibility" "EmailTemplateVisibility" NOT NULL DEFAULT 'PRIVATE';

-- Templates that already exist were shared with the whole Sales and Recruitment team, so they stay visible to everyone.
UPDATE "EmailTemplate" SET "visibility" = 'EVERYONE';

-- AlterTable
ALTER TABLE "BulkEmailCampaign" ADD COLUMN     "aiInstructions" TEXT,
ADD COLUMN     "aiPersonalize" BOOLEAN NOT NULL DEFAULT false;

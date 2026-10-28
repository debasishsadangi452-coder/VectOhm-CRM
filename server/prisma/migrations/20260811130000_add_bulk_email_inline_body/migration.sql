-- A campaign can now carry its own one-off subject/body instead of pointing
-- at a saved EmailTemplate. Existing rows keep their templateId untouched.

-- AlterTable
ALTER TABLE "BulkEmailCampaign" ALTER COLUMN "templateId" DROP NOT NULL,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "bodyHtml" TEXT;

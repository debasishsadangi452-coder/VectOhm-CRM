-- Append the sender's own signature at send time, rather than baking one
-- person's sign-off into a template the whole Sales team shares.
-- AlterTable
ALTER TABLE "EmailTemplate" ADD COLUMN     "appendSignature" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BulkEmailCampaign" ADD COLUMN     "appendSignature" BOOLEAN NOT NULL DEFAULT false;

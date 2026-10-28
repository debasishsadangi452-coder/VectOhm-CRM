-- Drop unique index on UserEmailConnection.userId
DROP INDEX IF EXISTS "UserEmailConnection_userId_key";

-- Add label and isDefault columns if they do not exist
ALTER TABLE "UserEmailConnection" ADD COLUMN IF NOT EXISTS "label" TEXT;
ALTER TABLE "UserEmailConnection" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT true;

-- Add index on userId
CREATE INDEX IF NOT EXISTS "UserEmailConnection_userId_idx" ON "UserEmailConnection"("userId");

-- Add emailConnectionId to BulkEmailCampaign if it doesn't exist
ALTER TABLE "BulkEmailCampaign" ADD COLUMN IF NOT EXISTS "emailConnectionId" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BulkEmailCampaign_emailConnectionId_fkey'
  ) THEN
    ALTER TABLE "BulkEmailCampaign" ADD CONSTRAINT "BulkEmailCampaign_emailConnectionId_fkey"
      FOREIGN KEY ("emailConnectionId") REFERENCES "UserEmailConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "BulkEmailCampaign_emailConnectionId_idx" ON "BulkEmailCampaign"("emailConnectionId");

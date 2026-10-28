-- Add per-user idle prompt override column to User table if not present
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "idlePromptMin" INTEGER;

-- Update email from sourav@omnios.local to sourav@venushiring.com if present
UPDATE "User"
SET "email" = 'sourav@venushiring.com'
WHERE LOWER("email") = 'sourav@omnios.local'
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE LOWER("email") = 'sourav@venushiring.com');

-- Set idle time to 20 minutes for sourav@venushiring.com
UPDATE "User"
SET "idlePromptMin" = 20
WHERE LOWER("email") = 'sourav@venushiring.com' OR LOWER("email") = 'sourav@omnios.local';

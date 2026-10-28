-- Per-user module access. modulesCustomized = false keeps today's behaviour (the default for the
-- person's role and department); true means the person gets exactly the keys in "modules".
-- Existing users are all "false", so nothing changes for anyone until an Admin picks modules.
ALTER TABLE "User" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modulesCustomized" BOOLEAN NOT NULL DEFAULT false;

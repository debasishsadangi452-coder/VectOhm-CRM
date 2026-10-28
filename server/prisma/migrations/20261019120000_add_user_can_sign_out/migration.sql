-- Per-user permission to sign out. Default false: normal users stay signed in so screen recording never stops.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canSignOut" BOOLEAN NOT NULL DEFAULT false;

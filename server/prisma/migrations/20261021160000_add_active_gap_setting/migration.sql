-- Company-wide "active gap": a 60s activity ping counts as active when the OS saw
-- input within this many seconds. Was a hardcoded 90 seconds. Set to 1 hour (3600)
-- with the owner's approval; the owner can change it afterwards. Applies to
-- pings received from now on -- stored ping flags are not rewritten.
ALTER TABLE "AttendanceSettings" ADD COLUMN "activeGapSec" INTEGER NOT NULL DEFAULT 3600;

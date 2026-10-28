-- Adds plain keystroke/click COUNTS to ActivityPing -- how many keydown /
-- mousedown events occurred since the previous ping, never which key or
-- where the click landed. Same idea as the existing idleSeconds/active
-- signal, just a second number alongside it. See the desktop agent's
-- uIOhook listeners in main.ts (count-only, no key/coordinate data ever
-- read) and CreateActivityPingDto. Written by hand rather than via
-- `prisma migrate dev`, consistent with this repo's existing
-- migrate-diff-against-dev-DB approach documented in
-- 20260926221500_add_hiring_signals -- no local dev DB reachable here.

-- AlterTable
ALTER TABLE "ActivityPing" ADD COLUMN "keystrokeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ActivityPing" ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0;

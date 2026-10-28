-- Screen recordings move from the Railway volume to Bunny Storage.
--
-- Rows that exist when this runs still have their file on the volume, so
-- they're backfilled as LOCAL (the column is added with that default, which
-- fills every existing row). The default is then switched to BUNNY to match
-- schema.prisma, since every new upload goes straight to Bunny.
-- scripts/migrate-recordings-to-bunny.mjs copies the LOCAL ones across and
-- flips them to BUNNY.
--
-- IF NOT EXISTS because that script adds these same columns itself when it's
-- run ahead of this deploy, against the previous release.

-- AlterTable
ALTER TABLE "ScreenRecording"
    ADD COLUMN IF NOT EXISTS "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN IF NOT EXISTS "bunnyPath" TEXT,
    ADD COLUMN IF NOT EXISTS "uploadStatus" TEXT NOT NULL DEFAULT 'UPLOADED';

ALTER TABLE "ScreenRecording" ALTER COLUMN "storageProvider" SET DEFAULT 'BUNNY';

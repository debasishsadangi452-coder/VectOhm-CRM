-- Training videos are now links (Drive/YouTube/etc.) rather than files
-- uploaded onto the volume. Any existing row points at a file on disk and has
-- no URL to migrate to, so those rows are dropped -- the feature shipped
-- today and the uploaded files are being abandoned with it. Orphaned files
-- under server/storage/training-videos can be deleted from the volume by hand.
DELETE FROM "TrainingVideo";

-- AlterTable
ALTER TABLE "TrainingVideo" DROP COLUMN "storagePath",
DROP COLUMN "originalName",
DROP COLUMN "mimeType",
DROP COLUMN "sizeBytes",
ADD COLUMN     "url" TEXT NOT NULL;

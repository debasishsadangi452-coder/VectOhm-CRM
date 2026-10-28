-- Adds LoginPhoto.type (clock-in vs clock-out photo), already read/written by
-- LoginPhotosService but never migrated. Also drops a stale index that
-- schema.prisma stopped declaring for Activity.contactId a while back.
DROP INDEX "Activity_contactId_idx";

ALTER TABLE "LoginPhoto" ADD COLUMN     "type" TEXT DEFAULT 'CLOCK_IN';

CREATE INDEX "LoginPhoto_type_idx" ON "LoginPhoto"("type");

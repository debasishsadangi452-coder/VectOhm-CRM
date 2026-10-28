-- Gives real backend homes to the last four job-posting display fields that
-- were still shadowed by ceipal-context.tsx's `jobExtras` localStorage
-- cache (industry, clearance, tags, and the manual per-board publish
-- toggle) -- everything else that cache covered already round-trips
-- through the backend as of the two prior migrations in this series.
--
-- boardStatus is a simple manual on/off switch the Ceipal UI toggles per
-- board, deliberately separate from JobBoardListing/job-board-syndication
-- (a different, real, automated syndication pipeline with its own
-- attempt/status lifecycle).
--
-- Generated via `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
-- (no live database needed), same situation as the other hand-written
-- migrations in this series -- no local dev database was reachable this
-- session either.

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "boardStatus" JSONB,
ADD COLUMN     "clearance" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

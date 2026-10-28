-- Recruitment Operating System (ROS), part 1 of 2: enum changes only.
-- Split out of a single generated migration because Postgres requires a new
-- enum value to be committed in its own transaction before anything in a
-- later statement can use it (e.g. as a column DEFAULT) -- attempting both
-- in one migration fails with "unsafe use of new value ... New enum values
-- must be committed before they can be used." See the sibling migration
-- (…_add_recruitment_ros_tables) for the columns/tables that depend on
-- these values.

-- CreateEnum
CREATE TYPE "FitBadge" AS ENUM ('PLATINUM_FIT', 'GOLD_FIT', 'SILVER_FIT', 'REVIEW_REQUIRED');

-- AlterEnum
ALTER TYPE "CandidateStage" ADD VALUE 'SOURCED';
ALTER TYPE "CandidateStage" ADD VALUE 'SHORTLISTED';
ALTER TYPE "CandidateStage" ADD VALUE 'INTERVIEW_SCHEDULED';
ALTER TYPE "CandidateStage" ADD VALUE 'INTERVIEWED';
ALTER TYPE "CandidateStage" ADD VALUE 'SELECTED';
ALTER TYPE "CandidateStage" ADD VALUE 'OFFER_RELEASED';
ALTER TYPE "CandidateStage" ADD VALUE 'OFFER_ACCEPTED';
ALTER TYPE "CandidateStage" ADD VALUE 'JOINED';
ALTER TYPE "CandidateStage" ADD VALUE 'ON_HOLD';

-- Candidate profile fields captured on the Ceipal-style create/detail panels
-- (src/components/ceipal/views) that had no backing column, so they were only
-- ever persisted to browser localStorage and vanished across sessions/devices.
ALTER TABLE "Candidate" ADD COLUMN     "summary" TEXT,
ADD COLUMN     "educationDegree" TEXT,
ADD COLUMN     "educationInstitution" TEXT,
ADD COLUMN     "educationYear" TEXT,
ADD COLUMN     "certifications" TEXT[],
ADD COLUMN     "workAuthorization" TEXT,
ADD COLUMN     "willingToRelocate" TEXT;

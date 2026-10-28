-- Backs the Ceipal-style recruitment CRM UI (src/components/ceipal), which
-- previously ran entirely on client-side mock data. Adds display fields to
-- JobPosting/Candidate/Offer for that view's staffing-agency-flavored
-- columns, plus four new entities that had no backend analogue at all.
--
-- Generated via `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
-- (schema-to-schema, no live database needed) rather than `prisma migrate dev`,
-- since no local dev database was reachable -- same situation as
-- 20260913010000_add_job_board_connections. Review against a real Postgres
-- instance before applying to a shared environment.

-- CreateEnum
CREATE TYPE "EboardingStatus" AS ENUM ('DRAFT', 'INITIATED', 'RESPONDED', 'VERIFIED', 'NEGOTIATE', 'JOINED', 'REJECTED', 'DISQUALIFIED', 'CANCELLED');

-- AlterTable
ALTER TABLE "JobPosting" ADD COLUMN     "businessUnit" TEXT,
ADD COLUMN     "client" TEXT,
ADD COLUMN     "clientBillRate" TEXT,
ADD COLUMN     "clientJobId" TEXT,
ADD COLUMN     "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "states" TEXT;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "badgeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "businessUnit" TEXT,
ADD COLUMN     "clientBillRate" TEXT,
ADD COLUMN     "clientPrimeVendor" TEXT,
ADD COLUMN     "margin" TEXT,
ADD COLUMN     "overhead" TEXT,
ADD COLUMN     "payRate" TEXT,
ADD COLUMN     "perDiemHr" TEXT,
ADD COLUMN     "placementCode" TEXT,
ADD COLUMN     "placementType" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNumber" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "category" TEXT,
    "businessUnit" TEXT,
    "displayOnJob" BOOLEAN NOT NULL DEFAULT true,
    "hasBadge" BOOLEAN NOT NULL DEFAULT false,
    "primaryOwnerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "contactNumber" TEXT,
    "state" TEXT,
    "country" TEXT,
    "ownership" TEXT,
    "businessUnit" TEXT,
    "createdById" TEXT NOT NULL,
    "modifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "source" TEXT,
    "website" TEXT,
    "contactNumber" TEXT,
    "businessUnit" TEXT,
    "zipCode" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Eboarding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "alternateEmail" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "jobTitle" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "zipCode" TEXT,
    "streetAddress" TEXT,
    "employmentType" TEXT,
    "onboardingCode" TEXT,
    "taxTerms" TEXT,
    "vendorName" TEXT,
    "vendorEmail" TEXT,
    "atsBu" TEXT,
    "client" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "joiningDate" TEXT,
    "billRate" TEXT,
    "payRate" TEXT,
    "placementType" TEXT,
    "comments" TEXT,
    "status" "EboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "checklist" JSONB,
    "initiatedOn" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Eboarding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_primaryOwnerId_fkey" FOREIGN KEY ("primaryOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Eboarding" ADD CONSTRAINT "Eboarding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


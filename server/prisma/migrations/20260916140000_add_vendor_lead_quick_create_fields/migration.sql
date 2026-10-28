-- Backs the recruitment CRM header's quick-create modal
-- (src/components/ceipal/ceipal-header.tsx), which collects a vendor
-- contact person/email/category and a lead's company name that the
-- Vendor/Lead models didn't have columns for yet.
--
-- Generated via `prisma migrate diff --from-schema-datamodel --to-schema-datamodel`
-- (no live database needed) -- same situation as the two prior
-- hand-written migrations in this series; no local dev database was
-- reachable this session either.

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "category" TEXT,
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "company" TEXT;

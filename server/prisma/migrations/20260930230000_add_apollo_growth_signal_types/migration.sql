-- Adds APOLLO_HIRING and APOLLO_HEADCOUNT_GROWTH to CompanyGrowthSignalType --
-- a deterministic signal source straight from Apollo's own org search data
-- (active job postings count, computed headcount growth %), as an
-- alternative to the NewsAPI+Claude-classified signals. See
-- CompanyGrowthService.scanApolloSignals.

-- AlterEnum
ALTER TYPE "CompanyGrowthSignalType" ADD VALUE 'APOLLO_HIRING';
ALTER TYPE "CompanyGrowthSignalType" ADD VALUE 'APOLLO_HEADCOUNT_GROWTH';

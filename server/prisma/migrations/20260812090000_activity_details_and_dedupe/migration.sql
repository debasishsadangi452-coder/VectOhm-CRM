-- Richer call/meeting logging: who was spoken to, how it went, how long.
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "durationMin" INTEGER;

-- CreateIndex
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One-time cleanup of the duplicate SYSTEM rows written by the pipeline
-- drag handler, which fired its PATCH twice (the mutation was called from
-- inside a React state updater -- fixed in routes/_app/crm.tsx). Both requests
-- read the deal's old stage, so each wrote an identical "Stage updated ..."
-- row within the same second.
--
-- Scoped as tightly as possible: SYSTEM type only, same deal, same creator,
-- byte-identical content, and occurring within one second of each other.
-- The earliest row of each group is kept. Hand-written activity (CALL,
-- MEETING, NOTE) is never touched -- two genuine calls logged with the same
-- wording are a real thing, and deleting one would be data loss.
DELETE FROM "Activity" a
USING "Activity" b
WHERE a."type" = 'SYSTEM'
  AND b."type" = 'SYSTEM'
  AND a."dealId" = b."dealId"
  AND a."creatorId" = b."creatorId"
  AND a."content" = b."content"
  AND ABS(EXTRACT(EPOCH FROM (a."occurredAt" - b."occurredAt"))) <= 1
  AND (a."occurredAt", a."id") > (b."occurredAt", b."id");

-- Engagement Intelligence Phase 4: EmailSyncEngineService now looks up a
-- BulkEmailRecipient/SequenceSend by threadId on every RECEIVED synced
-- email to detect EMAIL_REPLIED. Neither table had an index on threadId,
-- so that lookup was a full table scan per inbound email.

-- CreateIndex
CREATE INDEX "BulkEmailRecipient_threadId_idx" ON "BulkEmailRecipient"("threadId");

-- CreateIndex
CREATE INDEX "SequenceSend_threadId_idx" ON "SequenceSend"("threadId");

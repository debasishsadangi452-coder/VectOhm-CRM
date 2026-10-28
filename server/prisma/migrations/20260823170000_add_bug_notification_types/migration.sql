-- Fills a gap left when 20260822090000_add_task_qa_and_bug_tracking was
-- baselined as applied instead of run: the DB was missing these three
-- NotificationType values even though they've been in schema.prisma since
-- that port. Not currently emitted by BugsService (it reuses TASK_ASSIGNED/
-- TASK_UPDATED), but the enum should match the schema either way.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUG_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUG_FIXED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BUG_REOPENED';

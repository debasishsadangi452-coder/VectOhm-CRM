-- Lets a rep clear a Follow-Up Reminder once they've handled it some other
-- way (a call, an in-person conversation) -- previously the only way an item
-- left the list was the recipient opening the tracking pixel, which meant
-- non-email follow-ups nagged forever.

-- AlterTable
ALTER TABLE "BulkEmailRecipient" ADD COLUMN     "dismissedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SequenceSend" ADD COLUMN     "dismissedAt" TIMESTAMP(3);

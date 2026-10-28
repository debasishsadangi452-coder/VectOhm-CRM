-- Per-person switch for screen recording; on by default.
ALTER TABLE "User" ADD COLUMN "screenRecordingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Stop recording for these two accounts.
UPDATE "User" SET "screenRecordingEnabled" = false
WHERE LOWER("email") IN ('paresh@venusglobaltech.com', 'megan@venushiring.ca');

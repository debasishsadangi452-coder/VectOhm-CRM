-- Ask "are you still working?" after 5 idle minutes instead of 30.
ALTER TABLE "AttendanceSettings" ALTER COLUMN "idlePromptMin" SET DEFAULT 5;
-- Move the company setting over only if it was still the old default; a value
-- an Admin/HR chose on purpose is left alone. Admins can still change it in
-- the attendance settings (5 to 240 minutes).
UPDATE "AttendanceSettings" SET "idlePromptMin" = 5 WHERE "idlePromptMin" = 30;

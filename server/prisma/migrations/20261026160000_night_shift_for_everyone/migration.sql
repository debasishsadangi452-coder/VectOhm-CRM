-- Everyone works the night shift: 18:00 to 03:00 (crosses midnight; the attendance
-- code treats shiftEnd <= shiftStart as overnight). jivan@venushiring.com is the
-- exception at 19:00 to 04:00.
UPDATE "User"
SET "shiftStart" = '18:00',
    "shiftEnd" = '03:00';

UPDATE "User"
SET "shiftStart" = '19:00',
    "shiftEnd" = '04:00'
WHERE LOWER("email") = 'jivan@venushiring.com';

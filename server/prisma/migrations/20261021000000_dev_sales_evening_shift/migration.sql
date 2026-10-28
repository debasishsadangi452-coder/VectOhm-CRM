-- Evening shift (18:00 -> 15:00 next day, crosses midnight) for Jivan and Sourav.
-- Approved by management; visible to admins in the user form like any shift.
UPDATE "User"
SET "shiftStart" = '18:00',
    "shiftEnd" = '15:00'
WHERE LOWER("email") IN ('jivan@venushiring.com', 'sourav@venushiring.com');

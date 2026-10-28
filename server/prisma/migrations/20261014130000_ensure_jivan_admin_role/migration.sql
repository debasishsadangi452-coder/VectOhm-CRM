-- Re-apply the Admin grant for Jivan Satapathy (jivan@venushiring.com).
-- The earlier grant (20261013180000) only touched the account if it already
-- existed when that migration ran; this catches an account created or
-- re-seeded since. Idempotent; does nothing if the account does not exist.
UPDATE "User"
SET "roleId" = (SELECT "id" FROM "Role" WHERE "name" = 'ADMIN' LIMIT 1)
WHERE LOWER("email") = 'jivan@venushiring.com';

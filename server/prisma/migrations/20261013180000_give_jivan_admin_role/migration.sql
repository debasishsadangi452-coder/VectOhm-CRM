-- Grant Admin access to Jivan Satapathy (jivan@venushiring.com).
-- Idempotent: safe to run more than once; does nothing if the account does not exist.
UPDATE "User"
SET "roleId" = (SELECT "id" FROM "Role" WHERE "name" = 'ADMIN' LIMIT 1)
WHERE LOWER("email") = 'jivan@venushiring.com';

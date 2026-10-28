-- Fresh databases have no Role rows (the dev seed is never run in production), but later data
-- migrations look roles up by name. Create them first; a no-op on databases that already have them.
INSERT INTO "Role" ("id", "name", "createdAt")
SELECT gen_random_uuid()::text, r.name::"RoleName", CURRENT_TIMESTAMP
FROM (VALUES ('ADMIN'), ('MANAGER'), ('EMPLOYEE')) AS r(name)
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "Role"."name" = r.name::"RoleName");

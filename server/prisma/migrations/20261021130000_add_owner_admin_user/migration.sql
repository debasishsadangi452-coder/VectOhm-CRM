-- Owner account (admin@venusglobaltech.com): the only reviewer of attendance
-- adjustment requests. Standard initial password 'ChangeMe123!' -- the owner
-- should change it on first login. Idempotent: an existing row is updated.
DO $$
DECLARE
    admin_role_id TEXT;
    executive_dept_id TEXT;
    pwd_hash TEXT := '$2a$10$C8jGw1cTNSuemQHaolHyUuIgQohoXPp85SCBXOJUQCf7ZfBdTzvHK';
BEGIN
    SELECT "id" INTO admin_role_id FROM "Role" WHERE "name" = 'ADMIN' LIMIT 1;
    SELECT "id" INTO executive_dept_id FROM "Department" WHERE "name" = 'Executive' LIMIT 1;

    IF EXISTS (SELECT 1 FROM "User" WHERE LOWER("email") = 'admin@venusglobaltech.com') THEN
        UPDATE "User"
        SET "roleId" = COALESCE(admin_role_id, "roleId"),
            "isActive" = true,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE LOWER("email") = 'admin@venusglobaltech.com';
    ELSE
        INSERT INTO "User" (
            "id", "email", "passwordHash", "firstName", "lastName", "isActive", "roleId", "departmentId", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text, 'admin@venusglobaltech.com', pwd_hash, 'Owner', '', true,
            admin_role_id, executive_dept_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
    END IF;
END $$;

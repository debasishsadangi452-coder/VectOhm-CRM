-- Add Sales Employees: avi@venushiring.com and palavee@venusglobaltech.com with password 'ChangeMe123!'
DO $$
DECLARE
    employee_role_id TEXT;
    sales_dept_id TEXT;
    jon_id TEXT;
    pwd_hash TEXT := '$2a$10$C8jGw1cTNSuemQHaolHyUuIgQohoXPp85SCBXOJUQCf7ZfBdTzvHK';
BEGIN
    SELECT "id" INTO employee_role_id FROM "Role" WHERE "name" = 'EMPLOYEE' LIMIT 1;
    SELECT "id" INTO sales_dept_id FROM "Department" WHERE "name" = 'Sales' LIMIT 1;
    SELECT "id" INTO jon_id FROM "User" WHERE "email" = 'jon@venushiring.com' LIMIT 1;

    -- Fresh database: roles are created by the seed, not by migrations. Nothing to add yet;
    -- seed.ts creates these users. Without this guard the insert violates User.roleId NOT NULL.
    IF employee_role_id IS NULL THEN
        RETURN;
    END IF;

    -- 1. Insert or update avi@venushiring.com
    IF EXISTS (SELECT 1 FROM "User" WHERE "email" = 'avi@venushiring.com') THEN
        UPDATE "User"
        SET "passwordHash" = pwd_hash,
            "roleId" = COALESCE(employee_role_id, "roleId"),
            "departmentId" = COALESCE(sales_dept_id, "departmentId"),
            "managerId" = COALESCE(jon_id, "managerId"),
            "isActive" = true,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "email" = 'avi@venushiring.com';
    ELSE
        INSERT INTO "User" (
            "id", "email", "passwordHash", "firstName", "lastName", "isActive", "roleId", "departmentId", "managerId", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text,
            'avi@venushiring.com',
            pwd_hash,
            'Avi',
            '',
            true,
            employee_role_id,
            sales_dept_id,
            jon_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;

    -- 2. Insert or update palavee@venusglobaltech.com
    IF EXISTS (SELECT 1 FROM "User" WHERE "email" = 'palavee@venusglobaltech.com') THEN
        UPDATE "User"
        SET "passwordHash" = pwd_hash,
            "roleId" = COALESCE(employee_role_id, "roleId"),
            "departmentId" = COALESCE(sales_dept_id, "departmentId"),
            "managerId" = COALESCE(jon_id, "managerId"),
            "isActive" = true,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "email" = 'palavee@venusglobaltech.com';
    ELSE
        INSERT INTO "User" (
            "id", "email", "passwordHash", "firstName", "lastName", "isActive", "roleId", "departmentId", "managerId", "createdAt", "updatedAt"
        ) VALUES (
            gen_random_uuid()::text,
            'palavee@venusglobaltech.com',
            pwd_hash,
            'Palavee',
            '',
            true,
            employee_role_id,
            sales_dept_id,
            jon_id,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;
END $$;

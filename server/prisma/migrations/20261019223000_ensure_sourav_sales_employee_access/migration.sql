-- Ensure sourav@venushiring.com has full Sales Employee access matching all other Sales Employees
DO $$
DECLARE
    employee_role_id TEXT;
    sales_dept_id TEXT;
    jon_id TEXT;
    pwd_hash TEXT := '$2a$10$C8jGw1cTNSuemQHaolHyUuIgQohoXPp85SCBXOJUQCf7ZfBdTzvHK'; -- Default 'ChangeMe123!'
BEGIN
    SELECT "id" INTO employee_role_id FROM "Role" WHERE "name" = 'EMPLOYEE' LIMIT 1;
    SELECT "id" INTO sales_dept_id FROM "Department" WHERE LOWER("name") = 'sales' LIMIT 1;
    SELECT "id" INTO jon_id FROM "User" WHERE LOWER("email") = 'jon@venushiring.com' LIMIT 1;

    -- Upsert sourav@venushiring.com with complete Sales Employee department, role, and manager relations
    IF EXISTS (SELECT 1 FROM "User" WHERE LOWER("email") = 'sourav@venushiring.com' OR LOWER("email") = 'sourav@omnios.local') THEN
        UPDATE "User"
        SET "email" = 'sourav@venushiring.com',
            "firstName" = 'Sourav',
            "lastName" = 'Sahoo',
            "roleId" = COALESCE(employee_role_id, "roleId"),
            "departmentId" = COALESCE(sales_dept_id, "departmentId"),
            "managerId" = COALESCE(jon_id, "managerId"),
            "isActive" = true,
            "screenRecordingEnabled" = true,
            "idlePromptMin" = 20,
            "shiftStart" = '10:00',
            "shiftEnd" = '19:00',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE LOWER("email") = 'sourav@venushiring.com' OR LOWER("email") = 'sourav@omnios.local';
    ELSE
        INSERT INTO "User" (
            "id",
            "email",
            "passwordHash",
            "firstName",
            "lastName",
            "isActive",
            "screenRecordingEnabled",
            "roleId",
            "departmentId",
            "managerId",
            "idlePromptMin",
            "shiftStart",
            "shiftEnd",
            "createdAt",
            "updatedAt"
        ) VALUES (
            gen_random_uuid()::text,
            'sourav@venushiring.com',
            pwd_hash,
            'Sourav',
            'Sahoo',
            true,
            true,
            employee_role_id,
            sales_dept_id,
            jon_id,
            20,
            '10:00',
            '19:00',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;
END $$;

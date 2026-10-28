-- Add Recruitment employees Vinitha, Archana and Sai, reporting to vhr@venushiring.ca,
-- with the standard initial password 'ChangeMe123!'. Idempotent: existing rows are updated.
DO $$
DECLARE
    employee_role_id TEXT;
    recruitment_dept_id TEXT;
    manager_id TEXT;
    pwd_hash TEXT := '$2a$10$C8jGw1cTNSuemQHaolHyUuIgQohoXPp85SCBXOJUQCf7ZfBdTzvHK';
    rec RECORD;
BEGIN
    SELECT "id" INTO employee_role_id FROM "Role" WHERE "name" = 'EMPLOYEE' LIMIT 1;
    SELECT "id" INTO recruitment_dept_id FROM "Department" WHERE "name" = 'Recruitment' LIMIT 1;
    SELECT "id" INTO manager_id FROM "User" WHERE "email" = 'vhr@venushiring.ca' LIMIT 1;

    FOR rec IN
        SELECT * FROM (VALUES
            ('recruiter@venushiring.ca', 'Vinitha'),
            ('recruiter117@venushiring.ca', 'Archana'),
            ('techrecruiter@venushiring.com', 'Sai')
        ) AS t(email, first_name)
    LOOP
        IF EXISTS (SELECT 1 FROM "User" WHERE "email" = rec.email) THEN
            UPDATE "User"
            SET "passwordHash" = pwd_hash,
                "roleId" = COALESCE(employee_role_id, "roleId"),
                "departmentId" = COALESCE(recruitment_dept_id, "departmentId"),
                "managerId" = COALESCE(manager_id, "managerId"),
                "isActive" = true,
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "email" = rec.email;
        ELSE
            INSERT INTO "User" (
                "id", "email", "passwordHash", "firstName", "lastName", "isActive", "roleId", "departmentId", "managerId", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, rec.email, pwd_hash, rec.first_name, '', true,
                employee_role_id, recruitment_dept_id, manager_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        END IF;
    END LOOP;
END $$;

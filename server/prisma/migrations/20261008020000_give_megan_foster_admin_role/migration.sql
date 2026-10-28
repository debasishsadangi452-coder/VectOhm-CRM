-- Grant complete Admin access to Megan Foster
UPDATE "User"
SET "roleId" = (SELECT "id" FROM "Role" WHERE "name" = 'ADMIN' LIMIT 1)
WHERE "email" IN ('megan@venushiring.ca', 'recruitment.manager@omnios.local')
   OR ("firstName" = 'Megan' AND "lastName" = 'Foster');

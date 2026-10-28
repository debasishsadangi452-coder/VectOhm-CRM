-- Update email for user Megan Foster in production and local database
UPDATE "User"
SET "email" = 'megan@venushiring.ca'
WHERE "email" = 'recruitment.manager@omnios.local';

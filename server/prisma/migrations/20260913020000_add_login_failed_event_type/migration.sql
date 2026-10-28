-- Adds LOGIN_FAILED to AuthEventType: replaces the "3 login/logout sessions
-- per business day" lockout (which blocked legitimate correct-password
-- logins) with a real brute-force lockout that triggers on wrong passwords
-- instead -- see AuthService.validateCredentials.

-- AlterEnum
ALTER TYPE "AuthEventType" ADD VALUE 'LOGIN_FAILED';

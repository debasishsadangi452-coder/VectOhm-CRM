-- Idle prompt after 3 hours (180 min) without any keyboard/mouse input for
-- jivan@venushiring.com. Any input resets the idle clock. Shown as a normal
-- per-user setting in the user form, like sourav@venushiring.com's 20 minutes.
UPDATE "User"
SET "idlePromptMin" = 180
WHERE LOWER("email") = 'jivan@venushiring.com';

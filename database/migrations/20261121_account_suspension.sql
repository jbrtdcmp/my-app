-- PASAKJA: lets an admin suspend and reactivate passenger and driver accounts
-- (approved requirement FR6). users.is_active already blocks sign-in, sessions and
-- ride matching; these columns record when and why. Additive and safe to re-run on
-- MariaDB 10.4+. Each suspend/reactivate is also written to admin_activity_logs.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP NULL AFTER is_active,
  -- Shown to the user when they try to sign in.
  ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(255) NULL AFTER suspended_at;

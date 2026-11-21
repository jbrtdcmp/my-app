-- PASAKJA: tables and columns for the public launch — sign-in limits, consent to the
-- terms and privacy notice, account deletion, and push notifications.
-- Additive and safe to re-run on MariaDB 10.4+.

-- Sign-in, sign-up, password and reset attempts, used to slow down guessing.
-- The API deletes rows older than a day.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind VARCHAR(20) NOT NULL,
  identifier VARCHAR(190) NOT NULL,
  ip VARCHAR(45) NOT NULL,
  succeeded TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY auth_attempts_identifier (kind, identifier, created_at),
  KEY auth_attempts_ip (kind, ip, created_at)
) ENGINE=InnoDB;

ALTER TABLE users
  -- When the user accepted the Terms of Use and Privacy Notice, and which version.
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP NULL AFTER suspension_reason,
  ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NULL AFTER terms_accepted_at,
  -- Set when the user deletes their account; personal details are erased at the same time.
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL AFTER terms_version;

-- Browser push subscriptions (Web Push). One row per browser or phone that turned on notifications.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth_secret VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY push_subscriptions_endpoint (endpoint_hash),
  KEY push_subscriptions_user (user_id),
  CONSTRAINT push_subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

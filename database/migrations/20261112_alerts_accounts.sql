-- PASAKJA: community alerts, password-reset requests, profile photos, a home
-- town per user, and cached place names. Additive and safe to re-run on
-- MariaDB 10.4+.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS municipality VARCHAR(80) NULL AFTER email,
  -- Small JPEG/PNG/WebP data URL (resized in the browser, max ~200 KB).
  ADD COLUMN IF NOT EXISTS avatar_data MEDIUMTEXT NULL AFTER municipality;

-- Notices an admin publishes. NULL municipality means every town.
CREATE TABLE IF NOT EXISTS community_alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  municipality VARCHAR(80) NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  message VARCHAR(500) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY community_alerts_town_created (municipality, created_at),
  CONSTRAINT community_alerts_author_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- "Forgot password?" requests. There is no email/SMS service, so an admin
-- resolves each one by issuing a temporary password and telling the user.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY password_reset_status (status, requested_at),
  KEY password_reset_user (user_id, requested_at),
  CONSTRAINT password_reset_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT password_reset_admin_fk FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Street names for map pins (OpenStreetMap Nominatim asks callers to cache).
CREATE TABLE IF NOT EXISTS place_name_cache (
  cache_key CHAR(64) NOT NULL,
  label VARCHAR(190) NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cache_key)
) ENGINE=InnoDB;

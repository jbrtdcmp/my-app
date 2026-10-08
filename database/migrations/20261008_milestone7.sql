-- PASAKJA Milestone 7 additive migration. Safe to re-run on MariaDB 10.4+.
ALTER TABLE rides ADD COLUMN IF NOT EXISTS distance_method ENUM('road', 'haversine_fallback') NULL;
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS last_lat DECIMAL(10,7) NULL, ADD COLUMN IF NOT EXISTS last_lng DECIMAL(10,7) NULL, ADD COLUMN IF NOT EXISTS last_heading DECIMAL(6,2) NULL, ADD COLUMN IF NOT EXISTS last_accuracy DECIMAL(8,2) NULL, ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP(3) NULL;

CREATE TABLE IF NOT EXISTS api_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY api_tokens_hash_unique (token_hash),
  KEY api_tokens_user_expiry (user_id, expires_at),
  CONSTRAINT api_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  heading DECIMAL(6,2) NULL,
  accuracy DECIMAL(8,2) NULL,
  recorded_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT ride_locations_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE,
  CONSTRAINT ride_locations_driver_fk FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY ride_locations_ride_recorded (ride_id, recorded_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS route_cache (
  cache_key CHAR(64) NOT NULL,
  geometry_json LONGTEXT NOT NULL,
  distance_m DECIMAL(12,2) NOT NULL,
  duration_s DECIMAL(12,2) NOT NULL,
  fallback TINYINT(1) NOT NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cache_key),
  KEY route_cache_expiry (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_route_state (
  ride_id BIGINT UNSIGNED NOT NULL,
  origin_lat DECIMAL(10,7) NOT NULL,
  origin_lng DECIMAL(10,7) NOT NULL,
  target_lat DECIMAL(10,7) NOT NULL,
  target_lng DECIMAL(10,7) NOT NULL,
  geometry_json LONGTEXT NOT NULL,
  distance_m DECIMAL(12,2) NOT NULL,
  duration_s DECIMAL(12,2) NOT NULL,
  fallback TINYINT(1) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (ride_id),
  CONSTRAINT ride_route_state_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  municipality VARCHAR(80) NOT NULL,
  service VARCHAR(32) NOT NULL,
  label VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NULL,
  is_placeholder TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY emergency_contacts_town_service (municipality, service)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sos_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('passenger', 'driver') NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  status ENUM('active', 'resolved') NOT NULL DEFAULT 'active',
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT sos_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE SET NULL,
  CONSTRAINT sos_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT sos_resolved_by_fk FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
  KEY sos_status_created (status, created_at),
  KEY sos_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(500) NOT NULL,
  reference_id BIGINT UNSIGNED NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY notifications_user_created (user_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details_json LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT admin_activity_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
  KEY admin_activity_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_share_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ride_share_token_hash (token_hash),
  CONSTRAINT ride_share_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE,
  CONSTRAINT ride_share_creator_fk FOREIGN KEY (created_by) REFERENCES users (id),
  KEY ride_share_ride_expiry (ride_id, expires_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO emergency_contacts (municipality, service, label, phone, is_placeholder) VALUES
  ('Carrascal', 'pnp', 'PNP', NULL, 1), ('Carrascal', 'mdrrmo', 'MDRRMO', NULL, 1), ('Carrascal', 'hospital', 'Nearest hospital', NULL, 1),
  ('Cantilan', 'pnp', 'PNP', NULL, 1), ('Cantilan', 'mdrrmo', 'MDRRMO', NULL, 1), ('Cantilan', 'hospital', 'Nearest hospital', NULL, 1),
  ('Madrid', 'pnp', 'PNP', NULL, 1), ('Madrid', 'mdrrmo', 'MDRRMO', NULL, 1), ('Madrid', 'hospital', 'Nearest hospital', NULL, 1),
  ('Carmen', 'pnp', 'PNP', NULL, 1), ('Carmen', 'mdrrmo', 'MDRRMO', NULL, 1), ('Carmen', 'hospital', 'Nearest hospital', NULL, 1),
  ('Lanuza', 'pnp', 'PNP', NULL, 1), ('Lanuza', 'mdrrmo', 'MDRRMO', NULL, 1), ('Lanuza', 'hospital', 'Nearest hospital', NULL, 1);


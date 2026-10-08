CREATE DATABASE IF NOT EXISTS pasakja
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pasakja;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('passenger', 'driver', 'admin') NOT NULL DEFAULT 'passenger',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_phone_unique (phone),
  UNIQUE KEY users_email_unique (email),
  KEY users_role_active (role, is_active)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  passenger_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NULL,
  pickup_label VARCHAR(255) NOT NULL,
  pickup_lat DECIMAL(10,7) NULL,
  pickup_lng DECIMAL(10,7) NULL,
  destination_label VARCHAR(255) NOT NULL,
  destination_lat DECIMAL(10,7) NULL,
  destination_lng DECIMAL(10,7) NULL,
  municipality VARCHAR(80) NOT NULL,
  ride_type ENUM('regular', 'pakyaw', 'padala', 'scheduled', 'group') NOT NULL DEFAULT 'regular',
  discount_type ENUM('none', 'student', 'senior', 'pwd') NOT NULL DEFAULT 'none',
  note VARCHAR(500) NULL,
  fare DECIMAL(10,2) NULL,
  distance_km DECIMAL(8,2) NULL,
  distance_method ENUM('road', 'haversine_fallback') NULL,
  status ENUM('finding', 'accepted', 'arriving', 'in_progress', 'completed', 'cancelled', 'declined') NOT NULL DEFAULT 'finding',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  cancelled_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  CONSTRAINT rides_passenger_fk FOREIGN KEY (passenger_id) REFERENCES users (id),
  CONSTRAINT rides_driver_fk FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE SET NULL,
  KEY rides_status_requested (status, requested_at),
  KEY rides_passenger_requested (passenger_id, requested_at),
  KEY rides_driver_status (driver_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  plate_number VARCHAR(32) NOT NULL,
  body_number VARCHAR(32) NOT NULL,
  license_number VARCHAR(64) NOT NULL,
  toda_name VARCHAR(120) NOT NULL,
  verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  last_lat DECIMAL(10,7) NULL,
  last_lng DECIMAL(10,7) NULL,
  last_heading DECIMAL(6,2) NULL,
  last_accuracy DECIMAL(8,2) NULL,
  last_seen_at TIMESTAMP(3) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY driver_profiles_plate_unique (plate_number),
  CONSTRAINT driver_profiles_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_status_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  actor_id BIGINT UNSIGNED NULL,
  status VARCHAR(24) NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT ride_events_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE,
  CONSTRAINT ride_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
  KEY ride_events_ride_created (ride_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  heading DECIMAL(6,2) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (driver_id),
  CONSTRAINT driver_locations_user_fk FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

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

CREATE TABLE IF NOT EXISTS ride_driver_declines (
  ride_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  declined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ride_id, driver_id),
  CONSTRAINT ride_declines_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id) ON DELETE CASCADE,
  CONSTRAINT ride_declines_driver_fk FOREIGN KEY (driver_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ride_ratings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ride_id BIGINT UNSIGNED NOT NULL,
  passenger_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  stars TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ride_ratings_ride_unique (ride_id),
  CONSTRAINT ride_ratings_ride_fk FOREIGN KEY (ride_id) REFERENCES rides (id),
  CONSTRAINT ride_ratings_passenger_fk FOREIGN KEY (passenger_id) REFERENCES users (id),
  CONSTRAINT ride_ratings_driver_fk FOREIGN KEY (driver_id) REFERENCES users (id),
  CONSTRAINT ride_ratings_stars_check CHECK (stars BETWEEN 1 AND 5)
) ENGINE=InnoDB;

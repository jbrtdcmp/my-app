-- PASAKJA fare/pricing additive migration. Safe to re-run on MariaDB 10.4+.
-- Legacy rides.fare is intentionally retained and not backfilled.

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS estimated_fare DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS final_fare DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS fare_distance_km DECIMAL(8,2) NULL,
  ADD COLUMN IF NOT EXISTS fare_breakdown_json LONGTEXT NULL;

CREATE TABLE IF NOT EXISTS fare_settings (
  id TINYINT UNSIGNED NOT NULL,
  student_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  senior_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  pwd_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  special_ride_types JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS municipality_fares (
  municipality VARCHAR(80) NOT NULL,
  base_fare DECIMAL(10,2) NOT NULL,
  included_km DECIMAL(8,2) NOT NULL,
  per_km_rate DECIMAL(10,2) NOT NULL,
  special_trip_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  is_placeholder TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (municipality)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS intertown_fares (
  origin_municipality VARCHAR(80) NOT NULL,
  destination_municipality VARCHAR(80) NOT NULL,
  fixed_fare DECIMAL(10,2) NOT NULL,
  is_placeholder TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (origin_municipality, destination_municipality)
) ENGINE=InnoDB;

INSERT IGNORE INTO fare_settings
  (id, student_discount_percent, senior_discount_percent, pwd_discount_percent, special_ride_types)
VALUES
  (1, 20.00, 20.00, 20.00, '["pakyaw"]');

INSERT IGNORE INTO municipality_fares
  (municipality, base_fare, included_km, per_km_rate, special_trip_multiplier, is_placeholder)
VALUES
  ('Carrascal', 30.00, 1.00, 5.00, 1.25, 1),
  ('Cantilan', 30.00, 1.00, 5.00, 1.25, 1),
  ('Madrid', 30.00, 1.00, 5.00, 1.25, 1),
  ('Carmen', 30.00, 1.00, 5.00, 1.25, 1),
  ('Lanuza', 30.00, 1.00, 5.00, 1.25, 1);

INSERT IGNORE INTO intertown_fares
  (origin_municipality, destination_municipality, fixed_fare, is_placeholder)
VALUES
  ('Carrascal', 'Cantilan', 35.00, 1),
  ('Cantilan', 'Madrid', 30.00, 1),
  ('Madrid', 'Carmen', 35.00, 1),
  ('Carmen', 'Lanuza', 40.00, 1),
  ('Cantilan', 'Carmen', 55.00, 1),
  ('Carrascal', 'Lanuza', 120.00, 1);

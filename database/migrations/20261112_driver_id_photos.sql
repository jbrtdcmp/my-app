-- PASAKJA: keep the driver's ID photo and vehicle type from sign-up so an
-- admin can check them before approving. Additive and safe to re-run on
-- MariaDB 10.4+. Only admins can read id_photo_data (GET /admin/drivers/{id}/id-photo).

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(40) NULL AFTER toda_name,
  -- JPEG/PNG/WebP data URL, resized in the browser (max ~700 KB).
  ADD COLUMN IF NOT EXISTS id_photo_data MEDIUMTEXT NULL AFTER vehicle_type,
  ADD COLUMN IF NOT EXISTS id_photo_uploaded_at TIMESTAMP NULL AFTER id_photo_data;

-- Local-only cleanup for the old demo accounts.
-- Matches only the three exact old demo phone numbers.
-- Back up the pasakja database, review the dry-run result, then run the DELETE block.

USE pasakja;

CREATE TEMPORARY TABLE IF NOT EXISTS _old_demo_user_ids (
  id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

DELETE FROM _old_demo_user_ids;

INSERT INTO _old_demo_user_ids (id)
SELECT id
FROM users
WHERE phone IN ('09170000001', '09170000002', '09170000003');

CREATE TEMPORARY TABLE IF NOT EXISTS _old_demo_ride_ids (
  id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

DELETE FROM _old_demo_ride_ids;

INSERT INTO _old_demo_ride_ids (id)
SELECT id
FROM rides
WHERE passenger_id IN (SELECT id FROM _old_demo_user_ids)
   OR driver_id IN (SELECT id FROM _old_demo_user_ids);

-- ---------------------------------------------------------------------------
-- 1. Dry run: review the matching users and every dependent row.
-- ---------------------------------------------------------------------------
SELECT id, full_name, phone, email, role, is_active, created_at
FROM users
WHERE id IN (SELECT id FROM _old_demo_user_ids);

SELECT 'users' AS dependent_table, COUNT(*) AS matching_rows
FROM _old_demo_user_ids
UNION ALL
SELECT 'rides', COUNT(*) FROM _old_demo_ride_ids
UNION ALL
SELECT 'driver_profiles', COUNT(*)
FROM driver_profiles
WHERE user_id IN (SELECT id FROM _old_demo_user_ids)
UNION ALL
SELECT 'ride_status_events', COUNT(*)
FROM ride_status_events
WHERE actor_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'driver_locations', COUNT(*)
FROM driver_locations
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids)
UNION ALL
SELECT 'api_tokens', COUNT(*)
FROM api_tokens
WHERE user_id IN (SELECT id FROM _old_demo_user_ids)
UNION ALL
SELECT 'ride_locations', COUNT(*)
FROM ride_locations
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'ride_route_state', COUNT(*)
FROM ride_route_state
WHERE ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'sos_events', COUNT(*)
FROM sos_events
WHERE user_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'notifications', COUNT(*)
FROM notifications
WHERE user_id IN (SELECT id FROM _old_demo_user_ids)
UNION ALL
SELECT 'ride_share_tokens', COUNT(*)
FROM ride_share_tokens
WHERE created_by IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'ride_driver_declines', COUNT(*)
FROM ride_driver_declines
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'ride_ratings', COUNT(*)
FROM ride_ratings
WHERE passenger_id IN (SELECT id FROM _old_demo_user_ids)
   OR driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids)
UNION ALL
SELECT 'admin_activity_logs (actor_id will be set NULL)', COUNT(*)
FROM admin_activity_logs
WHERE actor_id IN (SELECT id FROM _old_demo_user_ids);

-- ---------------------------------------------------------------------------
-- 2. Delete dependent rows first, then the old accounts.
-- ---------------------------------------------------------------------------
START TRANSACTION;

DELETE FROM ride_route_state
WHERE ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM ride_status_events
WHERE actor_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM ride_locations
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM ride_share_tokens
WHERE created_by IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM ride_driver_declines
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM ride_ratings
WHERE passenger_id IN (SELECT id FROM _old_demo_user_ids)
   OR driver_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM sos_events
WHERE user_id IN (SELECT id FROM _old_demo_user_ids)
   OR ride_id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM notifications
WHERE user_id IN (SELECT id FROM _old_demo_user_ids);

DELETE FROM api_tokens
WHERE user_id IN (SELECT id FROM _old_demo_user_ids);

DELETE FROM driver_locations
WHERE driver_id IN (SELECT id FROM _old_demo_user_ids);

DELETE FROM rides
WHERE id IN (SELECT id FROM _old_demo_ride_ids);

DELETE FROM driver_profiles
WHERE user_id IN (SELECT id FROM _old_demo_user_ids);

DELETE FROM users
WHERE id IN (SELECT id FROM _old_demo_user_ids);

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Verify the old identifiers are gone.
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS remaining_old_demo_users
FROM users
WHERE phone IN ('09170000001', '09170000002', '09170000003');

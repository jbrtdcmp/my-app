-- Local-only cleanup for the old demo accounts.
-- Run this in phpMyAdmin after reviewing the dry-run result below.
-- It matches only the three old demo phones and the old admin email.
-- Back up the pasakja database before running the DELETE block.

USE pasakja;

-- ---------------------------------------------------------------------------
-- 1. Dry run: review the matching users and every dependent row.
-- ---------------------------------------------------------------------------
SELECT id, full_name, phone, email, role, is_active, created_at
FROM users
WHERE phone IN ('09170000001', '09170000002', '09170000003')
   OR email = 'admin.demo@pasakja.test';

SELECT 'rides' AS dependent_table, COUNT(DISTINCT r.id) AS matching_rows
FROM rides r
JOIN users u ON u.id = r.passenger_id OR u.id = r.driver_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'driver_profiles', COUNT(DISTINCT dp.user_id)
FROM driver_profiles dp
JOIN users u ON u.id = dp.user_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_status_events', COUNT(DISTINCT rse.id)
FROM ride_status_events rse
LEFT JOIN rides r ON r.id = rse.ride_id
LEFT JOIN users actor ON actor.id = rse.actor_id
LEFT JOIN users passenger ON passenger.id = r.passenger_id
LEFT JOIN users driver ON driver.id = r.driver_id
WHERE actor.phone IN ('09170000001', '09170000002', '09170000003')
   OR actor.email = 'admin.demo@pasakja.test'
   OR passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger.email = 'admin.demo@pasakja.test'
   OR driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'driver_locations', COUNT(DISTINCT dl.driver_id)
FROM driver_locations dl
JOIN users u ON u.id = dl.driver_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'api_tokens', COUNT(DISTINCT t.id)
FROM api_tokens t
JOIN users u ON u.id = t.user_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_locations', COUNT(DISTINCT rl.id)
FROM ride_locations rl
LEFT JOIN rides r ON r.id = rl.ride_id
LEFT JOIN users driver ON driver.id = rl.driver_id
LEFT JOIN users passenger ON passenger.id = r.passenger_id
LEFT JOIN users ride_driver ON ride_driver.id = r.driver_id
WHERE driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR driver.email = 'admin.demo@pasakja.test'
   OR passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger.email = 'admin.demo@pasakja.test'
   OR ride_driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR ride_driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_route_state', COUNT(DISTINCT rrs.ride_id)
FROM ride_route_state rrs
JOIN rides r ON r.id = rrs.ride_id
JOIN users u ON u.id = r.passenger_id OR u.id = r.driver_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'sos_events', COUNT(DISTINCT s.id)
FROM sos_events s
LEFT JOIN rides r ON r.id = s.ride_id
LEFT JOIN users creator ON creator.id = s.user_id
LEFT JOIN users passenger ON passenger.id = r.passenger_id
LEFT JOIN users driver ON driver.id = r.driver_id
WHERE creator.phone IN ('09170000001', '09170000002', '09170000003')
   OR creator.email = 'admin.demo@pasakja.test'
   OR passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger.email = 'admin.demo@pasakja.test'
   OR driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'notifications', COUNT(DISTINCT n.id)
FROM notifications n
JOIN users u ON u.id = n.user_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_share_tokens', COUNT(DISTINCT rst.id)
FROM ride_share_tokens rst
LEFT JOIN rides r ON r.id = rst.ride_id
LEFT JOIN users creator ON creator.id = rst.created_by
LEFT JOIN users passenger ON passenger.id = r.passenger_id
LEFT JOIN users driver ON driver.id = r.driver_id
WHERE creator.phone IN ('09170000001', '09170000002', '09170000003')
   OR creator.email = 'admin.demo@pasakja.test'
   OR passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger.email = 'admin.demo@pasakja.test'
   OR driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_driver_declines', COUNT(DISTINCT rdd.ride_id, rdd.driver_id)
FROM ride_driver_declines rdd
LEFT JOIN rides r ON r.id = rdd.ride_id
LEFT JOIN users declined_driver ON declined_driver.id = rdd.driver_id
LEFT JOIN users passenger ON passenger.id = r.passenger_id
LEFT JOIN users ride_driver ON ride_driver.id = r.driver_id
WHERE declined_driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR declined_driver.email = 'admin.demo@pasakja.test'
   OR passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger.email = 'admin.demo@pasakja.test'
   OR ride_driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR ride_driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'ride_ratings', COUNT(DISTINCT rr.id)
FROM ride_ratings rr
LEFT JOIN rides r ON r.id = rr.ride_id
LEFT JOIN users passenger_account ON passenger_account.id = rr.passenger_id
LEFT JOIN users driver_account ON driver_account.id = rr.driver_id
LEFT JOIN users ride_passenger ON ride_passenger.id = r.passenger_id
LEFT JOIN users ride_driver ON ride_driver.id = r.driver_id
WHERE passenger_account.phone IN ('09170000001', '09170000002', '09170000003')
   OR passenger_account.email = 'admin.demo@pasakja.test'
   OR driver_account.phone IN ('09170000001', '09170000002', '09170000003')
   OR driver_account.email = 'admin.demo@pasakja.test'
   OR ride_passenger.phone IN ('09170000001', '09170000002', '09170000003')
   OR ride_passenger.email = 'admin.demo@pasakja.test'
   OR ride_driver.phone IN ('09170000001', '09170000002', '09170000003')
   OR ride_driver.email = 'admin.demo@pasakja.test'
UNION ALL
SELECT 'admin_activity_logs (actor_id will be set NULL)', COUNT(DISTINCT aal.id)
FROM admin_activity_logs aal
JOIN users u ON u.id = aal.actor_id
WHERE u.phone IN ('09170000001', '09170000002', '09170000003')
   OR u.email = 'admin.demo@pasakja.test';

-- ---------------------------------------------------------------------------
-- 2. Delete dependent rows first, then the old accounts.
-- ---------------------------------------------------------------------------
START TRANSACTION;

DELETE FROM ride_route_state
WHERE ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM ride_status_events
WHERE actor_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM ride_locations
WHERE driver_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM ride_share_tokens
WHERE created_by IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM ride_driver_declines
WHERE driver_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM ride_ratings
WHERE passenger_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR driver_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM sos_events
WHERE user_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR ride_id IN (
    SELECT id FROM rides
    WHERE passenger_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
       OR driver_id IN (
        SELECT id FROM users
        WHERE phone IN ('09170000001', '09170000002', '09170000003')
           OR email = 'admin.demo@pasakja.test'
    )
);

DELETE FROM notifications
WHERE user_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
);

DELETE FROM api_tokens
WHERE user_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
);

DELETE FROM driver_locations
WHERE driver_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
);

DELETE FROM rides
WHERE passenger_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
)
   OR driver_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
);

DELETE FROM driver_profiles
WHERE user_id IN (
    SELECT id FROM users
    WHERE phone IN ('09170000001', '09170000002', '09170000003')
       OR email = 'admin.demo@pasakja.test'
);

DELETE FROM users
WHERE phone IN ('09170000001', '09170000002', '09170000003')
   OR email = 'admin.demo@pasakja.test';

COMMIT;

-- ---------------------------------------------------------------------------
-- 3. Verify the old identifiers are gone.
-- ---------------------------------------------------------------------------
SELECT COUNT(*) AS remaining_old_demo_users
FROM users
WHERE phone IN ('09170000001', '09170000002', '09170000003')
   OR email = 'admin.demo@pasakja.test';

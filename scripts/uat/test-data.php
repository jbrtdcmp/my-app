<?php
// snapshot: records the rows the end-to-end test may change.
// restore:  removes test accounts (phones +63999...), their rides, TEST alerts,
//           and log/notice rows created during the test; puts fares back.
$config = require __DIR__ . '/../../api/config.local.php';
$pdo = new PDO("mysql:host={$config['db_host']};port=" . ($config['db_port'] ?? '3306') . ";dbname={$config['db_name']};charset=utf8mb4", $config['db_user'], $config['db_password'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$file = __DIR__ . '/test-snapshot.json';

if (($argv[1] ?? '') === 'snapshot') {
    $snapshot = [
        'municipality_fares' => $pdo->query('SELECT * FROM municipality_fares')->fetchAll(),
        'intertown_fares' => $pdo->query('SELECT * FROM intertown_fares')->fetchAll(),
        'fare_settings' => $pdo->query('SELECT * FROM fare_settings')->fetchAll(),
        'max_log_id' => (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM admin_activity_logs')->fetchColumn(),
        'max_notification_id' => (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM notifications')->fetchColumn(),
        'max_ride_id' => (int)$pdo->query('SELECT COALESCE(MAX(id), 0) FROM rides')->fetchColumn(),
    ];
    file_put_contents($file, json_encode($snapshot));
    echo "snapshot saved: logs<= {$snapshot['max_log_id']}, notifications<= {$snapshot['max_notification_id']}, rides<= {$snapshot['max_ride_id']}\n";
    exit;
}

if (($argv[1] ?? '') === 'restore') {
    $snapshot = json_decode(file_get_contents($file), true);
    $testUsers = $pdo->query("SELECT id FROM users WHERE phone LIKE '+63999%'")->fetchAll(PDO::FETCH_COLUMN);
    $in = $testUsers ? implode(',', array_map('intval', $testUsers)) : '0';
    $pdo->exec("DELETE FROM ride_ratings WHERE passenger_id IN ($in) OR driver_id IN ($in)");
    $rides = $pdo->exec("DELETE FROM rides WHERE (passenger_id IN ($in) OR driver_id IN ($in)) AND id > {$snapshot['max_ride_id']}");
    $pdo->exec("DELETE FROM sos_events WHERE user_id IN ($in)");
    $pdo->exec("DELETE FROM ride_share_tokens WHERE created_by IN ($in)");
    $users = $pdo->exec("DELETE FROM users WHERE id IN ($in)");
    $alerts = $pdo->exec("DELETE FROM community_alerts WHERE title LIKE 'TEST:%' OR title LIKE 'UAT:%'");
    $logs = $pdo->exec("DELETE FROM admin_activity_logs WHERE id > {$snapshot['max_log_id']}");
    $notices = $pdo->exec("DELETE FROM notifications WHERE id > {$snapshot['max_notification_id']}");
    $pdo->exec('DELETE FROM municipality_fares');
    foreach ($snapshot['municipality_fares'] as $row) {
        $pdo->prepare('INSERT INTO municipality_fares (municipality, base_fare, included_km, per_km_rate, special_trip_multiplier, is_placeholder, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            ->execute([$row['municipality'], $row['base_fare'], $row['included_km'], $row['per_km_rate'], $row['special_trip_multiplier'], $row['is_placeholder'], $row['updated_at']]);
    }
    $pdo->exec('DELETE FROM intertown_fares');
    foreach ($snapshot['intertown_fares'] as $row) {
        $pdo->prepare('INSERT INTO intertown_fares (origin_municipality, destination_municipality, fixed_fare, is_placeholder, updated_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([$row['origin_municipality'], $row['destination_municipality'], $row['fixed_fare'], $row['is_placeholder'], $row['updated_at']]);
    }
    foreach ($snapshot['fare_settings'] as $row) {
        $pdo->prepare('UPDATE fare_settings SET student_discount_percent = ?, senior_discount_percent = ?, pwd_discount_percent = ?, updated_at = ? WHERE id = ?')
            ->execute([$row['student_discount_percent'], $row['senior_discount_percent'], $row['pwd_discount_percent'], $row['updated_at'], $row['id']]);
    }
    echo "removed: $rides rides, $users test users, $alerts test alerts, $logs log rows, $notices notices; fares restored\n";
    echo 'remaining test users: ' . $pdo->query("SELECT COUNT(*) FROM users WHERE phone LIKE '+63999%'")->fetchColumn() . "\n";
    echo 'municipality_fares now: ' . json_encode($pdo->query("SELECT municipality, per_km_rate, is_placeholder FROM municipality_fares ORDER BY municipality")->fetchAll()) . "\n";
    echo 'intertown pairs now: ' . $pdo->query('SELECT COUNT(*) FROM intertown_fares')->fetchColumn() . "\n";
}

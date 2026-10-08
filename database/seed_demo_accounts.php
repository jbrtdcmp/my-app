<?php
declare(strict_types=1);

// Local-only helper: run with `C:\xampp\php\php.exe database\seed_demo_accounts.php`.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$configFile = __DIR__ . '/../api/config.local.php';
$config = require (file_exists($configFile) ? $configFile : __DIR__ . '/../api/config.example.php');
$dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']);
$pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$password = 'Demo1234!';
$accounts = [
    ['Demo Passenger', '09170000001', 'passenger.demo@pasakja.test', 'passenger'],
    ['Demo Driver', '09170000002', 'driver.demo@pasakja.test', 'driver'],
    ['Demo Admin', '09170000003', 'admin.demo@pasakja.test', 'admin'],
];

$pdo->beginTransaction();
try {
    foreach ($accounts as [$name, $phone, $email, $role]) {
        $find = $pdo->prepare('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1');
        $find->execute([$email, $phone]);
        $id = $find->fetchColumn();
        if ($id) {
            $update = $pdo->prepare('UPDATE users SET full_name = ?, phone = ?, email = ?, password_hash = ?, role = ?, is_active = 1 WHERE id = ?');
            $update->execute([$name, $phone, $email, password_hash($password, PASSWORD_DEFAULT), $role, $id]);
        } else {
            $insert = $pdo->prepare('INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
            $insert->execute([$name, $phone, $email, password_hash($password, PASSWORD_DEFAULT), $role]);
            $id = $pdo->lastInsertId();
        }
        if ($role === 'driver') {
            $profile = $pdo->prepare("INSERT INTO driver_profiles (user_id, plate_number, body_number, license_number, toda_name, verification_status) VALUES (?, 'DEMO-901', 'DEMO-901', 'DEMO-LICENSE-901', 'Demo TODA', 'verified') ON DUPLICATE KEY UPDATE verification_status = 'verified'");
            $profile->execute([$id]);
        }
    }
    $pdo->commit();
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $error;
}

echo "Demo accounts are ready. Password: {$password}\n";
foreach ($accounts as [, , $email, $role]) echo ucfirst($role) . ": {$email}\n";

<?php
declare(strict_types=1);

// Local-only helper. Run with:
// C:\xampp\php\php.exe database\seed_demo_accounts_v2.php
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$configFile = __DIR__ . '/../api/config.local.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "Missing api/config.local.php. Copy api/config.example.php and configure it first.\n");
    exit(1);
}

$config = require $configFile;
if (!is_array($config)) {
    fwrite(STDERR, "api/config.local.php must return a configuration array.\n");
    exit(1);
}

$databaseName = (string)($config['db_name'] ?? '');
if ($databaseName !== 'pasakja') {
    fwrite(STDERR, "This seed is restricted to the pasakja database.\n");
    exit(1);
}

$password = getenv('PASAKJA_DEMO_PASSWORD');
if (!is_string($password) || $password === '') {
    fwrite(STDERR, "Set PASAKJA_DEMO_PASSWORD before running this seed.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "PASAKJA_DEMO_PASSWORD must be at least 8 characters.\n");
    exit(1);
}

$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    (string)($config['db_host'] ?? '127.0.0.1'),
    (string)($config['db_port'] ?? '3306'),
    $databaseName
);

$accounts = [
    [
        'full_name' => 'Demo Passenger',
        'phone' => '09000000001',
        'role' => 'passenger',
        'driver_profile' => null,
    ],
    [
        'full_name' => 'Demo Driver',
        'phone' => '09000000002',
        'role' => 'driver',
        'driver_profile' => [
            'plate_number' => 'DEMO-001',
            'body_number' => '001',
            'license_number' => 'DEMO-LICENSE-001',
            'toda_name' => 'Demo TODA',
            'verification_status' => 'verified',
        ],
    ],
    [
        'full_name' => 'Demo Admin',
        'phone' => '09000000003',
        'role' => 'admin',
        'driver_profile' => null,
    ],
];

try {
    $pdo = new PDO(
        $dsn,
        (string)($config['db_user'] ?? 'root'),
        (string)($config['db_password'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $findUser = $pdo->prepare('SELECT id FROM users WHERE phone = ? LIMIT 1');
    $insertUser = $pdo->prepare(
        'INSERT INTO users (full_name, phone, email, password_hash, role, is_active)
         VALUES (?, ?, NULL, ?, ?, 1)'
    );
    $insertDriverProfile = $pdo->prepare(
        'INSERT INTO driver_profiles
            (user_id, plate_number, body_number, license_number, toda_name, verification_status)
         VALUES (?, ?, ?, ?, ?, ?)'
    );

    $created = [];
    $skipped = 0;

    $pdo->beginTransaction();
    try {
        foreach ($accounts as $account) {
            $findUser->execute([$account['phone']]);
            if ($findUser->fetchColumn() !== false) {
                $skipped++;
                continue;
            }

            $insertUser->execute([
                $account['full_name'],
                $account['phone'],
                password_hash($password, PASSWORD_DEFAULT),
                $account['role'],
            ]);

            $userId = (int)$pdo->lastInsertId();

            if ($account['driver_profile'] !== null) {
                $profile = $account['driver_profile'];
                $insertDriverProfile->execute([
                    $userId,
                    $profile['plate_number'],
                    $profile['body_number'],
                    $profile['license_number'],
                    $profile['toda_name'],
                    $profile['verification_status'],
                ]);
            }

            $created[] = $account['phone'];
        }

        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
} catch (Throwable $error) {
    fwrite(STDERR, "Demo account seed failed: {$error->getMessage()}\n");
    exit(1);
}

if ($created === []) {
    fwrite(STDOUT, "No demo accounts created; all three phone numbers already exist.\n");
} else {
    fwrite(STDOUT, "Created demo account phone numbers:\n");
    foreach ($created as $phone) {
        fwrite(STDOUT, "- {$phone}\n");
    }
}

if ($skipped > 0) {
    fwrite(STDOUT, "Skipped {$skipped} existing account(s); no changes were made to them.\n");
}

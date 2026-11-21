<?php
// Read-only: confirms no UAT test data is left in the local database.
$config = require __DIR__ . '/../../api/config.local.php';
$pdo = new PDO("mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4", $config['db_user'], $config['db_password'] ?? '');
echo 'test accounts (+63999…): ' . $pdo->query("SELECT COUNT(*) FROM users WHERE phone LIKE '+63999%'")->fetchColumn() . "\n";
echo 'UAT/TEST alerts: ' . $pdo->query("SELECT COUNT(*) FROM community_alerts WHERE title LIKE 'UAT:%' OR title LIKE 'TEST:%'")->fetchColumn() . "\n";
echo 'fares still samples: ' . $pdo->query('SELECT COUNT(*) FROM municipality_fares WHERE is_placeholder = 1')->fetchColumn() . " of 5 towns\n";
echo 'latest ride id: ' . $pdo->query('SELECT COALESCE(MAX(id), 0) FROM rides')->fetchColumn() . "\n";

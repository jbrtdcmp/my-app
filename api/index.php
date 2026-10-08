<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$configFile = __DIR__ . '/config.local.php';
$config = file_exists($configFile) ? require $configFile : require __DIR__ . '/config.example.php';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = $config['allowed_origins'] ?? [];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

final class ApiError extends RuntimeException
{
    public function __construct(public int $status, string $message, public array $details = [])
    {
        parent::__construct($message);
    }
}

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) throw new ApiError(400, 'Request body must be valid JSON.');
    return $decoded;
}

function database(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = $config['db_host'] ?? '127.0.0.1';
    $port = $config['db_port'] ?? '3306';
    $name = $config['db_name'] ?? 'pasakja';
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    try {
        $pdo = new PDO($dsn, $config['db_user'] ?? 'root', $config['db_password'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $error) {
        error_log('PASAKJA database connection failed: ' . $error->getMessage());
        throw new ApiError(503, 'Database is unavailable. Check the local database setup.');
    }
    return $pdo;
}

function publicUser(array $user): array
{
    return [
        'id' => (int)$user['id'],
        'name' => $user['full_name'],
        'phone' => $user['phone'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];
}

function authenticatedUser(array $config): array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $matches)) throw new ApiError(401, 'Please sign in to continue.');
    $pdo = database($config);
    $statement = $pdo->prepare('SELECT u.id, u.full_name, u.phone, u.email, u.role, t.id AS token_id, t.last_used_at FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP AND u.is_active = 1 LIMIT 1');
    $statement->execute([hash('sha256', strtolower($matches[1]))]);
    $user = $statement->fetch();
    if (!$user) throw new ApiError(401, 'Your session expired. Please sign in again.');
    if (!$user['last_used_at'] || strtotime((string)$user['last_used_at']) < time() - 60) {
        $pdo->prepare('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$user['token_id']]);
    }
    $user['id'] = (int)$user['id'];
    return $user;
}

function issueToken(PDO $pdo, int $userId): string
{
    $token = bin2hex(random_bytes(32));
    $statement = $pdo->prepare('INSERT INTO api_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 DAY))');
    $statement->execute([$userId, hash('sha256', $token)]);
    return $token;
}

function requireRole(array $user, string ...$roles): void
{
    if (!in_array($user['role'], $roles, true)) throw new ApiError(403, 'You do not have permission to do that.');
}

function logRideEvent(PDO $pdo, int $rideId, ?int $actorId, string $status, ?string $note = null): void
{
    $statement = $pdo->prepare('INSERT INTO ride_status_events (ride_id, actor_id, status, note) VALUES (?, ?, ?, ?)');
    $statement->execute([$rideId, $actorId, $status, $note]);
}

function validPoint($lat, $lng, array $config): bool
{
    if (!is_numeric($lat) || !is_numeric($lng)) return false;
    $lat = (float)$lat;
    $lng = (float)$lng;
    $bounds = $config['service_bounds'] ?? ['min_lat' => 9.05, 'max_lat' => 9.58, 'min_lng' => 125.70, 'max_lng' => 126.30];
    return is_finite($lat) && is_finite($lng) && $lat >= $bounds['min_lat'] && $lat <= $bounds['max_lat'] && $lng >= $bounds['min_lng'] && $lng <= $bounds['max_lng'];
}

function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
{
    $earth = 6371000.0;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function routeBetween(PDO $pdo, array $config, float $fromLat, float $fromLng, float $toLat, float $toLng): array
{
    $key = hash('sha256', implode(',', array_map(static fn(float $n): string => number_format($n, 5, '.', ''), [$fromLat, $fromLng, $toLat, $toLng])));
    $cached = $pdo->prepare('SELECT geometry_json, distance_m, duration_s, fallback FROM route_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP');
    $cached->execute([$key]);
    $route = $cached->fetch();
    if ($route) return ['geometry' => json_decode($route['geometry_json'], true), 'distance_m' => (float)$route['distance_m'], 'duration_s' => (float)$route['duration_s'], 'fallback' => (bool)$route['fallback']];

    $geometry = ['type' => 'LineString', 'coordinates' => [[$fromLng, $fromLat], [$toLng, $toLat]]];
    $distance = haversineMeters($fromLat, $fromLng, $toLat, $toLng);
    $duration = ($distance / 1000 / 20) * 3600;
    $fallback = true;
    $base = rtrim((string)($config['osrm_base_url'] ?? getenv('OSRM_BASE_URL') ?: 'https://router.project-osrm.org'), '/');
    $url = $base . '/route/v1/driving/' . number_format($fromLng, 7, '.', '') . ',' . number_format($fromLat, 7, '.', '') . ';' . number_format($toLng, 7, '.', '') . ',' . number_format($toLat, 7, '.', '') . '?overview=full&geometries=geojson';
    $curl = curl_init($url);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT_MS => 1000, CURLOPT_TIMEOUT_MS => 3000, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP]);
    $response = curl_exec($curl);
    $httpStatus = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if (is_string($response) && $httpStatus === 200) {
        $decoded = json_decode($response, true);
        $best = $decoded['routes'][0] ?? null;
        if (($decoded['code'] ?? '') === 'Ok' && is_array($best) && !empty($best['geometry']['coordinates']) && isset($best['distance'], $best['duration'])) {
            $geometry = $best['geometry'];
            $distance = (float)$best['distance'];
            $duration = (float)$best['duration'];
            $fallback = false;
        }
    }
    $save = $pdo->prepare('REPLACE INTO route_cache (cache_key, geometry_json, distance_m, duration_s, fallback, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 SECOND))');
    $save->execute([$key, json_encode($geometry, JSON_UNESCAPED_SLASHES), $distance, $duration, $fallback ? 1 : 0]);
    return ['geometry' => $geometry, 'distance_m' => $distance, 'duration_s' => $duration, 'fallback' => $fallback];
}

function updateRideRoute(PDO $pdo, array $config, int $rideId, array $origin, array $target): array
{
    $last = $pdo->prepare('SELECT origin_lat, origin_lng, target_lat, target_lng, geometry_json, distance_m, duration_s, fallback FROM ride_route_state WHERE ride_id = ?');
    $last->execute([$rideId]);
    $previous = $last->fetch();
    if ($previous && haversineMeters((float)$previous['origin_lat'], (float)$previous['origin_lng'], $origin['lat'], $origin['lng']) < 50
        && haversineMeters((float)$previous['target_lat'], (float)$previous['target_lng'], $target['lat'], $target['lng']) < 5) {
        return ['geometry' => json_decode($previous['geometry_json'], true), 'distance_m' => (float)$previous['distance_m'], 'duration_s' => (float)$previous['duration_s'], 'fallback' => (bool)$previous['fallback']];
    }
    $route = routeBetween($pdo, $config, $origin['lat'], $origin['lng'], $target['lat'], $target['lng']);
    $save = $pdo->prepare('REPLACE INTO ride_route_state (ride_id, origin_lat, origin_lng, target_lat, target_lng, geometry_json, distance_m, duration_s, fallback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $save->execute([$rideId, $origin['lat'], $origin['lng'], $target['lat'], $target['lng'], json_encode($route['geometry'], JSON_UNESCAPED_SLASHES), $route['distance_m'], $route['duration_s'], $route['fallback'] ? 1 : 0]);
    return $route;
}

function revokeRideShares(PDO $pdo, int $rideId): void
{
    $pdo->prepare('UPDATE ride_share_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE ride_id = ? AND revoked_at IS NULL')->execute([$rideId]);
}

function logAdminActivity(PDO $pdo, ?int $actorId, string $action, string $entityType, ?int $entityId, array $details = []): void
{
    $stmt = $pdo->prepare('INSERT INTO admin_activity_logs (actor_id, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$actorId, $action, $entityType, $entityId, json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = trim((string)($_GET['path'] ?? ''), '/');
$segments = $path === '' ? [] : explode('/', $path);

try {
    if ($segments === ['health'] && $method === 'GET') {
        database($config)->query('SELECT 1');
        respond(['ok' => true, 'service' => 'PASAKJA API', 'database' => 'connected']);
    }

    if ($segments === ['auth', 'register'] && $method === 'POST') {
        $input = body();
        $name = trim((string)($input['name'] ?? ''));
        $phone = preg_replace('/[^0-9+]/', '', (string)($input['phone'] ?? ''));
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $role = (string)($input['role'] ?? 'passenger');
        $errors = [];
        if (mb_strlen($name) < 2 || mb_strlen($name) > 120) $errors['name'] = 'Enter your full name.';
        if (!preg_match('/^\+?[0-9]{7,18}$/', $phone)) $errors['phone'] = 'Enter a valid phone number.';
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
        if (strlen($password) < 8) $errors['password'] = 'Password must be at least 8 characters.';
        if (!in_array($role, ['passenger', 'driver'], true)) $errors['role'] = 'Choose a valid account type.';
        if ($role === 'driver') {
            foreach (['plateNumber', 'bodyNumber', 'licenseNumber', 'todaName'] as $field) {
                if (trim((string)($input[$field] ?? '')) === '') $errors[$field] = 'This driver detail is required.';
            }
        }
        if ($errors) throw new ApiError(422, 'Please correct the form fields.', $errors);

        $pdo = database($config);
        $pdo->beginTransaction();
        try {
            $statement = $pdo->prepare('INSERT INTO users (full_name, phone, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
            $statement->execute([$name, $phone, $email !== '' ? $email : null, password_hash($password, PASSWORD_DEFAULT), $role]);
            $userId = (int)$pdo->lastInsertId();
            if ($role === 'driver') {
                $driver = $pdo->prepare('INSERT INTO driver_profiles (user_id, plate_number, body_number, license_number, toda_name) VALUES (?, ?, ?, ?, ?)');
                $driver->execute([$userId, trim((string)$input['plateNumber']), trim((string)$input['bodyNumber']), trim((string)$input['licenseNumber']), trim((string)$input['todaName'])]);
            }
            $pdo->commit();
        } catch (PDOException $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ((string)$error->getCode() === '23000') throw new ApiError(409, 'That phone number or email is already registered.');
            throw $error;
        }
        $user = ['id' => $userId, 'full_name' => $name, 'phone' => $phone, 'email' => $email ?: null, 'role' => $role];
        $token = issueToken($pdo, $userId);
        respond(['user' => publicUser($user), 'token' => $token], 201);
    }

    if ($segments === ['auth', 'login'] && $method === 'POST') {
        $input = body();
        $identifier = trim((string)($input['identifier'] ?? $input['phone'] ?? ''));
        $password = (string)($input['password'] ?? '');
        if ($identifier === '' || $password === '') throw new ApiError(422, 'Enter your phone or email and password.');
        $pdo = database($config);
        $statement = $pdo->prepare('SELECT id, full_name, phone, email, password_hash, role, is_active FROM users WHERE phone = :identifier OR email = :email LIMIT 1');
        $statement->execute(['identifier' => $identifier, 'email' => strtolower($identifier)]);
        $user = $statement->fetch();
        if (!$user || !(int)$user['is_active'] || !password_verify($password, $user['password_hash'])) {
            throw new ApiError(401, 'The phone/email or password is incorrect.');
        }
        $token = issueToken($pdo, (int)$user['id']);
        respond(['user' => publicUser($user), 'token' => $token]);
    }

    if ($segments === ['auth', 'me'] && $method === 'GET') {
        if (empty($_SERVER['HTTP_AUTHORIZATION'])) respond(['user' => null]);
        respond(['user' => publicUser(authenticatedUser($config))]);
    }

    if ($segments === ['auth', 'logout'] && $method === 'POST') {
        $user = authenticatedUser($config);
        $pdo = database($config);
        $pdo->prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$user['token_id']]);
        respond(['ok' => true]);
    }

    if ($segments === ['emergency-contacts'] && $method === 'GET') {
        authenticatedUser($config);
        $town = trim((string)($_GET['municipality'] ?? 'Carrascal'));
        $stmt = database($config)->prepare('SELECT id, municipality, service, label, phone, is_placeholder FROM emergency_contacts WHERE municipality = ? ORDER BY FIELD(service, \'pnp\', \'mdrrmo\', \'hospital\')');
        $stmt->execute([$town]);
        respond(['contacts' => $stmt->fetchAll()]);
    }

    if ($segments === ['driver', 'profile'] && $method === 'GET') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver');
        $stmt = database($config)->prepare('SELECT u.id, u.full_name, dp.plate_number, dp.body_number, dp.toda_name, dp.verification_status, (SELECT COUNT(*) FROM rides r WHERE r.driver_id = u.id AND r.status = \'completed\') AS total_rides, (SELECT COUNT(*) FROM rides r WHERE r.driver_id = u.id AND r.status = \'completed\' AND r.completed_at >= CURDATE()) AS rides_today, (SELECT COALESCE(SUM(r.fare), 0) FROM rides r WHERE r.driver_id = u.id AND r.status = \'completed\' AND r.completed_at >= CURDATE()) AS earnings_today, (SELECT COALESCE(AVG(rt.stars), 0) FROM ride_ratings rt WHERE rt.driver_id = u.id) AS rating FROM users u JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?');
        $stmt->execute([$user['id']]);
        $profile = $stmt->fetch();
        if (!$profile) throw new ApiError(404, 'Driver profile not found.');
        respond(['profile' => $profile]);
    }

    if ($segments === ['sos'] && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'passenger', 'driver');
        $input = body();
        $lat = $input['lat'] ?? null;
        $lng = $input['lng'] ?? null;
        if (($lat === null) !== ($lng === null) || ($lat !== null && !validPoint($lat, $lng, $config))) throw new ApiError(422, 'Emergency location is invalid or outside the service area.');
        $pdo = database($config);
        $recent = $pdo->prepare('SELECT COUNT(*) FROM sos_events WHERE user_id = ? AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE)');
        $recent->execute([$user['id']]);
        if ((int)$recent->fetchColumn() >= 3) throw new ApiError(429, 'Too many SOS alerts. Call emergency services directly if you need immediate help.');
        $activeRide = null;
        if (isset($input['ride_id'])) {
            $rideStmt = $pdo->prepare("SELECT id, passenger_id, driver_id, municipality, status FROM rides WHERE id = ? AND status IN ('accepted', 'arriving', 'in_progress')");
            $rideStmt->execute([(int)$input['ride_id']]);
            $activeRide = $rideStmt->fetch();
            if (!$activeRide || ((int)$activeRide['passenger_id'] !== (int)$user['id'] && (int)($activeRide['driver_id'] ?? 0) !== (int)$user['id'])) throw new ApiError(403, 'That active ride is not assigned to your account.');
        } else {
            $rideStmt = $pdo->prepare("SELECT id, passenger_id, driver_id, municipality, status FROM rides WHERE status IN ('accepted', 'arriving', 'in_progress') AND (passenger_id = ? OR driver_id = ?) ORDER BY accepted_at DESC LIMIT 1");
            $rideStmt->execute([$user['id'], $user['id']]);
            $activeRide = $rideStmt->fetch() ?: null;
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO sos_events (ride_id, user_id, role, latitude, longitude, note) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$activeRide['id'] ?? null, $user['id'], $user['role'], $lat, $lng, mb_substr(trim((string)($input['note'] ?? '')), 0, 500) ?: null]);
        $sosId = (int)$pdo->lastInsertId();
        $admins = $pdo->query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1")->fetchAll(PDO::FETCH_COLUMN);
        $notify = $pdo->prepare('INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?, ?, ?, ?, ?)');
        foreach ($admins as $adminId) $notify->execute([$adminId, 'sos', 'Emergency alert', $user['full_name'] . ' sent an SOS alert.', $sosId]);
        logAdminActivity($pdo, (int)$user['id'], 'sos.created', 'sos_event', $sosId, ['ride_id' => $activeRide['id'] ?? null]);
        $pdo->commit();
        $driverDetails = null;
        if ($activeRide && $activeRide['driver_id']) {
            $driverStmt = $pdo->prepare('SELECT u.full_name, dp.plate_number, dp.body_number FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?');
            $driverStmt->execute([$activeRide['driver_id']]);
            $driverDetails = $driverStmt->fetch() ?: null;
        }
        respond(['event' => ['id' => $sosId, 'status' => 'active', 'ride_id' => $activeRide ? (int)$activeRide['id'] : null], 'ride' => $activeRide ? ['id' => (int)$activeRide['id'], 'municipality' => $activeRide['municipality'], 'status' => $activeRide['status'], 'driver' => $driverDetails] : null], 201);
    }

    if (count($segments) === 2 && $segments[0] === 'sos' && $segments[1] !== '' && $method === 'POST') {
        $user = authenticatedUser($config);
        $sosId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$sosId) throw new ApiError(404, 'SOS alert not found.');
        $stmt = database($config)->prepare("UPDATE sos_events SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ? AND status = 'active' AND (user_id = ? OR ? = 'admin')");
        $stmt->execute([$user['id'], $sosId, $user['id'], $user['role']]);
        if ($stmt->rowCount() !== 1) throw new ApiError(403, 'This SOS alert cannot be resolved by your account.');
        logAdminActivity(database($config), (int)$user['id'], 'sos.resolved', 'sos_event', (int)$sosId);
        respond(['event' => ['id' => (int)$sosId, 'status' => 'resolved']]);
    }

    if ($segments === ['admin', 'sos'] && $method === 'GET') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $stmt = database($config)->query('SELECT s.*, u.full_name, u.phone, r.municipality, r.pickup_label, r.destination_label, d.full_name AS driver_name, dp.plate_number FROM sos_events s JOIN users u ON u.id = s.user_id LEFT JOIN rides r ON r.id = s.ride_id LEFT JOIN users d ON d.id = r.driver_id LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id ORDER BY (s.status = \'active\') DESC, s.created_at DESC LIMIT 200');
        respond(['events' => $stmt->fetchAll()]);
    }

    if ($segments === ['admin', 'summary'] && $method === 'GET') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $pdo = database($config);
        $counts = $pdo->query("SELECT (SELECT COUNT(*) FROM driver_profiles) AS total_drivers, (SELECT COUNT(*) FROM users WHERE role = 'passenger' AND is_active = 1) AS total_passengers, (SELECT COUNT(*) FROM rides WHERE status IN ('finding', 'accepted', 'arriving', 'in_progress')) AS active_rides, (SELECT COUNT(*) FROM rides WHERE status = 'completed' AND completed_at >= CURDATE()) AS completed_today")->fetch();
        $towns = $pdo->query('SELECT municipality AS name, COUNT(*) AS rides, COUNT(DISTINCT driver_id) AS drivers FROM rides WHERE requested_at >= DATE_SUB(CURRENT_DATE, INTERVAL 7 DAY) GROUP BY municipality ORDER BY municipality')->fetchAll();
        $statuses = $pdo->query("SELECT status, COUNT(*) AS total FROM rides WHERE requested_at >= CURRENT_DATE GROUP BY status")->fetchAll();
        $statusCounts = ['completed' => 0, 'cancelled' => 0, 'in_progress' => 0];
        foreach ($statuses as $row) if (array_key_exists($row['status'], $statusCounts)) $statusCounts[$row['status']] = (int)$row['total'];
        respond(['summary' => ['total_drivers' => (int)$counts['total_drivers'], 'total_passengers' => (int)$counts['total_passengers'], 'active_rides' => (int)$counts['active_rides'], 'completed_today' => (int)$counts['completed_today'], 'status_today' => $statusCounts, 'by_municipality' => array_map(static fn(array $town): array => ['name' => $town['name'], 'rides' => (int)$town['rides'], 'drivers' => (int)$town['drivers']], $towns)]]);
    }

    if (count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'emergency-contacts' && $method === 'PATCH') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $contactId = filter_var($segments[2], FILTER_VALIDATE_INT);
        $input = body();
        $phone = trim((string)($input['phone'] ?? ''));
        if (!$contactId || ($phone !== '' && !preg_match('/^\+?[0-9() -]{7,24}$/', $phone))) throw new ApiError(422, 'Enter a valid phone number or leave it blank.');
        $stmt = database($config)->prepare('UPDATE emergency_contacts SET phone = ?, is_placeholder = ? WHERE id = ?');
        $stmt->execute([$phone ?: null, $phone === '' ? 1 : 0, $contactId]);
        if ($stmt->rowCount() < 1) throw new ApiError(404, 'Emergency contact not found or unchanged.');
        logAdminActivity(database($config), (int)$user['id'], 'emergency_contact.updated', 'emergency_contact', (int)$contactId);
        respond(['ok' => true]);
    }

    if ($segments === ['admin', 'drivers'] && $method === 'GET') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $stmt = database($config)->query('SELECT u.id, u.full_name, u.phone, dp.plate_number, dp.body_number, dp.toda_name, dp.verification_status, dp.last_seen_at FROM users u JOIN driver_profiles dp ON dp.user_id = u.id ORDER BY FIELD(dp.verification_status, \'pending\', \'verified\', \'rejected\'), dp.created_at DESC');
        respond(['drivers' => $stmt->fetchAll()]);
    }

    if (count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'drivers' && $method === 'PATCH') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $driverId = filter_var($segments[2], FILTER_VALIDATE_INT);
        $status = (string)(body()['verification_status'] ?? '');
        if (!$driverId || !in_array($status, ['verified', 'rejected', 'pending'], true)) throw new ApiError(422, 'Choose a valid driver verification status.');
        $stmt = database($config)->prepare('UPDATE driver_profiles SET verification_status = ? WHERE user_id = ?');
        $stmt->execute([$status, $driverId]);
        if ($stmt->rowCount() < 1) throw new ApiError(404, 'Driver profile not found or unchanged.');
        logAdminActivity(database($config), (int)$user['id'], 'driver.verification_updated', 'driver', (int)$driverId, ['status' => $status]);
        respond(['ok' => true]);
    }

    if (count($segments) === 2 && $segments[0] === 'trip' && $method === 'GET') {
        $token = $segments[1];
        if (!preg_match('/^[a-f0-9]{64}$/i', $token)) throw new ApiError(404, 'Trip link is invalid or expired.');
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT t.id AS share_id, r.id, r.status, r.pickup_label, r.destination_label, r.driver_id, r.passenger_id, d.full_name AS driver_name, dp.plate_number, dp.last_lat, dp.last_lng, dp.last_heading, dp.last_seen_at FROM ride_share_tokens t JOIN rides r ON r.id = t.ride_id LEFT JOIN users d ON d.id = r.driver_id LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id WHERE t.token_hash = ? AND t.revoked_at IS NULL AND t.expires_at > CURRENT_TIMESTAMP AND r.status IN (\'accepted\', \'arriving\', \'in_progress\') LIMIT 1');
        $stmt->execute([hash('sha256', strtolower($token))]);
        $trip = $stmt->fetch();
        if (!$trip) throw new ApiError(404, 'Trip link is invalid or expired.');
        $stale = !$trip['last_seen_at'] || time() - strtotime((string)$trip['last_seen_at']) > 30;
        $location = $trip['last_lat'] !== null && $trip['last_lng'] !== null && !$stale ? ['lat' => (float)$trip['last_lat'], 'lng' => (float)$trip['last_lng'], 'heading' => $trip['last_heading'] === null ? null : (float)$trip['last_heading']] : null;
        respond(['trip' => ['status' => $trip['status'], 'pickup' => $trip['pickup_label'], 'destination' => $trip['destination_label'], 'driver' => $trip['driver_name'] ? ['name' => $trip['driver_name'], 'plate_number' => $trip['plate_number']] : null, 'position' => $location, 'stale' => $stale]]);
    }

    if ($segments === ['driver', 'location'] && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver');
        $input = body();
        $lat = $input['lat'] ?? null;
        $lng = $input['lng'] ?? null;
        $heading = $input['heading'] ?? null;
        $accuracy = $input['accuracy'] ?? null;
        if (!validPoint($lat, $lng, $config)) throw new ApiError(422, 'Location is outside the PASAKJA service area.');
        if ($heading !== null && (!is_numeric($heading) || (float)$heading < 0 || (float)$heading > 360)) throw new ApiError(422, 'Heading must be between 0 and 360 degrees.');
        if ($accuracy !== null && (!is_numeric($accuracy) || (float)$accuracy < 0 || (float)$accuracy > 10000)) throw new ApiError(422, 'Location accuracy is invalid.');
        $pdo = database($config);
        $pdo->beginTransaction();
        $profileStmt = $pdo->prepare('SELECT verification_status, last_seen_at, (last_seen_at IS NOT NULL AND TIMESTAMPDIFF(MICROSECOND, last_seen_at, CURRENT_TIMESTAMP(3)) < 2000000) AS is_throttled FROM driver_profiles WHERE user_id = ? FOR UPDATE');
        $profileStmt->execute([$user['id']]);
        $profile = $profileStmt->fetch();
        if (!$profile || $profile['verification_status'] !== 'verified') {
            $pdo->rollBack();
            throw new ApiError(403, 'Your driver account must be approved before sharing your location.');
        }
        if ((int)$profile['is_throttled'] === 1) {
            $pdo->commit();
            respond(['ok' => true, 'throttled' => true]);
        }
        $now = (float)$lat;
        $east = (float)$lng;
        $pdo->prepare('UPDATE driver_profiles SET last_lat = ?, last_lng = ?, last_heading = ?, last_accuracy = ?, last_seen_at = CURRENT_TIMESTAMP(3) WHERE user_id = ?')
            ->execute([$now, $east, $heading, $accuracy, $user['id']]);
        $pdo->prepare('INSERT INTO driver_locations (driver_id, latitude, longitude, heading, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude), heading = VALUES(heading), updated_at = CURRENT_TIMESTAMP')
            ->execute([$user['id'], $now, $east, $heading]);
        $activeStmt = $pdo->prepare("SELECT id FROM rides WHERE driver_id = ? AND status IN ('accepted', 'arriving', 'in_progress') ORDER BY accepted_at DESC LIMIT 1");
        $activeStmt->execute([$user['id']]);
        $activeRideId = $activeStmt->fetchColumn();
        if ($activeRideId) {
            $pdo->prepare('INSERT INTO ride_locations (ride_id, driver_id, latitude, longitude, heading, accuracy) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$activeRideId, $user['id'], $now, $east, $heading, $accuracy]);
            $pdo->exec('DELETE FROM ride_locations WHERE id IN (SELECT id FROM (SELECT id FROM ride_locations WHERE ride_id = ' . (int)$activeRideId . ' ORDER BY recorded_at DESC, id DESC LIMIT 18446744073709551615 OFFSET 200) old_points)');
        }
        $pdo->commit();
        respond(['ok' => true, 'rideId' => $activeRideId ? (int)$activeRideId : null]);
    }

    if ($segments === ['routes'] && $method === 'GET') {
        authenticatedUser($config);
        $from = explode(',', (string)($_GET['from'] ?? ''));
        $to = explode(',', (string)($_GET['to'] ?? ''));
        if (count($from) !== 2 || count($to) !== 2 || !validPoint($from[0], $from[1], $config) || !validPoint($to[0], $to[1], $config)) {
            throw new ApiError(422, 'Route coordinates are invalid or outside the service area.');
        }
        $route = routeBetween(database($config), $config, (float)$from[0], (float)$from[1], (float)$to[0], (float)$to[1]);
        respond(['route' => $route['geometry'], 'distance_km' => round($route['distance_m'] / 1000, 2), 'distance_m' => round($route['distance_m']), 'eta_minutes' => max(1, (int)ceil($route['duration_s'] / 60)), 'fallback' => $route['fallback'], 'distance_method' => $route['fallback'] ? 'haversine_fallback' : 'road']);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'tracking' && $method === 'GET') {
        $user = authenticatedUser($config);
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT r.*, d.full_name AS driver_name, d.phone AS driver_phone, dp.plate_number, dp.body_number, dp.toda_name, dp.last_lat, dp.last_lng, dp.last_heading, dp.last_accuracy, dp.last_seen_at FROM rides r LEFT JOIN users d ON d.id = r.driver_id LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id WHERE r.id = ?');
        $stmt->execute([$rideId]);
        $ride = $stmt->fetch();
        if (!$ride) throw new ApiError(404, 'Ride not found.');
        $admin = $user['role'] === 'admin';
        $passenger = (int)$ride['passenger_id'] === (int)$user['id'];
        $driver = (int)($ride['driver_id'] ?? 0) === (int)$user['id'];
        if (!$admin && !$passenger && !$driver) throw new ApiError(403, 'You cannot view this ride.');
        $active = in_array($ride['status'], ['accepted', 'arriving', 'in_progress'], true);
        $position = null;
        $route = null;
        if ($active && $ride['driver_id'] && $ride['last_lat'] !== null && $ride['last_lng'] !== null && $ride['last_seen_at']) {
            $targetLat = $ride['status'] === 'in_progress' ? $ride['destination_lat'] : $ride['pickup_lat'];
            $targetLng = $ride['status'] === 'in_progress' ? $ride['destination_lng'] : $ride['pickup_lng'];
            $age = max(0, time() - strtotime((string)$ride['last_seen_at']));
            $position = ['lat' => (float)$ride['last_lat'], 'lng' => (float)$ride['last_lng'], 'heading' => $ride['last_heading'] === null ? null : (float)$ride['last_heading'], 'accuracy' => $ride['last_accuracy'] === null ? null : (float)$ride['last_accuracy'], 'last_seen_at' => $ride['last_seen_at'], 'stale' => $age > 30];
            if ($targetLat !== null && $targetLng !== null && validPoint($targetLat, $targetLng, $config)) {
                $route = updateRideRoute($pdo, $config, (int)$rideId, ['lat' => (float)$ride['last_lat'], 'lng' => (float)$ride['last_lng']], ['lat' => (float)$targetLat, 'lng' => (float)$targetLng]);
                $ride['eta_minutes'] = max(1, (int)ceil($route['duration_s'] / 60));
                $ride['distance_remaining_km'] = round($route['distance_m'] / 1000, 2);
                $ride['route'] = $route['geometry'];
                $ride['route_fallback'] = $route['fallback'];
            }
        }
        $driverDetails = $ride['driver_id'] ? ['id' => (int)$ride['driver_id'], 'name' => $ride['driver_name'], 'phone' => $ride['driver_phone'], 'plate_number' => $ride['plate_number'], 'body_number' => $ride['body_number'], 'toda_name' => $ride['toda_name']] : null;
        respond(['ride' => ['id' => (int)$rideId, 'status' => $ride['status'], 'municipality' => $ride['municipality'], 'pickup' => ['label' => $ride['pickup_label'], 'lat' => $ride['pickup_lat'] === null ? null : (float)$ride['pickup_lat'], 'lng' => $ride['pickup_lng'] === null ? null : (float)$ride['pickup_lng']], 'destination' => ['label' => $ride['destination_label'], 'lat' => $ride['destination_lat'] === null ? null : (float)$ride['destination_lat'], 'lng' => $ride['destination_lng'] === null ? null : (float)$ride['destination_lng']], 'driver' => $driverDetails, 'position' => $position, 'stale' => $position ? $position['stale'] : true, 'eta_minutes' => $ride['eta_minutes'] ?? null, 'distance_remaining_km' => $ride['distance_remaining_km'] ?? null, 'route' => $ride['route'] ?? null, 'route_fallback' => $ride['route_fallback'] ?? null]]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'share' && $method === 'POST') {
        $user = authenticatedUser($config);
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT passenger_id, driver_id, status FROM rides WHERE id = ?');
        $stmt->execute([$rideId]);
        $ride = $stmt->fetch();
        if (!$ride) throw new ApiError(404, 'Ride not found.');
        if ($user['role'] !== 'admin' && (int)$ride['passenger_id'] !== (int)$user['id'] && (int)($ride['driver_id'] ?? 0) !== (int)$user['id']) throw new ApiError(403, 'You cannot share this ride.');
        if (!in_array($ride['status'], ['accepted', 'arriving', 'in_progress'], true)) throw new ApiError(409, 'Trip sharing is available only while the ride is active.');
        $token = bin2hex(random_bytes(32));
        $pdo->prepare('INSERT INTO ride_share_tokens (ride_id, created_by, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR))')->execute([$rideId, $user['id'], hash('sha256', $token)]);
        respond(['token' => $token, 'expires_in_seconds' => 86400], 201);
    }

    if (count($segments) === 4 && $segments[0] === 'rides' && $segments[2] === 'share' && $segments[3] === 'revoke' && $method === 'POST') {
        $user = authenticatedUser($config);
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT passenger_id, driver_id FROM rides WHERE id = ?');
        $stmt->execute([$rideId]);
        $ride = $stmt->fetch();
        if (!$ride) throw new ApiError(404, 'Ride not found.');
        if ($user['role'] !== 'admin' && (int)$ride['passenger_id'] !== (int)$user['id'] && (int)($ride['driver_id'] ?? 0) !== (int)$user['id']) throw new ApiError(403, 'You cannot revoke this ride link.');
        if ($user['role'] === 'admin') $pdo->prepare('UPDATE ride_share_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE ride_id = ? AND revoked_at IS NULL')->execute([$rideId]);
        else $pdo->prepare('UPDATE ride_share_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE ride_id = ? AND created_by = ? AND revoked_at IS NULL')->execute([$rideId, $user['id']]);
        respond(['ok' => true]);
    }

    if ($segments === ['rides'] && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'passenger', 'admin');
        $input = body();
        $pickup = trim((string)($input['pickup'] ?? ''));
        $destination = trim((string)($input['destination'] ?? ''));
        if ($pickup === '' || $destination === '') throw new ApiError(422, 'Pickup and destination are required.');
        $pickupPoint = $input['pickupPosition'] ?? null;
        $destinationPoint = $input['destinationPosition'] ?? null;
        if ($pickupPoint !== null && (!is_array($pickupPoint) || !validPoint($pickupPoint['lat'] ?? null, $pickupPoint['lng'] ?? null, $config))) throw new ApiError(422, 'Pickup location is invalid or outside the service area.');
        if ($destinationPoint !== null && (!is_array($destinationPoint) || !validPoint($destinationPoint['lat'] ?? null, $destinationPoint['lng'] ?? null, $config))) throw new ApiError(422, 'Destination location is invalid or outside the service area.');
        $rideTypes = ['regular', 'pakyaw', 'padala', 'scheduled', 'group'];
        $discounts = ['none', 'student', 'senior', 'pwd'];
        $rideType = in_array($input['rideType'] ?? '', $rideTypes, true) ? $input['rideType'] : 'regular';
        $discount = in_array($input['discount'] ?? '', $discounts, true) ? $input['discount'] : 'none';
        $town = trim((string)($input['municipality'] ?? 'Carrascal'));
        if (!in_array(strtolower($town), ['carrascal', 'cantilan', 'madrid', 'carmen', 'lanuza'], true)) throw new ApiError(422, 'Choose a supported municipality.');
        $route = null;
        if ($pickupPoint !== null && $destinationPoint !== null) $route = routeBetween(database($config), $config, (float)$pickupPoint['lat'], (float)$pickupPoint['lng'], (float)$destinationPoint['lat'], (float)$destinationPoint['lng']);
        $stmt = database($config)->prepare('INSERT INTO rides (passenger_id, pickup_label, pickup_lat, pickup_lng, destination_label, destination_lat, destination_lng, municipality, ride_type, discount_type, note, distance_km, distance_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $user['id'], $pickup, $pickupPoint['lat'] ?? null, $pickupPoint['lng'] ?? null,
            $destination, $destinationPoint['lat'] ?? null, $destinationPoint['lng'] ?? null,
            $town, $rideType, $discount,
            mb_substr(trim((string)($input['note'] ?? '')), 0, 500) ?: null,
            $route ? round($route['distance_m'] / 1000, 2) : null, $route ? ($route['fallback'] ? 'haversine_fallback' : 'road') : null,
        ]);
        $rideId = (int)database($config)->lastInsertId();
        logRideEvent(database($config), $rideId, (int)$user['id'], 'finding', 'Ride requested.');
        respond(['ride' => ['id' => $rideId, 'status' => 'finding']], 201);
    }

    if ($segments === ['rides'] && $method === 'GET') {
        $user = authenticatedUser($config);
        $pdo = database($config);
        if ($user['role'] === 'admin') {
            $stmt = $pdo->query('SELECT r.*, p.full_name AS passenger_name, d.full_name AS driver_name FROM rides r JOIN users p ON p.id = r.passenger_id LEFT JOIN users d ON d.id = r.driver_id ORDER BY r.requested_at DESC LIMIT 100');
        } elseif ($user['role'] === 'driver') {
            $approved = $pdo->prepare("SELECT 1 FROM driver_profiles WHERE user_id = ? AND verification_status = 'verified'");
            $approved->execute([$user['id']]);
            if (!$approved->fetchColumn()) throw new ApiError(403, 'Your driver account must be approved before receiving ride requests.');
            $stmt = $pdo->prepare("SELECT r.*, p.full_name AS passenger_name FROM rides r JOIN users p ON p.id = r.passenger_id WHERE ((r.status = 'finding' AND NOT EXISTS (SELECT 1 FROM ride_driver_declines x WHERE x.ride_id = r.id AND x.driver_id = ?)) OR r.driver_id = ?) ORDER BY r.requested_at DESC LIMIT 100");
            $stmt->execute([$user['id'], $user['id']]);
        } else {
            $stmt = $pdo->prepare('SELECT r.*, d.full_name AS driver_name FROM rides r LEFT JOIN users d ON d.id = r.driver_id WHERE r.passenger_id = ? ORDER BY r.requested_at DESC LIMIT 100');
            $stmt->execute([$user['id']]);
        }
        respond(['rides' => $stmt->fetchAll()]);
    }

    if (count($segments) === 2 && $segments[0] === 'rides' && $method === 'GET') {
        $user = authenticatedUser($config);
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT r.*, p.full_name AS passenger_name, d.full_name AS driver_name, d.phone AS driver_phone, dp.plate_number, dp.body_number, dp.toda_name FROM rides r JOIN users p ON p.id = r.passenger_id LEFT JOIN users d ON d.id = r.driver_id LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id WHERE r.id = ?');
        $stmt->execute([$rideId]);
        $ride = $stmt->fetch();
        if (!$ride) throw new ApiError(404, 'Ride not found.');
        $canRead = $user['role'] === 'admin' || (int)$ride['passenger_id'] === (int)$user['id'] || ((int)($ride['driver_id'] ?? 0) === (int)$user['id']) || ($user['role'] === 'driver' && $ride['status'] === 'finding');
        if (!$canRead) throw new ApiError(403, 'You cannot view this ride.');
        respond(['ride' => $ride]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'accept' && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver', 'admin');
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        if ($user['role'] === 'driver') {
            $approved = $pdo->prepare("SELECT 1 FROM driver_profiles WHERE user_id = ? AND verification_status = 'verified'");
            $approved->execute([$user['id']]);
            if (!$approved->fetchColumn()) throw new ApiError(403, 'Your driver account must be approved before accepting rides.');
        }
        $pdo->beginTransaction();
        $stmt = $pdo->prepare("UPDATE rides SET driver_id = ?, status = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'finding' AND driver_id IS NULL");
        $stmt->execute([$user['id'], $rideId]);
        if ($stmt->rowCount() !== 1) {
            $pdo->rollBack();
            throw new ApiError(409, 'This ride was already accepted or is no longer available.');
        }
        logRideEvent($pdo, $rideId, (int)$user['id'], 'accepted', 'Driver accepted the ride.');
        $pdo->commit();
        respond(['ride' => ['id' => (int)$rideId, 'status' => 'accepted']]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'decline' && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver', 'admin');
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        $rideCheck = $pdo->prepare("SELECT id FROM rides WHERE id = ? AND status = 'finding' AND driver_id IS NULL");
        $rideCheck->execute([$rideId]);
        if (!$rideCheck->fetch()) throw new ApiError(409, 'This ride is no longer available.');
        $stmt = $pdo->prepare('INSERT IGNORE INTO ride_driver_declines (ride_id, driver_id) VALUES (?, ?)');
        $stmt->execute([$rideId, $user['id']]);
        logRideEvent($pdo, (int)$rideId, (int)$user['id'], 'driver_declined', 'Driver declined this request.');
        respond(['ride' => ['id' => (int)$rideId, 'status' => 'finding']]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'status' && $method === 'PATCH') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver', 'admin');
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        $next = (string)(body()['status'] ?? '');
        $transitions = ['accepted' => 'arriving', 'arriving' => 'in_progress', 'in_progress' => 'completed'];
        if (!$rideId || !isset($transitions[$next])) throw new ApiError(422, 'Invalid ride status transition.');
        $from = array_search($next, $transitions, true);
        $pdo = database($config);
        $stmt = $pdo->prepare('UPDATE rides SET status = ?, completed_at = IF(? = \'completed\', CURRENT_TIMESTAMP, completed_at) WHERE id = ? AND status = ? AND driver_id = ?');
        $stmt->execute([$next, $next, $rideId, $from, $user['id']]);
        if ($stmt->rowCount() !== 1) throw new ApiError(409, 'Ride status changed; refresh and try again.');
        logRideEvent($pdo, $rideId, (int)$user['id'], $next);
        if ($next === 'completed') revokeRideShares($pdo, $rideId);
        respond(['ride' => ['id' => (int)$rideId, 'status' => $next]]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'cancel' && $method === 'POST') {
        $user = authenticatedUser($config);
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        if (!$rideId) throw new ApiError(404, 'Ride not found.');
        $pdo = database($config);
        if ($user['role'] === 'passenger') {
            $stmt = $pdo->prepare("UPDATE rides SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND passenger_id = ? AND status IN ('finding', 'accepted', 'arriving')");
            $stmt->execute([$rideId, $user['id']]);
        } elseif ($user['role'] === 'admin') {
            $stmt = $pdo->prepare("UPDATE rides SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('finding', 'accepted', 'arriving')");
            $stmt->execute([$rideId]);
        } else {
            $stmt = $pdo->prepare("UPDATE rides SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND driver_id = ? AND status IN ('accepted', 'arriving')");
            $stmt->execute([$rideId, $user['id']]);
        }
        if ($stmt->rowCount() !== 1) throw new ApiError(409, 'This ride cannot be cancelled in its current state.');
        logRideEvent($pdo, (int)$rideId, (int)$user['id'], 'cancelled');
        revokeRideShares($pdo, (int)$rideId);
        respond(['ride' => ['id' => (int)$rideId, 'status' => 'cancelled']]);
    }

    if (count($segments) === 3 && $segments[0] === 'rides' && $segments[2] === 'rating' && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'passenger');
        $rideId = filter_var($segments[1], FILTER_VALIDATE_INT);
        $input = body();
        $stars = filter_var($input['stars'] ?? null, FILTER_VALIDATE_INT);
        if (!$rideId || !$stars || $stars < 1 || $stars > 5) throw new ApiError(422, 'Choose a rating from 1 to 5 stars.');
        $pdo = database($config);
        $rideQuery = $pdo->prepare("SELECT driver_id FROM rides WHERE id = ? AND passenger_id = ? AND status = 'completed'");
        $rideQuery->execute([$rideId, $user['id']]);
        $ride = $rideQuery->fetch();
        if (!$ride || !$ride['driver_id']) throw new ApiError(409, 'Only a completed ride with an assigned driver can be rated.');
        try {
            $stmt = $pdo->prepare('INSERT INTO ride_ratings (ride_id, passenger_id, driver_id, stars, comment) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$rideId, $user['id'], $ride['driver_id'], $stars, mb_substr(trim((string)($input['comment'] ?? '')), 0, 1000) ?: null]);
        } catch (PDOException $error) {
            if ((string)$error->getCode() === '23000') throw new ApiError(409, 'This ride has already been rated.');
            throw $error;
        }
        respond(['ok' => true], 201);
    }

    throw new ApiError(404, 'Endpoint not found.');
} catch (ApiError $error) {
    respond(['error' => $error->getMessage(), 'details' => (object)$error->details], $error->status);
} catch (Throwable $error) {
    error_log('PASAKJA API error: ' . $error->getMessage());
    respond(['error' => 'Unexpected server error.'], 500);
}



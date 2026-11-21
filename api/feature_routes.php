<?php
declare(strict_types=1);

// Routes for community alerts, the fare editor, password resets, profile
// photos and place names. index.php calls handleFeatureRoutes() before its
// "not found" reply; each matching route ends by calling respond().
// Uses authenticatedUser(), database(), body(), respond(), requireRole(),
// logAdminActivity(), validPoint() and ApiError from index.php.

require_once __DIR__ . '/features_service.php';
require_once __DIR__ . '/web_push.php';

// ---- Phone notifications. Notices are queued during the request and sent after the answer
// has gone back to the app (see respond() in index.php), so the app never waits on push services.
function pushQueue(?array $add = null, bool $clear = false): array
{
    static $queue = [];
    if ($clear) $queue = [];
    if ($add !== null) $queue[] = $add;
    return $queue;
}

/** Queues a phone notification for every device where the user turned notifications on. */
function queuePush(int $userId, string $title, string $body, string $kind, ?string $tag = null): void
{
    pushQueue(['user_id' => $userId, 'title' => mb_substr($title, 0, 80), 'body' => mb_substr($body, 0, 240), 'kind' => $kind, 'tag' => $tag]);
}

/** Sends the queued notifications; forgets devices the push service says are gone. Never throws. */
function sendQueuedPushes(array $config): void
{
    $queue = pushQueue();
    pushQueue(null, true);
    $settings = webPushSettings($config);
    if (!$queue || !$settings) return;
    try {
        $pdo = database($config);
        $userIds = array_values(array_unique(array_map(static fn(array $item): int => (int)$item['user_id'], $queue)));
        $stmt = $pdo->prepare('SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth_secret, u.role FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id WHERE u.is_active = 1 AND ps.user_id IN (' . implode(', ', array_fill(0, count($userIds), '?')) . ')');
        $stmt->execute($userIds);
        $devices = [];
        foreach ($stmt->fetchAll() as $row) $devices[(int)$row['user_id']][] = $row;
        $gone = [];
        $delivered = [];
        foreach ($queue as $item) {
            $userDevices = $devices[(int)$item['user_id']] ?? [];
            if (!$userDevices) continue;
            $message = ['title' => $item['title'], 'body' => $item['body'], 'url' => pushTargetPath((string)$userDevices[0]['role'], $item['kind']), 'tag' => $item['tag']];
            foreach (webPushSend($userDevices, $message, $settings) as $id => $status) {
                if ($status === 404 || $status === 410) $gone[] = $id;
                elseif ($status >= 200 && $status < 300) $delivered[] = $id;
            }
        }
        if ($gone) $pdo->prepare('DELETE FROM push_subscriptions WHERE id IN (' . implode(', ', array_fill(0, count($gone), '?')) . ')')->execute($gone);
        if ($delivered) $pdo->prepare('UPDATE push_subscriptions SET last_sent_at = CURRENT_TIMESTAMP WHERE id IN (' . implode(', ', array_fill(0, count($delivered), '?')) . ')')->execute($delivered);
    } catch (Throwable $error) {
        error_log('PASAKJA push failed: ' . $error->getMessage());
    }
}

/**
 * Tells drivers near a new booking, so a driver whose app is in the background can open it.
 * Approved, free drivers seen in the last 15 minutes within the dispatch radius who turned
 * notifications on; nearest five.
 */
function queueRideRequestPushes(PDO $pdo, int $rideId): void
{
    $ride = $pdo->prepare('SELECT pickup_label, destination_label, pickup_lat, pickup_lng, estimated_fare FROM rides WHERE id = ?');
    $ride->execute([$rideId]);
    $ride = $ride->fetch();
    if (!$ride || $ride['pickup_lat'] === null) return;
    $drivers = $pdo->query("SELECT dp.user_id, dp.last_lat, dp.last_lng FROM driver_profiles dp JOIN users u ON u.id = dp.user_id
        WHERE dp.verification_status = 'verified' AND u.is_active = 1 AND dp.last_lat IS NOT NULL AND dp.last_seen_at >= CURRENT_TIMESTAMP(3) - INTERVAL 15 MINUTE
          AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = dp.user_id)
          AND NOT EXISTS (SELECT 1 FROM rides busy WHERE busy.driver_id = dp.user_id AND busy.status IN ('accepted', 'arriving', 'in_progress'))")->fetchAll();
    $near = [];
    foreach ($drivers as $driver) {
        $km = dispatchHaversineKm((float)$ride['pickup_lat'], (float)$ride['pickup_lng'], (float)$driver['last_lat'], (float)$driver['last_lng']);
        if ($km <= DISPATCH_RADIUS_KM) $near[(int)$driver['user_id']] = $km;
    }
    asort($near);
    $body = sprintf('%s → %s · %s', $ride['pickup_label'], $ride['destination_label'], pesoAmount((float)$ride['estimated_fare']));
    foreach (array_slice(array_keys($near), 0, 5) as $driverId) {
        queuePush($driverId, 'New ride request near you', $body, 'ride_request', "request-{$rideId}");
    }
}

/** Adds an in-app notice for one user. A failed notice never breaks the ride action that caused it. */
function notifyUser(PDO $pdo, int $userId, string $type, string $title, string $message, ?int $referenceId = null): void
{
    try {
        $pdo->prepare('INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $type, mb_substr($title, 0, 160), mb_substr($message, 0, 500), $referenceId]);
        queuePush($userId, $title, $message, $type, str_starts_with($type, 'ride_') && $referenceId ? "ride-{$referenceId}" : null);
    } catch (PDOException $error) {
        error_log('PASAKJA notification failed: ' . $error->getMessage());
    }
}

// ---- Sign-in limits (auth_attempts). Many phones on mobile data share one public address,
// so the per-address limits are generous; the per-account limits do the real work.
const ATTEMPT_WINDOW = 900; // 15 minutes
const LOGIN_FAILS_PER_ACCOUNT = 5;
const LOGIN_FAILS_PER_ADDRESS = 30;
const PASSWORD_FAILS_PER_ACCOUNT = 5;
const REGISTRATIONS_PER_ADDRESS_PER_HOUR = 20;
const RESET_REQUESTS_PER_ADDRESS_PER_HOUR = 10;

function clientAddress(): string
{
    return mb_substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 45);
}

/** Times (Unix seconds) of failed $kind attempts in the window, for one account (since its last success) or one address. */
function recentFailures(PDO $pdo, string $kind, ?string $identifier, ?string $address): array
{
    $since = time() - ATTEMPT_WINDOW;
    if ($identifier !== null) {
        $stmt = $pdo->prepare("SELECT UNIX_TIMESTAMP(created_at) FROM auth_attempts
            WHERE kind = ? AND identifier = ? AND succeeded = 0 AND created_at > FROM_UNIXTIME(?)
              AND created_at > COALESCE((SELECT MAX(ok.created_at) FROM auth_attempts ok WHERE ok.kind = ? AND ok.identifier = ? AND ok.succeeded = 1), FROM_UNIXTIME(0))");
        $stmt->execute([$kind, $identifier, $since, $kind, $identifier]);
    } else {
        $stmt = $pdo->prepare('SELECT UNIX_TIMESTAMP(created_at) FROM auth_attempts WHERE kind = ? AND ip = ? AND succeeded = 0 AND created_at > FROM_UNIXTIME(?)');
        $stmt->execute([$kind, $address, $since]);
    }
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/** Refuses with 429 when this account or this address has failed too often recently. */
function guardAttempts(PDO $pdo, string $kind, string $identifier, int $perAccount, int $perAddress): void
{
    $now = time();
    $wait = max(
        attemptWaitSeconds(recentFailures($pdo, $kind, $identifier, null), $now, $perAccount, ATTEMPT_WINDOW),
        attemptWaitSeconds(recentFailures($pdo, $kind, null, clientAddress()), $now, $perAddress, ATTEMPT_WINDOW),
    );
    if ($wait > 0) {
        header('Retry-After: ' . $wait);
        throw new ApiError(429, 'Too many wrong attempts. For your security, try again in ' . waitText($wait) . '.');
    }
}

function recordAttempt(PDO $pdo, string $kind, string $identifier, bool $succeeded): void
{
    $pdo->prepare('INSERT INTO auth_attempts (kind, identifier, ip, succeeded) VALUES (?, ?, ?, ?)')
        ->execute([$kind, $identifier, clientAddress(), $succeeded ? 1 : 0]);
    if (random_int(1, 50) === 1) $pdo->exec('DELETE FROM auth_attempts WHERE created_at < CURRENT_TIMESTAMP - INTERVAL 1 DAY');
}

/** Refuses with 429 when this address already did $limit $kind actions in the last hour (sign-ups, reset requests). */
function guardHourlyActions(PDO $pdo, string $kind, int $limit, string $message): void
{
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM auth_attempts WHERE kind = ? AND ip = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL 1 HOUR');
    $stmt->execute([$kind, clientAddress()]);
    if ((int)$stmt->fetchColumn() >= $limit) {
        header('Retry-After: 3600');
        throw new ApiError(429, $message);
    }
}

// ---- Map lookups. The free OpenStreetMap services allow about one request per second
// from the whole app, so each is gated globally, and each user gets 60 lookups a minute.
const LOOKUPS_PER_USER_PER_MINUTE = 60;

/** True when no $service call was made by anyone in the current second; records this one. */
function claimExternalSlot(PDO $pdo, string $service): bool
{
    // A named lock makes "check, then record" one step, so two requests at the same moment
    // can't both claim the second. Whoever doesn't get the lock waits for the next slot.
    $lockName = 'pasakja-' . $service;
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 0)');
    $lock->execute([$lockName]);
    if ((int)$lock->fetchColumn() !== 1) return false;
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM auth_attempts WHERE kind = ? AND identifier = 'all' AND created_at >= CURRENT_TIMESTAMP - INTERVAL 1 SECOND");
        $stmt->execute([$service]);
        if ((int)$stmt->fetchColumn() > 0) return false;
        recordAttempt($pdo, $service, 'all', true);
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$lockName]);
    }
    if (random_int(1, 100) === 1) {
        $pdo->exec('DELETE FROM route_cache WHERE expires_at < CURRENT_TIMESTAMP');
        $pdo->exec('DELETE FROM place_name_cache WHERE expires_at < CURRENT_TIMESTAMP');
    }
    return true;
}

/** Refuses with 429 after LOOKUPS_PER_USER_PER_MINUTE route or place lookups in a minute; records this one. */
function guardLookups(PDO $pdo, int $userId): void
{
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM auth_attempts WHERE kind = 'lookup' AND identifier = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL 1 MINUTE");
    $stmt->execute(["user:{$userId}"]);
    if ((int)$stmt->fetchColumn() >= LOOKUPS_PER_USER_PER_MINUTE) {
        header('Retry-After: 60');
        throw new ApiError(429, 'Too many map lookups. Wait a minute and try again.');
    }
    recordAttempt($pdo, 'lookup', "user:{$userId}", true);
}

/** Checks the user's current password, counting wrong guesses toward the password limit. */
function verifyCurrentPassword(PDO $pdo, int $userId, string $password, string $hash): bool
{
    $key = "user:{$userId}";
    guardAttempts($pdo, 'password', $key, PASSWORD_FAILS_PER_ACCOUNT, LOGIN_FAILS_PER_ADDRESS);
    $ok = $password !== '' && password_verify($password, $hash);
    recordAttempt($pdo, 'password', $key, $ok);
    return $ok;
}

/** Sends the same notice to every active admin. */
function notifyAdmins(PDO $pdo, string $type, string $title, string $message, ?int $referenceId = null): void
{
    foreach ($pdo->query("SELECT id FROM users WHERE role = 'admin' AND is_active = 1")->fetchAll(PDO::FETCH_COLUMN) as $adminId) {
        notifyUser($pdo, (int)$adminId, $type, $title, $message, $referenceId);
    }
}

/** The home town and profile photo, which authenticatedUser() leaves out to keep every request light. */
function userProfileExtras(PDO $pdo, int $userId): array
{
    $stmt = $pdo->prepare('SELECT municipality, avatar_data FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: ['municipality' => null, 'avatar_data' => null];
}

/** Columns for the admin Accounts list: who the user is, their status and completed rides. */
const ADMIN_ACCOUNT_SELECT = "SELECT u.id, u.full_name, u.phone, u.email, u.role, u.municipality, u.is_active, u.suspended_at, u.suspension_reason, u.created_at,
        dp.verification_status,
        (SELECT COUNT(*) FROM rides r WHERE (r.passenger_id = u.id OR r.driver_id = u.id) AND r.status = 'completed') AS completed_rides
    FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id";

function adminAccountRow(PDO $pdo, int $userId): ?array
{
    $stmt = $pdo->prepare(ADMIN_ACCOUNT_SELECT . ' WHERE u.id = ?');
    $stmt->execute([$userId]);
    return $stmt->fetch() ?: null;
}

function adminAccountPayload(array $row): array
{
    return [
        'id' => (int)$row['id'],
        'name' => $row['full_name'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'role' => $row['role'],
        'municipality' => $row['municipality'],
        'status' => (int)$row['is_active'] ? 'active' : 'suspended',
        'suspended_at' => $row['suspended_at'],
        'suspension_reason' => $row['suspension_reason'],
        'driver_status' => $row['verification_status'],
        'completed_rides' => (int)$row['completed_rides'],
        'created_at' => $row['created_at'],
    ];
}

function routeId(string $segment): int
{
    $id = filter_var($segment, FILTER_VALIDATE_INT);
    if (!$id || $id < 1) throw new ApiError(404, 'Not found.');
    return (int)$id;
}

function adminFaresPayload(PDO $pdo): array
{
    $towns = $pdo->query("SELECT municipality, base_fare, included_km, per_km_rate, special_trip_multiplier, is_placeholder, updated_at FROM municipality_fares ORDER BY FIELD(municipality, 'Carrascal', 'Cantilan', 'Madrid', 'Carmen', 'Lanuza')")->fetchAll();
    $pairs = $pdo->query('SELECT origin_municipality, destination_municipality, fixed_fare, is_placeholder, updated_at FROM intertown_fares')->fetchAll();
    $settings = $pdo->query('SELECT student_discount_percent, senior_discount_percent, pwd_discount_percent FROM fare_settings WHERE id = 1')->fetch() ?: [];
    $number = static fn($value): float => round((float)$value, 2);
    return [
        'municipalities' => array_map(static fn(array $row): array => [
            'municipality' => $row['municipality'],
            'base_fare' => $number($row['base_fare']),
            'included_km' => $number($row['included_km']),
            'per_km_rate' => $number($row['per_km_rate']),
            'special_trip_multiplier' => $number($row['special_trip_multiplier']),
            'is_placeholder' => (bool)(int)$row['is_placeholder'],
            'updated_at' => $row['updated_at'],
        ], $towns),
        'intertown' => array_map(static fn(array $row): array => [
            'origin' => $row['origin_municipality'],
            'destination' => $row['destination_municipality'],
            'fixed_fare' => $number($row['fixed_fare']),
            'is_placeholder' => (bool)(int)$row['is_placeholder'],
            'updated_at' => $row['updated_at'],
        ], $pairs),
        'discounts' => [
            'student' => $number($settings['student_discount_percent'] ?? 20),
            'senior' => $number($settings['senior_discount_percent'] ?? 20),
            'pwd' => $number($settings['pwd_discount_percent'] ?? 20),
        ],
    ];
}

function handleFeatureRoutes(array $segments, string $method, array $config): void
{
    // ---- Forgot password: record a request for an admin. Same reply whether or not the account exists.
    if ($segments === ['auth', 'forgot'] && $method === 'POST') {
        $identifier = trim((string)(body()['identifier'] ?? ''));
        if ($identifier === '') throw new ApiError(422, 'Enter the phone number or email on your account.');
        $pdo = database($config);
        guardHourlyActions($pdo, 'forgot', RESET_REQUESTS_PER_ADDRESS_PER_HOUR, 'Too many reset requests from this network. Try again in an hour.');
        recordAttempt($pdo, 'forgot', attemptIdentifier($identifier), true);
        $stmt = $pdo->prepare('SELECT id, full_name, phone, role FROM users WHERE (phone = :identifier OR phone = :normalized OR email = :email) AND is_active = 1 LIMIT 1');
        $stmt->execute(['identifier' => preg_replace('/\s+/', '', $identifier), 'normalized' => normalizePhilippinePhone($identifier), 'email' => strtolower($identifier)]);
        $account = $stmt->fetch();
        if ($account) {
            $recent = $pdo->prepare('SELECT COUNT(*) FROM password_reset_requests WHERE user_id = ? AND requested_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 DAY)');
            $recent->execute([$account['id']]);
            if ((int)$recent->fetchColumn() < 3) {
                $pdo->prepare('INSERT INTO password_reset_requests (user_id) VALUES (?)')->execute([$account['id']]);
                notifyAdmins($pdo, 'password_reset', 'Password reset request', "{$account['full_name']} ({$account['phone']}, {$account['role']}) asked to reset their password.", (int)$pdo->lastInsertId());
            }
        }
        respond(['ok' => true, 'message' => 'If that matches an account, a PASAKJA admin will contact you with a temporary password.'], 202);
    }

    // ---- Change password (also how a user replaces a temporary password).
    if ($segments === ['auth', 'password'] && $method === 'POST') {
        $user = authenticatedUser($config);
        $input = body();
        $current = (string)($input['current_password'] ?? '');
        $next = (string)($input['new_password'] ?? '');
        if (strlen($next) < 8) throw new ApiError(422, 'Your new password must be at least 8 characters.', ['new_password' => 'At least 8 characters.']);
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        if (!verifyCurrentPassword($pdo, $user['id'], $current, (string)$stmt->fetchColumn())) throw new ApiError(422, 'Your current password is incorrect.', ['current_password' => 'Incorrect password.']);
        if ($next === $current) throw new ApiError(422, 'Choose a password different from your current one.', ['new_password' => 'Use a different password.']);
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
        // Sign out other devices; keep this one signed in.
        $pdo->prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL')->execute([$user['id'], $user['token_id']]);
        respond(['ok' => true]);
    }

    // ---- Edit profile: name, phone, email and home town. The phone and email are what the
    // user signs in with, so changing either needs the current password.
    if ($segments === ['me'] && $method === 'PATCH') {
        $user = authenticatedUser($config);
        $input = body();
        [$details, $errors] = validateAccountDetails($input);
        if ($errors) throw new ApiError(422, 'Please correct the highlighted fields.', $errors);
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT u.full_name, u.phone, u.email, u.municipality, u.avatar_data, u.password_hash, dp.verification_status FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?');
        $stmt->execute([$user['id']]);
        $current = $stmt->fetch();
        // An approved driver's name was checked against their license, so a new name goes back to review.
        $reviewRequired = $current['verification_status'] === 'verified' && $details['name'] !== $current['full_name'];
        // 0917…, 917… and +63917… are the same number: keep the stored one unless the number itself changed.
        $phoneChanged = normalizePhilippinePhone((string)$current['phone']) !== $details['phone'];
        $phone = $phoneChanged ? $details['phone'] : (string)$current['phone'];
        $emailChanged = strtolower((string)($current['email'] ?? '')) !== (string)($details['email'] ?? '');
        // Admins have no home town field; leave it alone when the form doesn't send one.
        $town = array_key_exists('municipality', $input) ? $details['municipality'] : $current['municipality'];
        if ($phoneChanged || $emailChanged) {
            $password = is_string($input['current_password'] ?? null) ? $input['current_password'] : '';
            if ($password === '') throw new ApiError(422, 'Enter your current password to change your phone number or email.', ['current_password' => 'Enter your current password.']);
            if (!verifyCurrentPassword($pdo, $user['id'], $password, (string)$current['password_hash'])) throw new ApiError(422, 'Your current password is incorrect.', ['current_password' => 'Incorrect password.']);
        }
        if ($phoneChanged) {
            $variants = phoneVariants($phone);
            $taken = $pdo->prepare('SELECT COUNT(*) FROM users WHERE id <> ? AND phone IN (' . implode(', ', array_fill(0, count($variants), '?')) . ')');
            $taken->execute([$user['id'], ...$variants]);
            if ((int)$taken->fetchColumn() > 0) throw new ApiError(409, 'That phone number is already used by another account.', ['phone' => 'Already used by another account.']);
        }
        if ($emailChanged && $details['email'] !== null) {
            $taken = $pdo->prepare('SELECT COUNT(*) FROM users WHERE id <> ? AND email = ?');
            $taken->execute([$user['id'], $details['email']]);
            if ((int)$taken->fetchColumn() > 0) throw new ApiError(409, 'That email is already used by another account.', ['email' => 'Already used by another account.']);
        }
        try {
            $pdo->prepare('UPDATE users SET full_name = ?, phone = ?, email = ?, municipality = ? WHERE id = ?')
                ->execute([$details['name'], $phone, $details['email'], $town, $user['id']]);
        } catch (PDOException $error) {
            if ((string)$error->getCode() === '23000') throw new ApiError(409, 'That phone number or email is already used by another account.');
            throw $error;
        }
        if ($reviewRequired) {
            $pdo->prepare("UPDATE driver_profiles SET verification_status = 'pending' WHERE user_id = ?")->execute([$user['id']]);
            notifyAdmins($pdo, 'driver_renamed', 'Driver changed their name', sprintf('%s (was %s) changed the name on an approved driver account. Check it against their license in Dashboard → Drivers.', $details['name'], $current['full_name']), $user['id']);
        }
        respond(['user' => publicUser(['id' => $user['id'], 'full_name' => $details['name'], 'phone' => $phone, 'email' => $details['email'], 'role' => $user['role'], 'municipality' => $town, 'avatar_data' => $current['avatar_data']]), 'review_required' => $reviewRequired]);
    }

    // ---- Phone notifications (Web Push).
    if ($segments === ['push', 'config'] && $method === 'GET') {
        authenticatedUser($config);
        $settings = webPushSettings($config);
        respond(['enabled' => $settings !== null, 'public_key' => $settings['public_key'] ?? null]);
    }
    if ($segments === ['push', 'subscription'] && $method === 'PUT') {
        $user = authenticatedUser($config);
        if (!webPushSettings($config)) throw new ApiError(503, 'Notifications aren’t set up on this server yet.');
        try {
            [$endpoint, $p256dh, $auth] = validatedPushSubscription(body());
        } catch (InvalidArgumentException $error) {
            throw new ApiError(422, $error->getMessage());
        }
        $pdo = database($config);
        $pdo->prepare('INSERT INTO push_subscriptions (user_id, endpoint, endpoint_hash, p256dh, auth_secret) VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), endpoint = VALUES(endpoint), p256dh = VALUES(p256dh), auth_secret = VALUES(auth_secret)')
            ->execute([$user['id'], $endpoint, hash('sha256', $endpoint), $p256dh, $auth]);
        // Keep the five newest devices per account.
        $pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 5) newest)')
            ->execute([$user['id'], $user['id']]);
        respond(['ok' => true]);
    }
    if ($segments === ['push', 'subscription'] && $method === 'DELETE') {
        $user = authenticatedUser($config);
        $endpoint = body()['endpoint'] ?? '';
        if (is_string($endpoint) && $endpoint !== '') {
            database($config)->prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint_hash = ?')->execute([$user['id'], hash('sha256', $endpoint)]);
        }
        respond(['ok' => true]);
    }
    if ($segments === ['push', 'test'] && $method === 'POST') {
        $user = authenticatedUser($config);
        $settings = webPushSettings($config);
        if (!$settings) throw new ApiError(503, 'Notifications aren’t set up on this server yet.');
        $pdo = database($config);
        $recent = $pdo->prepare("SELECT COUNT(*) FROM auth_attempts WHERE kind = 'push_test' AND identifier = ? AND created_at > CURRENT_TIMESTAMP - INTERVAL 1 HOUR");
        $recent->execute(["user:{$user['id']}"]);
        if ((int)$recent->fetchColumn() >= 10) throw new ApiError(429, 'You sent several test notifications already. Try again later.');
        recordAttempt($pdo, 'push_test', "user:{$user['id']}", true);
        $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth_secret FROM push_subscriptions WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        $devices = $stmt->fetchAll();
        if (!$devices) throw new ApiError(409, 'Turn on notifications on this device first.');
        $results = webPushSend($devices, ['title' => 'Notifications are on', 'body' => 'PASAKJA can now reach you here, even when the app is closed.', 'url' => pushTargetPath($user['role'], 'notice'), 'tag' => 'push-test'], $settings, 300);
        $gone = array_keys(array_filter($results, static fn(int $status): bool => $status === 404 || $status === 410));
        if ($gone) $pdo->prepare('DELETE FROM push_subscriptions WHERE id IN (' . implode(', ', array_fill(0, count($gone), '?')) . ')')->execute($gone);
        respond(['devices' => count($results), 'sent' => count(array_filter($results, static fn(int $status): bool => $status >= 200 && $status < 300)), 'statuses' => array_values($results)]);
    }

    // ---- Delete my account. Personal details are erased; ride records stay without a name,
    // because the other person in each ride and the TODA still need them.
    if ($segments === ['me'] && $method === 'DELETE') {
        $user = authenticatedUser($config);
        if ($user['role'] === 'admin') throw new ApiError(403, 'Admin accounts can’t be deleted from the app.');
        $input = body();
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        if (!verifyCurrentPassword($pdo, $user['id'], $password, (string)$stmt->fetchColumn())) throw new ApiError(422, 'Your password is incorrect.', ['password' => 'Incorrect password.']);
        $busy = $pdo->prepare("SELECT COUNT(*) FROM rides WHERE (passenger_id = ? OR driver_id = ?) AND status IN ('accepted', 'arriving', 'in_progress')");
        $busy->execute([$user['id'], $user['id']]);
        if ((int)$busy->fetchColumn() > 0) throw new ApiError(409, 'You are on a ride right now. Delete your account after the ride ends.');
        $pdo->beginTransaction();
        try {
            $open = $pdo->prepare("SELECT id FROM rides WHERE passenger_id = ? AND status = 'finding'");
            $open->execute([$user['id']]);
            foreach ($open->fetchAll(PDO::FETCH_COLUMN) as $openRideId) {
                $pdo->prepare("UPDATE rides SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'finding'")->execute([$openRideId]);
                logRideEvent($pdo, (int)$openRideId, $user['id'], 'cancelled', 'Cancelled because the passenger deleted their account.');
                revokeRideShares($pdo, (int)$openRideId);
            }
            $pdo->prepare("UPDATE users SET full_name = 'Deleted user', phone = CONCAT('deleted-', id), email = NULL, municipality = NULL, avatar_data = NULL,
                    password_hash = ?, is_active = 0, suspended_at = NULL, suspension_reason = NULL, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT), $user['id']]);
            $pdo->prepare("UPDATE driver_profiles SET license_number = '', id_photo_data = NULL, id_photo_uploaded_at = NULL, last_lat = NULL, last_lng = NULL, last_heading = NULL, last_accuracy = NULL, last_seen_at = NULL, verification_status = 'rejected' WHERE user_id = ?")->execute([$user['id']]);
            foreach (['DELETE FROM driver_locations WHERE driver_id = ?', 'DELETE FROM notifications WHERE user_id = ?', 'DELETE FROM password_reset_requests WHERE user_id = ?', 'DELETE FROM push_subscriptions WHERE user_id = ?', 'DELETE FROM api_tokens WHERE user_id = ?'] as $erase) {
                $pdo->prepare($erase)->execute([$user['id']]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(['ok' => true]);
    }

    // ---- Profile photo.
    if ($segments === ['me', 'avatar'] && $method === 'PUT') {
        $user = authenticatedUser($config);
        try {
            $avatar = validatedAvatarDataUrl((string)(body()['image'] ?? ''));
        } catch (InvalidArgumentException $error) {
            throw new ApiError(422, $error->getMessage());
        }
        database($config)->prepare('UPDATE users SET avatar_data = ? WHERE id = ?')->execute([$avatar, $user['id']]);
        respond(['avatar' => $avatar]);
    }
    if ($segments === ['me', 'avatar'] && $method === 'DELETE') {
        $user = authenticatedUser($config);
        database($config)->prepare('UPDATE users SET avatar_data = NULL WHERE id = ?')->execute([$user['id']]);
        respond(['avatar' => null]);
    }

    // ---- Driver ID photo: admins view it before approving; drivers upload or replace it.
    if (count($segments) === 4 && $segments[0] === 'admin' && $segments[1] === 'drivers' && $segments[3] === 'id-photo' && $method === 'GET') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        $driverId = routeId($segments[2]);
        $pdo = database($config);
        $stmt = $pdo->prepare('SELECT id_photo_data, id_photo_uploaded_at FROM driver_profiles WHERE user_id = ?');
        $stmt->execute([$driverId]);
        $row = $stmt->fetch();
        if (!$row) throw new ApiError(404, 'Driver not found.');
        if ($row['id_photo_data'] === null) throw new ApiError(404, 'This driver has not uploaded an ID photo yet.');
        // IDs are personal data, so every view is recorded.
        logAdminActivity($pdo, $admin['id'], 'driver.id_photo_viewed', 'driver', $driverId);
        respond(['photo' => $row['id_photo_data'], 'uploaded_at' => $row['id_photo_uploaded_at']]);
    }
    if ($segments === ['driver', 'id-photo'] && $method === 'PUT') {
        $user = authenticatedUser($config);
        requireRole($user, 'driver');
        try {
            $photo = validatedIdPhotoDataUrl((string)(body()['image'] ?? ''));
        } catch (InvalidArgumentException $error) {
            throw new ApiError(422, $error->getMessage());
        }
        $pdo = database($config);
        $current = $pdo->prepare('SELECT verification_status, plate_number, (id_photo_uploaded_at > CURRENT_TIMESTAMP - INTERVAL 5 MINUTE) AS uploaded_recently FROM driver_profiles WHERE user_id = ?');
        $current->execute([$user['id']]);
        $profile = $current->fetch();
        if (!$profile) throw new ApiError(404, 'Driver profile not found.');
        if ($profile['verification_status'] === 'verified') throw new ApiError(409, 'Your account is already verified. Ask an admin if your ID needs to be updated.');
        if ((int)$profile['uploaded_recently'] === 1) throw new ApiError(429, 'You sent a photo a moment ago. Wait a few minutes before sending another.');
        // A rejected driver who sends a new ID goes back into the review queue.
        $pdo->prepare("UPDATE driver_profiles SET id_photo_data = ?, id_photo_uploaded_at = CURRENT_TIMESTAMP, verification_status = 'pending' WHERE user_id = ?")->execute([$photo, $user['id']]);
        notifyAdmins($pdo, 'driver_id_uploaded', 'Driver ID uploaded', "{$user['full_name']} (plate {$profile['plate_number']}) uploaded an ID photo for review.", $user['id']);
        respond(['verification_status' => 'pending', 'has_id_photo' => true]);
    }

    // ---- Alerts feed: community notices for the user's town plus their own notices.
    if ($segments === ['alerts'] && $method === 'GET') {
        $user = authenticatedUser($config);
        $pdo = database($config);
        $town = $user['role'] === 'admin' ? null : userProfileExtras($pdo, $user['id'])['municipality'];
        $community = $pdo->prepare('SELECT id, municipality, type, title, message, created_at FROM community_alerts WHERE removed_at IS NULL AND (municipality IS NULL OR :anyTown IS NULL OR municipality = :town) ORDER BY created_at DESC, id DESC LIMIT 50');
        $community->execute(['anyTown' => $town, 'town' => $town]);
        $own = $pdo->prepare('SELECT id, type, title, message, reference_id, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50');
        $own->execute([$user['id']]);
        $items = [];
        foreach ($community->fetchAll() as $row) $items[] = ['key' => 'c' . $row['id'], 'kind' => 'community', 'type' => $row['type'], 'title' => $row['title'], 'message' => $row['message'], 'municipality' => $row['municipality'], 'reference_id' => null, 'created_at' => $row['created_at']];
        foreach ($own->fetchAll() as $row) $items[] = ['key' => 'n' . $row['id'], 'kind' => 'notification', 'type' => $row['type'], 'title' => $row['title'], 'message' => $row['message'], 'municipality' => null, 'reference_id' => $row['reference_id'] === null ? null : (int)$row['reference_id'], 'created_at' => $row['created_at']];
        usort($items, static fn(array $a, array $b): int => strcmp((string)$b['created_at'], (string)$a['created_at']));
        respond(['items' => array_slice($items, 0, 60), 'municipality' => $town]);
    }

    // ---- Admin: passenger and driver accounts, with suspend and reactivate.
    if ($segments === ['admin', 'accounts'] && $method === 'GET') {
        requireRole(authenticatedUser($config), 'admin');
        $rows = database($config)->query(ADMIN_ACCOUNT_SELECT . " WHERE u.role IN ('passenger', 'driver') AND u.deleted_at IS NULL ORDER BY u.is_active ASC, u.created_at DESC, u.id DESC LIMIT 2000")->fetchAll();
        respond(['accounts' => array_map('adminAccountPayload', $rows)]);
    }
    if (count($segments) === 4 && $segments[0] === 'admin' && $segments[1] === 'accounts' && in_array($segments[3], ['suspend', 'reactivate'], true) && $method === 'POST') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        $accountId = routeId($segments[2]);
        $pdo = database($config);
        $account = adminAccountRow($pdo, $accountId);
        if (!$account || !in_array($account['role'], ['passenger', 'driver'], true)) throw new ApiError(404, 'Account not found.');

        if ($segments[3] === 'suspend') {
            if (!(int)$account['is_active']) throw new ApiError(409, 'This account is already suspended.');
            try {
                $reason = validatedSuspensionReason((string)(body()['reason'] ?? ''));
            } catch (InvalidArgumentException $error) {
                throw new ApiError(422, $error->getMessage(), ['reason' => $error->getMessage()]);
            }
            // Ending a ride halfway would leave the other person stranded in the app.
            $busy = $pdo->prepare("SELECT COUNT(*) FROM rides WHERE (passenger_id = ? OR driver_id = ?) AND status IN ('accepted', 'arriving', 'in_progress')");
            $busy->execute([$accountId, $accountId]);
            if ((int)$busy->fetchColumn() > 0) throw new ApiError(409, 'This user is on a ride right now. Suspend the account after the ride ends or is cancelled.');
            $pdo->beginTransaction();
            try {
                // Bookings still looking for a driver are cancelled with the account.
                $open = $pdo->prepare("SELECT id FROM rides WHERE passenger_id = ? AND status = 'finding'");
                $open->execute([$accountId]);
                foreach ($open->fetchAll(PDO::FETCH_COLUMN) as $openRideId) {
                    $pdo->prepare("UPDATE rides SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'finding'")->execute([$openRideId]);
                    logRideEvent($pdo, (int)$openRideId, $admin['id'], 'cancelled', 'Cancelled because the passenger account was suspended.');
                    revokeRideShares($pdo, (int)$openRideId);
                }
                $pdo->prepare('UPDATE users SET is_active = 0, suspended_at = CURRENT_TIMESTAMP, suspension_reason = ? WHERE id = ?')->execute([$reason, $accountId]);
                // Signs the user out everywhere; a driver also stops getting ride requests.
                $pdo->prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL')->execute([$accountId]);
                logAdminActivity($pdo, $admin['id'], 'account.suspended', 'user', $accountId, ['role' => $account['role'], 'reason' => $reason]);
                $pdo->commit();
            } catch (Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $error;
            }
        } else {
            if ((int)$account['is_active']) throw new ApiError(409, 'This account is already active.');
            $pdo->prepare('UPDATE users SET is_active = 1, suspended_at = NULL, suspension_reason = NULL WHERE id = ?')->execute([$accountId]);
            logAdminActivity($pdo, $admin['id'], 'account.reactivated', 'user', $accountId, ['role' => $account['role']]);
            notifyUser($pdo, $accountId, 'account_reactivated', 'Your account is active again', 'A PASAKJA admin reactivated your account. You can book or accept rides again.');
        }
        respond(['account' => adminAccountPayload(adminAccountRow($pdo, $accountId))]);
    }

    // ---- Admin: community alerts.
    if ($segments === ['admin', 'alerts'] && $method === 'GET') {
        requireRole(authenticatedUser($config), 'admin');
        $rows = database($config)->query('SELECT a.id, a.municipality, a.type, a.title, a.message, a.created_at, u.full_name AS author FROM community_alerts a LEFT JOIN users u ON u.id = a.created_by WHERE a.removed_at IS NULL ORDER BY a.created_at DESC, a.id DESC LIMIT 50')->fetchAll();
        respond(['alerts' => array_map(static fn(array $row): array => ['id' => (int)$row['id']] + $row, $rows)]);
    }
    if ($segments === ['admin', 'alerts'] && $method === 'POST') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        [$alert, $errors] = validateAlertInput(body());
        if ($errors) throw new ApiError(422, 'Please correct the alert.', $errors);
        $pdo = database($config);
        $pdo->prepare('INSERT INTO community_alerts (municipality, type, title, message, created_by) VALUES (?, ?, ?, ?, ?)')
            ->execute([$alert['municipality'], $alert['type'], $alert['title'], $alert['message'], $user['id']]);
        $id = (int)$pdo->lastInsertId();
        logAdminActivity($pdo, $user['id'], 'alert.published', 'community_alert', $id, ['municipality' => $alert['municipality'] ?? 'all', 'type' => $alert['type']]);
        respond(['alert' => ['id' => $id, 'author' => $user['full_name'], 'created_at' => date('Y-m-d H:i:s')] + $alert], 201);
    }
    if (count($segments) === 3 && $segments[0] === 'admin' && $segments[1] === 'alerts' && $method === 'DELETE') {
        $user = authenticatedUser($config);
        requireRole($user, 'admin');
        $id = routeId($segments[2]);
        $pdo = database($config);
        $stmt = $pdo->prepare('UPDATE community_alerts SET removed_at = CURRENT_TIMESTAMP WHERE id = ? AND removed_at IS NULL');
        $stmt->execute([$id]);
        if ($stmt->rowCount() !== 1) throw new ApiError(404, 'That alert was already removed.');
        logAdminActivity($pdo, $user['id'], 'alert.removed', 'community_alert', $id);
        respond(['ok' => true]);
    }

    // ---- Admin: password reset requests.
    if ($segments === ['admin', 'password-resets'] && $method === 'GET') {
        requireRole(authenticatedUser($config), 'admin');
        $rows = database($config)->query("SELECT r.id, r.requested_at, u.id AS user_id, u.full_name, u.phone, u.email, u.role FROM password_reset_requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' ORDER BY r.requested_at ASC LIMIT 50")->fetchAll();
        respond(['requests' => array_map(static fn(array $row): array => ['id' => (int)$row['id'], 'user_id' => (int)$row['user_id']] + $row, $rows)]);
    }
    if (count($segments) === 4 && $segments[0] === 'admin' && $segments[1] === 'password-resets' && in_array($segments[3], ['resolve', 'dismiss'], true) && $method === 'POST') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        $id = routeId($segments[2]);
        $pdo = database($config);
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT r.id, r.user_id, u.full_name, u.phone FROM password_reset_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ? AND r.status = 'pending' FOR UPDATE");
            $stmt->execute([$id]);
            $request = $stmt->fetch();
            if (!$request) throw new ApiError(409, 'This request was already handled.');
            $status = $segments[3] === 'resolve' ? 'resolved' : 'dismissed';
            $temporary = null;
            if ($status === 'resolved') {
                $temporary = generateTemporaryPassword();
                $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($temporary, PASSWORD_DEFAULT), $request['user_id']]);
                // The old password no longer works, so sign the account out everywhere.
                $pdo->prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL')->execute([$request['user_id']]);
            }
            // One answer covers every open request from the same person.
            $pdo->prepare("UPDATE password_reset_requests SET status = ?, resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE user_id = ? AND status = 'pending'")
                ->execute([$status, $admin['id'], $request['user_id']]);
            logAdminActivity($pdo, $admin['id'], "password_reset.$status", 'user', (int)$request['user_id']);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
        respond(['status' => $status, 'temporary_password' => $temporary, 'user' => ['name' => $request['full_name'], 'phone' => $request['phone']]]);
    }

    // ---- Admin: fares.
    if ($segments === ['admin', 'fares'] && $method === 'GET') {
        requireRole(authenticatedUser($config), 'admin');
        respond(adminFaresPayload(database($config)));
    }
    if (count($segments) === 4 && $segments[0] === 'admin' && $segments[1] === 'fares' && $segments[2] === 'municipalities' && $method === 'PUT') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        $town = canonicalTown(rawurldecode($segments[3]));
        if ($town === null) throw new ApiError(404, 'Unknown town.');
        [$rule, $errors] = validateMunicipalityFareInput(body());
        if ($errors) throw new ApiError(422, 'Please correct the fare.', $errors);
        $pdo = database($config);
        $pdo->prepare('INSERT INTO municipality_fares (municipality, base_fare, included_km, per_km_rate, special_trip_multiplier, is_placeholder) VALUES (?, ?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE base_fare = VALUES(base_fare), included_km = VALUES(included_km), per_km_rate = VALUES(per_km_rate), special_trip_multiplier = VALUES(special_trip_multiplier), is_placeholder = 0')
            ->execute([$town, $rule['base_fare'], $rule['included_km'], $rule['per_km_rate'], $rule['special_trip_multiplier']]);
        logAdminActivity($pdo, $admin['id'], 'fare.municipality_updated', 'municipality_fare', null, ['municipality' => $town] + $rule);
        respond(adminFaresPayload($pdo));
    }
    if ($segments === ['admin', 'fares', 'intertown'] && $method === 'PUT') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        [$pair, $errors] = validateIntertownFareInput(body());
        if ($errors) throw new ApiError(422, 'Please correct the fare.', $errors);
        $pdo = database($config);
        // Fares apply both ways, so update whichever direction is already stored.
        $existing = $pdo->prepare('SELECT origin_municipality, destination_municipality FROM intertown_fares WHERE (origin_municipality = ? AND destination_municipality = ?) OR (origin_municipality = ? AND destination_municipality = ?) LIMIT 1');
        $existing->execute([$pair['origin'], $pair['destination'], $pair['destination'], $pair['origin']]);
        $row = $existing->fetch();
        [$origin, $destination] = $row ? [$row['origin_municipality'], $row['destination_municipality']] : [$pair['origin'], $pair['destination']];
        $pdo->prepare('INSERT INTO intertown_fares (origin_municipality, destination_municipality, fixed_fare, is_placeholder) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE fixed_fare = VALUES(fixed_fare), is_placeholder = 0')
            ->execute([$origin, $destination, $pair['fixed_fare']]);
        logAdminActivity($pdo, $admin['id'], 'fare.intertown_updated', 'intertown_fare', null, ['origin' => $origin, 'destination' => $destination, 'fixed_fare' => $pair['fixed_fare']]);
        respond(adminFaresPayload($pdo));
    }
    if ($segments === ['admin', 'fares', 'discounts'] && $method === 'PUT') {
        $admin = authenticatedUser($config);
        requireRole($admin, 'admin');
        [$discounts, $errors] = validateDiscountInput(body());
        if ($errors) throw new ApiError(422, 'Please correct the discounts.', $errors);
        $pdo = database($config);
        $pdo->prepare('UPDATE fare_settings SET student_discount_percent = ?, senior_discount_percent = ?, pwd_discount_percent = ? WHERE id = 1')
            ->execute([$discounts['student'], $discounts['senior'], $discounts['pwd']]);
        logAdminActivity($pdo, $admin['id'], 'fare.discounts_updated', 'fare_settings', 1, $discounts);
        respond(adminFaresPayload($pdo));
    }

    // ---- Place name for a map pin (OpenStreetMap Nominatim, cached).
    if ($segments === ['places', 'reverse'] && $method === 'GET') {
        $user = authenticatedUser($config);
        $lat = $_GET['lat'] ?? null;
        $lng = $_GET['lng'] ?? null;
        if (!validPoint($lat, $lng, $config)) throw new ApiError(422, 'That point is outside the PASAKJA service area.');
        $lat = round((float)$lat, 4);
        $lng = round((float)$lng, 4);
        $pdo = database($config);
        $key = hash('sha256', "$lat,$lng");
        $cached = $pdo->prepare('SELECT label FROM place_name_cache WHERE cache_key = ? AND expires_at > CURRENT_TIMESTAMP');
        $cached->execute([$key]);
        $hit = $cached->fetch();
        if ($hit) respond(['label' => $hit['label']]);
        guardLookups($pdo, $user['id']);
        // Someone else asked Nominatim this second: the app retries once shortly after.
        if (!claimExternalSlot($pdo, 'nominatim')) respond(['label' => null, 'retry' => true]);

        $base = rtrim((string)($config['nominatim_base_url'] ?? 'https://nominatim.openstreetmap.org'), '/');
        $curl = curl_init($base . '/reverse?' . http_build_query(['format' => 'jsonv2', 'lat' => $lat, 'lon' => $lng, 'zoom' => 18, 'addressdetails' => 1, 'accept-language' => 'en']));
        // IPv4 avoids slow first connections on some networks; OpenStreetMap can take a few seconds when busy.
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT_MS => 3000, CURLOPT_TIMEOUT_MS => 6000, CURLOPT_IPRESOLVE => CURL_IPRESOLVE_V4, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP, CURLOPT_USERAGENT => (string)($config['osrm_user_agent'] ?? 'PASAKJA/1.0 (tricycle ride booking)')]);
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        // A failed lookup isn't cached, and "retry" tells the app to try once more.
        if (!is_string($response) || $status !== 200) respond(['label' => null, 'retry' => true]);
        $decoded = json_decode($response, true);
        $label = is_array($decoded) ? placeLabelFromNominatim($decoded) : null;
        $pdo->prepare('REPLACE INTO place_name_cache (cache_key, label, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))')
            ->execute([$key, $label, $label === null ? 1 : 30]);
        respond(['label' => $label]);
    }
}

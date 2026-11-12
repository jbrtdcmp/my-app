<?php
declare(strict_types=1);

// Routes for community alerts, the fare editor, password resets, profile
// photos and place names. index.php calls handleFeatureRoutes() before its
// "not found" reply; each matching route ends by calling respond().
// Uses authenticatedUser(), database(), body(), respond(), requireRole(),
// logAdminActivity(), validPoint() and ApiError from index.php.

require_once __DIR__ . '/features_service.php';

/** Adds an in-app notice for one user. A failed notice never breaks the ride action that caused it. */
function notifyUser(PDO $pdo, int $userId, string $type, string $title, string $message, ?int $referenceId = null): void
{
    try {
        $pdo->prepare('INSERT INTO notifications (user_id, type, title, message, reference_id) VALUES (?, ?, ?, ?, ?)')
            ->execute([$userId, $type, mb_substr($title, 0, 160), mb_substr($message, 0, 500), $referenceId]);
    } catch (PDOException $error) {
        error_log('PASAKJA notification failed: ' . $error->getMessage());
    }
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
        $stmt = $pdo->prepare('SELECT id, full_name, phone, role FROM users WHERE (phone = :identifier OR email = :email) AND is_active = 1 LIMIT 1');
        $stmt->execute(['identifier' => preg_replace('/\s+/', '', $identifier), 'email' => strtolower($identifier)]);
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
        if (!password_verify($current, (string)$stmt->fetchColumn())) throw new ApiError(422, 'Your current password is incorrect.', ['current_password' => 'Incorrect password.']);
        if ($next === $current) throw new ApiError(422, 'Choose a password different from your current one.', ['new_password' => 'Use a different password.']);
        $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($next, PASSWORD_DEFAULT), $user['id']]);
        // Sign out other devices; keep this one signed in.
        $pdo->prepare('UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id <> ? AND revoked_at IS NULL')->execute([$user['id'], $user['token_id']]);
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
        authenticatedUser($config);
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

        $base = rtrim((string)($config['nominatim_base_url'] ?? 'https://nominatim.openstreetmap.org'), '/');
        $curl = curl_init($base . '/reverse?' . http_build_query(['format' => 'jsonv2', 'lat' => $lat, 'lon' => $lng, 'zoom' => 18, 'addressdetails' => 1, 'accept-language' => 'en']));
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT_MS => 1500, CURLOPT_TIMEOUT_MS => 4000, CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS | CURLPROTO_HTTP, CURLOPT_USERAGENT => (string)($config['osrm_user_agent'] ?? 'PASAKJA/1.0 (tricycle ride booking)')]);
        $response = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        if (!is_string($response) || $status !== 200) respond(['label' => null]); // not cached, so the next pin tries again
        $decoded = json_decode($response, true);
        $label = is_array($decoded) ? placeLabelFromNominatim($decoded) : null;
        $pdo->prepare('REPLACE INTO place_name_cache (cache_key, label, expires_at) VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY))')
            ->execute([$key, $label, $label === null ? 1 : 30]);
        respond(['label' => $label]);
    }
}

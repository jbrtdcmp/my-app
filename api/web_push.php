<?php
declare(strict_types=1);

// Web Push with plain PHP (OpenSSL + cURL), so it runs on free hosting without Composer:
// each message is encrypted for one browser (RFC 8291, "aes128gcm") and the request is
// signed with the server's VAPID key (RFC 8292). The browser's push service (Google,
// Apple, Mozilla or Microsoft) can't read the message; it only delivers it.
// Keys come from scripts/generate-vapid-keys.php and live in api/config.local.php.

function b64urlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64urlDecode(string $data): string
{
    $decoded = base64_decode(strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4), true);
    if ($decoded === false) throw new InvalidArgumentException('Invalid base64url text.');
    return $decoded;
}

/** OpenSSL options; on Windows XAMPP, OpenSSL needs its config file named to create EC keys. */
function webPushOpensslConfigs(?string $preferred = null): array
{
    $candidates = [$preferred, getenv('OPENSSL_CONF') ?: null, PHP_BINDIR . '/extras/ssl/openssl.cnf', dirname(PHP_BINDIR) . '/apache/conf/openssl.cnf', 'C:/xampp/php/extras/ssl/openssl.cnf'];
    return array_values(array_unique(array_filter($candidates, static fn($path): bool => is_string($path) && $path !== '' && is_file($path))));
}

/** A new P-256 key pair. */
function webPushNewKey(?string $opensslConf = null): OpenSSLAsymmetricKey
{
    $options = ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC];
    $key = @openssl_pkey_new($options);
    if ($key instanceof OpenSSLAsymmetricKey) return $key;
    foreach (webPushOpensslConfigs($opensslConf) as $config) {
        $key = @openssl_pkey_new($options + ['config' => $config]);
        if ($key instanceof OpenSSLAsymmetricKey) return $key;
    }
    throw new RuntimeException('OpenSSL could not create a P-256 key.');
}

/** The 65-byte uncompressed public point (0x04 || X || Y) of a P-256 key. */
function webPushPublicRaw(OpenSSLAsymmetricKey $key): string
{
    $details = openssl_pkey_get_details($key);
    return "\x04" . str_pad($details['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($details['ec']['y'], 32, "\0", STR_PAD_LEFT);
}

/** PEM form of a P-256 public key given as a 65-byte uncompressed point. */
function webPushPublicPem(string $raw): string
{
    if (strlen($raw) !== 65 || $raw[0] !== "\x04") throw new InvalidArgumentException('Invalid P-256 public key.');
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw;
    return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
}

/**
 * Encrypts $plaintext for one browser subscription (RFC 8291 with RFC 8188 "aes128gcm").
 * $userPublic is the subscription's p256dh key (65 bytes), $authSecret its auth secret (16 bytes).
 * Returns the request body. $salt and $serverKey are random unless a test passes them.
 */
function webPushEncrypt(string $plaintext, string $userPublic, string $authSecret, ?string $salt = null, ?OpenSSLAsymmetricKey $serverKey = null, ?string $opensslConf = null): string
{
    if (strlen($authSecret) !== 16) throw new InvalidArgumentException('Invalid push auth secret.');
    $salt ??= random_bytes(16);
    $serverKey ??= webPushNewKey($opensslConf);
    $serverPublic = webPushPublicRaw($serverKey);
    $shared = openssl_pkey_derive(webPushPublicPem($userPublic), $serverKey, 32);
    if (!is_string($shared) || strlen($shared) !== 32) throw new RuntimeException('Push key agreement failed.');
    // IKM = HKDF(salt = auth secret, ECDH secret, "WebPush: info" 0x00 || browser key || server key)
    $ikm = hash_hkdf('sha256', $shared, 32, "WebPush: info\0" . $userPublic . $serverPublic, $authSecret);
    $contentKey = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $tag = '';
    // One record: the message followed by the 0x02 "last record" delimiter.
    $cipher = openssl_encrypt($plaintext . "\x02", 'aes-128-gcm', $contentKey, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    if ($cipher === false) throw new RuntimeException('Push encryption failed.');
    return $salt . pack('N', 4096) . chr(strlen($serverPublic)) . $serverPublic . $cipher . $tag;
}

/** An ECDSA signature from OpenSSL (DER SEQUENCE of r and s) as the 64-byte r||s that ES256 uses. */
function webPushDerToRaw(string $der): string
{
    $offset = 2 + ((ord($der[1]) & 0x80) ? (ord($der[1]) & 0x7f) : 0);
    $parts = [];
    for ($i = 0; $i < 2; $i++) {
        if (($der[$offset] ?? '') !== "\x02") throw new RuntimeException('Unexpected signature format.');
        $length = ord($der[$offset + 1]);
        $parts[] = str_pad(ltrim(substr($der, $offset + 2, $length), "\0"), 32, "\0", STR_PAD_LEFT);
        $offset += 2 + $length;
    }
    return $parts[0] . $parts[1];
}

/** The Authorization header for one push service: a signed VAPID token plus the public key (RFC 8292). */
function webPushVapidHeader(string $endpoint, string $subject, string $publicKey, string $privateKeyPem, ?int $now = null): string
{
    $url = parse_url($endpoint);
    $audience = $url['scheme'] . '://' . $url['host'] . (isset($url['port']) ? ':' . $url['port'] : '');
    $header = b64urlEncode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $claims = b64urlEncode(json_encode(['aud' => $audience, 'exp' => ($now ?? time()) + 12 * 3600, 'sub' => $subject], JSON_UNESCAPED_SLASHES));
    $signingInput = "{$header}.{$claims}";
    if (!openssl_sign($signingInput, $der, $privateKeyPem, OPENSSL_ALGO_SHA256)) throw new RuntimeException('Could not sign the push token.');
    return 'vapid t=' . $signingInput . '.' . b64urlEncode(webPushDerToRaw($der)) . ', k=' . $publicKey;
}

/**
 * Only real browser push services are accepted, so a stored subscription can't make the
 * server send requests anywhere else.
 */
function isAllowedPushEndpoint(string $endpoint): bool
{
    $url = parse_url($endpoint);
    if (!is_array($url) || ($url['scheme'] ?? '') !== 'https' || empty($url['host']) || isset($url['user']) || isset($url['port'])) return false;
    if (strlen($endpoint) > 1000) return false;
    $host = strtolower($url['host']);
    foreach (['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com'] as $service) {
        if ($host === $service || str_ends_with($host, '.' . $service)) return true;
    }
    return false;
}

/** Checks a subscription from the browser. Returns [endpoint, p256dh, auth] or throws InvalidArgumentException. */
function validatedPushSubscription(array $input): array
{
    $endpoint = is_string($input['endpoint'] ?? null) ? trim($input['endpoint']) : '';
    $keys = is_array($input['keys'] ?? null) ? $input['keys'] : [];
    $p256dh = is_string($keys['p256dh'] ?? null) ? $keys['p256dh'] : '';
    $auth = is_string($keys['auth'] ?? null) ? $keys['auth'] : '';
    if (!isAllowedPushEndpoint($endpoint)) throw new InvalidArgumentException('This browser’s push service isn’t supported.');
    try {
        $rawKey = b64urlDecode($p256dh);
        $rawAuth = b64urlDecode($auth);
    } catch (InvalidArgumentException) {
        throw new InvalidArgumentException('The notification keys from this browser are invalid.');
    }
    if (strlen($rawKey) !== 65 || $rawKey[0] !== "\x04" || strlen($rawAuth) !== 16) throw new InvalidArgumentException('The notification keys from this browser are invalid.');
    return [$endpoint, $p256dh, $auth];
}

/** Push settings from api/config.local.php, or null when push isn't set up. */
function webPushSettings(array $config): ?array
{
    $public = (string)($config['vapid_public_key'] ?? '');
    $private = (string)($config['vapid_private_key_pem'] ?? '');
    if ($public === '' || $private === '') return null;
    return [
        'public_key' => $public,
        'private_key_pem' => $private,
        'subject' => (string)($config['vapid_subject'] ?? 'mailto:admin@example.com'),
        'openssl_conf' => $config['openssl_conf'] ?? null,
    ];
}

/**
 * Sends one message to several subscriptions at once (rows with id, endpoint, p256dh, auth_secret).
 * Returns [subscription id => HTTP status]; 0 means the push service couldn't be reached.
 */
function webPushSend(array $subscriptions, array $message, array $settings, int $ttl = 3600): array
{
    $json = json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $multi = curl_multi_init();
    $handles = [];
    $results = [];
    foreach ($subscriptions as $subscription) {
        $id = (int)$subscription['id'];
        try {
            if (!isAllowedPushEndpoint($subscription['endpoint'])) throw new InvalidArgumentException('Endpoint not allowed.');
            $body = webPushEncrypt($json, b64urlDecode($subscription['p256dh']), b64urlDecode($subscription['auth_secret']), null, null, $settings['openssl_conf']);
            $authorization = webPushVapidHeader($subscription['endpoint'], $settings['subject'], $settings['public_key'], $settings['private_key_pem']);
        } catch (Throwable $error) {
            error_log('PASAKJA push skipped: ' . $error->getMessage());
            $results[$id] = 0;
            continue;
        }
        $curl = curl_init($subscription['endpoint']);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_CONNECTTIMEOUT_MS => 3000,
            CURLOPT_TIMEOUT_MS => 6000,
            CURLOPT_HTTPHEADER => ['Authorization: ' . $authorization, 'Content-Encoding: aes128gcm', 'Content-Type: application/octet-stream', 'TTL: ' . $ttl, 'Urgency: high'],
        ]);
        curl_multi_add_handle($multi, $curl);
        $handles[$id] = $curl;
    }
    do {
        $status = curl_multi_exec($multi, $running);
        if ($running) curl_multi_select($multi, 1.0);
    } while ($running && $status === CURLM_OK);
    foreach ($handles as $id => $curl) {
        $results[$id] = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($multi, $curl);
        curl_close($curl);
    }
    curl_multi_close($multi);
    return $results;
}

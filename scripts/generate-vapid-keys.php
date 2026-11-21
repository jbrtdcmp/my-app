<?php
declare(strict_types=1);

// Creates the server's Web Push (VAPID) keys and prints the lines to paste into
// api/config.local.php. Run once per server, from the command line:
//   php scripts/generate-vapid-keys.php your-contact@example.com
// Keep vapid_private_key_pem secret. New keys mean everyone has to turn notifications on again.

require __DIR__ . '/../api/web_push.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$key = webPushNewKey();
$pem = '';
$exported = @openssl_pkey_export($key, $pem);
foreach ($exported ? [] : webPushOpensslConfigs() as $config) {
    if (@openssl_pkey_export($key, $pem, null, ['config' => $config])) {
        $exported = true;
        break;
    }
}
if (!$exported) {
    fwrite(STDERR, "OpenSSL could not export the key.\n");
    exit(1);
}

$contact = $argv[1] ?? 'admin@example.com';
echo "    // Web Push (phone notifications). Keep the private key secret.\n";
echo "    'vapid_public_key' => '" . b64urlEncode(webPushPublicRaw($key)) . "',\n";
echo "    'vapid_private_key_pem' => " . var_export($pem, true) . ",\n";
echo "    'vapid_subject' => " . var_export('mailto:' . $contact, true) . ",\n";

<?php
// Copy this file to config.local.php and change the credentials as needed.
return [
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    'db_name' => 'pasakja',
    'db_user' => 'root',
    'db_password' => '',
    'allowed_origins' => [
        'http://localhost:8443',
        'http://127.0.0.1:8443',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],
    // Street routes for the ride map. The free demo server suits testing only;
    // point this at your own OSRM server before real use.
    'osrm_base_url' => 'https://router.project-osrm.org',
    'osrm_user_agent' => 'PASAKJA/1.0 (tricycle ride booking)',
    // Street names for map pins (OpenStreetMap Nominatim). Results are cached for 30 days.
    'nominatim_base_url' => 'https://nominatim.openstreetmap.org',
    // Phone notifications (Web Push). Create the keys with:
    //   php scripts/generate-vapid-keys.php your-contact@example.com
    // and paste the printed lines here. Leave them out to turn notifications off.
    // 'vapid_public_key' => '',
    // 'vapid_private_key_pem' => '',
    // 'vapid_subject' => 'mailto:your-contact@example.com',
];

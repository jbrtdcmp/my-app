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
];

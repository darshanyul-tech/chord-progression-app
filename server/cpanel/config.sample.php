<?php
// Copy this file to `config.php` and fill in your cPanel database details.
// config.php is git-ignored and must never be committed.

return [
    // From cPanel → MySQL Databases. The DB name and user are usually prefixed
    // with your cPanel account name, e.g. "cpaneluser_trytone".
    'db_host' => 'localhost',
    'db_name' => 'CPANELUSER_trytone',
    'db_user' => 'CPANELUSER_trytone',
    'db_pass' => 'CHANGE_ME',

    // Allowed browser origin for CORS. If you serve the app and this API from
    // the SAME domain (recommended: app at https://trytone.com.au, API at
    // https://trytone.com.au/api) you can leave this as '' to disable CORS.
    // Otherwise set it to the exact site origin, e.g. 'https://trytone.com.au'.
    'cors_origin' => '',

    // Secret key that protects the owner analytics page (admin.php). Pick a long
    // random string and keep it private — anyone with it can read usage totals.
    // View analytics at:  https://<your-domain>/api/admin.php?key=THIS_VALUE
    'admin_key' => 'CHANGE_ME_TO_A_LONG_RANDOM_STRING',
];

<?php
// TryTone stats endpoint. Matches CpanelStatsBackend in
// src/lib/stats/backend.ts. The profile is derived from the bearer token, so
// no id is taken from the URL.
//   GET  -> 200 {version,topics,updatedAt}  |  204 (no stats yet)
//   PUT  {version,topics,updatedAt}  -> 200 {ok:true}

declare(strict_types=1);

require __DIR__ . '/db.php';
send_cors($config);

$pdo    = db($config);
$id     = require_profile_id($pdo);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $stmt = $pdo->prepare('SELECT data FROM stats WHERE profile_id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(204); // no stats stored yet
        exit;
    }
    header('Content-Type: application/json');
    echo $row['data']; // already JSON — pass through verbatim
    exit;
}

if ($method === 'PUT') {
    $body = read_body();
    if (!isset($body['topics']) || !is_array($body['topics'])) fail('Invalid stats payload.');
    $json = json_encode([
        'version'   => $body['version'] ?? 1,
        'topics'    => $body['topics'],
        'updatedAt' => $body['updatedAt'] ?? (int) round(microtime(true) * 1000),
    ]);
    // Upsert the single per-profile blob.
    $stmt = $pdo->prepare(
        'INSERT INTO stats (profile_id, data, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)'
    );
    $stmt->execute([$id, $json, (int) round(microtime(true) * 1000)]);
    json_out(['ok' => true]);
}

fail('Method not allowed.', 405);

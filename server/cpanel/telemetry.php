<?php
// Anonymous usage ingestion. Matches sendTelemetry() in
// src/lib/stats/telemetry.ts. No auth — anyone using the app posts here so the
// owner can measure total usage (guests included).
//   POST {deviceId, name?, stats:{version,topics,updatedAt}} -> 200 {ok:true}
// One upserted row per device in `usage_stats`.

declare(strict_types=1);

require __DIR__ . '/db.php';
send_cors($config);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST required.', 405);

$body     = read_body();
$deviceId = (string) ($body['deviceId'] ?? '');
$stats    = $body['stats'] ?? null;

// Basic validation — reject anything that isn't a plausible device id + blob.
if (!preg_match('/^[a-zA-Z0-9-]{8,64}$/', $deviceId)) fail('Bad device id.');
if (!is_array($stats) || !isset($stats['topics']) || !is_array($stats['topics'])) {
    fail('Bad stats payload.');
}

// Name is optional and only present for signed-in users; trim/limit it.
$name = isset($body['name']) && $body['name'] !== null
    ? mb_substr(trim((string) $body['name']), 0, 64)
    : null;
if ($name === '') $name = null;

$json = json_encode([
    'version'   => $stats['version'] ?? 1,
    'topics'    => $stats['topics'],
    'updatedAt' => $stats['updatedAt'] ?? 0,
]);
$now = (int) round(microtime(true) * 1000);

$pdo = db($config);
$stmt = $pdo->prepare(
    'INSERT INTO usage_stats (device_id, name, data, created_at, updated_at)
     VALUES (:id, :name, :data, :now, :now)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), data = VALUES(data), updated_at = VALUES(updated_at)'
);
$stmt->execute([':id' => $deviceId, ':name' => $name, ':data' => $json, ':now' => $now]);

json_out(['ok' => true]);

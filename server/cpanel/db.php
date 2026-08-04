<?php
// Shared helpers for the TryTone cPanel API: DB connection, CORS, JSON I/O,
// and bearer-token auth. Included by auth.php and stats.php.

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

/** Emit CORS headers (only when a cross-origin site is configured). */
function send_cors(array $config): void {
    $origin = $config['cors_origin'] ?? '';
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
    }
    // Preflight requests need no body.
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Open a PDO connection in exception mode. */
function db(array $config): PDO {
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
    return new PDO($dsn, $config['db_user'], $config['db_pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

/** Send a JSON response and stop. */
function json_out($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/** Send a plain-text error and stop. */
function fail(string $message, int $status = 400): void {
    http_response_code($status);
    header('Content-Type: text/plain');
    echo $message;
    exit;
}

/** Parse the JSON request body into an array (empty array when absent). */
function read_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/** Read the Bearer token from the Authorization header, or '' if none. */
function bearer_token(): string {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $auth = $headers['Authorization'] ?? $headers['authorization']
        ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/Bearer\s+(\S+)/i', (string) $auth, $m)) {
        return $m[1];
    }
    return '';
}

/** Resolve the current profile id from the token, or send 401 and stop. */
function require_profile_id(PDO $pdo): string {
    $token = bearer_token();
    if ($token === '') fail('Missing token.', 401);
    $stmt = $pdo->prepare('SELECT profile_id FROM tokens WHERE token = ?');
    $stmt->execute([$token]);
    $row = $stmt->fetch();
    if (!$row) fail('Invalid token.', 401);
    return $row['profile_id'];
}

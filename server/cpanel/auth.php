<?php
// TryTone auth endpoint. Matches CpanelAuthClient in
// src/lib/auth/authClient.ts. Actions (POST, ?action=...):
//   register {name, pin?}  -> 200 {profile, token}
//   login    {id, pin?}    -> 200 {profile, token}
//   list     {}            -> 200 [profile]        (the authenticated profile)
//   delete   {id}          -> 200 {ok:true}
// A "profile" is {id, name, createdAt}. The token is a bearer credential the
// SPA stores in localStorage and sends on every request.

declare(strict_types=1);

require __DIR__ . '/db.php';
send_cors($config);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST required.', 405);

$pdo    = db($config);
$action = $_GET['action'] ?? '';
$body   = read_body();

function issue_token(PDO $pdo, string $profileId): string {
    $token = bin2hex(random_bytes(32));
    $stmt = $pdo->prepare('INSERT INTO tokens (token, profile_id, created_at) VALUES (?, ?, ?)');
    $stmt->execute([$token, $profileId, (int) round(microtime(true) * 1000)]);
    return $token;
}

function profile_row(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT id, name, created_at FROM profiles WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function to_profile(array $row): array {
    return ['id' => $row['id'], 'name' => $row['name'], 'createdAt' => (int) $row['created_at']];
}

switch ($action) {
    case 'register': {
        $name = trim((string) ($body['name'] ?? ''));
        $pin  = isset($body['pin']) && $body['pin'] !== '' ? (string) $body['pin'] : null;
        if ($name === '') fail('Profile name is required.');

        $id  = sprintf('%s-%s-%s-%s-%s', bin2hex(random_bytes(4)), bin2hex(random_bytes(2)),
                       bin2hex(random_bytes(2)), bin2hex(random_bytes(2)), bin2hex(random_bytes(6)));
        $now = (int) round(microtime(true) * 1000);
        $hash = $pin !== null ? password_hash($pin, PASSWORD_DEFAULT) : null;

        try {
            $stmt = $pdo->prepare('INSERT INTO profiles (id, name, pin_hash, created_at) VALUES (?, ?, ?, ?)');
            $stmt->execute([$id, $name, $hash, $now]);
        } catch (PDOException $e) {
            fail('A profile with that name already exists.', 409);
        }
        json_out(['profile' => to_profile(profile_row($pdo, $id)), 'token' => issue_token($pdo, $id)]);
    }

    case 'login': {
        $id  = (string) ($body['id'] ?? '');
        $pin = (string) ($body['pin'] ?? '');
        $stmt = $pdo->prepare('SELECT id, name, pin_hash, created_at FROM profiles WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) fail('Profile not found.', 404);
        if ($row['pin_hash'] !== null && !password_verify($pin, $row['pin_hash'])) {
            fail('Incorrect PIN.', 401);
        }
        json_out(['profile' => to_profile($row), 'token' => issue_token($pdo, $row['id'])]);
    }

    case 'list': {
        $id = require_profile_id($pdo);
        $row = profile_row($pdo, $id);
        json_out($row ? [to_profile($row)] : []);
    }

    case 'delete': {
        $id = require_profile_id($pdo);
        // ON DELETE CASCADE removes the profile's tokens and stats too.
        $stmt = $pdo->prepare('DELETE FROM profiles WHERE id = ?');
        $stmt->execute([$id]);
        json_out(['ok' => true]);
    }

    default:
        fail('Unknown action.', 404);
}

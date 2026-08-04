<?php
// Owner analytics dashboard. Aggregates usage_stats (+ registered profiles).
//   GET admin.php?key=ADMIN_KEY              -> HTML dashboard (browser)
//   GET admin.php?key=ADMIN_KEY&format=json  -> JSON
// Protected by config['admin_key']. Read-only.

declare(strict_types=1);

require __DIR__ . '/db.php';

// --- Auth ------------------------------------------------------------------
$key      = (string) ($_GET['key'] ?? '');
$expected = (string) ($config['admin_key'] ?? '');
if ($expected === '' || $expected === 'CHANGE_ME_TO_A_LONG_RANDOM_STRING' || !hash_equals($expected, $key)) {
    fail('Forbidden.', 403);
}

$pdo = db($config);
$now = (int) round(microtime(true) * 1000);
$DAY = 86400000;

function pct(int $correct, int $total): int {
    return $total === 0 ? 0 : (int) round($correct / $total * 100);
}
function prettify(string $topicId): string {
    return ucwords(str_replace('-', ' ', $topicId));
}

// --- Aggregate usage -------------------------------------------------------
$rows = $pdo->query('SELECT device_id, name, data, created_at, updated_at FROM usage_stats')->fetchAll();

$devices       = 0;
$attempts      = 0;
$correct       = 0;
$active7        = 0;
$active30       = 0;
$topics        = []; // topicId => ['attempts'=>, 'correct'=>]
$accounts      = []; // rows that carried a display name

foreach ($rows as $row) {
    $devices++;
    if ($now - (int) $row['updated_at'] <= 7 * $DAY) $active7++;
    if ($now - (int) $row['updated_at'] <= 30 * $DAY) $active30++;

    $data = json_decode($row['data'], true);
    $rowAttempts = 0;
    $rowCorrect = 0;
    if (is_array($data) && isset($data['topics']) && is_array($data['topics'])) {
        foreach ($data['topics'] as $topicId => $t) {
            $tc = (int) ($t['overall']['correct'] ?? 0);
            $tt = (int) ($t['overall']['total'] ?? 0);
            if (!isset($topics[$topicId])) $topics[$topicId] = ['attempts' => 0, 'correct' => 0];
            $topics[$topicId]['attempts'] += $tt;
            $topics[$topicId]['correct']  += $tc;
            $rowAttempts += $tt;
            $rowCorrect  += $tc;
        }
    }
    $attempts += $rowAttempts;
    $correct  += $rowCorrect;

    if ($row['name'] !== null && $row['name'] !== '') {
        $accounts[] = [
            'name'     => $row['name'],
            'attempts' => $rowAttempts,
            'accuracy' => pct($rowCorrect, $rowAttempts),
            'lastSeen' => (int) $row['updated_at'],
        ];
    }
}

// Registered accounts (created a profile, whether or not they've synced usage).
$registered = (int) $pdo->query('SELECT COUNT(*) c FROM profiles')->fetch()['c'];

// Sort: most-used topics first; most-active accounts first.
$topicList = [];
foreach ($topics as $id => $t) {
    $topicList[] = [
        'topicId'  => $id,
        'label'    => prettify($id),
        'attempts' => $t['attempts'],
        'correct'  => $t['correct'],
        'accuracy' => pct($t['correct'], $t['attempts']),
    ];
}
usort($topicList, fn($a, $b) => $b['attempts'] <=> $a['attempts']);
usort($accounts, fn($a, $b) => $b['attempts'] <=> $a['attempts']);

$result = [
    'generatedAt' => $now,
    'totals' => [
        'devices'            => $devices,
        'attempts'           => $attempts,
        'correct'            => $correct,
        'accuracy'           => pct($correct, $attempts),
        'activeLast7d'       => $active7,
        'activeLast30d'      => $active30,
        'registeredAccounts' => $registered,
    ],
    'topics'   => $topicList,
    'accounts' => $accounts,
];

// --- Output ----------------------------------------------------------------
if (($_GET['format'] ?? '') === 'json') {
    json_out($result);
}

// HTML dashboard.
header('Content-Type: text/html; charset=utf-8');
$h = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$fmtDate = fn($ms) => $ms ? date('Y-m-d H:i', (int) ($ms / 1000)) : '—';
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TryTone — Usage</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 820px; padding: 0 1rem; color: #111; }
  h1 { margin: 0 0 0.25rem; } .sub { color: #666; margin: 0 0 1.5rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 1rem; }
  .card .n { font-size: 1.9rem; font-weight: 800; color: #005f6b; }
  .card .l { color: #666; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid #eee; }
  th { color: #666; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: #999; }
</style>
</head>
<body>
  <h1>TryTone usage</h1>
  <p class="sub">Generated <?= $h($fmtDate($now)) ?> · read-only</p>

  <div class="cards">
    <div class="card"><div class="n"><?= $h($devices) ?></div><div class="l">People (devices)</div></div>
    <div class="card"><div class="n"><?= $h($registered) ?></div><div class="l">Registered accounts</div></div>
    <div class="card"><div class="n"><?= $h($attempts) ?></div><div class="l">Total attempts</div></div>
    <div class="card"><div class="n"><?= $h($result['totals']['accuracy']) ?>%</div><div class="l">Overall accuracy</div></div>
    <div class="card"><div class="n"><?= $h($active7) ?></div><div class="l">Active last 7 days</div></div>
    <div class="card"><div class="n"><?= $h($active30) ?></div><div class="l">Active last 30 days</div></div>
  </div>

  <h2>What they're using</h2>
  <table>
    <thead><tr><th>Topic</th><th class="n">Attempts</th><th class="n">Accuracy</th></tr></thead>
    <tbody>
    <?php if (!$topicList): ?>
      <tr><td colspan="3" class="empty">No usage recorded yet.</td></tr>
    <?php else: foreach ($topicList as $t): ?>
      <tr><td><?= $h($t['label']) ?></td><td class="n"><?= $h($t['attempts']) ?></td><td class="n"><?= $h($t['accuracy']) ?>%</td></tr>
    <?php endforeach; endif; ?>
    </tbody>
  </table>

  <h2>Named accounts</h2>
  <table>
    <thead><tr><th>Name</th><th class="n">Attempts</th><th class="n">Accuracy</th><th>Last seen</th></tr></thead>
    <tbody>
    <?php if (!$accounts): ?>
      <tr><td colspan="4" class="empty">No named accounts yet.</td></tr>
    <?php else: foreach ($accounts as $a): ?>
      <tr><td><?= $h($a['name']) ?></td><td class="n"><?= $h($a['attempts']) ?></td><td class="n"><?= $h($a['accuracy']) ?>%</td><td><?= $h($fmtDate($a['lastSeen'])) ?></td></tr>
    <?php endforeach; endif; ?>
    </tbody>
  </table>
</body>
</html>

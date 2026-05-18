<?php
/**
 * CCCC Migration Script
 * Imports existing classifications.jsonl entries into MySQL.
 *
 * HOW TO USE (one-time only):
 *   1. Upload this file alongside proxy.php on CranL.
 *   2. Make sure .env has DB_* credentials set.
 *   3. Visit: https://yoursite.com/data/migrate_jsonl.php
 *   4. DELETE this file immediately after migration completes.
 *
 * SECURITY: This file processes server-side data and should never
 * be left accessible on production. Delete after use.
 */

// ── Bootstrap ──────────────────────────────────────────────────────────────
// Load .env from parent directory (same as proxy.php)
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name); $value = trim($value);
        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv("{$name}={$value}");
            $_ENV[$name] = $value;
        }
    }
}

// ── DB connection ───────────────────────────────────────────────────────────
$host = getenv('DB_HOST') ?: 'localhost';
$name = getenv('DB_NAME') ?: '';
$user = getenv('DB_USER') ?: '';
$pass = getenv('DB_PASS') ?: '';

if (!$name || !$user) {
    die("❌ DB credentials not found in .env. Set DB_HOST, DB_NAME, DB_USER, DB_PASS.\n");
}

try {
    $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    die("❌ DB connection failed: " . $e->getMessage() . "\n");
}

// ── Read JSONL ──────────────────────────────────────────────────────────────
$jsonlPath = __DIR__ . '/classifications.jsonl';
if (!file_exists($jsonlPath)) {
    die("❌ classifications.jsonl not found at: {$jsonlPath}\n");
}

$lines   = file($jsonlPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
$total   = count($lines);
$skipped = 0;
$inserted = 0;
$updated  = 0;

echo "📂 Found {$total} entries in classifications.jsonl\n\n";

// ── Migrate ─────────────────────────────────────────────────────────────────
// For JSONL entries we don't have real IP hashes, so we generate a
// synthetic ip_hash from the entry's unique id — this ensures each JSONL
// entry is treated as a separate rater (best we can do for historical data).
// Entries with the same title + same classifier within 10 minutes are deduplicated.

$seenKeys = []; // track contentId+contentType+classifier combinations

foreach ($lines as $i => $line) {
    $entry = json_decode($line, true);
    if (!$entry) {
        echo "  ⚠️  Line " . ($i + 1) . ": Invalid JSON — skipped\n";
        $skipped++;
        continue;
    }

    $contentId   = substr((string)($entry['content_id'] ?? 'manual'), 0, 255);
    $contentType = $entry['content_type'] ?? 'anime';
    $title       = substr((string)($entry['title'] ?? ''), 0, 500);
    $ratings     = is_array($entry['ratings']) ? $entry['ratings'] : [];
    $badges      = is_array($entry['badges'])  ? $entry['badges']  : [];
    $classifier  = substr((string)($entry['classifier'] ?? ''), 0, 100);
    $orientation = in_array($entry['orientation'] ?? '', ['horizontal','vertical'])
                   ? $entry['orientation'] : 'horizontal';
    $action      = in_array($entry['action'] ?? '', ['export','copy','rate'])
                   ? $entry['action'] : 'export';
    $createdAt   = $entry['created_at'] ?? date('c');

    // Convert ISO8601 to MySQL datetime
    try {
        $dt = new DateTime($createdAt);
        $mysqlDate = $dt->format('Y-m-d H:i:s');
    } catch (Exception $e) {
        $mysqlDate = date('Y-m-d H:i:s');
    }

    // Deduplication: same work + same classifier within same minute = skip
    $dedupKey = $contentId . '|' . $contentType . '|' . $classifier . '|' . substr($mysqlDate, 0, 16);
    if (isset($seenKeys[$dedupKey])) {
        $skipped++;
        continue;
    }
    $seenKeys[$dedupKey] = true;

    // Use entry's JSONL id as a synthetic ip_hash so each legacy entry is unique
    $ipHash = hash('sha256', 'legacy_' . ($entry['id'] ?? uniqid()));

    try {
        // 1. Upsert work
        $pdo->prepare(
            "INSERT INTO works (content_id, content_type, title, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                title      = VALUES(title),
                updated_at = VALUES(updated_at)"
        )->execute([$contentId, $contentType, $title, $mysqlDate, $mysqlDate]);

        $workId = $pdo->query("SELECT LAST_INSERT_ID()")->fetchColumn();
        if (!$workId) {
            $stmt = $pdo->prepare("SELECT id FROM works WHERE content_id = ? AND content_type = ?");
            $stmt->execute([$contentId, $contentType]);
            $workId = $stmt->fetchColumn();
        }

        // 2. Insert classification
        $pdo->prepare(
            "INSERT IGNORE INTO classifications
                (work_id, ip_hash,
                 kufr, sex, nudity, vices, magic, lgbt, gore, addiction, lootbox, p2w,
                 badge_nomusic, badge_noprofanity, badge_noaffairs,
                 classifier, orientation, action, created_at, updated_at)
             VALUES
                (?, ?,
                 ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 ?, ?, ?,
                 ?, ?, ?, ?, ?)"
        )->execute([
            $workId, $ipHash,
            (int)($ratings['kufr']      ?? 0),
            (int)($ratings['sex']       ?? 0),
            (int)($ratings['nudity']    ?? 0),
            (int)($ratings['vices']     ?? 0),
            (int)($ratings['magic']     ?? 0),
            (int)($ratings['lgbt']      ?? 0),
            (int)($ratings['gore']      ?? 0),
            (int)($ratings['addiction'] ?? 0),
            (int)($ratings['lootbox']   ?? 0),
            (int)($ratings['p2w']       ?? 0),
            !empty($badges['nomusic'])      ? 1 : 0,
            !empty($badges['noprofanity'])  ? 1 : 0,
            !empty($badges['noaffairs'])    ? 1 : 0,
            $classifier, $orientation, $action,
            $mysqlDate, $mysqlDate
        ]);

        $inserted++;

    } catch (PDOException $e) {
        echo "  ⚠️  Line " . ($i + 1) . " ({$title}): " . $e->getMessage() . "\n";
        $skipped++;
    }
}

// ── Sync rater_count for all works ──────────────────────────────────────────
$pdo->exec(
    "UPDATE works w
     SET rater_count = (SELECT COUNT(*) FROM classifications c WHERE c.work_id = w.id)"
);

// ── Summary ──────────────────────────────────────────────────────────────────
$totalWorks = (int)$pdo->query("SELECT COUNT(*) FROM works")->fetchColumn();
$totalClass = (int)$pdo->query("SELECT COUNT(*) FROM classifications")->fetchColumn();

echo "\n✅ Migration complete!\n";
echo "   Inserted : {$inserted}\n";
echo "   Skipped  : {$skipped} (duplicates or invalid)\n";
echo "   Works    : {$totalWorks} unique works in DB\n";
echo "   Ratings  : {$totalClass} classification rows in DB\n";
echo "\n⚠️  DELETE this file now: data/migrate_jsonl.php\n";

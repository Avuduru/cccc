<?php
/**
 * Temporary script to create database tables.
 * Delete after running.
 */

// Load .env
$envPath = __DIR__ . '/.env';
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

$host = getenv('DB_HOST') ?: '';
$name = getenv('DB_NAME') ?: '';
$user = getenv('DB_USER') ?: '';
$pass = getenv('DB_PASS') ?: '';

if (!$host || !$name || !$user) {
    die("❌ Error: Database credentials are missing. Make sure you added them to your Environment Variables in CranL.");
}

try {
    $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    // Read and execute schema.sql
    $sqlFile = __DIR__ . '/data/schema.sql';
    if (!file_exists($sqlFile)) {
        die("❌ Error: Cannot find data/schema.sql");
    }
    
    $sql = file_get_contents($sqlFile);
    $pdo->exec($sql);
    
    echo "<h1>✅ Success!</h1>";
    echo "<p>Database tables created successfully.</p>";
    echo "<p>You can now go to: <a href='data/migrate_jsonl.php'>data/migrate_jsonl.php</a> to migrate your old ratings.</p>";
    
} catch (PDOException $e) {
    die("❌ Database connection failed: " . $e->getMessage());
}

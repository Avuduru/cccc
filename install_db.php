<?php
/**
 * CCCC Database Installer
 * Run this ONCE to create the MySQL tables, then delete it.
 */

// Load .env
$envPath = __DIR__ . '/.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        [$name, $value] = explode('=', $line, 2);
        putenv(trim($name) . '=' . trim($value));
    }
}

$host = getenv('DB_HOST');
$name = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');

if (!$host || !$name) {
    die("❌ Error: Database credentials missing from environment variables.");
}

try {
    $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    $sql = file_get_contents(__DIR__ . '/data/schema.sql');
    if (!$sql) {
        die("❌ Error: Could not read data/schema.sql");
    }

    $pdo->exec($sql);
    echo "✅ Success! The 'works' and 'classifications' tables have been created.<br><br>";
    echo "<b>IMPORTANT:</b> Please delete this file (install_db.php) immediately for security.";

} catch (PDOException $e) {
    die("❌ Database Error: " . $e->getMessage());
}

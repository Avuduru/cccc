<?php
/**
 * CCCC Clean URL Router
 * This script intercepts 404 requests (like /guide) and natively serves 
 * the corresponding .html file (like guide.html) without redirecting the URL.
 */

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Remove the leading slash
$file = ltrim($path, '/');

// Default to index if root is requested
if ($file === '') {
    $file = 'index';
}

// Check if the corresponding .html file exists
if (file_exists($file . '.html')) {
    // Return standard 200 OK and serve the HTML content
    http_response_code(200);
    include $file . '.html';
    exit;
}

// If it's a proxy request or something else that slipped through, don't interfere
if ($file === 'proxy.php') {
    include 'proxy.php';
    exit;
}

// If no file matches, return a clean 404
http_response_code(404);
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>404 - الصفحة غير موجودة</title>
    <style>
        body { background: #0e1014; color: #fff; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .error { text-align: center; }
        h1 { color: #c8ff5e; font-size: 48px; }
        a { color: #fff; text-decoration: none; border-bottom: 1px solid #c8ff5e; }
    </style>
</head>
<body>
    <div class="error">
        <h1>404</h1>
        <p>عذراً، الصفحة غير موجودة.</p>
        <a href="./">العودة للرئيسية</a>
    </div>
</body>
</html>

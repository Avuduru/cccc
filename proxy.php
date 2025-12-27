<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// --- Helper Functions ---

/**
 * Simple .env loader
 */
function loadEnv($path) {
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;

        list($name, $value) = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
            putenv(sprintf('%s=%s', $name, $value));
            $_ENV[$name] = $value;
            $_SERVER[$name] = $value;
        }
    }
}

function fetchUrl($url) {
    if (empty($url)) return json_encode(['error' => 'No URL provided']);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_USERAGENT, 'NeetPSRating/1.0');
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    
    $output = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($output === false) {
        return json_encode(['error' => "CURL Error: $error"]);
    }

    if ($httpCode !== 200) {
        return json_encode([
            'error' => "Upstream API returned status $httpCode",
            'response' => json_decode($output, true) ?: $output
        ]);
    }

    return $output;
}

// --- Configuration ---

loadEnv(__DIR__ . '/.env');

$TMDB_KEY = getenv('TMDB_KEY') ?: '';
$RAWG_KEY = getenv('RAWG_KEY') ?: '';

// --- Main Logic ---

$query = isset($_GET['query']) ? $_GET['query'] : '';
$type = isset($_GET['type']) ? $_GET['type'] : '';

if (!$query || !$type) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing query or type parameters']);
    exit;
}

$url = '';

switch ($type) {
    case 'movie':
    case 'tv':
        // Changed language from ar-SA to en-US as requested
        $url = "https://api.themoviedb.org/3/search/$type?api_key=$TMDB_KEY&language=en-US&query=" . urlencode($query) . "&page=1";
        break;

    case 'game':
        $url = "https://api.rawg.io/api/games?key=$RAWG_KEY&search=" . urlencode($query) . "&page_size=5";
        break;

    case 'anime':
    case 'manga':
        // Jikan API does not require a key
        $url = "https://api.jikan.moe/v4/$type?q=" . urlencode($query) . "&limit=5";
        break;

    case 'book':
        // Placeholder for Book Search
        echo json_encode(['items' => []]);
        exit;


    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit;
}

if ($url) {
    echo fetchUrl($url);
} else {
    echo json_encode(['error' => 'Unknown error']);
}


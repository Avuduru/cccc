<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// --- Helper Functions ---

/**
 * Simple .env loader
 */
function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0)
            continue;

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

/**
 * Filter out anime/Japanese content from TMDB results
 * For TV/Movie searches, we exclude all Japanese content to keep anime separate
 */
function filterAnimeFromTMDB($data)
{
    if (!isset($data['results']) || !is_array($data['results'])) {
        return $data;
    }

    $filtered = [];
    foreach ($data['results'] as $item) {
        $isJapanese = false;

        // Check if it's from Japan
        if (isset($item['origin_country']) && is_array($item['origin_country']) && in_array('JP', $item['origin_country'])) {
            $isJapanese = true;
        }

        // Also check original_language for Japanese
        if (isset($item['original_language']) && $item['original_language'] === 'ja') {
            $isJapanese = true;
        }

        // Only include non-Japanese items
        if (!$isJapanese) {
            $filtered[] = $item;
        }
    }

    $data['results'] = $filtered;
    return $data;
}

function fetchUrl($url, $headers = [])
{
    if (empty($url))
        return json_encode(['error' => 'No URL provided']);

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_USERAGENT, 'NeetPSRating/1.0');
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    // Fix SSL certificate issues on Windows (for development only)
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

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
$STEAMGRIDDB_KEY = getenv('STEAMGRIDDB_KEY') ?: '';
$DEEPL_KEY = getenv('DEEPL_KEY') ?: '';
$GOOGLE_BOOKS_KEY = getenv('GOOGLE_BOOKS_KEY') ?: ''; // Optional, works without it

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
        // RAWG API - comprehensive game database (free and paid games)
        $url = "https://api.rawg.io/api/games?key=$RAWG_KEY&search=" . urlencode($query) . "&page_size=5";
        break;

    case 'game_details':
        // Fetch detailed game info including description
        // Query should be the game ID (slug)
        $url = "https://api.rawg.io/api/games/$query?key=$RAWG_KEY";
        break;

    case 'game_cover':
        // SteamGridDB - Search for game ID first
        $searchUrl = "https://www.steamgriddb.com/api/v2/search/autocomplete/" . urlencode($query);
        $headers = ["Authorization: Bearer $STEAMGRIDDB_KEY"];

        $searchResponse = fetchUrl($searchUrl, $headers);
        $searchData = json_decode($searchResponse, true);

        if ($searchData && isset($searchData['success']) && $searchData['success'] && !empty($searchData['data'])) {
            $gameId = $searchData['data'][0]['id'];
            // Fetch vertical grids (600x900)
            $gridUrl = "https://www.steamgriddb.com/api/v2/grids/game/$gameId?dimensions=600x900&styles=alternate,material,white_logo";
            $gridResponse = fetchUrl($gridUrl, $headers);
            echo $gridResponse;
            exit;
        } else {
            echo json_encode(['success' => false, 'error' => 'Game not found']);
            exit;
        }
        break;

    case 'image_proxy':
        // Proxy images to avoid CORS issues during export
        if (empty($query)) {
            echo json_encode(['error' => 'No image URL provided']);
            exit;
        }

        // Fetch the image
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $query);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        $imageData = curl_exec($ch);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        if ($imageData) {
            header("Content-Type: $contentType");
            header("Access-Control-Allow-Origin: *");
            echo $imageData;
        } else {
            http_response_code(404);
            echo "Image not found";
        }
        exit;

    case 'translate':
        // Google Translate (GTX) - Free endpoint
        // URL: https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=TEXT
        $text = $query;
        if (empty($text)) {
            echo json_encode(['error' => 'No text provided']);
            exit;
        }

        $gtxUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=" . urlencode($text);

        // Use fetchUrl helper (handles SSL etc)
        $response = fetchUrl($gtxUrl);
        $data = json_decode($response, true);

        // GTX returns [[["Translated Text", "Original Text", ...], ...], ...]
        if ($data && isset($data[0])) {
            $translatedText = "";
            foreach ($data[0] as $segment) {
                if (isset($segment[0])) {
                    $translatedText .= $segment[0];
                }
            }
            echo json_encode([
                'responseStatus' => 200,
                'responseData' => [
                    'translatedText' => $translatedText
                ]
            ]);
        } else {
            echo json_encode(['error' => 'Translation failed']);
        }
        exit;

    case 'anime':
    case 'manga':
        // Jikan API does not require a key
        // Exclude Hentai (genre ID 12) but keep Ecchi (genre ID 9)
        $url = "https://api.jikan.moe/v4/$type?q=" . urlencode($query) . "&limit=5&genres_exclude=12";
        break;

    case 'book':
        // Open Library API - completely free, no key needed, no rate limits
        $url = "https://openlibrary.org/search.json?q=" . urlencode($query) . "&limit=5";
        break;


    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        exit;
}

if ($url) {
    $response = fetchUrl($url);

    // Filter out anime from TV/movie results
    if ($type === 'tv' || $type === 'movie') {
        $data = json_decode($response, true);
        if ($data && !isset($data['error'])) {
            $data = filterAnimeFromTMDB($data);
            $response = json_encode($data);
        }
    }

    echo $response;
} else {
    echo json_encode(['error' => 'Unknown error']);
}

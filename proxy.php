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

/**
 * Filter out games with NSFW tags from RAWG results
 */
function filterNSFWFromRAWG($data)
{
    if (!isset($data['results']) || !is_array($data['results'])) {
        return $data;
    }

    $nsfwTags = ['eroge', 'hentai']; // Only block actual porn games — mainstream games with mature tags should be classifiable
    $filtered = [];

    foreach ($data['results'] as $item) {
        $isNsfw = false;
        if (isset($item['tags']) && is_array($item['tags'])) {
            foreach ($item['tags'] as $tag) {
                if (isset($tag['slug']) && in_array(strtolower($tag['slug']), $nsfwTags)) {
                    $isNsfw = true;
                    break;
                }
            }
        }
        if (!$isNsfw) {
            $filtered[] = $item;
        }
    }

    // Ensure we don't return more than 5 after filtering
    $data['results'] = array_slice($filtered, 0, 5);
    return $data;
}

/**
 * HowLongToBeat scraper functions
 * Discovers the dynamic API path/key from HLTB's JS bundle,
 * then searches for a game and returns completion times.
 */

function hltbGet($url)
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'Accept: */*',
            'Referer: https://howlongtobeat.com/'
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($response === false || $httpCode !== 200) return null;
    return $response;
}

function searchHltb($gameName)
{
    global $dataDir;

    // 1. Check cache first
    $cacheFile = $dataDir . '/hltb_cache.json';
    $cache = [];
    if (file_exists($cacheFile)) {
        $cache = json_decode(file_get_contents($cacheFile), true) ?: [];
    }
    $cacheKey = strtolower(trim($gameName));
    if (isset($cache[$cacheKey]) && (time() - ($cache[$cacheKey]['ts'] ?? 0)) < 86400 * 30) {
        return $cache[$cacheKey]['data'];
    }

    // 2. Init handshake
    $timestamp = round(microtime(true) * 1000);
    $initJson = hltbGet("https://howlongtobeat.com/api/bleed/init?t={$timestamp}");
    if (!$initJson) return null;
    $initData = json_decode($initJson, true);
    if (!$initData || !isset($initData['token'], $initData['hpKey'], $initData['hpVal'])) return null;

    $token = $initData['token'];
    $hpKey = $initData['hpKey'];
    $hpVal = $initData['hpVal'];

    // 3. POST search request
    $payloadArray = [
        'searchType' => 'games',
        'searchTerms' => explode(' ', $gameName),
        'searchPage' => 1,
        'size' => 5,
        'searchOptions' => [
            'games' => [
                'userId' => 0,
                'platform' => '',
                'sortCategory' => 'popular',
                'rangeCategory' => 'main',
                'rangeTime' => ['min' => null, 'max' => null],
                'gameplay' => ['perspective' => '', 'flow' => '', 'genre' => '', 'difficulty' => ''],
                'rangeYear' => ['min' => '', 'max' => ''],
                'modifier' => '',
            ],
            'users' => ['sortCategory' => 'postcount'],
            'lists' => ['sortCategory' => 'follows'],
            'filter' => '',
            'sort' => 0,
            'randomizer' => 0,
        ],
        'useCache' => true,
    ];
    // Add honeypot key/val
    $payloadArray[$hpKey] = $hpVal;
    
    $payload = json_encode($payloadArray);

    $ch = curl_init('https://howlongtobeat.com/api/bleed');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
            'Content-Type: application/json',
            'Accept: */*',
            'Referer: https://howlongtobeat.com/',
            "x-auth-token: {$token}",
            "x-hp-key: {$hpKey}",
            "x-hp-val: {$hpVal}"
        ],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) return null;

    $data = json_decode($response, true);
    if (!$data || empty($data['data'])) return null;

    // 4. Pick the best match (first result)
    $game = $data['data'][0];
    // comp_main is in seconds, convert to hours (rounded to nearest 0.5)
    $mainSeconds = $game['comp_main'] ?? 0;
    $mainHours = $mainSeconds > 0 ? round($mainSeconds / 3600 * 2) / 2 : 0;

    $result = [
        'main_story' => $mainHours,
        'game_name' => $game['game_name'] ?? '',
    ];

    // 5. Cache the result
    $cache[$cacheKey] = ['ts' => time(), 'data' => $result];
    if (count($cache) > 500) {
        uasort($cache, function ($a, $b) { return ($a['ts'] ?? 0) - ($b['ts'] ?? 0); });
        $cache = array_slice($cache, -400, null, true);
    }
    file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    return $result;
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

// --- Initialize Data Storage ---
$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}
$logFile = $dataDir . '/classifications.jsonl';

$query = isset($_GET['query']) ? $_GET['query'] : '';
$type = isset($_GET['type']) ? $_GET['type'] : '';

if (!$type) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing type parameter']);
    exit;
}

// Ensure query is present for API searches
$needsQuery = !in_array($type, ['log', 'stats']);
if ($needsQuery && empty($query)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing query parameter']);
    exit;
}

$url = '';

switch ($type) {
    case 'movie':
    case 'tv':
        // Changed language from ar-SA to en-US as requested
        $url = "https://api.themoviedb.org/3/search/$type?api_key=$TMDB_KEY&language=en-US&query=" . urlencode($query) . "&page=1";
        break;

    case 'movie_details':
        $url = "https://api.themoviedb.org/3/movie/$query?api_key=$TMDB_KEY&language=en-US";
        break;

    case 'tv_details':
        $url = "https://api.themoviedb.org/3/tv/$query?api_key=$TMDB_KEY&language=en-US";
        break;

    case 'game':
        // RAWG API - comprehensive game database (free and paid games)
        // Fetch 10 to give room for NSFW filtering
        $url = "https://api.rawg.io/api/games?key=$RAWG_KEY&search=" . urlencode($query) . "&page_size=10";
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

    case 'hltb':
        // HowLongToBeat - search for game completion times
        $result = searchHltb($query);
        if ($result && $result['main_story'] > 0) {
            echo json_encode(['success' => true, 'data' => $result]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Game not found on HLTB']);
        }
        exit;

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

    case 'log':
        // Log classification data
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input || !isset($input['content_type']) || !isset($input['ratings'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payload', 'raw' => $raw, 'json_error' => json_last_error_msg()]);
            exit;
        }

        $logEntry = [
            'id' => uniqid(),
            'content_id' => $input['content_id'] ?? null,
            'content_type' => $input['content_type'],
            'title' => $input['title'] ?? '',
            'ratings' => $input['ratings'],
            'badges' => $input['badges'] ?? [],
            'classifier' => $input['classifier'] ?? '',
            'orientation' => $input['orientation'] ?? 'horizontal',
            'action' => $input['action'] ?? 'export',
            'created_at' => date('c')
        ];

        if (file_put_contents($logFile, json_encode($logEntry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX) !== false) {
            echo json_encode(['status' => 'ok']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to write to log file']);
        }
        exit;

    case 'stats':
        // Return anonymous aggregate stats from JSONL
        if (!file_exists($logFile)) {
            echo json_encode(['total' => 0, 'by_type' => [], 'by_action' => []]);
            exit;
        }

        $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $total = count($lines);
        $byType = [];
        $byAction = [];

        foreach ($lines as $line) {
            $entry = json_decode($line, true);
            if ($entry) {
                $type = $entry['content_type'] ?? 'unknown';
                $action = $entry['action'] ?? 'export';

                $byType[$type] = ($byType[$type] ?? 0) + 1;
                $byAction[$action] = ($byAction[$action] ?? 0) + 1;
            }
        }

        echo json_encode([
            'total' => $total,
            'by_type' => $byType,
            'by_action' => $byAction
        ]);
        exit;
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
    } else if ($type === 'game') {
        $data = json_decode($response, true);
        if ($data && !isset($data['error'])) {
            $data = filterNSFWFromRAWG($data);
            $response = json_encode($data);
        }
    }

    echo $response;
} else {
    echo json_encode(['error' => 'Unknown error']);
}

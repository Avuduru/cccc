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
 * Connect to MySQL using credentials from .env
 * Returns a PDO instance or null if DB vars are not configured.
 */
function getDB()
{
    $host = getenv('DB_HOST') ?: '';
    $name = getenv('DB_NAME') ?: '';
    $user = getenv('DB_USER') ?: '';
    $pass = getenv('DB_PASS') ?: '';

    if (!$host || !$name || !$user) {
        return null; // DB not configured — fall back gracefully
    }

    try {
        $dsn = "mysql:host={$host};dbname={$name};charset=utf8mb4";
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        return $pdo;
    } catch (PDOException $e) {
        // Log to error_log but never expose credentials to the client
        error_log('CCCC DB connection failed: ' . $e->getMessage());
        return null;
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
$needsQuery = !in_array($type, ['log', 'stats', 'lookup']);
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
        // Save classification data to MySQL (one vote per IP per work, UPSERT)
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $raw   = file_get_contents('php://input');
        $input = json_decode($raw, true);
        if (!$input || !isset($input['content_type']) || !isset($input['ratings'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payload', 'json_error' => json_last_error_msg()]);
            exit;
        }

        $pdo = getDB();
        if (!$pdo) {
            // DB not available — fall back to JSONL so nothing is lost
            $logEntry = [
                'id'           => uniqid(),
                'content_id'   => $input['content_id'] ?? null,
                'content_type' => $input['content_type'],
                'title'        => $input['title'] ?? '',
                'ratings'      => $input['ratings'],
                'badges'       => $input['badges'] ?? [],
                'classifier'   => $input['classifier'] ?? '',
                'orientation'  => $input['orientation'] ?? 'horizontal',
                'action'       => $input['action'] ?? 'export',
                'created_at'   => date('c')
            ];
            file_put_contents($logFile, json_encode($logEntry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
            echo json_encode(['status' => 'ok', 'storage' => 'jsonl_fallback']);
            exit;
        }

        try {
            // ── 1. Resolve ratings & badges ──────────────────────────────
            $ratings = is_array($input['ratings']) ? $input['ratings'] : [];
            $badges  = is_array($input['badges'])  ? $input['badges']  : [];

            $contentId   = substr((string)($input['content_id'] ?? 'manual'), 0, 255);
            $contentType = $input['content_type'];
            $title       = substr((string)($input['title'] ?? ''), 0, 500);
            $classifier  = substr((string)($input['classifier'] ?? ''), 0, 100);
            $orientation = in_array($input['orientation'] ?? '', ['horizontal','vertical']) ? $input['orientation'] : 'horizontal';
            $action      = in_array($input['action'] ?? '', ['export','copy','rate']) ? $input['action'] : 'export';

            // SHA-256 of client IP — never stored raw
            $ip       = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            $ip       = trim(explode(',', $ip)[0]); // take first IP if behind proxy
            $ipHash   = hash('sha256', $ip);

            // ── 2. Upsert the work ───────────────────────────────────────
            $pdo->prepare(
                "INSERT INTO works (content_id, content_type, title)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    title      = VALUES(title),
                    updated_at = NOW()"
            )->execute([$contentId, $contentType, $title]);

            // Fetch the work id (works whether it was inserted or already existed)
            $workId = $pdo->query("SELECT LAST_INSERT_ID()")->fetchColumn();
            if (!$workId) {
                $stmt = $pdo->prepare("SELECT id FROM works WHERE content_id = ? AND content_type = ?");
                $stmt->execute([$contentId, $contentType]);
                $workId = $stmt->fetchColumn();
            }

            // ── 3. Upsert the classification (one row per IP per work) ───
            $pdo->prepare(
                "INSERT INTO classifications
                    (work_id, ip_hash,
                     kufr, sex, nudity, vices, magic, lgbt, gore, addiction, lootbox, p2w,
                     badge_nomusic, badge_noprofanity, badge_noaffairs,
                     classifier, orientation, action)
                 VALUES
                    (?, ?,
                     ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                     ?, ?, ?,
                     ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                     kufr             = VALUES(kufr),
                     sex              = VALUES(sex),
                     nudity           = VALUES(nudity),
                     vices            = VALUES(vices),
                     magic            = VALUES(magic),
                     lgbt             = VALUES(lgbt),
                     gore             = VALUES(gore),
                     addiction        = VALUES(addiction),
                     lootbox          = VALUES(lootbox),
                     p2w              = VALUES(p2w),
                     badge_nomusic    = VALUES(badge_nomusic),
                     badge_noprofanity= VALUES(badge_noprofanity),
                     badge_noaffairs  = VALUES(badge_noaffairs),
                     classifier       = VALUES(classifier),
                     orientation      = VALUES(orientation),
                     action           = VALUES(action),
                     updated_at       = NOW()"
            )->execute([
                $workId, $ipHash,
                (int)($ratings['kufr']     ?? 0),
                (int)($ratings['sex']      ?? 0),
                (int)($ratings['nudity']   ?? 0),
                (int)($ratings['vices']    ?? 0),
                (int)($ratings['magic']    ?? 0),
                (int)($ratings['lgbt']     ?? 0),
                (int)($ratings['gore']     ?? 0),
                (int)($ratings['addiction']?? 0),
                (int)($ratings['lootbox']  ?? 0),
                (int)($ratings['p2w']      ?? 0),
                !empty($badges['nomusic'])     ? 1 : 0,
                !empty($badges['noprofanity']) ? 1 : 0,
                !empty($badges['noaffairs'])   ? 1 : 0,
                $classifier, $orientation, $action
            ]);

            // ── 4. Sync rater_count (unique IPs who rated this work) ─────
            $pdo->prepare(
                "UPDATE works
                 SET rater_count = (SELECT COUNT(*) FROM classifications WHERE work_id = ?),
                     updated_at  = NOW()
                 WHERE id = ?"
            )->execute([$workId, $workId]);

            echo json_encode(['status' => 'ok', 'work_id' => (int)$workId, 'storage' => 'mysql']);

        } catch (PDOException $e) {
            error_log('CCCC log error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
        }
        exit;

    case 'stats':
        // Return aggregate stats — from MySQL if available, JSONL fallback
        $pdo = getDB();

        if ($pdo) {
            try {
                $totalRaters = (int)$pdo->query("SELECT SUM(rater_count) FROM works")->fetchColumn();
                $totalWorks  = (int)$pdo->query("SELECT COUNT(*) FROM works WHERE rater_count > 0")->fetchColumn();
                $byType = [];
                foreach ($pdo->query("SELECT content_type, SUM(rater_count) as cnt FROM works GROUP BY content_type") as $row) {
                    $byType[$row['content_type']] = (int)$row['cnt'];
                }
                $top = [];
                foreach ($pdo->query("SELECT title, content_type, rater_count FROM works ORDER BY rater_count DESC LIMIT 10") as $row) {
                    $top[] = $row;
                }
                echo json_encode([
                    'total_raters' => $totalRaters,
                    'total_works'  => $totalWorks,
                    'by_type'      => $byType,
                    'top_works'    => $top,
                    'source'       => 'mysql'
                ]);
            } catch (PDOException $e) {
                error_log('CCCC stats error: ' . $e->getMessage());
                echo json_encode(['error' => 'Database error']);
            }
        } else {
            // Fallback: read from JSONL
            if (!file_exists($logFile)) {
                echo json_encode(['total_raters' => 0, 'by_type' => [], 'source' => 'jsonl']);
                exit;
            }
            $lines    = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            $byType   = [];
            $byAction = [];
            foreach ($lines as $line) {
                $entry = json_decode($line, true);
                if ($entry) {
                    $t = $entry['content_type'] ?? 'unknown';
                    $a = $entry['action']       ?? 'export';
                    $byType[$t]   = ($byType[$t]   ?? 0) + 1;
                    $byAction[$a] = ($byAction[$a] ?? 0) + 1;
                }
            }
            echo json_encode([
                'total_raters' => count($lines),
                'by_type'      => $byType,
                'by_action'    => $byAction,
                'source'       => 'jsonl'
            ]);
        }
        exit;

    case 'lookup':
        // Return consensus ratings for a specific work (for the future Letterboxd page)
        // Usage: proxy.php?type=lookup&query=CONTENT_ID&content_type=anime
        $lookupId   = $query;
        $lookupType = $_GET['content_type'] ?? '';

        if (!$lookupId || !$lookupType) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing query or content_type']);
            exit;
        }

        $pdo = getDB();
        if (!$pdo) {
            echo json_encode(['found' => false, 'reason' => 'db_unavailable']);
            exit;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM works WHERE content_id = ? AND content_type = ?");
            $stmt->execute([$lookupId, $lookupType]);
            $work = $stmt->fetch();

            if (!$work || (int)$work['rater_count'] === 0) {
                echo json_encode(['found' => false]);
                exit;
            }

            $workId     = $work['id'];
            $totalCount = (int)$work['rater_count'];
            $categories = ['kufr','sex','nudity','vices','magic','lgbt','gore','addiction','lootbox','p2w'];
            $consensus  = [];
            $scoreTotal = 0;

            // Majority vote (mode) per category — presence threshold 30%
            foreach ($categories as $cat) {
                $stmt = $pdo->prepare(
                    "SELECT `{$cat}` AS level, COUNT(*) AS votes
                     FROM classifications
                     WHERE work_id = ? AND `{$cat}` > 0
                     GROUP BY `{$cat}`
                     ORDER BY votes DESC, `{$cat}` ASC
                     LIMIT 1"
                );
                $stmt->execute([$workId]);
                $row = $stmt->fetch();

                if ($row && ($row['votes'] / $totalCount) >= 0.30) {
                    $level = (int)$row['level'];
                    $pts   = $level === 1 ? 3 : ($level === 2 ? 2 : 1);
                    $consensus[$cat] = [
                        'level'   => $level,
                        'votes'   => (int)$row['votes'],
                        'percent' => round(($row['votes'] / $totalCount) * 100) . '%'
                    ];
                    $scoreTotal += $pts;
                }
            }

            // Badge consensus
            $badgeKeys = ['badge_nomusic','badge_noprofanity','badge_noaffairs'];
            $badgeOut  = [];
            foreach ($badgeKeys as $badge) {
                $stmt = $pdo->prepare(
                    "SELECT COUNT(*) AS cnt FROM classifications WHERE work_id = ? AND `{$badge}` = 1"
                );
                $stmt->execute([$workId]);
                $cnt = (int)$stmt->fetchColumn();
                if ($cnt > 0 && ($cnt / $totalCount) >= 0.30) {
                    $key = str_replace('badge_', '', $badge);
                    $badgeOut[$key] = [
                        'count'   => $cnt,
                        'percent' => round(($cnt / $totalCount) * 100) . '%'
                    ];
                }
            }

            // Individual classifications (for detail page)
            $stmt = $pdo->prepare(
                "SELECT kufr, sex, nudity, vices, magic, lgbt, gore, addiction, lootbox, p2w,
                        badge_nomusic, badge_noprofanity, badge_noaffairs,
                        classifier, orientation, DATE(updated_at) AS date
                 FROM classifications WHERE work_id = ? ORDER BY updated_at DESC"
            );
            $stmt->execute([$workId]);
            $individuals = $stmt->fetchAll();

            echo json_encode([
                'found'           => true,
                'work'            => [
                    'title'        => $work['title'],
                    'content_type' => $work['content_type'],
                    'content_id'   => $work['content_id'],
                    'rater_count'  => $totalCount
                ],
                'consensus'       => $consensus,
                'badges'          => $badgeOut,
                'severity_score'  => $scoreTotal,
                'classifications' => $individuals
            ], JSON_UNESCAPED_UNICODE);

        } catch (PDOException $e) {
            error_log('CCCC lookup error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Database error']);
        }
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

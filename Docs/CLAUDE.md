# CLAUDE.md — Full Project Context for CCCC

## Project Identity

**Name:** CCCC — Conservative Classification for Creative Content  
**Arabic:** التصنيف المحافظ للمحتوى الإبداعي  
**Repository:** `Avuduru/cccc`  
**Purpose:** A web application that generates shareable "classification cards" for media (anime, manga, movies, TV shows, games, books) based on conservative Islamic moral standards. Users search for media, rate it across moral categories, and export a styled card image (PNG) for sharing on social media.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Vanilla HTML/CSS/JS (ES Modules) | No build tools, no frameworks, no npm |
| **Backend** | PHP 7.4+ proxy (`proxy.php`) | Handles API keys, CORS, translation |
| **Fonts** | Google Fonts: `Handjet` (Arabic), `Silkscreen` (English/pixel) | Loaded via CDN |
| **Export** | `html2canvas` 1.4.1 | CDN-loaded, renders preview to PNG |
| **APIs** | TMDB, RAWG, Jikan, SteamGridDB, Open Library, Google Translate (GTX) | All proxied through `proxy.php` |
| **Language** | RTL Arabic (primary), English (secondary) | `<html lang="ar" dir="rtl">` |

---

## How to Run

```bash
# 1. Copy environment file and add real API keys
cp .env.example .env
# Edit .env with real TMDB_KEY and RAWG_KEY

# 2. Start PHP dev server (MUST use php.ini for cURL SSL)
php -c php.ini -S localhost:8080

# 3. Open browser
# http://localhost:8080
```

**Critical:** The `php.ini` file in the project root has SSL/cURL settings configured for Windows development. The `-c php.ini` flag is mandatory for search to work.

---

## File Structure

```
cccc/
├── index.html          # Single-page app entry point (357 lines)
├── style.css           # All styling (2205 lines) — THE most complex file
├── watermark_fix.css   # Export-specific watermark overrides (unused/legacy)
├── proxy.php           # PHP API proxy & backend logic (391 lines)
├── php.ini             # PHP config with SSL certs for Windows dev
├── cacert.pem          # SSL certificate bundle for cURL
├── .env                # API keys (gitignored)
├── .env.example        # Template for .env
├── js/
│   ├── app.js          # Entry point — init, event listeners, manual mode
│   ├── ui.js           # Core UI logic — rendering, preview, search results (806 lines)
│   ├── export.js       # PNG export & clipboard copy with compression
│   ├── api.js          # Search API calls through proxy
│   ├── state.js        # Global mutable state object
│   ├── config.js       # Worker URL and design size settings
│   ├── constants.js    # Category definitions (Mawjoodat + Mustathniyat)
│   ├── translations.js # Genre translation map + Google Translate integration
│   ├── interact.js     # Drag-and-drop system (currently disabled)
│   └── utils.js        # Debounce utility
├── assets/
│   └── icons/          # 44 PNG classification icons (Arabic named)
├── data/
│   ├── .htaccess       # Apache deny rule
│   └── classifications.jsonl  # Server-side classification log (gitignored)
├── README.md           # API setup guide
├── DEBUG_GUIDE.md      # Troubleshooting search issues
└── CLAUDE.md           # This file
```

---

## Architecture Overview

### Data Flow

```
User searches → api.js → proxy.php → External API → proxy.php → ui.js (showSearchResults)
User selects item → ui.js (selectItem) → state.js update → updateDisplayedInfo() → updatePreview()
User rates categories → ui.js (renderControls) → state update → updatePreview() → sticker icons render
User exports → export.js → clones preview → html2canvas → compressToMaxSize → download PNG
```

### State Management (`js/state.js`)

Single mutable `state` object shared across all modules:

```js
{
    type: 'anime',           // 'anime'|'manga'|'movie'|'tv'|'game'|'book'|'manual'
    orientation: 'horizontal', // 'horizontal'|'vertical'
    ratings: {},              // e.g. { kufr: 1, sex: 2 } — severity 1(red)/2(orange)/3(yellow)/0(none)
    badges: {},               // e.g. { nomusic: true } — exception toggles
    meta: {                   // Current media metadata
        title, year, poster, genre, synopsis, score, stats
    },
    synopsisSize: 'auto'      // 'auto'|'small'|'medium'|'large'|'xlarge'
}
```

### Module Responsibilities

| Module | Role |
|--------|------|
| `app.js` | Bootstrap (`DOMContentLoaded`), all event listener wiring, manual mode logic |
| `ui.js` | `initUI()`, `renderControls()`, `updatePreview()`, `updateDisplayedInfo()`, search results display, modal setup, synopsis auto-scaling, title sizing, Arabic plural formatting |
| `export.js` | `handleExport()`, `handleCopyToClipboard()` — clones DOM, applies export-mode class, uses html2canvas, compresses to ≤2MB PNG |
| `api.js` | `handleSearch()` — fetches from `proxy.php` |
| `interact.js` | Drag/resize system for canvas elements (currently force-disabled via `setDragState(false)`) |
| `translations.js` | `translateGenres()` (dictionary lookup), `translateText()` (Google GTX proxy, cached in localStorage) |
| `constants.js` | Category definitions — `CATEGORIES.Mawjoodat` (10 rating categories) and `CATEGORIES.Mustathniyat` (3 exception toggles) |
| `config.js` | `WORKER_URL: 'proxy.php'` and `DESIGN` size tokens |

---

## Classification System

### Mawjoodat (الموجودات — "Content Present")

Three semantic groups, each color-coded in the info modal:

| Color | Group | Categories |
|-------|-------|-----------|
| **Purple** | عقدية وفكرية (Doctrinal) | كفريات (Blasphemy), سحر (Sorcery) |
| **Red** | أخلاقية وصادمة (Moral) | جنس (Sexual), تعرّي (Nudity), شذوذ (LGBT), صادم (Gore) |
| **Cyan** | مالي وسلوكي (Behavioral) | مفاسد (Vices), إدمانيّات (Addiction)*, تبذير (P2W)*, قمار (Lootbox)* |

*\*Game-only categories — hidden unless type is `game` or `manual`*

### Severity Levels (Rating Bar)

| Level | Color | RTL Position | Meaning |
|-------|-------|-------------|---------|
| **1** | Red | Leftmost (87.5%) | Cannot skip — integral to content |
| **2** | Orange | Mid-left (62.5%) | Can skip but causes frequent interruptions |
| **3** | Yellow | Mid-right (37.5%) | Can skip easily, rare occurrences |
| **0** | Gray | Rightmost (12.5%) | Not present (removes from card) |

### Mustathniyat (المستثنيات — "Exceptions")

Toggle badges for content that is *absent* (opposite logic):
- `لا موسيقى` — No music (icon: `موسيقى0.png`)
- `لا ألفاظ نابية` — No profanity (icon: `ألفاظ نابية0.png`)
- `لا علاقات حب` — No romantic relationships (icon: `علاقات حب0.png`)

### Icon Naming Convention

Icons follow the pattern: `{Arabic name}{severity}.png`
- Base icon (modal display): `كفريات.png`
- Severity-specific: `كفريات1.png`, `كفريات2.png`, `كفريات3.png`
- Exception icons: `موسيقى0.png` (the `0` suffix)
- All icons use `?v=2` cache-busting query param

---

## Layout System

### Two Orientations

| Property | Horizontal | Vertical |
|----------|-----------|----------|
| **Aspect Ratio** | 16:9 | 4:5 |
| **Export Resolution** | 1920×1080 | 1200×1500 |
| **CSS Layout** | Flexbox row | Absolute positioning |
| **Synopsis Controls** | Visible | Hidden |
| **Poster** | Left column, A4 ratio (1:1.414) | Absolute, right side (44% width) |
| **Synopsis** | Flexbox right column | Absolute, left side (41% width) |
| **Icons** | Bottom of right column | Absolute, bottom center |
| **Watermark** | Below poster (horizontal-only element) | Below poster (vertical-only element) |

### Container Queries

The preview panel uses `container-type: size` for responsive sizing. All canvas text sizes use `cqw` (container query width) units in live preview but are **overridden to fixed pixel values in export mode** to ensure html2canvas compatibility.

### Export Mode (`export-mode` class)

When exporting, a clone of the preview is created at full resolution with the `.export-mode` class applied. This class:
- Converts all `cqw` units to fixed pixel values
- Forces exact pixel dimensions (1920×1080 or 1200×1500)
- Overrides `-webkit-box` display to `block` (html2canvas compatibility)
- Disables `backdrop-filter` (not supported by html2canvas)
- Hardcodes absolute pixel coordinates for vertical layout elements

---

## PHP Proxy (`proxy.php`)

### Supported `type` Parameter Values

| Type | API | Auth Required | Notes |
|------|-----|--------------|-------|
| `movie` | TMDB search | TMDB_KEY | Filters out Japanese content |
| `tv` | TMDB search | TMDB_KEY | Filters out Japanese content |
| `movie_details` | TMDB details | TMDB_KEY | Fetches runtime, genres |
| `tv_details` | TMDB details | TMDB_KEY | Fetches episode count, genres |
| `game` | RAWG search | RAWG_KEY | Filters NSFW tags, max 5 results |
| `game_details` | RAWG details | RAWG_KEY | Fetches description, playtime |
| `game_cover` | SteamGridDB | STEAMGRIDDB_KEY | Searches game → fetches 600×900 grid |
| `anime` | Jikan v4 | None | Excludes Hentai (genre 12) |
| `manga` | Jikan v4 | None | Excludes Hentai (genre 12) |
| `book` | Open Library | None | Free, no rate limits |
| `image_proxy` | Passthrough | None | Proxies any image URL for CORS |
| `translate` | Google GTX | None | Free Google Translate endpoint |
| `log` | Local file | None | POST — appends JSONL to `data/classifications.jsonl` |
| `stats` | Local file | None | GET — returns aggregate counts |

### Key Filters
- **`filterAnimeFromTMDB()`**: Removes Japanese-origin content from TMDB results (JP origin_country or ja original_language) — anime should be searched via Jikan instead
- **`filterNSFWFromRAWG()`**: Removes games tagged with `eroge`, `hentai` only — mainstream mature tags (`nudity`, `sexual-content`) are intentionally allowed so users can classify those games

### SSL Configuration
- `CURLOPT_SSL_VERIFYPEER` and `CURLOPT_SSL_VERIFYHOST` are both set to `false` for development
- A `cacert.pem` bundle is included for production use

---

## Key Design Decisions & Adjustments Made

### Synopsis Scaling System
- **Auto mode**: Iteratively checks `scrollHeight > clientHeight` and applies classes: `scale-medium` (85%), `scale-heavy` (75%), `scale-extreme` (65%)
- **Manual mode**: User can override with 5 sizes: Auto, ص (Small/70%), م (Medium/85%), ك (Large/100%), ض (XL/115%)
- Synopsis controls are **hidden in vertical layout** — only visible in horizontal
- Auto-scaling runs on `requestAnimationFrame` after every preview update and on debounced input (300ms)
- Synopsis is clipped to 8 lines in horizontal, 24 lines in vertical

### Title Dynamic Sizing
- **Horizontal**: Uses `data-length` attribute (`medium`/`long`/`xl`) based on character count thresholds (20/40/60)
- **Vertical**: Auto-fit to single line via `fitVerticalTitle()` — iteratively shrinks through 3 scale steps (`0.75x` → `0.6x` → `0.5x`). If title has >5 words and still overflows at minimum size, applies `single-line-clamp` (CSS `white-space: nowrap; text-overflow: ellipsis`)
- Export-compatible: single-line clamp uses `white-space: nowrap` instead of `-webkit-line-clamp` (html2canvas safe)

### Export Compression Pipeline
1. html2canvas renders at 1x scale (container is already full resolution)
2. `rescaleSynopsisInClone()` re-runs auto-scaling on the clone at export dimensions (preview scale classes are wrong for 1920×1080)
3. `compressToMaxSize()` iteratively scales down (1.0→0.3 in 0.1 steps)
4. Hard cap: 2MB maximum file size
5. Output: always PNG format
6. Filename: `CCCC-{slug_or_title}.png`

### Content Type Dropdown
- Originally implemented as horizontal pill buttons
- Refactored into a custom dropdown (`#type-dropdown`) to save space
- Supports: أنمي, مانجا, فيلم, مسلسل, لعبة, كتاب, يدوي (Manual)

### Manual Mode
- Enables contentEditable on title, genre, and score
- Shows upload overlay on poster for custom image upload
- Uses FileReader to convert uploaded image to data URL
- Resets all ratings and badges on type switch

### Watermark System
- Two watermark elements exist in HTML: `.horizontal-only` and `.vertical-only`
- Toggled via CSS based on `.horizontal`/`.vertical` class on parent
- Appears when user types in "المُصنّف" (Classifier) input
- Detects English text (Latin/@ prefix) and forces LTR direction
- In export: `backdrop-filter` is stripped (html2canvas can't render it)
- **Vertical export centering**: Uses `left: 51%; right: 5%; margin: auto; transform: none` instead of `translateX(50%)` — html2canvas renders margin-based centering more accurately than CSS transforms

### Game Cover Pipeline
- RAWG provides only landscape screenshots, not vertical posters
- SteamGridDB is used to fetch vertical grid art (600×900)
- Covers are prefetched in background when search results appear
- Cached in `gameCoverCache` object for instant selection
- All images proxied through `proxy.php?type=image_proxy` for CORS

### Translation System
- Genre names: dictionary lookup in `translations.js` (~85 entries)
- Synopsis/descriptions: Google GTX free endpoint, proxied through PHP
- Translations cached in `localStorage` with key prefix `trans_`
- Shows "جاري الترجمة..." (Translating...) placeholder during async fetch

### Arabic Plural Formatting
- `formatArabicPlural(count, type)` handles Arabic grammar rules:
  - 1 = singular (حلقة واحدة)
  - 2 = dual (حلقتان)
  - 3-10 = plural (حلقات)
  - 11+ = singular noun (حلقة)
- Supports: episode, chapter, volume, minute, hour, page

### Drag System (Disabled)
- `interact.js` implements mouse drag + scroll-to-zoom for canvas elements
- `setDragState(false)` is called on every orientation change
- Was disabled per user request to prevent accidental element movement
- Targets: `.classification-label`, `#title-text`, `.stickers-grid-canvas`

---

## CSS Architecture Notes

### Grid Layout (Desktop)
```
.card-container: grid 1fr 2fr / auto 1fr auto
  Column 1 (33%): .top-controls (spans rows 1-2)
  Column 2 (66%): .card-header (row 1), .info-panel (row 2)
  Full width: .card-footer (row 3)
```

### Mobile Responsive (≤900px)
- Switches to `display: flex; flex-direction: column`
- Order: Header → Controls → Preview → Footer
- Vertical panel uses `aspect-ratio: 2/3` instead of fixed height

### Export Mode Pixel Overrides (Vertical)
These exact pixel values were carefully tuned to match live preview:
```css
.export-mode.vertical .header-info     { top: 45px }
.export-mode.vertical .poster-container { top: 390px; right: 60px; width: 528px; height: 792px }
.export-mode.vertical .synopsis-wrapper { top: 390px; left: 60px; width: 492px; height: 792px }
```

### Color System
```css
--bg-body: #dedede        /* Page background */
--bg-card: #5c5c5c        /* Card container */
--accent-green: #7cb342   /* Active states, toggles, genre pills */
--accent-red: #c0392b     /* Severity 1, warnings */
--accent-orange: #e67e22  /* Severity 2 */
--accent-yellow: #f1c40f  /* Severity 3, score badge */
--accent-blue: #2980b9    /* Export button, stats pills, watermark label */
```

### Modal Category Colors
- Purple `#9b59b6` — Doctrinal/theological concerns
- Red `var(--accent-red)` — Moral/explicit content
- Teal `#1abc9c` — Game mechanic exploitation

---

## Known Gotchas & Pitfalls

1. **html2canvas limitations**: Cannot render `backdrop-filter`, `-webkit-box` display, `letter-spacing` on Arabic text, or `<canvas>` bitmap content (must manually copy via `drawImage`)
2. **CORS**: All external images must be proxied through `proxy.php?type=image_proxy` or html2canvas export will fail with tainted canvas
3. **RTL layout**: Rating bar percentages are calculated from RIGHT edge. `percentFromRight = 1 - (x / width)`. CSS uses `right:` positioning for knob
4. **Synopsis `contenteditable`**: Uses `innerText` not `value`. Character limit (350) and line limit (4 for input, 8 for display) enforced manually
5. **Export clone**: `cloneNode(true)` does NOT copy `<canvas>` bitmap data. The blurred background canvas must be manually re-drawn onto the clone
6. **Mobile CSS nesting**: There is a nested `@media` query inside another — `@media (max-width: 768px)` contains `@media (max-width: 900px)` which is a known structural quirk
7. **State mutations**: `state` is a plain mutable object imported by reference. All modules mutate it directly — no immutability or events
8. **TMDB language**: Changed from `ar-SA` to `en-US` for API queries so that translation can happen client-side via the proxy
9. **Jikan rate limits**: No API key needed but the Jikan API has rate limits. No retry logic implemented
10. **`data/*.jsonl` is gitignored**: Classification logs are local-only
11. **Export synopsis scaling mismatch**: Preview auto-scale classes (set at ~700px width) are wrong for export (1920px). `rescaleSynopsisInClone()` in `export.js` re-runs the scaling on the clone at full resolution before html2canvas captures it
12. **Vertical export pixel coordinates**: When moving poster/synopsis `top` values, the watermark (`top: 80%`) and icons (`bottom: 1.5%`) must be adjusted too — they're positioned independently

---

## Development History (Conversation Summary)

| Date | Topic | Key Changes |
|------|-------|-------------|
| Feb 2025 | **Initial Build** | Core app structure, search, preview, export |
| Feb 2025 | **UI Controls Refactoring** | Type buttons → custom dropdown, synopsis size controls, browser checks |
| Feb 2025 | **Synopsis Scaling** | Replaced icon-count-based scaling with overflow-detection auto-scaling |
| Feb 2025 | **Synopsis Manual Controls** | Added Auto/S/M/L size buttons (horizontal only) |
| Mar 2025 | **Search Debugging** | Identified need for `php -c php.ini` flag, wrote DEBUG_GUIDE.md |
| Mar 2025 | **Values & Grades Revamp** | Transformed flat table into three bold severity cards with glowing badges |
| Mar 2025 | **XL Synopsis Size** | Added "ض" (Extra Large) button at 115% scale |
| Mar 2025 | **Vertical Layout Fix** | Tuned export pixel coordinates to match live preview exactly |
| Mar 2025 | **Export Compression** | Reduced from 3x to 1x scale, added iterative PNG compression to ≤2MB |
| Apr 2025 | **Export Layout Harmonization** | Moved vertical poster/synopsis up 60px, watermark to 76%, icons to bottom 4%; watermark centering via margin-auto instead of translateX |
| Apr 2025 | **Vertical Title Auto-Fit** | Auto-shrink titles to 1 line (3 scale steps), ellipsis fallback for >5 words; replaced duplicated app.js handler with shared adjustTitleSize() |
| Apr 2025 | **Export Synopsis Re-Scaling** | Added rescaleSynopsisInClone() — strips preview scale classes and re-evaluates at export resolution |
| Apr 2025 | **RAWG Filter Relaxation** | Narrowed NSFW filter from 5 tags to 2 (eroge/hentai only) — allows mainstream mature games to be classified |
| Apr 2025 | **CLAUDE.md** | Comprehensive project documentation created |

---

## Quick Reference: Common Tasks

### Adding a New Content Category
1. Add entry to `CATEGORIES.Mawjoodat` in `js/constants.js`
2. Create icon PNGs: `{name}.png`, `{name}1.png`, `{name}2.png`, `{name}3.png` in `assets/icons/`
3. Add modal HTML entry in `index.html` under the appropriate color group
4. If game-only, add `type: 'game_only'` to the category definition

### Adding a New Media Type
1. Add dropdown item in `index.html` (`#type-dropdown .dropdown-menu`)
2. Add API route in `proxy.php` switch statement
3. Handle response parsing in `ui.js` → `showSearchResults()` and `selectItem()`
4. Add genre translations to `translations.js`

### Adjusting Export Layout
1. Live preview uses `cqw` units — modify CSS custom properties
2. Export mode uses hardcoded pixel values — modify `.export-mode` rules at bottom of `style.css`
3. Always test both horizontal AND vertical exports after changes
4. Remember: html2canvas cannot render `backdrop-filter`, `-webkit-box`, or copied `<canvas>` bitmaps

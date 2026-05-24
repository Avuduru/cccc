# The Poster System: Architecture & Design

The **Poster** is the visual anchor of the CCCC trading card. The system is designed to handle different source ratios, fetch high-quality vertical assets across diverse APIs, apply modern aesthetics (such as ambient back-glow), and ensure a seamless high-fidelity export.

---

## 1. Dimensional Blueprint & Aspect Ratios

To maintain strict layout stability between the live browser preview and the exported PNG image, the application relies on carefully calculated mathematical aspect ratios.

| Layout Mode | View State | Container Sizing Rules | Resulting Aspect Ratio | Core CSS Selectors |
| :--- | :--- | :--- | :--- | :--- |
| **Horizontal** | **Preview** | `height: calc(100% - 50px);` | **1:1.414** (ISO A4 Paper) | `.horizontal .poster-container` |
| **Horizontal** | **Export** | Standard fluid dimensions inside `1920x1080` canvas | **1:1.414** (ISO A4 Paper) | `.export-mode.horizontal` |
| **Vertical** | **Preview** | Card: `calc(height * 0.8)` (4:5)<br>Poster: `width: 44%`, `height: 52.8%` | **2:3** (Standard Poster) | `.vertical .poster-container` |
| **Vertical** | **Export** | Explicit pixel locks: `width: 528px`, `height: 792px` | **2:3** (Standard Poster) | `.export-mode.vertical .poster-container` |

### The Vertical Aspect Ratio Magic
In the Vertical live preview, the card has a `4:5` aspect ratio. By setting the absolute-positioned poster width to `44%` and height to `52.8%`, we achieve:
$$\text{Aspect Ratio} = \frac{0.44 \times 0.8}{\text{height}} \div (0.528 \times \text{height}) = \frac{0.352}{0.528} = \mathbf{2:3}$$
This matches the exact `2:3` standard poster aspect ratio used in standard trading cards and movie posters, maintaining flawless parity between preview and vertical export formats.

---

## 2. Dynamic Asset Fetching by Content Type

Because the application aggregates six distinct media types, it implements tailored asset pipelines to ensure high-quality vertical covers are selected:

### 1. Movies & TV Shows (`movie` / `tv`)
*   **Upstream Source**: The Movie Database (TMDB).
*   **Resolution**: Fetches the `w500` directory size (500x750 pixels).
*   **Physical Ratio**: Native `2:3`.
*   **Security Pipeline**: Routed through the PHP proxy `proxy.php?type=image_proxy` to bypass CORS restrictions and prevent tainted canvas failures during PNG generation.

### 2. Video Games (`game`)
*   **The Challenge**: RAWG (the metadata provider) only provides horizontal screenshots, banners, and game capsules, which look compressed or distorted in a vertical card frame.
*   **The Solution**: The JS engine triggers an asynchronous secondary query to **SteamGridDB** using the game's sanitized title.
*   **Resolution**: It explicitly requests grid dimensions of `600x900` (which is standard `2:3` and high-density, at 600px width), caching the result locally in `gameCoverCache`.

### 3. Anime & Manga (`anime` / `manga`)
*   **Upstream Source**: Jikan API (MyAnimeList wrapper).
*   **Resolution**: Fetches MAL's high-definition vertical covers via `large_image_url` (ranging from 350x500 to 450x650 pixels).
*   **Physical Ratio**: Native `2:3` vertical poster ratio.

### 4. Books (`book`)
*   **Upstream Source**: Open Library cover database (or Google Books thumbnail URL as fallback).
*   **Resolution**: Fetches the `L` (large) size suffix (`-L.jpg`) from Open Library.
*   **Physical Ratio**: Varied (ranging from 1:1.4 to 1:1.6). 
*   **Containment**: The application sets `background-size: cover` and `background-position: center` inside `.poster-div` to automatically scale and center the book cover, clipping any minor excesses to fit the clean `2:3` border perfectly without skewing the art.

---

## 3. Premium Aesthetics & UI Interactivity

The poster container is not just a static image; it is highly integrated with the site's rich, responsive theme:

### A. Ambient Dynamic Back-Glow (`#poster-bg`)
Whenever a poster is successfully resolved, the `drawBlurredBackground(url)` helper function runs:
1.  It creates a new in-memory canvas.
2.  It sets its resolution to `1.2x` the display width/height for optimal pixel density.
3.  It applies a canvas filter `ctx.filter = 'blur(15px)'`.
4.  It draws a scaled-cover slice of the poster onto the canvas backdrop.
This results in a gorgeous, modern, color-accurate ambient gradient glow that dynamically adapts to whatever content is currently loaded on the card!

### B. Manual Upload Mode (`.manual-mode`)
When the user switches to Manual mode, the poster becomes an interactive upload zone:
*   A premium upload mask (`.upload-overlay`) fades in on hover.
*   Clicking the container opens a file dialog.
*   A `FileReader` reads the image, translates it to a Base64 Data URL, sets it as the poster background, and triggers `drawBlurredBackground()` to instantly update the ambient glow in real-time.

### C. Watermark & Branding Positioning
*   **In Vertical Mode**: The `.modern-watermark` (branding pill) is absolute-positioned directly underneath the `.poster-container` (`top: 100%; left: 50%; transform: translateX(-50%)`).
*   **In Horizontal Mode**: The watermark is positioned at the bottom of the left-hand column wrapper.

### D. Layered Legibility Gradient Overlay (The "Vertical Scrim")
One of the most critical styling differences between layouts is the presence of an absolute-positioned overlay gradient on the vertical poster container, which is entirely absent from the horizontal layout:

```css
/* Enabled only in Vertical Mode */
.vertical .poster-container::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.4) 0%,
        rgba(0, 0, 0, 0) 25%,
        rgba(0, 0, 0, 0) 50%,
        rgba(0, 0, 0, 0.7) 75%,
        rgba(0, 0, 0, 0.95) 100%
    );
}
```

#### Why it exists in Vertical Mode:
1.  **Layered Text Legibility (Top Fade)**: In Vertical Mode, the classification label and card title (`.header-info`) are placed at the absolute top of the card, overlaying or sitting extremely close to the top of the poster. If a loaded poster has a bright top half (e.g., sky, white backgrounds), the white title text would wash out. The `rgba(0,0,0,0.4)` top gradient acts as a protective "scrim" ensuring perfect text legibility.
2.  **Card Integration & Depth (Bottom Fade)**: The bottom portion of the vertical card holds stickers and branding. The `rgba(0,0,0,0.95)` fade at the bottom of the poster elegantly blends the cover image into the card's dark frame, establishing a premium sense of physical depth and making the bottom stickers pop.

#### Why it is absent in Horizontal Mode:
*   **No Spatial Overlaps**: In Horizontal Mode, the layout is strictly split into side-by-side columns. The poster has its own dedicated left-hand column (`.poster-column`), while all titles, ratings, synopsis, and metadata live in the right-hand column (`.info-content-right`).
*   **Zero Interference**: Since there is no text or floating UI elements overlapping the horizontal poster, no protective gradient mask is required. The poster is shown in its raw, crisp, unfiltered state.


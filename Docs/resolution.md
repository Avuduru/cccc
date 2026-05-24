# Resolution & Aspect Ratio Independence — Internal Reference

> This file is gitignored. It serves as documentation on how the application handles differing monitor resolutions and aspect ratios for both the Live Preview and the Export engine.

---

## 1. Do Layouts Change Based on User Monitors?
**No. The arrangement of elements is mathematically identical across all monitors, regardless of resolution or aspect ratio.**

Whether a user is on a `1280x720` (720p) laptop, a `3440x1440` (Ultrawide) monitor, or a `3840x2160` (4K) display, the relative sizing, font boldness, and positioning of stickers will be exactly the same. 

### Why the Monitor's Aspect Ratio (16:9, 16:10, 21:9) Doesn't Matter
The application completely isolates the preview canvas from the viewport's aspect ratio.
- The **Horizontal Canvas** forces a strict `16:9` aspect ratio.
- The **Vertical Canvas** forces a strict `4:5` aspect ratio.
If the user's monitor is Ultrawide (21:9), the canvas simply stops growing horizontally and centers itself in the middle of the screen with empty space on the sides. It never stretches to fill the monitor.

---

## 2. How the Live Preview Unifies Across Screens
To ensure everyone sees the exact same layout regardless of their screen's pixel count, the Live Preview relies on **Container Queries (`cqw`)** instead of Viewport Units (`vw`) or static pixels (`px`).

* `1cqw` equals exactly 1% of the `#preview-canvas` width. 
* All fonts, gaps, and paddings are defined in `cqw` or `%`.

**Example:**
If the title font size is `3cqw`, and the user is on a 720p screen where the canvas is `500px` wide, the font is mathematically calculated to `15px`.
If they move to a 4K screen where the canvas expands to `1000px` wide, the font recalculates to `30px`. 
The text will occupy the *exact same visual percentage* of the poster on both screens.

---

## 3. How Export Mode Unifies Across Screens
The `html2canvas` library natively tries to take a snapshot of the screen as the user currently sees it. If we allowed this, a user on a 4K screen would export a massive 15MB file, while a user on a 720p laptop would export a blurry 500KB file.

To prevent this, the export engine (`js/export.js`) **completely hijacks the rendering pipeline**:
1. It clones the canvas and moves it completely off-screen (`left: -9999px`).
2. It explicitly forces the clone to a **hardcoded master resolution**, completely ignoring the user's monitor:
   - **Horizontal Export:** Locked to `1920px` width.
   - **Vertical Export:** Locked to `1200px` width.
3. It passes `windowWidth: exportWidth` and `scale: 1` directly to `html2canvas`. This forces the library to hallucinate that the user is running a monitor perfectly sized for the export.
4. Finally, the `.export-mode` CSS class strips out all `cqw` units and replaces them with strict `px` values that perfectly match the `1920px` or `1200px` scale.

### Conclusion
Because the system is isolated via Container Queries for the preview, and Hardcoded Pixel Overrides for the export, **the user's physical hardware has absolutely zero impact on the final visual arrangement or export quality.** You do not need to build polyfills or layout tweaks for specific resolutions.

---

## 4. Investigated Anomalies: "Why do my fonts look bolder and stickers bigger on a 1440p screen vs 1080p?"

If users report that Live Preview looks vastly different between two monitors (e.g., a 2560x1440 monitor vs a 1920x1080 monitor), it is caused by two very specific CSS leaks where monitor hardware overrides the canvas isolation.

### A. The Sticker Size Discrepancy (`vh` vs `cqh`)
In the CSS, `.sticker-item` had a safety cap of `max-width: 15vh;`. 
- `vh` stands for **Viewport Height** (the physical height of the browser window).
- On a 1080p monitor, `15vh` is roughly `162px`. The stickers hit this ceiling quickly and shrink.
- On a 1440p monitor, `15vh` is roughly `216px`. The stickers are permitted to grow much larger before hitting the ceiling.
**How it was fixed**: We replaced `vh` (monitor height) with `cqh` (Container Query Height). By using `max-width: 19.4cqh;`, the sticker cap is tied strictly to the height of the `#preview-canvas`, guaranteeing identical proportions across all screens (and matching the 19.4% pixel scale used in Export Mode).

### B. The Font Boldness Discrepancy (Subpixel Anti-aliasing)
The title uses `Handjet`, a variable font designed to look like a retro pixel grid.
- Live Preview fonts are sized using `cqw` (e.g., `5.5cqw`). 
- On different monitors, `5.5cqw` calculates to fractional pixel values (e.g., `42.7px` vs `58.3px`).
- When a high-DPI monitor (like 1440p or 4K) tries to render a rigid "pixel" font at a fractional size, the OS applies **subpixel anti-aliasing** to blur the edges so it fits. This blurring visually bloats the font, making it look much thicker and bolder than on a standard 1080p screen.
- Additionally, because `Handjet` is a variable font, browsers can sometimes hallucinate faux-bolding if the explicit variation axis isn't locked.
**How it was fixed**: We explicitly declared `font-variation-settings: "wght" 900;` and bumped `font-weight: 900;` on `.header-info h2` to lock the variable axis. This forces the boldest possible visual rendering natively, bypassing OS-level anti-aliasing discrepancies and ensuring the thickest appearance on all screens.

### C. Alignment Shifts in Export Mode (`transform` bug)
If you notice that elements perfectly centered in Live Preview suddenly shift to the left in Export Mode (like the Classifier Pill), it is caused by a known `html2canvas` bug.
- `html2canvas` frequently fails to properly calculate `transform: translateX(-50%)` for absolutely positioned clones off-screen.
**How it was fixed**: We stripped `transform` from the `.export-mode` CSS entirely. Instead, we now use the native browser centering method: `left: 0; right: 0; margin: 0 auto; width: max-content;`. This guarantees perfect centering mathematically without relying on transforms.

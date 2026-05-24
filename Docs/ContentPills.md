# Content Pills System (Genres, Score, Episodes) — Internal Reference

> This file is gitignored. It serves as a structural and layout reference for AI agents or developers working on the CCCC codebase.

---

## What are Content Pills?
Content Pills are the horizontal badges that display the genres, score, and episode count right below the main title. They are grouped inside a flex container called `.genre-row`.

## DOM Structure
```html
<div class="header-info">
    <h2 id="title-text">Title</h2>
    <div class="genre-row">
        <!-- Generated dynamically via JS -->
        <span class="genre-pill stats-pill">15 حلقة</span>
        <span class="genre-pill stats-pill">★ 8.32</span>
        <span class="genre-pill">غموض</span>
        <span class="genre-pill">رومانسي</span>
        <span class="genre-pill">خارق للطبيعة</span>
    </div>
</div>
```

---

## The Single-Line Layout Constraint
A critical UI requirement for **Vertical Mode** is that the `.genre-row` must *never* wrap to a second line. 

### Why?
If a show has many genres (e.g., 6+ tags) and the pills wrap to a second line, the `.header-info` container grows taller. The safety function `adjustVerticalPositions()` in `js/ui.js` monitors the header's height. If the header grows too tall, it dynamically pushes the `.poster-container` downwards to prevent text overlap. 
Because the Classifier Pill (`.modern-watermark`) is rigidly anchored to the bottom of the poster, pushing the poster down will ram the pill directly into the sticker grid at the bottom of the canvas, ruining the layout.

### How we enforce the Single-Line Rule
1. **CSS Constraint (`style.v3.css`)**: 
   - `.vertical .genre-row` is strictly set to `flex-wrap: nowrap !important;`.
   - The individual `.genre-pill` elements are set to `flex-shrink: 1`, `white-space: nowrap`, and `overflow: hidden`.
2. **JS Downscaling Algorithm (`js/ui.js`)**:
   - Because `flex-shrink` with `nowrap` can cause the text to violently compress and clip, we use a Javascript algorithm `fitGenreRow()`.
   - Whenever the UI updates, the algorithm measures if the pills are overflowing the canvas width (`el.scrollWidth > el.clientWidth`).
   - If they overflow, the JS sequentially applies CSS scaling classes (`.genre-scale-1`, `.genre-scale-2`, `.genre-scale-3`) which progressively reduce the font-size and padding of the pills.
   - It stops shrinking the exact moment the pills naturally fit on a single line.

## Horizontal Mode Differences
In **Horizontal Mode**, vertical space is not aggressively restricted because the layout is a flex row (the poster is on the left, text on the right). Therefore, the `.genre-row` is allowed to `flex-wrap: wrap;` and can comfortably take up 2 or 3 lines without breaking the layout or causing collisions.

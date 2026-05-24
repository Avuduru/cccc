# Dynamic Vertical Ecosystem — Internal Reference

> This file is gitignored. It is a reference for AI agents working on this codebase to understand how elements in the Vertical layout interact dynamically to preserve spacing.

---

## The Zero-Sum Layout Concept

The Vertical Mode (both in Live Preview and Export) operates in a strictly constrained `4:5` aspect ratio. Because the vertical space is finite, the layout functions as a **zero-sum game**: if an element at the top grows, an element at the bottom must shrink to prevent collision.

The priority sequence for rendering is:
1. **The Header & Title** (Top-down flow).
2. **The Poster** (Pushed down by the header).
3. **The Classifier Pill** (Anchored flush to the bottom of the poster).
4. **The Sticker Grid** (Anchored to the absolute bottom of the canvas).

Because the Classifier Pill is permanently bound to the Poster, if a long title pushes the Poster downwards, the Classifier Pill is rammed into the Sticker Grid. 

To solve this, a JS Allocator engine governs the layout automatically.

---

## 1. The JS Layout Allocator (`adjustVerticalPositions`)

Located in `js/ui.js`, this function fires on every render update.

### How it protects space:
1. **Measures the gap**: It calculates exactly how many pixels exist between the bottom of the Poster (including the Classifier Pill) and the bottom of the canvas.
2. **Enforces Pill Padding**: It reserves a mandatory `2.5%` padding above and below the Classifier Pill.
3. **Allocates Sticker Height**: Whatever pixel space remains after the padding is assigned to the `.stickers-grid-canvas` as its maximum allowed height.
4. **Calculates Sticker Width (Export Fix)**: To bypass an `html2canvas` bug where `flex-shrink` warps aspect ratios, the engine divides the available canvas width by the number of active stickers (accounting for gaps). It then explicitly sets both `width` and `height` in pixels for every sticker, guaranteeing perfect squares.

---

## 2. Smart 2-Line Title Shrinking (`.has-2-line-title`)

Because 2-line titles consume massive vertical space (~100+ pixels), they punish the stickers severely by triggering the JS Allocator to drastically shrink the bottom gap.

To prevent stickers from being unnecessarily punished, we intelligently scale down the elements *above* the poster ONLY when a 2-line title is detected.

### The Trigger Flow:
1. In `fitVerticalTitle()` (`js/ui.js`), the title element is mathematically measured. 
2. If `el.scrollHeight > 1.5 * line-height`, the browser confirms the text has naturally wrapped to two lines.
3. The JS injects the class `.has-2-line-title` onto the `#preview-canvas`.

### The CSS Relief (The 50% Rule):
When `.has-2-line-title` is active in **Export Mode** and **Live Preview**, specific CSS rules (`style.v3.css`) activate to aggressively reclaim space:
- The top classification brand text (`.classification-label`) shrinks from `50px` to `36px`.
- Its bottom margin shrinks from `15px` to `8px`.
- The main title (`h2`) completely bypasses normal progressive scaling and is instantly crushed by **exactly 50%**.
  - *Preview*: Drops from `0.9` multiplier to `0.45`.
  - *Export*: Drops from `102.6px` to exactly `51.3px`.

This instantly reclaims over 90 pixels of vertical real estate *before* the Poster is positioned. As a result, the Poster is pushed down far less, preserving a grand space for the stickers below! Because these rules target `.has-2-line-title`, **1-line titles remain 100% unaffected and beautiful.**

---

## Summary of Element Interactions

| Action | Reaction | CSS/JS Mechanism |
|---|---|---|
| User types a 1-line title | Header stays compact. Poster stays high. | Standard CSS. |
| User types a 2-line title | Title wraps. JS detects wrap and adds `.has-2-line-title`. Header elements shrink. Poster drops slightly. | `fitVerticalTitle()` & `style.v3.css` |
| Poster drops closer to stickers | JS Allocator calculates smaller remaining gap. | `adjustVerticalPositions()` |
| Stickers need to render in gap | JS explicitly injects pixel `width` & `height` to fit safely. | `adjustVerticalPositions()` |
| User triggers Export Mode | JS runs on clone, freezing explicit pixel math for html2canvas. | `renderToBlob()` |

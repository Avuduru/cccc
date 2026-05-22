# Sticker System — Internal Reference

> This file is gitignored. It is a reference for AI agents working on this codebase.

---

## What Are Stickers?

Stickers are the **classification icons** rendered at the bottom of the card preview and export. Each sticker represents a content warning category (e.g. كفريات, جنس, شذوذ, سحر, مفاسد, تعري, صادم) or an exception badge (e.g. موسيقى٠, ألفاظ نابية٠). They are PNG images loaded from `assets/icons/`.

The filename pattern is `{category_id}{severity_level}.png` (e.g. `جنس1.png` for severity 1, `موسيقى0.png` for an exception toggle).

---

## File Locations

| Concern | File | Key Lines |
|---|---|---|
| **HTML structure** | `index.html` | L237 — `<div id="active-stickers" class="stickers-grid-canvas">` |
| **Sticker rendering (JS)** | `js/ui.js` | L318–384 — `updatePreview()` builds the sticker DOM |
| **Category definitions** | `js/constants.js` | `CATEGORIES.Mawjoodat` and `CATEGORIES.Mustathniyat` |
| **Preview CSS (base)** | `style.v3.css` | L1293–1398 — `.stickers-container`, `.stickers-grid-canvas`, `.sticker-item` |
| **Preview CSS (vertical overrides)** | `style.v3.css` | L1302–1347, L1839–1857 — `.vertical .stickers-grid-canvas`, `.vertical .sticker-item` |
| **Export CSS (horizontal)** | `style.v3.css` | L1803–1828 — `.export-mode.horizontal .stickers-*` |
| **Export CSS (vertical)** | `style.v3.css` | L1829–1877 — `.export-mode.vertical .stickers-*` |
| **Export pipeline (JS)** | `js/export.js` | L107–184 — `renderToBlob()` clones the card DOM and runs html2canvas |
| **Sticker icon assets** | `assets/icons/` | PNG files, ~200×200px each |

---

## DOM Hierarchy

```
#preview-canvas (.info-panel .horizontal|.vertical)
└── .canvas-content
    ├── .poster-column
    │   ├── .poster-container > .poster-div
    │   └── .modern-watermark.horizontal-only
    └── .info-content-right
        ├── .modern-watermark.vertical-only
        ├── .header-info (title, genres, score)
        ├── .synopsis-wrapper
        └── #active-stickers (.stickers-grid-canvas)  ← STICKERS
            ├── .sticker-item > img
            ├── .sticker-item > img
            └── ...
```

**Important**: The stickers live inside `.info-content-right`, NOT inside `.poster-column`. In horizontal mode, `.info-content-right` is `flex:1` and fills the space to the left of the poster. In vertical mode, `.info-content-right` is `display:block; width:100%; height:100%` and the sticker grid is absolutely positioned at the bottom.

---

## How Stickers Are Built (JS)

In `js/ui.js` → `updatePreview()`:

1. Collects all active ratings from `state.ratings` (severity > 0) in the order defined by `CATEGORIES.Mawjoodat`.
2. Collects all active exception toggles from `state.badges`.
3. For each, creates a `.sticker-item` div containing an `<img>` pointing to `assets/icons/{icon}{level}.png`.
4. Appends all to `#active-stickers`.
5. If ≤4 stickers, adds class `.few-icons` to the grid (wider spacing/sizing).

---

## CSS Design — Preview (Live)

### Horizontal Preview

```
.stickers-grid-canvas         → flex, nowrap, justify-content:center, gap:0.4cqw, padding:1cqw, width:100%
.horizontal .stickers-grid-canvas → width:100%, max-width:100%
.sticker-item                  → flex:0 1 auto, width:18%, max-width:15vh, aspect-ratio:1/1
```

- **Containment**: `.info-content-right` is `flex:1` inside the row, so it only gets the width remaining after the poster column. The stickers' `width:18%` is 18% of that remaining width. `flex-shrink:1` (default from `flex:0 1 auto`) lets items compress when there are many.
- **Units**: `cqw` (container query width) for gap/padding — works natively in browsers, NOT in html2canvas.

### Vertical Preview

```
.vertical .stickers-grid-canvas → position:absolute, bottom:1.5%, left:0, right:0, width:100%, z-index:10
.vertical .sticker-item         → width:17%, max-width:169px, aspect-ratio:unset, height:auto, align-self:flex-end
```

- **Containment**: Grid is absolutely positioned spanning the full card width. Items use percentage width (`17%`) with a px cap (`169px`). Default `flex-shrink:1` compresses when needed.
- **`.few-icons`** variant (≤4 stickers): `gap:1.5cqw`, items get `width:18%, max-width:200px, flex-shrink:0`.

---

## CSS Design — Export Mode

The export pipeline clones the card DOM, adds class `.export-mode`, places it off-screen at a fixed pixel width (1920px horizontal / 1200px vertical), and renders it via `html2canvas`.

### Why export needs separate overrides

html2canvas **cannot resolve** these CSS units:
- `cqw` (container query width) → resolves to 0 or incorrect values
- `vh` (viewport height) → incorrect in off-screen context

So export-mode overrides replace all `cqw`/`vh` values with explicit `px` values.

### Horizontal Export

```css
.export-mode.horizontal .stickers-grid-canvas {
    gap: 12px; padding: 24px 24px 0 24px;
    align-items: flex-end;
    max-width: 100%;        /* containment */
    overflow: hidden;        /* clip overflow */
    box-sizing: border-box;  /* padding inside width */
}
.export-mode.horizontal .sticker-item {
    padding: 14px 14px 0 14px;
    width: 210px;           /* preferred size */
    flex-shrink: 1;         /* MUST shrink to fit */
}
.export-mode.horizontal .stickers-container {
    max-height: 260px; margin-top: auto;
}
```

### Vertical Export

```css
.export-mode.vertical .stickers-grid-canvas {
    padding: 12px; gap: 9px;
    align-items: flex-end;
    max-width: 100%;        /* containment */
    overflow: hidden;        /* clip overflow */
    box-sizing: border-box;  /* padding inside width */
}
.export-mode.vertical .sticker-item {
    width: 208px;           /* preferred size */
    flex-shrink: 1;         /* MUST shrink to fit */
    aspect-ratio: unset; height: auto; padding: 0;
    align-self: flex-end;
}
```

---

## Critical Rules for Future Edits

### DO NOT

1. **Do NOT set `flex-shrink: 0`** on `.export-mode .sticker-item` — this prevents items from compressing when there are many stickers and causes overflow.
2. **Do NOT set `max-width: none`** on `.export-mode .sticker-item` — this removes the cap and allows unbounded growth.
3. **Do NOT use `cqw`, `vh`, or `vw` units** inside `.export-mode` rules — html2canvas cannot resolve them. Always use `px` or `%`.
4. **Do NOT remove `max-width: 100%` or `overflow: hidden`** from `.export-mode .stickers-grid-canvas` — these are the containment safety net.

### DO

1. **Always use `px` values** for export-mode sticker dimensions.
2. **Keep `flex-shrink: 1`** so the flexbox can compress items when the total exceeds the container width.
3. **Keep `box-sizing: border-box`** on the grid so padding doesn't push items outside.
4. **Test with 7+ stickers** — overflow bugs only manifest with many stickers (≥5 horizontal, ≥6 vertical).

---

## Specificity Chain (CSS cascade order)

For a sticker item in horizontal export, the cascade is:

```
.sticker-item                              (L1349)  → base
.horizontal .stickers-grid-canvas          (L1336)  → horizontal base
.export-mode.horizontal .stickers-grid-canvas (L1804) → export override
.export-mode.horizontal .sticker-item      (L1809)  → export override
```

For vertical export:

```
.sticker-item                              (L1349)  → base
.vertical .sticker-item                    (L1844)  → vertical preview override
.export-mode.vertical .stickers-grid-canvas (L1833) → export override
.export-mode.vertical .sticker-item        (L1860)  → export override (wins)
```

Most export rules use `!important` to guarantee they beat preview styles in the off-screen clone.

---

## Overflow Math Reference

### Horizontal (1920px canvas, ~1100-1200px info column)

| Stickers | Total width (210px each + gaps + padding) | Fits? |
|---|---|---|
| 4 | ~936px | ✅ |
| 5 | ~1,158px | ⚠️ Tight |
| 6 | ~1,380px | ❌ Needs shrink |
| 7 | ~1,602px | ❌ Needs shrink |

### Vertical (1200px canvas, 1200px grid width)

| Stickers | Total width (208px each + gaps + padding) | Fits? |
|---|---|---|
| 4 | ~883px | ✅ |
| 5 | ~1,100px | ✅ |
| 6 | ~1,317px | ❌ Needs shrink |
| 7 | ~1,534px | ❌ Needs shrink |

With `flex-shrink: 1`, the browser compresses items proportionally to fit. With `flex-shrink: 0`, they overflow.

# Preview Canvas Architecture — Internal Reference

> This file is gitignored. It serves as a structural and layout reference for AI agents or developers working on the CCCC codebase.

---

## What is the Preview Canvas?
The "Preview Canvas" (ID: `#preview-canvas`) is the live, interactive WYSIWYG element in the center of the web application. It displays the user's customized design (poster, title, synopsis, stickers, pills) in real-time. 
It is wrapped by `.info-panel`, which provides the scaling and background context.

---

## Structural Core (`.info-panel`)

The `.info-panel` class dictates the base geometry of the canvas. The canvas is purely responsive and scales based on the user's screen size using dynamic CSS variables and `container-type: size`.

### 1. Horizontal Orientation (Live)
- **Aspect Ratio**: `16 / 9`
- **Width**: `100%` of its parent container.
- **Layout Model**: Flexbox (`flex-direction: row`).
- **Structure**:
  - The canvas splits into two primary columns.
  - **Left/Side**: `.poster-column` (Contains the poster image and the horizontal classifier pill). Uses Flexbox to naturally stack the poster and pill with a fixed pixel `gap`.
  - **Right/Main**: `.info-content-right` (Contains the header, synopsis, and stickers). It uses `flex: 1` to fill the remaining width. The stickers are pushed to the bottom using `margin-top: auto`.

### 2. Vertical Orientation (Live)
- **Aspect Ratio**: `4 / 5` (Calculated dynamically: `width = height * 0.8`).
- **Scaling Math**:
  - `--card-h`: `min(720px, 80vh)` (Limits maximum height to prevent screen overflow).
  - `--card-w`: `calc(var(--card-h) * 0.8)`.
- **Layout Model**: Absolute Positioning / Z-Index Layering.
- **Structure**:
  - `.poster-column` uses `display: contents`, meaning it has no physical boundaries.
  - **Poster**: The `.poster-container` is strictly pinned to absolute percentage coordinates (e.g., `top: 22%`, `height: 52.8%`, `width: 44%`). It is assigned `z-index: 15` to ensure it and its children win any stacking conflicts with the stickers.
  - **Classifier Pill**: Anchored inside the `.poster-container` at `top: 100%`. The vertical `margin-top` is dynamically calculated by the `adjustVerticalPositions()` JS Allocator to strictly maintain minimum breathing room, dynamically shrinking the stickers' height if the poster is pushed down.
  - **Text/Info**: Header and Synopsis are pinned to the top-left area using absolute positioning.
  - **Stickers**: The `.stickers-grid-canvas` is pinned strictly to `bottom: 1.5%` with `z-index: 10`.

---

## Dynamic Scaling & Units
To ensure text and gaps scale perfectly as the window resizes, the preview canvas heavily relies on **Container Query Units (`cqw`)** instead of fixed pixels (`px`).
- `1cqw` = 1% of the `.info-panel`'s width.
- Fonts (e.g., `font-size: 2.5cqw`) and gaps scale linearly with the canvas.

## Interaction & "Safe Zones"
Because the vertical mode relies heavily on absolute positioning, the boundaries between elements are fragile. 
- **The Top Zone (0% - 21%)**: Reserved for Header and Title (and the single-line Content Pills). If this zone overflows, a JS safety function (`adjustVerticalPositions`) actively pushes the Middle Zone down to prevent collision.
- **The Middle Zone (22% - 74%)**: Dominated by the `.poster-container` and `.synopsis-wrapper`.
- **The Gap Zone (75% - 84%)**: The buffer space between the poster and stickers. This is where the Classifier Pill rests (anchored at roughly 79%). If the Middle Zone is pushed down dynamically, this gap zone disappears and causes a layout collision.
- **The Bottom Zone (85% - 100%)**: Exclusively reserved for the `.stickers-grid-canvas`.

*(Note: These percentages are approximated based on the CSS rules and are subject to minor flex based on content).*

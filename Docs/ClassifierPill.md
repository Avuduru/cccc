# Classifier / Reviewer Pill System — Internal Reference

> This file is gitignored. It serves as a structural and layout reference for AI agents or developers working on the CCCC codebase.

---

## What is the Classifier Pill?
The "Classifier Pill" (internally referred to as the `.modern-watermark`) is the small overlay badge that displays the name of the person who classified the content. 
It activates when text is typed into the `#reviewer-name-input` field.

Visually, it looks like a sleek, dark glassmorphism pill with white text:
**المُصنّف: [User Name]**

---

## DOM Structure Architecture

Because the Horizontal and Vertical layouts have vastly different CSS containment needs, **two separate instances** of the pill exist in the HTML. They are conditionally displayed/hidden based on the current orientation state.

### Horizontal Mode HTML (`.horizontal-only`)
In Horizontal mode, the pill is grouped together with the poster inside `.poster-column`.

```html
<div class="poster-column">
    <div class="poster-container">
        <div id="poster-img">...</div>
    </div>
    <!-- PILL LOCATION (HORIZONTAL) -->
    <div class="modern-watermark horizontal-only hidden">
        <span class="watermark-label">المُصنّف:</span>
        <span class="name-span"></span>
    </div>
</div>
```

### Vertical Mode HTML (`.vertical-only`)
In Vertical mode, the pill is strictly anchored *inside* the `.poster-container` so it scales directly with the poster image.

```html
<div class="poster-column">
    <div class="poster-container">
        <div id="poster-img">...</div>
        
        <!-- PILL LOCATION (VERTICAL) -->
        <div class="modern-watermark vertical-only hidden">
            <span class="watermark-label">المُصنّف:</span>
            <span class="name-span"></span>
        </div>
        
    </div>
</div>
```

---

## JavaScript Logic (`js/ui.js`)

The logic for updating the pill lives in `js/ui.js` (around line ~240).
When the user types in `#reviewer-name-input`:
1. It loops through **all** instances of `.modern-watermark`.
2. It injects the text into `.name-span`.
3. **Bidi Text Fix**: It checks if the first character is English (Latin/ASCII). If it is, it dynamically applies `direction: ltr` to ensure handles like `@Username` render perfectly, rather than flipping the `@` to the wrong side in an RTL context.
4. It removes the `.hidden` class to make the pills visible.

---

## CSS Layout Mechanics (`style.v3.css`)

The CSS uses sophisticated overrides to handle Live Preview vs. Export Mode.

### 1. Horizontal Mode (Live & Export)
* **Method**: Flexbox Stacking
* **How it works**: The `.poster-column` acts as a `display: flex; flex-direction: column` container with `gap: 15px`.
* **Why it's robust**: The poster and the pill natively stack on top of each other. The browser handles the spacing mathematically, ensuring they never overlap, regardless of window size or export scaling.

### 2. Vertical Mode (Live Preview)
* **Method**: Relative Percentage Anchoring
* **CSS Class**: `.vertical .modern-watermark.vertical-only`
* **How it works**:
  - `position: absolute !important;`
  - `bottom: -8%;` (Places it exactly 8% of the poster's height below the poster's bottom edge).
  - `left: 50%; transform: translateX(-50%) !important;` (Centers it perfectly).
  - `z-index: 15;` (The parent `.poster-container` is also assigned `z-index: 15` to guarantee the entire poster-and-pill assembly wins any stacking conflicts against the sticker grid).
* **Why it's robust**: By placing the pill *inside* `.poster-container`, the pill scales up and down exactly as the poster does. `-8%` guarantees it rests in the "safe zone" below the poster but above the sticker grid.

### 3. Vertical Mode (Export Override)
* **Method**: Hard Pixel Anchoring with Native Margin Centering
* **CSS Class**: `.export-mode.vertical .modern-watermark`
* **How it works**:
  - `bottom: -60px !important;`
  - `left: 0 !important; right: 0 !important; margin: 0 auto !important; width: max-content !important;` (Centers it natively because `html2canvas` fails to render `transform` on absolute elements).
  - `font-size: 36px !important;`
  - `padding: 14px 38px !important;`
* **Why it's necessary**: The `html2canvas` library (used for exporting PNGs) cannot reliably compute relative percentages (`%`) or viewport units (`cqw`, `vh`) when cloning the DOM off-screen. Therefore, we explicitly lock the pill exactly `60px` below the poster to recreate the `-8%` visual gap in a fixed `1200x1500px` canvas.

---

## Safety Guidelines for Edits
1. **Never use Flexbox in Vertical Poster Container**: The vertical poster is absolutely positioned to maintain the strict 4:5 visual aspect ratio. Flexbox would break this. Rely on the `-8%` / `-60px` anchors.
2. **Never apply `overflow: hidden` to `.poster-container` in vertical mode**: If you do, the `-8%` bottom anchor will cause the pill to be cleanly sliced off and vanish, because it technically bleeds outside the container's bounding box.
3. **Always edit both export AND live CSS**: If you change the font size or padding of the pill, you must update the hardcoded pixel values in the `.export-mode` overrides, or the exported image will look wildly different from the live preview.

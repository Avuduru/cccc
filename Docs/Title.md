# Title Scaling and Formatting System — Internal Reference

> This file is gitignored. It serves as a structural and algorithmic reference for how titles scale and format across different layout modes in the CCCC codebase.

---

## The Core Formatting Mechanics
Across the entire application, the title (`.header-info h2`) is strictly designed to maintain layout stability. 

### Line Breaking Constraints
- **Maximum Lines**: **2 Lines**.
- The title is explicitly forbidden from breaking into 3 or more lines.
- This is enforced via native CSS truncation:
  ```css
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  ```
- If a title is excessively long and exhausts all available down-scaling, the browser will gracefully cut off the remaining text with an ellipsis (`...`).

### Maximum Width Constraints
- **Horizontal Mode**: The title fills the available width of the `.info-content-right` flex column, dynamically shrinking as the poster column takes up space on the left.
- **Vertical Mode**: The title is absolutely positioned at `top: 3%` and spans `100%` of the canvas width, but is constrained by `padding: 0 5%`. Therefore, the absolute maximum width is **90% of the canvas width**.

---

## Horizontal Mode: Unified DOM-Measurement
Previously, Horizontal mode used a "dumb" character-count system. It has now been upgraded to use the exact same **Memory-Safe DOM-Measurement System** as the Vertical mode (`fitHorizontalTitle()`).

When a horizontal title is rendered:
1. The JS temporarily strips any scaling classes and forces a browser reflow to measure the title at its massive 100% baseline size.
2. It measures if `scrollHeight > 1.5 * line-height` to detect if the text actually wrapped to 2 lines.
3. If it did, it injects the `.horizontal-has-2-line-title` class.

### The Horizontal 50% Reduction Rule
To maintain perfect design parity with the vertical layout, horizontal 2-line titles are also instantly crushed by exactly 50%:
- **Live Preview**: Base multiplier `1.0` drops to `0.5`.
- **Export Mode**: Base `106px` drops to exactly `53px`.

**Why?** This ensures total consistency. Both layouts now perfectly protect 1-line titles at their massive 100% size, while aggressively clamping 2-line titles to exactly 50% to prevent layout overflow.

---

## Vertical Mode: Dynamic Overflow Fitting
In Vertical mode, vertical space is highly restricted. The system discards the character-count method in favor of an **algorithmic DOM-measurement system** inside `js/ui.js` (`fitVerticalTitle()`).

When a title is rendered:
1. The JS measures if the text naturally fits into 2 lines (`el.scrollHeight <= el.clientHeight`).
2. If it overflows, the JS progressively applies smaller font-size classes:
   - Base size → `calc(var(--canvas-v-title-size) * 0.9)`
   - `.title-scale-1` → **75%** of base
   - `.title-scale-2` → **60%** of base
   - `.title-scale-3` → **50%** of base
4. It stops shrinking the exact moment `scrollHeight` fits inside `clientHeight`. 

**Why this method?** Vertical text wrap is highly dependent on word lengths, language (Arabic vs. English), and character width. Testing physical `scrollHeight` guarantees the text will perfectly fit inside the safe zone above the poster without ever overlapping it.

### The `.has-2-line-title` Trigger
Because 2-line titles naturally consume more vertical space and push the poster downwards, `fitVerticalTitle()` also acts as a layout sensor. 
- **Memory-Safe Measurement**: To prevent infinite flickering (where a font shrinks, fits on 1 line, resets, wraps to 2 lines, and shrinks again), the JS temporarily removes all scaling classes and forces a browser reflow to measure the text at its true 100% base size.
- It mathematically detects if the text wrapped to 2 lines at this massive 100% size (`scrollHeight > 1.5 * line-height`).
- If it did, it injects the class `.has-2-line-title` onto the main canvas.

### The 50% Reduction Rule
When `.has-2-line-title` is active, the standard progressive scaling loop is completely bypassed in favor of an **instant, exact 50% reduction** via CSS overrides (`style.v3.css`).
- **Live Preview**: Base multiplier `0.9` drops to `0.45`.
- **Export Mode**: Base `102.6px` drops to exactly `51.3px`.
- The top classification text also shrinks (50px → 36px) and tightens its margins.

**Why?** This aggressively reclaims vertical real estate to protect the stickers at the bottom of the canvas. Because it targets `.has-2-line-title`, 1-line titles and their content pills are guaranteed to remain fully untouched and beautiful.

---

## Bidirectional Text (Bidi)
Because titles can be Arabic (RTL) or English (LTR), the CSS natively isolates the title using:
```css
direction: auto;
unicode-bidi: isolate;
```
This ensures that English words or numbers inside an Arabic title render in the correct visual order without breaking punctuation.

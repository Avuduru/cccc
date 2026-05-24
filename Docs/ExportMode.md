# Export Mode Architecture — Internal Reference

> This file is gitignored. It serves as a structural and layout reference for AI agents or developers working on the CCCC codebase.

---

## What is Export Mode?
"Export Mode" refers to the off-screen CSS state triggered right before the user downloads their design as an image (`.png` or `.jpg`). The system uses `html2canvas` to render the DOM into a binary image blob.

The export pipeline logic lives in `js/export.js`. 

---

## Why Export Mode Exists (The `html2canvas` Problem)
The library `html2canvas` is a rendering engine that redraws the DOM onto a `<canvas>` element. However, it has severe limitations with modern CSS. It **cannot** properly compute:
1. Viewport units (`vh`, `vw`)
2. Container Query units (`cqw`, `cqh`)
3. `aspect-ratio` properties reliably in flex/grid contexts.

Because the Live Preview (`#preview-canvas`) relies almost entirely on `cqw` and percentage scaling to be perfectly responsive, `html2canvas` would render it as a garbled mess. 

To fix this, `js/export.js` clones the Live Preview, attaches the `.export-mode` class, and places it off-screen. The `.export-mode` CSS class overrides **every single relative unit** with strict, absolute pixel (`px`) values.

---

## The Canvas Dimensions
Unlike the Live Preview, the Export canvas is forced into massive, static resolutions to ensure high-quality, high-DPI output images.

### 1. Horizontal Export
- **Canvas Size**: `1920px` (Width) x `1080px` (Height).
- **Layout Mechanics**: Same as the Live Preview (Flexbox row), but gaps, margins, paddings, and font sizes are converted to fixed `px`.
- **Stickers**: Restricted by `max-height: 260px` and items shrink using `flex-shrink: 1`.

### 2. Vertical Export
- **Canvas Size**: `1200px` (Width) x `1500px` (Height). (Exactly 4:5 aspect ratio).
- **Layout Mechanics**: Absolute positioning override.
- **Specific Coordinates**:
  - `.poster-container`: `top: 330px`, `right: 60px`, `width: 528px`, `height: 792px`. (Poster ends at `1122px`).
  - `.synopsis-wrapper`: `top: 330px`, `left: 60px`.
  - `.stickers-grid-canvas`: `bottom: 1.5%` equivalent. Height is fully controlled by the `adjustVerticalPositions` JS Allocator.
  - `.modern-watermark`: `top: 100%`. (Anchors flush to the bottom of the poster image. The `margin-top` is dynamically calculated by JS to maintain strict minimum padding, yielding space from the stickers if cramped.)

---

## The Specificity War (`!important`)
In `style.v3.css`, practically every property within the `.export-mode` block uses the `!important` flag. 

This is required because the export clone inherits the highly specific, deeply nested CSS of the Live Preview. The `!important` tags are the only mathematically guaranteed way to strip out the `cqw` logic and force the strict pixel coordinates before `html2canvas` captures the snapshot. 

**Rule of Thumb:** If you change a percentage or `cqw` value in the base Preview CSS, you **must** manually calculate the equivalent pixel value and update the `.export-mode` override, otherwise the preview and the exported image will break WYSIWYG parity.

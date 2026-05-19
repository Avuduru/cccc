import { state } from './state.js';

const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

function rescaleSynopsisInClone(clone) {
    if (state.synopsisSize && state.synopsisSize !== 'auto') return;
    const el = clone.querySelector('#synopsis-text');
    const wrapper = el ? el.parentElement : null;
    if (!el || !wrapper) return;
    el.classList.remove('scale-medium', 'scale-heavy', 'scale-extreme');
    if (el.scrollHeight > wrapper.clientHeight) {
        el.classList.add('scale-medium');
        if (el.scrollHeight > wrapper.clientHeight) {
            el.classList.remove('scale-medium');
            el.classList.add('scale-heavy');
            if (el.scrollHeight > wrapper.clientHeight) {
                el.classList.remove('scale-heavy');
                el.classList.add('scale-extreme');
            }
        }
    }
}

async function compressToMaxSize(canvas, maxBytes = MAX_EXPORT_BYTES) {
    let scale = 1.0;
    while (scale > 0.3) {
        const w = Math.round(canvas.width * scale);
        const h = Math.round(canvas.height * scale);
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
        const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
        if (blob.size <= maxBytes) {
            console.log(`Export: ${w}x${h}, ${(blob.size/1024/1024).toFixed(2)}MB (scale ${scale.toFixed(1)})`);
            return blob;
        }
        scale -= 0.1;
    }
    const w = Math.round(canvas.width * 0.3);
    const h = Math.round(canvas.height * 0.3);
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    return new Promise(r => tmp.toBlob(r, 'image/png'));
}

function logClassification(action) {
    try {
        const reviewerInput = document.getElementById('reviewer-name-input');
        fetch('proxy.php?type=log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content_id: state.meta.id || null,
                content_type: state.type,
                title: state.meta.title,
                ratings: state.ratings,
                badges: state.badges,
                classifier: reviewerInput ? reviewerInput.value : '',
                orientation: state.orientation,
                action: action
            })
        }).catch(() => {});
    } catch (e) {}
}

function getFilename() {
    let base = state.meta.id
        ? String(state.meta.id)
        : (state.meta.title ? state.meta.title.trim() : 'Card');
    base = base.replace(/[\n\r]/g, ' ').replace(/[\/\\?%*:|"<>]/g, '-');
    return `CCCC-${base}.png`;
}

function downloadLink(url, filename) {
    const link = document.createElement('a');
    link.href = url; link.download = filename; link.style.display = 'none';
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    setTimeout(() => { if (document.body.contains(link)) document.body.removeChild(link); }, 2000);
}

// Shared render pipeline: clone → wait for fonts → html2canvas → compress
async function renderToBlob(originalCanvas) {
    const isVertical = originalCanvas.classList.contains('vertical');
    const exportWidth = isVertical ? 1200 : 1920;

    const clone = originalCanvas.cloneNode(true);
    const exportContainer = document.createElement('div');
    exportContainer.style.cssText =
        `position:fixed;left:-9999px;top:0;z-index:-1;width:${exportWidth}px`;
    clone.classList.add('export-mode');
    exportContainer.appendChild(clone);
    document.body.appendChild(exportContainer);

    // Copy canvas bitmap (cloneNode does not copy <canvas> pixel data)
    const originalBg = originalCanvas.querySelector('#poster-bg');
    const clonedBg   = clone.querySelector('#poster-bg');
    if (originalBg && clonedBg) {
        clonedBg.width  = originalBg.width;
        clonedBg.height = originalBg.height;
        clonedBg.getContext('2d').drawImage(originalBg, 0, 0);
    }

    // Remove contenteditable: iOS uses a different rendering path for editable
    // elements that can break Arabic contextual letter shaping in html2canvas.
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));

    // Wait for CSS font loading API to settle
    await document.fonts.ready;
    // Force-load the exact Handjet weight/size instances used in card text.
    // On iOS, document.fonts.ready resolves immediately from cache but the
    // font hasn't been applied+shaped in the newly created off-screen clone yet.
    // Explicitly calling fonts.load() forces those instances to be activated.
    // Sizes match export-mode CSS: --canvas-title-size:106px, --canvas-synopsis-size:40px
    await document.fonts.load('800 106px Handjet');
    await document.fonts.load('400 40px Handjet');
    // Two rAF passes guarantee the browser has completed at least one full
    // layout+paint cycle on the off-screen clone before html2canvas reads it.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Extra buffer for slower iOS devices
    await new Promise(r => setTimeout(r, 300));

    rescaleSynopsisInClone(clone);

    // iOS fix — root cause: html2canvas uses Range.getClientRects() to measure each
    // text segment. On iOS, for RTL Arabic text, getClientRects() returns >1 rect
    // whenever the range offset is > 0 within its text node. html2canvas interprets
    // >1 rects as a line-wrap and falls back to per-grapheme segmentation — one
    // fillText() per character — so each Arabic letter renders in isolated form.
    //
    // Words at offset=0 (first word of each text node) get exactly 1 rect → stay
    // whole → correctly shaped. That's why the first word of every paragraph is
    // correct: each paragraph lives in its own DOM container, so its first word is
    // always at offset 0.
    //
    // Fix: wrap every word in its own <span> in the clone. Each span owns a fresh
    // text node starting at offset 0. html2canvas processes each span's text node
    // independently, getClientRects() returns 1 rect per word, every word stays
    // whole, and CoreText shapes the letters correctly.
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const synEl = clone.querySelector('#synopsis-text');
        if (synEl && /[؀-ۿ]/.test(synEl.textContent)) {
            const raw = synEl.innerText || synEl.textContent;
            synEl.innerHTML = '';
            raw.split(/\n+/).forEach((para, i) => {
                if (i > 0) {
                    // Preserve paragraph spacing with a blank line
                    synEl.appendChild(document.createElement('br'));
                    synEl.appendChild(document.createElement('br'));
                }
                // Split "word space word space …" — keep spaces as bare text nodes
                // so they don't affect layout, wrap each word in its own span so
                // its text node starts at offset 0.
                para.split(/(\s+)/).forEach(token => {
                    if (!token) return;
                    if (/^\s+$/.test(token)) {
                        synEl.appendChild(document.createTextNode(token));
                    } else {
                        const s = document.createElement('span');
                        s.textContent = token;
                        synEl.appendChild(s);
                    }
                });
            });
        }
    }

    const canvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: exportWidth,
        height: clone.offsetHeight,
        windowWidth: exportWidth
    });

    document.body.removeChild(exportContainer);
    return compressToMaxSize(canvas);
}

export function handleExport() {
    const originalCanvas = document.getElementById('preview-canvas');
    const exportBtn = document.getElementById('export-btn');
    exportBtn.innerText = 'جاري التصدير...';

    // iOS: navigator.share({ files }) triggers the document share sheet, which
    // does NOT include "Save to Photos". The fix: open a blank tab synchronously
    // (within the gesture, before any async work) so Safari doesn't block it as
    // a popup, then navigate it to the blob URL after rendering. The user then
    // sees the image fullscreen with Safari's native Share → "Save Image" UI.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const iosTab = isIOS ? window.open('', '_blank') : null;

    renderToBlob(originalCanvas)
        .then(async blob => {
            if (!blob) { exportBtn.innerText = 'ERROR'; return; }

            const filename = getFilename();
            const url = URL.createObjectURL(blob);

            if (isIOS && iosTab) {
                iosTab.location.href = url;
                logClassification('export');

            } else if (navigator.share && navigator.canShare) {
                // Android: Web Share API works correctly there
                const file = new File([blob], filename, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({ files: [file] });
                        logClassification('export');
                    } catch (err) {
                        if (err.name !== 'AbortError') console.error('Share failed:', err);
                    }
                    return;
                }
                downloadLink(url, filename);
                logClassification('export');

            } else {
                // Desktop: file download
                downloadLink(url, filename);
                logClassification('export');
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            }
        })
        .catch(err => {
            console.error('Export failed:', err);
            exportBtn.innerText = 'ERROR';
        })
        .finally(() => {
            setTimeout(() => { exportBtn.innerText = 'تصديـر'; }, 2000);
        });
}

export function handleCopyToClipboard() {
    const originalCanvas = document.getElementById('preview-canvas');
    const copyBtn = document.getElementById('copy-btn');
    if (!copyBtn) return;

    const originalText = copyBtn.innerText;
    copyBtn.innerText = 'جاري النسخ...';

    // iOS Safari requires navigator.clipboard.write() to be called SYNCHRONOUSLY
    // within a user gesture — if we await async work first, the gesture trust
    // expires and Safari throws a NotAllowedError.
    // The fix: call clipboard.write() immediately (synchronous), passing a
    // Promise<Blob> as the ClipboardItem value. Safari 13.4+ supports this pattern.
    const blobPromise = renderToBlob(originalCanvas);

    navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobPromise })
    ])
    .then(() => {
        logClassification('copy');
        copyBtn.innerText = 'تم النسخ ✓';
    })
    .catch(err => {
        console.error('Clipboard write failed:', err);
        copyBtn.innerText = 'فشل النسخ';
    })
    .finally(() => {
        setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
    });
}

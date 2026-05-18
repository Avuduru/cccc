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

    // Wait for all webfonts (Handjet, Silkscreen, JetBrains Mono) to be ready.
    // This prevents Arabic characters from falling back to a system font on mobile,
    // which causes scrambled/unshaped output in html2canvas.
    await document.fonts.ready;
    // Small extra settle time for layout reflow in the off-screen container
    await new Promise(r => setTimeout(r, 150));

    rescaleSynopsisInClone(clone);

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

    renderToBlob(originalCanvas)
        .then(async blob => {
            if (!blob) { exportBtn.innerText = 'ERROR'; return; }

            const filename = getFilename();
            const file = new File([blob], filename, { type: 'image/png' });

            // On iOS/Android: use the native share sheet (Web Share API).
            // This lets users save directly to Photos or share to any app —
            // much friendlier than a download link, which Safari can't handle.
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file] });
                    logClassification('export');
                } catch (err) {
                    // AbortError = user dismissed the sheet, not a real failure
                    if (err.name !== 'AbortError') console.error('Share failed:', err);
                }
            } else {
                // Desktop: trigger a file download
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.dispatchEvent(new MouseEvent('click', {
                    bubbles: true, cancelable: true, view: window
                }));
                logClassification('export');
                setTimeout(() => {
                    if (document.body.contains(link)) document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 2000);
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

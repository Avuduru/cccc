import { state } from './state.js';

const MAX_EXPORT_BYTES = 2 * 1024 * 1024; // 2MB hard cap

// Re-run synopsis auto-scaling on a clone at export resolution
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
        tmp.width = w;
        tmp.height = h;
        tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);

        const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
        if (blob.size <= maxBytes) {
            console.log(`Export compressed: ${w}x${h}, ${(blob.size / 1024 / 1024).toFixed(2)}MB (scale ${scale.toFixed(1)})`);
            return blob;
        }
        scale -= 0.1;
    }
    // Fallback at minimum scale
    const w = Math.round(canvas.width * 0.3);
    const h = Math.round(canvas.height * 0.3);
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    tmp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    const blob = await new Promise(r => tmp.toBlob(r, 'image/png'));
    console.log(`Export fallback: ${w}x${h}, ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    return blob;
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
        }).catch(() => { });
    } catch (e) {
        // Never block export
    }
}

export function handleExport() {
    const originalCanvas = document.getElementById('preview-canvas');
    const exportBtn = document.getElementById('export-btn');

    exportBtn.innerText = 'جاري التصدير...';

    // Check orientation
    const isVertical = originalCanvas.classList.contains('vertical');
    const exportWidth = isVertical ? 1200 : 1920;

    // 1. Clone the canvas to a temporary container
    const clone = originalCanvas.cloneNode(true);

    // Create an invisible export container
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed'; // Keep it out of flow but on screen (off-viewport)
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.zIndex = '-1';
    exportContainer.style.width = `${exportWidth}px`; // Dynamic Width
    // Height will adapt automatically based on aspect ratio rules in CSS

    // Add the export-mode class to override cqw units with pixels
    clone.classList.add('export-mode');

    // Append clone
    exportContainer.appendChild(clone);
    document.body.appendChild(exportContainer);

    // FIX: Canvas content/bitmap is NOT copied by cloneNode. We must copy it manually.
    const originalBg = originalCanvas.querySelector('#poster-bg');
    const clonedBg = clone.querySelector('#poster-bg');
    if (originalBg && clonedBg) {
        // Match dimensions
        clonedBg.width = originalBg.width;
        clonedBg.height = originalBg.height;

        // Copy content
        const ctx = clonedBg.getContext('2d');
        ctx.drawImage(originalBg, 0, 0);
    }

    // Wait a moment for layout/images to settle in the new container
    setTimeout(() => {
        // Re-scale synopsis for export resolution (preview classes are wrong size)
        rescaleSynopsisInClone(clone);

        // html2canvas options
        const options = {
            backgroundColor: null,
            scale: 1, // 1x scale — container is already full social media resolution
            useCORS: true,
            allowTaint: true,
            logging: false,
            // Ensure we capture the full size of the clones
            width: exportWidth,
            height: clone.offsetHeight,
            windowWidth: exportWidth
        };

        html2canvas(clone, options).then(async canvas => {
            // 1. Sanitize the filename
            let filenameBase = state.meta.id ? String(state.meta.id) : (state.meta.title ? state.meta.title.trim() : 'Card');
            filenameBase = filenameBase.replace(/[\n\r]/g, ' ').replace(/[\/\\?%*:|"<>]/g, '-');
            const filename = `CCCC-${filenameBase}.png`;

            // 2. Compress PNG to ≤ 2MB
            const blob = await compressToMaxSize(canvas);
            if (!blob) {
                console.error('Canvas to Blob failed');
                exportBtn.innerText = 'ERROR';
                document.body.removeChild(exportContainer);
                return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);

            console.log('Final Filename:', filename);
            console.log('Blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');

            const event = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            link.dispatchEvent(event);

            logClassification('export');

            setTimeout(() => {
                if (document.body.contains(link)) {
                    document.body.removeChild(link);
                }
                URL.revokeObjectURL(url);
                if (document.body.contains(exportContainer)) {
                    document.body.removeChild(exportContainer);
                }
                exportBtn.innerText = 'تصديـر';
            }, 2000);
        }).catch(err => {
            console.error('Export failed:', err);
            exportBtn.innerText = 'ERROR';
            // Cleanup
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        });
    }, 100); // 100ms delay to ensure rendering
}

export function handleCopyToClipboard() {
    const originalCanvas = document.getElementById('preview-canvas');
    const copyBtn = document.getElementById('copy-btn');

    if (!copyBtn) return;

    // Store original text
    const originalText = copyBtn.innerText;
    copyBtn.innerText = 'جاري النسخ...';

    const isVertical = originalCanvas.classList.contains('vertical');
    const exportWidth = isVertical ? 1200 : 1920;

    const clone = originalCanvas.cloneNode(true);
    const exportContainer = document.createElement('div');
    exportContainer.style.position = 'fixed';
    exportContainer.style.left = '-9999px';
    exportContainer.style.top = '0';
    exportContainer.style.zIndex = '-1';
    exportContainer.style.width = `${exportWidth}px`;

    clone.classList.add('export-mode');
    exportContainer.appendChild(clone);
    document.body.appendChild(exportContainer);

    const originalBg = originalCanvas.querySelector('#poster-bg');
    const clonedBg = clone.querySelector('#poster-bg');
    if (originalBg && clonedBg) {
        clonedBg.width = originalBg.width;
        clonedBg.height = originalBg.height;
        const ctx = clonedBg.getContext('2d');
        ctx.drawImage(originalBg, 0, 0);
    }

    setTimeout(() => {
        // Re-scale synopsis for export resolution (preview classes are wrong size)
        rescaleSynopsisInClone(clone);

        const options = {
            backgroundColor: null,
            scale: 1,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: exportWidth,
            height: clone.offsetHeight,
            windowWidth: exportWidth
        };

        html2canvas(clone, options).then(async canvas => {
            const blob = await compressToMaxSize(canvas);
            if (!blob) {
                console.error('Canvas to Blob failed');
                copyBtn.innerText = 'ERROR';
                setTimeout(() => copyBtn.innerText = originalText, 2000);
                document.body.removeChild(exportContainer);
                return;
            }

            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                logClassification('copy');
                copyBtn.innerText = 'تم النسخ ✓';
            } catch (err) {
                console.error('Clipboard write failed:', err);
                copyBtn.innerText = 'فشل النسخ';
            }

            setTimeout(() => copyBtn.innerText = originalText, 2000);
            document.body.removeChild(exportContainer);
        }).catch(err => {
            console.error('Copy failed:', err);
            copyBtn.innerText = 'ERROR';
            setTimeout(() => copyBtn.innerText = originalText, 2000);
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        });
    }, 100);
}

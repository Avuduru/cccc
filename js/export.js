import { state } from './state.js';
import { adjustVerticalPositions } from './ui.js';

const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

// html2canvas can't render -webkit-box (line-clamp), so export CSS switches h2
// to display:block which loses the "...". Re-add it by binary-searching the
// longest prefix that fits within 2-line height. Applies to both orientations.
function truncateLongTitle(clone) {
    const h2 = clone.querySelector('#title-text');
    if (!h2 || !h2.innerText.trim()) return;

    const fontSize = parseFloat(getComputedStyle(h2).fontSize);
    const maxH = fontSize * 2.2; // matches .export-mode .header-info h2 max-height:2.2em

    if (h2.scrollHeight <= maxH) return; // already fits

    const original = h2.innerText;
    let lo = 0, hi = original.length;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        h2.innerText = original.slice(0, mid).trimEnd() + '…';
        if (h2.scrollHeight <= maxH) lo = mid;
        else hi = mid;
    }
    h2.innerText = original.slice(0, lo).trimEnd() + '…';
}

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
    await document.fonts.load('900 106px Handjet');
    await document.fonts.load('400 40px Handjet');
    // Two rAF passes guarantee the browser has completed at least one full
    // layout+paint cycle on the off-screen clone before html2canvas reads it.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Extra buffer for slower iOS devices
    await new Promise(r => setTimeout(r, 300));

    truncateLongTitle(clone);
    rescaleSynopsisInClone(clone);
    adjustVerticalPositions(clone);

    // iOS: WebKit returns phantom extra rects from Range.getClientRects() for
    // Arabic text at non-zero offsets within a text node. html2canvas treats
    // >1 rects as a line-wrap and falls back to per-grapheme rendering — one
    // fillText() per character — so each letter renders in isolated form.
    // Patch getClientRects inside h2c's iframe via onclone: return only the
    // first non-zero-width rect (the real word position), suppressing phantoms.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const canvas = await html2canvas(clone, {
        backgroundColor: null,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: exportWidth,
        height: clone.offsetHeight,
        windowWidth: exportWidth,
        onclone: isIOS ? (_doc) => {
            const FrameRange = _doc.defaultView && _doc.defaultView.Range;
            if (!FrameRange) return;
            const orig = FrameRange.prototype.getClientRects;
            FrameRange.prototype.getClientRects = function () {
                const rects = orig.call(this);
                if (rects.length > 1 && /[؀-ۿ]/.test(this.toString())) {
                    const real = Array.from(rects).find(r => r.width > 0) || rects[0];
                    return { length: 1, 0: real, item: (i) => i === 0 ? real : null };
                }
                return rects;
            };
        } : undefined,
    });

    document.body.removeChild(exportContainer);
    return compressToMaxSize(canvas);
}

function showExportModal(url) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '999999';

    const content = document.createElement('div');
    content.className = 'modal-content modal-slide-up';
    content.style.maxWidth = '90vw';
    content.style.width = 'auto';
    content.style.padding = '0';
    content.style.overflow = 'hidden';
    content.style.background = 'var(--ink-2)';

    const header = document.createElement('header');
    header.className = 'modal-header';
    header.style.borderBottom = 'none';
    header.style.padding = '15px 20px';
    header.style.background = 'var(--ink-3)';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'modal-title-wrap';
    titleWrap.innerHTML = `<span class="kicker"><span class="kicker-dot" style="background:#2ecc71"></span>تم</span><h2 style="font-size: 22px;">بطاقتك جاهزة للمشاركة</h2>`;

    const actions = document.createElement('div');
    actions.className = 'modal-header-actions';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerText = '×';
    closeBtn.onclick = () => document.body.removeChild(overlay);

    actions.appendChild(closeBtn);
    header.appendChild(titleWrap);
    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.alignItems = 'center';
    body.style.gap = '15px';
    body.style.padding = '0 20px 20px 20px';

    const instructions = document.createElement('p');
    instructions.innerText = 'اضغط مطولاً على الصورة لحفظها';
    instructions.style.color = 'var(--text-dim)';
    instructions.style.fontSize = '14px';
    instructions.style.margin = '0';

    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '65vh';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '6px';
    img.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';

    body.appendChild(instructions);
    body.appendChild(img);

    content.appendChild(header);
    content.appendChild(body);
    overlay.appendChild(content);

    document.body.appendChild(overlay);
}

export function handleExport() {
    const originalCanvas = document.getElementById('preview-canvas');
    const exportBtn = document.getElementById('export-btn');
    exportBtn.innerText = 'جاري التصدير...';

    // Truly robust check for any mobile or tablet device (catches modern iPads disguised as Macs)
    const isMobileOrTablet = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) || 
                             (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    renderToBlob(originalCanvas)
        .then(async blob => {
            if (!blob) { exportBtn.innerText = 'ERROR'; return; }

            const filename = getFilename();
            const url = URL.createObjectURL(blob);

            if (isMobileOrTablet) {
                // iPhone, iPad, Android all get the premium popup with the snap animation
                showExportModal(url);
                logClassification('export');
            } else {
                // Desktop PCs and Macs get instant file downloads
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

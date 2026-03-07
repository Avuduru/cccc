import { state } from './state.js';

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
        // html2canvas options
        const options = {
            backgroundColor: null,
            scale: 1, // We are already at target pixels
            useCORS: true,
            allowTaint: true,
            logging: false,
            // Ensure we capture the full size of the clones
            width: exportWidth,
            height: clone.offsetHeight,
            windowWidth: exportWidth
        };

        html2canvas(clone, options).then(canvas => {
            // 1. Sanitize the filename down to safe alphanumeric/dash string to prevent corrupt file generation
            let filenameBase = state.meta.id ? String(state.meta.id) : (state.meta.title ? state.meta.title.trim() : 'Card');
            // Hard stip all invisible newlines and OS-restricted characters just to be safe
            filenameBase = filenameBase.replace(/[\n\r]/g, ' ').replace(/[\/\\?%*:|"<>]/g, '-');
            const filename = `CCCC-${filenameBase}.png`;

            // 2. Use toBlob for more robust download of large images
            canvas.toBlob((blob) => {
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

                // Debug logs
                console.log('Export URL:', url);
                console.log('Final Filename:', filename);
                console.log('Blob size:', blob.size);

                // Trigger download safely
                const event = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                link.dispatchEvent(event);

                logClassification('export');

                // Cleanup after a short delay to ensure the download has started
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
            }, 'image/png');
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

        html2canvas(clone, options).then(canvas => {
            canvas.toBlob(async (blob) => {
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
            }, 'image/png');
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

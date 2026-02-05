import { state } from './state.js';

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
            const link = document.createElement('a');
            const filename = state.meta.title ? `CCCC-${state.meta.title}.png` : 'CCCC-Card.png';
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // Cleanup
            document.body.removeChild(exportContainer);
            exportBtn.innerText = 'تصديـر';
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

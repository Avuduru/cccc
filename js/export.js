import { state } from './state.js';

export function handleExport() {
    const element = document.getElementById('preview-canvas'); // Select specifically the canvas
    const exportBtn = document.getElementById('export-btn');

    exportBtn.innerText = 'جاري التصدير...';

    // html2canvas options
    const options = {
        backgroundColor: null, // Transparent to keep our dark background
        scale: 2, // High DPI
        useCORS: true,
        allowTaint: true,
        logging: false
    };

    html2canvas(element, options).then(canvas => {
        const link = document.createElement('a');
        const filename = state.meta.title ? `CCCC-${state.meta.title}.png` : 'CCCC-Card.png';
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        exportBtn.innerText = 'EXPORT';
    }).catch(err => {
        console.error('Export failed:', err);
        exportBtn.innerText = 'ERROR';
    });
}

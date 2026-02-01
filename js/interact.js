
// State
let currentDrag = null;
let startX = 0;
let startY = 0;
let initialLeft = 0;
let initialTop = 0;
let rafId = null; // Request Animation Frame ID

export function initDraggable(element) {
    if (!element) return;

    // Remove native drag to prevent ghosting
    element.setAttribute('draggable', 'false');
    element.style.cursor = 'move';

    element.addEventListener('mousedown', (e) => {
        if (!e.target.isContentEditable) {
            e.preventDefault(); // Stop text selection
        }
        startDrag(e, element);
    });

    element.addEventListener('wheel', (e) => {
        if (!element.classList.contains('draggable-active')) return;
        e.preventDefault();

        let scale = parseFloat(element.dataset.scale || 1);
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        scale += delta;
        scale = Math.max(0.2, Math.min(scale, 5));

        element.dataset.scale = scale;
        element.style.transform = `scale(${scale})`;
    }, { passive: false });
}

function startDrag(e, element) {
    // Only drag if active
    if (!element.classList.contains('draggable-active')) return;

    currentDrag = element;
    startX = e.clientX;
    startY = e.clientY;

    // Force absolute if not already
    const computed = window.getComputedStyle(element);
    if (computed.position !== 'absolute') {
        const rect = element.getBoundingClientRect();
        const parent = element.offsetParent.getBoundingClientRect();
        element.style.position = 'absolute';
        element.style.left = (rect.left - parent.left) + 'px';
        element.style.top = (rect.top - parent.top) + 'px';
        element.style.width = computed.width;
        element.style.margin = '0';
    }

    initialLeft = parseFloat(element.style.left) || 0;
    initialTop = parseFloat(element.style.top) || 0;

    // Critical for smoothness: Remove transitions
    element.style.transition = 'none';

    document.addEventListener('mousemove', onDragShim);
    document.addEventListener('mouseup', stopDrag);
}

// Shim to prevent excessive firing
function onDragShim(e) {
    if (!currentDrag) return;
    e.preventDefault();

    // Use RAF to throttle updates to screen refresh rate
    if (rafId) return; // Skip if already pending

    rafId = requestAnimationFrame(() => {
        onDragLogic(e.clientX, e.clientY);
        rafId = null;
    });
}

function onDragLogic(clientX, clientY) {
    if (!currentDrag) return;
    const dx = clientX - startX;
    const dy = clientY - startY;

    currentDrag.style.left = (initialLeft + dx) + 'px';
    currentDrag.style.top = (initialTop + dy) + 'px';
}

function stopDrag() {
    if (currentDrag) {
        currentDrag.style.transition = ''; // Restore transition
    }
    currentDrag = null;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    document.removeEventListener('mousemove', onDragShim);
    document.removeEventListener('mouseup', stopDrag);
}

// Global helper to set state
export function setDragState(active) {
    const list = ['.classification-label', '#title-text', '.stickers-grid-canvas'];
    console.log('setDragState:', active);

    const selectors = [
        '.classification-label',
        '#title-text',
        '.stickers-grid-canvas'
    ];

    selectors.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) {
            if (active) {
                el.classList.add('draggable-active');
                el.style.zIndex = '1000';
                el.style.pointerEvents = 'auto';

                initDraggable(el);
            } else {
                el.classList.remove('draggable-active');
                el.style.cursor = '';

                // Reset styles
                el.style.position = '';
                el.style.left = '';
                el.style.top = '';
                el.style.zIndex = '';
                el.style.pointerEvents = '';
                el.style.transform = '';
                el.style.transition = '';
                el.dataset.scale = '';

                // Clear any leftover RAF
                if (rafId) cancelAnimationFrame(rafId);
            }
        }
    });
}

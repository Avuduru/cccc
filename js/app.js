import { initUI, updatePreview, renderControls } from './ui.js';
import { handleSearch } from './api.js';
import { handleExport } from './export.js';
import { debounce } from './utils.js';
import { state } from './state.js';
import { config } from './config.js';

function init() {
    setupDesignSettings();
    initUI();
    setupEventListeners();
}

function setupDesignSettings() {
    const root = document.documentElement;
    const d = config.DESIGN;
    if (!d) return;

    if (d.horizontal) {
        if (d.horizontal.titleSize) root.style.setProperty('--canvas-title-size', d.horizontal.titleSize);
        if (d.horizontal.genreSize) root.style.setProperty('--canvas-genre-size', d.horizontal.genreSize);
        if (d.horizontal.synopsisSize) root.style.setProperty('--canvas-synopsis-size', d.horizontal.synopsisSize);
    }

    if (d.vertical) {
        if (d.vertical.titleSize) root.style.setProperty('--canvas-v-title-size', d.vertical.titleSize);
    }
}

function setupEventListeners() {
    // DOM Elements - re-querying or using from UI if exposed, but simple to just query for listeners
    const el = {
        typeButtons: document.querySelectorAll('.type-btn'),
        searchQuery: document.getElementById('search-query'),
        searchResults: document.getElementById('search-results'),
        exportBtn: document.getElementById('export-btn'),
        synopsisText: document.getElementById('synopsis-text')
    };

    // Type Selectors
    el.typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            el.typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.type = btn.dataset.value;
            renderControls();
            updatePreview();
        });
    });

    // Orientation Selectors
    const orientButtons = document.querySelectorAll('.orient-btn');
    orientButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            orientButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.orientation = btn.dataset.value;
            updatePreview();
        });
    });

    // Search Input
    el.searchQuery.addEventListener('input', debounce(() => {
        handleSearch();
    }, 500));

    el.searchQuery.addEventListener('focus', () => {
        if (el.searchQuery.value.trim()) el.searchResults.classList.remove('hidden');
    });

    // Hide search results on click outside
    document.addEventListener('click', (e) => {
        if (!el.searchQuery.contains(e.target) && !el.searchResults.contains(e.target)) {
            el.searchResults.classList.add('hidden');
        }
    });

    // Export
    el.exportBtn.addEventListener('click', handleExport);

    // Synopsis
    el.synopsisText.addEventListener('input', (e) => {
        let text = e.target.innerText;

        // Character limit check (roughly enough for 4 lines)
        if (text.length > 350) {
            text = text.substring(0, 350);
            e.target.innerText = text;
        }

        const lines = text.split('\n');
        if (lines.length > 4) {
            e.target.innerText = lines.slice(0, 4).join('\n');
            // Move cursor to end
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(e.target);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
        }
        state.meta.synopsis = e.target.innerText;
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

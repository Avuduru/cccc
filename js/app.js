import { initUI, updatePreview, renderControls, drawBlurredBackground, updateDisplayedInfo } from './ui.js';
import { handleSearch } from './api.js';
import { handleExport } from './export.js';
import { debounce } from './utils.js';
import { state } from './state.js';
import { config } from './config.js';
import { setDragState } from './interact.js';

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
    // Custom Dropdown Logic
    const dropdown = document.getElementById('type-dropdown');
    const currentTypeBtn = document.getElementById('current-type');
    const dropdownMenu = dropdown.querySelector('.dropdown-menu');
    const dropdownItems = dropdown.querySelectorAll('.dropdown-item');

    // Toggle Menu
    currentTypeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

    // Handle Selection
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update Active State
            dropdownItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Update Button Text
            currentTypeBtn.textContent = item.textContent;

            // Close Menu
            dropdownMenu.classList.remove('show');

            // Update State
            state.type = item.dataset.value;

            // RESET STATE GLOBALLY
            state.ratings = {};
            state.badges = {};

            // Allow manual mode specific text, otherwise defaults
            if (state.type === 'manual') {
                state.meta = {
                    title: 'اكتب العنوان هنا',
                    year: '',
                    poster: '',
                    genre: 'اكتب النوع',
                    synopsis: 'اكتب النبذة هنا...'
                };
            } else {
                state.meta = {
                    title: 'عنوان العمل',
                    year: '2023',
                    poster: null,
                    genre: 'نوع العمل',
                    synopsis: ''
                };
            }

            // Manual Mode UI Toggles
            const uploadHint = document.getElementById('upload-hint');
            const titleText = document.getElementById('title-text');
            const genreText = document.getElementById('genre-text');
            const posterImg = document.getElementById('poster-img');

            if (state.type === 'manual') {
                // UI Updates
                const searchResults = document.getElementById('search-results');
                const searchQuery = document.getElementById('search-query');
                searchResults.classList.add('hidden');
                searchQuery.value = '';

                posterImg.classList.add('manual-mode');
                posterImg.classList.add('empty-poster');

                uploadHint.classList.remove('hidden');

                // Enable editing
                titleText.contentEditable = "true";
                genreText.contentEditable = "true";
            } else {
                posterImg.classList.remove('manual-mode');
                posterImg.classList.remove('empty-poster'); // Clear empty state
                uploadHint.classList.add('hidden');

                // Disable editing
                titleText.contentEditable = "false";
                genreText.contentEditable = "false";
            }

            renderControls();
            updatePreview();
            updateDisplayedInfo();
        });
    });

    // Orientation Selectors
    const orientButtons = document.querySelectorAll('.orient-btn');
    orientButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            orientButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.orientation = btn.dataset.value;
            renderControls();
            updatePreview();

            // Enable/Disable Drag based on orientation
            // User requested to remove ability to move elements in vertical mode (Step 721)
            // But keep text adjusting (contentEditable) which is handled in Manual Mode logic.
            setDragState(false);
        });
    });

    // Synopsis Size Controls
    const sizeButtons = document.querySelectorAll('.size-btn');
    sizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            sizeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.synopsisSize = btn.dataset.size;
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

    // Manual Title Resizing
    const titleText = document.getElementById('title-text');
    titleText.addEventListener('input', () => {
        // Dynamic import or assume global access? 
        // We need to import adjustTitleSize or reproduce logic.
        // Since we missed importing it in initializing app.js (it was module based), 
        // let's rely on logic reproduction or cleaner update.
        // Actually best to re-trigger UI update logic or just handle class setting here.

        const len = titleText.innerText.length;
        titleText.removeAttribute('data-length');
        if (len >= 20 && len < 40) titleText.dataset.length = 'medium';
        else if (len >= 40 && len < 60) titleText.dataset.length = 'long';
        else if (len >= 60) titleText.dataset.length = 'xl';

        state.meta.title = titleText.innerText;
    });

    // Manual Mode - File Upload
    const fileInput = document.getElementById('manual-cover-upload');
    const posterImg = document.getElementById('poster-img');

    // Trigger file input when clicking poster in manual mode
    posterImg.addEventListener('click', () => {
        if (state.type === 'manual') {
            fileInput.click();
        }
    });

    // Handle File Selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.meta.poster = event.target.result;
                // Update UI directly here as it's specific to this action
                const pImg = document.getElementById('poster-img');
                pImg.style.backgroundImage = `url(${state.meta.poster})`;
                pImg.classList.remove('empty-poster');
                // Use import from ui.js if needed, or just rely on updatePreview if it used meta.poster
                // Update blurred background
                drawBlurredBackground(state.meta.poster);
                updatePreview();
            };
            reader.readAsDataURL(file);
        }
    });

}

// Start
document.addEventListener('DOMContentLoaded', init);

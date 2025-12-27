import { CATEGORIES } from './constants.js';
import { state, updateState } from './state.js';
import { handleSearch } from './api.js';

// DOM Elements
const els = {
    ratingsList: () => document.getElementById('ratings-list'),
    togglesList: () => document.getElementById('toggles-list'),
    activeStickers: () => document.getElementById('active-stickers'),
    typeButtons: () => document.querySelectorAll('.type-btn'),
    posterImg: () => document.getElementById('poster-img'),
    posterBg: () => document.getElementById('poster-bg'),
    titleText: () => document.getElementById('title-text'),
    genreText: () => document.getElementById('genre-text'),
    synopsisText: () => document.getElementById('synopsis-text'),
    searchQuery: () => document.getElementById('search-query'),
    searchResults: () => document.getElementById('search-results'),
    exportBtn: () => document.getElementById('export-btn'),
    previewCanvas: () => document.getElementById('preview-canvas'),
    infoModal: () => document.getElementById('info-modal'),
    openModalBtn: () => document.getElementById('open-info-modal'),
    closeModalBtn: () => document.getElementById('close-modal'),
};

export function initUI() {
    renderControls();
    updatePreview();
    setupModal();
}

export function renderControls() {
    const list = els.ratingsList();
    const toggles = els.togglesList();

    if (!list || !toggles) return;

    // Clear lists
    list.innerHTML = '';
    toggles.innerHTML = '';

    const isGame = state.type === 'game';
    els.typeButtons().forEach(b => {
        if (b.dataset.value === state.type) {
            const title = document.querySelector('.ratings-title');
            if (title) title.innerText = `محتوى ال${b.innerText}`;
        }
    });

    // 1. Render Rating Bars (Mawjoodat)
    CATEGORIES.Mawjoodat.forEach(cat => {
        if (cat.type === 'game_only' && !isGame) return;

        const row = document.createElement('div');
        row.className = 'rating-row';
        row.innerHTML = `
            <div class="rating-row-label">${cat.label}</div>
            <div class="rating-bar-container" data-id="${cat.id}" data-level="0">
                <div class="bar-segment seg-gray" data-val="0"></div>
                <div class="bar-segment seg-yellow" data-val="3"></div>
                <div class="bar-segment seg-orange" data-val="2"></div>
                <div class="bar-segment seg-red" data-val="1"></div>
                <div class="rating-knob"></div>
            </div>
        `;
        list.appendChild(row);
    });

    // 2. Render Toggles (Mustathniyat)
    CATEGORIES.Mustathniyat.forEach(item => {
        const div = document.createElement('div');
        div.className = 'toggle-badge';
        div.dataset.id = item.id;
        div.innerHTML = `
            <div class="toggle-square"></div>
            <span>${item.label}</span>
        `;
        toggles.appendChild(div);
    });

    attachControlListeners();
}

function attachControlListeners() {
    // Rating Bars Interaction
    document.querySelectorAll('.rating-bar-container').forEach(container => {
        const id = container.dataset.id;
        const knob = container.querySelector('.rating-knob');
        const segments = container.querySelectorAll('.bar-segment');

        segments.forEach(seg => {
            seg.addEventListener('click', (e) => {
                const val = parseInt(e.target.dataset.val);
                state.ratings[id] = val;

                updateRatingUI(container, knob, val);
                updatePreview();
            });
        });
    });

    // Toggles Interaction
    document.querySelectorAll('.toggle-badge').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            state.badges[id] = !state.badges[id];

            // Update UI
            if (state.badges[id]) btn.classList.add('active');
            else btn.classList.remove('active');

            updatePreview();
        });
    });
}

function setupModal() {
    const modal = els.infoModal();
    const openBtn = els.openModalBtn();
    const closeBtn = els.closeModalBtn();

    if (!modal || !openBtn || !closeBtn) return;

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent Scroll
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore Scroll
    };

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Close on Escape
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

export function updateRatingUI(container, knob, level) {
    container.dataset.level = level;
    container.className = `rating-bar-container active-${level}`;

    // 4 Segments: Gray(0), Yellow(3), Orange(2), Red(1)
    // RTL layout:
    // Level 0 (Gray): Rightmost -> 12.5% from right
    // Level 3 (Yellow): Second -> 37.5% from right
    // Level 2 (Orange): Third -> 62.5% from right
    // Level 1 (Red): Leftmost -> 87.5% from right

    let pos = '12.5%';
    if (level === 3) pos = '37.5%';
    if (level === 2) pos = '62.5%';
    if (level === 1) pos = '87.5%';

    knob.style.right = pos;
}

export function updatePreview() {
    const stickerContainer = els.activeStickers();
    const canvas = els.previewCanvas();
    if (!stickerContainer || !canvas) return;

    // Update orientation class
    canvas.classList.remove('horizontal', 'vertical');
    canvas.classList.add(state.orientation);

    stickerContainer.innerHTML = '';

    const order = CATEGORIES.Mawjoodat.map(c => c.id);

    // Collect all active stickers
    const activeItems = [];

    // 1. Mawjoodat
    for (const key of order) {
        const level = state.ratings[key];
        if (level && level > 0) {
            const cat = CATEGORIES.Mawjoodat.find(c => c.id === key);
            if (cat) {
                activeItems.push({
                    icon: `${cat.icon}${level}`,
                    label: cat.label,
                    fallback: cat.icon
                });
            }
        }
    }

    // 2. Mustathniyat
    for (const key of Object.keys(state.badges)) {
        if (state.badges[key]) {
            const item = CATEGORIES.Mustathniyat.find(i => i.id === key);
            if (item) {
                activeItems.push({
                    icon: `${item.icon}0`,
                    label: item.label
                });
            }
        }
    }

    // Render Stickers
    activeItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sticker-item';
        div.innerHTML = `<img src="assets/icons/${item.icon}.png" alt="${item.label}" onerror="if(this.dataset.fallback) this.src='assets/icons/'+this.dataset.fallback+'.png'" data-fallback="${item.fallback || ''}">`;
        stickerContainer.appendChild(div);
    });

    if (state.meta.poster) {
        drawBlurredBackground(state.meta.poster);
    }
}

export function drawBlurredBackground(url) {
    const canvas = els.posterBg();
    if (!canvas || !url) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        // Set internal resolution based on display size
        canvas.width = canvas.offsetWidth * 1.2; // Slightly larger for better quality
        canvas.height = canvas.offsetHeight * 1.2;

        ctx.filter = 'blur(20px)';

        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    };
    img.src = url;
}

export function showSearchResults(data, type) {
    let results = [];
    if (type === 'movie' || type === 'tv') results = data.results || [];
    else if (type === 'game') results = data.results || [];
    else if (type === 'anime' || type === 'manga') results = data.data || [];
    else if (type === 'book') results = data.items || [];

    const container = els.searchResults();
    container.innerHTML = '';

    if (!results.length) {
        container.innerHTML = '<div class="search-result-item">لا توجد نتائج</div>';
    } else {
        results.slice(0, 5).forEach(item => {
            const title = item.title || item.name || item.title_english || (item.volumeInfo ? item.volumeInfo.title : 'No Title');
            let poster = 'assets/placeholder.png';

            if (item.poster_path) poster = `https://image.tmdb.org/t/p/w92${item.poster_path}`;
            else if (item.background_image) poster = item.background_image;
            else if (item.images?.jpg?.small_image_url) poster = item.images.jpg.small_image_url;
            else if (item.volumeInfo?.imageLinks?.thumbnail) poster = item.volumeInfo.imageLinks.thumbnail;

            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<img src="${poster}"> <span>${title}</span>`;
            div.addEventListener('click', () => selectItem(item, type));
            container.appendChild(div);
        });
    }
    container.classList.remove('hidden');
}

function selectItem(item, type) {
    state.meta.title = item.title || item.name || item.title_english || (item.volumeInfo ? item.volumeInfo.title : 'No Title');

    if (type === 'movie' || type === 'tv') {
        state.meta.poster = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        state.meta.synopsis = item.overview;
        state.meta.genre = item.genre_ids ? 'Movie/TV' : ''; // simplified or use a map
    } else if (type === 'game') {
        state.meta.poster = item.background_image;
        state.meta.synopsis = 'بيانات اللعبة...';
        state.meta.genre = item.genres ? item.genres.map(g => g.name).join(', ') : 'Game';
    } else if (type === 'anime' || type === 'manga') {
        state.meta.poster = item.images.jpg.large_image_url;
        state.meta.synopsis = item.synopsis;
        state.meta.genre = item.genres ? item.genres.map(g => g.name).join(', ') : '';
    } else if (type === 'book') {
        state.meta.poster = item.volumeInfo?.imageLinks?.thumbnail || '';
        state.meta.synopsis = item.volumeInfo?.description || '';
        state.meta.genre = item.volumeInfo?.categories?.join(', ') || '';
    }

    els.titleText().innerText = state.meta.title;
    els.genreText().innerText = state.meta.genre || '';

    // Clip synopsis to 4 lines
    const clippedSynopsis = (state.meta.synopsis || '').split('\n').slice(0, 4).join('\n');
    els.synopsisText().innerText = clippedSynopsis;

    if (state.meta.poster) {
        els.posterImg().style.backgroundImage = `url(${state.meta.poster})`;
        drawBlurredBackground(state.meta.poster);
    }

    els.searchResults().classList.add('hidden');
    els.searchQuery().value = state.meta.title;
}

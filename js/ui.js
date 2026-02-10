import { CATEGORIES } from './constants.js';
import { state, updateState } from './state.js';
import { handleSearch } from './api.js';
import { translateGenres, translateText } from './translations.js';
import { debounce } from './utils.js';

// Cache for prefetched game covers
const gameCoverCache = {};

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

    // Auto-scale synopsis on input (debounced)
    const synText = els.synopsisText();
    if (synText) {
        synText.addEventListener('input', debounce(() => {
            if (state.synopsisSize === 'auto') {
                fitSynopsisToContainer();
            }
        }, 300));
    }
}

export function renderControls() {
    const list = els.ratingsList();
    const toggles = els.togglesList();

    if (!list || !toggles) return;

    // Toggle Synopsis Controls Visibility
    const synControls = document.getElementById('synopsis-controls');
    if (synControls) {
        if (state.orientation === 'vertical') synControls.classList.add('hidden');
        else synControls.classList.remove('hidden');
    }

    // Clear lists
    list.innerHTML = '';
    toggles.innerHTML = '';

    // Update Title based on active dropdown item
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        if (item.dataset.value === state.type) {
            const title = document.querySelector('.ratings-title');
            if (title) title.innerHTML = `<span class="label-white">محتوى</span> <span class="label-green">ال${item.textContent}</span>`;
        }
    });

    const isGame = state.type === 'game';
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
    // Rating Bars Interaction (Draggable)
    document.querySelectorAll('.rating-bar-container').forEach(container => {
        const id = container.dataset.id;
        const knob = container.querySelector('.rating-knob');

        const handleMove = (clientX) => {
            const rect = container.getBoundingClientRect();
            let x = clientX - rect.left;
            // Clamp
            if (x < 0) x = 0;
            if (x > rect.width) x = rect.width;

            // RTL Calculation: 0 is Right, 100% is Left
            // percentFromLeft = x / width
            // percentFromRight = 1 - (x / width)
            const percentFromRight = 1 - (x / rect.width);

            let level = 1; // Default Red (Left)
            if (percentFromRight < 0.25) level = 0; // Right (Gray)
            else if (percentFromRight < 0.50) level = 3; // Mid-Right (Yellow)
            else if (percentFromRight < 0.75) level = 2; // Mid-Left (Orange)

            // Only update if changed
            if (parseInt(state.ratings[id]) !== level) {
                state.ratings[id] = level;
                updateRatingUI(container, knob, level);
                updatePreview();
            }
        };

        // Mouse Events
        container.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent text selection
            handleMove(e.clientX); // Jump to click position immediately

            const onMouseMove = (moveEvent) => handleMove(moveEvent.clientX);
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Touch Events
        container.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent scrolling while dragging slider
            const touch = e.touches[0];
            handleMove(touch.clientX);

            const onTouchMove = (moveEvent) => {
                moveEvent.preventDefault();
                handleMove(moveEvent.touches[0].clientX);
            };
            const onTouchEnd = () => {
                document.removeEventListener('touchmove', onTouchMove);
                document.removeEventListener('touchend', onTouchEnd);
            };

            document.addEventListener('touchmove', onTouchMove, { passive: false });
            document.addEventListener('touchend', onTouchEnd);
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

    // --- Watermark Logic ---
    const reviewerInput = document.getElementById('reviewer-name-input');
    const watermarkDisplay = document.getElementById('watermark-display');

    if (reviewerInput && watermarkDisplay) {
        const nameSpan = watermarkDisplay.querySelector('.name-span');
        reviewerInput.addEventListener('input', (e) => {
            const text = e.target.value.trim();
            if (text) {
                nameSpan.innerText = text;

                // Fix Direction for English Names (e.g. @ikureiji)
                if (/^[A-Za-z\u00C0-\u00FF@]/.test(text)) {
                    nameSpan.style.direction = 'ltr';
                    nameSpan.style.unicodeBidi = 'isolate';
                } else {
                    nameSpan.style.direction = 'rtl';
                    nameSpan.style.unicodeBidi = 'normal';
                }

                watermarkDisplay.classList.remove('hidden');
            } else {
                watermarkDisplay.classList.add('hidden');
            }
        });
    }
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

    const canvasContent = document.querySelector('.canvas-content');
    if (canvasContent) {
        if (activeItems.length <= 5) {
            canvasContent.classList.add('single-row');
        } else {
            canvasContent.classList.remove('single-row');
        }
    }

    // Conditionally center icons if 4 or less
    if (activeItems.length <= 4) {
        stickerContainer.classList.add('few-icons');
    } else {
        stickerContainer.classList.remove('few-icons');
    }

    // Render Stickers
    activeItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'sticker-item';
        div.innerHTML = `<img src="assets/icons/${item.icon}.png" alt="${item.label}" onerror="if(this.dataset.fallback) this.src='assets/icons/'+this.dataset.fallback+'.png'" data-fallback="${item.fallback || ''}">`;
        stickerContainer.appendChild(div);
    });

    // DYNAMIC SYNOPSIS SCALING (Overflow/Fit-to-Box)
    // We defer this slightly to allow DOM reflow
    requestAnimationFrame(() => {
        fitSynopsisToContainer();
    });
}

// New Helper: Shrink text until it fits container
// New Helper: Shrink text until it fits container
function fitSynopsisToContainer() {
    const el = els.synopsisText();
    const wrapper = el ? el.parentElement : null;
    if (!el || !wrapper) return;

    // 1. Reset all size classes
    el.classList.remove('scale-medium', 'scale-heavy', 'scale-extreme', 'manual-size-sm', 'manual-size-md', 'manual-size-lg');

    // 2. Check Manual Mode
    if (state.synopsisSize && state.synopsisSize !== 'auto') {
        if (state.synopsisSize === 'small') el.classList.add('manual-size-sm');
        else if (state.synopsisSize === 'medium') el.classList.add('manual-size-md');
        else if (state.synopsisSize === 'large') el.classList.add('manual-size-lg');
        return;
    }

    // 3. Auto Mode: Check Overflow & Apply Scaling iteratively
    // We check if content height > container height

    // Check 1: Base size overflow? -> Try Medium
    if (el.scrollHeight > wrapper.clientHeight) {
        el.classList.add('scale-medium');

        // Check 2: Medium size overflow? -> Try Heavy
        if (el.scrollHeight > wrapper.clientHeight) {
            el.classList.remove('scale-medium');
            el.classList.add('scale-heavy');

            // Check 3: Heavy size overflow? -> Try Extreme
            if (el.scrollHeight > wrapper.clientHeight) {
                el.classList.remove('scale-heavy');
                el.classList.add('scale-extreme');
            }
        }
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

        ctx.filter = 'blur(15px)';

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
    else if (type === 'book') results = data.docs || []; // Open Library uses 'docs'

    const container = els.searchResults();
    container.innerHTML = '';

    if (!results.length) {
        container.innerHTML = '<div class="search-result-item">لا توجد نتائج</div>';
    } else {
        results.slice(0, 5).forEach(item => {
            const title = item.title || item.name || item.title_english || (item.volumeInfo ? item.volumeInfo.title : 'No Title');
            let poster = 'assets/placeholder.png';

            if (item.poster_path) poster = `https://image.tmdb.org/t/p/w92${item.poster_path}`;
            else if (item.background_image) poster = item.background_image; // RAWG
            else if (item.thumbnail) poster = item.thumbnail; // FreeToGame (legacy)
            else if (item.images?.jpg?.small_image_url) poster = item.images.jpg.small_image_url;
            else if (item.volumeInfo?.imageLinks?.thumbnail) poster = item.volumeInfo.imageLinks.thumbnail;
            else if (item.cover_i) poster = `https://covers.openlibrary.org/b/id/${item.cover_i}-S.jpg`; // Open Library covers

            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<img src="${poster}"> <span>${title}</span>`;
            div.addEventListener('click', () => selectItem(item, type));
            container.appendChild(div);

            // Prefetch game covers in background for instant selection
            if (type === 'game') {
                const searchName = item.name || item.title;
                if (searchName && !gameCoverCache[searchName]) {
                    fetch(`proxy.php?query=${encodeURIComponent(searchName)}&type=game_cover`)
                        .then(resp => resp.json())
                        .then(data => {
                            if (data.success && data.data && data.data.length > 0) {
                                const coverUrl = data.data[0].url;
                                if (coverUrl) {
                                    gameCoverCache[searchName] = `proxy.php?query=${encodeURIComponent(coverUrl)}&type=image_proxy`;
                                }
                            }
                        })
                        .catch(err => console.error('Failed to prefetch cover:', err));
                }
            }
        });
    }
    container.classList.remove('hidden');
}

function selectItem(item, type) {
    state.meta.title = item.title || item.name || item.title_english || (item.volumeInfo ? item.volumeInfo.title : 'No Title');

    if (type === 'movie' || type === 'tv') {
        const rawPoster = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        // Use proxy to ensure CORS headers for Canvas processing
        state.meta.poster = `proxy.php?query=${encodeURIComponent(rawPoster)}&type=image_proxy`;

        state.meta.genre = translateGenres(type === 'movie' ? 'Movie' : 'TV Series');

        // Translate synopsis asynchronously
        if (item.overview) {
            state.meta.synopsis = 'جاري الترجمة...';
            updateDisplayedInfo();
            translateText(item.overview).then(translated => {
                state.meta.synopsis = translated;
                updateDisplayedInfo();
            });
        }
    } else if (type === 'game') {
        // RAWG format - fetch full game details for description
        state.meta.poster = ''; // Start empty, will be filled by SteamGridDB
        const genreText = item.genres ? item.genres.map(g => g.name).join(', ') : 'Game';
        state.meta.genre = translateGenres(genreText);

        // Show loading message  
        state.meta.synopsis = 'جاري التحميل...';
        updateDisplayedInfo();

        // Fetch full game details asynchronously
        if (item.slug) {
            fetch(`proxy.php?query=${item.slug}&type=game_details`)
                .then(resp => resp.json())
                .then(data => {
                    let description = '';
                    if (data.description_raw) {
                        description = data.description_raw;
                    } else if (data.description) {
                        description = data.description.replace(/<[^>]*>/g, '');
                    } else {
                        const platform = item.platforms ? item.platforms.map(p => p.platform.name).slice(0, 3).join(', ') : '';
                        const released = item.released ? `Released: ${item.released}` : '';
                        description = [platform, released].filter(Boolean).join(' • ') || 'No description available';
                    }

                    // Translate description
                    translateText(description).then(translated => {
                        state.meta.synopsis = translated;
                        updateDisplayedInfo();
                    });
                    updateDisplayedInfo();
                })
                .catch(err => {
                    console.error('Failed to fetch game details:', err);
                    const platform = item.platforms ? item.platforms.map(p => p.platform.name).slice(0, 3).join(', ') : '';
                    const released = item.released ? `Released: ${item.released}` : '';
                    state.meta.synopsis = [platform, released].filter(Boolean).join(' • ') || 'No description available';
                    updateDisplayedInfo();
                });
        }

        // 2. Fetch vertical cover asynchronously (SteamGridDB)
        const searchName = item.name || item.title;
        if (searchName) {
            // Check cache first for instant display
            if (gameCoverCache[searchName]) {
                state.meta.poster = gameCoverCache[searchName];
                updateDisplayedInfo();
            } else {
                // Fetch if not in cache
                fetch(`proxy.php?query=${encodeURIComponent(searchName)}&type=game_cover`)
                    .then(resp => resp.json())
                    .then(data => {
                        if (data.success && data.data && data.data.length > 0) {
                            const coverUrl = data.data[0].url;
                            if (coverUrl) {
                                // Proxy the image to avoid CORS issues during export
                                const proxiedUrl = `proxy.php?query=${encodeURIComponent(coverUrl)}&type=image_proxy`;
                                gameCoverCache[searchName] = proxiedUrl; // Cache it
                                state.meta.poster = proxiedUrl;
                                updateDisplayedInfo();
                            }
                        }
                    })
                    .catch(err => console.error('Failed to fetch steamgriddb cover:', err));
            }
        }

        // Update display immediately with what we have
        updateDisplayedInfo();
        els.searchResults().classList.add('hidden');
        els.searchQuery().value = state.meta.title;
        return; // Early return since we handle display updates in async callback
    } else if (type === 'anime' || type === 'manga') {
        state.meta.poster = item.images.jpg.large_image_url;

        // Translate genre
        const genreText = item.genres ? item.genres.map(g => g.name).join(', ') : '';
        state.meta.genre = translateGenres(genreText);

        // Translate synopsis
        state.meta.synopsis = 'جاري الترجمة...';
        updateDisplayedInfo();
        if (item.synopsis) {
            translateText(item.synopsis).then(translated => {
                state.meta.synopsis = translated;
                updateDisplayedInfo();
            });
        }
    } else if (type === 'book') {
        // Open Library format
        state.meta.poster = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : (item.volumeInfo?.imageLinks?.thumbnail || '');

        // Get description
        const description = item.first_sentence?.join(' ') || item.volumeInfo?.description || 'No description available';

        // Get and translate genre
        const genreText = item.volumeInfo?.categories?.join(', ') || (item.first_publish_year ? `Published: ${item.first_publish_year}` : 'Book');
        state.meta.genre = translateGenres(genreText);

        // Translate description
        state.meta.synopsis = 'جاري الترجمة...';
        updateDisplayedInfo();
        translateText(description).then(translated => {
            state.meta.synopsis = translated;
            updateDisplayedInfo();
        });
    }

    updateDisplayedInfo();
    els.searchResults().classList.add('hidden');
    els.searchQuery().value = state.meta.title;
}

// Export for use in app.js
export function adjustTitleSize() {
    const el = els.titleText();
    if (!el) return;
    const len = el.innerText.length;

    // Orientation-specific thresholds
    // Vertical layout is narrower (~55%), so we scale sooner.
    const isVertical = state.orientation === 'vertical';
    const t = isVertical
        ? { med: 12, long: 25, xl: 40 }
        : { med: 20, long: 40, xl: 60 };

    el.removeAttribute('data-length');

    if (len >= t.med && len < t.long) el.dataset.length = 'medium';
    else if (len >= t.long && len < t.xl) el.dataset.length = 'long';
    else if (len >= t.xl) el.dataset.length = 'xl';
}

export function updateDisplayedInfo() {
    const title = state.meta.title || '';
    els.titleText().innerText = title;

    // Fix Title Direction for English Text (e.g. Haikyuu!!)
    // If starts with Latin character, force LTR
    if (/^[A-Za-z\u00C0-\u00FF]/.test(title)) {
        els.titleText().style.direction = 'ltr';
        els.titleText().style.unicodeBidi = 'isolate';
    } else {
        els.titleText().style.direction = 'rtl';
        els.titleText().style.unicodeBidi = 'normal';
    }
    els.genreText().innerText = state.meta.genre || '';

    // Clip synopsis to 4 lines
    // Clip synopsis to 8 lines (allow more for horizontal/flex)
    const clippedSynopsis = (state.meta.synopsis || '').split('\n').slice(0, 8).join('\n');
    els.synopsisText().innerText = clippedSynopsis;

    // Trigger Fit-to-Box Scaling
    requestAnimationFrame(() => fitSynopsisToContainer());

    if (state.meta.poster) {
        els.posterImg().style.backgroundImage = `url(${state.meta.poster})`;
        drawBlurredBackground(state.meta.poster);
    } else {
        els.posterImg().style.backgroundImage = 'none';
        const canvas = els.posterBg();
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // ROBUST Aspect Ratio Fix REMOVED to lock aspect ratio (per user request)
    // This allows CSS (A4 or 2:3) to control the container size, cropping images if needed.

    adjustTitleSize();
}

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
    scoreBadge: () => document.getElementById('score-badge'),
    scoreText: () => document.getElementById('score-text'),
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

    const isGameOrManual = state.type === 'game' || state.type === 'manual';
    const availableCloud = document.getElementById('available-categories');
    if (availableCloud) availableCloud.innerHTML = '';

    // 1. Render Rating Bars or Category Tags (Mawjoodat)
    CATEGORIES.Mawjoodat.forEach(cat => {
        if (cat.type === 'game_only' && !isGameOrManual) return;

        const currentLevel = state.ratings[cat.id] ? parseInt(state.ratings[cat.id]) : 0;

        if (currentLevel > 0) {
            // Render Slider Row
            const row = document.createElement('div');
            row.className = 'rating-row';
            row.innerHTML = `
                <div class="rating-row-label">
                    <span>${cat.label}</span>
                    <button class="remove-slider-btn" data-id="${cat.id}">&times;</button>
                </div>
                <div class="rating-bar-container" data-id="${cat.id}" data-level="${currentLevel}">
                    <div class="bar-segment seg-gray" data-val="0"></div>
                    <div class="bar-segment seg-yellow" data-val="3"></div>
                    <div class="bar-segment seg-orange" data-val="2"></div>
                    <div class="bar-segment seg-red" data-val="1"></div>
                    <div class="rating-knob"></div>
                </div>
            `;
            list.appendChild(row);

            // Apply correct initial UI state manually so knob is aligned
            setTimeout(() => {
                const container = row.querySelector('.rating-bar-container');
                const knob = container.querySelector('.rating-knob');
                updateRatingUI(container, knob, currentLevel);
            }, 0);

        } else {
            // Render Tag Cloud Pill
            if (availableCloud) {
                const tag = document.createElement('button');
                tag.className = 'category-tag';
                tag.dataset.id = cat.id;
                tag.innerHTML = `<span class="plus-icon">+</span> ${cat.label}`;
                availableCloud.appendChild(tag);
            }
        }
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
    // 1. Tag Cloud Addition Logic
    document.querySelectorAll('.category-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const id = tag.dataset.id;
            // Set entirely new active base level
            state.ratings[id] = 1; // Default to highest severity (Red)
            renderControls();     // Re-run builder
            updatePreview();
        });
    });

    // 2. Slider Removal Logic
    document.querySelectorAll('.remove-slider-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            state.ratings[id] = 0; // Reset
            renderControls();      // Re-run builder
            updatePreview();
        });
    });

    // 3. Rating Bars Interaction (Draggable)
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
    const watermarks = document.querySelectorAll('.modern-watermark');

    if (reviewerInput && watermarks.length > 0) {
        reviewerInput.addEventListener('input', (e) => {
            const text = e.target.value.trim();
            watermarks.forEach(watermark => {
                const nameSpan = watermark.querySelector('.name-span');
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

                    watermark.classList.remove('hidden');
                } else {
                    watermark.classList.add('hidden');
                }
            });
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
        div.innerHTML = `<img src="assets/icons/${item.icon}.png?v=2" alt="${item.label}" onerror="if(this.dataset.fallback) this.src='assets/icons/'+this.dataset.fallback+'.png?v=2'" data-fallback="${item.fallback || ''}">`;
        stickerContainer.appendChild(div);
    });

    // DYNAMIC SYNOPSIS SCALING (Overflow/Fit-to-Box)
    // We defer this slightly to allow DOM reflow
    requestAnimationFrame(() => {
        adjustTitleSize();
        fitSynopsisToContainer();
        adjustVerticalPositions();
    });
}

export function reAdjustLayout() {
    adjustTitleSize();
    fitSynopsisToContainer();
    adjustVerticalPositions();
}

// Safety net: if the header (title + pills) overflows past the poster/synopsis
// start position, push them down dynamically. Only activates for vertical layout
// when the header actually exceeds the CSS-defined budget.
export function adjustVerticalPositions(container) {
    if (!container) container = document.getElementById('preview-canvas');
    if (!container || !container.classList.contains('vertical')) return;

    const header = container.querySelector('.header-info');
    const poster = container.querySelector('.poster-container');
    const synopsis = container.querySelector('.synopsis-wrapper');
    if (!header || !poster || !synopsis) return;

    // Reset to CSS defaults so we measure the true CSS top
    poster.style.top = '';
    synopsis.style.top = '';

    const contentEl = container.querySelector('.canvas-content');
    const contentH = contentEl ? contentEl.offsetHeight : container.offsetHeight;
    const headerBottom = header.offsetTop + header.offsetHeight;
    const posterTop = poster.offsetTop;
    const gap = contentH * 0.015; // 1.5% breathing room

    console.log('[DEBUG] adjustVerticalPositions values:', {
        contentH,
        headerOffsetTop: header.offsetTop,
        headerHeight: header.offsetHeight,
        headerBottom,
        posterTop,
        gap,
        overflows: headerBottom > posterTop - gap
    });

    // Only intervene if header bottom is too close to or past poster top
    if (headerBottom > posterTop - gap) {
        const newTopPx = headerBottom + gap;
        console.log('[DEBUG] Setting new top:', newTopPx + 'px');
        poster.style.setProperty('top', newTopPx + 'px', 'important');
        synopsis.style.setProperty('top', newTopPx + 'px', 'important');
    }

    // --- Dynamic Layout Allocator: Gap, Pill, and Stickers ---
    const watermark = container.querySelector('.modern-watermark.vertical-only');
    const stickersGrid = container.querySelector('.stickers-grid-canvas');
    if (watermark && stickersGrid) {
        // Reset inline overrides to measure natural layout bounds
        watermark.style.marginTop = '';
        stickersGrid.style.height = '';

        const posterBottom = poster.offsetTop + poster.offsetHeight;
        // canvasBottom is the container height minus the 1.5% padding reserve
        const canvasBottom = contentH - (contentH * 0.015);
        const remaining = canvasBottom - posterBottom;
        
        const pillH = watermark.offsetHeight;
        // Strict minimum padding above and below the pill (e.g. 2.5% of canvas height)
        const minPadding = contentH * 0.025; 
        const requiredPillSpace = pillH + (minPadding * 2);
        
        // Max ideal height for stickers (e.g., 21% of canvas width)
        // Preview: 800 * 0.21 = 168px. Export: 1200 * 0.21 = 252px.
        const maxStickerH = container.offsetWidth * 0.21; 
        
        const availableForStickers = remaining - requiredPillSpace;
        
        let finalStickerH;
        let finalPadding;

        if (availableForStickers >= maxStickerH) {
            // SCENARIO 1: Plenty of room.
            // Use maximum sticker height, evenly distribute extra space as padding.
            finalStickerH = maxStickerH;
            finalPadding = (remaining - pillH - finalStickerH) / 2;
        } else {
            // SCENARIO 2: Cramped (e.g. 2-line title).
            // Mandate minimum padding, force stickers to shrink to remaining space.
            finalPadding = minPadding;
            finalStickerH = availableForStickers;
            if (finalStickerH < 0) finalStickerH = 0; // Safety floor
        }
        // --- html2canvas Flexbox Bug Fix ---
        // If there are many stickers (e.g. 7), flex-shrink compresses their width.
        // Modern browsers scale aspect-ratio perfectly, but html2canvas leaves the height stretched, warping them.
        // Fix: Mathematically calculate the absolute maximum width allowed, and explicitly set width AND height.
        const numStickers = stickersGrid.children.length;
        if (numStickers > 0) {
            // Is it export mode? We can tell if contentH is exactly 1500px, or we can just calculate safely.
            const isExport = container.classList.contains('export-mode') || contentH >= 1500;
            const gap = isExport ? 18 : (container.offsetWidth * 0.015);
            const sidePadding = container.offsetWidth * 0.03; // 1.5% left + 1.5% right
            const availableWidth = container.offsetWidth - sidePadding;
            const totalGapWidth = (numStickers - 1) * gap;
            
            // The maximum square size before flex-shrink would trigger
            const maxAllowedSquare = (availableWidth - totalGapWidth) / numStickers;
            
            // The final size is the minimum of what the gap allows and what the width allows
            const finalStickerSize = Math.min(finalStickerH, maxAllowedSquare);
            
            stickersGrid.style.setProperty('height', finalStickerSize + 'px', 'important');
            Array.from(stickersGrid.children).forEach(item => {
                item.style.setProperty('width', finalStickerSize + 'px', 'important');
                item.style.setProperty('height', finalStickerSize + 'px', 'important');
            });
        } else {
            stickersGrid.style.setProperty('height', finalStickerH + 'px', 'important');
        }
        
        // 2. Position the pill. (Origin is top:100% inside poster, so it starts at posterBottom - 2px border)
        // We add 2px to ensure the visual gap matches the mathematical padding.
        watermark.style.setProperty('margin-top', (finalPadding + 2) + 'px', 'important');
    }
}

// New Helper: Shrink text until it fits container
// New Helper: Shrink text until it fits container
function fitSynopsisToContainer() {
    const el = els.synopsisText();
    const wrapper = el ? el.parentElement : null;
    if (!el || !wrapper) return;

    // 1. Reset all size classes
    el.classList.remove('scale-medium', 'scale-heavy', 'scale-extreme', 'manual-size-sm', 'manual-size-md', 'manual-size-lg', 'manual-size-xl');

    // 2. Check Manual Mode
    if (state.synopsisSize && state.synopsisSize !== 'auto') {
        if (state.synopsisSize === 'small') el.classList.add('manual-size-sm');
        else if (state.synopsisSize === 'medium') el.classList.add('manual-size-md');
        else if (state.synopsisSize === 'large') el.classList.add('manual-size-lg');
        else if (state.synopsisSize === 'xlarge') el.classList.add('manual-size-xl');
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

        const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;

        // Draw the image sharp first
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        // Apply StackBlur (Radius 25) directly to the canvas pixels for 100% cross-browser and html2canvas support
        if (typeof StackBlur !== 'undefined') {
            StackBlur.canvasRGBA(canvas, 0, 0, canvas.width, canvas.height, 25);
        }
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
            
            const img = document.createElement('img');
            img.src = poster;
            
            const span = document.createElement('span');
            span.textContent = title;
            
            div.appendChild(img);
            div.appendChild(span);
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
    state.meta.id = item.slug || item.mal_id || item.id || '';
    state.meta.title = item.title || item.name || item.title_english || (item.volumeInfo ? item.volumeInfo.title : 'No Title');
    state.meta.score = '';
    state.meta.stats = '';


    if (type === 'movie' || type === 'tv') {
        if (item.vote_average) state.meta.score = parseFloat(item.vote_average).toFixed(1);
        const rawPoster = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        // Use proxy to ensure CORS headers for Canvas processing
        state.meta.poster = `proxy.php?query=${encodeURIComponent(rawPoster)}&type=image_proxy`;

        // Default fallback genre while fetching
        state.meta.genre = translateGenres(type === 'movie' ? 'Movie' : 'TV Series');

        // Fetch details for runtime/episodes and genres
        const detailType = type === 'movie' ? 'movie_details' : 'tv_details';
        fetch(`proxy.php?query=${item.id}&type=${detailType}`)
            .then(resp => resp.json())
            .then(data => {
                if (data.genres && data.genres.length > 0) {
                    const genreText = data.genres.map(g => g.name).join(', ');
                    state.meta.genre = translateGenres(genreText);
                }

                if (type === 'movie' && data.runtime) {
                    state.meta.stats = formatArabicPlural(data.runtime, 'minute');
                } else if (type === 'tv' && data.number_of_episodes) {
                    state.meta.stats = formatArabicPlural(data.number_of_episodes, 'episode');
                }
                updateDisplayedInfo();
            }).catch(e => console.error(e));

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
        if (item.metacritic) state.meta.score = item.metacritic;
        // RAWG format - fetch full game details for description
        state.meta.poster = ''; // Start empty, will be filled by SteamGridDB
        const genreText = item.genres ? item.genres.map(g => g.name).join(', ') : 'Game';
        state.meta.genre = translateGenres(genreText);

        // Show loading message  
        state.meta.synopsis = 'جاري التحميل...';
        updateDisplayedInfo();

        // Fetch full game details asynchronously
        if (item.slug) {
            const gameName = item.name || item.title;

            // Fire RAWG details + HLTB in parallel
            const detailsPromise = fetch(`proxy.php?query=${item.slug}&type=game_details`)
                .then(resp => resp.json())
                .catch(err => { console.error('Failed to fetch game details:', err); return null; });

            const hltbPromise = gameName
                ? fetch(`proxy.php?query=${encodeURIComponent(gameName)}&type=hltb`)
                    .then(resp => resp.json())
                    .catch(err => { console.error('HLTB fetch failed:', err); return null; })
                : Promise.resolve(null);

            Promise.all([detailsPromise, hltbPromise]).then(([data, hltbData]) => {
                // --- RAWG details ---
                if (data) {
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
                    if (data.metacritic) state.meta.score = data.metacritic;

                    // --- Playtime: prefer HLTB, fallback to RAWG ---
                    if (hltbData && hltbData.success && hltbData.data && hltbData.data.main_story > 0) {
                        state.meta.stats = formatArabicPlural(hltbData.data.main_story, 'hour');
                    } else if (data.playtime) {
                        // Fallback to RAWG average playtime
                        state.meta.stats = formatArabicPlural(data.playtime, 'hour');
                    }

                    // Translate description
                    translateText(description).then(translated => {
                        state.meta.synopsis = translated;
                        updateDisplayedInfo();
                    });
                } else {
                    // RAWG failed entirely — still try HLTB for stats
                    if (hltbData && hltbData.success && hltbData.data && hltbData.data.main_story > 0) {
                        state.meta.stats = formatArabicPlural(hltbData.data.main_story, 'hour');
                    }
                    const platform = item.platforms ? item.platforms.map(p => p.platform.name).slice(0, 3).join(', ') : '';
                    const released = item.released ? `Released: ${item.released}` : '';
                    state.meta.synopsis = [platform, released].filter(Boolean).join(' • ') || 'No description available';
                }
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
        if (item.score) state.meta.score = parseFloat(item.score).toFixed(2);
        
        if (type === 'anime' && item.episodes) {
            state.meta.stats = formatArabicPlural(item.episodes, 'episode');
        } else if (type === 'manga') {
            let statsParts = [];
            if (item.chapters) statsParts.push(formatArabicPlural(item.chapters, 'chapter'));
            if (item.volumes) statsParts.push(formatArabicPlural(item.volumes, 'volume'));
            if (statsParts.length > 0) state.meta.stats = statsParts.join(' • ');
        }
        
        const rawPoster = item.images.jpg.large_image_url;
        state.meta.poster = `proxy.php?query=${encodeURIComponent(rawPoster)}&type=image_proxy`;

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
        if (item.ratings_average) state.meta.score = parseFloat(item.ratings_average).toFixed(1);
        if (item.number_of_pages_median) state.meta.stats = formatArabicPlural(item.number_of_pages_median, 'page');
        // Open Library format
        const rawPoster = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : (item.volumeInfo?.imageLinks?.thumbnail || '');
        state.meta.poster = rawPoster ? `proxy.php?query=${encodeURIComponent(rawPoster)}&type=image_proxy` : '';

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
    const isVertical = state.orientation === 'vertical';

    // Reset all scaling
    el.removeAttribute('data-length');
    el.classList.remove('title-scale-1', 'title-scale-2', 'title-scale-3');

    if (isVertical) {
        fitVerticalTitle(el);
    } else {
        fitHorizontalTitle(el);
    }
}

function fitHorizontalTitle(el) {
    const canvas = document.getElementById('preview-canvas');

    // 1. Temporarily strip class to measure true 100% base size safely
    const was2Line = canvas.classList.contains('horizontal-has-2-line-title');
    canvas.classList.remove('horizontal-has-2-line-title');
    void el.offsetHeight; // Force browser reflow to apply 100% size instantly

    // 2. Measure if it naturally wrapped to 2 lines at 100% size
    const computed = window.getComputedStyle(el);
    let lh = parseFloat(computed.lineHeight);
    if (isNaN(lh)) {
        lh = parseFloat(computed.fontSize) * 1.15; // Fallback if line-height is 'normal'
    }

    if (el.scrollHeight > lh * 1.5) {
        canvas.classList.add('horizontal-has-2-line-title');
    }

    // Force reflow again so CSS updates
    void el.offsetHeight;
}

function fitVerticalTitle(el) {
    const scales = ['title-scale-1', 'title-scale-2', 'title-scale-3'];
    const canvas = document.getElementById('preview-canvas');

    // 1. Temporarily strip all scaling classes to measure true 100% base size safely
    const was2Line = canvas.classList.contains('has-2-line-title');
    canvas.classList.remove('has-2-line-title');
    void el.offsetHeight; // Force browser reflow to apply 100% size instantly

    // 2. Measure if it naturally wrapped to 2 lines at 100% size
    const computed = window.getComputedStyle(el);
    let lh = parseFloat(computed.lineHeight);
    if (isNaN(lh)) {
        lh = parseFloat(computed.fontSize) * 1.15; // Fallback if line-height is 'normal'
    }

    if (el.scrollHeight > lh * 1.5) {
        canvas.classList.add('has-2-line-title');
    }
    // Note: We don't need an 'else', it stays removed if it fits on 1 line.

    // Force reflow again so scaling logic reads the new actual font size (e.g. 50%)
    void el.offsetHeight;

    function fitsTwoLines() {
        return el.scrollHeight <= el.clientHeight + 2; // +2 for sub-pixel tolerance
    }

    // Check at current enforced size
    if (fitsTwoLines()) return;

    // Try each progressively smaller scale (usually bypassed if .has-2-line-title enforced 50%)
    for (const scale of scales) {
        el.classList.add(scale);
        if (fitsTwoLines()) return;
        el.classList.remove(scale);
    }

    // Still doesn't fit — keep smallest scale, CSS -webkit-line-clamp: 2 clips the rest
    el.classList.add(scales[scales.length - 1]);
}

function fitGenreRow(el) {
    if (state.orientation !== 'vertical') return;
    const scales = ['genre-scale-1', 'genre-scale-2', 'genre-scale-3'];
    el.classList.remove(...scales);
    
    if (el.scrollWidth <= el.clientWidth + 2) return; // Fits naturally
    
    for (const scale of scales) {
        el.classList.add(scale);
        if (el.scrollWidth <= el.clientWidth + 2) return;
        el.classList.remove(scale);
    }
    // Keep smallest scale if it still doesn't fit
    el.classList.add(scales[scales.length - 1]);
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

    const genreContainer = els.genreText();
    genreContainer.innerHTML = '';

    if (state.meta.stats) {
        const statsParts = state.meta.stats.split(' • ');
        statsParts.forEach(stat => {
            if (stat.trim()) {
                const statPill = document.createElement('span');
                statPill.className = 'genre-pill stats-pill';
                statPill.innerText = stat.trim();
                genreContainer.appendChild(statPill);
            }
        });
    }

    let rawGenres = state.meta.genre || '';
    if (rawGenres) {
        const parts = rawGenres.split(/،|,/);
        parts.forEach(g => {
            const text = g.trim();
            if (text) {
                const pill = document.createElement('span');
                pill.className = 'genre-pill';
                pill.innerText = text;
                genreContainer.appendChild(pill);
            }
        });
    }

    if (state.meta.score) {
        els.scoreText().innerText = state.meta.score;
        els.scoreBadge().classList.remove('hidden');
    } else {
        els.scoreBadge().classList.add('hidden');
    }

    // Inject full synopsis text and let CSS/JS-scaling handle visual constraints
    els.synopsisText().innerText = state.meta.synopsis || '';

    // Trigger Fit-to-Box Scaling and Layout Adjustments
    requestAnimationFrame(() => reAdjustLayout());

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

    if (state.orientation === 'vertical') {
        fitGenreRow(els.genreText().parentElement);
    }
    adjustTitleSize();
}

// Arabic Plural Rules Helper
export function formatArabicPlural(count, type) {
    const num = parseFloat(count);
    if (!num || isNaN(num) || num === 0) return '';
    
    const words = {
        episode: { s1: 'حلقة واحدة', s2: 'حلقتان', p3_10: 'حلقات', p11: 'حلقة' },
        chapter: { s1: 'فصل واحد', s2: 'فصلان', p3_10: 'فصول', p11: 'فصل' },
        volume:  { s1: 'مجلد واحد', s2: 'مجلدان', p3_10: 'مجلدات', p11: 'مجلد' },
        minute:  { s1: 'دقيقة واحدة', s2: 'دقيقتان', p3_10: 'دقائق', p11: 'دقيقة' },
        hour:    { s1: 'ساعة واحدة', s2: 'ساعتان', p3_10: 'ساعات', p11: 'ساعة' },
        page:    { s1: 'صفحة واحدة', s2: 'صفحتان', p3_10: 'صفحات', p11: 'صفحة' }  
    };

    const w = words[type];
    if (!w) return `${num}`;

    if (num % 1 !== 0) return `${num} ${w.p11}`;
    if (num === 1) return w.s1;
    if (num === 2) return w.s2;

    const lastTwo = num % 100;
    if (lastTwo >= 3 && lastTwo <= 10) return `${num} ${w.p3_10}`;
    return `${num} ${w.p11}`;
}

export function preloadStickers() {
    // Only preload once to save bandwidth
    if (window._stickersPreloaded) return;
    window._stickersPreloaded = true;

    const cacheImage = (src) => {
        const img = new Image();
        img.src = src;
    };

    // Preload Mawjoodat (Severities 1, 2, 3)
    CATEGORIES.Mawjoodat.forEach(cat => {
        for (let i = 1; i <= 3; i++) {
            cacheImage(`assets/icons/${cat.icon}${i}.png?v=2`);
        }
    });

    // Preload Mustathniyat (Exception Badges 0)
    CATEGORIES.Mustathniyat.forEach(item => {
        cacheImage(`assets/icons/${item.icon}0.png?v=2`);
    });
}

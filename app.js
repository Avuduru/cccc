// App Logic

// CONSTANTS (Data Structure)
const CATEGORIES = {
    Mawjoodat: [
        { id: 'kufr', label: 'كفريات', icon: 'kufr.svg' },
        { id: 'sex', label: 'جنس', icon: 'sex.svg' },
        { id: 'nudity', label: 'تعرّي', icon: 'nudity.svg' },
        { id: 'vices', label: 'سفاهة', icon: 'vices.svg' }, // Renamed from vices to safeha/vices
        { id: 'magic', label: 'سحر', icon: 'magic.svg' },
        { id: 'lgbt', label: 'شذوذ', icon: 'lgbt.svg' },
        { id: 'gore', label: 'صادم', icon: 'gore.svg' },
        { id: 'ideas', label: 'أفكار', icon: 'ideas.svg' },
        // Game only items will be filtered in rendering logic
        { id: 'addiction', label: 'إدمانيّات', type: 'game_only', icon: 'addiction.svg' },
        { id: 'lootbox', label: 'قمار', type: 'game_only', icon: 'lootbox.svg' },
    ],
    Mustathniyat: [
        { id: 'nomusic', label: 'خال من الموسيقى' },
        { id: 'noprofanity', label: 'خال من الألفاظ النابية' },
        { id: 'noaffairs', label: 'خال من العلاقات المحرمة' }
    ]
};

// State
let state = {
    type: 'movie',
    ratings: {}, // { kufr: 2, sex: 0 } -> 0=none, 1=yellow, 2=orange, 3=red
    badges: {}, // { nomusic: true }
    meta: {
        title: 'عنوان العمل',
        year: '2023',
        poster: null,
        genre: 'تصنيف',
        synopsis: 'نبذة عن العمل...',
        comment: ''
    }
};

// DOM Elements
const els = {
    ratingsList: document.getElementById('ratings-list'),
    togglesList: document.getElementById('toggles-list'),
    stickerGrid: document.getElementById('stickers-grid'),
    badgesContainer: document.getElementById('badges-container'),
    contentType: document.getElementById('content-type'),
    posterImg: document.getElementById('poster-img'),
    bgLayer: document.getElementById('bg-layer'),
    titleText: document.getElementById('title-text'),
    yearText: document.getElementById('year-text'),
    genreText: document.getElementById('genre-text'),
    synopsisText: document.getElementById('synopsis-text'),
    userComment: document.getElementById('user-comment'),
    commentDisplay: document.getElementById('comment-text-display'),
    exportBtn: document.getElementById('export-btn'),
    searchBtn: document.getElementById('search-btn')
};

// --- Initialization ---
function init() {
    renderControls();
    setupEventListeners();
}

// --- Rendering Controls ---
function renderControls() {
    // Clear lists
    els.ratingsList.innerHTML = '';
    els.togglesList.innerHTML = '';

    const isGame = state.type === 'game';

    // Render Mawjoodat
    CATEGORIES.Mawjoodat.forEach(cat => {
        if (cat.type === 'game_only' && !isGame) return;

        const div = document.createElement('div');
        div.className = 'rating-item';
        div.innerHTML = `
            <span class="rating-label">${cat.label}</span>
            <div class="rating-controls" data-id="${cat.id}">
                <button class="rating-btn btn-none active" data-level="0" title="لا يوجد"></button>
                <button class="rating-btn btn-yellow" data-level="1" title="موجود (يسير)"></button>
                <button class="rating-btn btn-orange" data-level="2" title="موجود (كثير)"></button>
                <button class="rating-btn btn-red" data-level="3" title="محوري / خطير"></button>
            </div>
        `;
        els.ratingsList.appendChild(div);
    });

    // Render Mustathniyat
    CATEGORIES.Mustathniyat.forEach(item => {
        const div = document.createElement('div');
        div.className = 'toggle-item';
        div.innerHTML = `
            <label>
                <input type="checkbox" data-id="${item.id}">
                ${item.label}
            </label>
        `;
        els.togglesList.appendChild(div);
    });

    // Re-attach listeners to new buttons
    attachControlListeners();
}

function attachControlListeners() {
    // Rating Buttons
    document.querySelectorAll('.rating-controls').forEach(group => {
        const id = group.dataset.id;
        const btns = group.querySelectorAll('button');

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update State
                const level = parseInt(btn.dataset.level);
                state.ratings[id] = level;

                // Update UI Classes
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                updatePreview();
            });
        });
    });

    // Toggles
    document.querySelectorAll('.toggle-item input').forEach(chk => {
        chk.addEventListener('change', (e) => {
            state.badges[e.target.dataset.id] = e.target.checked;
            updatePreview();
        });
    });
}

function setupEventListeners() {
    // Content Type Change
    els.contentType.addEventListener('change', (e) => {
        state.type = e.target.value;
        renderControls(); // Re-render to show/hide game options
    });

    // Comment Update
    els.userComment.addEventListener('input', (e) => {
        state.meta.comment = e.target.value;
        els.commentDisplay.innerText = state.meta.comment || '...';
    });

    // Export
    els.exportBtn.addEventListener('click', handleExport);

    // Search (Mock for now)
    els.searchBtn.addEventListener('click', handleSearch);
}


// --- Preview Logic ---
function updatePreview() {
    // 1. Update Stickers
    els.stickerGrid.innerHTML = '';

    Object.keys(state.ratings).forEach(key => {
        const level = state.ratings[key];
        if (level > 0) {
            const cat = CATEGORIES.Mawjoodat.find(c => c.id === key);
            if (!cat) return;

            const sticker = document.createElement('div');
            sticker.className = `sticker level-${level}`;
            // Placeholder SVG icon (would use actual icons from assets)
            sticker.innerHTML = getIconSVG(cat.id);

            // Add label on hover (optional)
            sticker.title = cat.label;

            els.stickerGrid.appendChild(sticker);
        }
    });

    // 2. Update Badges
    els.badgesContainer.innerHTML = '';
    Object.keys(state.badges).forEach(key => {
        if (state.badges[key]) {
            const item = CATEGORIES.Mustathniyat.find(i => i.id === key);
            if (!item) return;

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.innerText = item.label;
            els.badgesContainer.appendChild(badge);
        }
    });
}

const iconCache = {};

async function getIconSVG(id) {
    if (iconCache[id]) return iconCache[id];

    try {
        const response = await fetch(`assets/icons/${id}.svg`);
        if (!response.ok) throw new Error('Icon not found');
        const text = await response.text();
        // Remove potentially harmful scripts if any (basic sanitization) or just take the svg tag
        // Ideally we assume local assets are safe.
        iconCache[id] = text;
        return text;
    } catch (e) {
        console.error(e);
        return `<svg viewBox="0 0 24 24"><text x="12" y="16" text-anchor="middle" font-size="10" fill="currentColor">${id}</text></svg>`;
    }
}

// --- Search Logic ---
function handleSearch() {
    const query = document.getElementById('search-query').value;
    if (!query) return alert('الرجاء إدخال اسم للبحث');

    // Simulate API Call Update
    // In production, this would call the Cloudflare worker
    console.log(`Searching for ${query} in ${state.type}`);

    // Mock Update
    state.meta.title = query;
    els.titleText.innerText = query;
    els.synopsisText.innerText = `نتائج البحث عن ${query}... (هنا سيظهر الوصف الحقيقي من قاعدة البيانات عند الربط)`;

    // Random Poster for demo
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    const mockPoster = `https://via.placeholder.com/300x450/${randomColor}/ffffff?text=${encodeURIComponent(query)}`;

    els.posterImg.src = mockPoster;
    els.bgLayer.style.backgroundImage = `url(${mockPoster})`;
}

// --- Export Logic ---
function handleExport() {
    const canvasArea = document.getElementById('export-canvas');

    html2canvas(canvasArea, {
        scale: 2,
        useCORS: true,
        backgroundColor: null
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `CCCC-${state.meta.title}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

// Start
init();

// Genre Translation Map (English to Arabic)
export const genreTranslations = {
    // General
    'Action': 'أكشن',
    'Adventure': 'مغامرة',
    'Comedy': 'كوميديا',
    'Drama': 'دراما',
    'Fantasy': 'خيال',
    'Horror': 'رعب',
    'Mystery': 'غموض',
    'Romance': 'رومانسي',
    'Sci-Fi': 'خيال علمي',
    'Science Fiction': 'خيال علمي',
    'Thriller': 'إثارة',
    'Supernatural': 'خارق للطبيعة',

    // Anime/Manga Specific
    'Seinen': 'سينين',
    'Shounen': 'شونين',
    'Shoujo': 'شوجو',
    'Josei': 'جوسي',
    'Isekai': 'إيسيكاي',
    'Mecha': 'ميكا',
    'Slice of Life': 'شريحة من الحياة',
    'Sports': 'رياضة',
    'Ecchi': 'إيتشي',
    'Harem': 'حريم',
    'School': 'مدرسي',
    'Music': 'موسيقى',
    'Psychological': 'نفسي',
    'Historical': 'تاريخي',
    'Military': 'عسكري',
    'Demons': 'شياطين',
    'Vampire': 'مصاص دماء',
    'Magic': 'سحر',

    // Games
    'RPG': 'آر بي جي',
    'Action RPG': 'أكشن آر بي جي',
    'Shooter': 'إطلاق نار',
    'Platformer': 'منصات',
    'Strategy': 'استراتيجية',
    'Simulation': 'محاكاة',
    'Fighting': 'قتال',
    'Racing': 'سباق',
    'Puzzle': 'ألغاز',
    'Arcade': 'أركيد',
    'Indie': 'مستقل',
    'Massively Multiplayer': 'متعدد اللاعبين الضخم',
    'Casual': 'كاجوال',
    'Family': 'عائلي',
    'Board Games': 'ألعاب لوحية',
    'Educational': 'تعليمي',

    // Books
    'Fiction': 'خيال',
    'Non-Fiction': 'واقعي',
    'Biography': 'سيرة ذاتية',
    'Self-Help': 'مساعدة ذاتية',
    'Poetry': 'شعر',
    'Philosophy': 'فلسفة',

    // TV/Movies
    'Documentary': 'وثائقي',
    'Animation': 'رسوم متحركة',
    'Crime': 'جريمة',
    'War': 'حرب',
    'Western': 'غربي',
    'Musical': 'موسيقي',
    'Biography': 'سيرة ذاتية',
    'History': 'تاريخ',
    'Family': 'عائلي',
    'Game': 'لعبة'
};

/**
 * Translate genre names to Arabic
 * @param {string} genreText - Comma-separated genre string
 * @returns {string} - Translated genre string
 */
export function translateGenres(genreText) {
    if (!genreText) return '';

    // Split by comma, translate each, rejoin
    return genreText
        .split(',')
        .map(genre => {
            const trimmed = genre.trim();
            return genreTranslations[trimmed] || trimmed; // Fallback to original if not found
        })
        .join('، '); // Arabic comma
}

/**
 * Translate text using MyMemory API (free tier: 5000 chars/day)
 * @param {string} text - Text to translate
 * @returns {Promise<string>} - Translated text
 */
export async function translateText(text) {
    if (!text || text.length === 0) return text;

    // Check cache first
    const cacheKey = `trans_${text.substring(0, 50)}`; // Use first 50 chars as key
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        return cached;
    }

    try {
        // Google Translate (GTX) via local proxy
        const url = `proxy.php?type=translate&query=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData.translatedText) {
            const translated = data.responseData.translatedText;
            // Cache the translation
            localStorage.setItem(cacheKey, translated);
            return translated;
        }

        // Fallback to original if translation fails
        return text;
    } catch (error) {
        console.error('Translation failed:', error);
        return text; // Return original text on error
    }
}

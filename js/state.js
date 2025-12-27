// State
export const state = {
    type: 'anime', // default
    orientation: 'horizontal', // 'horizontal' or 'vertical'
    ratings: {},   // { kufr: 2 }
    badges: {},    // { nomusic: true }
    meta: {
        title: 'ANIME TITLE',
        year: '2023',
        poster: null,
        genre: 'Genre',
        synopsis: ''
    }
};

export function updateState(u) {
    Object.assign(state, u);
}

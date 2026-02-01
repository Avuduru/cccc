// State
export const state = {
    type: 'anime', // default
    orientation: 'horizontal', // 'horizontal' or 'vertical'
    ratings: {},   // { kufr: 2 }
    badges: {},    // { nomusic: true }
    meta: {
        title: 'عنوان العمل',
        year: '2023',
        poster: null,
        genre: 'نوع العمل',
        synopsis: ''
    }
};

export function updateState(u) {
    Object.assign(state, u);
}

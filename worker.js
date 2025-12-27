
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Handle the request
 * @param {Request} request
 */
async function handleRequest(request) {
  const url = new URL(request.url)
  const query = url.searchParams.get('query')
  const type = url.searchParams.get('type') // 'movie', 'game', 'anime'
  
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Environment variables are injected by Cloudflare (TMDB_KEY, RAWG_KEY)
  // Ensure these are set in your Worker settings!

  let apiUrl = ''
  let responseData = {}

  try {
    if (type === 'movie' || type === 'tv') {
        if (!TMDB_KEY) throw new Error('TMDB_KEY not set')
        // TMDB Search
        apiUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_KEY}&language=ar-SA&query=${encodeURIComponent(query)}&page=1`
    
    } else if (type === 'game') {
        if (!RAWG_KEY) throw new Error('RAWG_KEY not set')
        // RAWG Search (English usually, but check for matches)
        apiUrl = `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&page_size=5`
    
    } else if (type === 'anime') {
        // Jikan (No Key Needed)
        // Searching anime. limit to 5
        apiUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`
    }

    if (apiUrl) {
        const fetchResponse = await fetch(apiUrl)
        responseData = await fetchResponse.json()
    }

    return new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

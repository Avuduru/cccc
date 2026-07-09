# Anime & Manga Primary Data Architecture (AniList First)

## Overview
The application previously used the MyAnimeList database (via the unofficial Jikan API) as its primary source for fetching anime and manga data. However, due to frequent Jikan server outages and strict rate limits, the architecture has been reversed.

We now use **AniList GraphQL** as the primary, ultra-stable data source, and keep **Jikan** as the secondary fallback.

## How It Works (The Reversed Waterfall)

1. **Primary Request (AniList):** 
   When a user searches for an anime or manga, `proxy.php` immediately calls the `fetchAniListFallback()` function. This sends a highly optimized GraphQL `POST` request to `https://graphql.anilist.co`.
2. **Data Normalization:** 
   Because the frontend (`ui.js`) was originally built to read Jikan's JSON schema, `proxy.php` automatically normalizes the AniList data in the backend. It maps AniList fields (like `coverImage.extraLarge`) to perfectly match the Jikan format (like `images.jpg.large_image_url`). The frontend receives the data instantly without knowing it came from AniList.
3. **Failure Detection & Fallback (Jikan):** 
   If AniList experiences a rare outage or returns 0 results, `proxy.php` intercepts this and immediately fires a secondary fallback request to `api.jikan.moe`.
4. **Seamless Delivery:** 
   The user reliably receives their search results from either the primary or secondary database.

## Content Safety (NSFW Blocking)
AniList supports native content filtering. In the GraphQL query payload, we explicitly set:
```graphql
isAdult: false
```
This guarantees that Hentai and R-18+ content is stripped out at the database level. If the system falls back to Jikan, it appends `&genres_exclude=12` to maintain the same level of filtering.

## Configuration & API Keys
**No API Keys are required.**
AniList generously provides a completely open GraphQL endpoint for public search data. It allows up to 90 requests per minute per IP address without authentication. Therefore, no environment variables or keys need to be added to the CranL server environment for this setup.

## Code Modifications Made
- **`proxy.php -> fetchUrl()`**: Updated to accept a third parameter `$postData` to support cURL POST requests required by GraphQL.
- **`proxy.php -> fetchAniListFallback()`**: Helper function that handles the AniList GraphQL query and data normalization.
- **`proxy.php -> Main Logic`**: The `case 'anime':` logic sets the target to `ANILIST_PRIMARY`, triggering the execution block at the bottom to query AniList first and conditionally run the Jikan fallback.

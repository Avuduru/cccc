# Conservative Classification Of Creative Content

Conservative Classification Of Creative Content (CCCC) is a web application designed to help users rate and review media (movies, games, anime, books) based on conservative moral standards.

## API Keys Setup Guide

This guide explains how to obtain the necessary API keys and how to configure them using the PHP proxy and `.env` file.

## 1. TMDB API (Movies & TV Shows)
The Movie Database (TMDB) provides metadata for movies and television series.

1.  Visit [TMDB](https://www.themoviedb.org/) and create an account.
2.  Log in and click on your profile icon, then select **Settings**.
3.  In the left sidebar, click on **API**.
4.  Follow the instructions to generate a new API key (select "Developer" if prompted).
5.  Copy the **API Key (v3 auth)**.

## 2. RAWG API (Video Games)
RAWG is the largest video game database and discovery service.

1.  Visit [RAWG.io/apidocs](https://rawg.io/apidocs).
2.  Create an account or log in.
3.  On your dashboard, you will find a section to request or view your **API Key**.
4.  Copy the key.

## 3. Jikan API (Anime & Manga)
Jikan is an open-source PHP & REST API for the MyAnimeList (MAL) database.

*   **No API Key required!** Jikan is free to use but has rate limits.

---

## Configuration

The application uses a PHP proxy (`proxy.php`) to handle API requests and keep your keys secure.

### 1. Create a `.env` file
Duplicate `.env.example` and rename it to `.env`:
```bash
cp .env.example .env
```

### 2. Add your keys
Open `.env` and add your API keys:
```env
TMDB_KEY=your_tmdb_key_here
RAWG_KEY=your_rawg_key_here
```

### 3. Server Requirements
- PHP 7.4 or higher
- PHP cURL extension enabled

---

## Local Development & Testing

1.  **Run a Local PHP Server**:
    ```bash
    php -S localhost:8080
    ```
2.  **Open the Application**:
    Navigate to `http://localhost:8080` in your browser.

The application is configured to use `proxy.php` as the `WORKER_URL` in `js/config.js` by default.

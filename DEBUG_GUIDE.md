# CCCC Search Not Working - Debug Guide

## Problem
When searching for shows in CCCC, nothing appears even though API keys are in the `.env` file.

## Step-by-Step Fix

### 1. ✅ Verify Your `.env` File Has REAL API Keys

Your `.env` file currently shows:
```
TMDB_KEY=your_tmdb_api_key_here
RAWG_KEY=your_rawg_api_key_here
```

**These are placeholders, NOT real API keys!**

You need to:
1. Get a real TMDB API key from https://www.themoviedb.org/settings/api
2. Replace `your_tmdb_api_key_here` with your actual key (it should look like a long string of letters and numbers)

Example of what it should look like:
```
TMDB_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
RAWG_KEY=your_rawg_api_key_here
```

### 2. ✅ Save the `.env` File

Make sure you **save** the file after editing it!

### 3. ✅ Restart Your PHP Server

**CRITICAL:** PHP loads the `.env` file only when it starts. You MUST restart the server:

1. Go to your terminal where `php -S localhost:8080` is running
2. Press `Ctrl+C` to stop it
3. Run `php -S localhost:8080` again to restart it

### 4. ✅ Test the Search

1. Open your browser to http://localhost:8080
2. Click on "مسلسل" (TV) button
3. Type a show name (e.g., "Breaking Bad")
4. Check if results appear

### 5. 🔍 Check for Errors

Open your browser's Developer Console:
- Press `F12` or right-click → "Inspect"
- Go to the "Console" tab
- Try searching again
- Look for any red error messages

Common errors you might see:
- **401 Unauthorized** = Invalid API key
- **Network error** = Server not running or wrong URL
- **CORS error** = Browser security issue (shouldn't happen with this setup)

### 6. 🔍 Check PHP Server Logs

Look at your terminal where PHP is running. When you search, you should see log entries like:
```
[Sat Jan 31 18:00:00 2026] 127.0.0.1:12345 [200]: GET /proxy.php?query=Breaking+Bad&type=tv
```

If you see `[404]` or `[500]`, there's a server error.

### 7. 🧪 Test the API Directly

Open this URL in your browser (replace YOUR_KEY with your actual TMDB key):
```
http://localhost:8080/proxy.php?query=Breaking%20Bad&type=tv
```

You should see JSON data with search results. If you see an error, that tells us what's wrong.

## Quick Checklist

- [ ] `.env` file has a REAL API key (not placeholder text)
- [ ] `.env` file is saved
- [ ] PHP server was restarted after editing `.env`
- [ ] Browser is pointing to http://localhost:8080
- [ ] No errors in browser console (F12)
- [ ] PHP server shows requests in terminal

## Still Not Working?

If you've done all the above and it still doesn't work, check:

1. **Did you get the right type of API key?**
   - For TMDB, you need the "API Key (v3 auth)", NOT the "API Read Access Token (v4 auth)"

2. **Is your API key activated?**
   - Some API providers require email verification before keys work

3. **Are you searching for the right content type?**
   - TV shows = "مسلسل" button
   - Movies = "فيلم" button
   - Anime/Manga don't need API keys

## Testing Without API Keys

Want to test if the app works at all? Try:
- Click "أنمي" (Anime) or "مانجا" (Manga)
- Search for "Naruto" or "One Piece"
- These don't require API keys and should work immediately!

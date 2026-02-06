# Kjs-Nuvio Plugin Troubleshooting Guide

## Current Status

### ✅ Working Providers
- **4KHDHub.DAD** - Fully functional and tested. Returns streams for movies and TV shows.

### ⚠️ Disabled Providers
- **MoviesDrive** - Uses JavaScript rendering, not compatible with server-side scraping
- **Vegamovies** - Uses JavaScript rendering, not compatible with server-side scraping

## Why Some Providers Don't Work

The Nuvio plugin uses **server-side scraping** with `fetch()` and `cheerio`. However, some streaming sites use **client-side rendering** with JavaScript to load content dynamically. This means:

1. The HTML returned by the server doesn't contain search results
2. Results are loaded by JavaScript in the browser
3. Server-side scrapers cannot access dynamically loaded content

### Affected Providers
- **MoviesDrive.forum** - Uses JavaScript to load search results
- **Vegamovies.surf** - Uses JavaScript to load search results

### Working Provider
- **4khdhub.dad** - Returns full HTML with search results server-side ✓

## Solutions

### For Users

1. **Use 4KHDHub.DAD** - It's the only fully functional provider currently
   - Search for movies and TV shows
   - Returns high-quality streams
   - Supports external players

2. **Clear Nuvio Cache**
   - Close the app completely
   - Clear app cache (Settings → Storage → Clear Cache)
   - Restart and test

3. **Reinstall the Plugin**
   - Remove: Settings → Local Scrapers → Remove Kjs
   - Add: `https://raw.githubusercontent.com/KotlinJS5/Kjs/main/`

### For Developers

To fix MoviesDrive and Vegamovies, you would need to:

1. **Use a Headless Browser** (Puppeteer, Playwright)
   - Can execute JavaScript
   - Can wait for dynamic content
   - More resource-intensive

2. **Find API Endpoints**
   - Some sites have hidden API endpoints
   - Analyze network requests in browser DevTools
   - Use the API directly instead of scraping

3. **Use Alternative Sources**
   - Find other streaming sites with server-side rendering
   - Implement new providers

## Testing Results

```
4KHDHub.DAD:  ✓ 16 streams found for "The Matrix"
MoviesDrive:  ✗ 0 streams (JavaScript rendering)
Vegamovies:   ✗ 0 streams (JavaScript rendering)
```

## Common Issues and Solutions

### Issue 1: No Streams Appearing

**Solution:**
- Ensure 4KHDHub.DAD is enabled in the plugin settings
- Try searching for popular movies: "The Matrix", "Inception", "Avatar"
- Check internet connection

### Issue 2: Slow Loading

**Solution:**
- 4KHDHub takes 5-15 seconds to search and extract streams
- This is normal due to multiple HTTP requests
- Patient waiting is required

### Issue 3: Streams Not Playing

**Solution:**
- Try opening in an external player
- Check if the stream URL is accessible from your region
- Some streams may be region-restricted

## Version History

### v1.0.2
- Disabled MoviesDrive and Vegamovies (JavaScript rendering incompatibility)
- Focused on 4KHDHub.DAD as the primary working provider
- Updated documentation

### v1.0.1
- Added proper error handling and logging
- Fixed stream object format for Nuvio compatibility
- Added headers to all stream objects

### v1.0.0
- Initial release with three providers

## Future Improvements

To make this plugin more robust, consider:

1. **Add More Server-Side Rendering Sites**
   - Find other streaming sites that return HTML with content
   - Implement scrapers for those sites

2. **Implement Headless Browser Support**
   - Use Puppeteer or Playwright for JavaScript rendering
   - May require Nuvio framework updates

3. **Add API-Based Providers**
   - Some sites have public or hidden APIs
   - More reliable than scraping

4. **Implement Caching**
   - Cache search results to reduce API calls
   - Improve performance

## Getting Help

If you continue to experience issues:

1. **Verify 4KHDHub is Enabled**
   - Go to Settings → Local Scrapers
   - Check that 4KHDHub.DAD has a checkmark

2. **Test with Known Content**
   - Search for "The Matrix" (1999)
   - Search for "Breaking Bad" (TV show)

3. **Check Your Region**
   - Some sites may be blocked in certain countries
   - Consider using a VPN (at your own risk)

4. **Report Issues**
   - Include error messages from Nuvio logs
   - Specify what content you searched for
   - Mention your region/country

## Technical Details

### Stream Object Format
```javascript
{
    name: "Provider Name - Quality",
    title: "Movie/Show Title (Year)",
    url: "https://stream-url",
    quality: "1080p|HD|4K",
    size: "2.5GB|Unknown",
    provider: "provider-id",
    headers: {
        'User-Agent': 'Mozilla/5.0...',
        'Referer': 'https://source-url'
    }
}
```

### Supported Media Types
- **Movies**: All enabled providers support movies
- **TV Shows**: All enabled providers support TV shows (season and episode parameters required)

### Timeout Configuration
- Default: 30 seconds per provider
- 4KHDHub typically responds in 5-15 seconds

## Why This Matters

Scraping streaming sites is challenging because:

1. **Sites Protect Their Content** - They use JavaScript rendering and anti-scraping measures
2. **Sites Change Structure** - HTML structure changes frequently
3. **Regional Restrictions** - Content may be blocked by region
4. **Rate Limiting** - Too many requests may get you blocked

The 4KHDHub provider works because it returns full HTML server-side, making it compatible with our scraping approach.

---

**Last Updated:** February 2026  
**Plugin Version:** 1.0.2  
**Status:** 4KHDHub working, MoviesDrive/Vegamovies disabled

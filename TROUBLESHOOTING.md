# Kjs-Nuvio Plugin Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Plugin Installed but Not Loading Content

**Symptoms:**
- Plugin appears in Nuvio settings
- No streams are returned when searching for content
- No error messages visible

**Solutions:**

1. **Clear Nuvio Cache**
   - Close the Nuvio app completely
   - Clear the app cache (Settings → Storage → Clear Cache)
   - Restart the app

2. **Verify Plugin URL**
   - Go to Settings → Local Scrapers
   - Ensure the URL is: `https://raw.githubusercontent.com/KotlinJS5/Kjs/main/`
   - Remove and re-add the plugin if needed

3. **Check Internet Connection**
   - Ensure you have a stable internet connection
   - The plugin requires access to external APIs (TMDB, 4khdhub.dad, moviesdrive.forum, vegamovies.surf)

4. **Verify Source Websites**
   - The plugin relies on external streaming sites that may be down or blocked in your region
   - Try searching for popular movies like "The Matrix" or "Inception"

### Issue 2: Specific Provider Not Working

**For 4KHDHub.DAD:**
- The site may require JavaScript rendering or have changed its structure
- Try searching for popular movies from 1999-2024
- Check if the domain is accessible in your region

**For MoviesDrive:**
- The site uses HubCloud for hosting
- Ensure HubCloud domains (hubcloud.dad, hubcloud.ink) are accessible
- Some regions may have restrictions

**For Vegamovies:**
- Similar to MoviesDrive, relies on HubCloud hosting
- Check regional access restrictions

### Issue 3: Slow or Timeout Errors

**Solutions:**
1. **Increase Timeout Setting**
   - The default timeout is 30 seconds
   - If you're on a slow connection, this may not be enough

2. **Check Network Speed**
   - Run a speed test to ensure adequate bandwidth
   - Minimum recommended: 5 Mbps download

3. **Try Different Providers**
   - If one provider is slow, try another
   - Different providers may have different response times

### Issue 4: Stream URLs Not Playing

**Solutions:**
1. **Check External Player Support**
   - All providers support external players
   - Try opening the stream in an external video player

2. **Verify Headers**
   - Some streams require specific headers for playback
   - The plugin includes necessary headers automatically

3. **Check Stream URL Format**
   - Ensure the URL is accessible from your device
   - Some streams may be region-restricted

## Technical Details

### Stream Object Format
Each provider returns streams in this format:
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
- **Movies**: All providers support movies
- **TV Shows**: All providers support TV shows (season and episode parameters required)

### Timeout Configuration
- Default: 30 seconds per provider
- Maximum: 60 seconds (configurable in manifest)
- Minimum: 10 seconds

## Debugging

### Enable Logging
To see detailed logs from the plugin:
1. Open Nuvio developer console (if available)
2. Search for content
3. Check console for error messages starting with `[4KHDHub.DAD]`, `[MoviesDrive]`, or `[Vegamovies]`

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `TMDB API error: 401` | Invalid API key | Contact developer |
| `TMDB API error: 404` | Content not found in TMDB | Try different search terms |
| `Search error: 403` | Access denied to source site | Check regional restrictions |
| `No matching content found` | Content not available on source | Try different provider |
| `Empty search results` | Network issue or site blocked | Check internet connection |

## Regional Restrictions

Some streaming sites may be blocked in certain regions:
- **Europe**: GDPR restrictions may apply
- **Asia**: Regional blocking may be in place
- **North America**: Generally accessible

If you encounter access issues, consider using a VPN (at your own risk and responsibility).

## Getting Help

If you continue to experience issues:
1. Check this troubleshooting guide
2. Review the plugin logs in Nuvio
3. Verify all source websites are accessible
4. Try with different content (popular vs. obscure)
5. Report issues on GitHub with:
   - Error message
   - Content you were searching for
   - Your region/country
   - Device type and OS

## Version History

### v1.0.1
- Added proper error handling and logging
- Fixed stream object format for Nuvio compatibility
- Added headers to all stream objects
- Improved timeout handling

### v1.0.0
- Initial release
- Three providers: 4KHDHub.DAD, MoviesDrive, Vegamovies

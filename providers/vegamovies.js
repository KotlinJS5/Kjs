
// providers/vegamovies.js
const cheerio = require('cheerio');

class VegaMoviesScraper {
    constructor() {
        this.name = "Vegamovies";
        this.version = "1.0.0";
        this.baseUrl = 'https://vegamovies.surf';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://vegamovies.surf/'
        };
        this.TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
    }

    cleanTitle(text) {
        return text.replace(/\s*\(.*?\)\s*|\s*\[.*?\]\s*|\s*\|.*$/gi, '').trim().toLowerCase();
    }

    // REQUIRED: Search function that takes a query
    async search(query, type = "movie") {
        try {
            const response = await fetch(`${this.baseUrl}/?s=${encodeURIComponent(query)}`, {
                headers: this.headers
            });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const results = [];
            $('.post').each((i, element) => {
                const title = $(element).find('h2 a').text();
                const url = $(element).find('h2 a').attr('href');
                const poster = $(element).find('img').attr('src');
                
                if (title && url) {
                    results.push({
                        title: title,
                        url: url.startsWith('http') ? url : this.baseUrl + url,
                        poster: poster || '',
                        type: title.toLowerCase().includes('season') ? 'tv' : 'movie'
                    });
                }
            });
            
            return results.slice(0, 10); // Return top 10 results
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    // REQUIRED: Get metadata for a specific URL
    async getMeta(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            return {
                title: $('h1.entry-title').text() || 'Unknown Title',
                year: $('.year').text() || '',
                plot: $('.entry-content p').first().text() || '',
                poster: $('.poster img').attr('src') || ''
            };
        } catch (error) {
            console.error('Meta error:', error);
            return { title: 'Error loading metadata' };
        }
    }

    // REQUIRED: Get download links/streams
    async getLinks(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const streams = [];
            const selectors = 'a[href*="drive.google"], a[href*="mega.nz"], a[href*="gdtot"], a[href*="filepress"], a[href*="download"], .download-btn, .btn';
            
            $(selectors).each((i, element) => {
                const link = $(element).attr('href');
                if (!link || !link.includes('http')) return;
                
                const text = $(element).text();
                const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
                const quality = qualityMatch ? qualityMatch[0] : 'HD';
                
                streams.push({
                    name: `Vegamovies ${quality}`,
                    url: link,
                    quality: quality,
                    headers: this.headers,
                    provider: 'vegamovies'
                });
            });
            
            return streams;
        } catch (error) {
            console.error('Links error:', error);
            return [];
        }
    }

    // Optional: Get streams by TMDB ID (your original function, fixed)
    async getStreams(tmdbId, mediaType = "movie", seasonNum = null, episodeNum = null) {
        try {
            const titleFetchUrl = mediaType === 'movie'
                ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${this.TMDB_API_KEY}`
                : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${this.TMDB_API_KEY}`;
            
            const infoRes = await fetch(titleFetchUrl);
            const info = await infoRes.json();
            
            if (!info || info.success === false) return [];
            
            const title = mediaType === 'movie' ? info.title : info.name;
            const year = (mediaType === 'movie' ? info.release_date : info.first_air_date || '').split('-')[0] || '';
            
            // Search for this title on Vegamovies
            const searchResults = await this.search(`${title} ${year}`);
            if (searchResults.length === 0) return [];
            
            // Use first result
            const firstResult = searchResults[0];
            return await this.getLinks(firstResult.url);
        } catch (error) {
            console.error('GetStreams error:', error);
            return [];
        }
    }
}

// EXPORT THE CLASS INSTANCE
module.exports = new VegaMoviesScraper();

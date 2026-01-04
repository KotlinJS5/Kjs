
// providers/hdhub4u.js
const cheerio = require('cheerio');

class HDHub4uScraper {
    constructor() {
        this.name = "HDHub4u";
        this.version = "1.0.0";
        this.baseUrl = 'https://new1.hdhub4u.fo';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': 'https://new1.hdhub4u.fo/'
        };
        this.TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
    }

    // REQUIRED: Search function
    async search(query, type = "movie") {
        try {
            const response = await fetch(`${this.baseUrl}/?s=${encodeURIComponent(query)}`, {
                headers: this.headers
            });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const results = [];
            $('.post, article, .movie-item').each((i, element) => {
                const title = $(element).find('h2 a, h3 a, .title a').text();
                const url = $(element).find('a').attr('href');
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
            
            return results.slice(0, 10);
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    // REQUIRED: Get metadata
    async getMeta(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            return {
                title: $('h1.entry-title, h1.title').text() || 'Unknown Title',
                year: $('.year, .date').text() || '',
                plot: $('.entry-content p, .plot').first().text() || '',
                poster: $('.poster img, .thumbnail img').attr('src') || ''
            };
        } catch (error) {
            console.error('Meta error:', error);
            return { title: 'Error loading metadata' };
        }
    }

    // REQUIRED: Get download links
    async getLinks(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const streams = [];
            const selectors = 'a[href*="download"], a.btn, a[href*="gdrive"], a[href*="clicknupload"], a[href*="indishare"], a[href*="mega"], a[href*="drive.google"]';
            
            $(selectors).each((i, element) => {
                const link = $(element).attr('href');
                if (!link || !link.includes('http')) return;
                
                const text = $(element).text();
                const qualityMatch = text.match(/(480p|720p|1080p|4K)/i);
                const quality = qualityMatch ? qualityMatch[0] : 'HD';
                
                streams.push({
                    name: `HDHub4u ${quality}`,
                    url: link,
                    quality: quality,
                    headers: this.headers,
                    provider: 'hdhub4u'
                });
            });
            
            return streams;
        } catch (error) {
            console.error('Links error:', error);
            return [];
        }
    }

    // Optional: Get streams by TMDB ID
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
            
            const searchResults = await this.search(`${title} ${year}`);
            if (searchResults.length === 0) return [];
            
            const firstResult = searchResults[0];
            return await this.getLinks(firstResult.url);
        } catch (error) {
            console.error('GetStreams error:', error);
            return [];
        }
    }
}

// EXPORT THE CLASS INSTANCE
module.exports = new HDHub4uScraper();

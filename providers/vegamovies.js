// Vegamovies Scraper for Nuvio
const cheerio = require('cheerio-without-node-native');

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

    // --- HELPER FOR BASE64 ---
    atob(value) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let input = String(value).replace(/=+$/, '');
        let output = '';
        let bc = 0, bs, buffer, idx = 0;
        while ((buffer = input.charAt(idx++))) {
            buffer = chars.indexOf(buffer);
            if (~buffer) {
                bs = bc % 4 ? bs * 64 + buffer : buffer;
                if (bc++ % 4) {
                    output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
                }
            }
        }
        return output;
    }

    // --- HUBCLOUD EXTRACTOR (The Missing Piece) ---
    async hubCloudExtractor(url, referer) {
        try {
            let currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
            
            const res = await fetch(currentUrl, { headers: { ...this.headers, 'Referer': referer } });
            const html = await res.text();
            const $ = cheerio.load(html);

            // Look for the "vcloud" or "drive" redirector
            const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
            if (hubPhp) {
                const res2 = await fetch(hubPhp, { headers: { ...this.headers, 'Referer': currentUrl } });
                const html2 = await res2.text();
                const $2 = cheerio.load(html2);
                
                const finalLink = $2('a.btn-success').attr('href') || $2('a.btn-primary').attr('href');
                const title = $2('div.card-header').text().trim() || "Stream";

                if (finalLink) {
                    return [{
                        name: `Vegamovies - ${title}`,
                        url: finalLink,
                        quality: title.includes('1080p') ? '1080p' : (title.includes('720p') ? '720p' : 'HD')
                    }];
                }
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    async search(query) {
        try {
            const response = await fetch(`${this.baseUrl}/?s=${encodeURIComponent(query)}`, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            const results = [];
            
            $('.post').each((i, el) => {
                const title = $(el).find('h2 a').text();
                const url = $(el).find('h2 a').attr('href');
                if (title && url) {
                    results.push({ title, url });
                }
            });
            return results;
        } catch (e) { return []; }
    }

    async getLinks(url) {
        try {
            const response = await fetch(url, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            let streams = [];

            // Find all download buttons/links
            const links = $('a[href*="hubcloud"], a[href*="v-cloud"]').map((i, el) => $(el).attr('href')).get();

            for (const link of links) {
                const extracted = await this.hubCloudExtractor(link, url);
                streams = streams.concat(extracted);
            }
            
            return streams;
        } catch (e) { return []; }
    }

    async getStreams(tmdbId, mediaType = "movie") {
        try {
            const tmdbUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${this.TMDB_API_KEY}`;
            const infoRes = await fetch(tmdbUrl);
            const info = await infoRes.json();
            if (!info.title && !info.name) return [];

            const title = mediaType === 'movie' ? info.title : info.name;
            const searchResults = await this.search(title);
            
            if (searchResults.length > 0) {
                return await this.getLinks(searchResults[0].url);
            }
            return [];
        } catch (e) { return []; }
    }
}

module.exports = new VegaMoviesScraper();

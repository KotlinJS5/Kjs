const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
const BASE_URL = 'https://vegamovies.surf';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

const VegaMoviesScraper = {
    // 1. Faster Search
    search: function(query) {
        return fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const results = [];
                // Only take the very first result to avoid multiple fetches that cause crashes
                const firstResult = $('.post, article').first();
                const title = firstResult.find('h2, h3').text().trim();
                const url = firstResult.find('a').attr('href');
                
                if (title && url) {
                    results.push({ title, url });
                }
                return results;
            })
            .catch(() => []);
    },

    // 2. Extract with Timeout Protection
    getLinks: function(url) {
        return fetch(url, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubLinks = [];
                // Focus only on HubCloud as it's the most reliable on Vega
                $('a[href*="hubcloud"]').each((i, el) => {
                    const link = $(el).attr('href');
                    if (link) hubLinks.push(link);
                });

                if (hubLinks.length === 0) return [];

                // Only try the first link found to prevent "Multiple Fetch" errors in Nuvio
                return this.extractHubCloud(hubLinks[0], url);
            })
            .catch(() => []);
    },

    // 3. Simple Resolver
    extractHubCloud: function(url, referer) {
        const targetUrl = url.replace("hubcloud.ink", "hubcloud.dad");
        return fetch(targetUrl, { headers: { ...HEADERS, 'Referer': referer } })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
                if (!hubPhp) return [];

                return fetch(hubPhp, { headers: { ...HEADERS, 'Referer': targetUrl } })
                    .then(res2 => res2.text())
                    .then(html2 => {
                        const $2 = cheerio.load(html2);
                        const finalUrl = $2('a.btn-success, a.btn-primary').first().attr('href');
                        const name = $2('div.card-header').text().trim() || "Vegamovies Stream";
                        
                        if (finalUrl && finalUrl.includes('http')) {
                            return [{
                                name: `Vega: ${name.split('|')[0].trim()}`,
                                url: finalUrl,
                                quality: name.includes('1080p') ? '1080p' : '720p'
                            }];
                        }
                        return [];
                    });
            })
            .catch(() => []);
    },

    getStreams: function(tmdbId, mediaType) {
        return fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`)
            .then(res => res.json())
            .then(info => {
                const title = info.title || info.name;
                if (!title) return [];
                return this.search(title).then(results => {
                    if (results.length > 0) {
                        return this.getLinks(results[0].url);
                    }
                    return [];
                });
            })
            .catch(() => []);
    }
};

module.exports = VegaMoviesScraper;

const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
const BASE_URL = 'https://vegamovies.surf';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

const VegaMoviesScraper = {
    // 1. Search for the movie/show
    search: function(query) {
        return fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const results = [];
                $('.post').each((i, el) => {
                    const title = $(el).find('h2 a').text();
                    const url = $(el).find('h2 a').attr('href');
                    if (title && url) results.push({ title, url });
                });
                return results;
            })
            .catch(() => []);
    },

    // 2. Extract HubCloud links from the post
    getLinks: function(url) {
        return fetch(url, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubLinks = [];
                // Vegamovies uses buttons with hubcloud or v-cloud in the link
                $('a[href*="hubcloud"], a[href*="v-cloud"]').each((i, el) => {
                    const link = $(el).attr('href');
                    if (link) hubLinks.push(link);
                });

                if (hubLinks.length === 0) return [];

                // We try to resolve the first few links found
                const promises = hubLinks.slice(0, 3).map(link => this.extractHubCloud(link, url));
                return Promise.all(promises).then(results => results.flat());
            })
            .catch(() => []);
    },

    // 3. Resolve the actual video file from HubCloud
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
                        
                        if (finalUrl) {
                            return [{
                                name: `Vega: ${name}`,
                                url: finalUrl,
                                quality: name.includes('1080p') ? '1080p' : '720p'
                            }];
                        }
                        return [];
                    });
            })
            .catch(() => []);
    },

    // 4. Main Entry point for Nuvio
    getStreams: function(tmdbId, mediaType) {
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        return fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`)
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

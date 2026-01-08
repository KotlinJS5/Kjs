const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
const BASE_URL = 'https://vegamovies.surf';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

const VegaMoviesScraper = {
    // 1. Search Logic: We use only the title to increase match chances
    search: function(query) {
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
        return fetch(searchUrl, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const results = [];
                // Vegamovies posts are usually inside article or div.post
                $('article, .post').each((i, el) => {
                    const title = $(el).find('h2, h3').text().trim();
                    const url = $(el).find('a').attr('href');
                    if (title && url && url.includes(BASE_URL)) {
                        results.push({ title, url });
                    }
                });
                return results;
            })
            .catch(() => []);
    },

    // 2. Extraction: Finding the HubCloud buttons
    getLinks: function(url) {
        return fetch(url, { headers: HEADERS })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubLinks = [];
                // Look for common download button patterns on Vegamovies
                $('a[href*="hubcloud"], a[href*="v-cloud"], a[href*="vcloud"]').each((i, el) => {
                    const link = $(el).attr('href');
                    if (link) hubLinks.push(link);
                });

                if (hubLinks.length === 0) return [];

                // Resolve the first 3 links found to save time/memory
                const promises = hubLinks.slice(0, 3).map(link => this.extractHubCloud(link, url));
                return Promise.all(promises).then(results => results.flat());
            })
            .catch(() => []);
    },

    // 3. Resolver: Bypassing the intermediate landing page
    extractHubCloud: function(url, referer) {
        // Handle common domain changes
        const targetUrl = url.replace("hubcloud.ink", "hubcloud.dad").replace("v-cloud.link", "v-cloud.biz");
        
        return fetch(targetUrl, { headers: { ...HEADERS, 'Referer': referer } })
            .then(res => res.text())
            .then(html => {
                const $ = cheerio.load(html);
                // The actual video link is often behind a "hubcloud.php" redirect
                const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
                
                if (!hubPhp) {
                    // Sometimes the direct download link is already on this page
                    const direct = $('a.btn-success, a.btn-primary').first().attr('href');
                    if (direct && direct.includes('http')) {
                        return [{ name: "Vega HD Stream", url: direct, quality: "HD" }];
                    }
                    return [];
                }

                return fetch(hubPhp, { headers: { ...HEADERS, 'Referer': targetUrl } })
                    .then(res2 => res2.text())
                    .then(html2 => {
                        const $2 = cheerio.load(html2);
                        const finalUrl = $2('a.btn-success, a.btn-primary').first().attr('href');
                        const name = $2('div.card-header').text().trim() || "Vegamovies";
                        
                        if (finalUrl && finalUrl.includes('http')) {
                            return [{
                                name: `Vega: ${name.substring(0, 20)}...`,
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
        return fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}`)
            .then(res => res.json())
            .then(info => {
                const title = info.title || info.name;
                if (!title) return [];
                // Search only for the title to be safe
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

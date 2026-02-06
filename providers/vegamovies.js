const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const MAIN_URL = "https://vegamovies.surf";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

function loadExtractor(url, referer) {
    if (!url) return Promise.resolve([]);
    if (url.includes('hubcloud') || url.includes('hubcloud.php')) {
        return hubCloudExtractor(url, referer);
    }
    return Promise.resolve([]);
}

function hubCloudExtractor(url, referer) {
    if (!url) return Promise.resolve([]);
    
    let currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
    return fetch(currentUrl, { headers: { ...HEADERS, Referer: referer } })
        .then(res => {
            if (!res.ok) throw new Error(`HubCloud fetch failed: ${res.status}`);
            return res.text();
        })
        .then(html => {
            const $ = cheerio.load(html);
            const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
            if (!hubPhp) return [];
            
            return fetch(hubPhp, { headers: { ...HEADERS, Referer: currentUrl } })
                .then(res => {
                    if (!res.ok) throw new Error(`HubCloud PHP failed: ${res.status}`);
                    return res.text();
                })
                .then(html2 => {
                    const $2 = cheerio.load(html2);
                    const finalUrl = $2('a.btn-success, a.btn-primary').first().attr('href');
                    const title = $2('div.card-header').text().trim() || "Vegamovies";
                    return finalUrl ? [{
                        name: "Vegamovies",
                        title: title,
                        url: finalUrl,
                        quality: "HD",
                        size: "Unknown",
                        provider: "vegamovies",
                        headers: {
                            'User-Agent': HEADERS['User-Agent'],
                            'Referer': hubPhp
                        }
                    }] : [];
                });
        })
        .catch(err => {
            console.error(`[Vegamovies] HubCloud error: ${err.message}`);
            return [];
        });
}

function getStreams(tmdbId, mediaType, season, episode) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    
    return fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`, { headers: HEADERS })
        .then(res => {
            if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
            return res.json();
        })
        .then(info => {
            if (!info) throw new Error('No TMDB data');
            
            const title = info.title || info.name;
            if (!title) throw new Error('No title found');
            
            return fetch(`${MAIN_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS })
                .then(res => {
                    if (!res.ok) throw new Error(`Search error: ${res.status}`);
                    return res.text();
                })
                .then(html => {
                    const $ = cheerio.load(html);
                    const postUrl = $('.post-title a, h2.entry-title a').first().attr('href');
                    if (!postUrl) throw new Error('No search results');

                    return fetch(postUrl, { headers: HEADERS })
                        .then(res => {
                            if (!res.ok) throw new Error(`Post error: ${res.status}`);
                            return res.text();
                        })
                        .then(postHtml => {
                            const $post = cheerio.load(postHtml);
                            const linkPromises = [];
                            $post('a[href*="hubcloud"]').each((i, el) => {
                                const href = $post(el).attr('href');
                                if (href) {
                                    linkPromises.push(loadExtractor(href, postUrl));
                                }
                            });
                            return linkPromises.length > 0 ? Promise.all(linkPromises).then(results => results.flat()) : [];
                        });
                });
        })
        .catch(err => {
            console.error(`[Vegamovies] Error: ${err.message}`);
            return [];
        });
}

module.exports = { getStreams };

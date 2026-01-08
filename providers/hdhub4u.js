const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
let MAIN_URL = "https://new1.hdhub4u.fo";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

function loadExtractor(url, referer) {
    if (!url || !url.includes('http')) return Promise.resolve([]);
    // HDHub4u often uses instantdownload or hubcloud
    if (url.includes('hubcloud') || url.includes('instantdownload')) {
        return hubCloudExtractor(url, referer);
    }
    return Promise.resolve([]);
}

function hubCloudExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(res => res.text())
        .then(html => {
            const $ = cheerio.load(html);
            // Look for the "Unlock" or "Download" button on the landing page
            const nextLink = $('a.btn-primary, a.btn-success').first().attr('href');
            if (nextLink && nextLink.includes('http')) {
                return [{ name: "HDHub4u", title: "Direct Stream", url: nextLink, quality: "HD" }];
            }
            return [];
        }).catch(() => []);
}

function getStreams(tmdbId, mediaType, season, episode) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    return fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(info => {
            const title = info.title || info.name;
            return fetch(`${MAIN_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS })
                .then(res => res.text())
                .then(html => {
                    const $ = cheerio.load(html);
                    // Select first result from HDHub4u list
                    const postUrl = $('.media-body a').first().attr('href') || $('.post-title a').first().attr('href');
                    if (!postUrl) return [];

                    return fetch(postUrl, { headers: HEADERS })
                        .then(res => res.text())
                        .then(postHtml => {
                            const $post = cheerio.load(postHtml);
                            const linkPromises = [];
                            $post('a[href*="hubcloud"], a[href*="instantdownload"]').each((i, el) => {
                                linkPromises.push(loadExtractor($post(el).attr('href'), postUrl));
                            });
                            return Promise.all(linkPromises).then(results => results.flat());
                        });
                });
        }).catch(() => []);
}

module.exports = { getStreams };

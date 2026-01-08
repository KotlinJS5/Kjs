const cheerio = require('cheerio-without-node-native');

// Configuration
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
let MAIN_URL = "https://moviesdrive.forum";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

// --- Helper: The Link Router (Load Extractor) ---
// This identifies which server the link belongs to and sends it to the right function
function loadExtractor(url, referer) {
    if (!url) return Promise.resolve([]);
    
    if (url.includes('hubcloud') || url.includes('hubcloud.php')) {
        return hubCloudExtractor(url, referer);
    } else if (url.includes('pixeldrain')) {
        return pixelDrainExtractor(url);
    } else if (url.includes('streamtape')) {
        return streamTapeExtractor(url);
    } else if (url.includes('hubcdn')) {
        return hubCdnExtractor(url, referer);
    }
    
    // Default fallback
    return Promise.resolve([{ name: "Moviesdrive", title: "Direct Link", url: url, quality: "HD" }]);
}

// --- Specific Extractors (Simplified versions of your working code) ---

function hubCloudExtractor(url, referer) {
    let currentUrl = url.replace("hubcloud.ink", "hubcloud.dad");
    return fetch(currentUrl, { headers: { ...HEADERS, Referer: referer } })
        .then(res => res.text())
        .then(html => {
            const $ = cheerio.load(html);
            const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
            if (hubPhp) {
                return fetch(hubPhp, { headers: { ...HEADERS, Referer: currentUrl } })
                    .then(res2 => res2.text())
                    .then(html2 => {
                        const $2 = cheerio.load(html2);
                        const finalUrl = $2('a.btn-success, a.btn-primary').first().attr('href');
                        const title = $2('div.card-header').text().trim() || "HubCloud";
                        return finalUrl ? [{ name: "Moviesdrive", title: title, url: finalUrl, quality: "HD" }] : [];
                    });
            }
            return [];
        }).catch(() => []);
}

function pixelDrainExtractor(url) {
    const fileId = url.split('/').pop();
    const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
    return Promise.resolve([{ name: "Moviesdrive", title: "Pixeldrain Fast", url: directUrl, quality: "HD" }]);
}

function streamTapeExtractor(url) {
    return Promise.resolve([{ name: "Moviesdrive", title: "StreamTape", url: url, quality: "SD" }]);
}

function hubCdnExtractor(url, referer) {
    return Promise.resolve([{ name: "Moviesdrive", title: "HubCDN M3U8", url: url, quality: "HD" }]);
}

// --- Main Nuvio Entry Point ---
function getStreams(tmdbId, mediaType, season, episode) {
    const type = mediaType === 'movie' ? 'movie' : 'tv';
    return fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`)
        .then(res => res.json())
        .then(info => {
            const title = info.title || info.name;
            if (!title) return [];

            return fetch(`${MAIN_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS })
                .then(res => res.text())
                .then(html => {
                    const $ = cheerio.load(html);
                    const postUrl = $('article a, .post a').first().attr('href');
                    if (!postUrl) return [];

                    return fetch(postUrl, { headers: HEADERS })
                        .then(res => res.text())
                        .then(postHtml => {
                            const $post = cheerio.load(postHtml);
                            const linkPromises = [];

                            $post('a[href*="hubcloud"], a[href*="pixeldrain"], a[href*="streamtape"]').each((i, el) => {
                                const href = $post(el).attr('href');
                                linkPromises.push(loadExtractor(href, postUrl));
                            });

                            return Promise.all(linkPromises).then(results => results.flat());
                        });
                });
        })
        .catch(() => []);
}

module.exports = { getStreams };

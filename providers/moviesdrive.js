const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
let MAIN_URL = "https://moviesdrive.forum";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Referer": `${MAIN_URL}/`,
};

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
                        return finalUrl ? [{ name: "MoviesDrive", title: "Direct Stream", url: finalUrl, quality: "HD" }] : [];
                    });
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
                    const postUrl = $('article a, .post a').first().attr('href');
                    if (!postUrl) return [];

                    return fetch(postUrl, { headers: HEADERS })
                        .then(res => res.text())
                        .then(postHtml => {
                            const $post = cheerio.load(postHtml);
                            const promises = [];
                            $post('a[href*="hubcloud"]').each((i, el) => {
                                promises.push(hubCloudExtractor($post(el).attr('href'), postUrl));
                            });
                            return Promise.all(promises).then(results => results.flat());
                        });
                });
        }).catch(() => []);
}

module.exports = { getStreams };

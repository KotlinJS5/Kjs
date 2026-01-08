const cheerio = require('cheerio-without-node-native');

const TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';
const BASE_URL = 'https://vegamovies.surf';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function getStreams(tmdbId, mediaType, season, episode) {
    console.log(`[Vegamovies] Fetching ${mediaType} ${tmdbId}`);

    const type = mediaType === 'movie' ? 'movie' : 'tv';
    const apiUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return fetch(apiUrl)
        .then(res => res.json())
        .then(info => {
            const title = info.title || info.name;
            if (!title) return [];
            
            // Search Vegamovies
            return fetch(`${BASE_URL}/?s=${encodeURIComponent(title)}`, { headers: HEADERS })
                .then(res => res.text())
                .then(html => {
                    const $ = cheerio.load(html);
                    const firstPost = $('.post, article').first();
                    const postUrl = firstPost.find('a').attr('href');
                    
                    if (!postUrl) return [];

                    // Get links from the post
                    return fetch(postUrl, { headers: HEADERS })
                        .then(res => res.text())
                        .then(postHtml => {
                            const $post = cheerio.load(postHtml);
                            const hubLink = $post('a[href*="hubcloud"]').first().attr('href');
                            
                            if (!hubLink) return [];

                            // Resolve HubCloud
                            const targetUrl = hubLink.replace("hubcloud.ink", "hubcloud.dad");
                            return fetch(targetUrl, { headers: { ...HEADERS, 'Referer': postUrl } })
                                .then(res => res.text())
                                .then(hubHtml => {
                                    const $hub = cheerio.load(hubHtml);
                                    const hubPhp = $hub('a[href*="hubcloud.php"]').attr('href');
                                    
                                    if (!hubPhp) return [];

                                    return fetch(hubPhp, { headers: { ...HEADERS, 'Referer': targetUrl } })
                                        .then(res => res.text())
                                        .then(finalHtml => {
                                            const $final = cheerio.load(finalHtml);
                                            const streamUrl = $final('a.btn-success, a.btn-primary').first().attr('href');
                                            const streamName = $final('div.card-header').text().trim() || "Vegamovies";

                                            if (streamUrl && streamUrl.startsWith('http')) {
                                                return [{
                                                    name: "Vegamovies",
                                                    title: streamName.split('|')[0].trim(),
                                                    url: streamUrl,
                                                    quality: streamName.includes('1080p') ? '1080p' : '720p'
                                                }];
                                            }
                                            return [];
                                        });
                                });
                        });
                });
        })
        .catch(err => {
            console.error('[Vegamovies] Error:', err.message);
            return [];
        });
}

module.exports = { getStreams };

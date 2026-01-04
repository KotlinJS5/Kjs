
// providers/vegamovies.js

const cheerio = require('cheerio');

const BASE_URL = 'https://vegamovies.surf';  // Current main domain as of Jan 2026; change if needed
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function cleanTitle(text) {
    return text.replace(/\s*\(.*?\)\s*|\s*\[.*?\]\s*|\s*\|.*$/gi, '').trim().toLowerCase();
}

function getStreams(tmdbId, mediaType, seasonNum = null, episodeNum = null) {
    return new Promise((resolve) => {
        const TMDB_API_KEY = '362a46436db0874d9701e83eaaace8aa';

        const titleFetchUrl = mediaType === 'movie'
            ? `https://api.themoviedb.org/3/movie/\( {tmdbId}?api_key= \){TMDB_API_KEY}`
            : `https://api.themoviedb.org/3/tv/\( {tmdbId}?api_key= \){TMDB_API_KEY}`;

        fetch(titleFetchUrl)
            .then(res => res.json())
            .then(info => {
                if (!info || info.success === false) return resolve([]);

                const title = mediaType === 'movie' ? info.title : info.name;
                const year = (mediaType === 'movie' ? info.release_date : info.first_air_date || '').split('-')[0] || '';
                const cleanTmdbTitle = title.toLowerCase();

                fetch(BASE_URL, { headers: HEADERS })
                    .then(res => res.text())
                    .then(html => {
                        const $ = cheerio.load(html);
                        let postLink = null;

                        // Match on homepage post titles (usually <h2> or <a> in grid/list)
                        $('a').each(function() {
                            const linkText = $(this).text();
                            const cleaned = cleanTitle(linkText);
                            if (cleaned.includes(cleanTmdbTitle) || cleanTmdbTitle.includes(cleaned.replace(/hindi|dual|audio|webdl|webrip|hdrip/gi, '').trim())) {
                                if (year && linkText.includes(year)) {
                                    postLink = $(this);
                                    return false;
                                }
                                if (!postLink) postLink = $(this);  // fallback without year
                            }
                        });

                        // Extra fallback for TV seasons
                        if (!postLink && mediaType === 'tv' && seasonNum) {
                            $('a').each(function() {
                                const linkText = $(this).text().toLowerCase();
                                if (linkText.includes(cleanTmdbTitle) && linkText.includes(`season ${seasonNum}`)) {
                                    postLink = $(this);
                                    return false;
                                }
                            });
                        }

                        if (!postLink) return resolve([]);

                        let fullPostUrl = postLink.attr('href');
                        if (!fullPostUrl.startsWith('http')) {
                            fullPostUrl = BASE_URL + fullPostUrl;
                        }

                        fetch(fullPostUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(postHtml => {
                                const $post = cheerio.load(postHtml);
                                const streams = [];

                                // Common download button selectors on Vegamovies post pages
                                const selectors = 'a[href*="drive.google"], a[href*="mega.nz"], a[href*="gdtot"], a[href*="filepress"], a[href*="download"], .download-btn, .btn';

                                $post(selectors).each((i, el) => {
                                    let link = $post(el).attr('href');
                                    if (!link || !link.includes('http')) return;

                                    let text = $post(el).text();
                                    let quality = text.match(/(480p|720p|1080p|2160p|4K)/i);
                                    quality = quality ? quality[0] : 'HD';

                                    // Basic episode filter for TV
                                    if (mediaType === 'tv' && episodeNum) {
                                        if (!text.toLowerCase().includes(`e${episodeNum}`) && 
                                            !text.toLowerCase().includes(`episode ${episodeNum}`)) {
                                            return;
                                        }
                                    }

                                    streams.push({
                                        name: `Vegamovies ${quality}`,
                                        url: link,
                                        quality: quality,
                                        headers: HEADERS,
                                        provider: 'vegamovies'
                                    });
                                });

                                resolve(streams.length > 0 ? streams : []);
                            })
                            .catch(() => resolve([]));
                    })
                    .catch(() => resolve([]));
            })
            .catch(() => resolve([]));
    });
}

module.exports = { getStreams };

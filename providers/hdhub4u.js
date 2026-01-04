// providers/hdhub4u.js - Improved version

const cheerio = require('cheerio-without-node-native');

const BASE_URL = 'https://new1.hdhub4u.fo';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
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
                const cleanSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/part-two/g, 'part-2');

                // Multiple common slug patterns on HDHub4u
                const possibleSlugs = [
                    `\( {cleanSlug}- \){year}-hindi-webrip-full-movie/`,
                    `\( {cleanSlug}- \){year}-full-movie/`,
                    `${cleanSlug}-2024-hindi-webrip-full-movie/`,
                    `pushpa-2-the-rule-reloaded-${year}-hindi-webrip-full-movie/`, // Special for Pushpa
                    `${cleanSlug}-hindi-webrip-full-movie/`,
                    `\( {cleanSlug}- \){year}-web-dl-full-movie/`
                ];

                let streams = [];
                let tried = 0;

                function tryNext() {
                    if (tried >= possibleSlugs.length) {
                        // Fallback: Fetch homepage and search for title
                        fetch(BASE_URL, { headers: HEADERS })
                            .then(res => res.text())
                            .then(html => {
                                const $ = cheerio.load(html);
                                let pagePath = $('a:contains("' + title + '")').first().attr('href') ||
                                               $('a:contains("' + year + '")').closest('a[href*="' + cleanSlug + '"]').attr('href');
                                if (pagePath) extractFromPage(BASE_URL + pagePath);
                                else resolve([]);
                            });
                        return;
                    }

                    const pageUrl = BASE_URL + '/' + possibleSlugs[tried++];
                    fetch(pageUrl, { headers: HEADERS })
                        .then(res => res.text())
                        .then(html => {
                            if (html.length > 1000 && !html.includes('404')) {
                                extractFromPage(pageUrl, html);
                            } else {
                                tryNext();
                            }
                        })
                        .catch(() => tryNext());
                }

                function extractFromPage(url, html = null) {
                    if (!html) {
                        fetch(url, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => processPage(pageHtml));
                    } else {
                        processPage(html);
                    }

                    function processPage(pageHtml) {
                        const $ = cheerio.load(pageHtml);
                        $('a[href*="download"], a.btn-success, a[href*="gdrive"], a[href*="clicknupload"], a[href*="indishare"], a[href*="mega"]').each((i, el) => {
                            let link = $(el).attr('href');
                            if (link && link.includes('http')) {
                                let quality = $(el).text().match(/(480p|720p|1080p|4K)/i) || ['HD'];
                                streams.push({
                                    name: `HDHub4u ${quality[0] || 'Server ' + (i+1)}`,
                                    url: link,
                                    quality: quality[0] || 'HD',
                                    headers: HEADERS,
                                    provider: 'hdhub4u'
                                });
                            }
                        });
                        resolve(streams.length > 0 ? streams : []);
                    }
                }

                tryNext();
            })
            .catch(() => resolve([]));
    });
}

module.exports = { getStreams };

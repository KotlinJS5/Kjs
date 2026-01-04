// providers/hdhub4u.js

const cheerio = require('cheerio'); // or keep your variant if needed

const BASE_URL = 'https://new1.hdhub4u.fo';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

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

                fetch(BASE_URL, { headers: HEADERS })
                    .then(res => res.text())
                    .then(html => {
                        const $ = cheerio.load(html);
                        const streams = [];

                        // Better matching: find <a> that contains the title (case insensitive)
                        let pageLink = $('a').filter(function() {
                            return $(this).text().toLowerCase().includes(title.toLowerCase());
                        }).first();

                        // Fallback: include year if available
                        if (!pageLink.length && year) {
                            pageLink = $('a').filter(function() {
                                return $(this).text().toLowerCase().includes(title.toLowerCase()) &&
                                       $(this).text().includes(year);
                            }).first();
                        }

                        // For TV: try "title season X"
                        if (!pageLink.length && mediaType === 'tv' && seasonNum) {
                            pageLink = $('a').filter(function() {
                                return $(this).text().toLowerCase().includes(title.toLowerCase() + ' season ' + seasonNum);
                            }).first();
                        }

                        if (!pageLink.length) return resolve([]);

                        let fullPageUrl = pageLink.attr('href');
                        if (!fullPageUrl.startsWith('http')) {
                            fullPageUrl = BASE_URL + fullPageUrl;
                        }

                        fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);

                                // Select common download buttons
                                const downloadSelectors = 'a[href*="download"], a.btn, a[href*="gdrive"], a[href*="clicknupload"], a[href*="indishare"], a[href*="mega"], a[href*="drive.google"]';

                                $(downloadSelectors).each((i, el) => {
                                    let link = $(el).attr('href');
                                    if (!link || !link.includes('http')) return;

                                    let text = $(el).text();

                                    // Quality detection
                                    let quality = text.match(/(480p|720p|1080p|4K)/i);
                                    quality = quality ? quality[0] : 'HD';

                                    // For episodes: skip if not matching episode num (basic)
                                    if (mediaType === 'tv' && episodeNum) {
                                        if (!text.toLowerCase().includes(`e${episodeNum}`) && 
                                            !text.toLowerCase().includes(`episode ${episodeNum}`) &&
                                            !text.toLowerCase().includes(`s\( {seasonNum}e \){episodeNum}`)) {
                                            return; // skip non-matching episode links
                                        }
                                    }

                                    streams.push({
                                        name: `HDHub4u ${quality}`,
                                        url: link,
                                        quality: quality,
                                        headers: HEADERS,
                                        provider: 'hdhub4u'
                                    });
                                });

                                resolve(streams.length > 0 ? streams : []);
                            })
                            .catch(err => {
                                console.error('Page fetch error:', err);
                                resolve([]);
                            });
                    })
                    .catch(err => {
                        console.error('Homepage fetch error:', err);
                        resolve([]);
                    });
            })
            .catch(err => {
                console.error('TMDB error:', err);
                resolve([]);
            });
    });
}

module.exports = { getStreams };

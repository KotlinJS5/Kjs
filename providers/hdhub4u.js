// providers/hdhub4u.js

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
                const year = (mediaType === 'movie' ? info.release_date : info.first_air_date || '').split('-')[0];
                const searchQuery = encodeURIComponent(`${title} ${year || ''}`.trim());

                // HDHub4u has no direct search bar – homepage lists recent, but we can use Google-like query or direct slug guess
                // Better: Direct homepage fetch and match title, or use a custom search if needed
                // For now, assume slug like /title-year-full-movie/
                const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-') + (year ? `-${year}` : '') + '-full-movie';
                let pageUrl = `\( {BASE_URL}/ \){slug}/`;

                fetch(pageUrl, { headers: HEADERS })
                    .then(res => res.text())
                    .then(pageHtml => {
                        const $page = cheerio.load(pageHtml);
                        const streams = [];

                        // Grab download links (common: buttons with text like "Download 1080p", "GDrive", etc.)
                        $('a[href*="download"], a.btn, a[href*="gdrive"], a[href*="clicknupload"], a[href*="indishare"]').each((i, el) => {
                            let link = $(el).attr('href');
                            if (link && link.includes('http')) {
                                streams.push({
                                    name: `HDHub4u Server ${i + 1}`,
                                    title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}` : ''}`,
                                    url: link,
                                    quality: 'HD/1080p',
                                    headers: HEADERS,
                                    provider: 'hdhub4u'
                                });
                            }
                        });

                        resolve(streams.length > 0 ? streams : []);
                    })
                    .catch(() => {
                        // Fallback: Try homepage search if slug fails
                        fetch(BASE_URL, { headers: HEADERS })
                            .then(res => res.text())
                            .then(html => {
                                const $ = cheerio.load(html);
                                let pagePath = $('a:contains("' + title + '")').first().attr('href');
                                if (pagePath) {
                                    // Recursive fetch page and extract (simplified)
                                    // Add similar extraction here
                                }
                                resolve([]);
                            });
                    });
            })
            .catch(() => resolve([]));
    });
}

module.exports = { getStreams };

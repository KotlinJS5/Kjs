// providers/hydrahd.js

const BASE_URL = 'https://hydrahd.ru';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

                const searchUrl = `\( {BASE_URL}/search/?q= \){searchQuery}`;

                fetch(searchUrl, { headers: HEADERS })
                    .then(res => res.text())
                    .then(html => {
                        const cheerio = require('cheerio-without-node-native');
                        const $ = cheerio.load(html);

                        // Strong selector for movie links: starts with /movie/
                        let pagePath = $('a[href^="/movie/"]').first().attr('href');

                        if (!pagePath) return resolve([]);

                        const fullPageUrl = BASE_URL + pagePath;

                        fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);
                                const streams = [];

                                // Grab all iframes – the main player is usually the largest or first iframe with embed/player src
                                $('iframe').each((i, el) => {
                                    let src = $(el).attr('src') || $(el).attr('data-src') || '';
                                    if (src) {
                                        if (src.startsWith('//')) src = 'https:' + src;
                                        if (!src.startsWith('http')) src = BASE_URL + src;

                                        if (src.includes('player') || src.includes('embed') || src.includes('video') || src.includes('.m3u8') || src.includes('.mp4')) {
                                            streams.push({
                                                name: 'HydraHD',
                                                title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}` : ''}`,
                                                url: src,
                                                quality: 'HD/1080p (Adaptive)',
                                                headers: HEADERS,
                                                provider: 'hydrahd'
                                            });
                                        }
                                    }
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

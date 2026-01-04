// providers/hydrahd.js

const cheerio = require('cheerio-without-node-native');

const BASE_URL = 'https://hydrahd.ru';
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
                const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+$/, '');
                const searchQuery = encodeURIComponent(`${title} ${year}`.trim());

                const searchUrl = `\( {BASE_URL}/search/?q= \){searchQuery}`;

                fetch(searchUrl, { headers: HEADERS })
                    .then(res => res.text())
                    .then(html => {
                        const $ = cheerio.load(html);

                        // Match movie: /movie/ID-watch-title-year-online
                        // For series: /watchseries/title-online-free (basic support)
                        let pagePath = $('a[href^="/movie/"]:contains("' + title + '")').first().attr('href') ||
                                       $('a[href^="/movie/"][href*="' + cleanTitle + '"]').first().attr('href') ||
                                       $('a[href^="/watchseries/"]').first().attr('href'); // fallback for series

                        if (!pagePath) return resolve([]);

                        const fullPageUrl = BASE_URL + pagePath;

                        fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);
                                const streams = [];

                                // Extract all iframes – HydraHD embeds the player directly (often playable in Nuvio)
                                $('iframe').each((i, el) => {
                                    let src = $(el).attr('src') || $(el).attr('data-src') || '';
                                    if (src) {
                                        if (src.startsWith('//')) src = 'https:' + src;
                                        if (!src.startsWith('http')) src = BASE_URL + src;

                                        if (src.includes('embed') || src.includes('player') || src.includes('vid') || src.includes('.m3u8')) {
                                            streams.push({
                                                name: `HydraHD Server ${i + 1}`,
                                                title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}` : ''}`,
                                                url: src,
                                                quality: 'HD/1080p',
                                                headers: HEADERS,
                                                provider: 'hydrahd'
                                            });
                                        }
                                    }
                                });

                                // Fallback: if no iframe, look for video sources or scripts with .m3u8
                                if (streams.length === 0) {
                                    pageHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8/g || []).forEach(m3u8 => {
                                        streams.push({
                                            name: 'HydraHD HLS',
                                            url: m3u8.trim(),
                                            quality: 'Adaptive',
                                            headers: HEADERS,
                                            provider: 'hydrahd'
                                        });
                                    });
                                }

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

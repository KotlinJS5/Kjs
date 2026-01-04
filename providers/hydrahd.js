// providers/hydrahd.js

const BASE_URL = 'https://hydrahd.ru';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve) => {
        // You'll need a TMDB API key for accurate title/year (free at themoviedb.org)
        const TMDB_API_KEY = 'YOUR_TMDB_API_KEY'; // Replace with your key

        let titleFetchUrl = mediaType === 'movie' 
            ? `https://api.themoviedb.org/3/movie/\( {tmdbId}?api_key= \){TMDB_API_KEY}`
            : `https://api.themoviedb.org/3/tv/\( {tmdbId}?api_key= \){TMDB_API_KEY}&append_to_response=external_ids`;

        fetch(titleFetchUrl)
            .then(res => res.json())
            .then(info => {
                const title = mediaType === 'movie' ? info.title : info.name;
                const year = mediaType === 'movie' ? info.release_date?.split('-')[0] : info.first_air_date?.split('-')[0];
                const searchQuery = encodeURIComponent(`${title} ${year || ''}`.trim());

                return fetch(`\( {BASE_URL}/search/?q= \){searchQuery}`, { headers: HEADERS })
                    .then(res => res.text())
                    .then(html => {
                        const cheerio = require('cheerio-without-node-native');
                        const $ = cheerio.load(html);

                        // Adjust this selector based on actual search results page
                        // Common: links with class like 'card', 'title', or 'poster'
                        let pagePath = $('a[href*="/view/"], a[href*="/movie/"], a[href*="/series/"]').first().attr('href');
                        if (!pagePath) return resolve([]);

                        const fullPageUrl = pagePath.startsWith('http') ? pagePath : BASE_URL + pagePath;

                        return fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);
                                const streams = [];

                                // Extract streams – HydraHD often uses iframes or player buttons
                                // Look for iframe src, data-src, or links to .m3u8/.mp4
                                $('iframe[src*="player"], iframe[data-src], source[src], video[src]').each((i, el) => {
                                    let src = $(el).attr('src') || $(el).attr('data-src');
                                    if (src && (src.includes('.m3u8') || src.includes('.mp4') || src.includes('video'))) {
                                        if (!src.startsWith('http')) src = BASE_URL + src;

                                        streams.push({
                                            name: 'HydraHD',
                                            title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){seasonNum}E${episodeNum}` : ''}`,
                                            url: src,
                                            quality: src.includes('1080') ? '1080p' : src.includes('720') ? '720p' : 'HD',
                                            headers: HEADERS,
                                            provider: 'hydrahd'
                                        });
                                    }
                                });

                                // Add more logic if there are multiple servers/tabs
                                resolve(streams.length ? streams : []);
                            });
                    });
            })
            .catch(() => resolve([]));
    });
}

module.exports = { getStreams };

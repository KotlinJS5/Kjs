// providers/hydrahd.js

const BASE_URL = 'https://hydrahd.ru';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    return new Promise((resolve) => {
        // REPLACE WITH YOUR REAL TMDB API KEY (get free at https://www.themoviedb.org/settings/api)
        const TMDB_API_KEY = 'YOUR_TMDB_API_KEY_HERE';

        if (!TMDB_API_KEY || TMDB_API_KEY === 'YOUR_TMDB_API_KEY_HERE') {
            resolve([]);
            return;
        }

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

                        // Better selectors: look for common result links (titles, posters, or direct slugs)
                        // Site uses <a> with href like /movie/ID-title-online or similar
                        let pagePath = $('a[href^="/movie/"], a[href^="/watchseries/"], a.title, a.poster-link, div.item a').first().attr('href');

                        if (!pagePath) return resolve([]);

                        const fullPageUrl = pagePath.startsWith('http') ? pagePath : BASE_URL + pagePath;

                        fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);
                                const streams = [];

                                // Primary: iframes in player area
                                $('iframe[src], iframe[data-src]').each((i, el) => {
                                    let src = $(el).attr('src') || $(el).attr('data-src') || '';
                                    if (src) {
                                        if (!src.startsWith('http')) src = 'https:' + src || BASE_URL + src;
                                        if (src.includes('player') || src.includes('embed') || src.includes('.m3u8')) {
                                            streams.push({
                                                name: 'HydraHD Main',
                                                title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){seasonNum.padStart(2, '0')}E${episodeNum.padStart(2, '0')}` : ''}`,
                                                url: src,
                                                quality: 'HD', // Often auto/adaptive; can improve later
                                                headers: HEADERS,
                                                provider: 'hydrahd'
                                            });
                                        }
                                    }
                                });

                                // Fallback: video sources or other embeds
                                $('video source[src], video[src]').each((i, el) => {
                                    let src = $(el).attr('src');
                                    if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
                                        if (!src.startsWith('http')) src = BASE_URL + src;
                                        streams.push({
                                            name: 'HydraHD Direct',
                                            url: src,
                                            quality: src.includes('1080') ? '1080p' : src.includes('720') ? '720p' :

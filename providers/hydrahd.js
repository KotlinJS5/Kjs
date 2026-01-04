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

                        let pagePath = $('a[href^="/movie/"]').first().attr('href') ||
                                       $('a[href^="/watchseries/"]').first().attr('href');

                        if (!pagePath) return resolve([]);

                        const fullPageUrl = BASE_URL + pagePath;

                        fetch(fullPageUrl, { headers: HEADERS })
                            .then(res => res.text())
                            .then(pageHtml => {
                                const $page = cheerio.load(pageHtml);
                                const streams = [];

                                // Find the main player iframe
                                let iframeSrc = $('iframe[src*="player"], iframe[src*="embed"], iframe#main-player, iframe').first().attr('src') ||
                                                $('iframe').first().attr('src');

                                if (!iframeSrc) return resolve([]);

                                if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc;
                                if (!iframeSrc.startsWith('http')) iframeSrc = BASE_URL + iframeSrc;

                                // Now fetch INSIDE the iframe to get the real stream URLs
                                fetch(iframeSrc, { headers: { ...HEADERS, 'Referer': fullPageUrl } })
                                    .then(res => res.text())
                                    .then(iframeHtml => {
                                        const $iframe = cheerio.load(iframeHtml);

                                        // Extract direct HLS/MP4 sources
                                        \( iframe('source[src], video[src], a[href \)=".m3u8"], a[href$=".mp4"]').each((i, el) => {
                                            let src = $iframe(el).attr('src') || $iframe(el).attr('href');
                                            if (src && (src.includes('.m3u8') || src.includes('.mp4'))) {
                                                if (!src.startsWith('http')) src = new URL(src, iframeSrc).href;

                                                streams.push({
                                                    name: `HydraHD Server ${i + 1}`,
                                                    title: `${title} \( {year ? `( \){year})` : ''} \( {seasonNum ? `S \){String(seasonNum).padStart(2,'0')}E${String(episodeNum).padStart(2,'0')}` : ''}`,
                                                    url: src,
                                                    quality: src.includes('1080') ? '1080p' : src.includes('720') ? '720p' : 'HD',
                                                    headers: HEADERS,
                                                    provider: 'hydrahd'
                                                });
                                            }
                                        });

                                        // Fallback: any script with .m3u8 links (common)
                                        iframeHtml.match(/https?:\/\/[^\s"']+\.m3u8/g || []).forEach(m3u8 => {
                                            streams.push({
                                                name: 'HydraHD HLS',
                                                url: m3u8,
                                                quality: 'HD/Adaptive',
                                                headers: HEADERS,
                                                provider: 'hydrahd'
                                            });
                                        });

                                        resolve(streams.length > 0 ? streams : []);
                                    })
                                    .catch(() => resolve([]));
                            })
                            .catch(() => resolve([]));
                    })
                    .catch(() => resolve([]));
            })
            .catch(() => resolve([]));
    });
}

module.exports = { getStreams };

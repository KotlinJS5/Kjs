const cheerio = require('cheerio-without-node-native');

// Configuration
const BASE_URL = 'https://4khdhub.dad';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

// Headers for requests
const getHeaders = (referer = BASE_URL) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': referer,
    'DNT': '1'
});

// Extract quality from text
function extractQuality(text) {
    const patterns = [
        /(\d{3,4})p/i,
        /4k/i,
        /uhd/i,
        /fhd/i,
        /hd/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[1]) return `${match[1]}p`;
            return match[0].toUpperCase();
        }
    }
    
    return 'HD';
}

// Extract size from text
function extractSize(text) {
    const match = text.match(/(\d+(\.\d+)?)\s*(GB|MB)/i);
    return match ? match[0] : null;
}

function getStreams(tmdbId, mediaType, season = null, episode = null) {
    const isSeries = mediaType === 'tv';
    const endpoint = isSeries ? 'tv' : 'movie';
    const tmdbUrl = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return fetch(tmdbUrl)
        .then(res => res.json())
        .then(data => {
            const title = isSeries ? data.name : data.title;
            const year = isSeries 
                ? (data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0)
                : (data.release_date ? parseInt(data.release_date.split('-')[0]) : 0);
            
            const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
            return fetch(searchUrl, { headers: getHeaders() })
                .then(res => res.text())
                .then(html => {
                    const $ = cheerio.load(html);
                    let bestUrl = null;
                    let bestMatch = 100;
                    
                    $('a').each((i, el) => {
                        const link = $(el);
                        const href = link.attr('href');
                        if (!href || href === '/' || href.includes('/category/') || href.includes('/?s=')) return;
                        
                        const text = link.text().replace(/\s+/g, ' ').trim().toLowerCase();
                        if (text.includes(title.toLowerCase())) {
                            const yearMatch = text.match(/\b(19|20)\d{2}\b/);
                            const itemYear = yearMatch ? parseInt(yearMatch[0]) : 0;
                            const yearDiff = itemYear ? Math.abs(itemYear - year) : 5;
                            
                            if (yearDiff <= 2) {
                                if (yearDiff < bestMatch) {
                                    bestMatch = yearDiff;
                                    bestUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                                }
                            }
                        }
                    });
                    
                    if (!bestUrl) return [];

                    return fetch(bestUrl, { headers: getHeaders() })
                        .then(res => res.text())
                        .then(pageHtml => {
                            const $page = cheerio.load(pageHtml);
                            const streams = [];
                            
                            $page('a').each((i, el) => {
                                const link = $page(el);
                                const text = link.text().replace(/\s+/g, ' ').trim().toLowerCase();
                                const href = link.attr('href');
                                
                                if (href && (href.includes('hubcloud') || href.includes('drive') || text.includes('download') || text.includes('watch') || text.includes('stream'))) {
                                    if (isSeries && season && episode) {
                                        const seasonStr = `s${season.toString().padStart(2, '0')}`;
                                        const episodeStr = `e${episode.toString().padStart(2, '0')}`;
                                        if (!text.includes(seasonStr) || !text.includes(episodeStr)) return;
                                    }

                                    const quality = extractQuality(text);
                                    const size = extractSize(link.text());
                                    streams.push({
                                        name: `4KHDHub.DAD ${quality}`,
                                        title: `${title} (${year})${size ? ` | ${size}` : ''}`,
                                        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                                        quality: quality,
                                        provider: "4khubdad"
                                    });
                                }
                            });
                            return streams;
                        });
                });
        })
        .catch(err => {
            console.error(`[4KHDHub.DAD] Error: ${err.message}`);
            return [];
        });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}

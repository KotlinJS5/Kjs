const cheerio = require('cheerio-without-node-native');

const BASE_URL = 'https://4khdhub.dad';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'DNT': '1'
};

// Timeout wrapper to prevent hanging
function fetchWithTimeout(url, options = {}, timeout = 10000) {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fetch timeout')), timeout)
        )
    ]);
}

function getStreams(tmdbId, mediaType, season = null, episode = null) {
    // Wrap everything in try-catch to prevent crashes
    try {
        const isSeries = mediaType === 'tv';
        const endpoint = isSeries ? 'tv' : 'movie';
        
        // Step 1: Get TMDB data
        return fetchWithTimeout(
            `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`,
            { headers: HEADERS },
            8000
        )
            .then(res => {
                if (!res.ok) return Promise.reject(new Error('TMDB error'));
                return res.json();
            })
            .then(data => {
                if (!data || !data.title && !data.name) {
                    return Promise.reject(new Error('No title in TMDB'));
                }
                
                const title = isSeries ? data.name : data.title;
                const year = isSeries 
                    ? (data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0)
                    : (data.release_date ? parseInt(data.release_date.split('-')[0]) : 0);
                
                // Step 2: Search on 4khdhub
                const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
                return fetchWithTimeout(searchUrl, { headers: HEADERS }, 8000)
                    .then(res => {
                        if (!res.ok) return Promise.reject(new Error('Search failed'));
                        return res.text();
                    })
                    .then(html => {
                        if (!html || html.length < 100) {
                            return Promise.reject(new Error('Empty search'));
                        }
                        
                        try {
                            const $ = cheerio.load(html);
                            let bestUrl = null;
                            let bestMatch = 100;
                            
                            // Find best matching link
                            $('a').each((i, el) => {
                                const href = $(el).attr('href');
                                const text = $(el).text().toLowerCase();
                                
                                if (href && !href.includes('/category/') && !href.includes('/?s=')) {
                                    if (text.includes(title.toLowerCase())) {
                                        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
                                        const itemYear = yearMatch ? parseInt(yearMatch[0]) : 0;
                                        const yearDiff = itemYear ? Math.abs(itemYear - year) : 5;
                                        
                                        if (yearDiff <= 2 && yearDiff < bestMatch) {
                                            bestMatch = yearDiff;
                                            bestUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                                        }
                                    }
                                }
                            });
                            
                            if (!bestUrl) {
                                return Promise.reject(new Error('No match found'));
                            }
                            
                            // Step 3: Get content page
                            return fetchWithTimeout(bestUrl, { headers: HEADERS }, 8000)
                                .then(res => {
                                    if (!res.ok) return Promise.reject(new Error('Content page failed'));
                                    return res.text();
                                })
                                .then(pageHtml => {
                                    if (!pageHtml || pageHtml.length < 100) {
                                        return Promise.reject(new Error('Empty page'));
                                    }
                                    
                                    try {
                                        const $page = cheerio.load(pageHtml);
                                        const streams = [];
                                        
                                        // Extract all links
                                        $page('a').each((i, el) => {
                                            try {
                                                const link = $page(el);
                                                const href = link.attr('href');
                                                const text = link.text().toLowerCase();
                                                
                                                if (href && (
                                                    href.includes('hubcloud') || 
                                                    href.includes('drive') || 
                                                    text.includes('download') || 
                                                    text.includes('watch') || 
                                                    text.includes('stream')
                                                )) {
                                                    // For TV shows, filter by season/episode
                                                    if (isSeries && season && episode) {
                                                        const seasonStr = `s${season.toString().padStart(2, '0')}`;
                                                        const episodeStr = `e${episode.toString().padStart(2, '0')}`;
                                                        if (!text.includes(seasonStr) || !text.includes(episodeStr)) {
                                                            return;
                                                        }
                                                    }
                                                    
                                                    // Extract quality
                                                    let quality = 'HD';
                                                    const qualityMatch = text.match(/(\d{3,4})p|4k|uhd|fhd/i);
                                                    if (qualityMatch) {
                                                        quality = qualityMatch[0].toUpperCase();
                                                    }
                                                    
                                                    streams.push({
                                                        name: `4KHDHub - ${quality}`,
                                                        title: `${title} (${year})`,
                                                        url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
                                                        quality: quality,
                                                        provider: '4khubdad',
                                                        headers: {
                                                            'User-Agent': HEADERS['User-Agent'],
                                                            'Referer': bestUrl
                                                        }
                                                    });
                                                }
                                            } catch (e) {
                                                // Skip individual link errors
                                            }
                                        });
                                        
                                        return streams;
                                    } catch (e) {
                                        return Promise.reject(new Error('Parse error'));
                                    }
                                });
                        } catch (e) {
                            return Promise.reject(new Error('Search parse error'));
                        }
                    });
            })
            .catch(err => {
                // Return empty array instead of throwing
                console.error(`[4KHDHub] ${err.message}`);
                return [];
            });
    } catch (err) {
        // Catch any synchronous errors
        console.error(`[4KHDHub] Sync error: ${err.message}`);
        return Promise.resolve([]);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}

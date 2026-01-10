const axios = require('axios');
const cheerio = require('cheerio');
const bytes = require('bytes');

// Configuration
const BASE_URL = 'https://4khdhub.dad';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

// Headers for requests
const getHeaders = (referer = BASE_URL) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': referer,
    'DNT': '1'
});

// Fetch helper
async function fetchText(url, referer = BASE_URL) {
    try {
        const response = await axios.get(url, {
            headers: getHeaders(referer),
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`[4KHDHub.DAD] Request failed: ${error.message}`);
        return null;
    }
}

// Get TMDB details
async function getTmdbDetails(tmdbId, type) {
    try {
        const isSeries = type === 'tv';
        const endpoint = isSeries ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        
        const response = await axios.get(url);
        const data = response.data;
        
        return {
            title: isSeries ? data.name : data.title,
            year: isSeries 
                ? (data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0)
                : (data.release_date ? parseInt(data.release_date.split('-')[0]) : 0),
            originalTitle: isSeries ? data.original_name : data.original_title
        };
    } catch (error) {
        console.error(`[4KHDHub.DAD] TMDB error: ${error.message}`);
        return null;
    }
}

// Search for content
async function searchContent(title, year, isSeries) {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
    console.log(`[4KHDHub.DAD] Searching: ${searchUrl}`);
    
    const html = await fetchText(searchUrl);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    let bestUrl = null;
    let bestMatch = 100;
    
    // Try different selectors
    const selectors = [
        'article',
        '.post',
        '.item',
        '.movie-item',
        '[class*="post-"]'
    ];
    
    for (const selector of selectors) {
        $(selector).each((i, el) => {
            const item = $(el);
            const itemText = item.text().toLowerCase();
            const titleText = item.find('h2, h3, .title, .entry-title').text().toLowerCase();
            
            // Check if it matches
            if (titleText.includes(title.toLowerCase()) || itemText.includes(title.toLowerCase())) {
                // Check year
                const yearMatch = itemText.match(/\b(19|20)\d{2}\b/);
                const itemYear = yearMatch ? parseInt(yearMatch[0]) : 0;
                const yearDiff = Math.abs(itemYear - year);
                
                // Check type
                const typeMatch = isSeries 
                    ? itemText.includes('season') || itemText.includes('episode')
                    : !itemText.includes('season') && !itemText.includes('episode');
                
                if (typeMatch && yearDiff <= 2) {
                    // Get URL
                    const link = item.find('a').first().attr('href');
                    if (link) {
                        const matchScore = yearDiff;
                        if (matchScore < bestMatch) {
                            bestMatch = matchScore;
                            bestUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`;
                        }
                    }
                }
            }
        });
    }
    
    return bestUrl;
}

// Extract download links from page
async function extractLinks(html, isSeries, season, episode) {
    const $ = cheerio.load(html);
    const links = [];
    
    if (isSeries && season && episode) {
        // Handle series
        const seasonStr = `s${season.toString().padStart(2, '0')}`;
        const episodeStr = `e${episode.toString().padStart(2, '0')}`;
        
        $('a').each((i, el) => {
            const link = $(el);
            const text = link.text().toLowerCase();
            const href = link.attr('href');
            
            if (href && text.includes(seasonStr) && text.includes(episodeStr)) {
                links.push({
                    url: href,
                    title: link.text().trim(),
                    quality: extractQuality(text)
                });
            }
        });
    } else {
        // Handle movies
        $('a').each((i, el) => {
            const link = $(el);
            const text = link.text().toLowerCase();
            const href = link.attr('href');
            
            if (href && (text.includes('download') || text.includes('watch') || text.includes('stream'))) {
                links.push({
                    url: href,
                    title: link.text().trim(),
                    quality: extractQuality(text)
                });
            }
        });
        
        // Also check for download buttons
        $('[class*="download"], [class*="watch"], .btn, .button').each((i, el) => {
            const link = $(el).is('a') ? $(el) : $(el).find('a').first();
            const href = link.attr('href');
            if (href) {
                links.push({
                    url: href,
                    title: link.text().trim() || 'Download',
                    quality: extractQuality(link.text())
                });
            }
        });
    }
    
    return links;
}

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

// Main function
async function getStreams(tmdbId, mediaType, season = null, episode = null) {
    console.log(`[4KHDHub.DAD] Request: ${tmdbId}, ${mediaType}, S${season}E${episode}`);
    
    try {
        // Get TMDB info
        const details = await getTmdbDetails(tmdbId, mediaType);
        if (!details) {
            console.log('[4KHDHub.DAD] No TMDB details');
            return [];
        }
        
        // Search for content
        const contentUrl = await searchContent(details.title, details.year, mediaType === 'tv');
        if (!contentUrl) {
            console.log('[4KHDHub.DAD] Content not found');
            return [];
        }
        
        console.log(`[4KHDHub.DAD] Found page: ${contentUrl}`);
        
        // Get content page
        const html = await fetchText(contentUrl);
        if (!html) return [];
        
        // Extract links
        const links = await extractLinks(html, mediaType === 'tv', season, episode);
        if (links.length === 0) {
            console.log('[4KHDHub.DAD] No links found');
            return [];
        }
        
        console.log(`[4KHDHub.DAD] Found ${links.length} links`);
        
        // Format streams
        const streams = [];
        for (const link of links) {
            try {
                // Resolve final URL
                let finalUrl = link.url;
                if (!finalUrl.startsWith('http')) {
                    finalUrl = `${BASE_URL}${finalUrl}`;
                }
                
                // Extract size
                const size = extractSize(link.title);
                
                // Create stream object
                const stream = {
                    name: `4KHDHub.DAD ${link.quality || 'HD'}`,
                    title: `${details.title} (${details.year})${size ? ` | ${size}` : ''}`,
                    url: finalUrl
                };
                
                if (link.quality) {
                    stream.quality = link.quality;
                }
                
                // Add behavior hints
                stream.behaviorHints = {
                    bingeGroup: `4khdhub-${link.quality || 'hd'}`
                };
                
                streams.push(stream);
                console.log(`[4KHDHub.DAD] Added: ${stream.name}`);
                
            } catch (error) {
                console.error(`[4KHDHub.DAD] Link error: ${error.message}`);
            }
        }
        
        return streams;
        
    } catch (error) {
        console.error(`[4KHDHub.DAD] Error: ${error.message}`);
        return [];
    }
}

// Test function
async function test() {
    console.log('Testing 4KHDHub.DAD...');
    
    // Test movie
    const movieStreams = await getStreams(603, 'movie'); // The Matrix
    console.log(`Movie streams: ${movieStreams.length}`);
    
    // Test series
    const tvStreams = await getStreams(1399, 'tv', 1, 1); // GoT S01E01
    console.log(`TV streams: ${tvStreams.length}`);
    
    return { movieStreams, tvStreams };
}

module.exports = { getStreams, test };

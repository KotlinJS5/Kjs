const axios = require('axios');
const cheerio = require('cheerio');
const bytes = require('bytes');
const levenshtein = require('fast-levenshtein');
const rot13Cipher = require('rot13-cipher');
const { URL } = require('url');
const path = require('path');
const fs = require('fs').promises;

// Configuration for 4khdhub.dad
const BASE_URL = 'https://4khdhub.dad';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

// Helper to decode base64 (polyfill)
const atob = (str) => Buffer.from(str, 'base64').toString('binary');

// Headers for requests
const getHeaders = (referer = BASE_URL) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Referer': referer
});

// Fetch helper with error handling
async function fetchText(url, options = {}) {
    try {
        const headers = options.headers || getHeaders(options.referer);
        const response = await axios.get(url, {
            headers,
            timeout: 15000,
            validateStatus: (status) => status === 200
        });
        return response.data;
    } catch (error) {
        console.error(`[4KHDHub.DAD] Request failed for ${url}:`, error.message);
        return null;
    }
}

// Fetch TMDB details
async function getTmdbDetails(tmdbId, type) {
    try {
        const isSeries = type === 'series' || type === 'tv';
        const endpoint = isSeries ? 'tv' : 'movie';
        const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data;
        
        if (isSeries) {
            return {
                title: data.name,
                year: data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0,
                originalTitle: data.original_name
            };
        } else {
            return {
                title: data.title,
                year: data.release_date ? parseInt(data.release_date.split('-')[0]) : 0,
                originalTitle: data.original_title
            };
        }
    } catch (error) {
        console.error(`[4KHDHub.DAD] TMDB error:`, error.message);
        return null;
    }
}

// Search for media page on 4khdhub.dad
async function searchMediaPage(title, year, isSeries) {
    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title + ' ' + year)}`;
    console.log(`[4KHDHub.DAD] Searching: ${searchUrl}`);
    
    const html = await fetchText(searchUrl);
    if (!html) return null;
    
    const $ = cheerio.load(html);
    let bestMatch = null;
    let bestScore = Infinity;
    
    // Try different selectors for search results
    const articleSelectors = [
        'article',
        '.post',
        '.movie-card',
        '.item',
        '.search-result',
        'div[class*="post-"]',
        'div[class*="movie-"]'
    ];
    
    for (const selector of articleSelectors) {
        $(selector).each((i, el) => {
            const article = $(el);
            
            // Extract title
            let articleTitle = '';
            const titleSelectors = [
                'h2 a', 'h3 a', '.title a', '.entry-title a', 
                '.post-title a', '.movie-title a', 'a[rel="bookmark"]'
            ];
            
            for (const titleSel of titleSelectors) {
                const titleEl = article.find(titleSel);
                if (titleEl.length) {
                    articleTitle = titleEl.text().trim();
                    break;
                }
            }
            
            if (!articleTitle) return;
            
            // Extract year
            let articleYear = 0;
            const metaText = article.text();
            const yearMatch = metaText.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                articleYear = parseInt(yearMatch[0]);
            }
            
            // Calculate match score
            const titleDistance = levenshtein.get(
                articleTitle.toLowerCase(), 
                title.toLowerCase()
            );
            const yearDiff = Math.abs(articleYear - year);
            
            // Series/Movie type check
            let typeMatches = true;
            const typeText = article.text().toLowerCase();
            if (isSeries) {
                typeMatches = typeText.includes('season') || 
                             typeText.includes('episode') || 
                             typeText.includes('series') ||
                             articleTitle.toLowerCase().includes('season');
            } else {
                typeMatches = !typeText.includes('season') && 
                             !typeText.includes('episode');
            }
            
            if (!typeMatches) return;
            
            const score = titleDistance + (yearDiff * 0.5);
            
            if (score < bestScore && score < 10) {
                bestScore = score;
                
                // Get URL
                const linkSelectors = [
                    'h2 a', 'h3 a', '.title a', '.read-more', 
                    'a.more-link', 'a[href*="/movie/"]', 
                    'a[href*="/tv/"]', 'a[rel="bookmark"]'
                ];
                
                for (const linkSel of linkSelectors) {
                    const link = article.find(linkSel).attr('href');
                    if (link) {
                        bestMatch = link.startsWith('http') ? link : BASE_URL + link;
                        break;
                    }
                }
            }
        });
    }
    
    return bestMatch;
}

// Extract and decode redirect URLs (similar to 4khdhub.fans)
async function decodeRedirectUrl(redirectUrl) {
    try {
        const html = await fetchText(redirectUrl, { referer: BASE_URL });
        if (!html) return null;
        
        // Try to find encoded data in the page
        const patterns = [
            /'o','(.*?)'/,
            /var url ?= ?['"](.*?)['"]/,
            /data-code=['"](.*?)['"]/,
            /atob\('(.*?)'\)/,
            /decode\('(.*?)'\)/
        ];
        
        let encodedData = null;
        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                encodedData = match[1];
                break;
            }
        }
        
        if (!encodedData) return null;
        
        // Try different decryption methods
        const decryptionMethods = [
            // Method 1: Base64 only
            (data) => {
                try {
                    return atob(data);
                } catch {
                    return null;
                }
            },
            // Method 2: Base64 → ROT13 → Base64 (common pattern)
            (data) => {
                try {
                    const step1 = atob(data);
                    const step2 = rot13Cipher(step1);
                    const step3 = atob(step2);
                    return step3;
                } catch {
                    return null;
                }
            },
            // Method 3: Multiple Base64 (like 4khdhub.fans)
            (data) => {
                try {
                    const step1 = atob(data);
                    const step2 = atob(step1);
                    const step3 = rot13Cipher(step2);
                    const step4 = atob(step3);
                    return step4;
                } catch {
                    return null;
                }
            }
        ];
        
        for (const method of decryptionMethods) {
            try {
                const result = method(encodedData);
                if (result && result.includes('http')) {
                    return result;
                }
                
                // Try parsing as JSON
                const parsed = JSON.parse(result);
                if (parsed && parsed.o) {
                    const final = atob(parsed.o);
                    if (final && final.includes('http')) {
                        return final;
                    }
                }
            } catch (e) {
                // Continue to next method
            }
        }
        
        return null;
    } catch (error) {
        console.error(`[4KHDHub.DAD] Decode error:`, error.message);
        return null;
    }
}

// Extract streaming links from a media page
async function extractStreamLinks(mediaUrl, isSeries, season = null, episode = null) {
    const html = await fetchText(mediaUrl);
    if (!html) return [];
    
    const $ = cheerio.load(html);
    const streams = [];
    
    if (isSeries && season && episode) {
        // Handle series episodes
        const seasonStr = season.toString().padStart(2, '0');
        const episodeStr = episode.toString().padStart(2, '0');
        
        // Look for episode containers
        $('div, article, section').each((i, el) => {
            const container = $(el);
            const containerText = container.text().toLowerCase();
            
            if (containerText.includes(`season ${season}`) || 
                containerText.includes(`s${seasonStr}`)) {
                
                // Find episode links
                container.find('a').each((j, linkEl) => {
                    const link = $(linkEl);
                    const linkText = link.text().toLowerCase();
                    
                    if (linkText.includes(`episode ${episode}`) || 
                        linkText.includes(`e${episodeStr}`) ||
                        linkText.includes(`ep${episodeStr}`)) {
                        
                        const href = link.attr('href');
                        if (href && href.includes('http')) {
                            streams.push({
                                source: '4KHDHub.DAD',
                                url: href,
                                title: link.text().trim(),
                                quality: extractQuality(link.text())
                            });
                        }
                    }
                });
            }
        });
    } else {
        // Handle movies or series main page
        // Look for download/stream links
        const linkSelectors = [
            'a[href*="download"]',
            'a[href*="stream"]',
            'a[href*="watch"]',
            'a[href*="player"]',
            'a.download-link',
            'a.stream-link',
            '.download-btn',
            '.watch-btn'
        ];
        
        for (const selector of linkSelectors) {
            $(selector).each((i, el) => {
                const link = $(el);
                const href = link.attr('href');
                const text = link.text().trim();
                
                if (href && href.includes('http') && !href.includes('#')) {
                    // Extract quality from text
                    const quality = extractQuality(text);
                    
                    streams.push({
                        source: '4KHDHub.DAD',
                        url: href,
                        title: text || 'Watch Now',
                        quality: quality,
                        size: extractSize(text)
                    });
                }
            });
        }
        
        // Also check for embedded players
        $('iframe').each((i, el) => {
            const src = $(el).attr('src');
            if (src && src.includes('http')) {
                streams.push({
                    source: '4KHDHub.DAD Embed',
                    url: src,
                    title: 'Embedded Player',
                    quality: 'HD'
                });
            }
        });
    }
    
    return streams;
}

// Extract quality from text (1080p, 720p, 4K, etc.)
function extractQuality(text) {
    const qualityPatterns = [
        /(\d{3,4})[pi]/i,
        /(4k|uhd)/i,
        /(fullhd|fhd)/i,
        /(hd|high definition)/i
    ];
    
    for (const pattern of qualityPatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[1] && match[1].match(/\d/)) {
                return `${match[1]}p`;
            } else if (match[0]) {
                return match[0].toUpperCase();
            }
        }
    }
    
    return 'HD';
}

// Extract file size from text
function extractSize(text) {
    const sizeMatch = text.match(/(\d+(\.\d+)?)\s*(GB|MB|GiB|MiB)/i);
    if (sizeMatch) {
        return sizeMatch[0];
    }
    return null;
}

// Resolve final streaming URL (follow redirects)
async function resolveStreamUrl(url, referer) {
    try {
        // Check if it's a redirect page
        const html = await fetchText(url, { referer });
        if (!html) return null;
        
        // Look for direct video links
        const videoPatterns = [
            /(https?:\/\/[^\s"']+\.(mp4|mkv|avi|m3u8)[^\s"']*)/i,
            /file\s*:\s*['"]([^'"]+)['"]/i,
            /src\s*:\s*['"]([^'"]+)['"]/i
        ];
        
        for (const pattern of videoPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        // Check for iframe sources
        const $ = cheerio.load(html);
        const iframeSrc = $('iframe').attr('src');
        if (iframeSrc && iframeSrc.includes('http')) {
            return iframeSrc;
        }
        
        // Try to decode if it looks like an encoded URL
        if (html.includes('atob') || html.includes('decode')) {
            const decoded = await decodeRedirectUrl(url);
            if (decoded) return decoded;
        }
        
        return url;
    } catch (error) {
        console.error(`[4KHDHub.DAD] Resolve error:`, error.message);
        return url;
    }
}

// Main function to get streams (similar interface)
async function get4KHDHubStreams(tmdbId, type, season = null, episode = null) {
    try {
        console.log(`[4KHDHub.DAD] Starting for TMDB: ${tmdbId}, Type: ${type}`);
        
        // Get TMDB details
        const tmdbDetails = await getTmdbDetails(tmdbId, type);
        if (!tmdbDetails) {
            console.log(`[4KHDHub.DAD] TMDB details not found`);
            return [];
        }
        
        console.log(`[4KHDHub.DAD] Searching for: ${tmdbDetails.title} (${tmdbDetails.year})`);
        
        // Determine if it's a series
        const isSeries = type === 'series' || type === 'tv';
        
        // Search for media page
        const mediaUrl = await searchMediaPage(tmdbDetails.title, tmdbDetails.year, isSeries);
        if (!mediaUrl) {
            console.log(`[4KHDHub.DAD] Media page not found`);
            return [];
        }
        
        console.log(`[4KHDHub.DAD] Found media page: ${mediaUrl}`);
        
        // Extract stream links from media page
        const rawStreams = await extractStreamLinks(mediaUrl, isSeries, season, episode);
        if (rawStreams.length === 0) {
            console.log(`[4KHDHub.DAD] No stream links found`);
            return [];
        }
        
        console.log(`[4KHDHub.DAD] Found ${rawStreams.length} raw stream links`);
        
        // Resolve and format streams
        const finalStreams = [];
        
        for (const stream of rawStreams) {
            try {
                console.log(`[4KHDHub.DAD] Resolving: ${stream.url.substring(0, 100)}...`);
                
                const resolvedUrl = await resolveStreamUrl(stream.url, mediaUrl);
                if (!resolvedUrl) continue;
                
                // Format stream object
                const streamObj = {
                    name: `4KHDHub.DAD - ${stream.source}`,
                    title: stream.title || `${tmdbDetails.title} (${tmdbDetails.year})`,
                    url: resolvedUrl
                };
                
                // Add quality if available
                if (stream.quality) {
                    streamObj.quality = stream.quality;
                    streamObj.name += ` ${stream.quality}`;
                }
                
                // Add size if available
                if (stream.size) {
                    streamObj.title += ` | ${stream.size}`;
                }
                
                // Add behavior hints for grouping
                streamObj.behaviorHints = {
                    bingeGroup: `4khdhub-${stream.source.toLowerCase().replace(/\s+/g, '-')}`
                };
                
                finalStreams.push(streamObj);
                console.log(`[4KHDHub.DAD] Added stream: ${streamObj.name}`);
                
            } catch (error) {
                console.error(`[4KHDHub.DAD] Stream processing error:`, error.message);
            }
        }
        
        console.log(`[4KHDHub.DAD] Returning ${finalStreams.length} streams`);
        return finalStreams;
        
    } catch (error) {
        console.error(`[4KHDHub.DAD] Main function error:`, error.message);
        return [];
    }
}

// Test function
async function testScript() {
    console.log('=== Testing 4KHDHub.DAD Script ===');
    
    // Test with a popular movie (The Matrix)
    const testStreams = await get4KHDHubStreams(603, 'movie');
    console.log(`Found ${testStreams.length} streams for The Matrix`);
    
    testStreams.forEach((stream, i) => {
        console.log(`${i + 1}. ${stream.name}`);
        console.log(`   URL: ${stream.url.substring(0, 80)}...`);
        console.log(`   Title: ${stream.title}`);
    });
    
    return testStreams;
}

// Export the main function
module.exports = { get4KHDHubStreams, testScript };

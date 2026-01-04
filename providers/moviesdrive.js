// Moviesdrive Scraper for Nuvio Local Scrapers - COMPLETE VERSION
const cheerio = require('cheerio-without-node-native');

// TMDB API Configuration
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Moviesdrive Configuration
let MAIN_URL = "https://moviesdrive.forum";
const DOMAINS_URL = "https://raw.githubusercontent.com/phisher98/TVVVV/refs/heads/main/domains.json";
const DOMAIN_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
let domainCacheTimestamp = 0;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Referer": `${MAIN_URL}/`,
};

// =================================================================================
// UTILITY FUNCTIONS
// =================================================================================
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function extractServerName(source) {
    if (!source) return 'Unknown';
    const src = source.trim();
    if (/HubCloud/i.test(src)) {
        if (/FSL/i.test(src)) return 'HubCloud FSL Server';
        if (/FSL V2/i.test(src)) return 'HubCloud FSL V2 Server';
        if (/S3/i.test(src)) return 'HubCloud S3 Server';
        if (/Buzz/i.test(src)) return 'HubCloud BuzzServer';
        if (/10\s*Gbps/i.test(src)) return 'HubCloud 10Gbps';
        return 'HubCloud';
    }
    if (/Pixeldrain/i.test(src)) return 'Pixeldrain';
    if (/StreamTape/i.test(src)) return 'StreamTape';
    if (/HubCdn/i.test(src)) return 'HubCdn';
    if (/HbLinks/i.test(src)) return 'HbLinks';
    if (/Hubstream/i.test(src)) return 'Hubstream';
    return src.replace(/^www\./i, '').split(/[.\s]/)[0];
}

function rot13(value) {
    return value.replace(/[a-zA-Z]/g, function (c) {
        return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
    });
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function atob(value) {
    if (!value) return '';
    let input = String(value).replace(/=+$/, '');
    let output = '';
    let bc = 0, bs, buffer, idx = 0;
    while ((buffer = input.charAt(idx++))) {
        buffer = BASE64_CHARS.indexOf(buffer);
        if (~buffer) {
            bs = bc % 4 ? bs * 64 + buffer : buffer;
            if (bc++ % 4) {
                output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
            }
        }
    }
    return output;
}

function btoa(value) {
    if (value == null) return '';
    let str = String(value);
    let output = '';
    let i = 0;
    while (i < str.length) {
        const chr1 = str.charCodeAt(i++);
        const chr2 = str.charCodeAt(i++);
        const chr3 = str.charCodeAt(i++);
        const enc1 = chr1 >> 2;
        const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        let enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        let enc4 = chr3 & 63;
        if (isNaN(chr2)) {
            enc3 = 64;
            enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output += BASE64_CHARS.charAt(enc1) + BASE64_CHARS.charAt(enc2) + BASE64_CHARS.charAt(enc3) + BASE64_CHARS.charAt(enc4);
    }
    return output;
}

function cleanTitle(title) {
    const parts = title.split(/[.\-_]/);
    const qualityTags = ["WEBRip", "WEB-DL", "WEB", "BluRay", "HDRip", "DVDRip", "HDTV", "CAM", "TS", "R5", "DVDScr", "BRRip", "BDRip", "DVD", "PDTV", "HD"];
    const startIndex = parts.findIndex(part => qualityTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())));
    const subTags = ["ESub", "ESubs", "Subs", "MultiSub", "NoSub", "EnglishSub", "HindiSub"];
    const audioTags = ["AAC", "AC3", "DTS", "MP3", "FLAC", "DD5", "EAC3", "Atmos"];
    const codecTags = ["x264", "x265", "H264", "HEVC", "AVC"];
    const endIndex = parts.findLastIndex(part => subTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())) || audioTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())) || codecTags.some(tag => part.toLowerCase().includes(tag.toLowerCase())));
    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        return parts.slice(startIndex, endIndex + 1).join(".");
    } else if (startIndex !== -1) {
        return parts.slice(startIndex).join(".");
    } else {
        return parts.slice(-3).join(".");
    }
}

function fetchAndUpdateDomain() {
    const now = Date.now();
    if (now - domainCacheTimestamp < DOMAIN_CACHE_TTL) {
        return Promise.resolve();
    }
    console.log('[Moviesdrive] Fetching latest domain...');
    return fetch(DOMAINS_URL, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }).then(function (response) {
        if (response.ok) {
            return response.json().then(function (data) {
                if (data && data.Moviesdrive) {
                    const newDomain = data.Moviesdrive;
                    if (newDomain !== MAIN_URL) {
                        console.log(`[Moviesdrive] Updating domain from ${MAIN_URL} to ${newDomain}`);
                        MAIN_URL = newDomain;
                        HEADERS.Referer = `${MAIN_URL}/`;
                        domainCacheTimestamp = now;
                    }
                }
            });
        }
    }).catch(function (error) {
        console.error(`[Moviesdrive] Failed to fetch latest domains: ${error.message}`);
    });
}

function getCurrentDomain() {
    return fetchAndUpdateDomain().then(function () {
        return MAIN_URL;
    });
}

function getRedirectLinks(url) {
    return fetch(url, { headers: HEADERS })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.text();
        })
        .then(doc => {
            const regex = /s\('o','([A-Za-z0-9+/=]+)'|ck\('_wp_http_\d+','([^']+)'/g;
            let combinedString = '';
            let match;
            while ((match = regex.exec(doc)) !== null) {
                const extractedValue = match[1] || match[2];
                if (extractedValue) {
                    combinedString += extractedValue;
                }
            }
            if (!combinedString) {
                console.error("[getRedirectLinks] Could not find encoded strings in page.");
                return url;
            }
            const decodedString = atob(rot13(atob(atob(combinedString))));
            const jsonObject = JSON.parse(decodedString);
            const encodedUrl = atob(jsonObject.o || '').trim();
            if (encodedUrl) {
                return encodedUrl;
            }
            const data = btoa(jsonObject.data || '').trim();
            const wpHttp = (jsonObject.blog_url || '').trim();
            if (wpHttp && data) {
                return fetch(`${wpHttp}?re=${data}`, { headers: HEADERS })
                    .then(directLinkResponse => directLinkResponse.text())
                    .then(text => text.trim());
            }
            return url;
        })
        .catch(e => {
            console.error(`[getRedirectLinks] Error processing link ${url}:`, e.message);
            return url;
        });
}

// =================================================================================
// EXTRACTORS
// =================================================================================
function pixelDrainExtractor(link) {
    return Promise.resolve().then(() => {
        let fileId;
        const match = link.match(/(?:file|u)\/([A-Za-z0-9]+)/);
        if (match) {
            fileId = match[1];
        } else {
            fileId = link.split('/').pop();
        }
        if (!fileId) {
            return [{ source: 'Pixeldrain', quality: 'Unknown', url: link }];
        }
        const infoUrl = `https://pixeldrain.com/api/file/${fileId}/info`;
        let fileInfo = { name: '', quality: 'Unknown', size: 0 };
        return fetch(infoUrl, { headers: HEADERS })
            .then(response => response.json())
            .then(info => {
                if (info && info.name) {
                    fileInfo.name = info.name;
                    fileInfo.size = info.size || 0;
                    const qualityMatch = info.name.match(/(\d{3,4})p/);
                    if (qualityMatch) {
                        fileInfo.quality = qualityMatch[0];
                    }
                }
                const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
                return [{
                    source: 'Pixeldrain',
                    quality: fileInfo.quality,
                    url: directUrl,
                    name: fileInfo.name,
                    size: fileInfo.size,
                }];
            })
            .catch(e => {
                console.warn(`[Pixeldrain] Could not fetch file info for ${fileId}:`, e.message);
                const directUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
                return [{
                    source: 'Pixeldrain',
                    quality: fileInfo.quality,
                    url: directUrl,
                    name: fileInfo.name,
                    size: fileInfo.size,
                }];
            });
    }).catch(e => {
        console.error('[Pixeldrain] extraction failed', e.message);
        return [{ source: 'Pixeldrain', quality: 'Unknown', url: link }];
    });
}

function streamTapeExtractor(link) {
    const url = new URL(link);
    url.hostname = 'streamtape.com';
    const normalizedLink = url.toString();
    return fetch(normalizedLink, { headers: HEADERS })
        .then(res => res.text())
        .then(data => {
            const match = data.match(/document\.getElementById\('videolink'\)\.innerHTML = (.*?);/);
            if (match && match[1]) {
                const scriptContent = match[1];
                const urlPartMatch = scriptContent.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
                if (urlPartMatch && urlPartMatch[1]) {
                    const videoSrc = 'https:' + urlPartMatch[1];
                    return [{ source: 'StreamTape', quality: 'Stream', url: videoSrc }];
                }
            }
            const simpleMatch = data.match(/'(\/\/streamtape\.com\/get_video[^']+)'/);
            if (simpleMatch && simpleMatch[0]) {
                const videoSrc = 'https:' + simpleMatch[0].slice(1, -1);
                return [{ source: 'StreamTape', quality: 'Stream', url: videoSrc }];
            }
            return [];
        })
        .catch(e => {
            if (!e.response || e.response.status !== 404) {
                console.error(`[StreamTape] An unexpected error occurred for ${normalizedLink}:`, e.message);
            }
            return [];
        });
}

function hubStreamExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(response => {
            return [{ source: 'Hubstream', quality: 'Unknown', url }];
        })
        .catch(e => {
            console.error(`[Hubstream] Failed to extract from ${url}:`, e.message);
            return [];
        });
}

function hbLinksExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(response => response.text())
        .then(data => {
            const $ = cheerio.load(data);
            const links = $('h3 a, div.entry-content p a').map((i, el) => $(el).attr('href')).get();
            const finalLinks = [];
            const promises = links.map(link => loadExtractor(link, url));
            return Promise.all(promises)
                .then(results => {
                    results.forEach(extracted => finalLinks.push(...extracted));
                    return finalLinks;
                });
        });
}

function hubCdnExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(response => response.text())
        .then(data => {
            const encodedMatch = data.match(/r=([A-Za-z0-9+/=]+)/);
            if (encodedMatch && encodedMatch[1]) {
                const m3u8Data = atob(encodedMatch[1]);
                const m3u8Link = m3u8Data.substring(m3u8Data.lastIndexOf('link=') + 5);
                return [{
                    source: 'HubCdn',
                    quality: 'M3U8',
                    url: m3u8Link,
                }];
            }
            return [];
        })
        .catch(() => []);
}

function hubDriveExtractor(url, referer) {
    return fetch(url, { headers: { ...HEADERS, Referer: referer } })
        .then(response => response.text())
        .then(data => {
            const $ = cheerio.load(data);
            const href = $('.btn.btn-primary.btn-user.btn-success1.m-1').attr('href');
            if (href) {
                return loadExtractor(href, url);
            }
            return [];
        })
        .catch(() => []);
}

function hubCloudExtractor(url, referer) {
    let currentUrl = url;
    if (currentUrl.includes("hubcloud.ink")) {
        currentUrl = currentUrl.replace("hubcloud.ink", "hubcloud.dad");
    }
    if (/\/(video|drive)\//i.test(currentUrl)) {
        return fetch(currentUrl, {
            headers: { ...HEADERS, Referer: referer }
        })
            .then(r => r.text())
            .then(html => {
                const $ = cheerio.load(html);
                const hubPhp = $('a[href*="hubcloud.php"]').attr('href');
                if (!hubPhp) return [];
                return hubCloudExtractor(hubPhp, currentUrl);
            })
            .catch(() => []);
    }
    const initialFetch = currentUrl.includes("hubcloud.php")
        ? fetch(currentUrl, {
            headers: { ...HEADERS, Referer: referer },
            redirect: "follow"
        }).then(response =>
            response.text().then(html => ({
                pageData: html,
                finalUrl: response.url || currentUrl
            }))
        )
        : fetch(currentUrl, {
            headers: { ...HEADERS, Referer: referer }
        })
            .then(r => r.text())
            .then(pageData => {
                let finalUrl = currentUrl;
                const scriptUrlMatch = pageData.match(/var url = '([^']*)'/);
                if (scriptUrlMatch && scriptUrlMatch[1]) {
                    finalUrl = scriptUrlMatch[1];
                    return fetch(finalUrl, {
                        headers: { ...HEADERS, Referer: currentUrl }
                    })
                        .then(r => r.text())
                        .then(secondData => ({
                            pageData: secondData,
                            finalUrl
                        }));
                }
                return { pageData, finalUrl };
            });
    return initialFetch
        .then(({ pageData, finalUrl }) => {
            const $ = cheerio.load(pageData);
            const size = $('i#size').text().trim();
            const header = $('div.card-header').text().trim();
            const getIndexQuality = (str) => {
                const match = (str || '').match(/(\d{3,4})[pP]/);
                return match ? parseInt(match[1]) : 2160;
            };
            const quality = getIndexQuality(header);
            const headerDetails = cleanTitle(header);
            const labelExtras = (() => {
                let extras = '';
                if (headerDetails) extras += `[${headerDetails}]`;
                if (size) extras += `[${size}]`;
                return extras;
            })();
            const sizeInBytes = (() => {
                if (!size) return 0;
                const m = size.match(/([\d.]+)\s*(GB|MB|KB)/i);
                if (!m) return 0;
                const v = parseFloat(m[1]);
                if (m[2].toUpperCase() === 'GB') return v * 1024 ** 3;
                if (m[2].toUpperCase() === 'MB') return v * 1024 ** 2;
                if (m[2].toUpperCase() === 'KB') return v * 1024;
                return 0;
            })();
            const links = [];
            const elements = $('a.btn[href]').get();
            const processElements = elements.map(el => {
                const link = $(el).attr('href');
                const text = $(el).text();
                if (/telegram/i.test(text) || /telegram/i.test(link)) {
                    return Promise.resolve();
                }
                console.log(`[HubCloud] Found ${text} link ${link}`);
                const fileName = header || headerDetails || 'Unknown';
                if (text.includes("Download File")) {
                    links.push({
                        source: `HubCloud ${labelExtras}`,
                        quality,
                        url: link,
                        size: sizeInBytes,
                        name: fileName
                    });
                }
                return Promise.resolve();
            });
            return Promise.all(processElements).then(() => links);
        });
}

function loadExtractor(url, referer) {
    if (!url || !referer) return Promise.resolve([]);
    
    if (/pixeldrain/.test(url)) {
        return pixelDrainExtractor(url);
    } else if (/streamtape/.test(url)) {
        return streamTapeExtractor(url);
    } else if (/hubstream/.test(url)) {
        return hubStreamExtractor(url, referer);
    } else if (/hblinks/.test(url)) {
        return hbLinksExtractor(url, referer);
    } else if (/hubcdn/.test(url)) {
        return hubCdnExtractor(url, referer);
    } else if (/hubdrive/.test(url)) {
        return hubDriveExtractor(url, referer);
    } else if (/hubcloud/.test(url)) {
        return hubCloudExtractor(url, referer);
    } else {
        return Promise.resolve([{
            source: 'Direct',
            quality: 'Unknown',
            url: url
        }]);
    }
}

// =================================================================================
// MAIN SCRAPER CLASS
// =================================================================================
class MoviesDriveScraper {
    constructor() {
        this.name = "MoviesDrive";
        this.version = "1.0.0";
        this.headers = HEADERS;
    }

    async search(query, type = "movie") {
        try {
            await getCurrentDomain();
            const searchUrl = `${MAIN_URL}/?s=${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl, { headers: this.headers });
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const results = [];
            $('.post, article').each((i, element) => {
                const title = $(element).find('h2 a').text();
                const url = $(element).find('h2 a').attr('href');
                const poster = $(element).find('img').attr('src');
                const size = $(element).find('.file-size').text();
                
                if (title && url) {
                    results.push({
                        title: title,
                        url: url.startsWith('http') ? url : MAIN_URL + url,
                        poster: poster || '',
                        size: size || '',
                        type: title.toLowerCase().includes('season') ? 'tv' : 'movie'
                    });
                }
            });
            
            return results.slice(0, 10);
        } catch (error) {
            console.error('MoviesDrive search error:', error);
            return [];
        }
    }

    async getMeta(url) {
        try {
            await getCurrentDomain();
            const response = await fetch(u

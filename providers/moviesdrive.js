// MoviesDrive provider - DISABLED due to JavaScript rendering
// This provider uses client-side rendering which cannot be scraped with fetch()
// Keeping the function for compatibility but returning empty results

const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';

function getStreams(tmdbId, mediaType, season, episode) {
    // MoviesDrive uses JavaScript rendering - not compatible with server-side scraping
    // Return empty array to prevent errors
    return Promise.resolve([]);
}

module.exports = { getStreams };

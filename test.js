// To run this test locally:
// 1. Install dependencies: npm install node-fetch cheerio-without-node-native
// 2. Run: node test.js

if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

const { getStreams } = require('./providers/4khubdad.js');

console.log('Testing 4KHDHub.DAD...');
getStreams('603', 'movie').then(streams => {
  console.log('Found', streams.length, 'streams');
  streams.forEach(stream => console.log(`${stream.name}: ${stream.quality} - ${stream.url}`));
}).catch(console.error);

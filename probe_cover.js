const https = require('https');

const TEST_SCI = "Anas platyrhynchos"; // Canard Colvert

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexCoverProbe' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function probe() {
    console.log(`Probing ${TEST_SCI}...`);
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(TEST_SCI)}&per_page=1`;
    const res = await fetchJSON(url);

    if (res.results && res.results.length > 0) {
        const t = res.results[0];
        console.log(`Taxon: ${t.name}`);
        if (t.default_photo) {
            console.log(`Default Photo URL (square): ${t.default_photo.url}`);
            console.log(`Default Photo URL (large): ${t.default_photo.url.replace('square', 'large')}`);
            console.log(`Attribution: ${t.default_photo.attribution}`);
        } else {
            console.log("No default_photo found.");
        }
    }
}

probe();

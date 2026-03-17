const https = require('https');

const TEST_CASE = {
    name: "Canard",
    scientificName: "Anas platyrhynchos",
    type: "bird"
};

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexSim' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function simulateShuffle() {
    console.log(`[Simulation] User Ctrl+Clicks on "${TEST_CASE.name}"`);
    console.log(`[Logic] Using Scientific Name: "${TEST_CASE.scientificName}"...`);

    // 1. Search Taxon
    const searchUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(TEST_CASE.scientificName)}&iconic_taxa=Aves&locale=fr&per_page=1`;
    const searchRes = await fetchJSON(searchUrl);

    if (searchRes.results && searchRes.results.length > 0) {
        const taxon = searchRes.results[0];
        console.log(`[iNat] Taxon Found: ${taxon.name} (${taxon.preferred_common_name}) - ID: ${taxon.id}`);

        // 2. Fetch Photos
        const infoUrl = `https://api.inaturalist.org/v1/taxa/${taxon.id}`;
        const infoRes = await fetchJSON(infoUrl);
        const photos = infoRes.results[0].taxon_photos;

        console.log(`[iNat] Available Photos: ${photos.length}`);
        if (photos.length > 0) {
            console.log(`[Result] Default Photo: ${photos[0].photo.url.replace('square', 'large')}`);
            console.log("✅ Success! Matches user expectation.");
        }
    } else {
        console.log("❌ Failed to find taxon.");
    }
}

simulateShuffle();

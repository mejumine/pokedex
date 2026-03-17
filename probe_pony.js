const https = require('https');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexProbePony' } }, (res) => {
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
    const terms = ["Poney", "Shetland Pony", "Exmoor Pony", "Falabella"];
    for (const t of terms) {
        console.log(`Searching for "${t}"...`);
        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(t)}&per_page=1&locale=fr`;
        const res = await fetchJSON(url);
        if (res.results && res.results.length > 0) {
            console.log(`  Found: ${res.results[0].name} (${res.results[0].preferred_common_name}) - ID: ${res.results[0].id}`);
        } else {
            console.log("  No match.");
        }
        await new Promise(r => setTimeout(r, 500));
    }
}

probe();

const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexCoverSync' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 429) return reject(new Error('429'));
                if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log("Loading database...");
    const content = fs.readFileSync(DB_PATH, 'utf8');
    const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    const db = eval(dbMatch[1]);

    // Iterate all
    console.log(`Syncing ${db.length} animals with iNaturalist Covers...`);
    let updates = 0;

    for (let i = 0; i < db.length; i++) {
        const a = db[i];
        if (!a.scientificName) {
            console.log(`[${i + 1}/${db.length}] Skip ${a.name} (no sci name)`);
            continue;
        }

        // Fetch taxon to get default_photo
        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(a.scientificName)}&per_page=1&locale=fr`;

        try {
            const res = await fetchJSON(url);
            if (res.results && res.results.length > 0) {
                const taxon = res.results[0];
                if (taxon.default_photo) {
                    const newUrl = taxon.default_photo.url.replace('square', 'large');

                    // Only update if different (ignoring query params if any)
                    if (a.imgRef !== newUrl) {
                        a.imgRef = newUrl;
                        updates++;
                        console.log(`[${i + 1}/${db.length}] ✅ Updated ${a.name} -> ${newUrl}`);
                    } else {
                        console.log(`[${i + 1}/${db.length}] ⏭️ No change for ${a.name}`);
                    }
                } else {
                    console.log(`[${i + 1}/${db.length}] ⚠️ No cover photo for ${a.name}`);
                }
            } else {
                console.log(`[${i + 1}/${db.length}] ❌ Taxon not found: ${a.scientificName}`);
            }
        } catch (e) {
            if (e.message === '429') {
                console.log(`[${i + 1}/${db.length}] ⏳ Rate limit. Pausing 10s...`);
                await new Promise(r => setTimeout(r, 10000));
                i--; // Retry
            } else {
                console.error(`[${i + 1}/${db.length}] 🔥 Error for ${a.name}: ${e.message}`);
            }
        }

        // Save every 20
        if ((i + 1) % 20 === 0 && updates > 0) {
            saveDB(db);
        }

        // Polite delay (approx 100 req/min max)
        await new Promise(r => setTimeout(r, 800));
    }

    if (updates > 0) saveDB(db);
    console.log(`\nDONE. Updated ${updates} images.`);
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, `window.DB = ${JSON.stringify(db, null, 4)};`, 'utf8');
    console.log('💾 Database saved.');
}

run();

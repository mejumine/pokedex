/**
 * iNaturalist Image Updater
 * Replaces animal images in database.js with iNaturalist taxon photos.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

/**
 * Fetches a taxon photo from iNaturalist.
 * Resolves with the highest quality URL (original or large).
 */
function getINatImage(query) {
    return new Promise((resolve) => {
        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&per_page=1`;

        https.get(url, { headers: { 'User-Agent': 'PokedexApp/2.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results.length > 0) {
                        const taxon = json.results[0];
                        const photo = taxon.default_photo;
                        if (photo) {
                            // Construct high-res URLs if original_url is missing
                            // iNaturalist URLs usually follow a pattern: .../medium.jpg -> .../original.jpg
                            let bestUrl = photo.original_url || photo.large_url || photo.medium_url;

                            if (!bestUrl && photo.url) {
                                bestUrl = photo.url.replace('square', 'original');
                            }

                            resolve(bestUrl);
                        } else {
                            resolve(null);
                        }
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log("🚀 Starting iNaturalist Image Update...");

    if (!fs.existsSync(DB_PATH)) {
        console.error("❌ Database file not found");
        return;
    }

    const dbContent = fs.readFileSync(DB_PATH, 'utf8');
    const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    if (!dbMatch) return;

    let dbData = eval(dbMatch[1]);
    console.log(`📊 Processing ${dbData.length} animals...`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dbData.length; i++) {
        const animal = dbData[i];

        process.stdout.write(`[${i + 1}/${dbData.length}] ${animal.name}... `);

        // Try scientific name first, then English, then name
        const queries = [];
        if (animal.scientificName) queries.push(animal.scientificName);
        if (animal.englishName) queries.push(animal.englishName);
        queries.push(animal.name);

        let imgUrl = null;
        for (const q of queries) {
            imgUrl = await getINatImage(q);
            if (imgUrl) break;
            await new Promise(r => setTimeout(r, 100));
        }

        if (imgUrl) {
            // Convert https to http if needed, but inat is usually https. 
            // Ensure we use the best quality keyword in URL
            if (imgUrl.includes('square')) imgUrl = imgUrl.replace('square', 'large');
            if (imgUrl.includes('medium')) imgUrl = imgUrl.replace('medium', 'large');

            animal.imgRef = imgUrl;
            updatedCount++;
            console.log("✅");
        } else {
            skippedCount++;
            console.log("⚠️ (Not found)");
        }

        // Rate limiting for iNaturalist API
        await new Promise(r => setTimeout(r, 500));

        if (i > 0 && i % 20 === 0) {
            saveDb(dbData, dbContent);
        }
    }

    saveDb(dbData, dbContent);
    console.log(`\n🎉 Done!
    ✅ Updated: ${updatedCount}
    ⚠️ Skipped: ${skippedCount}`);
}

function saveDb(data, originalContent) {
    const newContent = originalContent.replace(/window\.DB\s*=\s*\[[\s\S]*?\];/, `window.DB = ${JSON.stringify(data, null, 4)};`);
    fs.writeFileSync(DB_PATH, newContent);
}

run();

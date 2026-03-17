/**
 * Pexels Image Updater Script v2
 * Replaces all animal images in database.js with high-quality Pexels photos.
 * Filters: mammal/bird/wildlife, no people, no logos.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const PEXELS_API_KEY = 'd9F05g6a7eXVxnB8QZpTw6wrmhfcntqTrFV5KusQ1IU3wMTPRQmmAiFi';
const DB_PATH = path.resolve(__dirname, 'database.js');

// Keywords that suggest the photo might contain humans or unsuitabe content
const FORBIDDEN_KEYWORDS = ['person', 'human', 'face', 'hand', 'arm', 'leg', 'woman', 'man', 'child', 'people', 'logo', 'text', 'watermark'];

/**
 * Searches Pexels for an image and filters results client-side.
 */
function getPexelsImage(query) {
    return new Promise((resolve) => {
        if (!PEXELS_API_KEY) {
            resolve({ error: "Missing API Key" });
            return;
        }

        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' animal wildlife')}&per_page=5&orientation=landscape`;

        https.get(url, {
            headers: {
                'Authorization': PEXELS_API_KEY,
                'User-Agent': 'PokedexApp/2.0'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.photos && json.photos.length > 0) {
                        // Filter photos based on alt text and tags (if available)
                        const bestPhoto = json.photos.find(photo => {
                            const alt = (photo.alt || '').toLowerCase();
                            const hasForbidden = FORBIDDEN_KEYWORDS.some(word => alt.includes(word));
                            return !hasForbidden;
                        });

                        const selected = bestPhoto || json.photos[0];
                        resolve(selected.src.large2x);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing response for ${query}: ${e.message}`);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error(`Network error for ${query}: ${e.message}`);
            resolve(null);
        });
    });
}

async function run() {
    console.log("🚀 Starting Pokedex Image Update...");

    if (!fs.existsSync(DB_PATH)) {
        console.error(`❌ Database file not found at ${DB_PATH}`);
        return;
    }

    const dbContent = fs.readFileSync(DB_PATH, 'utf8');
    const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    if (!dbMatch) {
        console.error("❌ Could not find window.DB array in database.js");
        return;
    }

    let dbData;
    try {
        // Safe way to parse the array from the file
        dbData = JSON.parse(dbMatch[1]);
    } catch (e) {
        // Fallback for non-strict JSON (like the one in the file if it has trailing commas)
        try {
            dbData = eval(dbMatch[1]);
        } catch (e2) {
            console.error("❌ Failed to parse database.js content.");
            return;
        }
    }

    console.log(`📊 Processing ${dbData.length} animals...`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < dbData.length; i++) {
        const animal = dbData[i];
        const query = animal.englishName || animal.name;

        process.stdout.write(`[${i + 1}/${dbData.length}] ${animal.name} (${query})... `);

        try {
            const imgUrl = await getPexelsImage(query);
            if (imgUrl) {
                animal.imgRef = imgUrl;
                updatedCount++;
                console.log("✅");
            } else {
                skippedCount++;
                console.log("⚠️ (No image found)");
            }
        } catch (error) {
            skippedCount++;
            console.log("❌ (Error)");
        }

        // Rate limiting to avoid API ban
        await new Promise(r => setTimeout(r, 250));

        // Interim save every 20 animals
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
    console.log("\n💾 Database saved.");
}

run();

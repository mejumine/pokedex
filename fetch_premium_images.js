const https = require('https');
const fs = require('fs');

// IMPORTANT: The user might need to provide their own PEXELS_API_KEY
// I will use a placeholder and suggest they add it or I can try to help them find a way.
// For the sake of the demonstration, I'll structure it to handle a missing key gracefully.
const PEXELS_API_KEY = 'd9F05g6a7eXVxnB8QZpTw6wrmhfcntqTrFV5KusQ1IU3wMTPRQmmAiFi'; // USER: Insert your Pexels API key here

const dbPath = 'c:\\Users\\Quentin\\.gemini\\antigravity\\scratch\\pokedex\\database.js';

function getPexelsImage(query) {
    return new Promise((resolve) => {
        if (!PEXELS_API_KEY) {
            resolve({ error: "Missing API Key" });
            return;
        }

        const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;

        https.get(url, {
            headers: {
                'Authorization': PEXELS_API_KEY,
                'User-Agent': 'PokedexApp/1.0'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.photos && json.photos.length > 0) {
                        resolve(json.photos[0].src.large2x); // High res
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
    if (!PEXELS_API_KEY) {
        console.log("⚠️ PEXELS_API_KEY is missing. Please provide it at the top of the script.");
        console.log("You can get a free one at https://www.pexels.com/api/");
        return;
    }

    const dbContent = fs.readFileSync(dbPath, 'utf8');
    const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    if (!dbMatch) return;

    let dbData = eval(dbMatch[1]);
    console.log(`Searching for high-quality images for ${dbData.length} animals...`);

    let updatedCount = 0;
    for (let i = 0; i < dbData.length; i++) {
        const animal = dbData[i];
        // Priority to scientific name for accuracy, then common name
        const query = animal.scientificName || animal.name;

        process.stdout.write(`[${i + 1}/${dbData.length}] ${animal.name} (${query})... `);

        const imgUrl = await getPexelsImage(query);
        if (imgUrl && typeof imgUrl === 'string') {
            animal.imgRef = imgUrl;
            updatedCount++;
            console.log("✅");
        } else {
            console.log("❌ (Skipped or Error)");
        }

        await new Promise(r => setTimeout(r, 200)); // Rate limiting

        // Save every 10 animals for safety
        if (i > 0 && i % 10 === 0) {
            const tempContent = dbContent.replace(/window\.DB\s*=\s*\[[\s\S]*?\];/, `window.DB = ${JSON.stringify(dbData, null, 4)};`);
            fs.writeFileSync(dbPath, tempContent);
        }
    }

    const finalContent = dbContent.replace(/window\.DB\s*=\s*\[[\s\S]*?\];/, `window.DB = ${JSON.stringify(dbData, null, 4)};`);
    fs.writeFileSync(dbPath, finalContent);
    console.log(`\nDone! Updated ${updatedCount} images.`);
}

run();

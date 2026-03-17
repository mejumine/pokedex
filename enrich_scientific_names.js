const https = require('https');
const fs = require('fs');
const path = require('path');

// Mock window.DB to load standard Node.js
const dbPath = 'c:\\Users\\Quentin\\.gemini\\antigravity\\scratch\\pokedex\\database.js';
const dbContent = fs.readFileSync(dbPath, 'utf8');
const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);

if (!dbMatch) {
    console.error("Could not find window.DB in database.js");
    process.exit(1);
}

// Convert to JSON-friendly string (handling potential non-strict JSON in JS file)
// This is a simplified approach; in production, we'd use a parser, but for this task 
// we will assume the structure is fairly consistent.
let dbData;
try {
    // Eval is dangerous but used here in a controlled local script to bypass non-JSON JS structure
    dbData = eval(dbMatch[1]);
} catch (e) {
    console.error("Error evaluating DB content:", e);
    process.exit(1);
}

async function getScientificName(animalName) {
    return new Promise((resolve) => {
        const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(animalName)}&format=json&origin=*`;

        https.get(url, { headers: { 'User-Agent': 'PokedexApp/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const pages = json.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pageId === "-1") {
                        resolve(null);
                        return;
                    }
                    const extract = pages[pageId].extract || "";
                    // Look for Latin names usually in italics: <i>Name</i> or (<i>Name</i>)
                    const latinMatch = extract.match(/<i>([A-Z][a-z]+\s[a-z]+)<\/i>/);
                    if (latinMatch) {
                        resolve(latinMatch[1]);
                    } else {
                        // Fallback: search for "nom scientifique" text
                        const textMatch = extract.match(/nom scientifique\s*:\s*<b>([^<]+)<\/b>/i) ||
                            extract.match(/\(<i>([^<]+)<\/i>\)/);
                        resolve(textMatch ? textMatch[1] : null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function run() {
    console.log(`Processing ${dbData.length} animals...`);
    const results = [];

    for (let i = 0; i < dbData.length; i++) {
        const animal = dbData[i];
        process.stdout.write(`[${i + 1}/${dbData.length}] Fetching for ${animal.name}... `);

        const scientific = await getScientificName(animal.name);
        if (scientific) {
            animal.scientificName = scientific;
            console.log(`✅ ${scientific}`);
        } else {
            console.log(`❌ Not found`);
        }

        await new Promise(r => setTimeout(r, 100)); // Respect API limits
    }

    // Prepare updated file content
    const updatedContent = dbContent.replace(/window\.DB\s*=\s*\[[\s\S]*?\];/, `window.DB = ${JSON.stringify(dbData, null, 4)};`);
    fs.writeFileSync(dbPath, updatedContent);
    console.log(`\nDone! Database updated at ${dbPath}`);
}

run();

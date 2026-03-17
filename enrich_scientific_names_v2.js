const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

const typeToInat = {
    'mammal': 'Mammalia',
    'bird': 'Aves',
    'reptile': 'Reptilia',
    'amphibian': 'Amphibia',
    'fish': 'Actinopterygii',
    'insect': 'Insecta,Arachnida,Mollusca'
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexEnrich' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    const content = fs.readFileSync(DB_PATH, 'utf8');
    const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    const db = eval(dbMatch[1]);

    const toFix = db.filter(a => !a.scientificName);
    console.log(`Need to enrich ${toFix.length} animals.`);

    for (let i = 0; i < toFix.length; i++) {
        const a = toFix[i];
        const targetIconic = typeToInat[a.type] || 'Animalia';
        console.log(`[${i + 1}/${toFix.length}] Searching for "${a.name}" (${a.type})...`);

        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(a.name)}&iconic_taxa=${encodeURIComponent(targetIconic)}&locale=fr&per_page=10`;
        const results = await fetchJSON(url);

        if (results.results && results.results.length > 0) {
            // Find the first result that strictly matches the iconic taxon filter
            const filterTerms = targetIconic.split(',');
            const match = results.results.find(r => filterTerms.includes(r.iconic_taxon_name));

            if (match) {
                a.scientificName = match.name;
                console.log(`  ✅ Found: ${match.name} (${match.preferred_common_name || 'N/A'})`);
            } else {
                console.log(`  ⚠️ No category match in first 10 for "${a.name}"`);
            }
        } else {
            console.log(`  ❌ No iNaturalist results for "${a.name}"`);
        }

        // Save every 20 just in case
        if ((i + 1) % 20 === 0) {
            saveDB(db);
        }
        await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    saveDB(db);
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, `window.DB = ${JSON.stringify(db, null, 4)};`, 'utf8');
    console.log('💾 Database updated.');
}

run();

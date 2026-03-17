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
    'insect': 'Insecta,Arachnida,Mollusca',
    'aquatic': 'Mammalia,Actinopterygii,Mollusca,Animalia'
};

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexEnrich' } }, (res) => {
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
    const content = fs.readFileSync(DB_PATH, 'utf8');
    const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
    const db = eval(dbMatch[1]);

    const toFix = db.filter(a => !a.scientificName);
    console.log(`Need to enrich ${toFix.length} animals.`);

    for (let i = 0; i < toFix.length; i++) {
        const a = toFix[i];
        const targetIconic = typeToInat[a.type] || 'Animalia';
        console.log(`[${i + 1}/${toFix.length}] Searching for "${a.name}" (${a.type})...`);

        let success = false;
        let retries = 0;

        while (!success && retries < 3) {
            try {
                const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(a.name)}&iconic_taxa=${encodeURIComponent(targetIconic)}&locale=fr&per_page=10`;
                const results = await fetchJSON(url);

                if (results.results && results.results.length > 0) {
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
                success = true;
            } catch (e) {
                if (e.message === '429') {
                    console.log('  ⏳ Rate limited. Waiting 10s...');
                    await new Promise(r => setTimeout(r, 10000));
                    retries++;
                } else {
                    console.error(`  🔥 Error for ${a.name}: ${e.message}`);
                    success = true; // Skip on non-429 errors
                }
            }
        }

        if ((i + 1) % 10 === 0) {
            saveDB(db);
        }
        await new Promise(r => setTimeout(r, 1500)); // Safer 1.5s delay
    }

    saveDB(db);
}

function saveDB(db) {
    fs.writeFileSync(DB_PATH, `window.DB = ${JSON.stringify(db, null, 4)};`, 'utf8');
    console.log('💾 Database updated.');
}

run();

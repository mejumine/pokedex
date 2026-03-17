const https = require('https');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS/PokedexVerify' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({}); } // Fail soft
            });
        }).on('error', (e) => resolve({})); // Fail soft
    });
}

async function verify() {
    console.log(`Verifying ${db.length} animals against iNaturalist (locale=fr)...`);
    let potentialFixes = [];

    for (let i = 0; i < db.length; i++) {
        const a = db[i];

        // Search iNaturalist for the Common Name
        const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(a.name)}&per_page=1&locale=fr`;

        try {
            const res = await fetchJSON(url);
            if (res.results && res.results.length > 0) {
                const bestMatch = res.results[0];

                // Compare existing scientific name vs iNat result
                // Normalize by ignoring case and spaces
                const currentSci = (a.scientificName || "").toLowerCase().trim();
                const iNatSci = bestMatch.name.toLowerCase().trim();

                // If massive mismatch
                if (currentSci !== iNatSci) {
                    // Filter out trivial differences if we wanted, but strict match is better for now
                    console.log(`[MISMATCH] ${a.name}`);
                    console.log(`   Current: "${a.scientificName}"`);
                    console.log(`   iNat Says: "${bestMatch.name}" (${bestMatch.preferred_common_name})`);
                    console.log(`   ID: ${bestMatch.id}`);

                    potentialFixes.push({
                        name: a.name,
                        oldSci: a.scientificName,
                        newSci: bestMatch.name,
                        common: bestMatch.preferred_common_name
                    });
                }
            } else {
                console.log(`[NO RESULT] ${a.name} - Could not find on iNat`);
            }
        } catch (e) {
            console.error(`Error checking ${a.name}`);
        }

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
        if (i % 20 === 0) process.stdout.write('.');
    }

    console.log(`\n\nFound ${potentialFixes.length} potential mismatches.`);
    fs.writeFileSync('mismatches_report.json', JSON.stringify(potentialFixes, null, 4));
}

verify();

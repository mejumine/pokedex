/**
 * enrich_with_gemini.js
 * 
 * Uses Google Gemini API (free tier) to generate for each animal:
 * - desc: ~150 word engaging description (not Wikipedia copy-paste)
 * - stats.weight, stats.size: real values
 * - stats.habitat: type (Forêt, Savane, Mer, Montagne, Prairie, Ville, etc.)
 * - tips.finding: where/how to find this animal in the wild
 * - tips.photo: photography technique specific to this animal
 * 
 * Progress is saved to enrich_progress.json so the script can be resumed.
 * 
 * Usage: GEMINI_API_KEY=your_key node enrich_with_gemini.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    console.error('❌ Set GEMINI_API_KEY env var first!');
    console.error('   Example: $env:GEMINI_API_KEY="your_key" (PowerShell)');
    process.exit(1);
}

const DB_FILE = path.join(__dirname, 'database.js');
const PROGRESS_FILE = path.join(__dirname, 'enrich_progress.json');
const DELAY_MS = 4000; // ~15 requests/min max for free tier

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
    };
    const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    return res.data.candidates[0].content.parts[0].text;
}

function buildPrompt(animal) {
    return `Tu es un naturaliste passionné qui écrit pour une app style Pokédex pour photographes amateurs français.

Pour l'animal suivant, génère un JSON avec ces champs (réponds UNIQUEMENT avec le JSON, rien d'autre) :
- "desc": description engageante d'environ 150 mots. Ton familier, anecdotes, comportements fascinants, ce qui le rend unique. Pas de copie Wikipedia. Parle comme si tu partageais une passion.
- "weight": poids typique en string (ex: "2-4 kg" ou "150-200 g"). Mettre "?" si vraiment inconnu.
- "size": longueur/taille typique en string (ex: "45-60 cm"). Mettre "?" si vraiment inconnu.
- "habitat": UN mot ou très courte expression (ex: "Forêt mixte", "Prairie", "Zones humides", "Ville", "Mer tropicale", "Désert", "Montagne", "Savane")
- "finding": 2-3 phrases sur où et comment trouver cet animal (pays, saison, heure, habitat précis)
- "photo": 2-3 phrases de conseils photo spécifiques à cet animal (distance, patience, lumière, comportement à attendre)

Animal: ${animal.name} (${animal.scientificName})
Catégorie: ${animal.type}
Nom anglais: ${animal.englishName}

JSON:`;
}

async function main() {
    // Load DB
    const txt = fs.readFileSync(DB_FILE, 'utf8').replace('window.DB = ', '');
    const db = JSON.parse(txt.replace(/;\s*$/, ''));

    // Load progress
    let progress = {};
    if (fs.existsSync(PROGRESS_FILE)) {
        progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        console.log(`Resuming from progress file: ${Object.keys(progress).length} done`);
    }

    const total = db.length;
    let count = 0;
    let errors = 0;

    for (const animal of db) {
        count++;
        if (progress[animal.id]) {
            process.stdout.write(`\r[${count}/${total}] ✓ ${animal.name.substring(0, 30)}${' '.repeat(20)}`);
            continue;
        }

        process.stdout.write(`\r[${count}/${total}] … ${animal.name.substring(0, 30)}${' '.repeat(20)}`);

        let success = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const raw = await callGemini(buildPrompt(animal));
                // Extract JSON from response (handle markdown code blocks)
                let jsonStr = raw.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                const data = JSON.parse(jsonStr);

                progress[animal.id] = {
                    desc: data.desc || animal.desc,
                    weight: data.weight || '?',
                    size: data.size || '?',
                    habitat: data.habitat || 'Sauvage',
                    finding: data.finding || '',
                    photo: data.photo || '',
                };

                // Save progress every 10 animals
                if (count % 10 === 0) {
                    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
                }
                success = true;
                break;
            } catch (err) {
                if (err.response?.status === 429) {
                    const wait = attempt * 30000;
                    process.stdout.write(`\n⏳ Rate limited (attempt ${attempt}/3), waiting ${wait / 1000}s...`);
                    await sleep(wait);
                } else {
                    errors++;
                    console.error(`\n❌ Error on ${animal.name}: ${err.message}`);
                    break;
                }
            }
        }
        if (!success && !errors) errors++;

        await sleep(DELAY_MS);
    }

    // Final save of progress
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`\n\n✅ Enrichment done. ${Object.keys(progress).length}/${total} enriched, ${errors} errors`);

    // Apply enrichment to DB
    console.log('Applying enrichment to database.js...');
    for (const animal of db) {
        const p = progress[animal.id];
        if (p) {
            animal.desc = p.desc;
            animal.stats.weight = p.weight;
            animal.stats.size = p.size;
            animal.stats.habitat = p.habitat;
            animal.tips = { finding: p.finding, photo: p.photo };
        }
    }

    let out = 'window.DB = [\n';
    for (let i = 0; i < db.length; i++) {
        out += JSON.stringify(db[i], null, 4);
        if (i < db.length - 1) out += ',\n';
    }
    out += '\n];\n';

    fs.writeFileSync(DB_FILE, out, 'utf8');
    console.log('✅ database.js updated with enriched data!');
}

main().catch(err => {
    console.error('\nFatal error:', err);
    process.exit(1);
});

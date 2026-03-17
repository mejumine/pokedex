/**
 * enrich_with_groq.js
 *
 * Uses Groq API (free tier, llama-3.3-70b) to generate for each animal:
 * - desc: ~150 word engaging description (not Wikipedia copy-paste)
 * - stats.weight, stats.size: real values
 * - stats.habitat: type (Forêt, Savane, Mer, Montagne, Prairie, Ville, etc.)
 * - tips.finding: where/how to find this animal in the wild
 * - tips.photo: photography technique specific to this animal
 *
 * Progress is saved to enrich_progress.json so the script can be resumed.
 *
 * Usage: $env:GROQ_API_KEY="your_key"; node enrich_with_groq.js
 *
 * Get a free key at: https://console.groq.com/keys
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GROQ_API_KEY;
if (!API_KEY) {
    console.error('❌ Set GROQ_API_KEY env var first!');
    console.error('   Example: $env:GROQ_API_KEY="gsk_..." (PowerShell)');
    console.error('   Get a free key at: https://console.groq.com/keys');
    process.exit(1);
}

const DB_FILE = path.join(__dirname, 'database.js');
const PROGRESS_FILE = path.join(__dirname, 'enrich_progress.json');
const DELAY_MS = 5000; // 5s between requests = ~12 req/min, safely under Groq free tier limit

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGroq(prompt) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const body = {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
    };
    const res = await axios.post(url, body, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
        }
    });
    return res.data.choices[0].message.content;
}

function buildPrompt(animal) {
    return `Tu es un naturaliste passionné qui écrit pour une app style Pokédex pour photographes amateurs français.

Pour l'animal suivant, génère un JSON avec ces champs (réponds UNIQUEMENT avec le JSON brut, AUCUN texte avant ou après, pas de markdown) :
- "desc": description engageante d'environ 150 mots. Ton familier, anecdotes, comportements fascinants, ce qui le rend unique. Pas de copie Wikipedia. Parle comme si tu partageais une passion. COMMENCE DIRECTEMENT par une phrase accrocheuse sur l'animal, PAS par "Le [nom] est...".
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
    const txt = fs.readFileSync(DB_FILE, 'utf8');
    // Parse: find first [ and last ]
    const start = txt.indexOf('[');
    const end = txt.lastIndexOf(']');
    const db = JSON.parse(txt.slice(start, end + 1));

    // Load progress
    let progress = {};
    if (fs.existsSync(PROGRESS_FILE)) {
        progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        console.log(`Resuming from progress file: ${Object.keys(progress).length} done`);
    }

    const total = db.length;
    let count = 0;
    let errors = 0;
    let skipped = 0;

    console.log(`Total animals: ${total}`);
    console.log(`Already done: ${Object.keys(progress).length}`);
    console.log(`Remaining: ${total - Object.keys(progress).length}`);
    console.log('Starting enrichment...\n');

    for (const animal of db) {
        count++;
        if (progress[animal.id]) {
            skipped++;
            process.stdout.write(`\r[${count}/${total}] ✓ ${animal.name.substring(0, 30)}${' '.repeat(20)}`);
            continue;
        }

        process.stdout.write(`\r[${count}/${total}] … ${animal.name.substring(0, 30)}${' '.repeat(20)}`);

        let success = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const raw = await callGroq(buildPrompt(animal));
                // Extract JSON from response (handle markdown code blocks)
                let jsonStr = raw.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                // Find JSON object bounds
                const jStart = jsonStr.indexOf('{');
                const jEnd = jsonStr.lastIndexOf('}');
                if (jStart !== -1 && jEnd !== -1) {
                    jsonStr = jsonStr.slice(jStart, jEnd + 1);
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

                // Save progress every 20 animals
                if (count % 20 === 0) {
                    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
                }
                success = true;
                break;
            } catch (err) {
                if (err.response?.status === 429) {
                    const wait = attempt * 15000;
                    process.stdout.write(`\n⏳ Rate limited (attempt ${attempt}/5), waiting ${wait / 1000}s...`);
                    await sleep(wait);
                } else if (err instanceof SyntaxError) {
                    // JSON parse error - log and skip
                    errors++;
                    console.error(`\n⚠️  JSON parse error on ${animal.name} (attempt ${attempt}): ${err.message}`);
                    if (attempt < 5) await sleep(1000);
                } else {
                    errors++;
                    console.error(`\n❌ Error on ${animal.name}: ${err.message}`);
                    break;
                }
            }
        }
        if (!success) {
            // Keep original desc on failure
            progress[animal.id] = {
                desc: animal.desc,
                weight: '?',
                size: '?',
                habitat: animal.stats?.habitat || 'Sauvage',
                finding: '',
                photo: '',
            };
        }

        await sleep(DELAY_MS);
    }

    // Final save of progress
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`\n\n✅ Enrichment done. ${Object.keys(progress).length}/${total} processed, ${errors} errors`);

    // Apply enrichment to DB
    console.log('Applying enrichment to database.js...');
    for (const animal of db) {
        const p = progress[animal.id];
        if (p) {
            animal.desc = p.desc;
            animal.stats = animal.stats || {};
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

    // Show estimated time
    const remaining = total - Object.keys(progress).length;
    if (remaining > 0) {
        const estMinutes = Math.ceil((remaining * (DELAY_MS + 500)) / 60000);
        console.log(`Estimated time for remaining ${remaining} animals: ~${estMinutes} minutes`);
    }
}

main().catch(err => {
    // Save progress on crash
    console.error('\nFatal error:', err);
    process.exit(1);
});

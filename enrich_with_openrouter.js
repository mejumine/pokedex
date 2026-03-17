/**
 * enrich_with_openrouter.js
 *
 * Uses OpenRouter API (free models) to generate for each animal:
 * - desc: ~150 word engaging description
 * - stats.weight, stats.size: real values
 * - stats.habitat: type
 * - tips.finding, tips.photo
 *
 * FREE models available on OpenRouter:
 *   - google/gemma-3-27b-it:free
 *   - meta-llama/llama-3.3-70b-instruct:free
 *   - mistralai/mistral-7b-instruct:free
 *
 * Get a FREE key at: https://openrouter.ai/ (no credit card needed)
 * Usage: $env:OPENROUTER_API_KEY="sk-or-..."; node enrich_with_openrouter.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
    console.error('❌ Set OPENROUTER_API_KEY env var first!');
    console.error('   Get a FREE key at: https://openrouter.ai/');
    process.exit(1);
}

const DB_FILE = path.join(__dirname, 'database.js');
const PROGRESS_FILE = path.join(__dirname, 'enrich_progress.json');

// Try models in order — if one fails, switch to the next
const MODELS = [
    'google/gemma-3-27b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'mistralai/mistral-7b-instruct:free',
];
let currentModelIdx = 0;

const DELAY_MS = 3000; // 3s between requests

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callOpenRouter(prompt) {
    const model = MODELS[currentModelIdx];
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    const body = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
    };
    const res = await axios.post(url, body, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'https://pokedex-app.local',
            'X-Title': 'Pokedex Enrichment',
        }
    });
    const text = res.data.choices[0].message.content;
    if (!text || text.trim() === '') throw new Error('Empty response from model');
    return text;
}

function buildPrompt(animal) {
    return `Tu es un naturaliste passionné qui écrit pour une app style Pokédex pour photographes amateurs français.

Pour l'animal suivant, génère un JSON avec ces champs (réponds UNIQUEMENT avec le JSON brut, AUCUN texte avant ou après, pas de markdown) :
- "desc": description engageante d'environ 150 mots. Ton familier, anecdotes, comportements fascinants. Pas de copie Wikipedia. Commence par une phrase accrocheuse, PAS par "Le [nom] est...".
- "weight": poids typique (ex: "2-4 kg", "150 g"). "?" si inconnu.
- "size": longueur/taille typique (ex: "45-60 cm"). "?" si inconnu.
- "habitat": UN mot ou courte expression (ex: "Forêt mixte", "Prairie", "Zones humides", "Ville", "Mer", "Montagne", "Savane")
- "finding": 2-3 phrases sur où/comment trouver cet animal (pays, saison, heure, habitat précis)
- "photo": 2-3 phrases de conseils photo spécifiques (distance, patience, lumière, comportement)

Animal: ${animal.name} (${animal.scientificName})
Catégorie: ${animal.type}
Nom anglais: ${animal.englishName}

JSON:`;
}

async function main() {
    // Parse DB
    const txt = fs.readFileSync(DB_FILE, 'utf8');
    const start = txt.indexOf('[');
    const end = txt.lastIndexOf(']');
    const db = JSON.parse(txt.slice(start, end + 1));

    // Load progress
    let progress = {};
    if (fs.existsSync(PROGRESS_FILE)) {
        progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
        console.log(`✅ Resuming: ${Object.keys(progress).length} already done`);
    }

    const total = db.length;
    const remaining = total - Object.keys(progress).length;
    console.log(`Total: ${total} | Remaining: ${remaining}`);
    console.log(`Model: ${MODELS[currentModelIdx]}`);
    console.log(`Estimated time: ~${Math.ceil(remaining * DELAY_MS / 60000)} minutes\n`);

    let count = 0;
    let errors = 0;

    for (const animal of db) {
        count++;
        if (progress[animal.id]) {
            process.stdout.write(`\r[${count}/${total}] ✓ ${animal.name.substring(0, 35)}${' '.repeat(10)}`);
            continue;
        }

        process.stdout.write(`\r[${count}/${total}] … ${animal.name.substring(0, 35)}${' '.repeat(10)}`);

        let success = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                const raw = await callOpenRouter(buildPrompt(animal));
                let jsonStr = raw.trim();
                // Strip markdown code blocks
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
                // Find JSON bounds
                const jStart = jsonStr.indexOf('{');
                const jEnd = jsonStr.lastIndexOf('}');
                if (jStart !== -1 && jEnd !== -1) jsonStr = jsonStr.slice(jStart, jEnd + 1);

                const data = JSON.parse(jsonStr);
                progress[animal.id] = {
                    desc: data.desc || animal.desc,
                    weight: data.weight || '?',
                    size: data.size || '?',
                    habitat: data.habitat || 'Sauvage',
                    finding: data.finding || '',
                    photo: data.photo || '',
                };

                if (count % 20 === 0) {
                    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
                }
                success = true;
                break;
            } catch (err) {
                if (err.response?.status === 429) {
                    const wait = attempt * 20000;
                    process.stdout.write(`\n⏳ Rate limited, waiting ${wait / 1000}s...`);
                    await sleep(wait);
                } else if (err.response?.status === 503 || err.response?.status === 502) {
                    // Switch model
                    currentModelIdx = (currentModelIdx + 1) % MODELS.length;
                    process.stdout.write(`\n🔄 Switching to ${MODELS[currentModelIdx]}...`);
                    await sleep(2000);
                } else if (err instanceof SyntaxError) {
                    if (attempt < 3) await sleep(1000);
                    else { errors++; break; }
                } else {
                    errors++;
                    console.error(`\n❌ ${animal.name}: ${err.message}`);
                    break;
                }
            }
        }

        if (!success && !progress[animal.id]) {
            // Keep original on failure
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

    // Final save
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    console.log(`\n\n✅ Done! ${Object.keys(progress).length}/${total} processed, ${errors} errors`);

    // Apply to DB
    console.log('Applying to database.js...');
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
    console.log('✅ database.js updated!');
}

main().catch(err => {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({}, null, 2));
    console.error('\nFatal error:', err.message);
    process.exit(1);
});

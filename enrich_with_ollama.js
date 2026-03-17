/**
 * enrich_with_ollama.js
 *
 * Uses Ollama (local LLM - mistral:7b) to generate for each animal:
 * - desc, weight, size, habitat, finding, photo
 *
 * NO rate limits! Runs entirely on your GPU.
 * Usage: node enrich_with_ollama.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'mistral';
const DB_FILE = path.join(__dirname, 'database.js');
const PROGRESS_FILE = path.join(__dirname, 'enrich_progress.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callOllama(prompt) {
    const res = await axios.post(OLLAMA_URL, {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.7, num_predict: 600 }
    }, { timeout: 60000 });
    return res.data.message.content;
}

function buildPrompt(animal) {
    return `Tu es un naturaliste passionné qui écrit pour une app style Pokédex pour photographes amateurs français.

Pour l'animal suivant, génère un JSON avec ces champs (réponds UNIQUEMENT avec le JSON brut, AUCUN texte avant ou après) :
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
    console.log(`Model: ${MODEL} (local Ollama)`);
    console.log(`Estimated time: ~${Math.ceil(remaining * 3 / 60)} minutes\n`);

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
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const raw = await callOllama(buildPrompt(animal));
                let jsonStr = raw.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
                }
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
                if (attempt < 3) {
                    await sleep(1000);
                } else {
                    errors++;
                    console.error(`\n❌ ${animal.name}: ${err.message}`);
                }
            }
        }

        if (!success && !progress[animal.id]) {
            progress[animal.id] = {
                desc: animal.desc,
                weight: '?',
                size: '?',
                habitat: animal.stats?.habitat || 'Sauvage',
                finding: '',
                photo: '',
            };
        }
        // No delay needed — local model, no rate limits!
    }

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
    console.error('\nFatal error:', err.message);
    process.exit(1);
});

/**
 * recalibrate_rarity.js
 * 
 * Uses Ollama (Mistral 7B) to re-evaluate the rarity (1-10) of all animals.
 * Perspective: Photographer in Paris Suburbs.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OLLAMA_URL = 'http://127.0.0.1:11434/api/chat';
const MODEL = 'mistral';
const DB_FILE = path.join(__dirname, 'database.js');

async function callOllama(prompt) {
    const res = await axios.post(OLLAMA_URL, {
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { temperature: 0.1, num_predict: 10 } // Low temperature for consistency
    }, { timeout: 30000 });
    return res.data.message.content;
}

function buildPrompt(animal) {
    return `Tu es un expert naturaliste aidant un photographe habitant en banlieue de Paris.
Évalue la rareté de rencontre de l'animal suivant sur une échelle de 1 à 10.
Réponds UNIQUEMENT par un chiffre entier entre 1 et 10.

ÉCHELLE DE RÉFÉRENCE:
1: Très commun, visible tous les jours (Ex: Chat, Chien, Pigeon de ville, Moineau).
2: Commun dans les jardins ou parcs urbains (Ex: Écureuil roux, Pie, Corneille).
3: Animal sauvage commun, visible avec un peu d'attention (Ex: Lapin de garenne, Renard en parc, Hérisson).
4: Animal de forêt d'Île-de-France (Ex: Biche, Cerf, Sanglier à Rambouillet ou Fontainebleau).
5-6: Nécessite un voyage en France ou Europe (Ex: Bouquetin des Alpes, Flamant rose en Camargue, Phoque en Baie de Somme).
7-8: Animal sauvage d'autres continents, nécessite un voyage international (Ex: Lion, Éléphant, Zèbre).
9-10: Exceptionnel, espèce rare, menacée ou vivant dans des zones très reculées (Ex: Léopard des neiges, Panda roux).

Animal: ${animal.name} (${animal.scientificName})
Habitat typique: ${animal.stats.habitat}

Score (1-10):`;
}

async function main() {
    console.log("Reading database...");
    const txt = fs.readFileSync(DB_FILE, 'utf8');
    const start = txt.indexOf('[');
    const end = txt.lastIndexOf(']');
    const db = JSON.parse(txt.slice(start, end + 1));

    console.log(`Recalibrating ${db.length} animals...`);

    let processed = 0;
    for (const animal of db) {
        processed++;
        let success = false;
        let attempts = 0;

        while (!success && attempts < 3) {
            attempts++;
            try {
                const response = await callOllama(buildPrompt(animal));
                const match = response.match(/\d+/);
                if (match) {
                    const newRarity = Math.max(1, Math.min(10, parseInt(match[0])));
                    animal.stats.rarity = newRarity;
                    success = true;
                }
            } catch (err) {
                console.error(`Error for ${animal.name}: ${err.message}`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (processed % 10 === 0 || processed === db.length) {
            process.stdout.write(`\rProgress: ${processed}/${db.length}...`);
        }
    }

    console.log("\nSaving database...");
    let out = 'window.DB = [\n';
    for (let i = 0; i < db.length; i++) {
        out += JSON.stringify(db[i], null, 4);
        if (i < db.length - 1) out += ',\n';
    }
    out += '\n];\n';
    fs.writeFileSync(DB_FILE, out, 'utf8');
    console.log("✅ Rarity recalibration complete!");
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

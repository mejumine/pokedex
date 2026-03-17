const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
// iNaturalist taxon IDs for each class:
// Mammalia = 40151, Aves = 3, Reptilia = 26036, Amphibia = 20978, Insecta = 47158, Arachnida = 47119
const CATEGORIES = [
    { name: 'mammal', taxonId: 40151, count: 600 },
    { name: 'bird', taxonId: 3, count: 600 },
    { name: 'reptile', taxonId: 26036, count: 600 },
    { name: 'amphibian', taxonId: 20978, count: 600 },
    { name: 'insect', taxonId: 47158, count: 600 },
];

const OUTPUT_FILE = path.join(__dirname, 'database_massive.js');
const DELAY_BETWEEN_REQUESTS = 100; // ms to avoid rate limiting
const WIKI_DELAY = 100; // ms for wikipedia

// Global array to hold our results
let finalDatabase = [];

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean text by stripping HTML tags
 */
function stripHtml(text) {
    if (!text) return "";
    return text.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * MAP rarity to 1-5
 */
function calculateRarity(rank, totalInCategory) {
    const percentage = rank / totalInCategory;
    if (percentage <= 0.2) return 1;
    if (percentage <= 0.4) return 2;
    if (percentage <= 0.6) return 3;
    if (percentage <= 0.8) return 4;
    return 5;
}

/**
 * Find weight and size using RegEx on French descriptions
 */
function extractStat(text, regex) {
    const match = text.match(regex);
    if (match && match[1]) {
        return match[1].trim()
            .replace("kilogrammes", "kg")
            .replace("grammes", "g")
            .replace("centimètres", "cm")
            .replace("mètres", "m")
            .replace(" tonnes", "t");
    }
    return "?";
}

/**
 * Process HTML text from Wikipedia to find stats
 */
function processWikipediaPage(htmlString) {
    let rawText = stripHtml(htmlString);

    // Cleanup massive citations or phonetic blocks
    rawText = rawText.replace(/\[\d+\]/g, ''); // Remove [1], [2] etc

    // Slice down to ~400 characters max for the Pokedex UI
    let desc = rawText.substring(0, 350);
    if (rawText.length > 350) desc += "...";

    // If empty
    if (desc.trim() === "") desc = "Espèce observée dans le monde entier.";

    // Simple Regex Heuristics to find weight and size
    let weight = extractStat(rawText, /(?:pèse|poids)[\sde]*(?:entre\s)?([\d.,]+\s*(?:kg|g|kilogrammes|grammes|tonnes))/i);
    let size = extractStat(rawText, /(?:mesure|taille|envergure|longueur)[\sde]*(?:entre\s)?([\d.,]+\s*(?:cm|m|mm|centimètres|mètres|millimètres))/i);

    // Habitat basic keyword matching
    let habitat = "Sauvage";
    const textLower = rawText.toLowerCase();
    if (textLower.includes("domestique") || textLower.includes("élevage") || textLower.includes("animal de compagnie")) habitat = "DOM";
    else if (textLower.includes("zoo") || textLower.includes("captivité")) habitat = "Zoo";

    return { desc, weight, size, habitat };
}

/**
 * Fetch Wikipedia summary and extract stats for a specific animal
 */
async function enrichWithWikipedia(animalName) {
    try {
        const query = encodeURIComponent(animalName);
        const url = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&titles=${query}&format=json&redirects=1`;

        const response = await axios.get(url, { headers: { 'User-Agent': 'PokedexApp/1.0 (contact@ex.com)' } });

        const pages = response.data.query ? response.data.query.pages : null;
        if (!pages || Object.keys(pages)[0] == "-1") {
            return { desc: "Aucune description trouvée.", weight: "?", size: "?", habitat: "Sauvage" };
        }

        const pageId = Object.keys(pages)[0];
        const extractHtml = pages[pageId].extract;
        return processWikipediaPage(extractHtml);

    } catch (err) {
        return { desc: "Erreur lors du chargement de la description.", weight: "?", size: "?", habitat: "Sauvage" };
    }
}

/**
 * Fetch top N observed species from iNaturalist globally
 */
async function fetchINaturalistTopSpecies(categoryName, taxonId, targetCount) {
    let results = [];
    let page = 1;
    // iNaturalist iconic_taxa values (exact strings expected by species_counts):
    const iconicTaxaMap = {
        mammal: 'Mammalia',
        bird: 'Aves',
        reptile: 'Reptilia',
        amphibian: 'Amphibia',
        insect: 'Insecta,Arachnida'
    };
    const iconicTaxa = iconicTaxaMap[categoryName];

    try {
        // Use /observations/species_counts which properly supports iconic_taxa filtering
        while (results.length < targetCount && page <= 10) {
            const url = `https://api.inaturalist.org/v1/observations/species_counts?iconic_taxa=${encodeURIComponent(iconicTaxa)}&rank=species&per_page=500&page=${page}&order_by=observations_count&order=desc&locale=fr`;

            const response = await axios.get(url);

            if (!response.data.results || response.data.results.length === 0) {
                break;
            }

            // species_counts returns { count, taxon } objects
            for (let resultItem of response.data.results) {
                if (results.length >= targetCount) break;
                const taxon = resultItem.taxon;

                // We need a french name or generic name, and a photo
                let name = taxon.preferred_common_name;
                if (!name && taxon.names && taxon.names.length > 0) {
                    const frNameObj = taxon.names.find(n => n.locale === 'fr');
                    if (frNameObj) name = frNameObj.name;
                }

                // Fallback to scientific if really no common name found
                if (!name) name = taxon.name;

                // Capitalize first letter
                name = name.charAt(0).toUpperCase() + name.slice(1);

                // Get best photo
                let imgRef = null;
                if (taxon.default_photo && taxon.default_photo.medium_url) {
                    imgRef = taxon.default_photo.medium_url.replace('medium', 'large');
                }

                if (imgRef) {
                    results.push({
                        name: name,
                        scientificName: taxon.name,
                        englishName: taxon.english_common_name || "",
                        type: categoryName,
                        imgRef: imgRef,
                    });
                }
            }
            page++;
            await sleep(DELAY_BETWEEN_REQUESTS);
        }

        return results;

    } catch (err) {
        console.error(`❌ Error fetching iNaturalist data for ${categoryName}:`, err.message);
        return results;
    }
}

/**
 * Main execution flow
 */
async function main() {
    console.log("🚀 Starting Massive DB Build...");

    let globalIdCounter = 1;

    for (let category of CATEGORIES) {
        console.log(`\n=== Fetching top ${category.count} species for ${category.name} ===`);
        const speciesList = await fetchINaturalistTopSpecies(category.name, category.taxonId, category.count);

        console.log(`📚 Enriching ${speciesList.length} ${category.name}s with Wikipedia...`);
        let count = 0;

        for (let animal of speciesList) {
            count++;
            process.stdout.write(`\rProcessing [${count}/${speciesList.length}] : ${animal.name.substring(0, 30)}${' '.repeat(20)}`);

            // Try French name first, then scientific name
            let wikiData = await enrichWithWikipedia(animal.name);
            if (wikiData.desc === "Aucune description trouvée." || wikiData.desc.startsWith("Erreur")) {
                wikiData = await enrichWithWikipedia(animal.scientificName);
            }

            finalDatabase.push({
                id: `dex_${globalIdCounter}`,
                num: `#${String(globalIdCounter).padStart(4, '0')}`,
                name: animal.name,
                type: category.name, // FIXED: use category.name instead of animal.type
                imgRef: animal.imgRef,
                objectPosition: "center", // default
                stats: {
                    weight: wikiData.weight,
                    size: wikiData.size,
                    habitat: wikiData.habitat,
                    rarity: calculateRarity(count, speciesList.length)
                },
                desc: wikiData.desc,
                scientificName: animal.scientificName,
                englishName: animal.englishName,
            });
            globalIdCounter++;
            await sleep(WIKI_DELAY); // Rate limit respect
        }
        console.log(`\n✅ Finished enriching ${category.name}.`);
    }

    // Write array to database.js
    console.log(`\n💾 Writing ${finalDatabase.length} animals to database_massive.js...`);

    let fileContent = `window.DB = [\n`;
    for (let i = 0; i < finalDatabase.length; i++) {
        fileContent += JSON.stringify(finalDatabase[i], null, 4);
        if (i < finalDatabase.length - 1) fileContent += ",\n";
    }
    fileContent += `\n];\n`;

    fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf8');

    console.log("🎉 SUCCESS! Database built.");
}

// RUN
main();

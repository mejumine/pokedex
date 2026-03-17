const https = require('https');
const fs = require('fs');

const animals = [
    // --- OISEAUX (30) ---
    "Rossignol philomèle", "Bouvreuil pivoine", "Chardonneret élégant", "Pinson des arbres", "Verdier d'Europe",
    "Tourterelle turque", "Martinet noir", "Geai des chênes", "Coucou gris", "Sittelle torchepot",
    "Grimpereau des jardins", "Bergeronnette grise", "Étourneau sansonnet", "Martin-triste", "Mainate religieux",
    "Casoar à casque", "Émeu d'Australie", "Kiwi austral", "Kakapo", "Kookaburra",
    "Harpie féroce", "Pygargue à tête blanche", "Balbuzard pêcheur", "Gypaète barbu", "Messager sagittaire",
    "Marabout d'Afrique", "Tantale ibis", "Jabiru d'Amérique", "Héron garde-bœufs", "Faucon pèlerin",

    // --- AMPHIBIENS (10) ---
    "Gymnophiona", "Protée anguillard", "Salamandre géante de Chine", "Grenouille taureau", "Alyte accoucheur",
    "Sonneur à ventre jaune", "Pipa pipa", "Centrolenidae", "Dyscophus antongilii", "Dendrobates azureus",

    // --- REPTILES (13) ---
    "Basiliscus plumifrons", "Moloch horridus", "Monstre de Gila", "Tuatara", "Tortue alligator",
    "Dendroaspis polylepis", "Bitis arietans", "Serpent corail", "Anolis carolinensis", "Tortue luth",
    "Trachemys scripta elegans", "Correlophus ciliatus", "Varan du Nil",

    // --- INSECTES (20) ---
    "Lucanus cervus", "Melolontha", "Doryphore", "Cerambycidae", "Dynaste Hercule", "Pyrrhocoris apterus",
    "Chrysopidae", "Syrphidae", "Bombyliidae", "Acherontia atropos", "Aglais io", "Papilio machaon",
    "Nymphalis antiopa", "Gryllotalpa gryllotalpa", "Siphonaptera", "Pediculus humanus", "Glomeris",
    "Oniscidea", "Lepisma saccharina", "Blattaria"
];

function fetchImage(animalName) {
    return new Promise((resolve) => {
        const url = `https://fr.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(animalName)}&gsrlimit=1&prop=pageimages&pithumbsize=500&format=json&origin=*`;

        https.get(url, { headers: { 'User-Agent': 'PokedexApp/1.0 (contact@example.com)' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.query || !json.query.pages) {
                        console.log(`❌ No results for ${animalName}`);
                        resolve(null);
                        return;
                    }
                    const pages = json.query.pages;
                    const pageId = Object.keys(pages)[0];
                    const page = pages[pageId];
                    const imgUrl = page.thumbnail ? page.thumbnail.source : null;

                    if (imgUrl) {
                        console.log(`✅ Found ${animalName}: ${imgUrl}`);
                        resolve({ name: animalName, img: imgUrl });
                    } else {
                        console.log(`⚠️ Page for ${animalName} but NO image`);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(e);
                    resolve(null);
                }
            });
        }).on('error', (e) => resolve(null));
    });
}

async function run() {
    const results = {};
    for (const animal of animals) {
        const data = await fetchImage(animal);
        if (data) results[animal] = data.img;
        await new Promise(r => setTimeout(r, 50));
    }
    fs.writeFileSync('c:\\Users\\Quentin\\.gemini\\antigravity\\scratch\\pokedex\\batch_5_images.json', JSON.stringify(results, null, 4));
    console.log(`Done! Written to batch_5_images.json`);
}

run();

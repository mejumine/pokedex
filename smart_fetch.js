const https = require('https');
const fs = require('fs');

const animals = [
    // MAMMALS
    "Chien", "Chat", "Lapin", "Hamster", "Cochon d'Inde", "Vache", "Taureau", "Cheval", "Poney", "Âne", "Cochon", "Mouton", "Chèvre",
    "Lion", "Tigre", "Léopard", "Guépard", "Panthère noire", "Éléphant", "Rhinocéros", "Hippopotame", "Girafe", "Zèbre", "Gorille", "Chimpanzé", "Orang-outan", "Lémurien", "Panda", "Panda roux", "Koala", "Kangourou", "Ours polaire", "Ours brun", "Loup", "Renard", "Sanglier", "Cerf", "Biche", "Chevreuil", "Blaireau", "Castor", "Loutre", "Hérisson", "Écureuil", "Marmotte", "Lièvre", "Belette", "Taupe", "Chauve-souris",
    "Chameau", "Dromadaire", "Lama", "Alpaga", "Paresseux", "Suricate", "Hyène", "Lycaon", "Fennec", "Tapir", "Fourmilier", "Tatou", "Porc-épic", "Moufette", "Raton laveur", "Ornithorynque", "Échidné", "Wombat", "Diable de Tasmanie", "Bison", "Buffle", "Yack", "Élan", "Renne", "Gazelle", "Antilope", "Impala", "Gnou", "Oryx", "Koudou", "Springbok", "Okapi", "Zèbre de Grévy", "Phacochère", "Mangouste", "Serval", "Caracal", "Lynx", "Cougar", "Jaguar", "Ocelot", "Panthère des neiges", "Tigre blanc", "Lion blanc", "Loup arctique",

    // BIRDS
    "Poule", "Coq", "Canard", "Oie", "Dindon", "Pigeon", "Moineau", "Merle", "Pie", "Corbeau", "Hirondelle", "Rouge-gorge", "Mésange", "Pic-vert", "Hibou", "Chouette", "Aigle", "Faucon", "Vautour", "Cygne", "Héron", "Mouette", "Martin-pêcheur", "Perroquet", "Flamant rose", "Pingouin", "Manchot", "Autruche", "Paon",
    "Toucan", "Ara", "Cacatoès", "Perruche", "Colibri", "Pélican", "Albatros", "Goéland", "Macareux", "Fou de Bassan", "Condor", "Buse", "Épervier", "Chouette effraie", "Grand-duc", "Cigogne", "Grue", "Ibis", "Spatule", "Héron cendré", "Aigrette", "Butor", "Cormoran", "Plongeon", "Grèbe", "Faisan", "Perdrix", "Caille", "Tétras", "Lagopède", "Otarie", "Morse", "Narval", "Béluga",

    // REPTILES & AMPHIBIANS
    "Crocodile", "Alligator", "Caïman", "Gavial", "Tortue géante", "Tortue de Floride", "Tortue luth", "Tortue verte", "Serpent", "Python", "Boa", "Anaconda", "Cobra", "Vipère", "Couleuvre", "Mamba", "Lézard", "Iguane", "Caméléon", "Gecko", "Varan", "Dragon de Komodo", "Scinque", "Orvet", "Grenouille", "Crapaud", "Salamandre", "Triton", "Axolotl", "Rainette", "Dendrobate",

    // INSECTS & ARACHNIDS
    "Papillon", "Abeille", "Guêpe", "Bourdon", "Fourmi", "Termite", "Mouche", "Moustique", "Taon", "Coccinelle", "Scarabée", "Hanneton", "Lucane", "Gendarme", "Criquet", "Sauterelle", "Grillon", "Mante religieuse", "Phasme", "Libellule", "Demoiselle", "Punaise", "Cigale", "Blatte", "Perce-oreille", "Araignée", "Mygale", "Tarentule", "Veuve noire", "Recluse", "Scorpion", "Tique", "Acarien", "Mille-pattes", "Scolopendre",

    // AQUATIC
    "Requin", "Requin marteau", "Requin blanc", "Requin baleine", "Dauphin", "Orque", "Baleine", "Cachalot", "Marsouin", "Méduse", "Pieuvre", "Calamar", "Seiche", "Nautile", "Poisson clown", "Chirurgien", "Hippocampe", "Raie", "Raie manta", "Anguille", "Murène", "Barracuda", "Thon", "Espadon", "Marline", "Morue", "Saumon", "Truite", "Carpe", "Brochet", "Silure", "Poisson rouge", "Combattant", "Guppy", "Tetra", "Scalaire", "Discus", "Crevette", "Crabe", "Homard", "Langouste", "Écrevisse", "Bernard-l'ermite", "Étoile de mer", "Oursin", "Concombre de mer", "Corail", "Anémone"
];

function fetchImage(animalName) {
    return new Promise((resolve) => {
        // Use generator=search to find the most relevant page if exact match fails
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
                        console.log(`⚠️ Page found but NO image for ${animalName}`);
                        resolve(null);
                    }
                } catch (e) {
                    console.error(`Error parsing ${animalName}: ${e}`);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error(`Error fetching ${animalName}: ${e}`);
            resolve(null);
        });
    });
}

async function run() {
    const results = {};

    for (const animal of animals) {
        const data = await fetchImage(animal);
        if (data) {
            results[animal] = data.img;
        }
        await new Promise(r => setTimeout(r, 50)); // Fast batch
    }

    fs.writeFileSync('c:\\Users\\Quentin\\.gemini\\antigravity\\scratch\\pokedex\\images_map.json', JSON.stringify(results, null, 4));
    console.log(`Done! Map written to images_map.json`);
}

run();

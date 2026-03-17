const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

const FIXES = {
    // Mammals
    "Chien": "Canis lupus familiaris",
    "Loup": "Canis lupus",
    "Loup arctique": "Canis lupus arctos",
    "Vache": "Bos taurus",
    "Taureau": "Bos taurus", // Same species, distinct gender visual usually handled by search but same Taxon
    "Cheval": "Equus caballus",
    "Poney": "Equus ferus caballus", // Technically same, but distinct entry
    "Zèbre": "Equus quagga",
    "Zèbre de Grévy": "Equus grevyi",
    "Suricate": "Suricata suricatta",
    "Mangouste": "Herpestidae", // Family
    "Antilope": "Antilopinae",
    "Bison": "Bison bison",
    "Gazelle": "Gazella",
    "Narval": "Monodon monoceros",
    "Beluga": "Delphinapterus leucas",
    "Orque": "Orcinus orca", // Check if was duplicate

    // Birds
    "Coq": "Gallus gallus",
    "Poule": "Gallus gallus domesticus",
    "Tourterelle": "Streptopelia decaocto",
    "Perroquet": "Psittacidae",
    "Perruche": "Melopsittacus undulatus",
    "Pélican": "Pelecanus onocrotalus",
    "Ibis": "Eudocimus ruber", // Scarlet Ibis usually expected? Or Threskiornis
    "Casoar": "Casuarius casuarius",
    "Émeu": "Dromaius novaehollandiae",

    // Insects/Arthropods (MAJOR FIXES NEEDED)
    "Abeille": "Apis mellifera",
    "Fourmi": "Lasius niger", // Specific common ant
    "Coccinelle": "Coccinella septempunctata",
    "Scarabée": "Scarabaeus sacer", // Classic dung beetle
    "Hanneton": "Melolontha melolontha",
    "Cigale": "Cicada orni",
    "Punaise": "Palomena prasina",
    "Puce": "Ctenocephalides felis",
    "Sauterelle": "Tettigonia viridissima",
    "Grillon": "Gryllus campestris",
    "Termite": "Reticulitermes",
    "Blatte": "Blattella germanica",
    "Mouche": "Musca domestica",
    "Moustique": "Culicidae",
    "Libellule": "Anisoptera",
    "Papillon": "Lepidoptera", // Keep broad? Or specific?
    "Machaon": "Papilio machaon",

    // Marine
    "Méduse": "Aurelia aurita",
    "Anémone de mer": "Actinia equina", // Correct name in DB might be "Anémone"
    "Anémone": "Actinia equina",
    "Corail": "Anthozoa"
};

const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

let updates = 0;
db.forEach(item => {
    // Check direct name match
    if (FIXES[item.name]) {
        // Only update if different
        if (item.scientificName !== FIXES[item.name]) {
            console.log(`Fixing ${item.name}: ${item.scientificName} -> ${FIXES[item.name]}`);
            item.scientificName = FIXES[item.name];
            updates++;
        }
    }
});

if (updates > 0) {
    const newContent = `window.DB = ${JSON.stringify(db, null, 4)};`;
    fs.writeFileSync(DB_PATH, newContent, 'utf8');
    console.log(`✅ Applied ${updates} scientific name fixes.`);
} else {
    console.log("No updates needed.");
}

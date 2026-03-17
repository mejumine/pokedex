const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

const FIXES = {
    // Missing
    "Tigre blanc": "Panthera tigris", // Variant, map to Tiger
    "Pipa pipa": "Pipa pipa", // It was missing but name IS the scientific name

    // Generic Fixes - Mammals
    "Hamster": "Cricetus cricetus", // Common Hamster
    "Loutre": "Lutra lutra",
    "Écureuil": "Sciurus vulgaris",
    "Lièvre": "Lepus europaeus",
    "Chauve-souris": "Pipistrellus pipistrellus", // Common Pipistrelle
    "Fennec": "Vulpes zerda",
    "Léopard": "Panthera pardus",
    "Guépard": "Acinonyx jubatus",
    "Hippopotame": "Hippopotamus amphibius",
    "Kangourou": "Macropus giganteus",
    "Oryx": "Oryx gazella",
    "Tapir": "Tapirus terrestris",
    "Élan": "Alces alces",
    "Renne": "Rangifer tarandus",
    "Impala": "Aepyceros melampus",
    "Okapi": "Okapia johnstoni",
    "Phacochère": "Phacochoerus africanus",
    "Serval": "Leptailurus serval",
    "Caracal": "Caracal caracal",
    "Lynx": "Lynx lynx",
    "Ocelot": "Leopardus pardalis",
    "Musaraigne": "Sorex araneus",
    "Loir": "Glis glis",
    "Lion": "Panthera leo",
    "Éléphant": "Loxodonta africana",
    "Gorille": "Gorilla gorilla",
    "Koala": "Phascolarctos cinereus",
    "Paresseux": "Bradypus variegatus",
    "Dauphin": "Tursiops truncatus",
    "Baleine": "Balaenoptera musculus", // Blue Whale
    "Cachalot": "Physeter macrocephalus",

    // Birds
    "Moineau": "Passer domesticus",
    "Mésange": "Parus major",
    "Hirondelle": "Hirundo rustica",
    "Aigle": "Aquila chrysaetos", // Golden Eagle
    "Autruche": "Struthio camelus",
    "Manchot": "Aptenodytes forsteri", // Emperor
    "Pingouin": "Alca torda",
    "Hibou": "Bubo bubo", // Eagle Owl
    "Cygne": "Cygnus olor",
    "Martin-pêcheur": "Alcedo atthis",
    "Toucan": "Ramphastos toco",
    "Colibri": "Archilochus colubris", // Ruby-throated
    "Albatros": "Diomedea exulans",
    "Mouette": "Chroicocephalus ridibundus",
    "Grand-duc": "Bubo bubo",
    "Spatule": "Platalea leucorodia",
    "Aigrette": "Egretta garzetta",
    "Cormoran": "Phalacrocorax carbo",
    "Perdrix": "Perdix perdix",
    "Bouvreuil": "Pyrrhula pyrrhula",
    "Verdier": "Chloris chloris",
    "Martinet": "Apus apus",
    "Coucou": "Cuculus canorus",
    "Sittelle": "Sitta europaea",
    "Grimpereau": "Certhia brachydactyla",
    "Bergeronnette": "Motacilla alba",
    "Étourneau": "Sturnus vulgaris",
    "Kakapo": "Strigops habroptila",
    "Kookaburra": "Dacelo novaeguineae",
    "Pygargue": "Haliaeetus leucocephalus",
    "Balbuzard": "Pandion haliaetus",
    "Gypaète": "Gypaetus barbatus",
    "Marabout": "Leptoptilos crumenifer",
    "Tantale": "Mycteria ibis",
    "Jabiru": "Jabiru mycteria",
    "Rossignol": "Luscinia megarhynchos",
    "Pinson": "Fringilla coelebs",

    // Reptiles/Amphibians
    "Iguane": "Iguana iguana",
    "Murène": "Muraena helena",
    "Orvet": "Anguis fragilis",
    "Crocodile": "Crocodylus niloticus",
    "Cécilie": "Ichthyophis glutinosus", // Example species
    "Protée": "Proteus anguinus",
    "Sonneur": "Bombina bombina",
    "Grenouille de verre": "Hyalinobatrachium fleischmanni",
    "Moloch": "Moloch horridus",
    "Tuatara": "Sphenodon punctatus",
    "Serpent corail": "Micrurus fulvius",
    "Anolis": "Anolis carolinensis",
    "Triton": "Triturus cristatus",
    "Grenouille taureau": "Lithobates catesbeianus",
    "Alyte accoucheur": "Alytes obstetricans",
    "Garde-bœufs": "Bubulcus ibis",

    // Insects/Arthropods
    "Papillon": "Papilio machaon", // Representing generic butterfly
    "Libellule": "Anax imperator",
    "Criquet": "Schistocerca gregaria",
    "Moustique": "Aedes aegypti",
    "Bourdon": "Bombus terrestris",
    "Araignée": "Araneus diadematus",
    "Mygale": "Theraphosa blondi",
    "Scorpion": "Pandinus imperator",
    "Termite": "Reticulitermes lucifugus",
    "Taon": "Tabanus bovinus",
    "Perce-oreille": "Forficula auricularia",
    "Mille-pattes": "Julus terrestris",
    "Capricorne": "Cerambyx cerdo",
    "Chrysope": "Chrysoperla carnea",
    "Syrphe": "Episyrphus balteatus",
    "Bombyle": "Bombylius major",
    "Cloporte": "Armadillidium vulgare",
    "Lepisme": "Lepisma saccharina",
    "Machaon": "Papilio machaon", // Already specific but ensure

    // Fish/Marine
    "Requin marteau": "Sphyrna mokarran",
    "Hippocampe": "Hippocampus hippocampus",
    "Raie manta": "Manta birostris",
    "Poisson clown": "Amphiprion ocellaris",
    "Étoile de mer": "Asterias rubens",
    "Crabe": "Carcinus maenas",
    "Thon": "Thunnus thynnus",
    "Truite": "Salmo trutta",
    "Carpe": "Cyprinus carpio",
    "Brochet": "Esox lucius",
    "Crevette": "Palaemon serratus",
    "Langouste": "Palinurus elephas",
    "Bernard-l'ermite": "Pagurus bernhardus",
    "Oursin": "Paracentrotus lividus",
    "Corail": "Corallium rubrum",
    "Limace": "Arion rufus"
};

const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

let updates = 0;
db.forEach(item => {
    if (FIXES[item.name]) {
        if (item.scientificName !== FIXES[item.name]) {
            console.log(`Fixing ${item.name}: ${item.scientificName || 'MISSING'} -> ${FIXES[item.name]}`);
            item.scientificName = FIXES[item.name];
            updates++;
        }
    } else if (!item.scientificName) {
        // Log if we missed a missing one
        console.log(`⚠️ STILL MISSING: ${item.name}`);
    }
});

if (updates > 0) {
    const newContent = `window.DB = ${JSON.stringify(db, null, 4)};`;
    fs.writeFileSync(DB_PATH, newContent, 'utf8');
    console.log(`✅ Applied ${updates} detailed scientific name fixes.`);
} else {
    console.log("No updates needed.");
}

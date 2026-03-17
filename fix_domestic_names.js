const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');

const FIXES = {
    "Chèvre": "Capra hircus",
    "Mouton": "Ovis aries",
    "Hamster": "Cricetinae", // Hamsters subfamily
    "Marmotte": "Marmota marmota", // Alpine Marmot
    "Canard": "Anas platyrhynchos", // Mallard (wild ancestor, best match)
    "Sanglier": "Sus scrofa",
    "Cerf": "Cervus elaphus", // Red Deer (European) instead of White-tailed
    "Biche": "Cervus elaphus", // Female Red Deer
    "Chevreuil": "Capreolus capreolus",
    "Taupe": "Talpa europaea", // European Mole
    "Chauve-souris": "Chiroptera",
    "Pie": "Pica pica", // Eurasian Magpie
    "Geai": "Garrulus glandarius", // Eurasian Jay
    "Héron": "Ardea cinerea", // Grey Heron
    "Goéland": "Larus michahellis", // Yellow-legged Gull (common in Eu) or Larus argentatus
    "Lézard": "Podarcis muralis", // Common Wall Lizard
    "Mille-pattes": "Diplopoda",
    "Cloporte": "Oniscidea",
    "Glomeris": "Glomeris marginata",
    "Thon": "Thunnus",
    "Saumon": "Salmo salar"
};

const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

let updates = 0;
db.forEach(item => {
    if (FIXES[item.name]) {
        console.log(`Fixing ${item.name}: ${item.scientificName} -> ${FIXES[item.name]}`);
        item.scientificName = FIXES[item.name];
        updates++;
    }
});

if (updates > 0) {
    const newContent = `window.DB = ${JSON.stringify(db, null, 4)};`;
    fs.writeFileSync(DB_PATH, newContent, 'utf8');
    console.log(`✅ Applied ${updates} scientific name fixes.`);
} else {
    console.log("No updates needed.");
}

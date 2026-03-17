/**
 * Simple auditor to count Pexels vs Non-Pexels images in the final DB.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const dbContent = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const dbData = eval(dbMatch[1]);

let pexelsCount = 0;
let otherCount = 0;

dbData.forEach(animal => {
    if (animal.imgRef && animal.imgRef.includes('pexels.com')) {
        pexelsCount++;
    } else {
        otherCount++;
    }
});

console.log(`Total Animals: ${dbData.length}`);
console.log(`Pexels Images: ${pexelsCount} (${Math.round(pexelsCount / dbData.length * 100)}%)`);
console.log(`Other Sources: ${otherCount}`);

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const dbContent = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const dbData = eval(dbMatch[1]);

const failed = dbData.filter(animal => {
    return !animal.imgRef || (!animal.imgRef.includes('inaturalist.org') && !animal.imgRef.includes('inaturalist-open-data'));
});

console.log(`\nFound ${failed.length} animals without iNaturalist images:\n`);
failed.forEach(animal => {
    console.log(`- [${animal.id}] ${animal.name} (${animal.englishName || 'N/A'}) -> URL: ${animal.imgRef || 'EMPTY'}`);
});

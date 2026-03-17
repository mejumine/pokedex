const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const dbContent = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const dbData = eval(dbMatch[1]);

const urls = {};
const duplicates = [];

dbData.forEach(animal => {
    if (animal.imgRef) {
        if (urls[animal.imgRef]) {
            duplicates.push({
                url: animal.imgRef,
                animals: [urls[animal.imgRef].name, animal.name]
            });
        } else {
            urls[animal.imgRef] = animal;
        }
    }
});

console.log(JSON.stringify(duplicates, null, 2));

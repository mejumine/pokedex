const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const dbContent = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = dbContent.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const dbData = eval(dbMatch[1]);

const domains = {};

dbData.forEach(animal => {
    let domain = 'EMPTY';
    if (animal.imgRef) {
        try {
            const url = new URL(animal.imgRef);
            domain = url.hostname;
        } catch (e) {
            domain = 'INVALID';
        }
    }
    domains[domain] = (domains[domain] || 0) + 1;
});

console.log(JSON.stringify(domains, null, 2));

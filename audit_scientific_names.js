const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

const missing = db.filter(a => !a.scientificName);
console.log(`Total animals: ${db.length}`);
console.log(`Animals missing scientificName: ${missing.length}`);
console.log('\nFirst 10 missing:');
missing.slice(0, 10).forEach(a => console.log(`- ${a.name} (${a.type})`));

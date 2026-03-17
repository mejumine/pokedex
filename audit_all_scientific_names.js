const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

console.log(`Auditing ${db.length} entries...`);

const missing = [];
const singleWord = [];
const suspicious = []; // Catch-all for other potential issues

db.forEach(a => {
    if (!a.scientificName || a.scientificName.trim() === "") {
        missing.push(a.name);
    } else {
        const parts = a.scientificName.trim().split(' ');
        if (parts.length === 1) {
            singleWord.push(`${a.name} -> ${a.scientificName}`);
        }
        // Check for common placeholders or issues
        if (a.scientificName.includes("undefined") || a.scientificName.includes("null")) {
            suspicious.push(`${a.name} -> ${a.scientificName}`);
        }
    }
});

console.log(`\n--- MISSING (${missing.length}) ---`);
missing.forEach(n => console.log(`- ${n}`));

console.log(`\n--- SINGLE WORD / GENERIC (${singleWord.length}) ---`);
console.log("(These might be Family/Order names like 'Coleoptera' which we want to avoid if possible)");
singleWord.forEach(n => console.log(`- ${n}`));

console.log(`\n--- SUSPICIOUS (${suspicious.length}) ---`);
suspicious.forEach(n => console.log(`- ${n}`));

const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'database.js');
const content = fs.readFileSync(DB_PATH, 'utf8');
const dbMatch = content.match(/window\.DB\s*=\s*(\[[\s\S]*?\]);/);
const db = eval(dbMatch[1]);

const sciNameCounts = {};
const duplicates = {};

db.forEach(a => {
    if (!a.scientificName) return;
    if (!sciNameCounts[a.scientificName]) {
        sciNameCounts[a.scientificName] = [];
    }
    sciNameCounts[a.scientificName].push(a.name);
});

console.log("--- Scientific Name Duplicates ---");
Object.keys(sciNameCounts).forEach(sci => {
    if (sciNameCounts[sci].length > 1) {
        console.log(`[${sci}]: ${sciNameCounts[sci].join(', ')}`);
    }
});


const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.js');
const content = fs.readFileSync(dbPath, 'utf8');

// Mock window
const window = {};

// Evaluate the content (risky but effective for this simple file structure)
// We need to handle the fact that it might not be a module. 
// It assigns to window.DB. 
try {
    eval(content);
} catch (e) {
    console.error("Error evaluating database.js:", e);
}

const DB = window.DB;

if (!DB) {
    console.error("DB not found in window object.");
    process.exit(1);
}

const ids = new Map();
const names = new Map();
const duplicates = [];

DB.forEach((item, index) => {
    // Check ID
    if (ids.has(item.id)) {
        duplicates.push({ type: 'ID', value: item.id, index: index, originalIndex: ids.get(item.id), name: item.name });
    } else {
        ids.set(item.id, index);
    }

    // Check Name
    if (names.has(item.name)) {
        duplicates.push({ type: 'Name', value: item.name, index: index, originalIndex: names.get(item.name), id: item.id });
    } else {
        names.set(item.name, index);
    }
});

if (duplicates.length > 0) {
    console.log("Found duplicates:");
    duplicates.forEach(d => {
        console.log(`- Type: ${d.type}, Value: ${d.value}, Index: ${d.index} (Original: ${d.originalIndex}), Name: ${d.name || ''}, ID: ${d.id || ''}`);
    });
} else {
    console.log("No duplicates found.");
}

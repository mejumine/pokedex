const { execSync } = require('child_process');
const fs = require('fs');

const path = 'c:/Users/Quentin/.gemini/antigravity/scratch/pokedex/database.js';
const content = fs.readFileSync(path, 'utf8');
const window = {};
eval(content);
const db = window.DB;

console.log(`Checking ${db.length} images...`);

const results = [];
let okCount = 0;
let failCount = 0;

for (const animal of db) {
    if (!animal.imgRef) continue;

    // Check everything from #350 onwards (the recently updated batches)
    const num = parseInt(animal.num.replace('#', ''));
    if (num < 1) continue; // Check ALL now to be safe

    try {
        const cmd = `curl.exe -I -L -A "Mozilla/5.0" -s "${animal.imgRef}"`;
        const output = execSync(cmd).toString();
        const status = output.split('\n').filter(l => l.includes('HTTP/')).pop()?.trim() || 'No Status';

        if (status.includes(' 200') || status.includes(' 304')) {
            okCount++;
        } else {
            console.log(`FAILED: ${animal.num} ${animal.name} - ${status}`);
            results.push({ id: animal.id, num: animal.num, name: animal.name, url: animal.imgRef, status });
            failCount++;
        }
    } catch (e) {
        console.log(`ERROR: ${animal.num} ${animal.name} - ${e.message}`);
        results.push({ id: animal.id, num: animal.num, name: animal.name, url: animal.imgRef, error: e.message });
        failCount++;
    }
}

fs.writeFileSync('c:/Users/Quentin/.gemini/antigravity/scratch/pokedex/final_audit_results.json', JSON.stringify(results, null, 2));
console.log(`\nAudit complete.`);
console.log(`OK: ${okCount}`);
console.log(`FAILED: ${failCount}`);
console.log('Results saved to final_audit_results.json');

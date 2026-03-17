/**
 * Final DB trim + rarity overhaul
 *
 * Target totals (ending in 67 → 1667):
 *   Mammals:   500  (trim 99)
 *   Birds:     600  (keep all)
 *   Reptiles:  300  (trim 100)
 *   Amphibians: 167 (trim 201 — no need for 200 similar frogs)
 *   Insects:   100  (already trimmed, keep all)
 *   TOTAL:    1667
 *
 * Rarity (1-10) by percentage rank — much more aggressive scale
 * so only truly easy animals get R1.
 * Viewpoint: Paris-based photographer.
 *   R1  = top 0.6%  → domestic dog, cat, pigeon, sparrow
 *   R2  = top 3%    → duck, crow, squirrel, common rabbit
 *   R3  = top 9%    → hedgehog, fox, magpie, toad
 *   R4  = top 20%   → deer, great tit, grass snake, frog
 *   R5  = top 38%   → common species with some luck needed
 *   R6  = top 58%   → regional/forest species
 *   R7  = top 75%   → uncommon, need to travel or hike
 *   R8  = top 87%   → rarely seen, requires habitat knowledge
 *   R9  = top 95%   → very rare encounter
 *   R10 = top 100%  → exceptional / nearly impossible in Europe
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'database.js');
const txt = fs.readFileSync(FILE, 'utf8').replace('window.DB = ', '');
let db = JSON.parse(txt.replace(/;\s*$/, ''));

const LIMITS = {
    mammal: 500,
    bird: 600,
    reptile: 300,
    amphibian: 167,
    insect: 100,
};

// Trim each category (keep the most observed = most relevant to photograph)
const result = [];
for (const [cat, limit] of Object.entries(LIMITS)) {
    const members = db.filter(a => a.type === cat);
    const kept = members.slice(0, limit);
    result.push(...kept);
    console.log(`${cat}: ${members.length} → ${kept.length}`);
}

// Aggressive non-linear rarity scale
function rarityFromRank(rank, total) {
    const pct = rank / total;
    if (pct <= 0.006) return 1;   // top 0.6% — the most trivial to photograph
    if (pct <= 0.030) return 2;   // top 3%
    if (pct <= 0.090) return 3;   // top 9%
    if (pct <= 0.200) return 4;   // top 20%
    if (pct <= 0.380) return 5;   // top 38%
    if (pct <= 0.580) return 6;   // top 58%
    if (pct <= 0.750) return 7;   // top 75%
    if (pct <= 0.870) return 8;   // top 87%
    if (pct <= 0.950) return 9;   // top 95%
    return 10;
}

for (const cat of Object.keys(LIMITS)) {
    const members = result.filter(a => a.type === cat);
    const total = members.length;
    members.forEach((animal, i) => {
        animal.stats.rarity = rarityFromRank(i + 1, total);
    });
    const dist = {};
    members.forEach(a => { dist[a.stats.rarity] = (dist[a.stats.rarity] || 0) + 1; });
    const distStr = Object.entries(dist).sort(([a], [b]) => +a - +b).map(([k, v]) => `R${k}:${v}`).join(' ');
    // Show first 3 animals per rarity 1
    const r1 = members.filter(a => a.stats.rarity === 1).map(a => a.name).join(', ');
    const r2 = members.filter(a => a.stats.rarity === 2).slice(0, 3).map(a => a.name).join(', ');
    console.log(`  ${cat} [${total}]: ${distStr}`);
    console.log(`    R1: ${r1}`);
    console.log(`    R2 (sample): ${r2}`);
}

// Write back
let out = 'window.DB = [\n';
for (let i = 0; i < result.length; i++) {
    out += JSON.stringify(result[i], null, 4);
    if (i < result.length - 1) out += ',\n';
}
out += '\n];\n';

fs.writeFileSync(FILE, out, 'utf8');
console.log(`\n✅ Total: ${result.length} animals (should end in 67: ${result.length % 100 === 67 ? '✓' : '✗'})`);

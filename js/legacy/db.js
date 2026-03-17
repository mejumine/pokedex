// db.js
// @ts-ignore
const db = new Dexie('PokedexDB');

db.version(1).stores({
    animals: 'id, type, rarity',
    photos: '++id, animalId, date, rating'
});

window.PokedexDB = db;

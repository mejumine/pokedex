const fs = require('fs');
const txt = fs.readFileSync('database.js', 'utf8').replace('window.DB = ', '');
const db = eval(txt);
const types = [...new Set(db.map(x => x.type))];
console.log('Types found:', types);
types.forEach(t => console.log(t, ':', db.filter(x => x.type === t).length));
console.log('First 3 mammals:', db.filter(x => x.type === 'mammal').slice(0, 3).map(x => x.name));
console.log('First 3 birds:', db.filter(x => x.type === 'bird').slice(0, 3).map(x => x.name));

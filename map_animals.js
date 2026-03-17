const fs = require('fs');

// Mock window.DB to load database.js
global.window = {};
require('./database.js');
const db = global.window.DB;

const idsToFix = [
    1, 5, 6, 7, 8, 9, 10, 13, 14, 15, 16, 23, 24, 25,
    40, 48, 57, 74, 99, 93, 101, 102, 105, 104, 108, 111, 112, 114, 125,
    194, 187, 201, 231, 221, 301, 240, 303, 305, 306, 310, 311, 309, 313, 316, 318, 319, 320, 321, 322, 327, 330, 333, 336, 344, 346, 347, 349, 351, 354, 353, 355, 357, 356, 360, 362, 364, 365, 367, 366, 369, 368, 370, 376, 377, 379, 385, 363, 386, 387, 388, 389, 397, 401, 402, 406, 404, 408, 412, 414, 415, 420, 425, 426, 434, 433, 435, 436, 437, 438, 439, 440, 445, 449, 447, 450, 451, 452, 453, 454, 471, 478, 477, 479, 480, 481, 482, 483, 484, 485, 486, 487
];

const mapped = idsToFix.map(num => {
    const formattedNum = '#' + num.toString().padStart(3, '0');
    const animal = db.find(a => a.num === formattedNum);
    return animal ? { num: animal.num, name: animal.name, id: animal.id } : { num: formattedNum, name: 'NOT FOUND' };
});

fs.writeFileSync('animals_to_fix.json', JSON.stringify(mapped, null, 2));
console.log(`Found ${mapped.filter(a => a.name !== 'NOT FOUND').length} animals to fix out of ${idsToFix.length} requested.`);

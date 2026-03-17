const crypto = require('crypto');

const files = [
    { num: '#001', name: 'Chien', file: 'Golden_Retriever_standing_facing_left.jpg' },
    { num: '#005', name: 'Cochon d\'Inde', file: 'Guinea_pig_(Cavia_porcellus).jpg' },
    { num: '#006', name: 'Vache', file: 'Cow_standing_on_a_field.jpg' },
    { num: '#007', name: 'Taureau', file: 'Bull_standing.jpg' },
    { num: '#008', name: 'Cheval', file: 'Horse_standing_left.jpg' },
    { num: '#009', name: 'Poney', file: 'Pony_standing.jpg' },
    { num: '#010', name: 'Âne', file: 'A_donkey_standing.jpg' },
    { num: '#013', name: 'Chèvre', file: 'Goat_standing.jpg' },
    { num: '#014', name: 'Poule', file: 'Hen_standing.jpg' },
    { num: '#015', name: 'Coq', file: 'Rooster_standing.jpg' },
    { num: '#016', name: 'Canard', file: 'Mallard_duck.jpg' },
    { num: '#023', name: 'Sanglier', file: 'Wild_Boar_frontal.jpg' },
    { num: '#024', name: 'Cerf', file: 'Red_deer.jpg' },
    { num: '#025', name: 'Biche', file: 'Red_deer_female.jpg' }
];

function getUrl(filename) {
    const f = filename.replace(/ /g, '_');
    const hash = crypto.createHash('md5').update(f).digest('hex');
    const a = hash[0];
    const ab = hash.slice(0, 2);
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${a}/${ab}/${f}/500px-${f}`;
}

const results = files.map(f => ({
    num: f.num,
    name: f.name,
    url: getUrl(f.file)
}));

console.log(JSON.stringify(results, null, 2));

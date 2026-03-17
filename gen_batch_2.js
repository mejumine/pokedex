const crypto = require('crypto');

const files = [
    { num: '#026', file: 'Capreolus_capreolus_in_Hamburg.jpg' },
    { num: '#027', file: 'Rupicapra_rupicapra_01.jpg' },
    { num: '#028', file: 'Alpine_Ibex_(Capra_ibex).jpg' },
    { num: '#033', file: 'Red_squirrel_(49752671627).jpg' },
    { num: '#034', file: 'Erinaceus_europaeus_(Linnaeus,_1758).jpg' },
    { num: '#035', file: 'European_Badger_-_Meles_meles_-_Scotland_(53260881618).jpg' },
    { num: '#036', file: 'European_otter_02.jpg' },
    { num: '#039', file: 'Marmotte_Chamonix_2007_101_0112.JPG' },
    { num: '#040', file: 'European_Hare.jpg' },
    { num: '#041', file: 'Wild_Rabbit_Oryctolagus_cuniculus.jpg' },
    { num: '#045', file: 'Eurasian_wolf_2.jpg' },
    { num: '#046', file: 'Red_fox_standing.jpg' },
    { num: '#047', file: 'Bear-standing-zoo-jerusalem_Syrian_Brown_Bear_(Ursus_arctos_syriacus).jpg' },
    { num: '#051', file: 'Common_seal_Phoca_vitulina.jpg' },
    { num: '#052', file: 'California_sea_lion_Zalophus_californianus.jpg' },
    { num: '#053', file: 'Walrus_(Odobenus_rosmarus)_standing.jpg' },
    { num: '#056', file: 'Lynx_lynx_2.jpg' },
    { num: '#057', file: 'Felis_silvestris_silvestris_Luc_Viatour.jpg' },
    { num: '#061', file: 'Great_tit_facing_left.jpg' },
    { num: '#062', file: 'Erithacus_rubecula_with_cocked_head.jpg' },
    { num: '#063', file: 'House_sparrow_David_Raju_(2).jpg' },
    { num: '#064', file: 'Common_blackbird.jpg' },
    { num: '#065', file: 'Pica_pica_01.jpg' },
    { num: '#066', file: 'Corvus_corax_(Common_Raven),_Yosemite_NP,_CA,_US_-_Diliff.jpg' },
    { num: '#067', file: 'Hooded_Crow_standing.jpg' }
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
    url: getUrl(f.file)
}));

console.log(JSON.stringify(results, null, 2));

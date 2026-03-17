const crypto = require('crypto');

const files = [
    { num: '#040', file: 'European_Badger_-_Meles_meles_-_Scotland_(53260881618).jpg' },
    { num: '#048', file: 'Piep_de_vleermuis.jpg' },
    { num: '#057', file: 'Fennec_Fox_Vulpes_zerda.jpg' },
    { num: '#074', file: 'Blackbuck_Antilope_cervicapra_male_in_Kanha_2.jpg' },
    { num: '#093', file: 'Arctic_Wolf_standing.jpg' },
    { num: '#099', file: 'Feral_pigeon_standing.jpg' },
    { num: '#101', file: 'Common_blackbird.jpg' },
    { num: '#102', file: 'Pica_pica_01.jpg' },
    { num: '#104', file: 'Barn_swallow_in_Montezuma_(14460).jpg' },
    { num: '#105', file: 'Corvus_corax_(Common_Raven),_Yosemite_NP,_CA,_US_-_Diliff.jpg' },
    { num: '#108', file: 'Bubo_bubo_portrait.jpg' },
    { num: '#111', file: 'Peregrine_falcon_standing.jpg' },
    { num: '#112', file: 'European_herring_gull_standing.jpg' },
    { num: '#114', file: 'Picus_viridis_male.jpg' },
    { num: '#125', file: 'Psittacula_krameri_01.jpg' },
    { num: '#406', file: 'Common_chaffinch_standing.jpg' },
    { num: '#404', file: 'Eurasian_bullfinch_standing.jpg' },
    { num: '#408', file: 'Eurasian_collared_dove_standing.jpg' },
    { num: '#412', file: 'Eurasian_nuthatch_standing.jpg' },
    { num: '#414', file: 'White_wagtail_standing.jpg' },
    { num: '#415', file: 'Kuldnokk_-_Common_Starling_-_Sturnus_Vulgaris.jpg' },
    { num: '#420', file: 'Little_spotted_kiwi_standing.jpg' },
    { num: '#425', file: 'Osprey_standing.jpg' },
    { num: '#426', file: 'Gypaetus_barbatus_standing.jpg' }
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

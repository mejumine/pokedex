const crypto = require('crypto');

const files = [
    { num: '#020', file: 'Vulpes_vulpes_japonica1.jpg' },
    { num: '#021', file: 'Gray_Wolf_Standing_in_the_Snow_(23707637993).jpg' },
    { num: '#022', file: 'Ours_brun_parcanimalierpyrenees_1.jpg' },
    { num: '#023', file: 'Capreolus_capreolus_1_(Martin_Mecnarowski).jpg' },
    { num: '#024', file: 'Rupicapra_rupicapra_standing.jpg' },
    { num: '#025', file: 'Capra_ibex_ibex_–_Naturpark_Sparbach_–_03.jpg' },
    { num: '#056', file: 'Giant_Panda_(Ailuropoda_melanoleuca).jpg' },
    { num: '#059', file: 'Koala_standing_on_a_log.jpg' },
    { num: '#060', file: 'Feeding_three-toed_sloth_-_Papaver_April_2010-8a_cropped.jpg' },
    { num: '#075', file: 'Suricata.suricatta.6861-Meerkat_(Suricata_suricatta).jpg' },
    { num: '#076', file: 'Blue_Wildebeest_(Connochaetes_taurinus)_(45660677635).jpg' },
    { num: '#077', file: 'Oryx_gazella_-Etosha_National_Park,_Namibia-8.jpg' },
    { num: '#322', file: 'Panthera_pardus_standing.jpg' },
    { num: '#323', file: 'Acinonyx_jubatus_-Southern_Namibia-8.jpg' },
    { num: '#324', file: '081_White_rhinoceros_(male)_in_the_Kalahari_Desert_of_Namibia_Photo_by_Giles_Laurent.jpg' },
    { num: '#325', file: 'Hippopotamus_standing_near_water_-_DPLA_-_c50319f821a0a2507827b6e72b0928d0.jpg' },
    { num: '#361', file: 'African_buffalo_(Syncerus_caffer)_male_with_Oxpecker.jpg' },
    { num: '#362', file: 'A_bull_moose_stands_under_birch_tree.jpg' },
    { num: '#363', file: '20070818-0001-strolling_reindeer.jpg' },
    { num: '#364', file: 'Gazella-dorcas.jpg' },
    { num: '#365', file: 'Impala_Aepyceros_melampus.jpg' },
    { num: '#366', file: 'Okapi2.jpg' },
    { num: '#367', file: 'Zebra_zoo-leipzig.jpg' },
    { num: '#368', file: 'Muenster-100720-15883-Zoo.jpg' },
    { num: '#369', file: '171_Banded_mongoose_standing_at_sunset_in_Etosha_National_Park_Photo_by_Giles_Laurent.jpg' },
    { num: '#370', file: 'Standing_Serval_(4767893093).jpg' },
    { num: '#371', file: 'Caracal_Caracal-001.jpg' },
    { num: '#372', file: 'Lynx_lynx_-_05.jpg' },
    { num: '#373', file: '016_Ocelot_in_Encontro_das_Águas_State_Park_Photo_by_Giles_Laurent.jpg' },
    { num: '#374', file: 'Singapore_Zoo_Tigers_cropped.jpg' },
    { num: '#375', file: 'White_Lion.jpg' },
    { num: '#480', file: 'Brown_rat_in_precarious_situation.jpg' },
    { num: '#481', file: 'House_mouse.jpg' },
    { num: '#482', file: 'Sorex_araneus_-_Linzeux_1.jpg' },
    { num: '#483', file: 'Martes_foina_1.jpg' },
    { num: '#484', file: 'Glis_glis_03.jpg' }
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

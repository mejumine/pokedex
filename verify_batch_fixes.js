const { execSync } = require('child_process');

const candidates = {
    'Chien': ['Golden_Retriever.jpg', 'Dog_standing.jpg', 'Golden_Retriever_standing.jpg'],
    'Taureau': ['Bull.jpg', 'Adult_bull.jpg', 'Bull_standing_on_a_field.jpg'],
    'Cheval': ['Horse.jpg', 'Domestic_horse.jpg', 'Horse_standing.jpg'],
    'Poney': ['Pony.jpg', 'Shetland_pony.jpg', 'Pony_standing_on_grass.jpg'],
    'Chèvre': ['Goat.jpg', 'Domestic_goat.jpg', 'Goat_standing_on_a_rock.jpg'],
    'Poule': ['Hen.jpg', 'Gallus_gallus_domesticus.jpg', 'Brown_hen.jpg'],
    'Coq': ['Rooster.jpg', 'Cock.jpg', 'Rooster_crowing.jpg'],
    'Chevreuil': ['Capreolus_capreolus.jpg', 'Roe_deer.jpg'],
    'Chauve-souris': ['Bat.jpg', 'Flying_bat.jpg', 'Greater_mouse-eared_bat.jpg'],
    'Pigeon': ['Rock_Pigeon.jpg', 'Common_pigeon.jpg'],
    'Pie': ['Pica_pica.jpg', 'European_Magpie.jpg'],
    'Goéland': ['European_herring_gull.jpg', 'Herring_gull.jpg'],
    'Pic-vert': ['Picus_viridis.jpg', 'Green_woodpecker.jpg'],
    'Faucon': ['Peregrine_Falcon.jpg', 'Falcon.jpg']
};

for (const [animal, files] of Object.entries(candidates)) {
    console.log(`\nTesting ${animal}:`);
    for (const f of files) {
        try {
            const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=500`;
            const cmd = `curl.exe -I -L -A "Mozilla/5.0" -s "${url}"`;
            const output = execSync(cmd).toString();
            const status = output.split('\n').filter(l => l.includes('HTTP/')).pop()?.trim();
            if (status && (status.includes(' 200') || status.includes(' 304'))) {
                console.log(`  OK: ${f}`);
                break; // Found one!
            } else {
                console.log(`  FAIL: ${f} (${status})`);
            }
        } catch (e) {
            console.log(`  ERROR: ${f}`);
        }
    }
}

const { execSync } = require('child_process');

const candidates = {
    'Paresseux': ['Sloth.jpg', 'Brown-throated_sloth.jpg', 'Three-toed_sloth.jpg'],
    'Loup arctique': ['Arctic_Wolf.jpg', 'Canis_lupus_arctos.jpg'],
    'Suricate': ['Meerkat.jpg', 'Suricata_suricatta.jpg'],
    'Antilope': ['Blackbuck.jpg', 'Antilope_cervicapra.jpg']
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
                break;
            } else {
                console.log(`  FAIL: ${f} (${status})`);
            }
        } catch (e) {
            console.log(`  ERROR: ${f}`);
        }
    }
}

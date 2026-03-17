const { execSync } = require('child_process');

const files = [
    'Python_regius_1zz.jpg',
    'Ball_Python_(Python_regius).jpg',
    'Sturnus_vulgaris_-_Toulouse_-_2012-02-26_-_3.jpg',
    'Kuldnokk.jpg',
    'Common_Starling_Sturnus_vulgaris.jpg'
];

for (const f of files) {
    try {
        const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=500`;
        const cmd = `curl.exe -I -L -A "Mozilla/5.0" -s "${url}"`;
        const output = execSync(cmd).toString();
        const status = output.split('\n').filter(l => l.includes('HTTP/')).pop();
        console.log(`${f} : ${status?.trim()}`);
    } catch (e) {
        console.log(`${f} : ERROR`);
    }
}

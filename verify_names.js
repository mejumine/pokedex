const { execSync } = require('child_process');

const files = [
    'Narwhal.jpg',
    'Ball_python_regius.jpg',
    'Indian_Cobra_(Naja_naja).jpg',
    'Komodo_dragon_(Varanus_komodoensis).jpg',
    'Impala_Aepyceros_melampus.jpg', // retry
    'Impala_(Aepyceros_melampus)_male.jpg',
    'Python_regius_-_Ball_python.jpg',
    'Dragon_de_komodo.jpg'
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

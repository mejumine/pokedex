const https = require('https');

const query = 'red fox';
const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}`;

https.get(url, { headers: { 'User-Agent': 'PokedexApp/1.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.error("Parse error:", e);
        }
    });
}).on('error', (e) => {
    console.error("Request error:", e);
});

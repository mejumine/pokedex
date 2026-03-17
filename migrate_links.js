const fs = require('fs');

const path = 'c:/Users/Quentin/.gemini/antigravity/scratch/pokedex/database.js';
let content = fs.readFileSync(path, 'utf8');

// Regex to find Wikimedia thumb URLs and extract the filename
// Typical: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Filename.jpg/500px-Filename.jpg
// Or: https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Filename.jpg/something-Filename.jpg
// Or non-thumb: https://upload.wikimedia.org/wikipedia/commons/a/ab/Filename.jpg

const wikiRegex = /https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^\s'"]+/g;

const updatedContent = content.replace(wikiRegex, (url) => {
    // If it's a thumb URL
    if (url.includes('/thumb/')) {
        const parts = url.split('/');
        // The filename is usually the second to last part, but wait...
        // .../commons/thumb/8/8a/Golden_Retriever_...jpg/500px-Golden_Retriever_...jpg
        // parts[6] = '8', parts[7] = '8a', parts[8] = Filename, parts[9] = 500px-Filename

        // Let's be more robust: find the part after the hash dirs (2 chars and 1 char)
        // Actually, it's safer to take the part before the last one if it's a thumb.
        let filename = parts[parts.length - 2];

        // Sometimes the filename is NOT the second to last (e.g. if there's no width part)
        // But for our URLs it should be.

        // Return refined URL
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=500`;
    } else {
        // Non-thumb: https://upload.wikimedia.org/wikipedia/commons/8/8a/Filename.jpg
        const parts = url.split('/');
        let filename = parts[parts.length - 1];
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=500`;
    }
});

fs.writeFileSync(path, updatedContent);
console.log('Migration to Special:FilePath complete.');

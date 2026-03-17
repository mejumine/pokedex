const axios = require('axios');

async function test() {
    // iNaturalist observations/species_counts returns species with actual observation filtering
    // iconic_taxa param works here
    const urlMammal = `https://api.inaturalist.org/v1/observations/species_counts?iconic_taxa=Mammalia&per_page=5&order_by=observations_count&order=desc&locale=fr`;
    const mRes = await axios.get(urlMammal);
    console.log('\nTop 5 mammals via /observations/species_counts:');
    mRes.data.results.forEach(t => console.log(' -', t.taxon.name, '|', t.taxon.preferred_common_name, '|', t.taxon.iconic_taxon_name, '| obs:', t.count));

    const urlBird = `https://api.inaturalist.org/v1/observations/species_counts?iconic_taxa=Aves&per_page=5&order_by=observations_count&order=desc&locale=fr`;
    const bRes = await axios.get(urlBird);
    console.log('\nTop 5 birds via /observations/species_counts:');
    bRes.data.results.forEach(t => console.log(' -', t.taxon.name, '|', t.taxon.preferred_common_name, '|', t.taxon.iconic_taxon_name));
}

test().catch(console.error);

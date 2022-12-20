const fs = require("fs");
const utS = require("./util-search-index");
const {Timer} = require("./util.js");

async function main () {
	const t = Timer.start();
	console.log("##### Creating primary index... #####");
	const index = await utS.UtilSearchIndex.pGetIndex();
	fs.writeFileSync("search/index.json", JSON.stringify(index), "utf8");
	console.log("##### Creating secondary index: Items... #####");
	const indexItems = await utS.UtilSearchIndex.pGetIndexAdditionalItem();
	fs.writeFileSync("search/index-item.json", JSON.stringify(indexItems), "utf8");
	console.log("##### Creating alternate index: Spells... #####");
	const indexAltSpells = await utS.UtilSearchIndex.pGetIndexAlternate("spell");
	fs.writeFileSync("search/index-alt-spell.json", JSON.stringify(indexAltSpells), "utf8");
	console.log("##### Creating Foundry index... #####");
	const indexFoundry = await utS.UtilSearchIndex.pGetIndexFoundry();
	fs.writeFileSync("search/index-foundry.json", JSON.stringify(indexFoundry), "utf8");
	console.log(`Created indexes in ${Timer.stop(t)}`);
}

module.exports = main();

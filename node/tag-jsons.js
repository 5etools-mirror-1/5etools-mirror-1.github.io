let fs, ut;

if (typeof module !== "undefined") {
	fs = require("fs");
	require("../js/utils.js");
	require("../js/render.js");
	require("../js/render-dice.js");
	ut = require("./util.js");
	Object.assign(global, require("../js/converterutils"));
	Object.assign(global, require("../js/converterutils-entries"));
}

function run (args) {
	TagJsons._BLACKLIST_FILE_PREFIXES = [
		...ut.FILE_PREFIX_BLACKLIST,

		// specific files
		"demo.json",
	];

	let files;
	if (args.file) {
		files = [args.file];
	} else {
		files = ut.listFiles({dir: `./data`, blacklistFilePrefixes: TagJsons._BLACKLIST_FILE_PREFIXES});
		if (args.filePrefix) {
			files = files.filter(f => f.startsWith(args.filePrefix));
			if (!files.length) throw new Error(`No file with prefix "${args.filePrefix}" found!`);
		}
	}

	const creatureList = getTaggableCreatureList(args.bestiaryFile);

	files.forEach(file => {
		console.log(`Tagging file "${file}"`);
		const json = ut.readJson(file);

		if (json instanceof Array) return;

		TagJsons.mutTagObject(json, {creaturesToTag: creatureList});

		const outPath = args.inplace ? file : file.replace("./data/", "./trash/");
		if (!args.inplace) {
			const dirPart = outPath.split("/").slice(0, -1).join("/");
			fs.mkdirSync(dirPart, {recursive: true});
		}
		fs.writeFileSync(outPath, CleanUtil.getCleanJson(json));
	});
}

/**
 * Return creatures from the provided bestiary which are one of:
 * - A named creature
 * - A copy of a creature
 * - An NPC
 * as these creatures are likely to be missed by the automated tagging during conversion.
 */
function getTaggableCreatureList (filename) {
	if (!filename) return [];
	const bestiaryJson = ut.readJson(filename);
	return (bestiaryJson.monster || [])
		.filter(it => it.isNamedCreature || it.isNpc || it._copy)
		.map(it => ({name: it.name, source: it.source}));
}

function setUp () {
	ut.patchLoadJson();
}

function teardown () {
	ut.unpatchLoadJson();
}

function loadSpells () {
	const spellIndex = ut.readJson(`./data/spells/index.json`);

	return Object.entries(spellIndex).map(([source, filename]) => {
		if (SourceUtil.isNonstandardSource(source)) return [];

		return ut.readJson(`./data/spells/${filename}`).spell;
	}).flat();
}

/**
 * Args:
 * file="./data/my-file.json"
 * filePrefix="./data/dir/"
 * inplace
 * bestiaryFile="./data/my-file.json"
 */
async function main () {
	ut.ArgParser.parse();
	setUp();
	await TagJsons.pInit({
		spells: loadSpells(),
	});
	run(ut.ArgParser.ARGS);
	teardown();
}

if (typeof module !== "undefined") {
	if (require.main === module) {
		main().then(() => console.log("Run complete.")).catch(e => { throw e; });
	} else {
		module.exports = {
			getTaggableCreatureList,
		};
	}
}

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

/**
 * Args:
 * file="./data/my-file.json"
 * filePrefix="./data/dir/"
 * inplace
 */
class ArgParser {
	static parse () {
		process.argv
			.slice(2)
			.forEach(arg => {
				let [k, v] = arg.split("=").map(it => it.trim()).filter(Boolean);
				if (v == null) ArgParser.ARGS[k] = true;
				else {
					v = v
						.replace(/^"(.*)"$/, "$1")
						.replace(/^'(.*)'$/, "$1")
					;

					if (!isNaN(v)) ArgParser.ARGS[k] = Number(v);
					else ArgParser.ARGS[k] = v;
				}
			});
	}
}
ArgParser.ARGS = {};

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

	files.forEach(file => {
		console.log(`Tagging file "${file}"`);
		const json = ut.readJson(file);

		if (json instanceof Array) return;

		TagJsons.mutTagObject(json);

		const outPath = args.inplace ? file : file.replace("./data/", "./trash/");
		if (!args.inplace) {
			const dirPart = outPath.split("/").slice(0, -1).join("/");
			fs.mkdirSync(dirPart, {recursive: true});
		}
		fs.writeFileSync(outPath, CleanUtil.getCleanJson(json));
	});
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

async function main () {
	ArgParser.parse();
	setUp();
	await TagJsons.pInit({
		spells: loadSpells(),
	});
	run(ArgParser.ARGS);
	teardown();
}

if (typeof module !== "undefined") {
	if (require.main === module) {
		main().then(() => console.log("Run complete.")).catch(e => { throw e; });
	} else {
		module.exports = TagJsons;
	}
}

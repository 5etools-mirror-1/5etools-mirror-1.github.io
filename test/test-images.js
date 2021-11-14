const fs = require("fs");
require("../js/utils");

const expected = new Set();
const expectedDirs = {};
const existing = new Set();
const expectedFromHashToken = {};

// Loop through each bestiary-related img directory and push the list of files in each.
if (fs.existsSync("./img")) {
	console.log(`##### Reconciling the PNG tokens against the bestiary JSON #####`);

	// Loop through each bestiary JSON file push the list of expected PNG files.
	fs.readdirSync("./data/bestiary")
		.filter(file => file.startsWith("bestiary") && file.endsWith(".json"))
		.forEach(file => {
			const result = JSON.parse(fs.readFileSync(`./data/bestiary/${file}`));
			result.monster.forEach(m => {
				const source = Parser.sourceJsonToAbv(m.source);
				const implicitTokenPath = `${source}/${Parser.nameToTokenName(m.name)}.png`;

				if (m.hasToken) expectedFromHashToken[implicitTokenPath] = true;

				if (fs.existsSync(`./img/${source}`)) {
					expected.add(implicitTokenPath);

					// add tokens specified as part of variants
					if (m.variant) {
						m.variant.filter(it => it.token).forEach(entry => expected.add(`${Parser.sourceJsonToAbv(entry.token.source)}/${Parser.nameToTokenName(entry.token.name)}.png`));
					}

					// add tokens specified as alt art
					if (m.altArt) {
						m.altArt.forEach(alt => expected.add(`${Parser.sourceJsonToAbv(alt.source)}/${Parser.nameToTokenName(alt.name)}.png`));
					}
				} else expectedDirs[source] = true;
			});
		});

	const IGNORED_PREFIXES = [
		".",
		"_",
	];

	const IGNORED_EXTENSIONS = [
		".git",
		".gitignore",
		".png",
		".txt",
	];

	const IGNORED_DIRS = new Set([
		"adventure",
		"backgrounds",
		"dmscreen",
		"deities",
		"variantrules",
		"rules",
		"objects",
		"bestiary",
		"roll20",
		"book",
		"items",
		"races",
		"vehicles",
		"characters",
		"conditionsdiseases",
		"languages",
		"plutonium",
		"covers",
		"spells",
		"charcreationoptions",
		"recipes",
	]);

	fs.readdirSync("./img")
		.filter(file => !(IGNORED_PREFIXES.some(it => file.startsWith(it) || IGNORED_EXTENSIONS.some(it => file.endsWith(it)))))
		.forEach(dir => {
			if (!IGNORED_DIRS.has(dir)) {
				fs.readdirSync(`./img/${dir}`).forEach(file => {
					existing.add(`${dir.replace("(", "").replace(")", "")}/${file}`);
				});
			}
		});

	const results = [];
	expected.forEach((img) => {
		if (!existing.has(img)) results.push(`[ MISSING] ${img}`);
	});
	existing.forEach((img) => {
		delete expectedFromHashToken[img];
		if (!expected.has(img)) {
			// fs.unlinkSync(`./img/${img}`);
			results.push(`[   EXTRA] ${img}`);
		}
	});

	Object.keys(expectedDirs).forEach(k => results.push(`Directory ${k} doesn't exist!`));
	results
		.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
		.forEach((img) => console.warn(img));

	if (Object.keys(expectedFromHashToken).length) console.warn(`Declared in Bestiary data but not found:`);
	Object.keys(expectedFromHashToken).forEach(img => console.warn(`[MISMATCH] ${img}`));

	if (!expected.size && !Object.keys(expectedFromHashToken).length) console.log("Tokens are as expected.");
}

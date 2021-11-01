const ut = require("../node/util");
const rl = require("readline-sync");
const fs = require("fs");
require("../js/utils");

const BLACKLIST_FILE_PREFIXES = [
	...ut.FILE_PREFIX_BLACKLIST,
	"fluff-",

	// specific files
	"roll20-tables.json",
	"roll20-items.json",
	"makebrew-creature.json",
	"srd-spells.json",
	"srd-monsters.json",
	"roll20.json",
	"spells-stream.json",
	"makecards.json",
	"foundry.json",
	"characters.json",
];

const BLACKLIST_KEYS = new Set([
	"_meta",
	"data",
	"itemProperty",
	"itemEntry",
	"lifeClass",
	"lifeBackground",
	"lifeTrinket",
	"cr",
	"monsterfeatures",
	"adventure",
	"book",
	"itemTypeAdditionalEntries",
	"legendaryGroup",
	"languageScript",
	"dragonMundaneItems",
]);

// Sources which only exist in digital form
const BLACKLIST_SOURCES = new Set([
	"DC",
	"SLW",
	"SDW",
]);

const SUB_KEYS = {
	race: ["subraces"],
};

function run (isModificationMode) {
	console.log(`##### Checking for Missing Page Numbers #####`);
	const FILE_MAP = {};
	const files = ut.listFiles({dir: `./data`, blacklistFilePrefixes: BLACKLIST_FILE_PREFIXES});
	files
		.forEach(file => {
			let mods = 0;

			const json = ut.readJson(file);
			Object.keys(json)
				.filter(k => !BLACKLIST_KEYS.has(k))
				.forEach(k => {
					const data = json[k];
					if (data instanceof Array) {
						const noPage = data
							.filter(it => !BLACKLIST_SOURCES.has((it.inherits ? it.inherits.source : it.source) || it.source))
							.filter(it => !(it.inherits ? it.inherits.page : it.page));

						const subKeys = SUB_KEYS[k];
						if (subKeys) {
							subKeys.forEach(sk => {
								data
									.filter(it => it[sk] && it[sk] instanceof Array)
									.forEach(it => {
										const subArr = it[sk];
										subArr
											.forEach(subIt => subIt.source = subIt.source || it.source);
										noPage.push(...subArr
											// Skip un-named entries, as these are usually found on the page of their parent
											.filter(subIt => subIt.name)
											.filter(subIt => !BLACKLIST_SOURCES.has(subIt.source))
											.filter(subIt => !subIt.page));
									})
							});
						}

						if (noPage.length) {
							console.log(`${file}:`);
							if (isModificationMode) console.log(`\t${noPage.length} missing page number${noPage.length === 1 ? "" : "s"}`);
						}
						noPage
							.forEach(it => {
								const ident = `${k.padEnd(20, " ")} ${(it.source || (it.inherits && it.inherits.source)).padEnd(32, " ")} ${it.name}`;
								if (isModificationMode) {
									console.log(`  ${ident}`);
									const page = rl.questionInt("  - Page = ");
									if (page) {
										it.page = page;
										mods++;
									}
								} else {
									const list = (FILE_MAP[file] = FILE_MAP[file] || []);
									list.push(ident);
								}
							});
					}
				});

			if (mods > 0) {
				let answer = "";
				while (!["y", "n", "quit"].includes(answer)) {
					answer = rl.question(`Save file with ${mods} modification${mods === 1 ? "" : "s"}? [y/n/quit]`);
					if (answer === "y") {
						console.log(`Saving ${file}...`);
						fs.writeFileSync(file, CleanUtil.getCleanJson(json), "utf-8");
					} else if (answer === "quit") {
						process.exit(1);
					}
				}
			}
		});

	const filesWithMissingPages = Object.keys(FILE_MAP);
	if (filesWithMissingPages.length) {
		console.warn(`##### Files with Missing Page Numbers #####`);
		filesWithMissingPages.forEach(f => {
			console.warn(`${f}:`);
			FILE_MAP[f].forEach(it => console.warn(`\t${it}`));
		});
	} else console.log(`Page numbers are as expected.`);
}

if (require.main === module) run(true);
else run(false);

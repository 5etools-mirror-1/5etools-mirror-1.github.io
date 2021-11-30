const fs = require("fs");
require("../js/utils");
const ut = require("../node/util.js");
const Ajv = require("ajv").default;

// Compile the schema
require("../node/compile-schemas.js");

// region Set up validator
const ajv = new Ajv({
	allowUnionTypes: true,
});

ajv.addKeyword({
	keyword: "version",
	validate: false,
});

const DATE_REGEX = /^\d\d\d\d-\d\d-\d\d$/;
ajv.addFormat(
	"date",
	{
		validate: (str) => DATE_REGEX.test(str),
	},
);
// endregion

function handleError () {
	const out = JSON.stringify(ajv.errors, null, 2);
	console.error(out);
	console.warn(`Tests failed`);
	fs.writeFileSync("../log-test-json.json", out, "utf-8");
	return false;
}

// add any implicit data to the JSON
function addImplicits (obj, lastKey) {
	if (typeof obj !== "object") return;
	if (obj == null) return;
	if (obj instanceof Array) obj.forEach(it => addImplicits(it, lastKey));
	else {
		// "obj.mode" will be set if this is in a "_copy" etc. block
		if (lastKey === "spellcasting" && !obj.mode) obj.type = obj.type || "spellcasting";

		Object.entries(obj).forEach(([k, v]) => addImplicits(v, k));
	}
}

async function main () {
	console.log(`##### Validating JSON against schemata #####`);

	// a probably-unnecessary directory shift to ensure the JSON schema internal references line up
	const cacheDir = process.cwd();
	process.chdir(`${cacheDir}/test/schema`);

	const PRELOAD_SINGLE_FILE_SCHEMAS = [
		"trapshazards.json",
		"objects.json",
		"items.json",
	];

	const PRELOAD_COMMON_SINGLE_FILE_SCHEMAS = [
		"entry.json",
		"util.json",
		"shared-items.json",
	];

	ajv.addSchema(ut.readJson("spells/spells.json", "utf8"), "spells/spells.json");
	ajv.addSchema(ut.readJson("bestiary/bestiary.json", "utf8"), "bestiary/bestiary.json");
	PRELOAD_SINGLE_FILE_SCHEMAS.forEach(schemaName => {
		ajv.addSchema(ut.readJson(schemaName, "utf8"), schemaName);
	});
	PRELOAD_COMMON_SINGLE_FILE_SCHEMAS.forEach(schemaName => {
		const json = ut.readJson(schemaName, "utf8");
		ajv.addSchema(json, schemaName);
	});

	// Get schema files, ignoring directories
	const schemaFiles = fs.readdirSync(`${cacheDir}/test/schema`)
		.filter(file => file.endsWith(".json"));

	const SCHEMA_BLACKLIST = new Set([...PRELOAD_COMMON_SINGLE_FILE_SCHEMAS, "homebrew.json"]);

	for (let i = 0; i < schemaFiles.length; ++i) {
		const schemaFile = schemaFiles[i];
		if (!SCHEMA_BLACKLIST.has(schemaFile)) {
			const dataFile = schemaFile; // data and schema filenames match

			console.log(`Testing data/${dataFile}`.padEnd(50), `against schema/${schemaFile}`);

			const data = ut.readJson(`${cacheDir}/data/${dataFile}`);
			// Avoid re-adding schemas we have already loaded
			if (!PRELOAD_SINGLE_FILE_SCHEMAS.includes(schemaFile)) {
				const schema = ut.readJson(schemaFile, "utf8");
				ajv.addSchema(schema, schemaFile);
			}

			addImplicits(data);
			const valid = ajv.validate(schemaFile, data);
			if (!valid) return handleError(valid);
		}
	}

	// Get schema files in directories
	const schemaDirectories = fs.readdirSync(`${cacheDir}/test/schema`)
		.filter(category => !category.includes("."));

	for (let i = 0; i < schemaDirectories.length; ++i) {
		const schemaDir = schemaDirectories[i];
		console.log(`Testing category ${schemaDir}`);
		const schemaFiles = fs.readdirSync(`${cacheDir}/test/schema/${schemaDir}`);

		const dataFiles = fs.readdirSync(`${cacheDir}/data/${schemaDir}`);
		for (let i = 0; i < dataFiles.length; ++i) {
			const dataFile = dataFiles[i];

			const relevantSchemaFiles = schemaFiles.filter(schema => dataFile.startsWith(schema.split(".")[0]));
			for (let i = 0; i < relevantSchemaFiles.length; ++i) {
				const schemaFile = relevantSchemaFiles[i];
				const schemaKey = `${schemaDir}/${schemaFile}`;

				console.log(`Testing data/${schemaDir}/${dataFile}`.padEnd(50), `against schema/${schemaDir}/${schemaFile}`);

				const data = ut.readJson(`${cacheDir}/data/${schemaDir}/${dataFile}`);
				const schema = ut.readJson(`${cacheDir}/test/schema/${schemaDir}/${schemaFile}`, "utf8");
				// only add the schema if we didn't do so already for this category
				if (!ajv.getSchema(schemaKey)) ajv.addSchema(schema, schemaKey);

				addImplicits(data);
				const valid = ajv.validate(schemaKey, data);
				if (!valid) return handleError(valid);
			}
		}
	}

	console.log(`All schema tests passed.`);
	process.chdir(cacheDir); // restore working directory

	return true;
}

module.exports = main();

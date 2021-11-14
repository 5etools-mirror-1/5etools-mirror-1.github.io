const fs = require("fs");
require("../js/utils");
const Ajv = require("ajv").default;

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

function loadJSON (file) {
	const data = fs.readFileSync(file, "utf8")
		.replace(/^\uFEFF/, ""); // strip BOM
	return JSON.parse(data);
}

function handleError () {
	const out = JSON.stringify(ajv.errors, null, 2);
	console.error(out);
	console.warn(`Tests failed`);
	fs.writeFileSync("../log-test-json.json", out, "utf-8");
	return false;
}

// add any implicit data to the JSON
function addImplicits (obj, lastKey) {
	if (typeof obj === "object") {
		if (obj == null) return;
		if (obj instanceof Array) obj.forEach(d => addImplicits(d, lastKey));
		else {
			// "obj.mode" will be set if this is in a "_copy" etc block
			if (lastKey === "spellcasting" && !obj.mode) obj.type = obj.type || "spellcasting";

			Object.entries(obj).forEach(([k, v]) => addImplicits(v, k));
		}
	}
}

class SchemaPreprocessor {
	static preprocess (schema) {
		this._recurse({root: schema, obj: schema});
		return schema;
	}

	static _mutMergeObjects (a, b) {
		if (typeof a !== "object" || typeof b !== "object") return;
		if ((a instanceof Array && !(b instanceof Array)) || (!(a instanceof Array) && b instanceof Array)) return console.warn(`Could not merge:\n${JSON.stringify(a)}\n${JSON.stringify(b)}`);

		const bKeys = new Set(Object.keys(b));
		Object.keys(a).forEach(ak => {
			if (bKeys.has(ak)) {
				const av = a[ak];
				const bv = b[ak];

				const bType = typeof bv;

				switch (bType) {
					case "boolean":
					case "number":
					case "string": a[ak] = bv; break; // if we have a primitive, overwrite
					case "object": {
						if (bv instanceof Array) a[ak] = [...a[ak], ...bv]; // if we have an array, combine
						else this._mutMergeObjects(av, bv); // otherwise, go deeper
						break;
					}
					default: throw new Error(`Impossible!`);
				}

				bKeys.delete(ak); // mark key as merged
			}
		});
		// any properties in B that aren't in A simply get added to A
		bKeys.forEach(bk => a[bk] = b[bk]);
	}

	static _recurse ({root, obj}) {
		if (typeof obj !== "object") return obj;

		if (obj instanceof Array) return obj.map(d => this._recurse({root, obj: d}));

		Object.entries(obj)
			.forEach(([k, v]) => {
				if (k !== "$$merge") {
					obj[k] = this._recurse({root, obj: v});
					return;
				}

				const merged = {};
				v.forEach(toMerge => {
					// handle any mergeable children
					toMerge = this._recurse({root, obj: toMerge});
					// resolve references
					toMerge = this._getResolvedRefJson({root, toMerge});
					// merge
					this._mutMergeObjects(merged, toMerge);
				});

				if (merged.type && ["anyOf", "allOf", "oneOf", "not"].some(prop => merged[prop])) {
					throw new Error(`Merged schema had both "type" and a combining/compositing property!`);
				}

				delete obj[k];
				this._mutMergeObjects(obj, merged);
			});

		return obj;
	}

	static _getResolvedRefJson ({root, toMerge}) {
		if (!toMerge.$ref) return toMerge;

		const [file, path] = toMerge.$ref.split("#");
		const pathParts = path.split("/").filter(Boolean);

		let refData;
		if (file) {
			const externalSchema = loadJSON(file);
			refData = MiscUtil.get(externalSchema, ...pathParts);

			// Convert any `#/ ...` definitions to refer to the original file, as the schema will be copied into our file
			SchemaPreprocessor._WALKER.walk(
				refData,
				{
					string: (str, lastKey) => {
						if (lastKey !== "$ref") return str;
						const [otherFile, otherPath] = str.split("#");
						if (otherFile) return str;
						return [file, otherPath].filter(Boolean).join("#");
					},
				},
			);
		} else {
			refData = MiscUtil.get(root, ...pathParts);
		}

		if (!refData) throw new Error(`Could not find referenced data!`);
		return refData;
	}
}
SchemaPreprocessor._WALKER = MiscUtil.getWalker();

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

	ajv.addSchema(SchemaPreprocessor.preprocess(loadJSON("spells/spells.json", "utf8")), "spells/spells.json");
	ajv.addSchema(SchemaPreprocessor.preprocess(loadJSON("bestiary/bestiary.json", "utf8")), "bestiary/bestiary.json");
	PRELOAD_SINGLE_FILE_SCHEMAS.forEach(schemaName => {
		ajv.addSchema(SchemaPreprocessor.preprocess(loadJSON(schemaName, "utf8")), schemaName);
	});
	ajv.addSchema(SchemaPreprocessor.preprocess(loadJSON("entry.json", "utf8")), "entry.json");
	ajv.addSchema(SchemaPreprocessor.preprocess(loadJSON("util.json", "utf8")), "util.json");

	// Get schema files, ignoring directories
	const schemaFiles = fs.readdirSync(`${cacheDir}/test/schema`)
		.filter(file => file.endsWith(".json"));

	const SCHEMA_BLACKLIST = new Set(["entry.json", "util.json"]);

	for (let i = 0; i < schemaFiles.length; ++i) {
		const schemaFile = schemaFiles[i];
		if (!SCHEMA_BLACKLIST.has(schemaFile)) {
			const dataFile = schemaFile; // data and schema filenames match

			console.log(`Testing data/${dataFile}`.padEnd(50), `against schema/${schemaFile}`);

			const data = loadJSON(`${cacheDir}/data/${dataFile}`);
			// Avoid re-adding schemas we have already loaded
			if (!PRELOAD_SINGLE_FILE_SCHEMAS.includes(schemaFile)) {
				const schema = loadJSON(schemaFile, "utf8");
				ajv.addSchema(SchemaPreprocessor.preprocess(schema), schemaFile);
			}

			addImplicits(data);
			const valid = ajv.validate(schemaFile, data);
			if (!valid) return handleError(valid);
		}
	}

	// Get schema files in directories
	const schemaDirectories = fs.readdirSync(`${cacheDir}/test/schema`)
		.filter(category => !category.endsWith(".json"));

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

				const data = loadJSON(`${cacheDir}/data/${schemaDir}/${dataFile}`);
				const schema = loadJSON(`${cacheDir}/test/schema/${schemaDir}/${schemaFile}`, "utf8");
				// only add the schema if we didn't do so already for this category
				if (!ajv.getSchema(schemaKey)) ajv.addSchema(SchemaPreprocessor.preprocess(schema), schemaKey);

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

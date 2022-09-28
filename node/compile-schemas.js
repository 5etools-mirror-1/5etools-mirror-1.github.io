const fs = require("fs");
require("../js/utils");
const ut = require("./util.js");
const path = require("path");

const DIR_IN = "./test/schema-template/";
const DIR_OUT = "./test/schema/";

class SchemaPreprocessor {
	static preprocess ({schema, isBrew = false, isFast = false, dirSource}) {
		this._recurse({root: schema, obj: schema, isBrew, isFast, dirSource});
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

	static _recurse ({root, obj, isBrew, isFast, dirSource}) {
		if (typeof obj !== "object") return obj;

		if (obj instanceof Array) {
			return obj
				.filter(d => d.$$ifBrew_item ? isBrew : d.$$ifSite_item ? !isBrew : true)
				.map(d => {
					if (d.$$ifBrew_item) return this._recurse({root, obj: d.$$ifBrew_item, isBrew, isFast, dirSource});
					if (d.$$ifSite_item) return this._recurse({root, obj: d.$$ifSite_item, isBrew, isFast, dirSource});
					return this._recurse({root, obj: d, isBrew, isFast, dirSource});
				});
		}

		Object.entries(obj)
			.forEach(([k, v]) => {
				switch (k) {
					case "$$dbgger": {
						delete obj[k];
						// eslint-disable-next-line no-debugger
						debugger;
						return;
					}
					case "$$merge": return this._recurse_$$merge({root, obj, k, v, isBrew, isFast, dirSource});
					case "$$ifBrew": return this._recurse_$$ifBrew({root, obj, k, v, isBrew, isFast, dirSource});
					case "$$ifSite": return this._recurse_$$ifSite({root, obj, k, v, isBrew, isFast, dirSource});
					case "$$ifNotFast": return this._recurse_$$ifNotFast({root, obj, k, v, isBrew, isFast, dirSource});
					case "$$ifSiteElse_key": return this._recurse_$$ifSiteElse_key({root, obj, k, v, isBrew, isFast, dirSource});
					default: return obj[k] = this._recurse({root, obj: v, isBrew, isFast, dirSource});
				}
			});

		return obj;
	}

	static _recurse_$$merge ({root, obj, k, v, isBrew, isFast, dirSource}) {
		const merged = {};
		v.forEach(toMerge => {
			// resolve references
			toMerge = this._getResolvedRefJson({root, toMerge, dirSource});
			// handle any mergeable children
			toMerge = this._recurse({root, obj: toMerge, isBrew, isFast, dirSource});
			// merge
			this._mutMergeObjects(merged, toMerge);
		});

		if (merged.type && ["anyOf", "allOf", "oneOf", "not"].some(prop => merged[prop])) {
			throw new Error(`Merged schema had both "type" and a combining/compositing property!`);
		}

		delete obj[k];
		this._mutMergeObjects(obj, merged);
	}

	static _recurse_$$ifBrew ({root, obj, k, v, isBrew, isFast, dirSource}) {
		if (!isBrew) return void delete obj[k];
		this._recurse_$$if({root, obj, k, v, isBrew, isFast, dirSource});
	}

	static _recurse_$$ifSite ({root, obj, k, v, isBrew, isFast, dirSource}) {
		if (isBrew) return void delete obj[k];
		this._recurse_$$if({root, obj, k, v, isBrew, isFast, dirSource});
	}

	static _recurse_$$ifNotFast ({root, obj, k, v, isBrew, isFast, dirSource}) {
		if (isFast) return void delete obj[k];
		this._recurse_$$if({root, obj, k, v, isBrew, isFast, dirSource});
	}

	static _recurse_$$if ({root, obj, k, v, isBrew, isFast, dirSource}) {
		Object.entries(v)
			.forEach(([kCond, vCond]) => {
				if (obj[kCond] === undefined) {
					obj[kCond] = vCond;
					return;
				}

				// TODO(Future) this could be made to merge objects together; implement as required
				// this._mutMergeObjects(obj[kCond], vCond);
				throw new Error(`Not supported!`);
			});

		delete obj[k];

		this._recurse({root, obj, isBrew, isFast, dirSource});
	}

	static _recurse_$$ifSiteElse_key ({root, obj, k, v, isBrew, isFast, dirSource}) {
		const key = v[isBrew ? "keyBrew" : "keySite"];
		obj[k] = {[key]: v.value};
		return this._recurse_$$if({root, obj, k, v: obj[k], isBrew, isFast, dirSource});
	}

	static _getDirectoryTranslation ({file}) {
		return file.startsWith("../") ? "../" : null;
	}

	static _getResolvedRefJson ({root, toMerge, dirSource}) {
		if (!toMerge.$ref) return toMerge;

		const [file, defPath] = toMerge.$ref.split("#");
		const pathParts = defPath.split("/").filter(Boolean);

		if (!file) {
			const refData = MiscUtil.get(root, ...pathParts);
			if (!refData) throw new Error(`Could not find referenced data for "${defPath}" in local file!`);
			return this._getResolvedRefJson({root, toMerge: MiscUtil.copy(refData), dirSource});
		}

		const externalSchema = ut.readJson(path.join(dirSource, file));
		const refData = MiscUtil.copy(MiscUtil.get(externalSchema, ...pathParts), {safe: true});

		const directoryTranslation = this._getDirectoryTranslation({file});

		// Convert any `#/ ...` definitions to refer to the original file, as the schema will be copied into our file
		// Similarly, add any path changes (`../`), as the schema will be copied into our file
		SchemaPreprocessor._WALKER.walk(
			refData,
			{
				string: (str, lastKey) => {
					if (lastKey !== "$ref") return str;
					const [otherFile, otherPath] = str.split("#");
					if (otherFile) {
						if (directoryTranslation && directoryTranslation !== this._getDirectoryTranslation({file: otherFile})) {
							return `${directoryTranslation}${otherFile}#${otherPath}`;
						}
						return str;
					}
					// `file` already includes our directory translations, so we do not need to add it
					return [file, otherPath].filter(Boolean).join("#");
				},
			},
		);

		if (!refData) throw new Error(`Could not find referenced data for path "${defPath}" in file "${file}"!`);
		return this._getResolvedRefJson({root, toMerge: refData, dirSource});
	}
}
SchemaPreprocessor._WALKER = MiscUtil.getWalker();

class SchemaCompiler {
	static run () {
		ut.ArgParser.parse();

		console.log("Compiling schema...");

		const dirOut = path.normalize(ut.ArgParser.ARGS.output ?? DIR_OUT);

		const filesTemplate = ut.listFiles({dir: "./test/schema-template", allowlistFileExts: [".json"], blocklistFilePrefixes: []});

		filesTemplate.forEach(filePath => {
			filePath = path.normalize(filePath);
			const filePathPartRelative = path.relative(DIR_IN, filePath);
			const filePathOut = path.join(dirOut, filePathPartRelative);
			const dirPathOut = path.dirname(filePathOut);
			const compiled = SchemaPreprocessor.preprocess({
				schema: ut.readJson(filePath, "utf8"),
				isBrew: ut.ArgParser.ARGS.homebrew,
				isFast: ut.ArgParser.ARGS.fast,
				dirSource: path.dirname(filePath),
			});
			fs.mkdirSync(dirPathOut, {recursive: true});
			fs.writeFileSync(filePathOut, JSON.stringify(compiled, null, "\t"), "utf-8");
		});

		console.log(`Schema compiled and output to ${dirOut}`);
	}
}

SchemaCompiler.run();

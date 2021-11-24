const fs = require("fs");
require("../js/utils");
const ut = require("./util.js");

const DIR_IN = "./test/schema-template/";
const DIR_OUT = "./test/schema/";

class SchemaPreprocessor {
	static preprocess ({schema, isBrew = false, dirSource}) {
		this._recurse({root: schema, obj: schema, isBrew, dirSource});
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

	static _recurse ({root, obj, isBrew, dirSource}) {
		if (typeof obj !== "object") return obj;

		if (obj instanceof Array) {
			return obj
				.filter(d => d.$$ifBrew_item ? isBrew : d.$$ifSite_item ? !isBrew : true)
				.map(d => {
					if (d.$$ifBrew_item) return this._recurse({root, obj: d.$$ifBrew_item, isBrew, dirSource});
					if (d.$$ifSite_item) return this._recurse({root, obj: d.$$ifSite_item, isBrew, dirSource});
					return this._recurse({root, obj: d, isBrew, dirSource});
				});
		}

		Object.entries(obj)
			.forEach(([k, v]) => {
				switch (k) {
					case "$$merge": return this._recurse_$$merge({root, obj, k, v, isBrew, dirSource});
					case "$$ifBrew": return this._recurse_$$ifBrew({root, obj, k, v, isBrew, dirSource});
					case "$$ifSite": return this._recurse_$$ifSite({root, obj, k, v, isBrew, dirSource});
					case "$$ifSiteElse_key": return this._recurse_$$ifSiteElse_key({root, obj, k, v, isBrew, dirSource});
					default: return obj[k] = this._recurse({root, obj: v, isBrew, dirSource});
				}
			});

		return obj;
	}

	static _recurse_$$merge ({root, obj, k, v, isBrew, dirSource}) {
		const merged = {};
		v.forEach(toMerge => {
			// handle any mergeable children
			toMerge = this._recurse({root, obj: toMerge});
			// resolve references
			toMerge = this._getResolvedRefJson({root, toMerge, dirSource});
			// merge
			this._mutMergeObjects(merged, toMerge);
		});

		if (merged.type && ["anyOf", "allOf", "oneOf", "not"].some(prop => merged[prop])) {
			throw new Error(`Merged schema had both "type" and a combining/compositing property!`);
		}

		delete obj[k];
		this._mutMergeObjects(obj, merged);
	}

	static _recurse_$$ifBrew ({root, obj, k, v, isBrew, dirSource}) {
		if (!isBrew) return void delete obj[k];
		this._recurse_$$if({root, obj, k, v});
	}

	static _recurse_$$ifSite ({root, obj, k, v, isBrew, dirSource}) {
		if (isBrew) return void delete obj[k];
		this._recurse_$$if({root, obj, k, v});
	}

	static _recurse_$$if ({root, obj, k, v}) {
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
	}

	static _recurse_$$ifSiteElse_key ({root, obj, k, v, isBrew, dirSource}) {
		const key = v[isBrew ? "keyBrew" : "keySite"];
		obj[k] = {[key]: v.value};
		return this._recurse_$$if({root, obj, k, v: obj[k]});
	}

	static _getResolvedRefJson ({root, toMerge, dirSource}) {
		if (!toMerge.$ref) return toMerge;

		const [file, path] = toMerge.$ref.split("#");
		const pathParts = path.split("/").filter(Boolean);

		if (!file) {
			const refData = MiscUtil.get(root, ...pathParts);
			if (!refData) throw new Error(`Could not find referenced data for "${path}" in local file!`);
			return refData;
		}

		const externalSchema = ut.readJson(`${dirSource}/${file}`);
		const refData = MiscUtil.get(externalSchema, ...pathParts);

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

		if (!refData) throw new Error(`Could not find referenced data for path "${path}" in file "${file}"!`);
		return refData;
	}
}
SchemaPreprocessor._WALKER = MiscUtil.getWalker();

class SchemaCompiler {
	static run () {
		ut.ArgParser.parse();

		console.log("Compiling schema...");

		const filesTemplate = ut.listFiles({dir: "./test/schema-template", whitelistFileExts: [".json"]});

		filesTemplate.forEach(filePath => {
			const filePathOut = filePath.replace(DIR_IN, DIR_OUT);
			const filePathOutParts = filePathOut.split("/");
			const dirPathOut = filePathOutParts.slice(0, -1).join("/");
			const compiled = SchemaPreprocessor.preprocess({
				schema: ut.readJson(filePath, "utf8"),
				isBrew: ut.ArgParser.ARGS.homebrew,
				dirSource: filePath.split("/").slice(0, -1).join("/"),
			});
			fs.mkdirSync(dirPathOut, {recursive: true});
			fs.writeFileSync(filePathOut, JSON.stringify(compiled, null, "\t"), "utf-8");
		});

		console.log("Schema compiled.");
	}
}

SchemaCompiler.run();

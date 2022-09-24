"use strict";
const fs = require("fs");

function dataRecurse (file, obj, primitiveHandlers, lastType, lastKey) {
	const to = typeof obj;
	if (obj == null) return;

	switch (to) {
		case undefined:
			if (primitiveHandlers.undefined) {
				primitiveHandlers.undefined instanceof Array
					? primitiveHandlers.undefined.forEach(ph => ph(file, obj, lastType, lastKey))
					: primitiveHandlers.undefined(file, obj, lastType, lastKey);
			}
			return obj;
		case "boolean":
			if (primitiveHandlers.boolean) {
				primitiveHandlers.boolean instanceof Array
					? primitiveHandlers.boolean.forEach(ph => ph(file, obj, lastType, lastKey))
					: primitiveHandlers.boolean(file, obj, lastType, lastKey);
			}
			return obj;
		case "number":
			if (primitiveHandlers.number) {
				primitiveHandlers.number instanceof Array
					? primitiveHandlers.number.forEach(ph => ph(file, obj, lastType, lastKey))
					: primitiveHandlers.number(file, obj, lastType, lastKey);
			}
			return obj;
		case "string":
			if (primitiveHandlers.string) {
				primitiveHandlers.string instanceof Array
					? primitiveHandlers.string.forEach(ph => ph(file, obj, lastType, lastKey))
					: primitiveHandlers.string(file, obj, lastType, lastKey);
			}
			return obj;
		case "object": {
			if (obj instanceof Array) {
				if (primitiveHandlers.array) {
					primitiveHandlers.array instanceof Array
						? primitiveHandlers.array.forEach(ph => ph(file, obj, lastType, lastKey))
						: primitiveHandlers.object(file, obj, lastType, lastKey);
				}
				obj.forEach(it => dataRecurse(file, it, primitiveHandlers, lastType, lastKey));
				return obj;
			} else {
				if (primitiveHandlers.object) {
					primitiveHandlers.object instanceof Array
						? primitiveHandlers.object.forEach(ph => ph(file, obj, lastType, lastKey))
						: primitiveHandlers.object(file, obj, lastType, lastKey);
				}
				// TODO this assignment could be used to mutate the object
				//  (currently does nothing; each returns the same object as was passed)
				Object.keys(obj).forEach(k => {
					const v = obj[k];
					obj[k] = dataRecurse(file, v, primitiveHandlers, lastType, k);
				});
				return obj;
			}
		}
		default:
			console.warn("Unhandled type?!", to);
			return obj;
	}
}

function readJson (path) {
	try {
		const data = fs.readFileSync(path, "utf8")
			.replace(/^\uFEFF/, ""); // strip BOM
		return JSON.parse(data);
	} catch (e) {
		e.message += ` (Path: ${path})`;
		throw e;
	}
}

function isDirectory (path) {
	return fs.lstatSync(path).isDirectory();
}

const FILE_EXTENSION_ALLOWLIST = [
	".json",
];

const FILE_PREFIX_DISALLOWLIST = [
	"bookref-",
	"roll20-",
	"foundry-",
	"gendata-",
];

/**
 * Recursively list all files in a directory.
 *
 * @param [opts] Options object.
 * @param [opts.disallowlistFilePrefixes] Disallowlisted filename prefixes (case sensitive).
 * @param [opts.allowlistFileExts] Allowlisted filename extensions (case sensitive).
 * @param [opts.dir] Directory to list.
 * @param [opts.allowlistDirs] Directory allowlist.
 */
function listFiles (opts) {
	opts = opts || {};
	opts.dir = opts.dir || "./data";
	opts.disallowlistFilePrefixes = opts.disallowlistFilePrefixes || FILE_PREFIX_DISALLOWLIST;
	opts.allowlistFileExts = opts.allowlistFileExts || FILE_EXTENSION_ALLOWLIST;
	opts.allowlistDirs = opts.allowlistDirs || null;

	const dirContent = fs.readdirSync(opts.dir, "utf8")
		.filter(file => {
			const path = `${opts.dir}/${file}`;
			if (isDirectory(path)) return opts.allowlistDirs ? opts.allowlistDirs.includes(path) : true;
			return !opts.disallowlistFilePrefixes.some(it => file.startsWith(it)) && opts.allowlistFileExts.some(it => file.endsWith(it));
		})
		.map(file => `${opts.dir}/${file}`);

	return dirContent.reduce((acc, file) => {
		if (isDirectory(file)) acc.push(...listFiles({...opts, dir: file}));
		else acc.push(file);
		return acc;
	}, []);
}

function rmDirRecursiveSync (dir) {
	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach(file => {
			const curPath = `${dir}/${file}`;
			if (fs.lstatSync(curPath).isDirectory()) rmDirRecursiveSync(curPath);
			else fs.unlinkSync(curPath);
		});
		fs.rmdirSync(dir);
	}
}

class PatchLoadJson {
	static _CACHED = null;
	static _CACHED_RAW = null;

	static patchLoadJson () {
		PatchLoadJson._CACHED = PatchLoadJson._CACHED || DataUtil.loadJSON;
		DataUtil.loadJSON = async (url) => {
			const data = readJson(url);
			await DataUtil.pDoMetaMerge(url, data);
			return data;
		};
		PatchLoadJson._CACHED_RAW = PatchLoadJson._CACHED_RAW || DataUtil.loadRawJSON;
		DataUtil.loadRawJSON = async (url) => readJson(url);
	}

	static unpatchLoadJson () {
		if (PatchLoadJson._CACHED) DataUtil.loadJSON = PatchLoadJson._CACHED;
		if (PatchLoadJson._CACHED_RAW) DataUtil.loadRawJSON = PatchLoadJson._CACHED_RAW;
	}
}

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

module.exports = {
	dataRecurse,
	readJson,
	listFiles,
	FILE_PREFIX_DISALLOWLIST,
	patchLoadJson: PatchLoadJson.patchLoadJson,
	unpatchLoadJson: PatchLoadJson.unpatchLoadJson,
	ArgParser,
	rmDirRecursiveSync,
};

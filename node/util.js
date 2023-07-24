import * as fs from "fs";

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

const FILE_PREFIX_BLOCKLIST = [
	"bookref-",
	"foundry-",
	"gendata-",
];

/**
 * Recursively list all files in a directory.
 *
 * @param [opts] Options object.
 * @param [opts.blocklistFilePrefixes] Blocklisted filename prefixes (case sensitive).
 * @param [opts.allowlistFileExts] Allowlisted filename extensions (case sensitive).
 * @param [opts.dir] Directory to list.
 * @param [opts.allowlistDirs] Directory allowlist.
 */
function listFiles (opts) {
	opts = opts || {};
	opts.dir = opts.dir || "./data";
	opts.blocklistFilePrefixes = opts.blocklistFilePrefixes || FILE_PREFIX_BLOCKLIST;
	opts.allowlistFileExts = opts.allowlistFileExts || FILE_EXTENSION_ALLOWLIST;
	opts.allowlistDirs = opts.allowlistDirs || null;

	const dirContent = fs.readdirSync(opts.dir, "utf8")
		.filter(file => {
			const path = `${opts.dir}/${file}`;
			if (isDirectory(path)) return opts.allowlistDirs ? opts.allowlistDirs.includes(path) : true;
			return !opts.blocklistFilePrefixes.some(it => file.startsWith(it)) && opts.allowlistFileExts.some(it => file.endsWith(it));
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
	static _CACHE_BREW_LOAD_SOURCE_INDEX = null;

	static _PATCH_STACK = 0;

	static patchLoadJson () {
		if (this._PATCH_STACK++) return;

		PatchLoadJson._CACHED = PatchLoadJson._CACHED || DataUtil.loadJSON.bind(DataUtil);

		const loadJsonCache = {};
		DataUtil.loadJSON = (url) => {
			if (!loadJsonCache[url]) {
				loadJsonCache[url] = (async () => {
					const data = readJson(url);
					await DataUtil.pDoMetaMerge(url, data, {isSkipMetaMergeCache: true});
					return data;
				})();
			}
			return loadJsonCache[url];
		};

		PatchLoadJson._CACHED_RAW = PatchLoadJson._CACHED_RAW || DataUtil.loadRawJSON.bind(DataUtil);
		DataUtil.loadRawJSON = async (url) => readJson(url);

		PatchLoadJson._CACHE_BREW_LOAD_SOURCE_INDEX = PatchLoadJson._CACHE_BREW_LOAD_SOURCE_INDEX || DataUtil.brew.pLoadSourceIndex.bind(DataUtil.brew);
		DataUtil.brew.pLoadSourceIndex = async () => null;
	}

	static unpatchLoadJson () {
		if (--this._PATCH_STACK) return;

		if (PatchLoadJson._CACHED) DataUtil.loadJSON = PatchLoadJson._CACHED;
		if (PatchLoadJson._CACHED_RAW) DataUtil.loadRawJSON = PatchLoadJson._CACHED_RAW;
		if (PatchLoadJson._CACHE_BREW_LOAD_SOURCE_INDEX) DataUtil.brew.pLoadSourceIndex = PatchLoadJson._CACHE_BREW_LOAD_SOURCE_INDEX;
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

class Timer {
	static _ID = 0;
	static _RUNNING = {};

	static start () {
		const id = this._ID++;
		this._RUNNING[id] = this._getSecs();
		return id;
	}

	static stop (id, {isFormat = true} = {}) {
		const out = this._getSecs() - this._RUNNING[id];
		delete this._RUNNING[id];
		return isFormat ? `${out.toFixed(3)}s` : out;
	}

	static _getSecs () {
		const [s, ns] = process.hrtime();
		return s + (ns / 1000000000);
	}
}

export const patchLoadJson = PatchLoadJson.patchLoadJson.bind(PatchLoadJson);
export const unpatchLoadJson = PatchLoadJson.unpatchLoadJson.bind(PatchLoadJson);

export {
	readJson,
	listFiles,
	FILE_PREFIX_BLOCKLIST,
	ArgParser,
	rmDirRecursiveSync,
	Timer,
};

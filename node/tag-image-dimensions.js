import * as fs from "fs";
import "../js/parser.js";
import "../js/utils.js";
import probe from "probe-image-size";
import {ObjectWalker} from "5etools-utils";
import {Command} from "commander";
import * as ut from "./util.js";

function addDir (allFiles, dir) {
	ut.listFiles({dir})
		.filter(file => file.toLowerCase().endsWith(".json"))
		.forEach(filePath => addFile(allFiles, filePath));
}

function addFile (allFiles, path) {
	const json = ut.readJson(path, "utf-8");
	allFiles.push({json, path});
}

function getProbeTarget (imgEntry, {isAllowExternal = false}) {
	if (imgEntry.href.type === "internal") {
		const path = `img/${imgEntry.href.path}`;
		const target = fs.createReadStream(path);
		return {
			target,
			location: path,
			fnCleanup: () => target.destroy(), // stream cleanup
		};
	}

	if (imgEntry.href.type === "external") {
		if (localBrewDir && imgEntry.href.url.startsWith(`${VeCt.URL_ROOT_BREW}`)) {
			const path = decodeURI(imgEntry.href.url.replace(`${VeCt.URL_ROOT_BREW}_img`, `${localBrewDir}/_img`));
			const target = fs.createReadStream(path);
			return {
				target,
				location: path,
				fnCleanup: () => target.destroy(), // stream cleanup
			};
		} else if (!isAllowExternal) { // Local files are not truly "external"
			console.warn(`Skipping "external" image (URL was "${imgEntry.href.url}"); run with the "--allow-external" option if you wish to probe external URLs.`);
			return null;
		}

		return {
			target: imgEntry.href.url,
			location: imgEntry.href.url,
		};
	}

	throw new Error(`Unhandled image href.type "${imgEntry.href.type}"!`);
}

function getImageEntries (imageEntries, obj) {
	if (obj.type === "image" && obj.href) {
		imageEntries.push(obj);
	}
	return obj;
}

async function pMutImageDimensions (imgEntry, {isAllowExternal = false}) {
	const probeMeta = getProbeTarget(imgEntry, {isAllowExternal});
	if (probeMeta == null) return;

	const {target, location, fnCleanup} = probeMeta;
	try {
		const dimensions = await probe(target);
		if (fnCleanup) fnCleanup();

		imgEntry.width = dimensions.width;
		imgEntry.height = dimensions.height;
	} catch (e) {
		console.error(`Failed to set dimensions for ${location} -- ${e.message}`);
	}
}

async function main (
	{
		dirs,
		files,
		isAllowExternal = false,
	},
) {
	const tStart = Date.now();

	const allFiles = [];
	dirs.forEach(dir => addDir(allFiles, dir));
	files.forEach(file => addFile(allFiles, file));
	console.log(`Running on ${allFiles.length} file${allFiles.length === 1 ? "" : "s"}...`);

	const imageEntries = [];
	allFiles.forEach(meta => {
		ObjectWalker.walk({
			filePath: meta.path,
			obj: meta.json,
			primitiveHandlers: {
				object: getImageEntries.bind(this, imageEntries),
			},
		});
	});

	await Promise.all(
		[...new Array(4)]
			.map(async () => {
				while (imageEntries.length) {
					const imageEntry = imageEntries.pop();
					await pMutImageDimensions(imageEntry, {isAllowExternal});
				}
			}),
	);

	allFiles.forEach(meta => fs.writeFileSync(meta.path, CleanUtil.getCleanJson(meta.json), "utf-8"));

	const tEnd = Date.now();
	console.log(`Completed in ${((tEnd - tStart) / 1000).toFixed(2)}s.`);
}

const program = new Command()
	.option("--file <file...>", `Input files`)
	.option("--dir <dir...>", `Input directories`)
	.option("--allow-external", "Allow external URLs to be probed.")
	.option("--local-brew-dir <localBrewDir>", "Use local homebrew directory for relevant URLs.")
;

program.parse(process.argv);
const params = program.opts();

const dirs = [...(params.dir || [])];
const files = [...(params.file || [])];

const localBrewDir = params.localBrewDir;

// If no options specified, use default selection
if (!dirs.length && !files.length) {
	dirs.push("./data/adventure");
	dirs.push("./data/book");
	files.push("./data/decks.json");
	files.push("./data/fluff-recipes.json");
}

main({
	dirs,
	files,
	isAllowExternal: params.allowExternal,
	localBrewDir,
})
	.catch(e => console.error(e));

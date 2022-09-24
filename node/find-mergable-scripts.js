/**
 * Can be used to inspect which HTML files depend on which scripts.
 */

const fs = require("fs");
const ut = require("./util");
require("../js/utils");

const files = ut.listFiles({
	dir: ".",
	allowlistDirs: [],
	allowlistFileExts: [".html"],
});

const ALL_JS_FILES = new Set([]);
const FILE_TO_JS_FILES = {};

files.forEach(file => {
	const cleanFilename = file.replace("./", "");
	const html = fs.readFileSync(file, "utf-8");
	html.replace(/src="js\/(.*?\.js)"/g, (...m) => {
		ALL_JS_FILES.add(m[1]);
		(FILE_TO_JS_FILES[cleanFilename] = FILE_TO_JS_FILES[cleanFilename] || [])
			.push(m[1]);
	});
});

const out = [];
const numFiles = Object.keys(FILE_TO_JS_FILES).length;
[...ALL_JS_FILES].sort(SortUtil.ascSortLower).forEach(file => {
	const total = Object.values(FILE_TO_JS_FILES).filter(it => it.includes(file)).length;
	out.push({file, total});
});

out.sort((a, b) => SortUtil.ascSort(b.total, a.total))
	.forEach(it => {
		if (it.total > numFiles / 2 && it.total < numFiles) {
			const notSeenIn = Object.keys(FILE_TO_JS_FILES).filter(k => !FILE_TO_JS_FILES[k].includes(it.file));
			console.log(`${it.total}/${numFiles} ${it.file} -- missing from:`);
			notSeenIn.forEach(it => console.log(`\t${it}`));
		} else {
			console.log(`${it.total}/${numFiles} ${it.file}`);
		}
	});

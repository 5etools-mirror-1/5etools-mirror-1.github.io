const fs = require("fs");
require("./util.js");
require("../js/utils");

Object.entries(DataUtil.contentLanguages).forEach(([k, v]) => {
	const out = {};
	const classIndex = JSON.parse(fs.readFileSync(`${v.baseDir}/class/index.json`, "utf-8"));
	Object.values(classIndex).forEach(f => {
		const data = JSON.parse(fs.readFileSync(`${v.baseDir}/class/${f}`, "utf-8"));

		(data.subclass || []).forEach(sc => {
			MiscUtil.set(out, sc.classSource, sc.className, sc.source, sc.shortName, { name: sc.name, isReprinted: sc.isReprinted });
		});
	});
	fs.writeFileSync(`${v.baseDir}/generated/gendata-subclass-lookup.json`, CleanUtil.getCleanJson(out, { isMinify: true }));
});
console.log("Regenerated subclass lookup.");

import * as fs from "fs";
import "../js/parser.js";
import "../js/utils.js";

const out = {};
const classIndex = JSON.parse(fs.readFileSync("./data/class/index.json", "utf-8"));
Object.values(classIndex).forEach(f => {
	const data = JSON.parse(fs.readFileSync(`./data/class/${f}`, "utf-8"));

	(data.subclass || []).forEach(sc => {
		MiscUtil.set(out, sc.classSource, sc.className, sc.source, sc.shortName, {name: sc.name, isReprinted: sc.isReprinted});
	});
});
fs.writeFileSync(`./data/generated/gendata-subclass-lookup.json`, CleanUtil.getCleanJson(out, {isMinify: true}));
console.log("Regenerated subclass lookup.");

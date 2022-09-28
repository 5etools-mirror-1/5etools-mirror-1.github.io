"use strict";

const fs = require("fs");
const ut = require("./util");
require("../js/utils");

const BLOCKLIST_FILE_PREFIXES = [
	...ut.FILE_PREFIX_BLOCKLIST,

	// specific files
	"demo.json",
];

const TAGS_TO_CHECK = new Set([
	"spell",
	"item",
	"creature",
	"condition",
	"disease",
	"background",
	"race",
	"optfeature",
	"reward",
	"feat",
	"psionic",
	"object",
	"cult",
	"boon",
	"trap",
	"hazard",
	"variantrule",
	"vehicle",
]);

const files = ut.listFiles({dir: `./data`, blocklistFilePrefixes: BLOCKLIST_FILE_PREFIXES});
files.forEach(f => {
	const compressedTags = fs.readFileSync(f, "utf-8").replace(/{@([a-zA-Z]+) ([^|}]+)\|([^|}]*)\|([^|}]+)}/g, (...m) => {
		const [all, tag, ref, src, txt] = m;
		if (!TAGS_TO_CHECK.has(tag.toLowerCase())) return all;
		if (ref.toLowerCase() === txt.toLowerCase()) {
			if (!src || Parser.getTagSource(tag.toLowerCase()) === src.toLowerCase()) {
				return `{@${tag} ${txt}${src ? `|${src}` : ""}}`;
			}
		}
		return all;
	});

	const compressedSources = compressedTags.replace(/{@([a-zA-Z]+) ([^|}]+)\|([^|}]+)\|([^|}]+)}/g, (...m) => {
		const [all, tag, ref, src, txt] = m;
		if (!TAGS_TO_CHECK.has(tag.toLowerCase())) return all;
		if (Parser.getTagSource(tag) === src.toLowerCase()) {
			return `{@${tag} ${ref}||${txt}}`;
		}
		return all;
	});

	const skippedDefaultSources = compressedSources.replace(/{@([a-zA-Z]+) ([^|}]+)\|([^|}]+)}/g, (...m) => {
		const [all, tag, ref, src] = m;
		if (!TAGS_TO_CHECK.has(tag.toLowerCase())) return all;
		if (Parser.getTagSource(tag) === src.toLowerCase()) {
			return `{@${tag} ${ref}}`;
		}
		return all;
	});

	const out = CleanUtil.getCleanJson(skippedDefaultSources);
	fs.writeFileSync(f, JSON.parse(out), "utf-8");
});

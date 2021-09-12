const fs = require("fs");
require("../js/utils");
const ut = require("./util");

const _PROPS_TO_INDEX = [
	"name",
	"id",
	"source",
	"group",
	"level",
	"storyline",
	"published",
];

const _METAS = [
	{
		file: `data/adventures.json`,
		prop: "adventure",
	},
	{
		file: `data/books.json`,
		prop: "book",
	},
];

const out = _METAS.mergeMap(({file, prop}) => {
	return {
		[prop]: ut.readJson(file)[prop]
			.map(it => _PROPS_TO_INDEX.mergeMap(prop => ({[prop]: it[prop]}))),
	}
});

fs.writeFileSync("data/generated/gendata-nav-adventure-book-index.json", JSON.stringify(out), "utf8");
console.log("Generated navbar adventure/book index.");

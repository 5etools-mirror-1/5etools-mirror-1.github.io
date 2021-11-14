"use strict";

const fs = require("fs");
const ut = require("./util");

function minifyFolder (folder) {
	const files = ut.listFiles({dir: folder});
	files
		.filter(file => file.endsWith(".json"))
		.forEach(file => fs.writeFileSync(file, JSON.stringify(ut.readJson(file)), "utf-8"));
}

minifyFolder(`./data`);
console.log("JSON minification complete.");

"use strict";

function handleFail () {
	console.error("Tests failed!");
	process.exit(1);
}

async function main () {
	let testsPassed = true;
	testsPassed = testsPassed && await require("./test-tags");
	if (!testsPassed) handleFail();
	// don't fail on missing tokens
	await require("./test-images");
	// don't fail on missing page numbers
	await require("./test-pagenumbers");
	testsPassed = testsPassed && await require("./test-json");
	if (!testsPassed) handleFail();
	testsPassed = testsPassed && await require("./test-misc");
	if (!testsPassed) handleFail();
	testsPassed = testsPassed && await require("./test-foundry.js");
	if (!testsPassed) handleFail();
	process.exit(0);
}

main()
	.then(() => console.log("Tests complete."))
	.catch(e => {
		console.error(e);
		throw e;
	});

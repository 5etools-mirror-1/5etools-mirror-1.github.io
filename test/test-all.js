"use strict";

function handleFail () {
	console.error("Tests failed!");
	process.exit(1);
}

async function main () {
	if (!(await (await import("./test-tags.js")).default)) handleFail();
	if (!(await (await import("./test-images.js")).default)) handleFail();
	if (!(await (await import("./test-image-paths.js")).default)) handleFail();
	await (await import("./test-pagenumbers.js")).default; // don't fail on missing page numbers
	if (!(await (await import("./test-json.js")).default)) handleFail();
	if (!(await (await import("./test-misc.js")).default)) handleFail();
	if (!(await (await import("./test-multisource.js")).default)) handleFail();
	if (!(await (await import("./test-language-fonts.js")).default)) handleFail();
	if (!(await (await import("./test-foundry.js")).default)) handleFail();
	process.exit(0);
}

main()
	.then(() => console.log("Tests complete."))
	.catch(e => {
		console.error(e);
		throw e;
	});

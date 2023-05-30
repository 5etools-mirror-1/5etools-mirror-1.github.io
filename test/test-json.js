import * as fs from "fs";

import {Um, Uf, JsonTester} from "5etools-utils";

const LOG_TAG = "JSON";
const _IS_FAIL_SLOW = !!process.env.FAIL_SLOW;

const _GENERATED_ALLOWLIST = new Set([
	"bookref-quick.json",
	"gendata-spell-source-lookup.json",
]);

async function main () {
	const jsonTester = new JsonTester({
		tagLog: LOG_TAG,
		fnGetSchemaId: (filePath) => {
			const relativeFilePath = filePath.replace("data/", "");

			if (relativeFilePath.startsWith("adventure/")) return "adventure/adventure.json";
			if (relativeFilePath.startsWith("book/")) return "book/book.json";

			if (relativeFilePath.startsWith("bestiary/bestiary-")) return "bestiary/bestiary.json";
			if (relativeFilePath.startsWith("bestiary/fluff-bestiary-")) return "bestiary/fluff-bestiary.json";

			if (relativeFilePath.startsWith("class/class-")) return "class/class.json";

			if (relativeFilePath.startsWith("spells/spells-")) return "spells/spells.json";
			if (relativeFilePath.startsWith("spells/fluff-spells-")) return "spells/fluff-spells.json";

			return relativeFilePath;
		},
	});

	const fileList = Uf.listJsonFiles("data")
		.filter(filePath => {
			if (filePath.includes("data/generated")) return _GENERATED_ALLOWLIST.has(filePath.split("/").at(-1));
			return true;
		});

	const results = await jsonTester.pGetErrorsOnDirsWorkers({
		isFailFast: !_IS_FAIL_SLOW,
		fileList,
	});

	const {errors, errorsFull} = results;

	if (errors.length) {
		if (!process.env.CI) fs.writeFileSync(`test/test-json.error.log`, errorsFull.join("\n\n=====\n\n"));
		console.error(`Schema test failed (${errors.length} failure${errors.length === 1 ? "" : "s"}).`);
		return false;
	}

	Um.info(LOG_TAG, `All schema tests passed.`);
	return true;
}

export default main();

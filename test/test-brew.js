import * as fs from "fs";

import {Um, Uf, JsonTester} from "5etools-utils";

const LOG_TAG = "JSON";
const _IS_FAIL_SLOW = !process.env.FAIL_SLOW;

async function main () {
	const jsonTester = new JsonTester({
		isBrew: true,
		tagLog: LOG_TAG,
		fnGetSchemaId: (filePath) => "homebrew.json",
	});

	const fileList = Uf.listJsonFiles("homebrew").filter(item => item !== "homebrew/index.json");

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

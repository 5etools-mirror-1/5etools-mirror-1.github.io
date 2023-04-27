import "../js/parser.js";
import "../js/utils.js";
import "../js/render.js";
import * as ut from "../node/util.js";
import * as fs from "fs";

const _IS_FIX = false;

async function main () {
	console.log(`##### Validating image paths #####`);

	const walker = MiscUtil.getWalker({isNoModification: true});

	const errors = [];

	const doTestFile = (filePath, imgDirs) => {
		const errorsFile = [];

		const data = ut.readJson(filePath);

		walker.walk(
			data,
			{
				object: (obj) => {
					if (obj.type !== "image" || obj.href?.type !== "internal") return;
					const dir = obj.href.path.split("/")[0];
					if (imgDirs.includes(dir)) return;

					if (!_IS_FIX) {
						errorsFile.push(`Path ${obj.href.path} had incorrect image path beginning "${dir}"`);
						return;
					}

					const pathOut = `${imgDirs[0]}/${obj.href.path.slice(dir.length + 1)}`;
					const pathInFull = `img/${obj.href.path}`;
					const pathOutFull = `img/${pathOut}`;

					fs.mkdirSync(pathOutFull.split("/").slice(0, -1).join("/"), {recursive: true});
					fs.copyFileSync(pathInFull, pathOutFull);
					console.log(`Copied file: "${pathInFull}" -> "${pathOutFull}"`);

					obj.href.path = pathOut;
				},
			},
		);

		if (!errorsFile.length) return data;

		errors.push(`Cross-page image paths found in "${filePath}":\n${errorsFile.map(err => `\t${err}\n`).join("")}\n`);

		return data;
	};

	[
		{index: "bestiary/fluff-index.json", imgDirs: ["bestiary"]},
		{index: "spells/fluff-index.json", imgDirs: ["spells"]},
	]
		.forEach(meta => {
			if (meta.index) {
				const dir = meta.index.split("/")[0];
				Object.values(ut.readJson(`data/${meta.index}`))
					.forEach(filename => {
						const dataPath = `data/${dir}/${filename}`;
						const data = doTestFile(dataPath, meta.imgDirs);
						if (_IS_FIX) fs.writeFileSync(dataPath, CleanUtil.getCleanJson(data, {isFast: false}), "utf-8");
					});

				return;
			}

			throw new Error("Unimplemented!");
		});

	if (errors.length) {
		errors.forEach(err => console.error(err));
		return false;
	}

	return true;
}

export default main();

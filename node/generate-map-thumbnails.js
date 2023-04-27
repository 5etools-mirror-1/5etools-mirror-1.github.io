import * as fs from "fs";
import sharp from "sharp";
import * as ut from "./util.js";
import "../js/parser.js";
import "../js/utils.js";

const _NUM_WORKERS = 16;
const _QUALITY = 70;
const _SZ_THUMBNAIL_PX = 320;

async function getFileInput ({pathName, ext}) {
	// See: https://github.com/lovell/sharp/issues/806
	if (ext === "bmp") throw new Error(`Generating thumbnails from .bmp is not supported!`);
	return sharp(pathName, {limitInputPixels: false});
}

async function webpFile ({pathInput, pathOutput, extInput}) {
	const x = await getFileInput({pathName: pathInput, ext: extInput});

	// See: https://sharp.pixelplumbing.com/api-output#webp
	await x
		.resize(_SZ_THUMBNAIL_PX, _SZ_THUMBNAIL_PX, {fit: "contain", background: {r: 0, g: 0, b: 0, alpha: 0}})
		.webp({quality: _QUALITY})
		.toFile(pathOutput);
}

async function pMain () {
	const tasksGenThumbnail = [];

	const walker = MiscUtil.getWalker({isNoModification: true});

	[
		{index: "adventures", dir: "adventure", prop: "adventure"},
		{index: "books", dir: "book", prop: "book"},
	]
		.map(meta => {
			const indexData = ut.readJson(`data/${meta.index}.json`);

			indexData[meta.prop]
				.forEach(contents => {
					const filePath = `data/${meta.dir}/${meta.prop}-${contents.id.toLowerCase()}.json`;
					const data = ut.readJson(filePath);

					walker.walk(
						data.data,
						{
							object: (obj) => {
								if (obj.type !== "image" || !obj.mapRegions) return;

								const imgPath = obj.href.path;

								const pathParts = imgPath.split("/");

								const thumbPath = [...pathParts.slice(0, -1), "thumbnail", pathParts.last().replace(/\.[^.]+$/g, ".webp")].join("/");

								obj.hrefThumbnail = {
									type: "internal",
									path: thumbPath,
								};

								tasksGenThumbnail.push({imgPath, thumbPath});
							},
						},
					);

					fs.writeFileSync(filePath, CleanUtil.getCleanJson(data), "utf8");
				});
		});

	console.log(`Generating thumbnails for ${tasksGenThumbnail.length} map${tasksGenThumbnail.length === 1 ? "" : "s"}...`);

	tasksGenThumbnail.map(({thumbPath}) => {
		const thumbDir = ["img", ...thumbPath.split("/").slice(0, -1)].join("/");
		if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, {recursive: true});
	});

	let cnt = 0;
	const workers = [...new Array(_NUM_WORKERS)]
		.map(async () => {
			while (tasksGenThumbnail.length) {
				const {imgPath, thumbPath} = tasksGenThumbnail.pop();
				const extInput = imgPath.toLowerCase().split(".").last();
				await webpFile({pathInput: `img/${imgPath}`, pathOutput: `img/${thumbPath}`, extInput});
				cnt++;
				if ((cnt % 25) === 0) console.log(`Generated ${cnt}...`);
			}
		});
	await Promise.all(workers);
	console.log(`Generated ${cnt} thumbnails!`);
}

pMain()
	.then(() => console.log("Regenerated map thumbnails."))
	.catch(e => { throw e; });

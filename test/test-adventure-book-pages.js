import "../js/parser.js";
import "../js/utils.js";
import * as ut from "../node/util.js";

async function main () {
	console.log(`##### Validating adventure/book page numbers #####`);

	const walker = MiscUtil.getWalker({isNoModification: true});

	const errors = [];

	[
		{filename: "adventures.json", prop: "adventure", dir: "adventure"},
		{filename: "books.json", prop: "book", dir: "book"},
	].flatMap(({filename, prop, dir}) => ut.readJson(`./data/${filename}`)[prop]
		.map(({id}) => `./data/${dir}/${dir}-${id.toLowerCase()}.json`))
		.forEach(filename => {
			const stack = [];
			let pagePrev = -1;
			const errorsFile = [];

			walker.walk(
				ut.readJson(filename),
				{
					object: (obj) => {
						if (obj.page == null || typeof obj.page !== "number") return obj;
						if (obj.page < pagePrev) {
							const id = obj.id || [...stack].reverse().find(it => it.id)?.id;
							const name = obj.name || [...stack].reverse().find(it => it.name)?.name;
							errorsFile.push(`Previous page ${pagePrev} > ${obj.page}${id || name ? ` (at or near ${[id ? `id "${id}"` : "", name ? `name "${name}"` : ""].filter(Boolean).join("; ")})` : ""}`);
						}
						pagePrev = obj.page;

						return obj;
					},
				},
				null,
				stack,
			);

			if (!errorsFile.length) return;

			errors.push(`Page numbers were not monotonically increasing in "${filename}":\n${errorsFile.map(err => `\t${err}\n`).join("")}\n`);
		});

	if (errors.length) {
		errors.forEach(err => console.error(err));
		return false;
	}

	return true;
}

export default main();

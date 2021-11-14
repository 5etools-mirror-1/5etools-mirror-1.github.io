require("../js/utils.js");
require("../js/render.js");

UtilBookReference = {
	getSections (refId) {
		switch (refId) {
			case "bookref-quick":
				return [
					"Character Creation",
					"Equipment",
					"Playing the Game",
					"Combat",
					"Adventuring",
				];
			case "bookref-dmscreen":
				return [
					"Running the Game",
					"Combat",
					"Factions",
				];
			default:
				throw new Error(`No sections defined for book id ${refId}`);
		}
	},

	getIndex (...refTypes) {
		const index = require(`../data/books.json`);
		const books = {};
		index.book.forEach(b => {
			books[b.id.toLowerCase()] = require(`../data/book/book-${b.id.toLowerCase()}.json`);
		});

		const outJson = {
			reference: {},
			data: {},
		};

		refTypes.forEach(it => outJson.reference[it.id] = {
			name: it.name,
			id: it.id,
			contents: [],
		});

		let bookData = [];
		function reset () {
			bookData = [];
			index.book.forEach(b => {
				const data = {source: b.id, file: MiscUtil.copy(books[b.id.toLowerCase()])};
				bookData.push(data);
			});
		}

		refTypes.forEach(refType => {
			reset();
			const out = {};

			function recursiveSetSource (ent, source) {
				if (ent instanceof Array) {
					ent.forEach(e => recursiveSetSource(e, source));
				} else if (typeof ent === "object") {
					if (ent.page) ent.source = source;
					Object.values(ent).forEach(v => recursiveSetSource(v, source));
				}
			}

			function isDesiredSect (ent) {
				return ent.entries && ent.data && ent.data[refType.tag];
			}

			function recursiveAdd (ent, source) {
				if (ent.entries) {
					ent.entries = ent.entries.filter(nxt => recursiveAdd(nxt, source));
				}

				if (isDesiredSect(ent)) {
					const sect = ent.data[refType.tag];
					if (!out[sect]) {
						out[sect] = {
							sectName: UtilBookReference.getSections(refType.id)[sect - 1],
							sections: [],
						};
					}

					const toAdd = MiscUtil.copy(ent);
					toAdd.type = "section";
					const discard = !!toAdd.data.allowRefDupe;
					recursiveSetSource(toAdd, source);
					out[sect].sections.push(toAdd);
					return discard;
				} else {
					return true;
				}
			}

			bookData.forEach(book => {
				book.file.data.forEach(chap => {
					if (chap.entries) {
						recursiveAdd(chap, book.source);
					}
				});
			});

			Object.keys(out).sort().forEach(i => {
				const sects = out[i].sections.sort((a, b) => SortUtil.ascSort(a.name, b.name));
				const header = outJson.reference[refType.id];
				header.contents.push({
					name: out[i].sectName,
					headers: sects.map(s => s.name),
				});
				const toAdd = {
					type: "entries",
					entries: sects,
				};
				if (!outJson.data[refType.id]) outJson.data[refType.id] = [];
				outJson.data[refType.id].push(toAdd);
			});
		});

		const walker = MiscUtil.getWalker();

		walker.walk(
			outJson.data,
			{
				object: (obj) => {
					delete obj.id; // Remove IDs to avoid duplicates
					return obj;
				},
			},
		);

		return outJson;
	},
};

module.exports.UtilBookReference = UtilBookReference;

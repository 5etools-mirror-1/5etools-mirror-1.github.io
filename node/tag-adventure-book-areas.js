const fs = require("fs");
const ut = require("./util.js");
require("../js/utils.js");
require("../js/render.js");

class AreaTagger {
	constructor (filePath) {
		this._filePath = filePath;
		this._data = ut.readJson(filePath);

		this._maxTag = 0;
		this._existingTags = null;
	}

	_getNewTag () {
		let hexTag;
		do {
			if (this._maxTag >= 4095) throw new Error("Exhausted tags!");
			hexTag = this._maxTag.toString(16).padStart(3, "0");
			this._maxTag++;
		} while (this._existingTags.has(hexTag));
		this._existingTags.add(hexTag);
		return hexTag;
	}

	_doPopulateExistingTags () {
		const map = Renderer.adventureBook.getEntryIdLookup(this._data.data, "populateExistingIds");
		this._existingTags = new Set(Object.keys(map));
	}

	_addNewTags () {
		const handlers = {
			object: (obj) => {
				Renderer.ENTRIES_WITH_CHILDREN
					.filter(meta => meta.key === "entries")
					.forEach(meta => {
						if (obj.type !== meta.type) return;
						if (!obj.id) obj.id = this._getNewTag();
					});

				if (obj.id) return obj;
				if (obj.type === "image" && !obj.id && obj.mapRegions) obj.id = this._getNewTag();

				return obj;
			},
		};

		this._data.data.forEach(chap => MiscUtil.getWalker().walk(chap, handlers));
	}

	_doWrite () {
		const outStr = CleanUtil.getCleanJson(this._data);
		fs.writeFileSync(this._filePath, outStr, "utf-8");
	}

	run () {
		this._doPopulateExistingTags();
		this._addNewTags();
		this._doWrite();
	}
}

console.log(`Running area tagging pass...`);
const adventureIndex = ut.readJson("./data/adventures.json");
const bookIndex = ut.readJson("./data/books.json");

const doPass = (arr, type) => {
	arr.forEach(meta => {
		const areaTagger = new AreaTagger(`./data/${type}/${type}-${meta.id.toLowerCase()}.json`);
		areaTagger.run();
		console.log(`\tTagged ${meta.id}...`);
	});
};

doPass(adventureIndex.adventure, "adventure");
doPass(bookIndex.book, "book");

console.log(`Area tagging complete.`);

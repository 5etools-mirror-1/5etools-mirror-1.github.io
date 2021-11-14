const fs = require("fs");
require("../js/utils");
const ut = require("./util");
const UtilGenTables = require("./util-generate-tables-data.js");

Object.assign(global, require("../js/hist.js"));

class GenTables {
	_doLoadAdventureData () {
		return ut.readJson(`./data/adventures.json`).adventure
			.map(idx => {
				if (GenTables.ADVENTURE_WHITELIST[idx.id]) {
					return {
						adventure: idx,
						adventureData: JSON.parse(fs.readFileSync(`./data/adventure/adventure-${idx.id.toLowerCase()}.json`, "utf-8")),
					};
				}
			})
			.filter(it => it);
	}

	_doLoadBookData () {
		return ut.readJson(`./data/books.json`).book
			.map(idx => {
				if (!GenTables.BOOK_BLACKLIST[idx.id]) {
					return {
						book: idx,
						bookData: JSON.parse(fs.readFileSync(`./data/book/book-${idx.id.toLowerCase()}.json`, "utf-8")),
					};
				}
			})
			.filter(it => it);
	}

	async pRun () {
		const output = {tables: [], tableGroups: []};

		this._addBookAndAdventureData(output);
		await this._pAddClassData(output);
		await this._pAddVariantRuleData(output);

		const toSave = JSON.stringify({table: output.tables, tableGroup: output.tableGroups});
		fs.writeFileSync(`./data/generated/gendata-tables.json`, toSave, "utf-8");
		console.log("Regenerated table data.");
	}

	_addBookAndAdventureData (output) {
		const advDocs = this._doLoadAdventureData();
		const bookDocs = this._doLoadBookData();

		advDocs.forEach(doc => {
			const {
				table: foundTables,
				tableGroup: foundTableGroups,
			} = UtilGenTables.getAdventureBookTables(
				doc,
				{
					headProp: "adventure",
					bodyProp: "adventureData",
					isRequireIncludes: true,
				},
			);

			output.tables.push(...foundTables);
			output.tableGroups.push(...foundTableGroups);
		});

		bookDocs.forEach(doc => {
			const {
				table: foundTables,
				tableGroup: foundTableGroups,
			} = UtilGenTables.getAdventureBookTables(
				doc,
				{
					headProp: "book",
					bodyProp: "bookData",
				},
			);

			output.tables.push(...foundTables);
			output.tableGroups.push(...foundTableGroups);
		});
	}

	async _pAddClassData (output) {
		ut.patchLoadJson();
		const classData = await DataUtil.class.loadJSON();
		ut.unpatchLoadJson();

		classData.class.forEach(cls => {
			const {table: foundTables} = UtilGenTables.getClassTables(cls);
			output.tables.push(...foundTables);
		});

		classData.subclass.forEach(sc => {
			const {table: foundTables} = UtilGenTables.getSubclassTables(sc);
			output.tables.push(...foundTables);
		});
	}

	async _pAddVariantRuleData (output) {
		ut.patchLoadJson();
		const variantRuleData = await DataUtil.loadJSON(`./data/variantrules.json`);
		ut.unpatchLoadJson();

		variantRuleData.variantrule.forEach(it => {
			const {table: foundTables} = UtilGenTables.getGenericTables(it, "variantrule", "entries");
			output.tables.push(...foundTables);
		});
	}
}
GenTables.BOOK_BLACKLIST = {};
GenTables.ADVENTURE_WHITELIST = {
	[SRC_SKT]: true,
	[SRC_TTP]: true,
};

const generator = new GenTables();
module.exports = generator.pRun();

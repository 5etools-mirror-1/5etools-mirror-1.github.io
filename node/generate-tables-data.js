const fs = require("fs");
require("../js/utils");
const ut = require("./util");
const UtilGenTables = require("./util-generate-tables-data.js");

Object.assign(global, require("../js/hist.js"));

class GenTables {
	_doLoadAdventureData () {
		return ut.readJson(`./data/adventures.json`).adventure
			.map(idx => {
				if (GenTables.ADVENTURE_ALLOWLIST[idx.id]) {
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
				if (!GenTables.BOOK_DISALLOWLIST[idx.id]) {
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
		await this._pAddBackgroundData(output);

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
		return this._pAddGenericEntityData({
			output,
			path: `./data/variantrules.json`,
			props: ["variantrule"],
		});
	}

	async _pAddBackgroundData (output) {
		return this._pAddGenericEntityData({
			output,
			path: `./data/backgrounds.json`,
			props: ["background"],
		});
	}

	async _pAddGenericEntityData (
		{
			output,
			path,
			props,
		},
	) {
		ut.patchLoadJson();
		const jsonData = await DataUtil.loadJSON(path);
		ut.unpatchLoadJson();

		props.forEach(prop => {
			jsonData[prop].forEach(it => {
				// Note that this implicitly requires each table to have a `"tableInclude"`
				const {table: foundTables} = UtilGenTables.getGenericTables(it, prop, "entries");
				output.tables.push(...foundTables);
			});
		});
	}
}
GenTables.BOOK_DISALLOWLIST = {};
GenTables.ADVENTURE_ALLOWLIST = {
	[SRC_SKT]: true,
	[SRC_TTP]: true,
};

const generator = new GenTables();
module.exports = generator.pRun();

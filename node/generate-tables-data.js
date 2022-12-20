const fs = require("fs");
require("../js/utils");
const ut = require("./util");
const UtilGenTables = require("./util-generate-tables-data.js");
require("../js/utils-dataloader.js");
require("../js/hist.js");

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
				if (!GenTables.BOOK_BLOCKLIST[idx.id]) {
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
		await this._pAddEncountersData(output);
		await this._pAddNamesData(output);

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

	// -----------------------

	async _pAddEncountersData (output) {
		return this._pAddEncounterOrNamesData({
			output,
			path: `./data/encounters.json`,
			prop: "encounter",
			fnGetNameCaption: this.constructor._getConvertedEncounterTableName.bind(this),
			colLabel1: "Encounter",
		});
	}

	async _pAddNamesData (output) {
		return this._pAddEncounterOrNamesData({
			output,
			path: `./data/names.json`,
			prop: "name",
			fnGetNameCaption: this.constructor._getConvertedNameTableName.bind(this),
			colLabel1: "Name",
		});
	}

	async _pAddEncounterOrNamesData (
		{
			output,
			path,
			prop,
			fnGetNameCaption,
			colLabel1,
		},
	) {
		ut.patchLoadJson();
		const jsonData = await DataUtil.loadJSON(path);
		ut.unpatchLoadJson();

		jsonData[prop].forEach(group => {
			group.tables.forEach(tableRaw => {
				output.tables.push(this.constructor._getConvertedEncounterOrNamesTable({
					group,
					tableRaw,
					fnGetNameCaption,
					colLabel1,
				}));
			});
		});
	}

	static _getConvertedEncounterTableName (group, tableRaw) { return `${group.name} Encounters${tableRaw.minlvl && tableRaw.maxlvl ? ` (Levels ${tableRaw.minlvl}\u2014${tableRaw.maxlvl})` : ""}`; }
	static _getConvertedNameTableName (group, tableRaw) { return `${group.name} Names - ${tableRaw.option}`; }

	static _getConvertedEncounterOrNamesTable ({group, tableRaw, fnGetNameCaption, colLabel1}) {
		const nameCaption = fnGetNameCaption(group, tableRaw);
		return {
			name: nameCaption,
			source: group.source,
			page: group.page,
			caption: nameCaption,
			colLabels: [
				`d${tableRaw.diceType}`,
				colLabel1,
				tableRaw.rollAttitude ? `Attitude` : null,
			].filter(Boolean),
			colStyles: [
				"col-2 text-center",
				tableRaw.rollAttitude ? "col-8" : "col-10",
				tableRaw.rollAttitude ? `col-2 text-center` : null,
			].filter(Boolean),
			rows: tableRaw.table.map(it => [
				`${it.min}${it.max != null && it.max !== it.min ? `-${it.max}` : ""}`,
				it.result,
				tableRaw.rollAttitude ? it.resultAttitude || "\u2014" : null,
			].filter(Boolean)),
		};
	}

	// -----------------------
}
GenTables.BOOK_BLOCKLIST = {};
GenTables.ADVENTURE_ALLOWLIST = {
	[SRC_SKT]: true,
	[SRC_TTP]: true,
};

const generator = new GenTables();
module.exports = generator.pRun();

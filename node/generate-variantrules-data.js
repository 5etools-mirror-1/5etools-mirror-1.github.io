const fs = require("fs");
require("../js/utils");
const ut = require("./util");

class GenVariantrules {
	_doLoadAdventureData () {
		return ut.readJson(`./data/adventures.json`).adventure
			.map(idx => {
				if (GenVariantrules.ADVENTURE_WHITELIST[idx.id]) {
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
				if (!GenVariantrules.BOOK_BLACKLIST[idx.id]) {
					return {
						book: idx,
						bookData: JSON.parse(fs.readFileSync(`./data/book/book-${idx.id.toLowerCase()}.json`, "utf-8")),
					};
				}
			})
			.filter(it => it);
	}

	async pRun () {
		GenVariantrules._WALKER = MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST, isNoModification: true});

		const output = {variantrule: []};

		this._addBookAndAdventureData(output);

		const toSave = JSON.stringify({variantrule: output.variantrule});
		fs.writeFileSync(`./data/generated/gendata-variantrules.json`, toSave, "utf-8");
		console.log("Regenerated variant rules data.");
	}

	_addBookAndAdventureData (output) {
		const advDocs = this._doLoadAdventureData();
		const bookDocs = this._doLoadBookData();

		advDocs.forEach(doc => {
			const foundVariantrules = this._getAdventureBookVariantRules(
				doc,
				{
					headProp: "adventure",
					bodyProp: "adventureData",
					isRequireIncludes: true,
				},
			);
			if (!foundVariantrules) return;

			output.variantrule.push(...foundVariantrules);
		});

		bookDocs.forEach(doc => {
			const foundVariantrules = this._getAdventureBookVariantRules(
				doc,
				{
					headProp: "book",
					bodyProp: "bookData",
				},
			);
			if (!foundVariantrules) return;

			output.variantrule.push(...foundVariantrules);
		});
	}

	/**
	 * @param doc
	 * @param opts
	 * @param opts.headProp
	 * @param opts.bodyProp
	 * @param [opts.isRequireIncludes]
	 */
	_getAdventureBookVariantRules (doc, opts) {
		if (!doc[opts.bodyProp]) return;

		const out = [];

		GenVariantrules._WALKER.walk(
			doc[opts.bodyProp],
			{
				object: (obj) => {
					if (!obj.data?.variantRuleInclude) return;
					const variantRuleMeta = obj.data.variantRuleInclude;

					const cpy = MiscUtil.copy(obj);
					// region Cleanup
					delete cpy.data;
					GenVariantrules._WALKER.walk(
						cpy,
						{
							object: (obj) => {
								delete obj.id;
							},
						},
					);
					// endregion

					cpy.ruleType = variantRuleMeta.ruleType;
					cpy.source = doc[opts.headProp].source;

					out.push(cpy);
				},
			},
		);

		return out;
	}
}
GenVariantrules.BOOK_BLACKLIST = {};
GenVariantrules.ADVENTURE_WHITELIST = {};
GenVariantrules._WALKER = null;

const generator = new GenVariantrules();
module.exports = generator.pRun();

import "../js/parser.js";
import "../js/utils.js";
import "../js/render.js";
import "../js/render-dice.js";
import "../js/hist.js";
import "../js/utils-dataloader.js";
import * as utS from "../node/util-search-index.js";
import "../js/omnidexer.js";
import * as ut from "../node/util.js";
import {DataTesterBase, DataTester, ObjectWalker, BraceCheck, EscapeCharacterCheck} from "5etools-utils";

const TIME_TAG = "\tRun duration";
console.time(TIME_TAG);

const WALKER = MiscUtil.getWalker({
	keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
	isNoModification: true,
});

const ALL_URLS = new Set();

const CAT_ID_BLOCKLIST = new Set([
	Parser.CAT_ID_PAGE,
]);

class TagTestUtil {
	static _CLASS_SUBCLASS_LOOKUP = {};

	static async pInit () {
		await this._pInit_pPopulateUrls();
		await this._pInit_pPopulateClassSubclassIndex();
	}

	static async _pInit_pPopulateUrls () {
		const primaryIndex = Omnidexer.decompressIndex(await utS.UtilSearchIndex.pGetIndex({doLogging: false, noFilter: true}));
		primaryIndex
			.filter(it => !CAT_ID_BLOCKLIST.has(it.c))
			.forEach(it => ALL_URLS.add(`${UrlUtil.categoryToPage(it.c).toLowerCase()}#${(it.u).toLowerCase().trim()}`));
		const highestId = primaryIndex.last().id;
		const secondaryIndexItem = Omnidexer.decompressIndex(await utS.UtilSearchIndex.pGetIndexAdditionalItem({baseIndex: highestId + 1, doLogging: false}));
		secondaryIndexItem
			.filter(it => !CAT_ID_BLOCKLIST.has(it.c))
			.forEach(it => ALL_URLS.add(`${UrlUtil.categoryToPage(it.c).toLowerCase()}#${(it.u).toLowerCase().trim()}`));
	}

	static async _pInit_pPopulateClassSubclassIndex () {
		const classData = await DataUtil.class.loadJSON();

		const tmpClassIxFeatures = {};
		classData.class.forEach(cls => {
			cls.name = cls.name.toLowerCase();
			cls.source = (cls.source || Parser.SRC_PHB).toLowerCase();

			this._CLASS_SUBCLASS_LOOKUP[cls.source] = this._CLASS_SUBCLASS_LOOKUP[cls.source] || {};
			this._CLASS_SUBCLASS_LOOKUP[cls.source][cls.name] = {};

			const ixFeatures = [];
			cls.classFeatures.forEach((levelFeatures, ixLevel) => {
				levelFeatures.forEach((_, ixFeature) => {
					ixFeatures.push(`${ixLevel}-${ixFeature}`);
				});
			});
			MiscUtil.set(tmpClassIxFeatures, cls.source, cls.name, ixFeatures);
		});

		classData.subclass.forEach(sc => {
			sc.shortName = (sc.shortName || sc.name).toLowerCase();
			sc.source = (sc.source || sc.classSource).toLowerCase();
			sc.className = sc.className.toLowerCase();
			sc.classSource = sc.classSource.toLowerCase();

			if (sc.className === VeCt.STR_GENERIC.toLowerCase() && sc.classSource === VeCt.STR_GENERIC.toLowerCase()) return;

			this._CLASS_SUBCLASS_LOOKUP[sc.classSource][sc.className][sc.source] = this._CLASS_SUBCLASS_LOOKUP[sc.classSource][sc.className][sc.source] || {};
			this._CLASS_SUBCLASS_LOOKUP[sc.classSource][sc.className][sc.source][sc.shortName] = MiscUtil.copyFast(MiscUtil.get(tmpClassIxFeatures, sc.classSource, sc.className));
		});
	}

	static getSubclassFeatureIndex (className, classSource, subclassName, subclassSource) {
		classSource = classSource || Parser.getTagSource("class");
		subclassSource = subclassSource || Parser.SRC_PHB;

		className = className.toLowerCase();
		classSource = classSource.toLowerCase();
		subclassName = subclassName.toLowerCase();
		subclassSource = subclassSource.toLowerCase();

		return MiscUtil.get(this._CLASS_SUBCLASS_LOOKUP, classSource, className, subclassSource, subclassName);
	}
}

class GenericDataCheck extends DataTesterBase {
	static _doCheckSeeAlso ({entity, prop, tag, file}) {
		if (!entity[prop]) return;

		const defaultSource = Parser.getTagSource(tag).toLowerCase();

		const deduped = entity[prop].map(it => {
			it = it.toLowerCase();
			if (!it.includes("|")) it += `|${defaultSource}`;
			return it;
		}).unique();
		if (deduped.length !== entity[prop].length) {
			this._addMessage(`Duplicate "${prop}" in ${file} for ${entity.source}, ${entity.name}\n`);
		}

		entity[prop].forEach(s => {
			const url = getEncoded(s, tag);
			if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${s} in file ${file} (evaluates to "${url}") in "${prop}"\nSimilar URLs were:\n${getSimilar(url)}\n`);
		});
	}

	static _testAdditionalSpells_testSpellExists (file, spellOrObj) {
		if (typeof spellOrObj === "object") {
			if (spellOrObj.choose || spellOrObj.all) {
				// e.g. "level=0|class=Sorcerer"
				// (no-op)
			} else throw new Error(`Unhandled additionalSpells special object: ${JSON.stringify(spellOrObj)}`);

			return;
		}

		spellOrObj = spellOrObj.split("#")[0]; // An optional "cast at spell level" can be added with a "#", remove it
		const url = getEncoded(spellOrObj, "spell");

		if (!ALL_URLS.has(url)) {
			this._addMessage(`Missing link: ${url} in file ${file} (evaluates to "${url}") in "additionalSpells"\nSimilar URLs were:\n${getSimilar(url)}\n`);
		}
	}

	static _ADDITIONAL_SPELLS_IGNORED_KEYS = new Set([
		"ability",
		"name",
		"resourceName",
	]);

	static _testAdditionalSpells (file, obj) {
		if (!obj.additionalSpells) return;
		obj.additionalSpells
			.forEach(additionalSpellOption => {
				Object.entries(additionalSpellOption)
					.forEach(([k, levelToSpells]) => {
						if (this._ADDITIONAL_SPELLS_IGNORED_KEYS.has(k)) return;

						Object.values(levelToSpells).forEach(spellListOrMeta => {
							if (spellListOrMeta instanceof Array) {
								return spellListOrMeta.forEach(sp => this._testAdditionalSpells_testSpellExists(file, sp));
							}

							Object.entries(spellListOrMeta)
								.forEach(([prop, val]) => {
									switch (prop) {
										case "daily":
										case "rest":
										case "resource":
											Object.values(val).forEach(spellList => spellList.forEach(sp => this._testAdditionalSpells_testSpellExists(file, sp)));
											break;
										case "will":
										case "ritual":
										case "_":
											val.forEach(sp => this._testAdditionalSpells_testSpellExists(file, sp));
											break;
										default: throw new Error(`Unhandled additionalSpells prop "${prop}"`);
									}
								});
						});
					});
			});
	}

	static _testAdditionalFeats (file, obj) {
		if (!obj.feats) return;

		obj.feats.forEach(featsObj => {
			Object.entries(featsObj)
				.forEach(([k, v]) => {
					if (k === "any") return;

					const url = getEncoded(k, "feat");
					if (!ALL_URLS.has(url)) {
						this._addMessage(`Missing link: ${url} in file ${file} (evaluates to "${url}") in "feats"\nSimilar URLs were:\n${getSimilar(url)}\n`);
					}
				});
		});
	}

	static _testReprintedAs (file, obj, tag) {
		if (!obj.reprintedAs) return;

		obj.reprintedAs
			.forEach(rep => {
				const _tag = rep.tag ?? tag;
				const _uid = rep.uid ?? rep;

				const url = getEncoded(_uid, _tag);
				if (!ALL_URLS.has(url)) {
					this._addMessage(`Missing link: ${url} in file ${file} (evaluates to "${url}") in "feats"\nSimilar URLs were:\n${getSimilar(url)}\n`);
				}
			});
	}
}

function getSimilar (url) {
	// scan for a list of similar entries, to aid debugging
	const similarUrls = [];
	const similar = /^\w+\.html#\w+/.exec(url);
	Array.from(ALL_URLS).forEach(it => {
		if (similar && it.startsWith(similar[0])) similarUrls.push(it);
	});
	return JSON.stringify(similarUrls, null, 2);
}

function getEncoded (str, tag) {
	const [name, source] = str.split("|");
	return `${Renderer.tag.getPage(tag)}#${UrlUtil.encodeForHash([name, Parser.getTagSource(tag, source)])}`.toLowerCase().trim();
}

function getEncodedDeity (str, tag) {
	const [name, pantheon, source] = str.split("|");
	return `${Renderer.tag.getPage(tag)}#${UrlUtil.encodeForHash([name, pantheon, Parser.getTagSource(tag, source)])}`.toLowerCase().trim();
}

class LinkCheck extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		let match;
		while ((match = LinkCheck.RE.exec(str))) {
			const tag = match[1];
			const parts = match[2].split("|");

			const toEncode = [];

			switch (tag) {
				case "deity": {
					toEncode.push(parts[0], parts[1] || "forgotten realms", Parser.getTagSource(tag, parts[2]));
					break;
				}
				case "card": {
					toEncode.push(parts[0], parts[1] || "none", Parser.getTagSource(tag, parts[2]));
					break;
				}
				case "classFeature": {
					const {name, source, className, classSource, level} = DataUtil.class.unpackUidClassFeature(match[2]);
					toEncode.push(name, className, classSource, level, source);
					break;
				}
				case "subclassFeature": {
					const {name, source, className, classSource, subclassShortName, subclassSource, level} = DataUtil.class.unpackUidSubclassFeature(match[2]);
					toEncode.push(name, className, classSource, subclassShortName, subclassSource, level, source);
					break;
				}
				default: {
					toEncode.push(parts[0], Parser.getTagSource(tag, parts[1]));
					break;
				}
			}

			const url = `${Renderer.tag.getPage(tag)}#${UrlUtil.encodeForHash(toEncode)}`.toLowerCase().trim()
				.replace(/%5c/gi, ""); // replace slashes
			if (!ALL_URLS.has(url)) {
				this._addMessage(`Missing link: ${match[0]} in file ${filePath} (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
			}
		}
	}
}
LinkCheck._RE_TAG_BLOCKLIST = new Set(["quickref"]);
LinkCheck.RE = RegExp(`{@(${Renderer.tag.TAGS.filter(it => it.defaultSource).map(it => it.tagName).filter(tag => !LinkCheck._RE_TAG_BLOCKLIST.has(tag)).join("|")}) ([^}]*?)}`, "g");

class ClassLinkCheck extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		// e.g. "{@class fighter|phb|and class feature added|Eldritch Knight|phb|2-0}"

		let match;
		while ((match = ClassLinkCheck.RE.exec(str))) {
			const className = match[1];
			const classSource = match[3];
			const subclassShortName = match[7];
			const subclassSource = match[9];
			const ixFeature = match[11];

			if (!subclassShortName) return; // Regular tags will be handled by the general tag checker

			const featureIndex = TagTestUtil.getSubclassFeatureIndex(className, classSource, subclassShortName, subclassSource);
			if (!featureIndex) {
				this._addMessage(`Missing subclass link: ${match[0]} in file ${filePath} -- could not find subclass with matching shortname/source\n`);
			}

			if (featureIndex && ixFeature && !featureIndex.includes(ixFeature)) {
				this._addMessage(`Malformed subclass link: ${match[0]} in file ${filePath} -- feature index "${ixFeature}" was outside expected range\n`);
			}
		}
	}
}
ClassLinkCheck.RE = /{@class (.*?)(\|(.*?))?(\|(.*?))?(\|(.*?))?(\|(.*?))?(\|(.*?))?(\|(.*?))?}/g;

class ItemDataCheck extends GenericDataCheck {
	static _checkArrayDuplicates (file, name, source, arr, prop, tag) {
		const asUrls = arr
			.map(it => {
				if (it.item) it = it.item;
				if (it.special) return null;

				return getEncoded(it, tag);
			})
			.filter(Boolean);

		if (asUrls.length !== new Set(asUrls).size) {
			this._addMessage(`Duplicate ${prop} in ${file} for ${source}, ${name}: ${asUrls.filter(s => asUrls.filter(it => it === s).length > 1).join(", ")}\n`);
		}
	}

	static _checkArrayItemsExist (file, name, source, arr, prop, tag) {
		arr.forEach(s => {
			if (s.item) s = s.item;
			if (s.special) return;

			const url = getEncoded(s, tag);
			if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${s} in file ${file} (evaluates to "${url}") in "${prop}"\nSimilar URLs were:\n${getSimilar(url)}\n`);
		});
	}

	static _checkReqAttuneTags (file, root, name, source, prop) {
		const tagsArray = root[prop];

		tagsArray.forEach(tagBlock => {
			Object.entries(tagBlock)
				.forEach(([prop, val]) => {
					switch (prop) {
						case "background":
						case "race":
						case "class": {
							const url = getEncoded(val, prop);
							if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${val} in file ${file} "${prop}" (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
						}
					}
				});
		});
	}

	static _checkRoot (file, root, name, source) {
		if (!root) return;

		if (root.attachedSpells) {
			ItemDataCheck._checkArrayDuplicates(file, name, source, root.attachedSpells, "attachedSpells", "spell");
			ItemDataCheck._checkArrayItemsExist(file, name, source, root.attachedSpells, "attachedSpells", "spell");
		}

		if (root.optionalfeatures) {
			ItemDataCheck._checkArrayDuplicates(file, name, source, root.optionalfeatures, "optionalfeatures", "optfeature");
			ItemDataCheck._checkArrayItemsExist(file, name, source, root.optionalfeatures, "optionalfeatures", "optfeature");
		}

		if (root.items) {
			ItemDataCheck._checkArrayDuplicates(file, name, source, root.items, "items", "item");
			ItemDataCheck._checkArrayItemsExist(file, name, source, root.items, "items", "item");
		}

		if (root.packContents) {
			ItemDataCheck._checkArrayDuplicates(file, name, source, root.packContents, "packContents", "item");
			ItemDataCheck._checkArrayItemsExist(file, name, source, root.packContents, "packContents", "item");
		}

		if (root.containerCapacity && root.containerCapacity.item) {
			root.containerCapacity.item.forEach(itemToCount => {
				ItemDataCheck._checkArrayItemsExist(file, name, source, Object.keys(itemToCount), "containerCapacity", "item");
			});
		}

		if (root.ammoType) {
			ItemDataCheck._checkArrayItemsExist(file, name, source, [root.ammoType], "ammoType", "item");
		}

		if (root.baseItem) {
			const url = `${Renderer.tag.getPage("item")}#${UrlUtil.encodeForHash(root.baseItem.split("|"))}`
				.toLowerCase()
				.trim()
				.replace(/%5c/gi, "");

			if (!ALL_URLS.has(url)) {
				this._addMessage(`Missing link: ${root.baseItem} in file ${file} (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
			}
		}

		this._doCheckSeeAlso({entity: root, prop: "seeAlsoDeck", tag: "deck", file});
		this._doCheckSeeAlso({entity: root, prop: "seeAlsoVehicle", tag: "vehicle", file});

		if (root.reqAttuneTags) this._checkReqAttuneTags(file, root, name, source, "reqAttuneTags");
		if (root.reqAttuneAltTags) this._checkReqAttuneTags(file, root, name, source, "reqAttuneAltTags");
	}

	static pRun () {
		const basicItems = ut.readJson(`./data/items-base.json`);
		basicItems.baseitem.forEach(it => this._checkRoot("data/items-base.json", it, it.name, it.source));

		const items = ut.readJson(`./data/items.json`);
		items.item.forEach(it => this._checkRoot("data/items.json", it, it.name, it.source));
		items.itemGroup.forEach(it => this._checkRoot("data/items.json", it, it.name, it.source));

		const magicVariants = ut.readJson(`./data/magicvariants.json`);
		magicVariants.magicvariant.forEach(va => this._checkRoot("data/magicvariants.json", va, va.name, va.source) || (va.inherits && this._checkRoot("data/magicvariants.json", va.inherits, `${va.name} (inherits)`, va.source)));
	}
}

class ActionDataCheck extends GenericDataCheck {
	static pRun () {
		const file = `data/actions.json`;
		const actions = ut.readJson(`./${file}`);
		actions.action.forEach(it => {
			if (it.fromVariant) {
				const url = getEncoded(it.fromVariant, "variantrule");
				if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${it.fromVariant} in file ${file} (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
			}

			this._doCheckSeeAlso({entity: it, prop: "seeAlsoAction", tag: "action", file});
		});
	}
}

class DeityDataCheck extends GenericDataCheck {
	static pRun () {
		const file = `data/deities.json`;
		const deities = ut.readJson(`./${file}`);
		deities.deity.forEach(it => {
			if (!it.customExtensionOf) return;

			const url = getEncodedDeity(it.customExtensionOf, "deity");
			if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${it.customExtensionOf} in file ${file} (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
		});
	}
}

class FilterCheck extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		str.replace(/{@filter ([^}]*)}/g, (m0, m1) => {
			const spl = m1.split("|");
			if (spl.length < 3) {
				this._addMessage(`Invalid filter tag in file ${filePath}: "${str}" was too short!\n`);
				return m0;
			}

			if (!UrlUtil.pageToDisplayPage(`${spl[1]}.html`)) {
				this._addMessage(`Invalid filter tag in file ${filePath}: unknown page in "${str}"\n`);
			}

			const missingEq = [];
			for (let i = 2; i < spl.length; ++i) {
				const part = spl[i];
				if (!part.includes("=")) {
					missingEq.push(part);
				}

				const hasOpenRange = part.startsWith("[");
				const hasCloseRange = part.startsWith("]");
				if (hasOpenRange || hasCloseRange) {
					if (!(hasOpenRange && hasCloseRange)) {
						this._addMessage(`Invalid filter tag in file ${filePath}: malformed range expression in  "${str}"\n`);
					}

					const [header, values] = part.split("=");
					const valuesSpl = values.replace(/^\[/, "").replace(/]$/, "").split(";");
					if (valuesSpl.length > 2) {
						this._addMessage(`Invalid filter tag in file ${filePath}: too many values in range expression in "${str}" (expected 1-2)\n`);
					}
				}
			}
			if (missingEq.length) {
				this._addMessage(`Invalid filter tag in file ${filePath}: missing equals in "${str}" in part${missingEq.length > 1 ? "s" : ""} ${missingEq.join(", ")}\n`);
			}

			return m0;
		});
	}
}

class ScaleDiceCheck extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		str.replace(/{@(scaledice|scaledamage) ([^}]*)}/g, (m0, m1, m2) => {
			const spl = m2.split("|");
			if (spl.length < 3) {
				this._addMessage(`${m1} tag "${str}" was too short!\n`);
			} else if (spl.length > 4) {
				this._addMessage(`${m1} tag "${str}" was too long!\n`);
			} else {
				let range;
				try {
					range = MiscUtil.parseNumberRange(spl[1], 1, 9);
				} catch (e) {
					this._addMessage(`Range "${spl[1]}" is invalid!\n`);
					return;
				}
				if (range.size < 2) this._addMessage(`Invalid scaling dice in file ${filePath}: range "${spl[1]}" has too few entries! Should be 2 or more.\n`);
				if (spl[4] && spl[4] !== "psi") this._addMessage(`Unknown mode "${spl[4]}".\n`);
			}
			return m0;
		});
	}
}

class StripTagTest extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		if (filePath === "./data/bestiary/traits.json") return;

		try {
			Renderer.stripTags(str);
		} catch (e) {
			if (!StripTagTest._seenErrors.has(e.message)) {
				StripTagTest._seenErrors.add(e.message);
				this._addMessage(`Tag stripper error: ${e.message} (${filePath})\n`);
			}
		}
	}
}
StripTagTest._seenErrors = new Set();

class TableDiceTest extends DataTesterBase {
	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		parsedJsonChecker.addPrimitiveHandler("object", this._checkTable.bind(this));
	}

	static _checkTable (obj, {filePath}) {
		if (obj.type !== "table") return;

		const autoRollMode = Renderer.table.getAutoConvertedRollMode(obj);
		if (!autoRollMode) return;

		const toRenderLabel = autoRollMode ? RollerUtil.getFullRollCol(obj.colLabels[0]) : null;
		const isInfiniteResults = autoRollMode === RollerUtil.ROLL_COL_VARIABLE;

		const possibleResults = new Set();
		const errors = [];
		const cbErr = (cell, e) => this._addMessage(`Row parse failed! Cell was: "${JSON.stringify(cell)}"; error was: "${e.message}"\n`);

		const len = obj.rows.length;
		obj.rows.forEach((r, i) => {
			const row = Renderer.getRollableRow(r, {cbErr, isForceInfiniteResults: isInfiniteResults, isFirstRow: i === 0, isLastRow: i === len - 1});
			const cell = row[0].roll;
			if (!cell) return;
			if (cell.exact != null) {
				if (cell.exact === 0 && cell.pad) cell.exact = 100;
				if (possibleResults.has(cell.exact)) errors.push(`"exact" value "${cell.exact}" was repeated!`);
				possibleResults.add(cell.exact);
			} else {
				if (cell.max === 0) cell.max = 100;
				// convert inf to a reasonable range (no official table goes to 999+ or into negatives as of 2020-09-19)
				if (cell.min === -Renderer.dice.POS_INFINITE) cell.min = cell.displayMin; // Restore the original minimum
				if (cell.max === Renderer.dice.POS_INFINITE) cell.max = TableDiceTest._INF_CAP;
				for (let i = cell.min; i <= cell.max; ++i) {
					if (possibleResults.has(i)) {
						// if the table is e.g. 0-110, avoid double-counting the 0
						if (!(i === 100 && cell.max > 100)) errors.push(`"min-max" value "${i}" was repeated!`);
					}
					possibleResults.add(i);
				}
			}
		});

		const tmpParts = [];
		let cleanHeader = toRenderLabel
			.trim()
			.replace(/^{@dice ([^}]+)}/g, (...m) => {
				tmpParts.push(m[1]);
				return `__TMP_DICE__${tmpParts.length - 1}__`;
			});
		cleanHeader = Renderer.stripTags(cleanHeader).replace(/__TMP_DICE__(\d+)__/g, (...m) => tmpParts[Number(m[1])]);
		const possibleRolls = new Set();
		let hasPrompt = false;

		cleanHeader.split(";").forEach(rollable => {
			if (rollable.includes("#$prompt_")) hasPrompt = true;

			const wrpRollTree = Renderer.dice.lang.getTree3(rollable);
			if (wrpRollTree) {
				const min = wrpRollTree.tree.min({});
				const max = wrpRollTree.tree.max({});
				for (let i = min; i < max + 1; ++i) possibleRolls.add(i);
			} else {
				if (!hasPrompt) errors.push(`${JSON.stringify(obj.colLabels[0])} was not a valid rollable header?!`);
			}
		});

		if (!CollectionUtil.setEq(possibleResults, possibleRolls) && !hasPrompt) {
			errors.push(`Possible results did not match possible rolls!\nPossible results: (${TableDiceTest._flattenSequence([...possibleResults])})\nPossible rolls: (${TableDiceTest._flattenSequence([...possibleRolls])})`);
		}

		if (errors.length) this._addMessage(`Errors in ${obj.caption ? `table "${obj.caption}"` : `${JSON.stringify(obj.rows[0]).substring(0, 30)}...`} in ${filePath}:\n${errors.map(it => `\t${it}`).join("\n")}\n`);
	}

	static _flattenSequence (nums) {
		const out = [];
		let l = null; let r = null;
		nums.sort(SortUtil.ascSort).forEach(n => {
			if (l == null) {
				l = n;
				r = n;
			} else if (n === (r + 1)) {
				r = n;
			} else {
				if (l === r) out.push(`${l}`);
				else out.push(`${l}-${r}`);
				l = n;
				r = n;
			}
		});
		if (l === r) out.push(`${l}`);
		else out.push(`${l}-${r}`);
		return out.join(", ");
	}
}
TableDiceTest._INF_CAP = 999;

class AreaCheck extends DataTesterBase {
	static registerParsedFileCheckers (parsedJsonChecker) {
		parsedJsonChecker.registerFileHandler(this);
	}

	static _buildMap (file, data) {
		AreaCheck.headerMap = Renderer.adventureBook.getEntryIdLookup(data, false);
	}

	static _checkString (str) {
		str.replace(/{@area ([^}]*)}/g, (m0, m1) => {
			const [text, areaId, ...otherData] = m1.split("|");
			if (!AreaCheck.headerMap[areaId]) {
				AreaCheck.errorSet.add(m0);
			}
			return m0;
		});
	}

	static handleFile (file, contents) {
		if (!AreaCheck.fileMatcher.test(file)) return;

		AreaCheck.errorSet = new Set();
		AreaCheck._buildMap(file, contents.data);
		ObjectWalker.walk({
			obj: contents,
			filePath: file,
			primitiveHandlers: {
				string: this._checkString.bind(this),
			},
		});
		if (AreaCheck.errorSet.size) {
			this._addMessage(`Errors in ${file}! See below:\n`);

			const toPrint = [...AreaCheck.errorSet].sort(SortUtil.ascSortLower);
			toPrint.forEach(tp => this._addMessage(`${tp}\n`));
		}

		if (AreaCheck.headerMap.__BAD) {
			AreaCheck.headerMap.__BAD.forEach(dupId => this._addMessage(`Duplicate ID: "${dupId}"\n`));
		}
	}
}
AreaCheck.errorSet = new Set();
AreaCheck.fileMatcher = /\/(adventure-).*\.json/;

class LootDataCheck extends GenericDataCheck {
	static pRun () {
		function handleItem (it) {
			const toCheck = typeof it === "string" ? {name: it, source: Parser.SRC_DMG} : it;
			const url = `${Renderer.tag.getPage("item")}#${UrlUtil.encodeForHash([toCheck.name, toCheck.source])}`.toLowerCase().trim();
			if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${JSON.stringify(it)} in file "${LootDataCheck.file}" (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
		}

		const loot = ut.readJson(`./${LootDataCheck.file}`);
		loot.magicItems.forEach(it => {
			if (it.table) {
				it.table.forEach(row => {
					if (row.choose) {
						if (row.choose.fromGeneric) {
							row.choose.fromGeneric.forEach(handleItem);
						}

						if (row.choose.fromGroup) {
							row.choose.fromGroup.forEach(handleItem);
						}

						if (row.choose.fromItems) {
							row.choose.fromItems.forEach(handleItem);
						}
					}
				});
			}
		});
	}
}
LootDataCheck.file = `data/loot.json`;

class ClassDataCheck extends GenericDataCheck {
	static _doCheckClass (file, data, cls) {
		// region Check `classFeatures` -> `classFeature` links
		const featureLookup = {};
		(data.classFeature || []).forEach(cf => {
			const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](cf);
			featureLookup[hash] = true;
		});

		cls.classFeatures.forEach(ref => {
			const uid = ref.classFeature || ref;
			const unpacked = DataUtil.class.unpackUidClassFeature(uid, {isLower: true});
			const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](unpacked);
			if (!featureLookup[hash]) this._addMessage(`Missing class feature: ${uid} in file ${file} not found in the files "classFeature" array\n`);
		});

		const handlersNestedRefsClass = {
			array: (arr) => {
				arr.forEach(it => {
					if (it.type !== "refClassFeature") return;

					const uid = it.classFeature || it;
					const unpacked = DataUtil.class.unpackUidClassFeature(uid, {isLower: true});
					const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](unpacked);

					if (!featureLookup[hash]) this._addMessage(`Missing class feature: ${uid} in file ${file} not found in the files "classFeature" array\n`);
				});
				return arr;
			},
		};
		(data.classFeature || []).forEach(cf => {
			WALKER.walk(cf.entries, handlersNestedRefsClass);
		});
		// endregion

		// region Referenced optional features
		const handlersNestedRefsOptionalFeatures = {
			array: (arr) => {
				arr.forEach(it => {
					if (it.type !== "refOptionalfeature") return;

					const url = getEncoded(it.optionalfeature, "optfeature");
					if (!ALL_URLS.has(url)) this._addMessage(`Missing optional feature: ${it.optionalfeature} in file ${file} (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
				});
				return arr;
			},
		};
		(data.classFeature || []).forEach(cf => {
			WALKER.walk(cf.entries, handlersNestedRefsOptionalFeatures);
		});
		(data.subclassFeature || []).forEach(scf => {
			WALKER.walk(scf.entries, handlersNestedRefsOptionalFeatures);
		});
		// endregion
	}

	static _doCheckSubclass (file, data, subclassFeatureLookup, sc) {
		if (sc._copy && !sc.subclassFeatures) return;

		sc.subclassFeatures.forEach(ref => {
			const uid = ref.subclassFeature || ref;
			const unpacked = DataUtil.class.unpackUidSubclassFeature(uid, {isLower: true});
			const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](unpacked);

			if (!subclassFeatureLookup[hash]) this._addMessage(`Missing subclass feature: ${uid} in file ${file} not found in the files "subclassFeature" array\n`);
		});

		this._testAdditionalSpells(file, sc);
	}

	static pRun () {
		const index = ut.readJson("./data/class/index.json");
		Object.values(index)
			.map(filename => ({filename: filename, data: ut.readJson(`./data/class/${filename}`)}))
			.forEach(({filename, data}) => {
				this._run_handleFileClasses({filename, data});
				this._run_handleFileSubclasses({filename, data});
			});
	}

	static _run_handleFileClasses ({filename, data}) {
		(data.class || []).forEach(cls => ClassDataCheck._doCheckClass(filename, data, cls));
	}

	static _run_handleFileSubclasses ({filename, data}) {
		if (!data.subclass) return;

		const subclassFeatureLookup = {};
		(data.subclassFeature || []).forEach(scf => {
			const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](scf);
			subclassFeatureLookup[hash] = true;
		});

		data.subclass.forEach(sc => this._doCheckSubclass(filename, data, subclassFeatureLookup, sc));

		// Check `subclassFeatures` -> `subclassFeature` links
		const handlersNestedRefsSubclass = {
			array: (arr) => {
				arr.forEach(it => {
					if (it.type !== "refSubclassFeature") return;

					const uid = it.subclassFeature || it;
					const unpacked = DataUtil.class.unpackUidSubclassFeature(uid, {isLower: true});
					const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](unpacked);

					if (!subclassFeatureLookup[hash]) this._addMessage(`Missing subclass feature in "refSubclassFeature": ${it.subclassFeature} in file ${filename} not found in the files "subclassFeature" array\n`);
				});
				return arr;
			},
		};
		(data.subclassFeature || []).forEach(scf => {
			WALKER.walk(scf.entries, handlersNestedRefsSubclass);
		});
	}
}

class RaceDataCheck extends GenericDataCheck {
	static _handleRaceOrSubraceRaw (file, rsr, r) {
		this._testAdditionalSpells(file, rsr);
		this._testAdditionalFeats(file, rsr);
		this._testReprintedAs(file, rsr, "race");
	}

	static pRun () {
		const file = `data/races.json`;
		const races = ut.readJson(`./${file}`);
		races.race.forEach(r => this._handleRaceOrSubraceRaw(file, r));
		races.subrace.forEach(sr => this._handleRaceOrSubraceRaw(file, sr));
	}
}

class FeatDataCheck extends GenericDataCheck {
	static _handleFeat (file, feat) {
		this._testAdditionalSpells(file, feat);
	}

	static pRun () {
		const file = `data/feats.json`;
		const featJson = ut.readJson(`./${file}`);
		featJson.feat.forEach(f => this._handleFeat(file, f));
	}
}

class BackgroundDataCheck extends GenericDataCheck {
	static _handleBackground (file, bg) {
		this._testAdditionalSpells(file, bg);
		this._testAdditionalFeats(file, bg);
	}

	static pRun () {
		const file = `data/backgrounds.json`;
		const backgroundJson = ut.readJson(`./${file}`);
		backgroundJson.background.forEach(f => this._handleBackground(file, f));
	}
}

class BestiaryDataCheck extends GenericDataCheck {
	static _handleCreature (file, mon) {
		this._testReprintedAs(file, mon, "creature");

		if (mon.summonedBySpell) {
			const url = getEncoded(mon.summonedBySpell, "spell");
			if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${mon.summonedBySpell} in file ${file} "summonedBySpell" (evaluates to "${url}")\nSimilar URLs were:\n${getSimilar(url)}\n`);
		}
	}

	static pRun () {
		const index = ut.readJson(`data/bestiary/index.json`, "utf-8");
		const fileMetas = Object.values(index)
			.map(filename => {
				const file = `data/bestiary/${filename}`;
				return {
					file,
					contents: ut.readJson(file, "utf-8"),
				};
			});
		fileMetas.forEach(({file, contents}) => {
			(contents.monster || []).forEach(mon => this._handleCreature(file, mon));
		});
	}
}

class DeckDataCheck extends GenericDataCheck {
	static _handleDeck (file, deck) {
		(deck.cards || [])
			.forEach(cardMeta => {
				const uid = typeof cardMeta === "string" ? cardMeta : cardMeta.uid;
				const unpacked = DataUtil.deck.unpackUidCard(uid, {isLower: true});
				const hash = UrlUtil.URL_TO_HASH_BUILDER["card"](unpacked);
				const url = `card#${hash}`.toLowerCase().trim();
				if (!ALL_URLS.has(url)) this._addMessage(`Missing link: ${uid} in file ${file} (evaluates to "${url}") in "cards"\nSimilar URLs were:\n${getSimilar(url)}\n`);
			});
	}

	static pRun () {
		const file = `data/decks.json`;
		const featJson = ut.readJson(`./${file}`);
		featJson.deck.forEach(f => this._handleDeck(file, f));
	}
}

class CultsBoonsDataCheck extends GenericDataCheck {
	static _handleEntity (file, cb, prop) {
		this._testReprintedAs(file, cb, prop);
	}

	static pRun () {
		const file = `data/cultsboons.json`;
		const json = ut.readJson(`./${file}`);
		json.cult.forEach(ent => this._handleEntity(file, ent, "cult"));
		json.boon.forEach(ent => this._handleEntity(file, ent, "boon"));
	}
}

class DuplicateEntityCheck extends DataTesterBase {
	static registerParsedFileCheckers (parsedJsonChecker) {
		parsedJsonChecker.registerFileHandler(this);
	}

	static handleFile (file, contents, {isSkipVersionCheck = false, isSkipBaseCheck = false} = {}) {
		DuplicateEntityCheck.errors = [];

		if (file.endsWith("data/races.json") && !isSkipVersionCheck) {
			// First, run check for races on the raw race/subrace data
			this.handleFile(file, contents, {isSkipVersionCheck: true});

			// Then, merge races+subraces, so we can run a check on versions
			contents = MiscUtil.copyFast(contents);
			contents = DataUtil.race.getPostProcessedSiteJson(contents);
			isSkipBaseCheck = true;
		}

		Object.entries(contents)
			.filter(([_, arr]) => arr instanceof Array)
			.forEach(([prop, arr]) => {
				const positions = {};
				arr.forEach((ent, i) => {
					isSkipBaseCheck || this._doAddPosition({prop, ent, ixArray: i, positions});

					if (!ent._versions) return;

					isSkipVersionCheck || DataUtil.proxy.getVersions(prop, ent)
						.forEach((entVer, j) => {
							this._doAddPosition({prop, ent: entVer, ixArray: i, ixVersion: j, positions});
						});
				});

				if (Object.keys(positions).length) {
					const withDuplicates = Object.entries(positions)
						.filter(([, v]) => v.length > 1);
					if (withDuplicates.length) {
						this._addMessage(`Duplicate entity keys in ${file} array .${prop}! See below:\n`);
						withDuplicates.forEach(([k, v]) => {
							this._addMessage(`\t${k} (at indexes ${v.join(", ")})\n`);
						});
					}
				}
			});
	}

	static _doAddPosition ({prop, ent, ixArray, ixVersion, positions}) {
		const keyIx = [ixArray, ixVersion].filter(it => it != null).join("-v");

		const name = ent.name;
		const source = SourceUtil.getEntitySource(ent);

		switch (prop) {
			case "deity": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.pantheon} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "card": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.set} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "subclass": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.classSource} :: ${ent.className} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "classFeature": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.level} :: ${ent.classSource} :: ${ent.className} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "subclassFeature": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.level} :: ${ent.classSource} :: ${ent.className} :: ${ent.subclassSource} :: ${ent.subclassShortName} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "raceFeature": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.raceSource} :: ${ent.raceName} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			case "subrace": {
				if (name != null && source != null) {
					const key = `${source} :: ${ent.raceSource} :: ${ent.raceName} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
			default: {
				if (name != null && source != null) {
					const key = `${source} :: ${name}`;
					(positions[key] = positions[key] || []).push(keyIx);
				}
				break;
			}
		}
	}
}

class RefTagCheck extends DataTesterBase {
	static registerParsedFileCheckers (parsedJsonChecker) {
		parsedJsonChecker.registerFileHandler(this);
	}

	static handleFile (file, contents) {
		Object.entries(contents)
			.filter(([_, arr]) => arr instanceof Array)
			.forEach(([prop, arr]) => {
				arr.forEach(ent => {
					if (!ent.hasRefs) return;
					WALKER.walk(
						ent,
						{
							object: (obj) => {
								if (!obj.type || !RefTagCheck._RE_TAG.test(obj.type)) return;
								const prop = obj.type.slice(3).lowercaseFirst();
								RefTagCheck._TO_CHECK.push(`{#${prop} ${obj[prop]}}`);
							},
							string: (str) => {
								if (!str.startsWith("{#") || !str.endsWith("}")) return;
								RefTagCheck._TO_CHECK.push(str);
							},
						},
					);
				});
			});
	}

	static async pPostRun () {
		if (!RefTagCheck._TO_CHECK.length) return;

		for (const toCheck of RefTagCheck._TO_CHECK) {
			const toCheckMeta = Renderer.hover.getRefMetaFromTag(toCheck);

			const prop = toCheckMeta.type.slice(3).lowercaseFirst();

			const refUnpacked = DataUtil.generic.unpackUid(toCheckMeta[prop], prop);
			const refHash = UrlUtil.URL_TO_HASH_BUILDER[prop](refUnpacked);

			const cpy = await DataLoader.pCacheAndGetHash(prop, refHash, {isCopy: true});
			if (!cpy) {
				this._addMessage(`Missing ref tag: ${toCheck}\n`);
			}
		}
	}
}
RefTagCheck._RE_TAG = /^ref[A-Z]/;
RefTagCheck._TO_CHECK = [];

class TestCopyCheck extends DataTesterBase {
	static registerParsedFileCheckers (parsedJsonChecker) {
		parsedJsonChecker.registerFileHandler(this);
	}

	static handleFile (file, contents) {
		if (!contents._meta) return;

		const fileErrors = [];

		Object.entries(contents)
			.forEach(([prop, arr]) => {
				if (!(arr instanceof Array)) return;

				const propNoFluff = prop.replace(/Fluff$/, "");
				const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[prop] || UrlUtil.URL_TO_HASH_BUILDER[propNoFluff];
				if (!hashBuilder) return;

				arr.forEach(ent => {
					if (!ent._copy) return;

					const hash = hashBuilder(ent);
					const hashCopy = hashBuilder(ent._copy);

					if (hash !== hashCopy) return;

					fileErrors.push({prop, hash, ent});
				});
			});

		if (!fileErrors.length) return;

		this._addMessage(`Self-referencing _copy hashes in ${file}! See below:\n`);
		fileErrors.forEach(({prop, hash, ent}) => {
			this._addMessage(`\t${prop} "${ent.name}" with hash "${hash}"\n`);
		});
	}
}

class HasFluffCheck extends GenericDataCheck {
	static _LEN_PAD_HASH = 70;

	static async pRun () {
		const withLoaders = Object.entries(DataUtil)
			.filter(([, impl]) => Object.getPrototypeOf(impl).name !== "_DataUtilPropConfig" && impl.loadJSON);

		const metas = {};

		for (const [prop, impl] of withLoaders) {
			const isFluff = prop.endsWith("Fluff");
			const propBase = isFluff ? prop.replace(/Fluff$/, "") : prop;

			const allData = await impl.loadJSON({isAddBaseRaces: true});

			const tgt = (metas[propBase] = metas[propBase] || {});
			tgt.prop = propBase;
			tgt.page = impl.PAGE;

			if (isFluff) {
				tgt.propFluff = prop;
				tgt.dataFluff = allData;
				tgt.dataFluffUnmerged = await impl.loadUnmergedJSON();
			} else {
				tgt.data = allData;
			}
		}

		const [metasWithFluff] = Object.values(metas)
			.segregate(it => it.propFluff);

		for (const {prop, propFluff, dataFluff, dataFluffUnmerged, data, page} of metasWithFluff) {
			const fluffLookup = dataFluff[propFluff]
				.mergeMap(flf => ({
					[UrlUtil.URL_TO_HASH_BUILDER[page](flf)]: {
						hasFluff: !!flf.entries,
						hasFluffImages: !!flf.images,
					},
				}));

			// Tag parent fluff, so we can ignore e.g. "unused" fluff which is only used by `_copy`s
			dataFluffUnmerged[propFluff].forEach(flfUm => {
				if (!flfUm._copy) return;
				const hashParent = UrlUtil.URL_TO_HASH_BUILDER[page](flfUm._copy);
				// Track fluff vs. images, as e.g. the child overwriting the images means we don't use the parent images
				fluffLookup[hashParent].isCopiedFluff = !flfUm.entries;
				fluffLookup[hashParent].isCopiedFluffImages = !flfUm.images;
			});

			data[prop].forEach(ent => {
				if (!ent.hasFluff && !ent.hasFluffImages) return;

				const hash = UrlUtil.URL_TO_HASH_BUILDER[page](ent);

				const fromLookup = fluffLookup[hash];
				if (!fromLookup) {
					this._addMessage(`${prop} hash ${`"${hash}"`.padEnd(this._LEN_PAD_HASH, " ")} not found in corresponding "${propFluff}" fluff!\n`);
					return;
				}

				const ptsMessage = [];

				if (!!ent.hasFluff !== fromLookup.hasFluff) {
					ptsMessage.push(`hasFluff mismatch (entity ${ent.hasFluff} | fluff ${fromLookup.hasFluff})`);
				} else if (ent.hasFluff) {
					delete fluffLookup[hash].hasFluff;
				}

				if (!!ent.hasFluffImages !== fromLookup.hasFluffImages) {
					ptsMessage.push(`hasFluffImages mismatch (entity ${ent.hasFluffImages} | fluff ${fromLookup.hasFluffImages})`);
				} else if (ent.hasFluffImages) {
					delete fluffLookup[hash].hasFluffImages;
				}

				if (!fluffLookup[hash].hasFluff && !fluffLookup[hash].hasFluffImages) delete fluffLookup[hash];

				if (!ptsMessage.length) return;

				this._addMessage(`${prop} hash ${`"${hash}"`.padEnd(this._LEN_PAD_HASH, " ")} fluff did not match fluff file: ${ptsMessage.join("; ")}\n`);
			});

			const unusedFluff = Object.entries(fluffLookup)
				.filter(([, meta]) => !meta.isCopiedFluff && !meta.isCopiedFluffImages);

			if (unusedFluff.length) {
				const errors = unusedFluff
					.map(([hash, {hasFluff, hasFluffImages}]) => `${`"${hash}"`.padEnd(this._LEN_PAD_HASH, " ")} ${[hasFluff ? "hasFluff" : null, hasFluffImages ? "hasFluffImages" : null].filter(Boolean).join(" | ")}`);
				this._addMessage(`Extra ${propFluff} fluff found!\n${errors.map(it => `\t${it}`).join("\n")}\n`);
			}
		}
	}
}

class AdventureBookTagCheck extends DataTesterBase {
	static _ADV_BOOK_LOOKUP = {};

	static registerParsedPrimitiveHandlers (parsedJsonChecker) {
		[
			{
				path: "./data/adventures.json",
				prop: "adventure",
				tag: "adventure",
			},
			{
				path: "./data/books.json",
				prop: "book",
				tag: "book",
			},
		].forEach(({path, prop, tag}) => {
			const json = ut.readJson(path);
			this._ADV_BOOK_LOOKUP[tag] = json[prop].mergeMap(({id}) => ({[id.toLowerCase()]: true}));
		});

		parsedJsonChecker.addPrimitiveHandler("string", this._checkString.bind(this));
	}

	static _checkString (str, {filePath}) {
		const tagSplit = Renderer.splitByTags(str);

		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;
			if (s.startsWith("{@")) {
				const [tag, text] = Renderer.splitFirstSpace(s.slice(1, -1));
				if (!["@adventure", "@book"].includes(tag)) continue;

				const [, id] = text.toLowerCase().split("|");
				if (!id) throw new Error(`${tag} tag had ${s} no source!`); // Should never occur

				if (this._ADV_BOOK_LOOKUP[tag.slice(1)][id]) return;

				this._addMessage(`Missing link: ${s} in file ${filePath} had unknown "${tag}" ID "${id}"\n`);
			}
		}
	}
}

async function main () {
	ut.patchLoadJson();

	await TagTestUtil.pInit();

	const ClazzDataTesters = [
		LinkCheck,
		ClassLinkCheck,
		BraceCheck,
		FilterCheck,
		ScaleDiceCheck,
		StripTagTest,
		TableDiceTest,
		AdventureBookTagCheck,
		AreaCheck,
		EscapeCharacterCheck,
		DuplicateEntityCheck,
		RefTagCheck,
		TestCopyCheck,
		HasFluffCheck,
		ItemDataCheck,
		ActionDataCheck,
		DeityDataCheck,
		LootDataCheck,
		ClassDataCheck,
		RaceDataCheck,
		FeatDataCheck,
		BackgroundDataCheck,
		BestiaryDataCheck,
		DeckDataCheck,
		CultsBoonsDataCheck,
	];
	DataTester.register({ClazzDataTesters});

	await DataTester.pRun(
		"./data",
		ClazzDataTesters,
		{
			fnIsIgnoredFile: filePath => filePath.endsWith("changelog.json"),
		},
	);

	ut.unpatchLoadJson();

	const outMessage = DataTester.getLogReport(ClazzDataTesters);

	console.timeEnd(TIME_TAG);

	return !outMessage;
}

export default main();

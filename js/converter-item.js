"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
	const cvItem = require("./converterutils-item.js");
	Object.assign(global, cvItem);
	global.PropOrder = require("./utils-proporder.js");
	Object.assign(global, require("./converterutils-entries.js"));
}

class ItemParser extends BaseParser {
	static init (itemData, classData) {
		ItemParser._ALL_ITEMS = itemData;
		ItemParser._ALL_CLASSES = classData.class;
	}

	static getItem (itemName) {
		itemName = itemName.trim().toLowerCase();
		itemName = ItemParser._MAPPED_ITEM_NAMES[itemName] || itemName;
		const matches = ItemParser._ALL_ITEMS.filter(it => it.name.toLowerCase() === itemName);
		if (matches.length > 1) throw new Error(`Multiple items found with name "${itemName}"`);
		if (matches.length) return matches[0];
		return null;
	}

	/**
	 * Parses items from raw text pastes
	 * @param inText Input text.
	 * @param options Options object.
	 * @param options.cbWarning Warning callback.
	 * @param options.cbOutput Output callback.
	 * @param options.isAppend Default output append mode.
	 * @param options.source Entity source.
	 * @param options.page Entity page.
	 * @param options.titleCaseFields Array of fields to be title-cased in this entity (if enabled).
	 * @param options.isTitleCase Whether title-case fields should be title-cased in this entity.
	 */
	static doParseText (inText, options) {
		options = this._getValidOptions(options);

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		const toConvert = this._getCleanInput(inText, options)
			.split("\n")
			.filter(it => it && it.trim());
		const item = {};
		item.source = options.source;
		// for the user to fill out
		item.page = options.page;

		// FIXME this duplicates functionality in converterutils
		let prevLine = null;
		let curLine = null;
		let i;
		for (i = 0; i < toConvert.length; i++) {
			prevLine = curLine;
			curLine = toConvert[i].trim();

			if (curLine === "") continue;

			// name of item
			if (i === 0) {
				item.name = this._getAsTitle("name", curLine, options.titleCaseFields, options.isTitleCase);
				continue;
			}

			// tagline
			if (i === 1) {
				this._setCleanTaglineInfo(item, curLine, options);
				continue;
			}

			const ptrI = {_: i};
			item.entries = EntryConvert.coalesceLines(
				ptrI,
				toConvert,
			);
			i = ptrI._;
		}

		const statsOut = this._getFinalState(item, options);
		const prop = statsOut.__prop
		delete statsOut.__prop

		options.cbOutput(statsOut, options.isAppend, prop);
	}

	static _getFinalState (item, options, prop) {
		if (!item.entries.length) delete item.entries;
		else this._setWeight(item, options);

		if (item.staff) this._setQuarterstaffStats(item, options);

		this._doItemPostProcess(item, options);
		this._setCleanTaglineInfo_handleGenericType(item, options);
		this._doVariantPostProcess(item, options);

		return PropOrder.getOrdered(item, prop || "item");
	}

	// SHARED UTILITY FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _doItemPostProcess (stats, options) {
		TagCondition.tryTagConditions(stats);
		ArtifactPropertiesTag.tryRun(stats);
		if (stats.entries) {
			stats.entries = stats.entries.map(it => DiceConvert.getTaggedEntry(it));
			EntryConvert.tryRun(stats, "entries");
			stats.entries = SkillTag.tryRun(stats.entries);
			stats.entries = ActionTag.tryRun(stats.entries);
			stats.entries = SenseTag.tryRun(stats.entries);

			if (/is a (tiny|small|medium|large|huge|gargantuan) object/.test(JSON.stringify(stats.entries))) options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Item may be an object!`);
		}
		this._doItemPostProcess_addTags(stats, options);
		BasicTextClean.tryRun(stats);
	}

	static _doItemPostProcess_addTags (stats, options) {
		const manName = stats.name ? `(${stats.name}) ` : "";
		ChargeTag.tryRun(stats);
		RechargeTypeTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Recharge type requires manual conversion`)});
		BonusTag.tryRun(stats);
		ItemMiscTag.tryRun(stats);
		ItemSpellcastingFocusTag.tryRun(stats);
		DamageResistanceTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Damage resistance tagging requires manual conversion`)});
		DamageImmunityTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Damage immunity tagging requires manual conversion`)});
		DamageVulnerabilityTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Damage vulnerability tagging requires manual conversion`)});
		ConditionImmunityTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Condition immunity tagging requires manual conversion`)});
		ReqAttuneTagTag.tryRun(stats, {cbMan: () => options.cbWarning(`${manName}Attunement requirement tagging requires manual conversion`)});
		TagJsons.mutTagObject(stats, {keySet: new Set(["entries"]), isOptimistic: false});
		AttachedSpellTag.tryRun(stats);

		// TODO
		//  - tag damage type?
		//  - tag ability score adjustments
	}

	static _doVariantPostProcess (stats, options) {
		if (!stats.inherits) return;
		BonusTag.tryRun(stats, {isVariant: true});
	}

	// SHARED PARSING FUNCTIONS ////////////////////////////////////////////////////////////////////////////////////////
	static _setCleanTaglineInfo (stats, curLine, options) {
		// split on first comma not inside parentheses
		// \s*(?![^()]*\)) : not inside parentheses
		// (.*) : only first
		const parts = curLine.split(/,\s*(?![^()]*\))(.*)/s).map(it => it.trim()).filter(Boolean);

		const handlePartRarity = (rarity) => {
			rarity = rarity.trim().toLowerCase();
			switch (rarity) {
				case "common": stats.rarity = rarity; return true;
				case "uncommon": stats.rarity = rarity; return true;
				case "rare": stats.rarity = rarity; return true;
				case "very rare": stats.rarity = rarity; return true;
				case "legendary": stats.rarity = rarity; return true;
				case "artifact": stats.rarity = rarity; return true;
				case "rarity varies": {
					stats.rarity = "varies";
					stats.__prop = "itemGroup";
					return true;
				}
				case "unknown rarity": {
					// Make a best-guess as to whether or not the item is magical
					if (stats.wondrous || stats.staff || stats.type === "P" || stats.type === "RG" || stats.type === "RD" || stats.type === "WD" || stats.type === "SC" || stats.type === "MR") stats.rarity = "unknown (magic)";
					else stats.rarity = "unknown";
					return true;
				}
			}
			return false;
		};

		let baseItem = null;
		let genericType = null;
		let genericVariantBases = []; // in case it's a variant of a specific list of items
		let genericVariantExceptions = [];

		for (let i = 0; i < parts.length; ++i) {
			let part = parts[i];
			const partLower = part.toLowerCase();

			// region wondrous/item type/staff/etc.
			switch (partLower) {
				case "wondrous item": stats.wondrous = true; continue;
				case "wondrous item (tattoo)": stats.wondrous = true; stats.tattoo = true; continue;
				case "potion": stats.type = "P"; continue;
				case "ring": stats.type = "RG"; continue;
				case "rod": stats.type = "RD"; continue;
				case "wand": stats.type = "WD"; continue;
				case "ammunition": stats.type = "A"; continue;
				case "staff": stats.staff = true; continue;
				case "master rune": stats.type = "MR"; continue;
				case "scroll": stats.type = "SC"; continue;
			}
			// endregion

			// region rarity/attunement
			// Check if the part is an exact match for a rarity string
			const isHandledRarity = handlePartRarity(partLower);
			if (isHandledRarity) continue;

			if (partLower.includes("(requires attunement")) {
				const [rarityRaw, ...rest] = part.split("(");
				const rarity = rarityRaw.trim().toLowerCase();

				const isHandledRarity = handlePartRarity(rarity);
				if (!isHandledRarity) options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Rarity "${rarityRaw}" requires manual conversion`);

				let attunement = rest.join("(");
				attunement = attunement.replace(/^requires attunement/i, "").replace(/\)/, "").trim();
				if (!attunement) {
					stats.reqAttune = true;
				} else {
					stats.reqAttune = attunement.toLowerCase();
				}

				// if specific attunement is required, absorb any further parts which are class names
				if (/(^| )by a /i.test(stats.reqAttune)) {
					for (let ii = i; ii < parts.length; ++ii) {
						const nxtPart = parts[ii]
							.trim()
							.replace(/^(?:or|and) /, "")
							.trim()
							.replace(/\)$/, "")
							.trim();
						const isClassName = ItemParser._ALL_CLASSES.some(cls => cls.name.toLowerCase() === nxtPart);
						if (isClassName) {
							stats.reqAttune += `, ${parts[ii].replace(/\)$/, "")}`;
							i = ii;
						}
					}
				}

				continue;
			}
			// endregion

			// region weapon/armor
			if (partLower === "weapon" || partLower === "weapon (any)") {
				genericType = "weapon";
				continue;
			} else if (partLower === "armor" || partLower === "armor (any)") {
				genericType = "armor";
				continue;
			} else {
				const mWeaponAnyX = /^weapon \(any ([^)]+)\)$/i.exec(part);
				if (mWeaponAnyX) {
					stats.__genericType = mWeaponAnyX[1].trim().toCamelCase();
					continue;
				}
			}

			const mBaseWeapon = /^(weapon|staff) \(([^)]+)\)$/i.exec(part);
			const mBaseArmor = /^armor \(([^)]+)\)$/i.exec(part);

			// list separated by commas and/or "or"s
			// example: weapon (dagger, shortsword), weapon (maul or warhammer), 
			// armor (plate, half plate, or splint)
			const variantListPattern = /(?:\s+or|\s*,(?! but)|\s+and)(?: or)?\s+/i;

			const checkExceptions = subcategory => {
				const exceptionsSplit = subcategory.split(/,?\s*(?:except|but(?:\s*not)?)\s*/);
				if (exceptionsSplit.length > 1) {
					const exceptions = exceptionsSplit[1].split(variantListPattern).map(s => s.trim());
					exceptions.forEach(exceptionName => {
						let item = ItemParser.getItem(exceptionName);
						if (!item) item = ItemParser.getItem(`${exceptionName} armor`); // "armor (plate)" -> "plate armor"
						if (!item) throw new Error(`Could not find exception item "${exceptionName}"`);
						genericVariantExceptions.push(item.name); // correct capitalization
					});
				}
			};

			if (mBaseWeapon) {
				if (mBaseWeapon[1].toLowerCase() === "staff") stats.staff = true;
				baseItem = ItemParser.getItem(mBaseWeapon[2]);
				if (!baseItem) {
					// check if the items are a list
					let baseItems = mBaseWeapon[2]
						.replace(/(a|an|any)\s+/, "")
						.split(variantListPattern)
						;
					let handled = false;
					baseItems.forEach((itemName) => {
						let item = ItemParser.getItem(itemName);
						if (!item) throw new Error(`Could not find base item "${itemName}"`);
						genericVariantBases.push(item);
						handled = true;
					});
					if (!handled) {
						if (!baseItem) throw new Error(`Could not find base item "${mBaseWeapon[2]}"`);
					}
				}
				if (genericType || genericVariantBases.length > 0) 
					checkExceptions(mBaseWeapon[2]);
				continue;
			} else if (mBaseArmor) {
				baseItem = ItemParser.getItem(mBaseArmor[1]);
				if (!baseItem) baseItem = ItemParser.getItem(`${mBaseArmor[1]} armor`); // "armor (plate)" -> "plate armor"

				if (!baseItem) {
					let trimmed = mBaseArmor[1]
						.replace(/(a|an|any)\s+/, "")
						.trim()
						;

					let handled = false;
					// check armor types
					if (/^heavy/.test(trimmed)) {
						genericType = "heavy armor";
						handled = true;
					} else if (/^medium/.test(trimmed)) {
						genericType = "medium armor";
						handled = true;
					} else if (/^light/.test(trimmed)) {
						genericType = "light armor";
						handled = true;
					}

					if (!handled) {
						let baseItems = trimmed
							.split(variantListPattern)
							;
						baseItems.forEach((itemName) => {
							let item = ItemParser.getItem(itemName);
							if (!item) throw new Error(`Could not find base item "${itemName}"`);
							genericVariantBases.push(item);
							handled = true;
						});
					}
					if (!handled) {
						if (!baseItem) throw new Error(`Could not find base item "${mBaseArmor[1]}"`);
					}
				}
				if (genericType || genericVariantBases.length > 0) 
					checkExceptions(mBaseArmor[1]);

				continue;
			}
			// endregion

			// Warn about any unprocessed input
			options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Tagline part "${part}" requires manual conversion`);
		}

		this._setCleanTaglineInfo_handleBaseItem(stats, baseItem, options);
		// Stash the genericType for later processing/removal
		if (genericType) stats.__genericType = genericType;
		if (genericVariantBases.length != 0) stats.__genericVariantBases = genericVariantBases;
		if (genericVariantExceptions.length != 0) stats.__genericVariantExceptions = genericVariantExceptions;
	}

	static _setCleanTaglineInfo_getArmorBaseItem (name) {
		let baseItem = ItemParser.getItem(name);
		if (!baseItem) baseItem = ItemParser.getItem(`${name} armor`); // "armor (plate)" -> "plate armor"
		return baseItem;
	}

	static _setCleanTaglineInfo_isMutAnyArmor (stats, mBaseArmor) {
		if (/^any /i.test(mBaseArmor.groups.type)) {
			const ptAny = mBaseArmor.groups.type.replace(/^any /i, "");
			const [ptInclude, ptExclude] = ptAny.split(/\bexcept\b/i).map(it => it.trim()).filter(Boolean);

			const procPart = pt => {
				switch (pt) {
					case "light": return {"type": "LA"};
					case "medium": return {"type": "MA"};
					case "heavy": return {"type": "HA"};
					default: {
						const baseItem = this._setCleanTaglineInfo_getArmorBaseItem(pt);
						if (!baseItem) throw new Error(`Could not find base item "${pt}"`);

						return {name: baseItem.name};
					}
				}
			};

			if (ptInclude) {
				stats.requires = [
					...(stats.requires || []),
					...ptInclude.split(/\b(?:or|,)\b/g).map(it => it.trim()).filter(Boolean).map(it => procPart(it)),
				];
			}

			if (ptExclude) {
				Object.assign(
					stats.excludes = stats.excludes || {},
					ptExclude.split(/\b(?:or|,)\b/g).map(it => it.trim()).filter(Boolean).mergeMap(it => procPart(it)),
				);
			}

			return true;
		}

		return false;
	}

	static _setCleanTaglineInfo_handleBaseItem (stats, baseItem, options) {
		if (!baseItem) return;

		const blacklistedProps = new Set([
			"source",
			"srd",
			"basicRules",
			"page",
		]);

		// Apply base item stats only if there's no existing data
		Object.entries(baseItem)
			.filter(([k]) => stats[k] === undefined && !k.startsWith("_") && !blacklistedProps.has(k))
			.forEach(([k, v]) => stats[k] = v);

		// Clean unwanted base properties
		delete stats.armor;
		delete stats.value;

		stats.baseItem = `${baseItem.name.toLowerCase()}${baseItem.source === SRC_DMG ? "" : `|${baseItem.source}`}`;
	}

	static _setCleanTaglineInfo_handleGenericType (stats, options) {
		if (!(stats.__genericType || stats.__genericVariantBases)) return;

		const genericType = stats.__genericType;
		const genericVariantBases = stats.__genericVariantBases;
		const genericVariantExceptions = stats.__genericVariantExceptions;
		delete stats.__genericType;
		delete stats.__genericVariantBases;
		delete stats.__genericVariantExceptions;

		let prefixSuffixName = stats.name;
		prefixSuffixName = prefixSuffixName.replace(/^weapon /i, "");
		const isSuffix = /^\s*of /i.test(prefixSuffixName);

		stats.inherits = MiscUtil.copy(stats);
		// Clean/move inherit props into inherits object
		delete stats.inherits.name; // maintain name on base object
		Object.keys(stats.inherits).forEach(k => delete stats[k]);

		if (isSuffix) stats.inherits.nameSuffix = ` ${prefixSuffixName.trim()}`;
		else stats.inherits.namePrefix = `${prefixSuffixName.trim()} `;

		stats.__prop = "variant";
		stats.type = "GV";
		if (genericType) {
			switch (genericType) {
				case "weapon": stats.requires = [{"weapon": true}]; break;
				case "sword": stats.requires = [{"sword": true}]; break;
				case "armor": stats.requires = [{"armor": true}]; break;
				case "heavy armor": stats.requires = [{"type": "HA"}]; break;
				case "medium armor": stats.requires = [{"type": "MA"}]; break;
				case "light armor": stats.requires = [{"type": "LA"}]; break;
				default: throw new Error(`Unhandled generic type "${genericType}"`);
			}
		} else if (genericVariantBases) {
			stats.requires = [];
			genericVariantBases.forEach(item => {
				stats.requires.push({
					"name": item.name
				});
			});
		}

		if (genericVariantExceptions) {
			stats.excludes = {
				"name": genericVariantExceptions
			};
		}
	}

	static _setWeight (stats, options) {
		const strEntries = JSON.stringify(stats.entries);

		strEntries.replace(/weighs ([a-zA-Z0-9,]+) (pounds?|lbs?\.|tons?)/, (...m) => {
			if (m[2].toLowerCase().trim().startsWith("ton")) throw new Error(`Handling for tonnage is unimplemented!`);

			const noCommas = m[1].replace(/,/g, "");
			if (!isNaN(noCommas)) stats.weight = Number(noCommas);

			const fromText = Parser.textToNumber(m[1]);
			if (!isNaN(fromText)) stats.weight = fromText;

			if (!stats.weight) options.cbWarning(`${stats.name ? `(${stats.name}) ` : ""}Weight "${m[1]}" requires manual conversion`);
		});
	}

	static _setQuarterstaffStats (stats) {
		const cpyStatsQuarterstaff = MiscUtil.copy(ItemParser._ALL_ITEMS.find(it => it.name === "Quarterstaff" && it.source === SRC_PHB));

		// remove unwanted properties
		delete cpyStatsQuarterstaff.name;
		delete cpyStatsQuarterstaff.source;
		delete cpyStatsQuarterstaff.page;
		delete cpyStatsQuarterstaff.rarity;
		delete cpyStatsQuarterstaff.value;
		delete cpyStatsQuarterstaff.weapon; // tag found only on basic items

		Object.entries(cpyStatsQuarterstaff)
			.filter(([k]) => !k.startsWith("_"))
			.forEach(([k, v]) => {
				if (stats[k] == null) stats[k] = v;
			});
	}
}
ItemParser._ALL_ITEMS = null;
ItemParser._ALL_CLASSES = null;
ItemParser._MAPPED_ITEM_NAMES = {
	"studded leather": "studded leather armor",
	"leather": "leather armor",
	"scale": "scale mail",
};

if (typeof module !== "undefined") {
	module.exports = {
		ItemParser,
	};
}

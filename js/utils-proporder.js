"use strict";

class PropOrder {
	/**
	 * @param obj
	 * @param dataProp
	 * @param [opts] Options object.
	 * @param [opts.fnUnhandledKey] Function to call on each unhandled key.
	 */
	static getOrdered (obj, dataProp, opts) {
		opts = opts || {};

		const order = PropOrder._PROP_TO_LIST[dataProp];
		if (!order) throw new Error(`Unhandled prop "${dataProp}"`);

		return this._getOrdered(obj, order, opts, dataProp);
	}

	static _getOrdered (obj, order, opts, path) {
		const out = {};
		const keySet = new Set(Object.keys(obj));
		const seenKeys = new Set();
		order.forEach(k => {
			if (typeof k === "string") {
				seenKeys.add(k);
				if (keySet.has(k)) out[k] = obj[k];
			} else {
				const key = k.key;

				seenKeys.add(key);

				if (keySet.has(key)) {
					if (!obj[key]) return out[key] = obj[key]; // Handle nulls

					if (k instanceof PropOrder._ObjectKey) {
						const nxtPath = `${path}.${key}`;
						if (k.fnGetOrder) out[key] = this._getOrdered(obj[key], k.fnGetOrder(), opts, nxtPath);
						else if (k.order) out[key] = this._getOrdered(obj[key], k.order, opts, nxtPath);
						else out[key] = obj[key];
					} else if (k instanceof PropOrder._ArrayKey) {
						const nxtPath = `${path}[n].${key}`;
						if (k.fnGetOrder) out[key] = obj[key].map(it => this._getOrdered(it, k.fnGetOrder(), opts, nxtPath));
						else if (k.order) out[key] = obj[key].map(it => this._getOrdered(it, k.order, opts, nxtPath));
						else out[key] = obj[key];

						if (k.fnSort && out[key] instanceof Array) out[key].sort(k.fnSort);
					} else throw new Error(`Unimplemented!`);
				}
			}
		});

		// ensure any non-orderable keys are maintained
		const otherKeys = CollectionUtil.setDiff(keySet, seenKeys);
		[...otherKeys].forEach(k => {
			out[k] = obj[k];
			if (opts.fnUnhandledKey) opts.fnUnhandledKey(`${path}.${k}`);
		});

		return out;
	}

	static hasOrder (dataProp) { return !!PropOrder._PROP_TO_LIST[dataProp]; }
}

PropOrder._ObjectKey = class {
	/**
	 * @param key
	 * @param [opts] Options object.
	 * @param [opts.fnGetOrder] Function which gets the ordering to apply to objects with this key.
	 * Takes precedence over `.order`.
	 * @param [opts.order] Ordering to apply to objects with this key.
	 */
	constructor (key, opts) {
		opts = opts || {};

		this.key = key;
		this.fnGetOrder = opts.fnGetOrder;
		this.order = opts.order;
	}
};

PropOrder._ArrayKey = class {
	/**
	 * @param key
	 * @param [opts] Options object.
	 * @param [opts.fnGetOrder] Function which gets the ordering to apply to objects with this key.
	 * Takes precedence over `.order`.
	 * @param [opts.order] Ordering to apply to objects with this key.
	 * @param [opts.fnSort] Function to sort arrays with this key.
	 */
	constructor (key, opts) {
		opts = opts || {};

		this.key = key;
		this.fnGetOrder = opts.fnGetOrder;
		this.order = opts.order;
		this.fnSort = opts.fnSort;
	}
};

PropOrder._MONSTER = [
	"name",
	"shortName",
	"alias",
	"group",

	"isNpc",
	"isNamedCreature",

	"source",
	"sourceSub",
	"page",

	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",
	"reprintedAs",

	"summonedBySpell",
	"summonedBySpellLevel",
	"summonedByClass",

	"_isCopy",
	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			"_trait",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._MONSTER__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"level",
	"size",
	"sizeNote",
	"type",
	"alignment",
	"alignmentPrefix",

	"ac",
	"hp",
	"speed",

	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",

	"save",
	"skill",
	"senses",
	"passive",
	"resist",
	"immune",
	"vulnerable",
	"conditionImmune",
	"languages",
	"cr",
	"pbNote",

	new PropOrder._ArrayKey("spellcasting", {
		fnGetOrder: () => [
			"name",
			"headerEntries",

			"will",
			"rest",
			"daily",
			"charges",

			"ritual",

			"spells",

			"footerEntries",

			"chargesItem",

			"ability",
			"displayAs",
			"hidden",
		],
	}),
	"trait",
	"actionNote",
	"actionHeader",
	"action",
	"bonusNote",
	"bonusHeader",
	"bonus",
	"reactionNote",
	"reactionHeader",
	"reaction",
	"legendaryHeader",
	"legendaryActions",
	"legendary",
	"mythicHeader",
	"mythic",
	"legendaryGroup",
	"variant",

	"environment",
	"fluff",
	"familiar",
	"dragonCastingColor",
	"dragonAge",

	"tokenUrl",
	"soundClip",

	"altArt",

	new PropOrder._ArrayKey("traitTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("senseTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("actionTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("languageTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("damageTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("damageTagsLegendary", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("damageTagsSpell", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("spellcastingTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("miscTags", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("conditionInflict", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("conditionInflictLegendary", {fnSort: SortUtil.ascSortLower}),
	new PropOrder._ArrayKey("conditionInflictSpell", {fnSort: SortUtil.ascSortLower}),

	"hasToken",
	"hasFluff",
	"hasFluffImages",

	new PropOrder._ArrayKey("_versions", {
		fnGetOrder: () => [
			"name",
			"source",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._MONSTER__COPY_MOD,
			}),
			"_template",
			"_implementations",
			...PropOrder._MONSTER,
		],
		fnSort: (a, b) => SortUtil.ascSortLower(a.name || "", b.name || "") || SortUtil.ascSortLower(a.source || "", b.source || ""),
	}),
];
PropOrder._MONSTER__COPY_MOD = [
	"*",
	"_",
	...PropOrder._MONSTER
		.map(it => {
			if (typeof it === "string") return it;

			if (it instanceof PropOrder._ArrayKey) {
				if (it.key === "spellcasting") return it.key;
				return it;
			}

			return it;
		}),
];
PropOrder._GENERIC_FLUFF = [
	"name",
	"source",

	"_copy",

	"entries",
	"images",
];
PropOrder._SPELL = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",

	"level",
	"school",
	"subschools",
	"time",
	"range",
	"components",
	"duration",
	"meta",

	"entries",
	"entriesHigherLevel",

	"scalingLevelDice",

	"damageResist",
	"damageImmune",
	"damageVulnerable",
	"conditionImmune",

	"damageInflict",
	"conditionInflict",

	"spellAttack",
	"savingThrow",
	"abilityCheck",

	"affectsCreatureType",

	"miscTags",
	"areaTags",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._ACTION = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"fromVariant",

	"time",

	"entries",

	"seeAlsoAction",
];
PropOrder._ADVENTURE = [
	"name",
	"alias",

	"id",
	"source",
	"parentSource",

	"group",

	"coverUrl",
	"published",
	"publishedOrder",
	"storyline",
	"level",

	"contents",
];
PropOrder._BOOK = [
	"name",
	"alias",

	"id",
	"source",

	"group",

	"coverUrl",
	"published",
	"author",

	"contents",
];
PropOrder._BACKGROUND = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			"_trait",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._BACKGROUND__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"prerequisite",

	"feats",

	"skillProficiencies",
	"languageProficiencies",
	"toolProficiencies",
	"startingEquipment",

	"additionalSpells",

	"fromFeature",

	"entries",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._BACKGROUND__COPY_MOD = [
	"*",
	"_",
	...PropOrder._BACKGROUND,
];
PropOrder._TRAIT = [
	"name",

	"source",
	"page",

	"ref",

	"crMin",

	new PropOrder._ObjectKey("prerequisite", {
		order: PropOrder._MONSTER,
	}),
	new PropOrder._ObjectKey("apply", {
		order: [
			new PropOrder._ObjectKey("_root", {
				order: PropOrder._MONSTER,
			}),
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._MONSTER__COPY_MOD,
			}),
		],
	}),
];
PropOrder._LEGENDARY_GROUP = [
	"name",
	"source",
	"page",

	"additionalSources",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			"_trait",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._LEGENDARY_GROUP__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"lairActions",
	"regionalEffects",
	"mythicEncounter",
];
PropOrder._LEGENDARY_GROUP__COPY_MOD = [
	"*",
	"_",
	...PropOrder._LEGENDARY_GROUP,
];
PropOrder._CLASS = [
	"name",

	"source",
	"page",
	"srd",
	"isReprinted",
	"basicRules",
	"otherSources",

	"isSidekick",

	"requirements",
	"hd",
	"proficiency",

	"spellcastingAbility",
	"casterProgression",
	"preparedSpells",
	"cantripProgression",
	"spellsKnownProgression",
	"spellsKnownProgressionFixed",
	"spellsKnownProgressionFixedAllowLowerLevel",
	"spellsKnownProgressionFixedByLevel",

	"additionalSpells",

	"optionalfeatureProgression",

	"startingProficiencies",
	"languageProficiencies",
	"startingEquipment",

	"multiclassing",

	"classTableGroups",

	"classFeatures",

	"subclassTitle",

	"fluff",
];
PropOrder._SUBCLASS = [
	"name",
	"shortName",
	"source",
	"className",
	"classSource",

	"page",
	"srd",
	"isReprinted",
	"basicRules",
	"otherSources",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"shortName",
			"source",
			"className",
			"classSource",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._SUBCLASS__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"spellcastingAbility",
	"casterProgression",
	"preparedSpells",
	"cantripProgression",
	"spellsKnownProgression",

	"additionalSpells",

	"optionalfeatureProgression",

	"subclassTableGroups",
	"subclassFeatures",
];
PropOrder._SUBCLASS__COPY_MOD = [
	"*",
	"_",
	...PropOrder._SUBCLASS,
];
PropOrder._CLASS_FEATURE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"className",
	"classSource",
	"level",

	"isClassFeatureVariant",

	"header",
	"type",

	"consumes",

	"entries",
];
PropOrder._SUBCLASS_FEATURE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"className",
	"classSource",
	"subclassShortName",
	"subclassSource",
	"level",

	"isClassFeatureVariant",

	"isGainAtNextFeatureLevel",

	"header",
	"type",

	"consumes",

	"entries",
];
PropOrder._LANGUAGE = [
	"name",
	"dialects",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",

	"type",
	"typicalSpeakers",
	"script",

	"fonts",

	"entries",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._LANGUAGE_SCRIPT = [
	"name",
	"fonts",
];
PropOrder._CONDITION = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"entries",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._DISEASE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"entries",
];
PropOrder._STATUS = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"entries",
];
PropOrder._CULT = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",
	"reprintedAs",

	"type",

	"goal",
	"cultists",
	"signaturespells",

	"entries",
];
PropOrder._BOON = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",
	"reprintedAs",

	"type",

	"ability",

	"goal",
	"cultists",
	"signaturespells",

	"entries",
];
PropOrder._DEITY = [
	"name",
	"reprintAlias",
	"altNames",

	"source",
	"page",
	"srd",
	"basicRules",

	"additionalSources",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			"pantheon",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._DEITY__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	// This is used as part of the ID key
	"pantheon",

	"customExtensionOf",

	"alignment",
	"title",
	"category",
	"domains",
	"province",
	"symbol",
	"symbolImg",

	"piety",

	"entries",
];
PropOrder._DEITY__COPY_MOD = [
	"*",
	"_",
	...PropOrder._DEITY,
];
PropOrder._FEAT = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"additionalSources",
	"otherSources",

	"prerequisite",
	"ability",

	"skillProficiencies",
	"languageProficiencies",
	"toolProficiencies",
	"weaponProficiencies",
	"armorProficiencies",
	"skillToolLanguageProficiencies",
	"savingThrowProficiencies",
	"expertise",

	"immune",
	"resist",
	"vulnerable",
	"conditionImmune",

	"additionalSpells",

	"optionalfeatureProgression",

	"entries",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._VEHICLE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"vehicleType",

	"size",
	"dimensions",
	"weight",

	"type",
	"terrain",

	"capCreature",
	"capCrew",
	"capCrewNote",
	"capPassenger",
	"capCargo",

	"cost",

	"ac",
	"pace",
	"speed",

	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",

	"hp",

	"immune",
	"conditionImmune",

	"hull",
	"control",
	"movement",
	"weapon",
	"other",

	"entries",
	"trait",
	"actionThresholds",
	"action",
	"actionStation",
	"reaction",

	"tokenUrl",

	"hasToken",
	"hasFluff",
	"hasFluffImages",
];
PropOrder._VEHICLE_UPGRADE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"upgradeType",

	"entries",
];
PropOrder._RACE_FLUFF = [
	"name",
	"source",

	"uncommon",
	"monstrous",

	"_copy",

	"entries",
	"images",
];
PropOrder._ITEM = [
	"name",
	"namePrefix",
	"nameSuffix",
	"nameRemove",

	"source",
	"page",
	"srd",
	"basicRules",

	"additionalSources",
	"otherSources",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._ITEM__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"baseItem",

	"type",
	"typeAlt",
	"scfType",

	"immune",
	"resist",
	"vulnerable",
	"conditionImmune",

	"detail1",

	"tier",
	"rarity",
	"reqAttune",
	"reqAttuneAlt",

	"reqAttuneTags",
	"reqAttuneAltTags",

	"wondrous",
	"tattoo",
	"curse",
	"sentient",

	"weight",
	"weightMult",
	"weightNote",
	"weightExpression",
	"value",
	"valueMult",
	"valueExpression",
	"quantity",

	"weaponCategory",
	"age",

	"property",
	"range",
	"reload",

	"dmg1",
	"dmgType",
	"dmg2",

	"ac",
	"strength",
	"dexterityMax",

	"crew",
	"crewMin",
	"crewMax",
	"vehAc",
	"vehHp",
	"vehDmgThresh",
	"vehSpeed",
	"capPassenger",
	"capCargo",
	"travelCost",
	"shippingCost",

	"carryingCapacity",
	"speed",

	"ability",
	"grantsProficiency",

	"bonusWeapon",
	"bonusWeaponAttack",
	"bonusWeaponDamage",
	"bonusWeaponCritDamage",
	"bonusSpellAttack",
	"bonusSpellDamage",
	"bonusSpellSaveDc",
	"bonusAc",
	"bonusSavingThrow",
	"bonusAbilityCheck",
	"bonusProficiencyBonus",
	"modifySpeed",
	"critThreshold",

	"recharge",
	"rechargeAmount",
	"charges",

	"axe",
	"armor",
	"barding",
	"bow",
	"club",
	"crossbow",
	"dagger",
	"firearm",
	"focus",
	"hammer",
	"mace",
	"net",
	"poison",
	"spear",
	"staff",
	"stealth",
	"sword",
	"weapon",

	"hasRefs",
	"entries",
	"additionalEntries",
	"items",

	"ammoType",
	"poisonTypes",

	"packContents",
	"atomicPackContents",
	"containerCapacity",

	"optionalfeatures",
	"attachedSpells",
	"spellScrollLevel",
	"lootTables",

	"seeAlsoDeck",
	"seeAlsoVehicle",

	"miscTags",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._ITEM__COPY_MOD = [
	"*",
	"_",
	...PropOrder._ITEM,
];
PropOrder._MAGICVARIANT = [
	"name",
	"source",

	"type",

	"requires",
	"excludes",

	"ammo",

	"entries",

	new PropOrder._ObjectKey("inherits", {
		order: PropOrder._ITEM,
	}),

	"hasFluff",
	"hasFluffImages",
];
PropOrder._OBJECT = [
	"name",

	"isNpc",

	"source",
	"page",
	"srd",
	"basicRules",

	"size",
	"objectType",
	"creatureType",

	"ac",
	"hp",
	"speed",

	"str",
	"dex",
	"con",
	"int",
	"wis",
	"cha",

	"senses",

	"immune",
	"resist",
	"vulnerable",
	"conditionImmune",

	"entries",
	"actionEntries",

	"tokenUrl",
	"hasToken",
	"hasFluff",
	"hasFluffImages",
];
PropOrder._OPTIONALFEATURE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"otherSources",

	"isClassFeatureVariant",
	"previousVersion",

	"featureType",

	"prerequisite",

	"skillProficiencies",
	"languageProficiencies",
	"toolProficiencies",
	"weaponProficiencies",
	"armorProficiencies",

	"senses",

	"additionalSpells",

	"optionalfeatureProgression",

	"consumes",

	"entries",
];
PropOrder._PSIONIC = [
	"name",

	"source",
	"page",

	"type",
	"order",

	"entries",

	"focus",
	"modes",
];
PropOrder._REWARD = [
	"name",

	"source",
	"page",

	"type",

	"rarity",

	"entries",
];
PropOrder._VARIANTRULE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",

	"ruleType",

	"type",
	"entries",
];
PropOrder._RACE_SUBRACE = [
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",
	"reprintedAs",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._RACE__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"lineage",
	"creatureTypes",
	"creatureTypeTags",

	new PropOrder._ArrayKey("size", {fnSort: SortUtil.ascSortSize}),
	"speed",
	"ability",

	"heightAndWeight",
	"age",

	"darkvision",
	"blindsight",
	"feats",

	new PropOrder._ArrayKey("traitTags", {fnSort: SortUtil.ascSortLower}),
	"skillProficiencies",
	"languageProficiencies",
	"toolProficiencies",
	"weaponProficiencies",
	"armorProficiencies",
	"skillToolLanguageProficiencies",

	"resist",
	"immune",
	"vulnerable",
	"conditionImmune",

	"soundClip",

	"additionalSpells",

	"entries",

	"overwrite",

	"hasFluff",
	"hasFluffImages",

	new PropOrder._ArrayKey("_versions", {
		fnGetOrder: () => [
			"name",
			"source",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._RACE__COPY_MOD,
			}),
			"_template",
			"_implementations",
			...PropOrder._RACE,
		],
		fnSort: (a, b) => SortUtil.ascSortLower(a.name || "", b.name || "") || SortUtil.ascSortLower(a.source || "", b.source || ""),
	}),
];
PropOrder._RACE = [
	"name",
	"alias",

	"source",

	...PropOrder._RACE_SUBRACE,
];
PropOrder._RACE__COPY_MOD = [
	"*",
	"_",
	...PropOrder._RACE,
];
PropOrder._SUBRACE = [
	"name",
	"alias",

	"source",

	"raceName",
	"raceSource",

	...PropOrder._RACE_SUBRACE,
];
PropOrder._TABLE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"otherSources",

	"caption",

	"colLabels",
	"colStyles",

	"rows",
];
PropOrder._TRAP = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"trapHazType",

	"tier",
	"threat",
	"effect",

	"trigger",

	"initiative",
	"initiativeNote",

	"eActive",
	"eDynamic",
	"eConstant",

	"countermeasures",

	"entries",
];
PropOrder._HAZARD = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",
	"additionalSources",
	"otherSources",
	"reprintedAs",

	"trapHazType",

	"entries",
];
PropOrder._RECIPE = [
	"name",

	"source",
	"page",

	"type",
	"dishTypes",

	"diet",
	"allergenGroups",

	"makes",
	"serves",
	"ingredients",
	"equipment",
	"instructions",
	"noteCook",

	"miscTags",

	"fluff",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._CHAROPTION = [
	"name",

	"source",
	"page",

	"otherSources",

	"prerequisite",

	"optionType",

	"entries",

	"hasFluff",
	"hasFluffImages",
];
PropOrder._SKILL = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"entries",
];
PropOrder._SENSE = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	"entries",
];
PropOrder._DECK = [
	"name",

	"source",
	"page",
	"srd",
	"basicRules",

	new PropOrder._ObjectKey("_copy", {
		order: [
			"name",
			"source",
			new PropOrder._ObjectKey("_mod", {
				fnGetOrder: () => PropOrder._DECK__COPY_MOD,
			}),
			"_preserve",
		],
	}),

	"cards",
	"back",

	"entries",

	"hasCardArt",
];

PropOrder._DECK__COPY_MOD = [
	"*",
	"_",
	...PropOrder._DECK,
];
PropOrder._CARD = [
	"name",
	"alias",

	"source",
	"set",
	"page",
	"srd",
	"basicRules",

	"suit",
	"value",
	"valueName",

	"face",
	"back",

	"entries",
];

PropOrder._PROP_TO_LIST = {
	"monster": PropOrder._MONSTER,
	"monsterFluff": PropOrder._GENERIC_FLUFF,
	"backgroundFluff": PropOrder._GENERIC_FLUFF,
	"featFluff": PropOrder._GENERIC_FLUFF,
	"conditionFluff": PropOrder._GENERIC_FLUFF,
	"itemFluff": PropOrder._GENERIC_FLUFF,
	"languageFluff": PropOrder._GENERIC_FLUFF,
	"vehicleFluff": PropOrder._GENERIC_FLUFF,
	"objectFluff": PropOrder._GENERIC_FLUFF,
	"raceFluff": PropOrder._RACE_FLUFF,
	"spell": PropOrder._SPELL,
	"action": PropOrder._ACTION,
	"adventure": PropOrder._ADVENTURE,
	"book": PropOrder._BOOK,
	"background": PropOrder._BACKGROUND,
	"trait": PropOrder._TRAIT,
	"legendaryGroup": PropOrder._LEGENDARY_GROUP,
	"class": PropOrder._CLASS,
	"subclass": PropOrder._SUBCLASS,
	"classFeature": PropOrder._CLASS_FEATURE,
	"subclassFeature": PropOrder._SUBCLASS_FEATURE,
	"language": PropOrder._LANGUAGE,
	"languageScript": PropOrder._LANGUAGE_SCRIPT,
	"condition": PropOrder._CONDITION,
	"disease": PropOrder._DISEASE,
	"status": PropOrder._STATUS,
	"cult": PropOrder._CULT,
	"boon": PropOrder._BOON,
	"deity": PropOrder._DEITY,
	"feat": PropOrder._FEAT,
	"vehicle": PropOrder._VEHICLE,
	"vehicleUpgrade": PropOrder._VEHICLE_UPGRADE,
	"item": PropOrder._ITEM,
	"baseitem": PropOrder._ITEM,
	"magicvariant": PropOrder._MAGICVARIANT,
	"itemGroup": PropOrder._ITEM,
	"object": PropOrder._OBJECT,
	"optionalfeature": PropOrder._OPTIONALFEATURE,
	"psionic": PropOrder._PSIONIC,
	"reward": PropOrder._REWARD,
	"variantrule": PropOrder._VARIANTRULE,
	"spellFluff": PropOrder._GENERIC_FLUFF,
	"race": PropOrder._RACE,
	"subrace": PropOrder._SUBRACE,
	"table": PropOrder._TABLE,
	"trap": PropOrder._TRAP,
	"hazard": PropOrder._HAZARD,
	"recipe": PropOrder._RECIPE,
	"recipeFluff": PropOrder._GENERIC_FLUFF,
	"charoption": PropOrder._CHAROPTION,
	"charoptionFluff": PropOrder._GENERIC_FLUFF,
	"skill": PropOrder._SKILL,
	"sense": PropOrder._SENSE,
	"deck": PropOrder._DECK,
	"card": PropOrder._CARD,
};

globalThis.PropOrder = PropOrder;

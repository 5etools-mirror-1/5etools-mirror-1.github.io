"use strict";

class PageFilterBestiary extends PageFilter {
	static _NEUT_ALIGNS = ["NX", "NY"];
	static MISC_FILTER_SPELLCASTER = "Spellcaster, ";
	static _RE_SPELL_TAG = /{@spell ([^}]+)}/g;
	static _WALKER = null;
	static _BASIC_ENTRY_PROPS = [
		"trait",
		"action",
		"bonus",
		"reaction",
		"legendary",
		"mythic",
	];
	static _DRAGON_AGES = ["wyrmling", "young", "adult", "ancient", "greatwyrm", "aspect"];

	// region static
	static sortMonsters (a, b, o) {
		if (o.sortBy === "count") return SortUtil.ascSort(a.data.count, b.data.count) || SortUtil.compareListNames(a, b);
		switch (o.sortBy) {
			case "name": return SortUtil.compareListNames(a, b);
			case "type": return SortUtil.ascSort(a.values.type, b.values.type) || SortUtil.compareListNames(a, b);
			case "source": return SortUtil.ascSort(a.values.source, b.values.source) || SortUtil.compareListNames(a, b);
			case "cr": return SortUtil.ascSortCr(a.values.cr, b.values.cr) || SortUtil.compareListNames(a, b);
			case "page": return SortUtil.ascSort(a.values.page, b.values.page) || SortUtil.compareListNames(a, b);
		}
	}

	static ascSortMiscFilter (a, b) {
		a = a.item;
		b = b.item;
		if (a.includes(PageFilterBestiary.MISC_FILTER_SPELLCASTER) && b.includes(PageFilterBestiary.MISC_FILTER_SPELLCASTER)) {
			a = Parser.attFullToAbv(a.replace(PageFilterBestiary.MISC_FILTER_SPELLCASTER, ""));
			b = Parser.attFullToAbv(b.replace(PageFilterBestiary.MISC_FILTER_SPELLCASTER, ""));
			return SortUtil.ascSortAtts(a, b);
		} else {
			a = Parser.monMiscTagToFull(a);
			b = Parser.monMiscTagToFull(b);
			return SortUtil.ascSortLower(a, b);
		}
	}

	static _ascSortDragonAgeFilter (a, b) {
		a = a.item;
		b = b.item;
		const ixA = PageFilterBestiary._DRAGON_AGES.indexOf(a);
		const ixB = PageFilterBestiary._DRAGON_AGES.indexOf(b);
		if (~ixA && ~ixB) return SortUtil.ascSort(ixA, ixB);
		if (~ixA) return Number.MIN_SAFE_INTEGER;
		if (~ixB) return Number.MAX_SAFE_INTEGER;
		return SortUtil.ascSortLower(a, b);
	}

	static getAllImmRest (toParse, key) {
		const out = [];
		for (const it of toParse) this._getAllImmRest_recurse(it, key, out); // Speed > safety
		return out;
	}

	static _getAllImmRest_recurse (it, key, out, conditional) {
		if (typeof it === "string") {
			out.push(conditional ? `${it} (Conditional)` : it);
		} else if (it[key]) {
			it[key].forEach(nxt => this._getAllImmRest_recurse(nxt, key, out, !!it.cond));
		}
	}

	static _getDamageTagDisplayText (tag) { return Parser.dmgTypeToFull(tag).toTitleCase(); }
	static _getConditionDisplayText (uid) { return uid.split("|")[0].toTitleCase(); }
	// endregion

	constructor () {
		super();

		this._crFilter = new RangeFilter({
			header: "Challenge Rating",
			isLabelled: true,
			labelSortFn: SortUtil.ascSortCr,
			labels: [...Parser.CRS, "Unknown", "\u2014"],
			labelDisplayFn: it => it === "\u2014" ? "None" : it,
		});
		this._sizeFilter = new Filter({
			header: "Size",
			items: [
				Parser.SZ_TINY,
				Parser.SZ_SMALL,
				Parser.SZ_MEDIUM,
				Parser.SZ_LARGE,
				Parser.SZ_HUGE,
				Parser.SZ_GARGANTUAN,
				Parser.SZ_VARIES,
			],
			displayFn: Parser.sizeAbvToFull,
			itemSortFn: null,
		});
		this._speedFilter = new RangeFilter({header: "Speed", min: 30, max: 30, suffix: " ft"});
		this._speedTypeFilter = new Filter({header: "Speed Type", items: [...Parser.SPEED_MODES, "hover"], displayFn: StrUtil.uppercaseFirst});
		this._strengthFilter = new RangeFilter({header: "Strength", min: 1, max: 30});
		this._dexterityFilter = new RangeFilter({header: "Dexterity", min: 1, max: 30});
		this._constitutionFilter = new RangeFilter({header: "Constitution", min: 1, max: 30});
		this._intelligenceFilter = new RangeFilter({header: "Intelligence", min: 1, max: 30});
		this._wisdomFilter = new RangeFilter({header: "Wisdom", min: 1, max: 30});
		this._charismaFilter = new RangeFilter({header: "Charisma", min: 1, max: 30});
		this._abilityScoreFilter = new MultiFilter({
			header: "Ability Scores",
			filters: [this._strengthFilter, this._dexterityFilter, this._constitutionFilter, this._intelligenceFilter, this._wisdomFilter, this._charismaFilter],
			isAddDropdownToggle: true,
		});
		this._acFilter = new RangeFilter({header: "Armor Class"});
		this._averageHpFilter = new RangeFilter({header: "Average Hit Points"});
		this._typeFilter = new Filter({
			header: "Type",
			items: [...Parser.MON_TYPES],
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._tagFilter = new Filter({header: "Tag", displayFn: StrUtil.toTitleCase});
		this._sidekickTypeFilter = new Filter({
			header: "Sidekick Type",
			items: ["expert", "spellcaster", "warrior"],
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._sidekickTagFilter = new Filter({header: "Sidekick Tag", displayFn: StrUtil.toTitleCase});
		this._alignmentFilter = new Filter({
			header: "Alignment",
			items: ["L", "NX", "C", "G", "NY", "E", "N", "U", "A", "No Alignment"],
			displayFn: alignment => Parser.alignmentAbvToFull(alignment).toTitleCase(),
			itemSortFn: null,
		});
		this._languageFilter = new Filter({
			header: "Languages",
			displayFn: (k) => Parser.monLanguageTagToFull(k).toTitleCase(),
			umbrellaItems: ["X", "XX"],
			umbrellaExcludes: ["CS"],
		});
		this._damageTypeFilterBase = new Filter({
			header: "Damage Inflicted by Traits/Actions",
			displayFn: this.constructor._getDamageTagDisplayText,
			displayFnMini: tag => `Deals ${this.constructor._getDamageTagDisplayText(tag)} (Trait/Action)`,
			items: Object.keys(Parser.DMGTYPE_JSON_TO_FULL),
		});
		this._damageTypeFilterLegendary = new Filter({
			header: "Damage Inflicted by Lair Actions/Regional Effects",
			displayFn: this.constructor._getDamageTagDisplayText,
			displayFnMini: tag => `Deals ${this.constructor._getDamageTagDisplayText(tag)} (Lair/Regional)`,
			items: Object.keys(Parser.DMGTYPE_JSON_TO_FULL),
		});
		this._damageTypeFilterSpells = new Filter({
			header: "Damage Inflicted by Spells",
			displayFn: this.constructor._getDamageTagDisplayText,
			displayFnMini: tag => `Deals ${this.constructor._getDamageTagDisplayText(tag)} (Spell)`,
			items: Object.keys(Parser.DMGTYPE_JSON_TO_FULL),
		});
		this._damageTypeFilter = new MultiFilter({header: "Damage Inflicted", filters: [this._damageTypeFilterBase, this._damageTypeFilterLegendary, this._damageTypeFilterSpells]});
		this._conditionsInflictedFilterBase = new Filter({
			header: "Conditions Inflicted by Traits/Actions",
			displayFn: this.constructor._getConditionDisplayText,
			displayFnMini: uid => `Inflicts ${this.constructor._getConditionDisplayText(uid)} (Trait/Action)`,
			items: [...Parser.CONDITIONS],
		});
		this._conditionsInflictedFilterLegendary = new Filter({
			header: "Conditions Inflicted by Lair Actions/Regional Effects",
			displayFn: this.constructor._getConditionDisplayText,
			displayFnMini: uid => `Inflicts ${this.constructor._getConditionDisplayText(uid)} (Lair/Regional)`,
			items: [...Parser.CONDITIONS],
		});
		this._conditionsInflictedFilterSpells = new Filter({
			header: "Conditions Inflicted by Spells",
			displayFn: this.constructor._getConditionDisplayText,
			displayFnMini: uid => `Inflicts ${this.constructor._getConditionDisplayText(uid)} (Spell)`,
			items: [...Parser.CONDITIONS],
		});
		this._conditionsInflictedFilter = new MultiFilter({header: "Conditions Inflicted", filters: [this._conditionsInflictedFilterBase, this._conditionsInflictedFilterLegendary, this._conditionsInflictedFilterSpells]});
		this._senseFilter = new Filter({
			header: "Senses",
			displayFn: (it) => Parser.monSenseTagToFull(it).toTitleCase(),
			items: ["B", "D", "SD", "T", "U"],
			itemSortFn: SortUtil.ascSortLower,
		});
		this._passivePerceptionFilter = new RangeFilter({header: "Passive Perception", min: 10, max: 10});
		this._skillFilter = new Filter({
			header: "Skills",
			displayFn: (it) => it.toTitleCase(),
			items: Object.keys(Parser.SKILL_TO_ATB_ABV),
		});
		this._saveFilter = new Filter({
			header: "Saves",
			displayFn: Parser.attAbvToFull,
			items: [...Parser.ABIL_ABVS],
			itemSortFn: null,
		});
		this._environmentFilter = new Filter({
			header: "Environment",
			items: ["arctic", "coastal", "desert", "forest", "grassland", "hill", "mountain", "none", "swamp", "underdark", "underwater", "urban"],
			displayFn: StrUtil.uppercaseFirst,
		});
		this._vulnerableFilter = FilterCommon.getDamageVulnerableFilter();
		this._resistFilter = FilterCommon.getDamageResistFilter();
		this._immuneFilter = FilterCommon.getDamageImmuneFilter();
		this._defenceFilter = new MultiFilter({header: "Damage", filters: [this._vulnerableFilter, this._resistFilter, this._immuneFilter]});
		this._conditionImmuneFilter = FilterCommon.getConditionImmuneFilter();
		this._traitFilter = new Filter({
			header: "Traits",
			items: [
				"Aggressive", "Ambusher", "Amorphous", "Amphibious", "Antimagic Susceptibility", "Brute", "Charge", "Damage Absorption", "Death Burst", "Devil's Sight", "False Appearance", "Fey Ancestry", "Flyby", "Hold Breath", "Illumination", "Immutable Form", "Incorporeal Movement", "Keen Senses", "Legendary Resistances", "Light Sensitivity", "Magic Resistance", "Magic Weapons", "Pack Tactics", "Pounce", "Rampage", "Reckless", "Regeneration", "Rejuvenation", "Shapechanger", "Siege Monster", "Sneak Attack", "Spider Climb", "Sunlight Sensitivity", "Tunneler", "Turn Immunity", "Turn Resistance", "Undead Fortitude", "Water Breathing", "Web Sense", "Web Walker",
			],
		});
		this._actionReactionFilter = new Filter({
			header: "Actions & Reactions",
			items: [
				"Frightful Presence", "Multiattack", "Parry", "Swallow", "Teleport", "Tentacles",
			],
		});
		this._miscFilter = new Filter({
			header: "Miscellaneous",
			items: ["Familiar", ...Object.keys(Parser.MON_MISC_TAG_TO_FULL), "Bonus Actions", "Lair Actions", "Legendary", "Mythic", "Adventure NPC", "Spellcaster", ...Object.values(Parser.ATB_ABV_TO_FULL).map(it => `${PageFilterBestiary.MISC_FILTER_SPELLCASTER}${it}`), "Regional Effects", "Reactions", "Reprinted", "Swarm", "Has Variants", "Modified Copy", "Has Alternate Token", "Has Info", "Has Images", "Has Token", "Has Recharge", "SRD", "Basic Rules", "AC from Item(s)", "AC from Natural Armor", "AC from Unarmored Defense", "Summoned by Spell", "Summoned by Class"],
			displayFn: (it) => Parser.monMiscTagToFull(it).uppercaseFirst(),
			deselFn: (it) => ["Adventure NPC", "Reprinted"].includes(it),
			itemSortFn: PageFilterBestiary.ascSortMiscFilter,
			isMiscFilter: true,
		});
		this._spellcastingTypeFilter = new Filter({
			header: "Spellcasting Type",
			items: ["F", "I", "P", "S", "O", "CA", "CB", "CC", "CD", "CP", "CR", "CS", "CL", "CW"],
			displayFn: Parser.monSpellcastingTagToFull,
		});
		this._spellSlotLevelFilter = new RangeFilter({
			header: "Spell Slot Level",
			min: 1,
			max: 9,
			displayFn: it => Parser.getOrdinalForm(it),
		});
		this._spellKnownFilter = new SearchableFilter({header: "Spells Known", displayFn: (it) => it.split("|")[0].toTitleCase(), itemSortFn: SortUtil.ascSortLower});
		this._dragonAgeFilter = new Filter({
			header: "Dragon Age",
			items: [...PageFilterBestiary._DRAGON_AGES],
			itemSortFn: PageFilterBestiary._ascSortDragonAgeFilter,
			displayFn: (it) => it.toTitleCase(),
		});
		this._dragonCastingColor = new Filter({
			header: "Dragon Casting Color",
			items: [...Renderer.monster.dragonCasterVariant.getAvailableColors()],
			displayFn: (it) => it.toTitleCase(),
		});
	}

	static mutateForFilters (mon) {
		Renderer.monster.initParsed(mon);

		if (typeof mon.speed === "number" && mon.speed > 0) {
			mon._fSpeedType = ["walk"];
			mon._fSpeed = mon.speed;
		} else {
			mon._fSpeedType = Object.keys(mon.speed).filter(k => mon.speed[k]);
			if (mon._fSpeedType.length) mon._fSpeed = mon._fSpeedType.map(k => mon.speed[k].number || mon.speed[k]).filter(it => !isNaN(it)).sort((a, b) => SortUtil.ascSort(b, a))[0];
			else mon._fSpeed = 0;
			if (mon.speed.canHover) mon._fSpeedType.push("hover");
		}

		mon._fAc = mon.ac.map(it => it.special ? null : (it.ac || it)).filter(it => it !== null);
		if (!mon._fAc.length) mon._fAc = null;
		mon._fHp = mon.hp.average;
		if (mon.alignment) {
			const tempAlign = typeof mon.alignment[0] === "object"
				? Array.prototype.concat.apply([], mon.alignment.map(a => a.alignment))
				: [...mon.alignment];
			if (tempAlign.includes("N") && !tempAlign.includes("G") && !tempAlign.includes("E")) tempAlign.push("NY");
			else if (tempAlign.includes("N") && !tempAlign.includes("L") && !tempAlign.includes("C")) tempAlign.push("NX");
			else if (tempAlign.length === 1 && tempAlign.includes("N")) Array.prototype.push.apply(tempAlign, PageFilterBestiary._NEUT_ALIGNS);
			mon._fAlign = tempAlign;
		} else {
			mon._fAlign = ["No Alignment"];
		}
		mon._fEnvironment = mon.environment || ["none"];
		mon._fVuln = mon.vulnerable ? PageFilterBestiary.getAllImmRest(mon.vulnerable, "vulnerable") : [];
		mon._fRes = mon.resist ? PageFilterBestiary.getAllImmRest(mon.resist, "resist") : [];
		mon._fImm = mon.immune ? PageFilterBestiary.getAllImmRest(mon.immune, "immune") : [];
		mon._fCondImm = mon.conditionImmune ? PageFilterBestiary.getAllImmRest(mon.conditionImmune, "conditionImmune") : [];
		mon._fSave = mon.save ? Object.keys(mon.save) : [];
		mon._fSkill = mon.skill ? Object.keys(mon.skill) : [];
		mon._fSources = SourceFilter.getCompleteFilterSources(mon);
		mon._fPassive = !isNaN(mon.passive) ? Number(mon.passive) : null;

		Parser.ABIL_ABVS
			.forEach(ab => {
				if (mon[ab] == null) return;
				const propF = `_f${ab.uppercaseFirst()}`;
				mon[propF] = typeof mon[ab] !== "number" ? null : mon[ab];
			});

		mon._fMisc = [...mon.miscTags || []];
		for (const it of (mon.trait || [])) {
			if (it.name && it.name.startsWith("Unarmored Defense")) mon._fMisc.push("AC from Unarmored Defense");
		}
		for (const it of (mon.ac || [])) {
			if (!it.from) continue;
			if (it.from.includes("natural armor")) mon._fMisc.push("AC from Natural Armor");
			if (it.from.some(x => x.startsWith("{@item "))) mon._fMisc.push("AC from Item(s)");
			if (!mon._fMisc.includes("AC from Unarmored Defense") && it.from.includes("Unarmored Defense")) mon._fMisc.push("AC from Unarmored Defense");
		}
		if (mon.legendary) mon._fMisc.push("Legendary");
		if (mon.familiar) mon._fMisc.push("Familiar");
		if (mon.type.swarmSize) mon._fMisc.push("Swarm");
		if (mon.spellcasting) {
			mon._fMisc.push("Spellcaster");
			for (const sc of mon.spellcasting) {
				if (sc.ability) mon._fMisc.push(`${PageFilterBestiary.MISC_FILTER_SPELLCASTER}${Parser.attAbvToFull(sc.ability)}`);
			}
		}
		if (mon.isNpc) mon._fMisc.push("Adventure NPC");
		const legGroup = DataUtil.monster.getMetaGroup(mon);
		if (legGroup) {
			if (legGroup.lairActions) mon._fMisc.push("Lair Actions");
			if (legGroup.regionalEffects) mon._fMisc.push("Regional Effects");
		}
		if (mon.reaction) mon._fMisc.push("Reactions");
		if (mon.bonus) mon._fMisc.push("Bonus Actions");
		if (mon.variant) mon._fMisc.push("Has Variants");
		if (mon._isCopy) mon._fMisc.push("Modified Copy");
		if (mon.altArt) mon._fMisc.push("Has Alternate Token");
		if (mon.srd) mon._fMisc.push("SRD");
		if (mon.basicRules) mon._fMisc.push("Basic Rules");
		if (mon.tokenUrl || mon.hasToken) mon._fMisc.push("Has Token");
		if (mon.mythic) mon._fMisc.push("Mythic");
		if (mon.hasFluff || mon.fluff?.entries) mon._fMisc.push("Has Info");
		if (mon.hasFluffImages || mon.fluff?.images) mon._fMisc.push("Has Images");
		if (this._isReprinted({reprintedAs: mon.reprintedAs, tag: "creature", prop: "monster", page: UrlUtil.PG_BESTIARY})) mon._fMisc.push("Reprinted");
		if (this._hasRecharge(mon)) mon._fMisc.push("Has Recharge");
		if (mon._versionBase_isVersion) mon._fMisc.push("Is Variant");
		if (mon.summonedBySpell) mon._fMisc.push("Summoned by Spell");
		if (mon.summonedByClass) mon._fMisc.push("Summoned by Class");

		const spellcasterMeta = this._getSpellcasterMeta(mon);
		if (spellcasterMeta) {
			if (spellcasterMeta.spellLevels.size) mon._fSpellSlotLevels = [...spellcasterMeta.spellLevels];
			if (spellcasterMeta.spellSet.size) mon._fSpellsKnown = [...spellcasterMeta.spellSet];
		}

		if (mon.languageTags?.length) mon._fLanguageTags = mon.languageTags;
		else mon._fLanguageTags = ["None"];
	}

	static _getSpellcasterMeta (mon) {
		if (!mon.spellcasting?.length) return null;

		PageFilterBestiary._WALKER = PageFilterBestiary._WALKER || MiscUtil.getWalker({isNoModification: true});

		const spellSet = new Set();
		const spellLevels = new Set();
		for (const spc of mon.spellcasting) {
			if (spc.spells) {
				const slotLevels = Object.keys(spc.spells).map(Number).filter(Boolean);
				for (const slotLevel of slotLevels) spellLevels.add(slotLevel);
			}

			PageFilterBestiary._WALKER.walk(
				spc,
				{
					string: this._getSpellcasterMeta_stringHandler.bind(null, spellSet),
				},
			);
		}

		return {spellLevels, spellSet};
	}

	static _getSpellcasterMeta_stringHandler (spellSet, str) {
		str.replace(PageFilterBestiary._RE_SPELL_TAG, (...m) => {
			const parts = m[1].split("|").slice(0, 2);
			parts[1] = parts[1] || Parser.SRC_PHB;
			spellSet.add(parts.join("|").toLowerCase());
			return "";
		});
	}

	static _hasRecharge (mon) {
		for (const prop of PageFilterBestiary._BASIC_ENTRY_PROPS) {
			if (!mon[prop]) continue;
			for (const ent of mon[prop]) {
				if (!ent?.name) continue;
				if (ent.name.includes("{@recharge")) return true;
			}
		}
		return false;
	}

	addToFilters (mon, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(mon._fSources);
		this._crFilter.addItem(mon._fCr);
		this._strengthFilter.addItem(mon._fStr);
		this._dexterityFilter.addItem(mon._fDex);
		this._constitutionFilter.addItem(mon._fCon);
		this._intelligenceFilter.addItem(mon._fInt);
		this._wisdomFilter.addItem(mon._fWis);
		this._charismaFilter.addItem(mon._fCha);
		this._speedFilter.addItem(mon._fSpeed);
		mon.ac.forEach(it => this._acFilter.addItem(it.ac || it));
		if (mon.hp.average) this._averageHpFilter.addItem(mon.hp.average);
		this._tagFilter.addItem(mon._pTypes.tags);
		this._sidekickTypeFilter.addItem(mon._pTypes.typeSidekick);
		this._sidekickTagFilter.addItem(mon._pTypes.tagsSidekick);
		this._traitFilter.addItem(mon.traitTags);
		this._actionReactionFilter.addItem(mon.actionTags);
		this._environmentFilter.addItem(mon._fEnvironment);
		this._vulnerableFilter.addItem(mon._fVuln);
		this._resistFilter.addItem(mon._fRes);
		this._immuneFilter.addItem(mon._fImm);
		this._senseFilter.addItem(mon.senseTags);
		this._passivePerceptionFilter.addItem(mon._fPassive);
		this._spellSlotLevelFilter.addItem(mon._fSpellSlotLevels);
		this._spellKnownFilter.addItem(mon._fSpellsKnown);
		if (mon._versionBase_isVersion) this._miscFilter.addItem("Is Variant");
		this._damageTypeFilterBase.addItem(mon.damageTags);
		this._damageTypeFilterLegendary.addItem(mon.damageTagsLegendary);
		this._damageTypeFilterSpells.addItem(mon.damageTagsSpell);
		this._conditionsInflictedFilterBase.addItem(mon.conditionInflict);
		this._conditionsInflictedFilterLegendary.addItem(mon.conditionInflictLegendary);
		this._conditionsInflictedFilterSpells.addItem(mon.conditionInflictSpell);
		this._dragonAgeFilter.addItem(mon.dragonAge);
		this._dragonCastingColor.addItem(mon.dragonCastingColor);
	}

	async _pPopulateBoxOptions (opts) {
		Object.entries(Parser.MON_LANGUAGE_TAG_TO_FULL)
			.sort(([, vA], [, vB]) => SortUtil.ascSortLower(vA, vB))
			.forEach(([k]) => this._languageFilter.addItem(k));
		this._languageFilter.addItem("None");

		opts.filters = [
			this._sourceFilter,
			this._crFilter,
			this._typeFilter,
			this._tagFilter,
			this._sidekickTypeFilter,
			this._sidekickTagFilter,
			this._environmentFilter,
			this._defenceFilter,
			this._conditionImmuneFilter,
			this._traitFilter,
			this._actionReactionFilter,
			this._miscFilter,
			this._spellcastingTypeFilter,
			this._spellSlotLevelFilter,
			this._sizeFilter,
			this._speedFilter,
			this._speedTypeFilter,
			this._alignmentFilter,
			this._saveFilter,
			this._skillFilter,
			this._senseFilter,
			this._passivePerceptionFilter,
			this._languageFilter,
			this._damageTypeFilter,
			this._conditionsInflictedFilter,
			this._dragonAgeFilter,
			this._dragonCastingColor,
			this._acFilter,
			this._averageHpFilter,
			this._abilityScoreFilter,
			this._spellKnownFilter,
		];
	}

	toDisplay (values, m) {
		return this._filterBox.toDisplay(
			values,
			m._fSources,
			m._fCr,
			m._pTypes.types,
			m._pTypes.tags,
			m._pTypes.typeSidekick,
			m._pTypes.tagsSidekick,
			m._fEnvironment,
			[
				m._fVuln,
				m._fRes,
				m._fImm,
			],
			m._fCondImm,
			m.traitTags,
			m.actionTags,
			m._fMisc,
			m.spellcastingTags,
			m._fSpellSlotLevels,
			m.size,
			m._fSpeed,
			m._fSpeedType,
			m._fAlign,
			m._fSave,
			m._fSkill,
			m.senseTags,
			m._fPassive,
			m._fLanguageTags,
			[
				m.damageTags,
				m.damageTagsLegendary,
				m.damageTagsSpell,
			],
			[
				m.conditionInflict,
				m.conditionInflictLegendary,
				m.conditionInflictSpell,
			],
			m.dragonAge,
			m.dragonCastingColor,
			m._fAc,
			m._fHp,
			[
				m._fStr,
				m._fDex,
				m._fCon,
				m._fInt,
				m._fWis,
				m._fCha,
			],
			m._fSpellsKnown,
		);
	}
}

globalThis.PageFilterBestiary = PageFilterBestiary;

class ModalFilterBestiary extends ModalFilter {
	/**
	 * @param opts
	 * @param opts.namespace
	 * @param [opts.isRadio]
	 * @param [opts.allData]
	 */
	constructor (opts) {
		opts = opts || {};
		super({
			...opts,
			modalTitle: `Creature${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterBestiary(),
			fnSort: PageFilterBestiary.sortMonsters,
		});
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "4"},
			{sort: "type", text: "Type", width: "4"},
			{sort: "cr", text: "CR", width: "2"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pLoadAllData () {
		return [
			...(await DataUtil.monster.pLoadAll()),
			...((await PrereleaseUtil.pGetBrewProcessed()).monster || []),
			...((await BrewUtil2.pGetBrewProcessed()).monster || []),
		];
	}

	_getListItem (pageFilter, mon, itI) {
		Renderer.monster.initParsed(mon);
		pageFilter.mutateAndAddToFilters(mon);

		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 ve-flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](mon);
		const source = Parser.sourceJsonToAbv(mon.source);
		const type = mon._pTypes.asText;
		const cr = mon._pCr;

		eleRow.innerHTML = `<div class="w-100 ve-flex-vh-center lst--border veapp__list-row no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 ve-flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 ve-flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-4 ${mon._versionBase_isVersion ? "italic" : ""} ${this._getNameStyle()}">${mon._versionBase_isVersion ? `<span class="px-3"></span>` : ""}${mon.name}</div>
			<div class="col-4">${type}</div>
			<div class="col-2 text-center">${cr}</div>
			<div class="col-1 text-center ${Parser.sourceJsonToColor(mon.source)} pr-0" title="${Parser.sourceJsonToFull(mon.source)}" ${Parser.sourceJsonToStyle(mon.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			itI,
			eleRow,
			mon.name,
			{
				hash,
				source,
				sourceJson: mon.source,
				type,
				cr,
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_BESTIARY, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}

globalThis.ModalFilterBestiary = ModalFilterBestiary;

class ListSyntaxBestiary extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"trait",
		"spellcasting",
		"action",
		"bonus",
		"reaction",
		"legendary",
		"mythic",
		"variant",
	];
	static _INDEXABLE_PROPS_LEG_GROUP = [
		"lairActions",
		"regionalEffects",
		"mythicEncounter",
	];

	_getSearchCacheStats (entity) {
		const legGroup = DataUtil.monster.getMetaGroup(entity);
		if (!legGroup && this.constructor._INDEXABLE_PROPS_ENTRIES.every(it => !entity[it])) return "";
		const ptrOut = {_: ""};
		this.constructor._INDEXABLE_PROPS_ENTRIES.forEach(it => this._getSearchCache_handleEntryProp(entity, it, ptrOut));
		if (legGroup) this.constructor._INDEXABLE_PROPS_LEG_GROUP.forEach(it => this._getSearchCache_handleEntryProp(legGroup, it, ptrOut));
		return ptrOut._;
	}
}

globalThis.ListSyntaxBestiary = ListSyntaxBestiary;

"use strict";

class VariantClassFilter extends Filter {
	constructor (opts) {
		super({
			header: "Optional/Variant Class",
			nests: {},
			groupFn: it => it.userData.group,
			...opts,
		});

		this._parent = null;
	}

	set parent (multiFilterClasses) { this._parent = multiFilterClasses; }

	handleVariantSplit (isVariantSplit) {
		this.__$wrpFilter.toggleVe(isVariantSplit);
	}
}

class MultiFilterClasses extends MultiFilter {
	constructor (opts) {
		super({header: "Classes", mode: "or", filters: [opts.classFilter, opts.subclassFilter, opts.variantClassFilter], ...opts});

		this._classFilter = opts.classFilter;
		this._subclassFilter = opts.subclassFilter;
		this._variantClassFilter = opts.variantClassFilter;

		this._variantClassFilter.parent = this;
	}

	get classFilter_ () { return this._classFilter; }
	get isVariantSplit () { return this._meta.isVariantSplit; }

	$render (opts) {
		const $out = super.$render(opts);

		const hkVariantSplit = () => this._variantClassFilter.handleVariantSplit(this._meta.isVariantSplit);
		this._addHook("meta", "isVariantSplit", hkVariantSplit);
		hkVariantSplit();

		return $out;
	}

	_getHeaderControls_addExtraStateBtns (opts, wrpStateBtnsOuter) {
		const btnToggleVariantSplit = ComponentUiUtil.getBtnBool(
			this,
			"isVariantSplit",
			{
				ele: e_({tag: "button", clazz: "btn btn-default btn-xs", text: "Include Variants"}),
				isInverted: true,
				stateName: "meta",
				stateProp: "_meta",
				title: `If "Optional/Variant Class" spell lists should be treated as part of the "Class" filter.`,
			},
		);

		e_({
			tag: "div",
			clazz: `btn-group w-100 ve-flex-v-center mobile__m-1 mobile__mb-2`,
			children: [
				btnToggleVariantSplit,
			],
		}).prependTo(wrpStateBtnsOuter);
	}

	getDefaultMeta () {
		return {...MultiFilterClasses._DEFAULT_META, ...super.getDefaultMeta()};
	}
}
MultiFilterClasses._DEFAULT_META = {
	isVariantSplit: false,
};

class PageFilterSpells extends PageFilter {
	// toss these into the "Tags" section to save screen space
	static _META_ADD_CONC = "Concentration";
	static _META_ADD_V = "Verbal";
	static _META_ADD_S = "Somatic";
	static _META_ADD_M = "Material";
	static _META_ADD_R = "Royalty";
	static _META_ADD_M_COST = "Material with Cost";
	static _META_ADD_M_CONSUMED = "Material is Consumed";
	static _META_ADD_M_CONSUMED_OPTIONAL = "Material is Optionally Consumed";

	static F_RNG_POINT = "Point";
	static F_RNG_SELF_AREA = "Self (Area)";
	static F_RNG_SELF = "Self";
	static F_RNG_TOUCH = "Touch";
	static F_RNG_SPECIAL = "Special";

	static _META_FILTER_BASE_ITEMS = [
		this._META_ADD_CONC,
		this._META_ADD_V,
		this._META_ADD_S,
		this._META_ADD_M,
		this._META_ADD_R,
		this._META_ADD_M_COST,
		this._META_ADD_M_CONSUMED,
		this._META_ADD_M_CONSUMED_OPTIONAL,
		...Object.keys(Parser.SP_MISC_TAG_TO_FULL),
	];

	static INCHES_PER_FOOT = 12;
	static FEET_PER_YARD = 3;
	static FEET_PER_MILE = 5280;

	// region static
	static sortSpells (a, b, o) {
		switch (o.sortBy) {
			case "name": return SortUtil.compareListNames(a, b);
			case "source":
			case "level":
			case "school":
			case "concentration":
			case "ritual": return SortUtil.ascSort(a.values[o.sortBy], b.values[o.sortBy]) || SortUtil.compareListNames(a, b);
			case "time": return SortUtil.ascSort(a.values.normalisedTime, b.values.normalisedTime) || SortUtil.compareListNames(a, b);
			case "range": return SortUtil.ascSort(a.values.normalisedRange, b.values.normalisedRange) || SortUtil.compareListNames(a, b);
		}
	}

	static sortMetaFilter (a, b) {
		const ixA = PageFilterSpells._META_FILTER_BASE_ITEMS.indexOf(a.item);
		const ixB = PageFilterSpells._META_FILTER_BASE_ITEMS.indexOf(b.item);

		if (~ixA && ~ixB) return ixA - ixB;
		if (~ixA) return -1;
		if (~ixB) return 1;
		return SortUtil.ascSortLower(a, b);
	}

	static getFilterAbilitySave (ability) {
		return `${ability.uppercaseFirst().substring(0, 3)}. Save`;
	}

	static getFilterAbilityCheck (ability) {
		return `${ability.uppercaseFirst().substring(0, 3)}. Check`;
	}

	static getMetaFilterObj (s) {
		const out = [];
		if (s.meta) {
			Object.entries(s.meta)
				.filter(([_, v]) => v)
				.sort(SortUtil.ascSort)
				.forEach(([k]) => out.push(k.toTitleCase()));
		}
		if (s.duration.filter(d => d.concentration).length) {
			out.push(PageFilterSpells._META_ADD_CONC);
			s._isConc = true;
		} else s._isConc = false;
		if (s.components && s.components.v) out.push(PageFilterSpells._META_ADD_V);
		if (s.components && s.components.s) out.push(PageFilterSpells._META_ADD_S);
		if (s.components && s.components.m) out.push(PageFilterSpells._META_ADD_M);
		if (s.components && s.components.r) out.push(PageFilterSpells._META_ADD_R);
		if (s.components && s.components.m && s.components.m.cost) out.push(PageFilterSpells._META_ADD_M_COST);
		if (s.components && s.components.m && s.components.m.consume) {
			if (s.components.m.consume === "optional") out.push(PageFilterSpells._META_ADD_M_CONSUMED_OPTIONAL);
			else out.push(PageFilterSpells._META_ADD_M_CONSUMED);
		}
		if (s.miscTags) out.push(...s.miscTags);
		if ((!s.miscTags || (s.miscTags && !s.miscTags.includes("PRM"))) && s.duration.filter(it => it.type === "permanent").length) out.push("PRM");
		if ((!s.miscTags || (s.miscTags && !s.miscTags.includes("SCL"))) && s.entriesHigherLevel) out.push("SCL");
		if (s.srd) out.push("SRD");
		if (s.basicRules) out.push("Basic Rules");
		if (s.hasFluff || s.fluff?.entries) out.push("Has Info");
		if (s.hasFluffImages || s.fluff?.images) out.push("Has Images");
		return out;
	}

	static getFilterDuration (spell) {
		const fDur = spell.duration[0] || {type: "special"};
		switch (fDur.type) {
			case "instant": return "Instant";
			case "timed": {
				if (!fDur.duration) return "Special";
				switch (fDur.duration.type) {
					case "turn":
					case "round": return "1 Round";

					case "minute": {
						const amt = fDur.duration.amount || 0;
						if (amt <= 1) return "1 Minute";
						if (amt <= 10) return "10 Minutes";
						if (amt <= 60) return "1 Hour";
						if (amt <= 8 * 60) return "8 Hours";
						return "24+ Hours";
					}

					case "hour": {
						const amt = fDur.duration.amount || 0;
						if (amt <= 1) return "1 Hour";
						if (amt <= 8) return "8 Hours";
						return "24+ Hours";
					}

					case "week":
					case "day":
					case "year": return "24+ Hours";
					default: return "Special";
				}
			}
			case "permanent": return "Permanent";
			case "special":
			default: return "Special";
		}
	}

	static getNormalisedTime (time) {
		const firstTime = time[0];
		let multiplier = 1;
		let offset = 0;
		switch (firstTime.unit) {
			case Parser.SP_TM_B_ACTION: offset = 1; break;
			case Parser.SP_TM_REACTION: offset = 2; break;
			case Parser.SP_TM_ROUND: multiplier = 6; break;
			case Parser.SP_TM_MINS: multiplier = 60; break;
			case Parser.SP_TM_HRS: multiplier = 3600; break;
		}
		if (time.length > 1) offset += 0.5;
		return (multiplier * firstTime.number) + offset;
	}

	static getNormalisedRange (range) {
		const state = {
			multiplier: 1,
			distance: 0,
			offset: 0,
		};

		switch (range.type) {
			case Parser.RNG_SPECIAL: return 1000000000;
			case Parser.RNG_POINT: this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_LINE: state.offset = 1; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_CONE: state.offset = 2; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_RADIUS: state.offset = 3; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_HEMISPHERE: state.offset = 4; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_SPHERE: state.offset = 5; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_CYLINDER: state.offset = 6; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
			case Parser.RNG_CUBE: state.offset = 7; this._getNormalisedRange_getAdjustedForDistance({range, state}); break;
		}

		// value in inches, to allow greater granularity
		return (state.multiplier * state.distance) + state.offset;
	}

	static _getNormalisedRange_getAdjustedForDistance ({range, state}) {
		const dist = range.distance;
		switch (dist.type) {
			case Parser.UNT_FEET: state.multiplier = PageFilterSpells.INCHES_PER_FOOT; state.distance = dist.amount; break;
			case Parser.UNT_YARDS: state.multiplier = PageFilterSpells.INCHES_PER_FOOT * PageFilterSpells.FEET_PER_YARD; state.distance = dist.amount; break;
			case Parser.UNT_MILES: state.multiplier = PageFilterSpells.INCHES_PER_FOOT * PageFilterSpells.FEET_PER_MILE; state.distance = dist.amount; break;
			case Parser.RNG_SELF: state.distance = 0; break;
			case Parser.RNG_TOUCH: state.distance = 1; break;
			case Parser.RNG_SIGHT: state.multiplier = PageFilterSpells.INCHES_PER_FOOT * PageFilterSpells.FEET_PER_MILE; state.distance = 12; break; // assume sight range of person ~100 ft. above the ground
			case Parser.RNG_UNLIMITED_SAME_PLANE: state.distance = 900000000; break; // from BolS (homebrew)
			case Parser.RNG_UNLIMITED: state.distance = 900000001; break;
			default: {
				// it's prerelease/homebrew?
				this._getNormalisedRange_getAdjustedForDistance_prereleaseBrew({range, state, brewUtil: PrereleaseUtil})
					|| this._getNormalisedRange_getAdjustedForDistance_prereleaseBrew({range, state, brewUtil: BrewUtil2});
			}
		}
	}

	static _getNormalisedRange_getAdjustedForDistance_prereleaseBrew ({range, state, brewUtil}) {
		const dist = range.distance;
		const fromBrew = brewUtil.getMetaLookup("spellDistanceUnits")?.[dist.type];
		if (!fromBrew) return false;

		const ftPerUnit = fromBrew.feetPerUnit;
		if (ftPerUnit != null) {
			state.multiplier = PageFilterSpells.INCHES_PER_FOOT * ftPerUnit;
			state.distance = dist.amount;
		} else {
			state.distance = 910000000; // default to max distance, to have them displayed at the bottom
		}

		return true;
	}

	static getFltrSpellLevelStr (level) {
		return level === 0 ? Parser.spLevelToFull(level) : `${Parser.spLevelToFull(level)} level`;
	}

	static getRangeType (range) {
		switch (range.type) {
			case Parser.RNG_SPECIAL: return PageFilterSpells.F_RNG_SPECIAL;
			case Parser.RNG_POINT:
				switch (range.distance.type) {
					case Parser.RNG_SELF: return PageFilterSpells.F_RNG_SELF;
					case Parser.RNG_TOUCH: return PageFilterSpells.F_RNG_TOUCH;
					default: return PageFilterSpells.F_RNG_POINT;
				}
			case Parser.RNG_LINE:
			case Parser.RNG_CONE:
			case Parser.RNG_RADIUS:
			case Parser.RNG_HEMISPHERE:
			case Parser.RNG_SPHERE:
			case Parser.RNG_CYLINDER:
			case Parser.RNG_CUBE:
				return PageFilterSpells.F_RNG_SELF_AREA;
		}
	}

	static getTblTimeStr (time) {
		return (time.number === 1 && Parser.SP_TIME_SINGLETONS.includes(time.unit))
			? `${time.unit.uppercaseFirst()}`
			: `${time.number ? `${time.number} ` : ""}${Parser.spTimeUnitToShort(time.unit).uppercaseFirst()}`;
	}

	static getTblLevelStr (spell) { return `${Parser.spLevelToFull(spell.level)}${spell.meta && spell.meta.ritual ? " (rit.)" : ""}${spell.meta && spell.meta.technomagic ? " (tec.)" : ""}`; }

	static getRaceFilterItem (r) {
		const addSuffix = (
			r.source === Parser.SRC_DMG
			|| SourceUtil.isNonstandardSource(r.source || Parser.SRC_PHB)
			|| (typeof PrereleaseUtil !== "undefined" && PrereleaseUtil.hasSourceJson(r.source || Parser.SRC_PHB))
			|| (typeof BrewUtil2 !== "undefined" && BrewUtil2.hasSourceJson(r.source || Parser.SRC_PHB))
		) && !r.name.includes(Parser.sourceJsonToAbv(r.source));
		const name = `${r.name}${addSuffix ? ` (${Parser.sourceJsonToAbv(r.source)})` : ""}`;
		const opts = {
			item: name,
			userData: {
				group: SourceUtil.getFilterGroup(r.source || Parser.SRC_PHB),
			},
		};
		if (r.baseName) opts.nest = r.baseName;
		else opts.nest = "(No Subraces)";
		return new FilterItem(opts);
	}
	// endregion

	constructor () {
		super();

		this._classFilter = new Filter({
			header: "Class",
			groupFn: it => it.userData.group,
		});
		this._subclassFilter = new Filter({
			header: "Subclass",
			nests: {},
			groupFn: it => it.userData.group,
		});
		this._levelFilter = new Filter({
			header: "Level",
			items: [
				0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
			],
			displayFn: PageFilterSpells.getFltrSpellLevelStr,
		});
		this._variantClassFilter = new VariantClassFilter();
		this._classAndSubclassFilter = new MultiFilterClasses({
			classFilter: this._classFilter,
			subclassFilter: this._subclassFilter,
			variantClassFilter: this._variantClassFilter,
		});
		this._raceFilter = new Filter({
			header: "Race",
			nests: {},
			groupFn: it => it.userData.group,
		});
		this._backgroundFilter = new SearchableFilter({header: "Background"});
		this._featFilter = new SearchableFilter({header: "Feat"});
		this._optionalfeaturesFilter = new SearchableFilter({header: "Other Option/Feature"});
		this._metaFilter = new Filter({
			header: "Components & Miscellaneous",
			items: [...PageFilterSpells._META_FILTER_BASE_ITEMS, "Ritual", "SRD", "Basic Rules", "Has Images", "Has Token"],
			itemSortFn: PageFilterSpells.sortMetaFilter,
			isMiscFilter: true,
			displayFn: it => Parser.spMiscTagToFull(it),
		});
		this._groupFilter = new Filter({header: "Group"});
		this._schoolFilter = new Filter({
			header: "School",
			items: [...Parser.SKL_ABVS],
			displayFn: Parser.spSchoolAbvToFull,
			itemSortFn: (a, b) => SortUtil.ascSortLower(Parser.spSchoolAbvToFull(a.item), Parser.spSchoolAbvToFull(b.item)),
		});
		this._subSchoolFilter = new Filter({
			header: "Subschool",
			items: [],
			displayFn: Parser.spSchoolAbvToFull,
		});
		this._damageFilter = new Filter({
			header: "Damage Type",
			items: MiscUtil.copy(Parser.DMG_TYPES),
			displayFn: StrUtil.uppercaseFirst,
		});
		this._conditionFilter = new Filter({
			header: "Conditions Inflicted",
			items: [...Parser.CONDITIONS],
			displayFn: uid => uid.split("|")[0].toTitleCase(),
		});
		this._spellAttackFilter = new Filter({
			header: "Spell Attack",
			items: ["M", "R", "O"],
			displayFn: Parser.spAttackTypeToFull,
			itemSortFn: null,
		});
		this._saveFilter = new Filter({
			header: "Saving Throw",
			items: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
			displayFn: PageFilterSpells.getFilterAbilitySave,
			itemSortFn: null,
		});
		this._checkFilter = new Filter({
			header: "Ability Check",
			items: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
			displayFn: PageFilterSpells.getFilterAbilityCheck,
			itemSortFn: null,
		});
		this._timeFilter = new Filter({
			header: "Cast Time",
			items: [
				Parser.SP_TM_ACTION,
				Parser.SP_TM_B_ACTION,
				Parser.SP_TM_REACTION,
				Parser.SP_TM_ROUND,
				Parser.SP_TM_MINS,
				Parser.SP_TM_HRS,
			],
			displayFn: Parser.spTimeUnitToFull,
			itemSortFn: null,
		});
		this._durationFilter = new RangeFilter({
			header: "Duration",
			isLabelled: true,
			labelSortFn: null,
			labels: ["Instant", "1 Round", "1 Minute", "10 Minutes", "1 Hour", "8 Hours", "24+ Hours", "Permanent", "Special"],
		});
		this._rangeFilter = new Filter({
			header: "Range",
			items: [
				PageFilterSpells.F_RNG_SELF,
				PageFilterSpells.F_RNG_TOUCH,
				PageFilterSpells.F_RNG_POINT,
				PageFilterSpells.F_RNG_SELF_AREA,
				PageFilterSpells.F_RNG_SPECIAL,
			],
			itemSortFn: null,
		});
		this._areaTypeFilter = new Filter({
			header: "Area Style",
			items: ["ST", "MT", "R", "N", "C", "Y", "H", "L", "S", "Q", "W"],
			displayFn: Parser.spAreaTypeToFull,
			itemSortFn: null,
		});
		this._affectsCreatureTypeFilter = new Filter({
			header: "Affects Creature Types",
			items: [...Parser.MON_TYPES],
			displayFn: StrUtil.toTitleCase,
		});
	}

	static mutateForFilters (s) {
		Renderer.spell.initBrewSources(s);

		// used for sorting
		s._normalisedTime = PageFilterSpells.getNormalisedTime(s.time);
		s._normalisedRange = PageFilterSpells.getNormalisedRange(s.range);

		// used for filtering
		s._fSources = SourceFilter.getCompleteFilterSources(s);
		s._fMeta = PageFilterSpells.getMetaFilterObj(s);
		s._fClasses = Renderer.spell.getCombinedClasses(s, "fromClassList").map(c => {
			return this._getClassFilterItem({
				className: c.name,
				definedInSource: c.definedInSource,
				classSource: c.source,
				isVariantClass: false,
			});
		});
		s._fSubclasses = Renderer.spell.getCombinedClasses(s, "fromSubclass")
			.map(c => {
				return this._getSubclassFilterItem({
					className: c.class.name,
					classSource: c.class.source,
					subclassName: c.subclass.name,
					subclassShortName: c.subclass.shortName,
					subclassSource: c.subclass.source,
					subSubclassName: c.subclass.subSubclass,
				});
			});
		s._fVariantClasses = Renderer.spell.getCombinedClasses(s, "fromClassListVariant").map(c => {
			return this._getClassFilterItem({
				className: c.name,
				definedInSource: c.definedInSource,
				classSource: c.source,
				isVariantClass: true,
			});
		});
		s._fClassesAndVariantClasses = [
			...s._fClasses,
			...s._fVariantClasses
				.map(it => (it.userData.definedInSource && !SourceUtil.isNonstandardSource(it.userData.definedInSource)) ? new FilterItem({item: it.userData.equivalentClassName}) : null)
				.filter(Boolean),
		];
		s._fRaces = Renderer.spell.getCombinedGeneric(s, {propSpell: "races", prop: "race"}).map(PageFilterSpells.getRaceFilterItem);
		s._fBackgrounds = Renderer.spell.getCombinedGeneric(s, {propSpell: "backgrounds", prop: "background"}).map(it => it.name);
		s._fFeats = Renderer.spell.getCombinedGeneric(s, {propSpell: "feats", prop: "feat"}).map(it => it.name);
		s._fOptionalfeatures = Renderer.spell.getCombinedGeneric(s, {propSpell: "optionalfeatures", prop: "optionalfeature"}).map(it => it.name);
		s._fGroups = Renderer.spell.getCombinedGeneric(s, {propSpell: "groups"}).map(it => it.name);
		s._fTimeType = s.time.map(t => t.unit);
		s._fDurationType = PageFilterSpells.getFilterDuration(s);
		s._fRangeType = PageFilterSpells.getRangeType(s.range);

		s._fAreaTags = [...(s.areaTags || [])];
		if (s.range.type === "line" && !s._fAreaTags.includes("L")) s._fAreaTags.push("L");

		s._fAffectsCreatureType = s.affectsCreatureType || [...Parser.MON_TYPES];
	}

	static unmutateForFilters (s) {
		Renderer.spell.uninitBrewSources(s);

		delete s._normalisedTime;
		delete s._normalisedRange;

		Object.keys(s)
			.filter(it => it.startsWith("_f"))
			.forEach(it => delete s[it]);
	}

	addToFilters (s, isExcluded) {
		if (isExcluded) return;

		if (s.level > 9) this._levelFilter.addItem(s.level);
		this._groupFilter.addItem(s._fGroups);
		this._schoolFilter.addItem(s.school);
		this._sourceFilter.addItem(s._fSources);
		this._metaFilter.addItem(s._fMeta);
		this._backgroundFilter.addItem(s._fBackgrounds);
		this._featFilter.addItem(s._fFeats);
		this._optionalfeaturesFilter.addItem(s._fOptionalfeatures);
		s._fClasses.forEach(c => this._classFilter.addItem(c));
		s._fSubclasses.forEach(sc => {
			this._subclassFilter.addNest(sc.nest, {isHidden: true});
			this._subclassFilter.addItem(sc);
		});
		s._fRaces.forEach(r => {
			if (r.nest) this._raceFilter.addNest(r.nest, {isHidden: true});
			this._raceFilter.addItem(r);
		});
		s._fVariantClasses.forEach(c => {
			this._variantClassFilter.addNest(c.nest, {isHidden: true});
			this._variantClassFilter.addItem(c);
		});
		this._subSchoolFilter.addItem(s.subschools);
		this._conditionFilter.addItem(s.conditionInflict);
		this._affectsCreatureTypeFilter.addItem(s.affectsCreatureType);
	}

	async _pPopulateBoxOptions (opts) {
		await SourceUtil.pInitSubclassReprintLookup();

		opts.filters = [
			this._sourceFilter,
			this._levelFilter,
			this._classAndSubclassFilter,
			this._raceFilter,
			this._backgroundFilter,
			this._featFilter,
			this._optionalfeaturesFilter,
			this._metaFilter,
			this._groupFilter,
			this._schoolFilter,
			this._subSchoolFilter,
			this._damageFilter,
			this._conditionFilter,
			this._spellAttackFilter,
			this._saveFilter,
			this._checkFilter,
			this._timeFilter,
			this._durationFilter,
			this._rangeFilter,
			this._areaTypeFilter,
			this._affectsCreatureTypeFilter,
		];
	}

	toDisplay (values, s) {
		return this._filterBox.toDisplay(
			values,
			s._fSources,
			s.level,
			[
				this._classAndSubclassFilter.isVariantSplit ? s._fClasses : s._fClassesAndVariantClasses,
				s._fSubclasses,
				this._classAndSubclassFilter.isVariantSplit ? s._fVariantClasses : null,
			],
			s._fRaces,
			s._fBackgrounds,
			s._fFeats,
			s._fOptionalfeatures,
			s._fMeta,
			s._fGroups,
			s.school,
			s.subschools,
			s.damageInflict,
			s.conditionInflict,
			s.spellAttack,
			s.savingThrow,
			s.abilityCheck,
			s._fTimeType,
			s._fDurationType,
			s._fRangeType,
			s._fAreaTags,
			s._fAffectsCreatureType,
		);
	}
}

globalThis.PageFilterSpells = PageFilterSpells;

class ModalFilterSpells extends ModalFilter {
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
			modalTitle: `Spell${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterSpells(),
			fnSort: PageFilterSpells.sortSpells,
		});
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "3"},
			{sort: "level", text: "Level", width: "1-5"},
			{sort: "time", text: "Time", width: "2"},
			{sort: "school", text: "School", width: "1"},
			{sort: "concentration", text: "C.", title: "Concentration", width: "0-5"},
			{sort: "range", text: "Range", width: "2"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pInit () {
		if (typeof PrereleaseUtil !== "undefined") Renderer.spell.populatePrereleaseLookup(await PrereleaseUtil.pGetBrewProcessed());
		if (typeof BrewUtil2 !== "undefined") Renderer.spell.populateBrewLookup(await BrewUtil2.pGetBrewProcessed());
	}

	async _pLoadAllData () {
		return [
			...(await DataUtil.spell.pLoadAll()),
			...((await PrereleaseUtil.pGetBrewProcessed()).spell || []),
			...((await BrewUtil2.pGetBrewProcessed()).spell || []),
		];
	}

	_getListItem (pageFilter, spell, spI) {
		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 ve-flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS](spell);
		const source = Parser.sourceJsonToAbv(spell.source);
		const levelText = PageFilterSpells.getTblLevelStr(spell);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const concentration = spell._isConc ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		eleRow.innerHTML = `<div class="w-100 ve-flex-vh-center lst--border veapp__list-row no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 ve-flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 ve-flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-3 ${spell._versionBase_isVersion ? "italic" : ""} ${this._getNameStyle()}">${spell._versionBase_isVersion ? `<span class="px-3"></span>` : ""}${spell.name}</div>
			<div class="col-1-5 text-center">${levelText}</div>
			<div class="col-2 text-center">${time}</div>
			<div class="col-1 sp__school-${spell.school} text-center" title="${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}" ${Parser.spSchoolAbvToStyle(spell.school)}>${school}</div>
			<div class="col-0-5 text-center" title="Concentration">${concentration}</div>
			<div class="col-2 text-right">${range}</div>
			<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(spell.source)}" title="${Parser.sourceJsonToFull(spell.source)}" ${Parser.sourceJsonToStyle(spell.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			spI,
			eleRow,
			spell.name,
			{
				hash,
				source,
				sourceJson: spell.source,
				level: spell.level,
				time,
				school: Parser.spSchoolAbvToFull(spell.school),
				classes: Parser.spClassesToFull(spell, {isTextOnly: true}),
				concentration,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_SPELLS, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}

globalThis.ModalFilterSpells = ModalFilterSpells;

class ListSyntaxSpells extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"entries",
		"entriesHigherLevel",
	];
}

globalThis.ListSyntaxSpells = ListSyntaxSpells;

globalThis.PageFilterSpells = PageFilterSpells;

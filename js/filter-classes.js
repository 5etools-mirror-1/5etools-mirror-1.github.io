"use strict";

class PageFilterClassesBase extends PageFilter {
	constructor () {
		super();

		this._miscFilter = new Filter({
			header: "Miscellaneous",
			items: ["Reprinted", "Sidekick", "SRD", "Basic Rules"],
			deselFn: (it) => { return it === "Reprinted" || it === "Sidekick"; },
			displayFnMini: it => it === "Reprinted" ? "Repr." : it,
			displayFnTitle: it => it === "Reprinted" ? it : "",
			isMiscFilter: true,
		});

		this._optionsFilter = new OptionsFilter({
			header: "Other/Text Options",
			defaultState: {
				isDisplayClassIfSubclassActive: false,
				isClassFeatureVariant: true,
			},
			displayFn: k => {
				switch (k) {
					case "isClassFeatureVariant": return "Class Feature Options/Variants";
					case "isDisplayClassIfSubclassActive": return "Display Class if Any Subclass is Visible";
					default: throw new Error(`Unhandled key "${k}"`);
				}
			},
			displayFnMini: k => {
				switch (k) {
					case "isClassFeatureVariant": return "C.F.O/V.";
					case "isDisplayClassIfSubclassActive": return "Sc>C";
					default: throw new Error(`Unhandled key "${k}"`);
				}
			},
		});

		// region source
		this._sourceWalker = MiscUtil.getWalker({keyBlocklist: new Set(["type", "data"])}).walk;
		this._sourcePrimitiveHandlers = {
			string: (obj, lastKey) => {
				if (lastKey === "source") this._sourceFilter.addItem(obj);
				return obj;
			},
		};
		// endregion
	}

	get optionsFilter () { return this._optionsFilter; }

	static mutateForFilters (cls) {
		cls.source = cls.source || SRC_PHB;
		cls.subclasses = cls.subclasses || [];

		cls._fSources = SourceFilter.getCompleteFilterSources(cls);

		cls._fSourceSubclass = [
			...new Set([
				cls.source,
				...cls.subclasses.map(it => [it.source, ...(it.otherSources || []).map(it => it.source)]).flat(),
			]),
		];

		cls._fMisc = [];
		if (cls.isReprinted) cls._fMisc.push("Reprinted");
		if (cls.srd) cls._fMisc.push("SRD");
		if (cls.basicRules) cls._fMisc.push("Basic Rules");
		if (cls.isSidekick) cls._fMisc.push("Sidekick");

		cls.subclasses.forEach(sc => {
			sc.source = sc.source || cls.source; // default subclasses to same source as parent
			sc.shortName = sc.shortName || sc.name; // ensure shortName

			sc._fMisc = [];
			if (sc.srd) sc._fMisc.push("SRD");
			if (sc.basicRules) sc._fMisc.push("Basic Rules");
			if (sc.isReprinted) sc._fMisc.push("Reprinted");
		});
	}

	_addEntrySourcesToFilter (entry) { this._sourceWalker(entry, this._sourcePrimitiveHandlers); }

	/**
	 * @param cls
	 * @param isExcluded
	 * @param opts Options object.
	 * @param [opts.subclassExclusions] Map of `source:name:bool` indicating if each subclass is excluded or not.
	 */
	addToFilters (cls, isExcluded, opts) {
		if (isExcluded) return;
		opts = opts || {};
		const subclassExclusions = opts.subclassExclusions || {};

		this._sourceFilter.addItem(cls.source);

		if (cls.fluff) cls.fluff.forEach(it => this._addEntrySourcesToFilter(it));
		cls.classFeatures.forEach(lvlFeatures => lvlFeatures.forEach(feature => this._addEntrySourcesToFilter(feature)));

		cls.subclasses.forEach(sc => {
			const isScExcluded = (subclassExclusions[sc.source] || {})[sc.name] || false;
			if (!isScExcluded) {
				this._sourceFilter.addItem(sc.source);
				sc.subclassFeatures.forEach(lvlFeatures => lvlFeatures.forEach(feature => this._addEntrySourcesToFilter(feature)));
			}
		});
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._miscFilter,
			this._optionsFilter,
		];
		opts.isCompact = true;
	}

	isClassNaturallyDisplayed (values, cls) {
		return this._filterBox.toDisplay(
			values,
			...this.constructor._getIsClassNaturallyDisplayedToDisplayParams(cls),
		);
	}

	static _getIsClassNaturallyDisplayedToDisplayParams (cls) { return [cls._fSources, cls._fMisc]; }

	isAnySubclassDisplayed (values, cls) {
		return values[this._optionsFilter.header].isDisplayClassIfSubclassActive && (cls.subclasses || [])
			.some(sc => {
				if (this._filterBox.toDisplay(
					values,
					...this.constructor._getIsSubclassDisplayedToDisplayParams(cls, sc),
				)) return true;

				return sc.otherSources?.length && sc.otherSources.some(src => this._filterBox.toDisplay(
					values,
					...this.constructor._getIsSubclassDisplayedToDisplayParams(cls, sc, src),
				));
			});
	}

	static _getIsSubclassDisplayedToDisplayParams (cls, sc, otherSourcesSource) {
		return [
			otherSourcesSource || sc.source,
			sc._fMisc,
			null,
		];
	}

	isSubclassVisible (f, cls, sc) {
		if (this.filterBox.toDisplay(
			f,
			...this.constructor._getIsSubclassVisibleToDisplayParams(cls, sc),
		)) return true;

		if (!sc.otherSources?.length) return false;

		return sc.otherSources.some(src => this.filterBox.toDisplay(
			f,
			...this.constructor._getIsSubclassVisibleToDisplayParams(cls, sc, src.source),
		));
	}

	static _getIsSubclassVisibleToDisplayParams (cls, sc, otherSourcesSource) {
		return [
			otherSourcesSource || sc.source,
			sc._fMisc,
			null,
		];
	}

	/** Return the first active source we find; use this as a fake source for things we want to force-display. */
	getActiveSource (values) {
		const sourceFilterValues = values[this._sourceFilter.header];
		if (!sourceFilterValues) return null;
		return Object.keys(sourceFilterValues).find(it => this._sourceFilter.toDisplay(values, it));
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			...this._getToDisplayParams(values, it),
		);
	}

	_getToDisplayParams (values, cls) {
		return [
			this.isAnySubclassDisplayed(values, cls)
				? cls._fSourceSubclass
				: (cls._fSources ?? cls.source),
			cls._fMisc,
			null,
		];
	}
}

class PageFilterClasses extends PageFilterClassesBase {
	static _getClassSubclassLevelArray (it) {
		return it.classFeatures.map((_, i) => i + 1);
	}

	constructor () {
		super();

		this._levelFilter = new RangeFilter({
			header: "Feature Level",
			min: 1,
			max: 20,
		});
	}

	get levelFilter () { return this._levelFilter; }

	static mutateForFilters (cls) {
		super.mutateForFilters(cls);

		cls._fLevelRange = this._getClassSubclassLevelArray(cls);
	}

	/**
	 * @param cls
	 * @param isExcluded
	 * @param opts Options object.
	 * @param [opts.subclassExclusions] Map of `source:name:bool` indicating if each subclass is excluded or not.
	 */
	addToFilters (cls, isExcluded, opts) {
		super.addToFilters(cls, isExcluded, opts);

		if (isExcluded) return;

		this._levelFilter.addItem(cls._fLevelRange);
	}

	async _pPopulateBoxOptions (opts) {
		await super._pPopulateBoxOptions(opts);

		opts.filters = [
			this._sourceFilter,
			this._miscFilter,
			this._levelFilter,
			this._optionsFilter,
		];
	}

	static _getIsClassNaturallyDisplayedToDisplayParams (cls) {
		return [cls._fSources, cls._fMisc, cls._fLevelRange];
	}

	static _getIsSubclassDisplayedToDisplayParams (cls, sc, otherSourcesSource) {
		return [otherSourcesSource || sc.source, sc._fMisc, cls._fLevelRange];
	}

	static _getIsSubclassVisibleToDisplayParams (cls, sc, otherSourcesSource) {
		return [otherSourcesSource || sc.source, sc._fMisc, cls._fLevelRange, null];
	}

	_getToDisplayParams (values, cls) {
		return [
			this.isAnySubclassDisplayed(values, cls)
				? cls._fSourceSubclass
				: (cls._fSources ?? cls.source),
			cls._fMisc,
			cls._fLevelRange,
		];
	}
}

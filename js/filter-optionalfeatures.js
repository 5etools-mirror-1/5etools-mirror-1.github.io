"use strict";

class PageFilterOptionalFeatures extends PageFilter {
	// region static
	static _filterFeatureTypeSort (a, b) {
		return SortUtil.ascSort(Parser.optFeatureTypeToFull(a.item), Parser.optFeatureTypeToFull(b.item));
	}

	static sortOptionalFeatures (itemA, itemB, options) {
		if (options.sortBy === "level") {
			const aValue = Number(itemA.values.level) || 0;
			const bValue = Number(itemB.values.level) || 0;
			return SortUtil.ascSort(aValue, bValue) || SortUtil.listSort(itemA, itemB, options);
		}
		return SortUtil.listSort(itemA, itemB, options);
	}
	// endregion

	constructor () {
		super();

		this._typeFilter = new Filter({
			header: "Feature Type",
			items: [],
			displayFn: Parser.optFeatureTypeToFull,
			itemSortFn: PageFilterOptionalFeatures._filterFeatureTypeSort,
		});
		this._pactFilter = new Filter({
			header: "Pact Boon",
			items: [],
			displayFn: Parser.prereqPactToFull,
		});
		this._patronFilter = new Filter({
			header: "Otherworldly Patron",
			items: [],
			displayFn: Parser.prereqPatronToShort,
		});
		this._spellFilter = new Filter({
			header: "Spell",
			items: [],
			displayFn: StrUtil.toTitleCase,
		});
		this._featureFilter = new Filter({
			header: "Feature",
			displayFn: StrUtil.toTitleCase,
		});
		this._levelFilter = new Filter({
			header: "Level",
			itemSortFn: SortUtil.ascSortNumericalSuffix,
			nests: [],
		});
		this._prerequisiteFilter = new MultiFilter({
			header: "Prerequisite",
			filters: [
				this._pactFilter,
				this._patronFilter,
				this._spellFilter,
				this._levelFilter,
				this._featureFilter,
			],
		});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD", "Grants Additional Spells"], isMiscFilter: true});
	}

	static mutateForFilters (it) {
		// (Convert legacy string format to array)
		it.featureType = it.featureType && it.featureType instanceof Array ? it.featureType : it.featureType ? [it.featureType] : ["OTH"];
		if (it.prerequisite) {
			it._sPrereq = true;
			it._fPrereqPact = it.prerequisite.filter(it => it.pact).map(it => it.pact);
			it._fPrereqPatron = it.prerequisite.filter(it => it.patron).map(it => it.patron);
			it._fprereqSpell = it.prerequisite.filter(it => it.spell).map(it => {
				return (it.spell || []).map(it => it.split("#")[0].split("|")[0]);
			});
			it._fprereqFeature = it.prerequisite.filter(it => it.feature).map(it => it.feature);
			it._fPrereqLevel = it.prerequisite.filter(it => it.level).map(it => {
				const lvlMeta = it.level;

				let item;
				let className;
				if (typeof lvlMeta === "number") {
					className = `(No Class)`;
					item = new FilterItem({
						item: `Level ${lvlMeta}`,
						nest: className,
					});
				} else {
					className = lvlMeta.class ? lvlMeta.class.name : `(No Class)`;
					item = new FilterItem({
						item: `${lvlMeta.class ? className : ""}${lvlMeta.subclass ? ` (${lvlMeta.subclass.name})` : ""} Level ${lvlMeta.level}`,
						nest: className,
					});
				}

				return item;
			});
		}

		it._dFeatureType = it.featureType.map(ft => Parser.optFeatureTypeToFull(ft));
		it._lFeatureType = it.featureType.join(", ");
		it.featureType.sort((a, b) => SortUtil.ascSortLower(Parser.optFeatureTypeToFull(a), Parser.optFeatureTypeToFull(b)));

		it._fMisc = it.srd ? ["SRD"] : [];
		if (it.additionalSpells) it._fMisc.push("Grants Additional Spells");
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._typeFilter.addItem(it.featureType);
		this._pactFilter.addItem(it._fPrereqPact);
		this._patronFilter.addItem(it._fPrereqPatron);
		this._spellFilter.addItem(it._fprereqSpell);
		this._featureFilter.addItem(it._fprereqFeature);

		(it._fPrereqLevel || []).forEach(it => {
			this._levelFilter.addNest(it.nest, {isHidden: true});
			this._levelFilter.addItem(it);
		});
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._prerequisiteFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.featureType,
			[
				it._fPrereqPact,
				it._fPrereqPatron,
				it._fprereqSpell,
				it._fPrereqLevel,
				it._fprereqFeature,
			],
			it._fMisc,
		);
	}
}

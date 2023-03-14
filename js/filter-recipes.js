"use strict";

class PageFilterRecipes extends PageFilter {
	static _DIET_TO_FULL = {
		"V": "Vegan",
		"C": "Vegetarian",
		"X": "Omni",
	};
	static _MISC_TAG_TO_FULL = {
		"alcohol": "Contains Alcohol",
	};

	constructor () {
		super();

		this._typeFilter = new Filter({
			header: "Type",
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._dishTypeFilter = new Filter({
			header: "Dish Type",
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._servesFilter = new RangeFilter({header: "Serves", min: 1, max: 1});
		this._dietFilter = new Filter({
			header: "Diet",
			displayFn: PageFilterRecipes._dietToFull,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._allergensFilter = new Filter({
			header: "Allergens",
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._miscFilter = new Filter({
			header: "Miscellaneous",
			items: ["SRD"],
			isMiscFilter: true,
			displayFn: PageFilterRecipes._miscTagToFull,
		});
	}

	static mutateForFilters (it) {
		it._fMisc = it.srd ? ["SRD"] : [];
		if (it.miscTags) it._fMisc.push(...it.miscTags);
		it._fServes = (it.serves?.min != null && it.serves?.max != null) ? [it.serves.min, it.serves.max] : (it.serves?.exact ?? null);
		it._fDiet = it.diet ? PageFilterRecipes._DIET_TO_FULL[it.diet] || it.diet : null;
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._typeFilter.addItem(it.type);
		this._dishTypeFilter.addItem(it.dishTypes);
		this._servesFilter.addItem(it._fServes);
		this._dietFilter.addItem(it._fDiet);
		this._allergensFilter.addItem(it.allergenGroups);
		this._miscFilter.addItem(it._fMisc);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._dishTypeFilter,
			this._servesFilter,
			this._dietFilter,
			this._allergensFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.type,
			it.dishTypes,
			it._fServes,
			it._fDiet,
			it.allergenGroups,
			it._fMisc,
		);
	}

	static _dietToFull (diet) { return PageFilterRecipes._DIET_TO_FULL[diet] || diet; }
	static _miscTagToFull (tag) { return PageFilterRecipes._MISC_TAG_TO_FULL[tag] || tag; }
}

globalThis.PageFilterRecipes = PageFilterRecipes;

class ListSyntaxRecipes extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"ingredients",
		"instructions",
	];
}

globalThis.ListSyntaxRecipes = ListSyntaxRecipes;

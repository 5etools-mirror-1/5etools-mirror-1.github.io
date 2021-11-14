"use strict";

class PageFilterCultsBoons extends PageFilter {
	constructor () {
		super();

		this._sourceFilter = new SourceFilter();
		this._typeFilter = new Filter({
			header: "Type",
			items: ["Boon, Demonic", "Cult"],
		});
		this._subtypeFilter = new Filter({
			header: "Subtype",
			items: [],
		});
	}

	static mutateForFilters (it) {
		it._fType = it.__prop === "cult" ? "Cult" : it.type ? `Boon, ${it.type}` : "Boon";
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._typeFilter.addItem(it._fType);
		this._subtypeFilter.addItem(it.type);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._subtypeFilter,
		];
	}

	toDisplay (values, cb) {
		return this._filterBox.toDisplay(
			values,
			cb.source,
			cb._fType,
			cb.type,
		);
	}
}

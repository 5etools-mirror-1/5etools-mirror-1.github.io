"use strict";

class PageFilterTables extends PageFilter {
	// region static
	static _sourceSelFn (val) {
		return !SourceUtil.isNonstandardSource(val) && !SourceUtil.isAdventure(val);
	}
	// endregion

	constructor () {
		super();

		this._sourceFilter = new SourceFilter({
			selFn: PageFilterTables._sourceSelFn,
		});
	}

	static mutateForFilters (it) { /* no-op */ }

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
		);
	}
}

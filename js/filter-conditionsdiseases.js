"use strict";

class PageFilterConditionsDiseases extends PageFilter {
	// region static
	static getDisplayProp (prop) {
		return prop === "status" ? "Other" : prop.uppercaseFirst();
	}
	// endregion

	constructor () {
		super();

		this._sourceFilter = new SourceFilter();
		this._typeFilter = new Filter({
			header: "Type",
			items: ["condition", "disease", "status"],
			displayFn: PageFilterConditionsDiseases.getDisplayProp,
			deselFn: (it) => it === "disease" || it === "status",
		});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD", "Basic Rules", "Has Images", "Has Info"], isMiscFilter: true});
	}

	static mutateForFilters (it) {
		it._fMisc = [];
		if (it.srd) it._fMisc.push("SRD");
		if (it.basicRules) it._fMisc.push("Basic Rules");
		if (it.hasFluff) it._fMisc.push("Has Info");
		if (it.hasFluffImages) it._fMisc.push("Has Images");
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.__prop,
			it._fMisc,
		);
	}
}

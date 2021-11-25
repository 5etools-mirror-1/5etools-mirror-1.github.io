"use strict";

class PageFilterLanguages extends PageFilter {
	constructor () {
		super();

		this._sourceFilter = new SourceFilter();
		this._typeFilter = new Filter({header: "Type", items: ["standard", "exotic", "secret"], itemSortFn: null, displayFn: StrUtil.uppercaseFirst});
		this._scriptFilter = new Filter({header: "Script", displayFn: StrUtil.uppercaseFirst});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["Has Fonts", "SRD", "Basic Rules", "Has Images", "Has Info"], isMiscFilter: true});
	}

	static mutateForFilters (it) {
		it._fMisc = [];
		if (it.fonts || it._fonts) it._fMisc.push("Has Fonts");
		if (it.srd) it._fMisc.push("SRD");
		if (it.basicRules) it._fMisc.push("Basic Rules");
		if (it.hasFluff) it._fMisc.push("Has Info");
		if (it.hasFluffImages) it._fMisc.push("Has Images");
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._scriptFilter.addItem(it.script);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._scriptFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.type,
			it.script,
			it._fMisc,
		);
	}
}

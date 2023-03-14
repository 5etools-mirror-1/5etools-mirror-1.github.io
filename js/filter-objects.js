"use strict";

class PageFilterObjects extends PageFilter {
	constructor () {
		super();

		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD", "Has Images", "Has Info", "Has Token"], isMiscFilter: true});
	}

	static mutateForFilters (obj) {
		obj._fMisc = obj.srd ? ["SRD"] : [];
		if (obj.tokenUrl || obj.hasToken) obj._fMisc.push("Has Token");
		if (obj.hasFluff || obj.fluff?.entries) obj._fMisc.push("Has Info");
		if (obj.hasFluffImages || obj.fluff?.images) obj._fMisc.push("Has Images");
	}

	addToFilters (obj, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(obj.source);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, obj) {
		return this._filterBox.toDisplay(
			values,
			obj.source,
			obj._fMisc,
		);
	}
}

globalThis.PageFilterObjects = PageFilterObjects;

class ListSyntaxObjects extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"entries",
		"actionEntries",
	];
}

globalThis.ListSyntaxObjects = ListSyntaxObjects;

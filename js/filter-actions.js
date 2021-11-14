"use strict";

class PageFilterActions extends PageFilter {
	static getTimeText (time) {
		return typeof time === "string" ? time : Parser.getTimeToFull(time);
	}

	constructor () {
		super();

		this._sourceFilter = new SourceFilter();
		this._timeFilter = new Filter({
			header: "Type",
			displayFn: StrUtil.uppercaseFirst,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["Optional/Variant Action", "SRD"], isSrdFilter: true});
	}

	static mutateForFilters (it) {
		it._fTime = it.time ? it.time.map(it => it.unit || it) : null;
		it._fMisc = it.srd ? ["SRD"] : [];
		if (it.fromVariant) it._fMisc.push("Optional/Variant Action");
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._timeFilter.addItem(it._fTime);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._timeFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it._fTime,
			it._fMisc,
		);
	}
}

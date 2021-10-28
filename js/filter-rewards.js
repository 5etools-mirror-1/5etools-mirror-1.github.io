"use strict";

class PageFilterRewards extends PageFilter {
	constructor () {
		super();

		this._sourceFilter = new SourceFilter();
		this._typeFilter = new Filter({
			header: "Type",
			items: [
				"Blessing",
				"Boon",
				"Charm",
			],
		});
		this._rarityFilter = new Filter({
			header: "Rarity",
			items: ["unknown", ...Parser.RARITIES],
			itemSortFn: null,
			displayFn: StrUtil.toTitleCase,
		});
	}

	static mutateForFilters (it) {
		it._fRarity = it.rarity || "unknown";
	}

	addToFilters (reward, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(reward.source);
		this._typeFilter.addItem(reward.type);
		this._rarityFilter.addItem(reward._fRarity);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._rarityFilter,
		];
	}

	toDisplay (values, r) {
		return this._filterBox.toDisplay(
			values,
			r.source,
			r.type,
			r._fRarity,
		)
	}
}

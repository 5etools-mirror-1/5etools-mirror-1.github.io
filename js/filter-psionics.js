"use strict";

class PageFilterPsionics extends PageFilter {
	// region static
	static _sortFilterTypes (a, b) {
		a = a.item; b = b.item;
		a = Parser.psiTypeToMeta(a);
		b = Parser.psiTypeToMeta(b);
		return (Number(a.hasOrder) - Number(b.hasOrder)) || SortUtil.ascSortLower(a.full, b.full);
	}
	// endregion

	constructor () {
		super({sourceFilterOpts: {deselFn: () => false}});

		this._typeFilter = new Filter({header: "Type", items: [Parser.PSI_ABV_TYPE_TALENT, Parser.PSI_ABV_TYPE_DISCIPLINE], displayFn: Parser.psiTypeToFull, itemSortFn: PageFilterPsionics._sortFilterTypes});
		this._orderFilter = new Filter({
			header: "Order",
			items: [Parser.PSI_ORDER_NONE],
		});
	}

	static mutateForFilters (p) {
		p._fOrder = Parser.psiOrderToFull(p.order);
	}

	addToFilters (p, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(p.source);
		this._typeFilter.addItem(p.type);
		this._orderFilter.addItem(p._fOrder);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._typeFilter,
			this._orderFilter,
		];
	}

	toDisplay (values, p) {
		return this._filterBox.toDisplay(
			values,
			p.source,
			p.type,
			p._fOrder,
		);
	}
}

globalThis.PageFilterPsionics = PageFilterPsionics;

class ListSyntaxPsionics extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"entries",
		"modes",
		"focus",
	];
}

globalThis.ListSyntaxPsionics = ListSyntaxPsionics;

"use strict";

class ItemsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subitems",
			sublistListOptions: {
				fnSort: PageFilterItems.sortItems,
			},
			isSublistItemsCountable: true,
		});

		this._sublistCurrencyConversion = null;
		this._sublistCurrencyDisplayMode = null;

		this._$totalWeight = null;
		this._$totalValue = null;
		this._$totalItems = null;
	}

	async pCreateSublist () {
		[this._sublistCurrencyConversion, this._sublistCurrencyDisplayMode] = await Promise.all([
			StorageUtil.pGetForPage("sublistCurrencyConversion"),
			StorageUtil.pGetForPage("sublistCurrencyDisplayMode"),
		]);

		return super.pCreateSublist();
	}

	pGetSublistItem (item, hash, {count = 1} = {}) {
		const $dispCount = $(`<span class="text-center col-2 pr-0">${count}</span>`);
		const $ele = $$`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-6 pl-0">${item.name}</span>
				<span class="text-center col-2">${Parser.itemWeightToFull(item, true) || "\u2014"}</span>
				<span class="text-center col-2">${item.value || item.valueMult ? Parser.itemValueToFullMultiCurrency(item, {isShortForm: true}).replace(/ +/g, "\u00A0") : "\u2014"}</span>
				${$dispCount}
			</a>
		</div>`
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			item.name,
			{
				hash,
				source: Parser.sourceJsonToAbv(item.source),
				weight: Parser.weightValueToNumber(item.weight),
				cost: item.value || 0,
			},
			{
				count,
				$elesCount: [$dispCount],
				entity: item,
			},
		);
		return listItem;
	}

	_onSublistChange () {
		this._$totalWeight = this._$totalWeight || $(`#totalweight`);
		this._$totalValue = this._$totalValue || $(`#totalvalue`);
		this._$totalItems = this._$totalItems || $(`#totalitems`);

		let weight = 0;
		let value = 0;
		let cntItems = 0;

		const availConversions = new Set();
		this._listSub.items.forEach(it => {
			const {data: {entity: item}} = it;
			if (item.currencyConversion) availConversions.add(item.currencyConversion);
			const count = it.data.count;
			cntItems += it.data.count;
			if (item.weight) weight += Number(item.weight) * count;
			if (item.value) value += item.value * count;
		});

		this._$totalWeight.text(Parser.itemWeightToFull({weight}, true));
		this._$totalItems.text(cntItems);

		if (availConversions.size) {
			this._$totalValue
				.text(Parser.itemValueToFullMultiCurrency({value, currencyConversion: this._sublistCurrencyConversion}))
				.off("click")
				.click(async () => {
					const values = ["(Default)", ...[...availConversions].sort(SortUtil.ascSortLower)];
					const defaultSel = values.indexOf(this._sublistCurrencyConversion);
					const userSel = await InputUiUtil.pGetUserEnum({
						values,
						isResolveItem: true,
						default: ~defaultSel ? defaultSel : 0,
						title: "Select Currency Conversion Table",
						fnDisplay: it => it === null ? values[0] : it,
					});
					if (userSel == null) return;
					this._sublistCurrencyConversion = userSel === values[0] ? null : userSel;
					await StorageUtil.pSetForPage("sublistCurrencyConversion", this._sublistCurrencyConversion);
					this._onSublistChange();
				});
			return;
		}

		this._$totalValue
			.text(this._getTotalValueText({value}) || "\u2014")
			.off("click")
			.click(async () => {
				const defaultSel = this.constructor._TOTAL_VALUE_MODES.indexOf(this._sublistCurrencyDisplayMode);
				const userSel = await InputUiUtil.pGetUserEnum({
					values: this.constructor._TOTAL_VALUE_MODES,
					isResolveItem: true,
					default: ~defaultSel ? defaultSel : 0,
					title: "Select Display Mode",
					fnDisplay: it => it === null ? this.constructor._TOTAL_VALUE_MODES[0] : it,
				});
				if (userSel == null) return;
				this._sublistCurrencyDisplayMode = userSel === this.constructor._TOTAL_VALUE_MODES[0] ? null : userSel;
				await StorageUtil.pSetForPage("sublistCurrencyDisplayMode", this._sublistCurrencyDisplayMode);
				this._onSublistChange();
			});
	}

	static _TOTAL_VALUE_MODE_EXACT_COINAGE = "Exact Coinage";
	static _TOTAL_VALUE_MODE_LOWEST_COMMON = "Lowest Common Currency";
	static _TOTAL_VALUE_MODE_GOLD = "Gold";
	static _TOTAL_VALUE_MODES = [
		this._TOTAL_VALUE_MODE_EXACT_COINAGE,
		this._TOTAL_VALUE_MODE_LOWEST_COMMON,
		this._TOTAL_VALUE_MODE_GOLD,
	];
	_getTotalValueText ({value}) {
		switch (this._sublistCurrencyDisplayMode) {
			case this.constructor._TOTAL_VALUE_MODE_LOWEST_COMMON: return Parser.itemValueToFull({value});

			case this.constructor._TOTAL_VALUE_MODE_GOLD: {
				return value ? `${Number((Parser.DEFAULT_CURRENCY_CONVERSION_TABLE.find(it => it.coin === "gp").mult * value).toFixed(2))} gp` : "";
			}

			default: {
				const CURRENCIES = ["gp", "sp", "cp"];
				const coins = {cp: value};
				CurrencyUtil.doSimplifyCoins(coins);
				return CURRENCIES.filter(it => coins[it]).map(it => `${coins[it].toLocaleString(undefined, {maximumFractionDigits: 5})} ${it}`).join(", ");
			}
		}
	}
}

class ItemsPage extends ListPage {
	constructor () {
		const pFnGetFluff = Renderer.item.pGetFluff.bind(Renderer.item);

		super({
			dataSource: DataUtil.item.loadJSON.bind(DataUtil.item),
			prereleaseDataSource: DataUtil.item.loadPrerelease.bind(DataUtil.item),
			brewDataSource: DataUtil.item.loadBrew.bind(DataUtil.item),

			pFnGetFluff,

			pageFilter: new PageFilterItems(),

			dataProps: ["item"],

			bookViewOptions: {
				$btnOpen: $(`#btn-book`),
				$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple items, please first make a list</span>`),
				pageTitle: "Items Book View",
				fnGetMd: it => RendererMarkdown.get().render({entries: [{type: "statblockInline", dataType: "item", data: it}]}),
			},

			tableViewOptions: {
				title: "Items",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					rarity: {name: "Rarity"},
					_type: {name: "Type", transform: it => [it._typeHtml || "", it._subTypeHtml || ""].filter(Boolean).join(", ")},
					_attunement: {name: "Attunement", transform: it => it._attunement ? it._attunement.slice(1, it._attunement.length - 1) : ""},
					_properties: {name: "Properties", transform: it => Renderer.item.getDamageAndPropertiesText(it).filter(Boolean).join(", ")},
					_weight: {name: "Weight", transform: it => Parser.itemWeightToFull(it)},
					_value: {name: "Value", transform: it => Parser.itemValueToFullMultiCurrency(it)},
					_entries: {name: "Text", transform: (it) => Renderer.item.getRenderedEntries(it, {isCompact: true}), flex: 3},
				},
			},

			isMarkdownPopout: true,
			propEntryData: "item",

			listSyntax: new ListSyntaxItems({fnGetDataList: () => this._dataList, pFnGetFluff}),
		});

		this._mundaneList = null;
		this._magicList = null;
	}

	get _bindOtherButtonsOptions () {
		return {
			other: [
				this._bindOtherButtonsOptions_openAsSinglePage({slugPage: "items", fnGetHash: () => Hist.getHashParts()[0]}),
			].filter(Boolean),
		};
	}

	get primaryLists () { return [this._mundaneList, this._magicList]; }

	getListItem (item, itI, isExcluded) {
		const hash = UrlUtil.autoEncodeHash(item);

		if (Renderer.item.isExcluded(item, {hash})) return null;
		if (item.noDisplay) return null;
		Renderer.item.enhanceItem(item);

		this._pageFilter.mutateAndAddToFilters(item, isExcluded);

		const source = Parser.sourceJsonToAbv(item.source);
		const type = item._typeListText.join(", ").toTitleCase();

		if (item._fIsMundane) {
			const eleLi = e_({
				tag: "div",
				clazz: `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`,
				click: (evt) => this._mundaneList.doSelect(listItem, evt),
				contextmenu: (evt) => this._openContextMenu(evt, this._mundaneList, listItem),
				children: [
					e_({
						tag: "a",
						href: `#${hash}`,
						clazz: "lst--border lst__row-inner",
						children: [
							e_({tag: "span", clazz: `col-3-5 pl-0 bold`, text: item.name}),
							e_({tag: "span", clazz: `col-4-5`, text: type}),
							e_({tag: "span", clazz: `col-1-5 text-center`, text: `${item.value || item.valueMult ? Parser.itemValueToFullMultiCurrency(item, {isShortForm: true}).replace(/ +/g, "\u00A0") : "\u2014"}`}),
							e_({tag: "span", clazz: `col-1-5 text-center`, text: Parser.itemWeightToFull(item, true) || "\u2014"}),
							e_({
								tag: "span",
								clazz: `col-1 text-center ${Parser.sourceJsonToColor(item.source)} pr-0`,
								style: Parser.sourceJsonToStylePart(item.source),
								title: `${Parser.sourceJsonToFull(item.source)}${Renderer.utils.getSourceSubText(item)}`,
								text: source,
							}),
						],
					}),
				],
			});

			const listItem = new ListItem(
				itI,
				eleLi,
				item.name,
				{
					hash,
					source,
					type,
					cost: item.value || 0,
					weight: Parser.weightValueToNumber(item.weight),
				},
				{
					isExcluded,
				},
			);

			return {mundane: listItem};
		} else {
			const eleLi = e_({
				tag: "div",
				clazz: `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`,
				click: (evt) => this._magicList.doSelect(listItem, evt),
				contextmenu: (evt) => this._openContextMenu(evt, this._magicList, listItem),
				children: [
					e_({
						tag: "a",
						href: `#${hash}`,
						clazz: "lst--border lst__row-inner",
						children: [
							e_({tag: "span", clazz: `col-3-5 pl-0 bold`, text: item.name}),
							e_({tag: "span", clazz: `col-4`, text: type}),
							e_({tag: "span", clazz: `col-1-5 text-center`, text: Parser.itemWeightToFull(item, true) || "\u2014"}),
							e_({tag: "span", clazz: `col-0-6 text-center`, text: item._attunementCategory !== VeCt.STR_NO_ATTUNEMENT ? "×" : ""}),
							e_({tag: "span", clazz: `col-1-4 text-center`, text: (item.rarity || "").toTitleCase()}),
							e_({
								tag: "span",
								clazz: `col-1 text-center ${Parser.sourceJsonToColor(item.source)} pr-0`,
								style: Parser.sourceJsonToStylePart(item.source),
								title: `${Parser.sourceJsonToFull(item.source)}${Renderer.utils.getSourceSubText(item)}`,
								text: source,
							}),
						],
					}),
				],
			});

			const listItem = new ListItem(
				itI,
				eleLi,
				item.name,
				{
					source,
					hash,
					type,
					rarity: item.rarity,
					attunement: item._attunementCategory !== VeCt.STR_NO_ATTUNEMENT,
					weight: Parser.weightValueToNumber(item.weight),
				},
			);

			return {magic: listItem};
		}
	}

	handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		const listFilter = li => this._pageFilter.toDisplay(f, this._dataList[li.ix]);
		this._mundaneList.filter(listFilter);
		this._magicList.filter(listFilter);
		FilterBox.selectFirstVisible(this._dataList);
	}

	_tabTitleStats = "Item";

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderItems.$getRenderedItem(ent));
	}

	async pDoLoadSubHash (sub) {
		sub = await super.pDoLoadSubHash(sub);
		await this._bookView.pHandleSub(sub);
	}

	async _pOnLoad_pInitPrimaryLists () {
		const $iptSearch = $("#lst__search");
		const $btnReset = $("#reset");
		const $btnClear = $(`#lst__search-glass`);
		this._mundaneList = this._initList({
			$iptSearch,
			$btnReset,
			$btnClear,
			dispPageTagline: document.getElementById(`page__subtitle`),
			$wrpList: $(`.list.mundane`),
			syntax: this._listSyntax.build(),
			isBindFindHotkey: true,
			optsList: {
				fnSort: PageFilterItems.sortItems,
			},
		});
		this._magicList = this._initList({
			$iptSearch,
			$btnReset,
			$btnClear,
			$wrpList: $(`.list.magic`),
			syntax: this._listSyntax.build(),
			optsList: {
				fnSort: PageFilterItems.sortItems,
			},
		});

		SortUtil.initBtnSortHandlers($("#filtertools-mundane"), this._mundaneList);
		SortUtil.initBtnSortHandlers($("#filtertools-magic"), this._magicList);

		this._mundaneList.nextList = this._magicList;
		this._magicList.prevList = this._mundaneList;

		this._filterBox = await this._pageFilter.pInitFilterBox({
			$iptSearch,
			$wrpFormTop: $(`#filter-search-group`),
			$btnReset,
		});
	}

	_pOnLoad_initVisibleItemsDisplay () {
		const $elesMundaneAndMagic = $(`.ele-mundane-and-magic`);
		$(`.side-label--mundane`).click(() => {
			const filterValues = this._pageFilter.filterBox.getValues();
			const curValue = MiscUtil.get(filterValues, "Miscellaneous", "Mundane");
			this._pageFilter.filterBox.setFromValues({
				Miscellaneous: {
					...(filterValues?.Miscellaneous || {}),
					Mundane: curValue === 1 ? 0 : 1,
				},
			});
		});
		$(`.side-label--magic`).click(() => {
			const filterValues = this._pageFilter.filterBox.getValues();
			const curValue = MiscUtil.get(filterValues, "Miscellaneous", "Magic");
			this._pageFilter.filterBox.setFromValues({
				Miscellaneous: {
					...(filterValues?.Miscellaneous || {}),
					Magic: curValue === 1 ? 0 : 1,
				},
			});
		});
		const $outVisibleResults = $(`.lst__wrp-search-visible`);
		const $wrpListMundane = $(`.itm__wrp-list--mundane`);
		const $wrpListMagic = $(`.itm__wrp-list--magic`);
		const $elesMundane = $(`.ele-mundane`);
		const $elesMagic = $(`.ele-magic`);
		this._mundaneList.on("updated", () => {
			// Force-show the mundane list if there are no items on display
			if (this._magicList.visibleItems.length) $elesMundane.toggleVe(!!this._mundaneList.visibleItems.length);
			else $elesMundane.showVe();
			$elesMundaneAndMagic.toggleVe(!!(this._mundaneList.visibleItems.length && this._magicList.visibleItems.length));

			const current = this._mundaneList.visibleItems.length + this._magicList.visibleItems.length;
			const total = this._mundaneList.items.length + this._magicList.items.length;
			$outVisibleResults.html(`${current}/${total}`);

			// Collapse the mundane section if there are no magic items displayed
			$wrpListMundane.toggleClass(`itm__wrp-list--empty`, this._mundaneList.visibleItems.length === 0);
		});
		this._magicList.on("updated", () => {
			$elesMagic.toggleVe(!!this._magicList.visibleItems.length);
			// Force-show the mundane list if there are no items on display
			if (!this._magicList.visibleItems.length) $elesMundane.showVe();
			else $elesMundane.toggleVe(!!this._mundaneList.visibleItems.length);
			$elesMundaneAndMagic.toggleVe(!!(this._mundaneList.visibleItems.length && this._magicList.visibleItems.length));

			const current = this._mundaneList.visibleItems.length + this._magicList.visibleItems.length;
			const total = this._mundaneList.items.length + this._magicList.items.length;
			$outVisibleResults.html(`${current}/${total}`);

			// Collapse the magic section if there are no magic items displayed
			$wrpListMagic.toggleClass(`itm__wrp-list--empty`, this._magicList.visibleItems.length === 0);
		});
	}

	_addData (data) {
		super._addData(data);

		// populate table labels
		$(`h3.ele-mundane span.side-label`).text("Mundane");
		$(`h3.ele-magic span.side-label`).text("Magic");
	}

	_addListItem (listItem) {
		if (listItem.mundane) this._mundaneList.addItem(listItem.mundane);
		if (listItem.magic) this._magicList.addItem(listItem.magic);
	}
}

const itemsPage = new ItemsPage();
itemsPage.sublistManager = new ItemsSublistManager();
window.addEventListener("load", () => itemsPage.pOnLoad());

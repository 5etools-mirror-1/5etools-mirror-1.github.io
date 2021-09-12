"use strict";

class ListPage {
	/**
	 * @param opts Options object.
	 * @param opts.dataSource Main JSON data url or function to fetch main data.
	 * @param [opts.brewDataSource] Function to fetch brew data.
	 * @param [opts.dataSourceFluff] Fluff JSON data url or function to fetch fluff data.
	 * @param [opts.filters] Array of filters to use in the filter box. (Either `filters` and `filterSource` or
	 * `pageFilter` must be specified.)
	 * @param [opts.filterSource] Source filter. (Either `filters` and `filterSource` or
	 * `pageFilter` must be specified.)
	 * @param [opts.pageFilter] PageFilter implementation for this page. (Either `filters` and `filterSource` or
	 * `pageFilter` must be specified.)
	 * @param opts.listClass List class.
	 * @param opts.listOptions Other list options.
	 * @param opts.sublistClass Sublist class.
	 * @param opts.sublistOptions Other sublist options.
	 * @param opts.dataProps JSON data propert(y/ies).
	 * @param [opts.bookViewOptions] Book view options.
	 * @param [opts.tableViewOptions] Table view options.
	 * @param [opts.hasAudio] True if the entities have pronunciation audio.
	 * @param [opts.isPreviewable] True if the entities can be previewed in-line as part of the list.
	 * @param [opts.fnGetPinListData] Function which returns ListUtil data for the current pin/unpin.
	 * @param [opts.bindPopoutButtonOptions]
	 */
	constructor (opts) {
		this._dataSource = opts.dataSource;
		this._brewDataSource = opts.brewDataSource;
		this._dataSourcefluff = opts.dataSourceFluff;
		this._filters = opts.filters;
		this._filterSource = opts.filterSource;
		this._pageFilter = opts.pageFilter;
		this._listClass = opts.listClass;
		this._listOptions = opts.listOptions || {};
		this._sublistClass = opts.sublistClass;
		this._sublistOptions = opts.sublistOptions || {};
		this._dataProps = opts.dataProps;
		this._bookViewOptions = opts.bookViewOptions;
		this._tableViewOptions = opts.tableViewOptions;
		this._hasAudio = opts.hasAudio;
		this._isPreviewable = opts.isPreviewable;
		this._fnGetPinListData = opts.fnGetPinListData;
		this._bindPopoutButtonOptions = opts.bindPopoutButtonOptions;

		this._renderer = Renderer.get();
		this._list = null;
		this._listSub = null;
		this._filterBox = null;
		this._dataList = [];
		this._ixData = 0;
		this._bookView = null;
		this._$pgContent = null;
	}

	async pOnLoad () {
		this._$pgContent = $(`#pagecontent`);

		await ExcludeUtil.pInitialise();
		const data = typeof this._dataSource === "string" ? await DataUtil.loadJSON(this._dataSource) : await this._dataSource();

		this._list = ListUtil.initList({
			$wrpList: $(`.list.${this._listClass}`),
			isPreviewable: this._isPreviewable,
			syntax: this._listSyntax,
			isBindFindHotkey: true,
			...this._listOptions,
		});
		ListUtil.setOptions({primaryLists: [this._list]});
		const $wrpBtnsSort = $("#filtertools");
		SortUtil.initBtnSortHandlers($wrpBtnsSort, this._list);
		if (this._isPreviewable) this._doBindPreviewAllButton($wrpBtnsSort.find(`[name="list-toggle-all-previews"]`));

		this._filterBox = await this._pageFilter.pInitFilterBox({
			$iptSearch: $(`#lst__search`),
			$wrpFormTop: $(`#filter-search-group`),
			$btnReset: $(`#reset`),
		});

		const $outVisibleResults = $(`.lst__wrp-search-visible`);
		this._list.on("updated", () => $outVisibleResults.html(`${this._list.visibleItems.length}/${this._list.items.length}`));

		this._filterBox.on(FilterBox.EVNT_VALCHANGE, this.handleFilterChange.bind(this));

		this._listSub = ListUtil.initSublist({
			listClass: this._sublistClass,
			getSublistRow: this.getSublistItem.bind(this),
			...this._sublistOptions,
		});
		ListUtil.initGenericPinnable();
		SortUtil.initBtnSortHandlers($("#sublistsort"), this._listSub);

		this._addData(data);

		BrewUtil.bind({
			filterBox: this._filterBox,
			sourceFilter: this._pageFilter ? this._pageFilter.sourceFilter : this._filterSource,
			list: this._list,
			pHandleBrew: this._pHandleBrew.bind(this),
		});

		const homebrew = await (this._brewDataSource ? this._brewDataSource() : BrewUtil.pAddBrewData());
		await this._pHandleBrew(homebrew);

		BrewUtil.makeBrewButton("manage-brew");
		await ListUtil.pLoadState();
		RollerUtil.addListRollButton();
		ListUtil.addListShowHide();
		if (this._hasAudio) Renderer.utils.bindPronounceButtons();

		if (this._bookViewOptions) {
			this._bookView = new BookModeView({
				hashKey: "bookview",
				$openBtn: this._bookViewOptions.$btnOpen,
				$eleNoneVisible: this._bookViewOptions.$eleNoneVisible,
				pageTitle: this._bookViewOptions.pageTitle || "Book View",
				popTblGetNumShown: this._bookViewOptions.popTblGetNumShown,
				hasPrintColumns: true,
			});
		}

		// bind hash-change functions for hist.js to use
		window.loadHash = this.doLoadHash.bind(this);
		window.loadSubHash = this.pDoLoadSubHash.bind(this);

		this._list.init();
		this._listSub.init();

		Hist.init(true);
		ListPage._checkShowAllExcluded(this._dataList, this._$pgContent);
		window.dispatchEvent(new Event("toolsLoaded"));
	}

	async _pHandleBrew (homebrew) {
		try {
			this._addData(homebrew);
		} catch (e) {
			BrewUtil.pPurgeBrew(e);
		}
	}

	_addData (data) {
		if (!this._dataProps.some(prop => data[prop] && data[prop].length)) return;

		this._dataProps.forEach(prop => {
			if (!data[prop]) return;
			data[prop].forEach(it => it.__prop = prop);
			this._dataList.push(...data[prop]);
		});

		const len = this._dataList.length;
		for (; this._ixData < len; this._ixData++) {
			const it = this._dataList[this._ixData];
			const isExcluded = ExcludeUtil.isExcluded(UrlUtil.autoEncodeHash(it), it.__prop, it.source);
			const listItem = this.getListItem(it, this._ixData, isExcluded);
			if (this._isPreviewable) this._doBindPreview(listItem);
			this._list.addItem(listItem);
		}

		this._list.update();
		this._filterBox.render();
		this.handleFilterChange();

		ListUtil.setOptions({
			itemList: this._dataList,
			primaryLists: [this._list],
		});
		ListUtil.bindPinButton({fnGetData: this._fnGetPinListData});
		const $btnPop = ListUtil.getOrTabRightButton(`btn-popout`, `new-window`);
		Renderer.hover.bindPopoutButton($btnPop, this._dataList, this._bindPopoutButtonOptions);
		UrlUtil.bindLinkExportButton(this._filterBox);
		ListUtil.bindOtherButtons({
			download: true,
			upload: true,
		});

		if (this._tableViewOptions) {
			ListUtil.bindShowTableButton(
				"btn-show-table",
				this._tableViewOptions.title,
				this._dataList,
				this._tableViewOptions.colTransforms,
				this._tableViewOptions.filter,
				this._tableViewOptions.sorter,
			);
		}
	}

	_doBindPreviewAllButton ($btn) {
		$btn
			.click(() => {
				const isExpand = $btn.html() === `[+]`;
				$btn.html(isExpand ? `[\u2012]` : "[+]");

				this._list.visibleItems.forEach(listItem => {
					const {btnToggleExpand, dispExpandedOuter, dispExpandedInner} = this._getPreviewEles(listItem);
					if (isExpand) this._doPreviewExpand({listItem, dispExpandedOuter, btnToggleExpand, dispExpandedInner});
					else this._doPreviewCollapse({dispExpandedOuter, btnToggleExpand, dispExpandedInner});
				});
			})
	}

	/** Requires a "[+]" button as the first list column, and the item to contain a second hidden display element. */
	_doBindPreview (listItem) {
		const {btnToggleExpand, dispExpandedOuter, dispExpandedInner} = this._getPreviewEles(listItem);

		dispExpandedOuter.addEventListener("click", evt => {
			evt.stopPropagation();
		});

		btnToggleExpand.addEventListener("click", evt => {
			evt.stopPropagation();
			evt.preventDefault();

			this._doPreviewToggle({listItem, btnToggleExpand, dispExpandedInner, dispExpandedOuter});
		});
	}

	_getPreviewEles (listItem) {
		const btnToggleExpand = listItem.ele.firstElementChild.firstElementChild;
		const dispExpandedOuter = listItem.ele.lastElementChild;
		const dispExpandedInner = dispExpandedOuter.lastElementChild;

		return {
			btnToggleExpand,
			dispExpandedOuter,
			dispExpandedInner,
		};
	}

	_doPreviewToggle ({listItem, btnToggleExpand, dispExpandedInner, dispExpandedOuter}) {
		const isExpand = btnToggleExpand.innerHTML === `[+]`;
		if (isExpand) this._doPreviewExpand({listItem, dispExpandedOuter, btnToggleExpand, dispExpandedInner});
		else this._doPreviewCollapse({dispExpandedOuter, btnToggleExpand, dispExpandedInner});
	}

	_doPreviewExpand ({listItem, dispExpandedOuter, btnToggleExpand, dispExpandedInner}) {
		dispExpandedOuter.classList.remove("ve-hidden");
		btnToggleExpand.innerHTML = `[\u2012]`;
		Renderer.hover.$getHoverContent_stats(UrlUtil.getCurrentPage(), this._dataList[listItem.ix]).appendTo(dispExpandedInner);
	}

	_doPreviewCollapse ({dispExpandedOuter, btnToggleExpand, dispExpandedInner}) {
		dispExpandedOuter.classList.add("ve-hidden");
		btnToggleExpand.innerHTML = `[+]`;
		dispExpandedInner.innerHTML = "";
	}

	get _listSyntax () {
		return {
			text: {
				help: `"text:<text>" to search within text.`,
				fn: (listItem, searchTerm) => {
					if (listItem.data._textCache == null) listItem.data._textCache = this._getSearchCache(this._dataList[listItem.ix]);
					return listItem.data._textCache && listItem.data._textCache.includes(searchTerm);
				},
			},
		}
	}

	// TODO(Future) the ideal solution to this is to render every entity to plain text (or failing that, Markdown) and
	//   indexing that text with e.g. elasticlunr.
	_getSearchCache (entity) {
		if (!entity.entries) return "";
		const ptrOut = {_: ""};
		this._getSearchCache_handleEntryProp(entity, "entries", ptrOut);
		return ptrOut._;
	}

	_getSearchCache_handleEntryProp (entity, prop, ptrOut) {
		if (!entity[prop]) return;
		ListPage._READONLY_WALKER.walk(
			entity[prop],
			{
				string: (str) => this._getSearchCache_handleString(ptrOut, str),
			},
		);
	}

	_getSearchCache_handleString (ptrOut, str) {
		ptrOut._ += `${Renderer.stripTags(str).toLowerCase()} -- `;
	}

	static _checkShowAllExcluded (list, $pagecontent) {
		if (!ExcludeUtil.isAllContentExcluded(list)) return;

		$pagecontent.html(`<tr><th class="border" colspan="6"></th></tr>
			<tr><td colspan="6">${ExcludeUtil.getAllContentBlacklistedHtml()}</td></tr>
			<tr><th class="border" colspan="6"></th></tr>`);
	}

	getListItem () { throw new Error(`Unimplemented!`); }
	handleFilterChange () { throw new Error(`Unimplemented!`); }
	getSublistItem () { throw new Error(`Unimplemented!`); }
	doLoadHash () { throw new Error(`Unimplemented!`); }
	pDoLoadSubHash () { throw new Error(`Unimplemented!`); }
}
ListPage._READONLY_WALKER = MiscUtil.getWalker({
	keyBlacklist: new Set(["type", "colStyles", "style"]),
	isNoModification: true,
});

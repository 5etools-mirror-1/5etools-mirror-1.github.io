"use strict";

class FilterUtil {}
FilterUtil.SUB_HASH_PREFIX_LENGTH = 4;

class PageFilter {
	static defaultSourceSelFn (val) {
		return !SourceUtil.isNonstandardSource(val);
	}

	constructor (opts) {
		opts = opts || {};
		this._sourceFilter = new SourceFilter(opts.sourceFilterOpts);
		this._filterBox = null;
	}

	get filterBox () { return this._filterBox; }
	get sourceFilter () { return this._sourceFilter; }

	mutateAndAddToFilters (entity, isExcluded, opts) {
		this.constructor.mutateForFilters(entity, opts);
		this.addToFilters(entity, isExcluded, opts);
	}

	static mutateForFilters (entity, opts) { throw new Error("Unimplemented!"); }
	addToFilters (entity, isExcluded, opts) { throw new Error("Unimplemented!"); }
	toDisplay (values, entity) { throw new Error("Unimplemented!"); }
	async _pPopulateBoxOptions () { throw new Error("Unimplemented!"); }

	async pInitFilterBox (opts) {
		opts = opts || {};
		await this._pPopulateBoxOptions(opts);
		this._filterBox = new FilterBox(opts);
		await this._filterBox.pDoLoadState();
		return this._filterBox;
	}

	// region Helpers
	static _getClassFilterItem ({className, classSource, isVariantClass, definedInSource}) {
		const nm = className.split("(")[0].trim();
		const variantSuffix = isVariantClass ? ` [${definedInSource ? Parser.sourceJsonToAbv(definedInSource) : "Unknown"}]` : ""
		const sourceSuffix = (SourceUtil.isNonstandardSource(classSource || SRC_PHB) || BrewUtil.hasSourceJson(classSource || SRC_PHB))
			? ` (${Parser.sourceJsonToAbv(classSource)})` : ""
		const name = `${nm}${variantSuffix}${sourceSuffix}`;

		const opts = {
			item: name,
			userData: {
				group: SourceUtil.getFilterGroup(classSource || SRC_PHB),
			},
		};

		if (isVariantClass) {
			opts.nest = definedInSource ? Parser.sourceJsonToFull(definedInSource) : "Unknown";
			opts.userData.equivalentClassName = `${nm}${sourceSuffix}`
			opts.userData.definedInSource = definedInSource;
		}

		return new FilterItem(opts);
	}

	static _getSubclassFilterItem ({className, classSource, subclassShortName, subclassSource, subSubclassName, isVariantClass, definedInSource}) {
		const group = SourceUtil.isSubclassReprinted(className, classSource, subclassShortName, subclassSource) || Parser.sourceJsonToFull(subclassSource).startsWith(UA_PREFIX) || Parser.sourceJsonToFull(subclassSource).startsWith(PS_PREFIX);

		const classFilterItem = this._getClassFilterItem({
			className: subclassShortName,
			classSource: subclassSource,
		});

		return new FilterItem({
			item: `${className}: ${classFilterItem.item}${subSubclassName ? `, ${subSubclassName}` : ""}`,
			nest: className,
			userData: {
				group,
			},
		});
	}
	// endregion
}

class ModalFilter {
	static _$getFilterColumnHeaders (btnMeta) {
		return btnMeta.map((it, i) => $(`<button class="col-${it.width} ${i === 0 ? "pl-0" : i === btnMeta.length ? "pr-0" : ""} ${it.disabled ? "" : "sort"} btn btn-default btn-xs" ${it.disabled ? "" : `data-sort="${it.sort}"`} ${it.title ? `title="${it.title}"` : ""} ${it.disabled ? "disabled" : ""}>${it.text}</button>`));
	}

	/**
	 * @param opts Options object.
	 * @param opts.modalTitle
	 * @param opts.fnSort
	 * @param opts.pageFilter
	 * @param [opts.namespace]
	 * @param [opts.allData]
	 */
	constructor (opts) {
		this._modalTitle = opts.modalTitle;
		this._fnSort = opts.fnSort;
		this._pageFilter = opts.pageFilter;
		this._namespace = opts.namespace;
		this._allData = opts.allData || null;
		this._isRadio = !!opts.isRadio;

		this._list = null;
		this._filterCache = null;
	}

	get pageFilter () { return this._pageFilter; }

	_$getWrpList () { return $(`<div class="list ui-list__wrp overflow-x-hidden overflow-y-auto h-100 min-h-0"></div>`); }

	_$getColumnHeaderPreviewAll (opts) {
		return $(`<button class="btn btn-default btn-xs ${opts.isBuildUi ? "col-1" : "col-0-5"}">${ListUiUtil.HTML_GLYPHICON_EXPAND}</button>`);
	}

	/**
	 * @param $wrp
	 * @param opts
	 * @param opts.$iptSearch
	 * @param opts.$btnReset
	 * @param opts.$btnOpen
	 * @param opts.$btnToggleSummaryHidden
	 * @param opts.$wrpMiniPills
	 * @param opts.isBuildUi If an alternate UI should be used, which has "send to right" buttons.
	 */
	async pPopulateWrapper ($wrp, opts) {
		opts = opts || {};

		await this._pInit();

		const $ovlLoading = $(`<div class="w-100 h-100 flex-vh-center"><i class="dnd-font ve-muted">Loading...</i></div>`).appendTo($wrp);

		const $iptSearch = (opts.$iptSearch || $(`<input class="form-control lst__search lst__search--no-border-h h-100" type="search" placeholder="Search...">`)).disableSpellcheck();
		const $btnReset = opts.$btnReset || $(`<button class="btn btn-default">Reset</button>`);
		const $dispNumVisible = $(`<div class="lst__wrp-search-visible no-events flex-vh-center"></div>`);

		const $wrpIptSearch = $$`<div class="w-100 relative">
			${$iptSearch}
			<div class="lst__wrp-search-glass no-events flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>
			${$dispNumVisible}
		</div>`

		const $wrpFormTop = $$`<div class="flex input-group btn-group w-100 lst__form-top">${$wrpIptSearch}${$btnReset}</div>`;

		const $wrpFormBottom = opts.$wrpMiniPills || $(`<div class="w-100"></div>`);

		const $wrpFormHeaders = $(`<div class="input-group input-group--bottom flex no-shrink"></div>`);
		const $cbSelAll = opts.isBuildUi || this._isRadio ? null : $(`<input type="checkbox">`);
		const $btnSendAllToRight = opts.isBuildUi ? $(`<button class="btn btn-xxs btn-default col-1" title="Add All"><span class="glyphicon glyphicon-arrow-right"></span></button>`) : null;

		if (!opts.isBuildUi) {
			if (this._isRadio) $wrpFormHeaders.append(`<label class="btn btn-default btn-xs col-0-5 flex-vh-center" disabled></label>`);
			else $$`<label class="btn btn-default btn-xs col-0-5 flex-vh-center">${$cbSelAll}</label>`.appendTo($wrpFormHeaders);
		}

		const $btnTogglePreviewAll = this._$getColumnHeaderPreviewAll(opts)
			.appendTo($wrpFormHeaders);

		this._$getColumnHeaders().forEach($ele => $wrpFormHeaders.append($ele));
		if (opts.isBuildUi) $btnSendAllToRight.appendTo($wrpFormHeaders);

		const $wrpForm = $$`<div class="flex-col w-100 mb-1">${$wrpFormTop}${$wrpFormBottom}${$wrpFormHeaders}</div>`;
		const $wrpList = this._$getWrpList();

		const $btnConfirm = opts.isBuildUi ? null : $(`<button class="btn btn-default">Confirm</button>`);

		this._list = new List({
			$iptSearch,
			$wrpList,
			fnSort: this._fnSort,
		});

		if (!opts.isBuildUi && !this._isRadio) ListUiUtil.bindSelectAllCheckbox($cbSelAll, this._list);
		ListUiUtil.bindPreviewAllButton($btnTogglePreviewAll, this._list);
		SortUtil.initBtnSortHandlers($wrpFormHeaders, this._list);
		this._list.on("updated", () => $dispNumVisible.html(`${this._list.visibleItems.length}/${this._list.items.length}`));

		this._allData = this._allData || await this._pLoadAllData();

		await this._pageFilter.pInitFilterBox({
			$wrpFormTop,
			$btnReset,
			$wrpMiniPills: $wrpFormBottom,
			namespace: this._namespace,
			$btnOpen: opts.$btnOpen,
			$btnToggleSummaryHidden: opts.$btnToggleSummaryHidden,
		});

		this._allData.forEach((it, i) => {
			this._pageFilter.mutateAndAddToFilters(it);
			const filterListItem = this._getListItem(this._pageFilter, it, i);
			this._list.addItem(filterListItem);
			if (!opts.isBuildUi) {
				if (this._isRadio) filterListItem.ele.addEventListener("click", evt => ListUiUtil.handleSelectClickRadio(this._list, filterListItem, evt));
				else filterListItem.ele.addEventListener("click", evt => ListUiUtil.handleSelectClick(this._list, filterListItem, evt));
			}
		});

		this._list.init();
		this._list.update();

		const handleFilterChange = () => {
			const f = this._pageFilter.filterBox.getValues();
			this._list.filter(li => {
				const it = this._allData[li.ix];
				return this._pageFilter.toDisplay(f, it);
			});
		};

		this._pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, handleFilterChange);
		this._pageFilter.filterBox.render();
		handleFilterChange();

		$ovlLoading.remove();

		const $wrpInner = $$`<div class="flex-col h-100">
			${$wrpForm}
			${$wrpList}
			${opts.isBuildUi ? null : $$`<hr class="hr-1"><div class="flex-vh-center">${$btnConfirm}</div>`}
		</div>`.appendTo($wrp.empty());

		return {
			$wrpIptSearch,
			$iptSearch,
			$wrpInner,
			$btnConfirm,
			pageFilter: this._pageFilter,
			list: this._list,
			$cbSelAll,
			$btnSendAllToRight,
		}
	}

	/**
	 * @param [opts]
	 * @param [opts.filterExpression] A filter expression, as usually found in @filter tags, which will be applied.
	 */
	async pGetUserSelection ({filterExpression = null} = {}) {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise(async resolve => {
			const {$modalInner, doClose} = this._getShowModal(resolve);

			await this.pPreloadHidden($modalInner);

			this._doApplyFilterExpression(filterExpression);

			this._filterCache.$btnConfirm.off("click").click(async () => {
				const checked = this._filterCache.list.visibleItems.filter(it => it.data.cbSel.checked);
				resolve(checked);

				doClose(true);

				// region reset selection state
				if (this._filterCache.$cbSelAll) this._filterCache.$cbSelAll.prop("checked", false);
				this._filterCache.list.items.forEach(it => {
					if (it.data.cbSel) it.data.cbSel.checked = false;
					it.ele.classList.remove("list-multi-selected");
				});
				// endregion
			});

			await UiUtil.pDoForceFocus(this._filterCache.$iptSearch[0]);
		});
	}

	_getShowModal (resolve) {
		const {$modalInner, doClose} = UiUtil.getShowModal({
			isHeight100: true,
			isWidth100: true,
			title: `Filter/Search for ${this._modalTitle}`,
			cbClose: (isDataEntered) => {
				this._filterCache.$wrpModalInner.detach();
				if (!isDataEntered) resolve([]);
			},
			isUncappedHeight: true,
		});

		return {$modalInner, doClose};
	}

	_doApplyFilterExpression (filterExpression) {
		if (!filterExpression) return;

		const filterSubhashMeta = Renderer.getFilterSubhashes(Renderer.splitTagByPipe(filterExpression), this._namespace);
		const subhashes = filterSubhashMeta.subhashes.map(it => `${it.key}${HASH_SUB_KV_SEP}${it.value}`);
		this.pageFilter.filterBox.setFromSubHashes(subhashes, true);
	}

	_getNameStyle () { return `bold`; }

	/**
	 * Pre-heat the modal, thus allowing access to the filter box underneath.
	 *
	 * @param [$modalInner]
	 */
	async pPreloadHidden ($modalInner) {
		// If we're rendering in "hidden" mode, create a dummy element to attach the UI to.
		$modalInner = $modalInner || $(`<div></div>`);

		if (this._filterCache) {
			this._filterCache.$wrpModalInner.appendTo($modalInner);
		} else {
			const meta = await this.pPopulateWrapper($modalInner);
			const {$iptSearch, $btnConfirm, pageFilter, list, $cbSelAll} = meta;
			const $wrpModalInner = meta.$wrpInner;

			this._filterCache = {$iptSearch, $wrpModalInner, $btnConfirm, pageFilter, list, $cbSelAll};
		}
	}

	/** Widths should total to 11/12ths, as 1/12th is set aside for the checkbox column. */
	_$getColumnHeaders () { throw new Error(`Unimplemented!`); }
	async _pInit () { /* Implement as required */ }
	async _pLoadAllData () { throw new Error(`Unimplemented!`); }
	async _getListItem () { throw new Error(`Unimplemented!`); }
}

class FilterBox extends ProxyBase {
	static selectFirstVisible (entryList) {
		if (Hist.lastLoadedId == null && !Hist.initialLoad) {
			Hist._freshLoad();
		}

		// This version deemed too annoying to be of practical use
		//  Instead of always loading the URL, this would switch to the first visible item that matches the filter
		/*
		if (Hist.lastLoadedId && !Hist.initialLoad) {
			const last = entryList[Hist.lastLoadedId];
			const lastHash = UrlUtil.autoEncodeHash(last);
			const link = $("#listcontainer").find(`.list a[href="#${lastHash.toLowerCase()}"]`);
			if (!link.length) Hist._freshLoad();
		} else if (Hist.lastLoadedId == null && !Hist.initialLoad) {
			Hist._freshLoad();
		}
		*/
	}

	/**
	 * @param opts Options object.
	 * @param [opts.$wrpFormTop] Form input group.
	 * @param opts.$btnReset Form reset button.
	 * @param [opts.$btnOpen] A custom button to use to open the filter overlay.
	 * @param [opts.$iptSearch] Search input associated with the "form" this filter is a part of. Only used for passing
	 * through search terms in @filter tags.
	 * @param [opts.$wrpMiniPills] Element to house mini pills.
	 * @param [opts.$btnToggleSummaryHidden] Button which toggles the filter summary.
	 * @param opts.filters Array of filters to be included in this box.
	 * @param [opts.isCompact] True if this box should have a compact/reduced UI.
	 * @param [opts.namespace] Namespace for this filter, to prevent collisions with other filters on the same page.
	 */
	constructor (opts) {
		super();

		this._$iptSearch = opts.$iptSearch;
		this._$wrpFormTop = opts.$wrpFormTop;
		this._$btnReset = opts.$btnReset;
		this._$btnOpen = opts.$btnOpen;
		this._$wrpMiniPills = opts.$wrpMiniPills;
		this._$btnToggleSummaryHidden = opts.$btnToggleSummaryHidden;
		this._filters = opts.filters;
		this._isCompact = opts.isCompact;
		this._namespace = opts.namespace;

		this._doSaveStateThrottled = MiscUtil.throttle(() => this._pDoSaveState(), 50);
		this.__meta = this._getDefaultMeta();
		if (this._isCompact) this.__meta.isSummaryHidden = true;

		this._meta = this._getProxy("meta", this.__meta);
		this.__minisHidden = {};
		this._minisHidden = this._getProxy("minisHidden", this.__minisHidden);
		this.__combineAs = {};
		this._combineAs = this._getProxy("combineAs", this.__combineAs);
		this._modalMeta = null;
		this._isRendered = false;

		this._cachedState = null;

		this._compSearch = BaseComponent.fromObject({search: ""});

		this._filters.forEach(f => f.filterBox = this);

		this._eventListeners = {};
	}

	get filters () { return this._filters; }

	teardown () {
		this._filters.forEach(f => f._doTeardown());
		if (this._modalMeta) this._modalMeta.doTeardown();
	}

	// region Event listeners
	on (identifier, fn) {
		const [eventName, namespace] = identifier.split(".");
		(this._eventListeners[eventName] = this._eventListeners[eventName] || []).push({namespace, fn});
		return this;
	}

	off (identifier) {
		const [eventName, namespace] = identifier.split(".");
		this._eventListeners[eventName] = (this._eventListeners[eventName] || []).filter(it => it.namespace !== namespace);
		if (!this._eventListeners[eventName].length) delete this._eventListeners[eventName];
		return this;
	}

	fireChangeEvent () {
		this._doSaveStateThrottled();
		this.fireEvent(FilterBox.EVNT_VALCHANGE);
	}

	fireEvent (eventName) {
		(this._eventListeners[eventName] || []).forEach(it => it.fn());
	}
	// endregion

	_getNamespacedStorageKey () { return `${FilterBox._STORAGE_KEY}${this._namespace ? `.${this._namespace}` : ""}` }
	getNamespacedHashKey (k) { return `${k || "_".repeat(FilterUtil.SUB_HASH_PREFIX_LENGTH)}${this._namespace ? `.${this._namespace}` : ""}`; }

	async pGetStoredActiveSources () {
		const stored = await StorageUtil.pGetForPage(this._getNamespacedStorageKey());
		if (stored) {
			const sourceFilterData = stored.filters[FilterBox.SOURCE_HEADER];
			if (sourceFilterData) {
				const state = sourceFilterData.state;
				const blue = [];
				const white = [];
				Object.entries(state).forEach(([src, mode]) => {
					if (mode === 1) blue.push(src);
					else if (mode !== -1) white.push(src);
				});
				if (blue.length) return blue; // if some are selected, we load those
				else return white; // otherwise, we load non-red
			}
		}
		return null;
	}

	registerMinisHiddenHook (prop, hook) {
		this._addHook("minisHidden", prop, hook);
	}

	isMinisHidden (header) {
		return !!this._minisHidden[header];
	}

	async pDoLoadState () {
		const toLoad = await StorageUtil.pGetForPage(this._getNamespacedStorageKey());
		if (toLoad != null) this._setStateFromLoaded(toLoad);
	}

	_setStateFromLoaded (state) {
		state.box = state.box || {};
		this._proxyAssign("meta", "_meta", "__meta", state.box.meta || {}, true);
		this._proxyAssign("minisHidden", "_minisHidden", "__minisHidden", state.box.minisHidden || {}, true);
		this._proxyAssign("combineAs", "_combineAs", "__combineAs", state.box.combineAs || {}, true);
		this._filters.forEach(it => it.setStateFromLoaded(state.filters));
	}

	_getSaveableState () {
		const filterOut = {};
		this._filters.forEach(it => Object.assign(filterOut, it.getSaveableState()));
		return {
			box: {
				meta: {...this.__meta},
				minisHidden: {...this.__minisHidden},
				combineAs: {...this.__combineAs},
			},
			filters: filterOut,
		};
	}

	async _pDoSaveState () {
		await StorageUtil.pSetForPage(this._getNamespacedStorageKey(), this._getSaveableState());
	}

	render () {
		if (this._isRendered) {
			// already rendered previously; simply update the filters
			this._filters.map(f => f.update());
			return;
		}
		this._isRendered = true;

		if (!this._$wrpMiniPills) {
			this._$wrpMiniPills = $(`<div class="fltr__mini-view btn-group"></div>`).insertAfter(this._$wrpFormTop);
		} else {
			this._$wrpMiniPills.addClass("fltr__mini-view");
		}

		if (this._$btnReset) {
			this._$btnReset
				.title("Reset filters. SHIFT to reset everything.")
				.click((evt) => this.reset(evt.shiftKey));
		}

		if (!this._$btnToggleSummaryHidden) {
			this._$btnToggleSummaryHidden = $(`<button class="btn btn-default ${this._isCompact ? "p-2" : ""}" title="Toggle Filter Summary"><span class="glyphicon glyphicon-resize-small"></span></button>`)
				.prependTo(this._$wrpFormTop);
		} else if (!this._$btnToggleSummaryHidden.parent().length) {
			this._$btnToggleSummaryHidden.prependTo(this._$wrpFormTop);
		}
		this._$btnToggleSummaryHidden
			.click(() => {
				this._meta.isSummaryHidden = !this._meta.isSummaryHidden;
				this._doSaveStateThrottled();
			});
		const summaryHiddenHook = () => {
			this._$btnToggleSummaryHidden.toggleClass("active", !!this._meta.isSummaryHidden);
			this._$wrpMiniPills.toggleClass("ve-hidden", !!this._meta.isSummaryHidden);
		};
		this._addHook("meta", "isSummaryHidden", summaryHiddenHook);
		summaryHiddenHook();

		if (!this._$btnOpen) {
			this._$btnOpen = $(`<button class="btn btn-default ${this._isCompact ? "px-2" : ""}">Filter</button>`)
				.prependTo(this._$wrpFormTop);
		} else if (!this._$btnOpen.parent().length) {
			this._$btnOpen.prependTo(this._$wrpFormTop);
		}
		this._$btnOpen.click(() => this.show());

		const sourceFilter = this._filters.find(it => it.header === FilterBox.SOURCE_HEADER);
		if (sourceFilter) {
			const selFnAlt = (val) => !SourceUtil.isNonstandardSource(val) && !BrewUtil.hasSourceJson(val);
			const hkSelFn = () => {
				if (this._meta.isBrewDefaultHidden) sourceFilter.setTempFnSel(selFnAlt);
				else sourceFilter.setTempFnSel(null);
				sourceFilter.updateMiniPillClasses();
			};
			this._addHook("meta", "isBrewDefaultHidden", hkSelFn);
			hkSelFn();
		}

		this._filters.map((f, i) => f.$renderMinis({filterBox: this, isFirst: i === 0, $wrpMini: this._$wrpMiniPills}));
	}

	_render_renderModal () {
		this._isModalRendered = true;

		this._modalMeta = UiUtil.getShowModal({
			isHeight100: true,
			isWidth100: true,
			isUncappedHeight: true,
			isIndestructible: true,
			isClosed: true,
			isEmpty: true,
			cbClose: (isDataEntered) => this._pHandleHide(!isDataEntered),
		});

		const $children = this._filters.map((f, i) => f.$render({filterBox: this, isFirst: i === 0, $wrpMini: this._$wrpMiniPills}));

		const metaIptSearch = ComponentUiUtil.$getIptStr(
			this._compSearch, "search",
			{decorationRight: "clear", asMeta: true, html: `<input class="form-control input-xs" placeholder="Search...">`},
		);
		this._compSearch._addHookBase("search", () => {
			const searchTerm = this._compSearch._state.search.toLowerCase();
			this._filters.forEach(f => f.handleSearch(searchTerm));
		});

		const $btnShowAllFilters = $(`<button class="btn btn-xs btn-default">Show All</button>`)
			.click(() => this.showAllFilters());
		const $btnHideAllFilters = $(`<button class="btn btn-xs btn-default">Hide All</button>`)
			.click(() => this.hideAllFilters());

		const $btnReset = $(`<button class="btn btn-xs btn-default mr-3" title="Reset filters. SHIFT to reset everything.">Reset</button>`)
			.click(evt => this.reset(evt.shiftKey));

		const $btnSettings = $(`<button class="btn btn-xs btn-default mr-3"><span class="glyphicon glyphicon-cog"></span></button>`)
			.click(() => this._openSettingsModal());

		const $btnSaveAlt = $(`<button class="btn btn-xs btn-primary" title="Save"><span class="glyphicon glyphicon-ok"></span></button>`)
			.click(() => this._modalMeta.doClose(true));

		const $wrpBtnCombineFilters = $(`<div class="btn-group mr-3"></div>`);
		const $btnCombineFilterSettings = $(`<button class="btn btn-xs btn-default"><span class="glyphicon glyphicon-cog"></span></button>`)
			.click(() => this._openCombineAsModal());

		const $btnCombineFiltersAs = $(`<button class="btn btn-xs btn-default"></button>`)
			.appendTo($wrpBtnCombineFilters)
			.click(() => this._meta.modeCombineFilters = FilterBox._COMBINE_MODES.getNext(this._meta.modeCombineFilters));
		const hook = () => {
			$btnCombineFiltersAs.text(this._meta.modeCombineFilters === "custom" ? this._meta.modeCombineFilters.uppercaseFirst() : this._meta.modeCombineFilters.toUpperCase());
			if (this._meta.modeCombineFilters === "custom") $wrpBtnCombineFilters.append($btnCombineFilterSettings);
			else $btnCombineFilterSettings.detach();
			this._doSaveStateThrottled();
		};
		this._addHook("meta", "modeCombineFilters", hook);
		hook();

		const $btnSave = $(`<button class="btn btn-primary fltr__btn-close mr-2">Save</button>`)
			.click(() => this._modalMeta.doClose(true));

		const $btnCancel = $(`<button class="btn btn-default fltr__btn-close">Cancel</button>`)
			.click(() => this._modalMeta.doClose(false));

		$$(this._modalMeta.$modal)`<div class="split mb-2 mt-2 flex-v-center mobile__flex-col">
			<div class="flex-v-baseline mobile__flex-col">
				<h4 class="m-0 mr-2 mobile__mb-2">Filters</h4>
				${metaIptSearch.$wrp.addClass("mobile__mb-2")}
			</div>
			<div class="flex-v-center mobile__flex-col">
				<div class="flex-v-center mobile__m-1">
					<div class="mr-2">Combine as</div>
					${$wrpBtnCombineFilters}
				</div>
				<div class="flex-v-center mobile__m-1">
					<div class="btn-group mr-2">
						${$btnShowAllFilters}
						${$btnHideAllFilters}
					</div>
					${$btnReset}
					${$btnSettings}
					${$btnSaveAlt}
				</div>
			</div>
		</div>
		<hr class="w-100 m-0 mb-2">

		<hr class="mt-1 mb-1">
		<div class="ui-modal__scroller smooth-scroll px-1">
			${$children}
		</div>
		<hr class="my-1 w-100">
		<div class="w-100 flex-vh-center my-1">${$btnSave}${$btnCancel}</div>`;
	}

	_openSettingsModal () {
		const {$modalInner} = UiUtil.getShowModal({title: "Settings"});

		UiUtil.$getAddModalRowCb($modalInner, "Deselect Homebrew Sources by Default", this._meta, "isBrewDefaultHidden");

		UiUtil.addModalSep($modalInner);

		UiUtil.$getAddModalRowHeader($modalInner, "Hide summary for filter...", {helpText: "The summary is the small red and blue button panel which appear below the search bar."});
		this._filters.forEach(f => UiUtil.$getAddModalRowCb($modalInner, f.header, this._minisHidden, f.header));

		UiUtil.addModalSep($modalInner);

		const $rowResetAlwaysSave = UiUtil.$getAddModalRow($modalInner, "div").addClass("pr-2");
		$rowResetAlwaysSave.append(`<span>Always Save on Close</span>`);
		$(`<button class="btn btn-xs btn-default">Reset</button>`)
			.appendTo($rowResetAlwaysSave)
			.click(async () => {
				await StorageUtil.pRemove(FilterBox._STORAGE_KEY_ALWAYS_SAVE_UNCHANGED);
				JqueryUtil.doToast("Saved!");
			});
	}

	_openCombineAsModal () {
		const {$modalInner} = UiUtil.getShowModal({title: "Filter Combination Logic"});
		const $btnReset = $(`<button class="btn btn-xs btn-default">Reset</button>`)
			.click(() => {
				Object.keys(this._combineAs).forEach(k => this._combineAs[k] = "and");
				$sels.forEach($sel => $sel.val("0"));
			});
		UiUtil.$getAddModalRowHeader($modalInner, "Combine filters as...", {$eleRhs: $btnReset});
		const $sels = this._filters.map(f => UiUtil.$getAddModalRowSel($modalInner, f.header, this._combineAs, f.header, ["and", "or"], {fnDisplay: (it) => it.toUpperCase()}));
	}

	getValues () {
		const outObj = {};
		this._filters.forEach(f => Object.assign(outObj, f.getValues()));
		return outObj;
	}

	addEventListener (type, listener) {
		(this._$wrpFormTop ? this._$wrpFormTop[0] : this._$btnOpen[0]).addEventListener(type, listener);
	}

	_reset_meta () {
		Object.assign(this._meta, this._getDefaultMeta());
	}

	_reset_minisHidden () {
		Object.keys(this._minisHidden).forEach(k => this._minisHidden[k] = false);
	}

	_reset_combineAs () {
		Object.keys(this._combineAs).forEach(k => this._combineAs[k] = "and");
	}

	reset (isResetAll) {
		this._filters.forEach(f => f.reset(isResetAll));
		if (isResetAll) {
			this._reset_meta();
			this._reset_minisHidden();
			this._reset_combineAs();
		}
		this.render();
		this.fireChangeEvent();
	}

	show () {
		if (!this._isModalRendered) this._render_renderModal();
		this._cachedState = this._getSaveableState();
		this._modalMeta.doOpen();
	}

	async _pHandleHide (isCancel = false) {
		if (this._cachedState && isCancel) {
			const curState = this._getSaveableState();
			const hasChanges = !CollectionUtil.deepEquals(curState, this._cachedState);

			if (hasChanges) {
				const isSave = await InputUiUtil.pGetUserBoolean({
					title: "Unsaved Changes",
					textYesRemember: "Always Save",
					textYes: "Save",
					textNo: "Discard",
					storageKey: FilterBox._STORAGE_KEY_ALWAYS_SAVE_UNCHANGED,
					isGlobal: true,
				});
				if (isSave) {
					this._cachedState = null;
					this.fireChangeEvent();
					return;
				} else this._setStateFromLoaded(this._cachedState);
			}
		} else {
			this.fireChangeEvent();
		}

		this._cachedState = null;
	}

	showAllFilters () {
		this._filters.forEach(f => f.show());
	}

	hideAllFilters () {
		this._filters.forEach(f => f.hide());
	}

	setFromSubHashes (subHashes, force = false) {
		const unpacked = {};
		subHashes.forEach(s => {
			const unpackedPart = UrlUtil.unpackSubHash(s, true);
			if (Object.keys(unpackedPart).length > 1) throw new Error(`Multiple keys in subhash!`);
			const k = Object.keys(unpackedPart)[0];
			unpackedPart[k] = {clean: unpackedPart[k], raw: s};
			Object.assign(unpacked, unpackedPart);
		});
		const urlHeaderToFilter = {};
		this._filters.forEach(f => {
			const childFilters = f.getChildFilters();
			if (childFilters.length) childFilters.forEach(f => urlHeaderToFilter[f.header.toLowerCase()] = f);
			urlHeaderToFilter[f.header.toLowerCase()] = f;
		});
		const updatedUrlHeaders = new Set();
		const consumed = new Set();
		let filterInitialSearch;

		const filterBoxState = {};
		const statePerFilter = {};
		const prefixLen = this.getNamespacedHashKey().length;
		Object.entries(unpacked)
			.forEach(([hashKey, data]) => {
				const rawPrefix = hashKey.substring(0, prefixLen);
				const prefix = rawPrefix.substring(0, FilterUtil.SUB_HASH_PREFIX_LENGTH);

				const urlHeader = hashKey.substring(prefixLen);

				if (FilterUtil.SUB_HASH_PREFIXES.has(prefix) && urlHeaderToFilter[urlHeader]) {
					(statePerFilter[urlHeader] = statePerFilter[urlHeader] || {})[prefix] = data.clean;
					updatedUrlHeaders.add(urlHeader);
					consumed.add(data.raw);
				} else if (Object.values(FilterBox._SUB_HASH_PREFIXES).includes(prefix)) {
					// special case for the search """state"""
					if (prefix === VeCt.FILTER_BOX_SUB_HASH_SEARCH_PREFIX) filterInitialSearch = data.clean[0];
					else filterBoxState[prefix] = data.clean;
					consumed.add(data.raw);
				} else if (FilterUtil.SUB_HASH_PREFIXES.has(prefix)) throw new Error(`Could not find filter with header ${urlHeader} for subhash ${data.raw}`)
			});

		if (consumed.size || force) {
			this._setFromSubHashState(urlHeaderToFilter, filterBoxState);

			Object.entries(statePerFilter).forEach(([urlHeader, state]) => {
				const filter = urlHeaderToFilter[urlHeader];
				filter.setFromSubHashState(state);
			});

			// reset any other state/meta state/etc
			Object.keys(urlHeaderToFilter)
				.filter(k => !updatedUrlHeaders.has(k))
				.forEach(k => {
					const filter = urlHeaderToFilter[k];
					filter.resetShallow(true);
				});

			const [link] = Hist.getHashParts();

			const outSub = [];
			Object.values(unpacked)
				.filter(v => !consumed.has(v.raw))
				.forEach(v => outSub.push(v.raw));

			Hist.setSuppressHistory(true);
			Hist.replaceHistoryHash(`${link}${outSub.length ? `${HASH_PART_SEP}${outSub.join(HASH_PART_SEP)}` : ""}`);

			if (filterInitialSearch && this._$iptSearch) this._$iptSearch.val(filterInitialSearch).change().keydown().keyup();
			this.fireChangeEvent();
			Hist.hashChange();
			return outSub;
		} else return subHashes;
	}

	_setFromSubHashState (urlHeaderToFilter, filterBoxState) {
		let hasMeta = false;
		let hasMinisHidden = false;
		let hasCombineAs = false;

		Object.entries(filterBoxState).forEach(([k, vals]) => {
			const mappedK = this.getNamespacedHashKey(Parser._parse_bToA(FilterBox._SUB_HASH_PREFIXES, k));
			switch (mappedK) {
				case "meta": {
					hasMeta = true;
					const data = vals.map(v => UrlUtil.mini.decompress(v));
					Object.keys(this._getDefaultMeta()).forEach((k, i) => this._meta[k] = data[i]);
					break;
				}
				case "minisHidden": {
					hasMinisHidden = true;
					Object.keys(this._minisHidden).forEach(k => this._minisHidden[k] = false);
					vals.forEach(v => {
						const [urlHeader, isHidden] = v.split("=");
						const filter = urlHeaderToFilter[urlHeader];
						if (!filter) throw new Error(`Could not find filter with name "${urlHeader}"`);
						this._minisHidden[filter.header] = !!Number(isHidden);
					});
					break;
				}
				case "combineAs": {
					hasCombineAs = true;
					Object.keys(this._combineAs).forEach(k => this._combineAs[k] = "and");
					vals.forEach(v => {
						const [urlHeader, ixCombineMode] = v.split("=");
						const filter = urlHeaderToFilter[urlHeader];
						if (!filter) throw new Error(`Could not find filter with name "${urlHeader}"`);
						this._combineAs[filter.header] = FilterBox._COMBINE_MODES[ixCombineMode] || FilterBox._COMBINE_MODES[0];
					});
					break;
				}
			}
		});

		if (!hasMeta) this._reset_meta();
		if (!hasMinisHidden) this._reset_minisHidden();
		if (!hasCombineAs) this._reset_combineAs();
	}

	/**
	 * @param [opts] Options object.
	 * @param [opts.isAddSearchTerm] If the active search should be added to the subhashes.
	 */
	getSubHashes (opts) {
		opts = opts || {};
		const out = [];
		const boxSubHashes = this.getBoxSubHashes();
		if (boxSubHashes) out.push(boxSubHashes);
		out.push(...this._filters.map(f => f.getSubHashes()).filter(Boolean));
		if (opts.isAddSearchTerm && this._$iptSearch) {
			const searchTerm = UrlUtil.encodeForHash(this._$iptSearch.val().trim());
			if (searchTerm) out.push(UrlUtil.packSubHash(this._getSubhashPrefix("search"), [searchTerm]));
		}
		return out.flat();
	}

	getBoxSubHashes () {
		const out = [];

		const defaultMeta = this._getDefaultMeta();

		// serialize base meta in a set order
		const anyNotDefault = Object.keys(defaultMeta).find(k => this._meta[k] !== defaultMeta[k]);
		if (anyNotDefault) {
			const serMeta = Object.keys(defaultMeta).map(k => UrlUtil.mini.compress(this._meta[k] === undefined ? defaultMeta[k] : this._meta[k]));
			out.push(UrlUtil.packSubHash(this._getSubhashPrefix("meta"), serMeta));
		}

		// serialize minisHidden as `key=value` pairs
		const setMinisHidden = Object.entries(this._minisHidden).filter(([k, v]) => !!v).map(([k]) => `${k.toUrlified()}=1`);
		if (setMinisHidden.length) {
			out.push(UrlUtil.packSubHash(this._getSubhashPrefix("minisHidden"), setMinisHidden));
		}

		// serialize combineAs as `key=value` pairs
		const setCombineAs = Object.entries(this._combineAs).filter(([k, v]) => v !== FilterBox._COMBINE_MODES[0]).map(([k, v]) => `${k.toUrlified()}=${FilterBox._COMBINE_MODES.indexOf(v)}`);
		if (setCombineAs.length) {
			out.push(UrlUtil.packSubHash(this._getSubhashPrefix("combineAs"), setCombineAs));
		}

		return out.length ? out : null;
	}

	setFromValues (values) {
		this._filters.forEach(it => it.setFromValues(values));
	}

	toDisplay (boxState, ...entryVals) {
		return this._toDisplay(boxState, this._filters, entryVals);
	}

	/** `filterToValueTuples` should be an array of `{filter: <Filter>, value: <Any>}` objects */
	toDisplayByFilters (boxState, ...filterToValueTuples) {
		return this._toDisplay(
			boxState,
			filterToValueTuples.map(it => it.filter),
			filterToValueTuples.map(it => it.value),
		);
	}

	_toDisplay (boxState, filters, entryVals) {
		switch (this._meta.modeCombineFilters) {
			case "and": return this._toDisplay_isAndDisplay(boxState, filters, entryVals);
			case "or": return this._toDisplay_isOrDisplay(boxState, filters, entryVals);
			case "custom": {
				if (entryVals.length !== filters.length) throw new Error(`Number of filters and number of values did not match!`);

				const andFilters = [];
				const andValues = [];
				const orFilters = [];
				const orValues = [];

				for (let i = 0; i < filters.length; ++i) {
					const f = filters[i];
					if (!this._combineAs[f.header] || this._combineAs[f.header] === "and") { // default to "and" if undefined
						andFilters.push(f);
						andValues.push(entryVals[i])
					} else {
						orFilters.push(f);
						orValues.push(entryVals[i])
					}
				}

				return this._toDisplay_isAndDisplay(boxState, andFilters, andValues) && this._toDisplay_isOrDisplay(boxState, orFilters, orValues);
			}
			default: throw new Error(`Unhandled combining mode "${this._meta.modeCombineFilters}"`);
		}
	}

	_toDisplay_isAndDisplay (boxState, filters, vals) {
		return filters
			.map((f, i) => f.toDisplay(boxState, vals[i]))
			.every(it => it);
	}

	_toDisplay_isOrDisplay (boxState, filters, vals) {
		const res = filters.map((f, i) => {
			// filter out "ignored" filter (i.e. all white)
			if (!f.isActive(boxState)) return null;
			return f.toDisplay(boxState, vals[i]);
		}).filter(it => it != null);
		return res.length === 0 || res.find(it => it);
	}

	_getSubhashPrefix (prop) {
		if (FilterBox._SUB_HASH_PREFIXES[prop]) return this.getNamespacedHashKey(FilterBox._SUB_HASH_PREFIXES[prop]);
		throw new Error(`Unknown property "${prop}"`);
	}

	_getDefaultMeta () {
		const out = MiscUtil.copy(FilterBox._DEFAULT_META);
		if (this._isCompact) out.isSummaryHidden = true;
		return out;
	}
}
FilterBox.EVNT_VALCHANGE = "valchange";
FilterBox.SOURCE_HEADER = "Source";
FilterBox._PILL_STATES = ["ignore", "yes", "no"];
FilterBox._COMBINE_MODES = ["and", "or", "custom"];
FilterBox._STORAGE_KEY = "filterBoxState";
FilterBox._DEFAULT_META = {
	modeCombineFilters: "and",
	isSummaryHidden: false,
	isBrewDefaultHidden: false,
};
FilterBox._STORAGE_KEY_ALWAYS_SAVE_UNCHANGED = "filterAlwaysSaveUnchanged";

// These are assumed to be the same length (4 characters)
FilterBox._SUB_HASH_BOX_META_PREFIX = "fbmt";
FilterBox._SUB_HASH_BOX_MINIS_HIDDEN_PREFIX = "fbmh";
FilterBox._SUB_HASH_BOX_COMBINE_AS_PREFIX = "fbca";
FilterBox._SUB_HASH_PREFIXES = {
	meta: FilterBox._SUB_HASH_BOX_META_PREFIX,
	minisHidden: FilterBox._SUB_HASH_BOX_MINIS_HIDDEN_PREFIX,
	combineAs: FilterBox._SUB_HASH_BOX_COMBINE_AS_PREFIX,
	search: VeCt.FILTER_BOX_SUB_HASH_SEARCH_PREFIX,
};

class FilterItem {
	/**
	 * An alternative to string `Filter.items` with a change-handling function
	 * @param options containing:
	 * @param options.item the item string
	 * @param [options.pFnChange] (optional) function to call when filter is changed
	 * @param [options.group] (optional) group this item belongs to.
	 * @param [options.nest] (optional) nest this item belongs to
	 * @param [options.nestHidden] (optional) if nested, default visibility state
	 * @param [options.isIgnoreRed] (optional) if this item should be ignored when negative filtering
	 * @param [options.userData] (optional) extra data to be stored as part of the item
	 */
	constructor (options) {
		this.item = options.item;
		this.pFnChange = options.pFnChange;
		this.group = options.group;
		this.nest = options.nest;
		this.nestHidden = options.nestHidden;
		this.isIgnoreRed = options.isIgnoreRed;
		this.userData = options.userData;

		this.rendered = null;
		this.searchText = null;
	}
}

class FilterBase extends BaseComponent {
	/**
	 * @param opts
	 * @param opts.header Filter header (name)
	 * @param [opts.headerHelp] Filter header help text (tooltip)
	 */
	constructor (opts) {
		super();
		this._filterBox = null;

		this.header = opts.header;
		this._headerHelp = opts.headerHelp;

		this.__meta = {...this.getDefaultMeta()};
		this._meta = this._getProxy("meta", this.__meta);
	}

	_getRenderedHeader () {
		return `<span ${this._headerHelp ? `title="${this._headerHelp.escapeQuotes()}" class="help-subtle"` : ""}>${this.header}</span>`;
	}

	set filterBox (it) { this._filterBox = it; }

	show () { this._meta.isHidden = false; }

	hide () { this._meta.isHidden = true; }

	getBaseSaveableState () { return {meta: {...this.__meta}}; }

	resetBase () {
		Object.assign(this._meta, MiscUtil.copy(this.getDefaultMeta()));
	}

	getMetaSubHashes () {
		const defaultMeta = this.getDefaultMeta();
		const anyNotDefault = Object.keys(defaultMeta).find(k => this._meta[k] !== defaultMeta[k]);
		if (anyNotDefault) {
			const serMeta = Object.keys(defaultMeta).map(k => UrlUtil.mini.compress(this._meta[k] === undefined ? defaultMeta[k] : this._meta[k]));
			return [UrlUtil.packSubHash(this.getSubHashPrefix("meta", this.header), serMeta)]
		} else return null;
	}

	setMetaFromSubHashState (state) {
		const hasMeta = this._doApplyMeta(state, this.getDefaultMeta());
		if (!hasMeta) this.resetBase();
	}

	_doApplyMeta (state, defaultMeta) {
		let hasMeta = false;
		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			if (prop === "meta") {
				hasMeta = true;
				const data = vals.map(v => UrlUtil.mini.decompress(v));
				Object.keys(defaultMeta).forEach((k, i) => {
					if (data[i] !== undefined) this._meta[k] = data[i];
					else this._meta[k] = defaultMeta[k];
				});
			}
		});
		return hasMeta;
	}

	setBaseStateFromLoaded (toLoad) { Object.assign(this._meta, toLoad.meta); }

	getSubHashPrefix (prop, header) {
		if (FilterBase._SUB_HASH_PREFIXES[prop]) {
			const prefix = this._filterBox.getNamespacedHashKey(FilterBase._SUB_HASH_PREFIXES[prop]);
			return `${prefix}${header.toUrlified()}`;
		}
		throw new Error(`Unknown property "${prop}"`);
	}

	static getProp (prefix) {
		return Parser._parse_bToA(FilterBase._SUB_HASH_PREFIXES, prefix);
	}

	_getBtnMobToggleControls (wrpControls) {
		const btnMobToggleControls = e_({
			tag: "button",
			clazz: `btn btn-xs btn-default mobile__visible ml-2 px-3`,
			html: `<span class="glyphicon glyphicon-option-vertical"></span>`,
			click: () => this._meta.isMobileHeaderHidden = !this._meta.isMobileHeaderHidden,
		});
		const hkMobHeaderHidden = () => {
			btnMobToggleControls.toggleClass("active", !this._meta.isMobileHeaderHidden);
			wrpControls.toggleClass("mobile__hidden", !!this._meta.isMobileHeaderHidden);
		};
		this._addHook("meta", "isMobileHeaderHidden", hkMobHeaderHidden);
		hkMobHeaderHidden();

		return btnMobToggleControls;
	}

	getChildFilters () { return []; }
	getDefaultMeta () { return {...FilterBase._DEFAULT_META}; }

	/**
	 * @param vals Previously-read filter value may be passed in for performance.
	 */
	isActive (vals) {
		vals = vals || this.getValues();
		return vals[this.header]._isActive;
	}

	$render () { throw new Error(`Unimplemented!`); }
	$renderMinis () { throw new Error(`Unimplemented!`); }
	getValues () { throw new Error(`Unimplemented!`); }
	reset () { throw new Error(`Unimplemented!`); }
	resetShallow () { throw new Error(`Unimplemented!`); }
	update () { throw new Error(`Unimplemented!`); }
	toDisplay () { throw new Error(`Unimplemented!`); }
	addItem () { throw new Error(`Unimplemented!`); }
	// N.B.: due to a bug in Chrome, these return a copy of the underlying state rather than a copy of the proxied state
	getSaveableState () { throw new Error(`Unimplemented!`); }
	setStateFromLoaded () { throw new Error(`Unimplemented!`); }
	getSubHashes () { throw new Error(`Unimplemented!`); }
	setFromSubHashState () { throw new Error(`Unimplemented!`); }
	setFromValues () { throw new Error(`Unimplemented!`); }
	handleSearch () { throw new Error(`Unimplemented`); }
	_doTeardown () { /* No-op */ }
}
FilterBase._DEFAULT_META = {
	isHidden: false,
	isMobileHeaderHidden: true,
};
// These are assumed to be the same length (4 characters)
FilterBase._SUB_HASH_STATE_PREFIX = "flst";
FilterBase._SUB_HASH_META_PREFIX = "flmt";
FilterBase._SUB_HASH_NESTS_HIDDEN_PREFIX = "flnh";
FilterBase._SUB_HASH_OPTIONS_PREFIX = "flop";
FilterBase._SUB_HASH_PREFIXES = {
	state: FilterBase._SUB_HASH_STATE_PREFIX,
	meta: FilterBase._SUB_HASH_META_PREFIX,
	nestsHidden: FilterBase._SUB_HASH_NESTS_HIDDEN_PREFIX,
	options: FilterBase._SUB_HASH_OPTIONS_PREFIX,
};

class Filter extends FilterBase {
	static _getAsFilterItems (items) {
		return items ? items.map(it => it instanceof FilterItem ? it : new FilterItem({item: it})) : null;
	}

	static _validateItemNests (items, nests) {
		if (!nests) return;
		items = items.filter(it => it.nest);
		const noNest = items.find(it => !nests[it.nest]);
		if (noNest) throw new Error(`Filter does not have matching nest: "${noNest.item}" (call addNest first)`);
		const invalid = items.find(it => !it.nest || !nests[it.nest]);
		if (invalid) throw new Error(`Invalid nest: "${invalid.item}"`);
	}

	/** A single-item version of the above, for performance. */
	static _validateItemNest (item, nests) {
		if (!nests || !item.nest) return;
		if (!nests[item.nest]) throw new Error(`Filter does not have matching nest: "${item.item}" (call addNest first)`);
		if (!item.nest || !nests[item.nest]) throw new Error(`Invalid nest: "${item.item}"`);
	}

	/**
	 * @param opts Options object.
	 * @param opts.header Filter header (name)
	 * @param [opts.headerHelp] Filter header help text (tooltip)
	 * @param opts.items Array of filter items, either `FilterItem` or strings. e.g. `["DMG", "VGM"]`
	 * @param [opts.nests] Key-value object of `"Nest Name": {...nestMeta}`. Nests are used to group/nest filters.
	 * @param [opts.displayFn] Function which translates an item to a displayable form, e.g. `"MM` -> "Monster Manual"`
	 * @param [opts.displayFnMini] Function which translates an item to a shortened displayable form, e.g. `"UABravoCharlie` -> "UABC"`
	 * @param [opts.displayFnTitle] Function which translates an item to a form for displaying in a "title" tooltip
	 * @param [opts.selFn] Function which returns true if an item should be displayed by default; false otherwise.
	 * @param [opts.deselFn] Function which returns true if an item should be hidden by default; false otherwise.
	 * @param [opts.itemSortFn] Function which should be used to sort the `items` array if new entries are added.
	 *        Defaults to ascending alphabetical sort.
	 * @param [opts.itemSortFnMini] Function which should be used to sort the `items` array when rendering mini-pills.
	 * @param [opts.groupFn] Function which takes an item and assigns it to a group.
	 * @param [opts.minimalUi] True if the filter should render with a reduced UI, false otherwise.
	 * @param [opts.umbrellaItems] Items which should, when set active, show everything in the filter. E.g. "All".
	 * @param [opts.umbrellaExcludes] Items which should ignore the state of any `umbrellaItems`
	 * @param [opts.isSortByDisplayItems] If items should be sorted by their display value, rather than their internal value.
	 * @param [opts.isSrdFilter] If this filter's items include the "SRD" tag.
	 */
	constructor (opts) {
		super(opts);
		this._items = Filter._getAsFilterItems(opts.items || []);
		this.__itemsSet = new Set(this._items.map(it => it.item)); // Cache the items as a set for fast exists checking
		this._nests = opts.nests;
		this._displayFn = opts.displayFn;
		this._displayFnMini = opts.displayFnMini;
		this._displayFnTitle = opts.displayFnTitle;
		this._selFn = opts.selFn;
		this._selFnCache = null;
		this._deselFn = opts.deselFn;
		this._itemSortFn = opts.itemSortFn === undefined ? SortUtil.ascSort : opts.itemSortFn;
		this._itemSortFnMini = opts.itemSortFnMini;
		this._groupFn = opts.groupFn;
		this._minimalUi = opts.minimalUi;
		this._umbrellaItems = Filter._getAsFilterItems(opts.umbrellaItems);
		this._umbrellaExcludes = Filter._getAsFilterItems(opts.umbrellaExcludes);
		this._isSortByDisplayItems = !!opts.isSortByDisplayItems;
		this._isSrdFilter = !!opts.isSrdFilter;

		Filter._validateItemNests(this._items, this._nests);

		this._filterBox = null;
		this._items.forEach(it => this._defaultItemState(it));
		this.__$wrpFilter = null;
		this.__wrpPills = null;
		this.__wrpMiniPills = null;
		this.__$wrpNestHeadInner = null;
		this._updateNestSummary = null;
		this.__nestsHidden = {};
		this._nestsHidden = this._getProxy("nestsHidden", this.__nestsHidden);
		this._isNestsDirty = false;
		this._isItemsDirty = false;
		this._pillGroupsMeta = {};
	}

	get isSrdFilter () { return this._isSrdFilter; }

	getSaveableState () {
		return {
			[this.header]: {
				...this.getBaseSaveableState(),
				state: {...this.__state},
				nestsHidden: {...this.__nestsHidden},
			},
		};
	}

	setStateFromLoaded (filterState) {
		if (filterState && filterState[this.header]) {
			const toLoad = filterState[this.header];
			this.setBaseStateFromLoaded(toLoad);
			Object.assign(this._state, toLoad.state);
			Object.assign(this._nestsHidden, toLoad.nestsHidden);
		}
	}

	getSubHashes () {
		const out = [];

		const baseMeta = this.getMetaSubHashes();
		if (baseMeta) out.push(...baseMeta);

		const areNotDefaultState = Object.entries(this._state).filter(([k, v]) => {
			if (k.startsWith("_")) return false;
			const defState = this._getDefaultState(k);
			return defState !== v;
		});
		if (areNotDefaultState.length) {
			// serialize state as `key=value` pairs
			const serPillStates = areNotDefaultState.map(([k, v]) => `${k.toUrlified()}=${v}`);
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("state", this.header), serPillStates));
		}

		const areNotDefaultNestsHidden = Object.entries(this._nestsHidden).filter(([k, v]) => this._nests[k] && !(this._nests[k].isHidden === v));
		if (areNotDefaultNestsHidden.length) {
			// serialize nestsHidden as `key=value` pairs
			const nestsHidden = areNotDefaultNestsHidden.map(([k]) => `${k.toUrlified()}=1`);
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("nestsHidden", this.header), nestsHidden));
		}

		if (!out.length) return null;

		// Always extend default state
		out.push(UrlUtil.packSubHash(this.getSubHashPrefix("options", this.header), ["extend"]))
		return out;
	}

	/**
	 * Get transient options used when setting state from URL.
	 * @private
	 */
	_getOptionsFromSubHashState (state) {
		// `flopsource:thing1~thing2` => `{options: ["thing1", "thing2"]}`
		const opts = {};
		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			switch (prop) {
				case "options": {
					vals.forEach(val => {
						switch (val) {
							case "extend": {
								opts.isExtendDefaultState = true;
							}
						}
					});
				}
			}
		});
		return new FilterTransientOptions(opts);
	}

	setFromSubHashState (state) {
		this.setMetaFromSubHashState(state);
		const transientOptions = this._getOptionsFromSubHashState(state);

		let hasState = false;
		let hasNestsHidden = false;

		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			switch (prop) {
				case "state": {
					hasState = true;
					const nxtState = {};

					if (transientOptions.isExtendDefaultState) {
						Object.keys(this._state).forEach(k => nxtState[k] = this._getDefaultState(k));
					} else {
						// This allows e.g. @filter tags to cleanly specify their sources
						Object.keys(this._state).forEach(k => nxtState[k] = 0);
					}

					vals.forEach(v => {
						const [statePropLower, state] = v.split("=");
						const stateProp = Object.keys(this._state).find(k => k.toLowerCase() === statePropLower);
						if (stateProp) nxtState[stateProp] = Number(state);
					});
					this._setState(nxtState);
					break;
				}
				case "nestsHidden": {
					hasNestsHidden = true;
					const nxtNestsHidden = {};
					Object.keys(this._nestsHidden).forEach(k => {
						const nestKey = Object.keys(this._nests).find(it => k.toLowerCase() === it.toLowerCase());
						nxtNestsHidden[k] = this._nests[nestKey] && this._nests[nestKey].isHidden;
					});
					vals.forEach(v => {
						const [nestNameLower, state] = v.split("=");
						const nestName = Object.keys(this._nestsHidden).find(k => k.toLowerCase() === nestNameLower);
						if (nestName) nxtNestsHidden[nestName] = !!Number(state);
					});
					this._proxyAssign("nestsHidden", "_nestsHidden", "__nestsHidden", nxtNestsHidden, true);
					break;
				}
			}
		});

		if (!hasState) this.reset();
		if (!hasNestsHidden) this._resetNestsHidden();
	}

	setFromValues (values) {
		if (values[this.header]) {
			Object.keys(this._state).forEach(k => this._state[k] = 0);
			Object.assign(this._state, values[this.header]);
		}
	}

	setValue (k, v) { this._state[k] = v; }

	_resetNestsHidden () {
		if (this._nests) Object.entries(this._nests).forEach(([nestName, nestMeta]) => this._nestsHidden[nestName] = !!nestMeta.isHidden);
	}

	_defaultItemState (item) {
		// if both a selFn and a deselFn are specified, we default to deselecting
		this._state[item.item] = this._getDefaultState(item.item);
	}

	_getDefaultState (k) { return this._deselFn && this._deselFn(k) ? 2 : this._selFn && this._selFn(k) ? 1 : 0; }

	_getPill (item) {
		const displayText = this._displayFn ? this._displayFn(item.item, item) : item.item;

		const btnPill = e_({
			tag: "div",
			clazz: "fltr__pill",
			html: displayText,
			click: evt => {
				if (evt.shiftKey) {
					const nxtState = {};
					Object.keys(this._state).forEach(k => nxtState[k] = 0);
					this._proxyAssign("state", "_state", "__state", nxtState, true);
				}

				if (++this._state[item.item] > 2) this._state[item.item] = 0;
			},
			contextmenu: (evt) => {
				evt.preventDefault();

				if (--this._state[item.item] < 0) this._state[item.item] = 2;
			},
		});

		const hook = () => {
			const val = FilterBox._PILL_STATES[this._state[item.item]];
			btnPill.attr("state", val);
			if (item.pFnChange) item.pFnChange(item.item, val);
		};
		this._addHook("state", item.item, hook);
		hook();

		item.searchText = displayText.toLowerCase();

		return btnPill;
	}

	setTempFnSel (tempFnSel) {
		this._selFnCache = this._selFnCache || this._selFn;
		if (tempFnSel) this._selFn = tempFnSel;
		else this._selFn = this._selFnCache;
	}

	updateMiniPillClasses () {
		this._items.filter(it => it.btnMini).forEach(it => {
			const isDefaultDesel = this._deselFn && this._deselFn(it.item);
			const isDefaultSel = this._selFn && this._selFn(it.item);
			it.btnMini
				.toggleClass("fltr__mini-pill--default-desel", isDefaultDesel)
				.toggleClass("fltr__mini-pill--default-sel", isDefaultSel)
		});
	}

	_getBtnMini (item) {
		const toDisplay = this._displayFnMini ? this._displayFnMini(item.item, item) : this._displayFn ? this._displayFn(item.item, item) : item.item;

		const btnMini = e_({
			tag: "div",
			clazz: `fltr__mini-pill ${this._filterBox.isMinisHidden(this.header) ? "ve-hidden" : ""} ${this._deselFn && this._deselFn(item.item) ? "fltr__mini-pill--default-desel" : ""} ${this._selFn && this._selFn(item.item) ? "fltr__mini-pill--default-sel" : ""}`,
			html: toDisplay,
			title: `${this._displayFnTitle ? `${this._displayFnTitle(item.item, item)} (` : ""}Filter: ${this.header}${this._displayFnTitle ? ")" : ""}`,
			click: () => {
				this._state[item.item] = 0;
				this._filterBox.fireChangeEvent();
			},
		}).attr("state", FilterBox._PILL_STATES[this._state[item.item]]);

		const hook = () => btnMini.attr("state", FilterBox._PILL_STATES[this._state[item.item]]);
		this._addHook("state", item.item, hook);

		const hideHook = () => btnMini.toggleClass("ve-hidden", this._filterBox.isMinisHidden(this.header));
		this._filterBox.registerMinisHiddenHook(this.header, hideHook);

		return btnMini;
	}

	_doSetPillsAll () {
		Object.keys(this._state).forEach(k => {
			if (this._state[k] !== 1) this._state[k] = 1;
		});
	}

	_doSetPillsClear () {
		Object.keys(this._state).forEach(k => {
			if (this._state[k] !== 0) this._state[k] = 0;
		});
	}

	_doSetPillsNone () {
		Object.keys(this._state).forEach(k => {
			if (this._state[k] !== 2) this._state[k] = 2;
		});
	}

	_doSetPinsDefault () {
		this.reset();
	}

	_getHeaderControls (opts) {
		const btnAll = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn--all w-100`,
			click: () => this._doSetPillsAll(),
			html: "All",
		});
		const btnClear = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn--clear w-100`,
			click: () => this._doSetPillsClear(),
			html: "Clear",
		});
		const btnNone = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn--none w-100`,
			click: () => this._doSetPillsNone(),
			html: "None",
		});
		const btnDefault = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} w-100`,
			click: () => this._doSetPinsDefault(),
			html: "Default",
		});

		const wrpStateBtnsOuter = e_({
			tag: "div",
			clazz: "flex-v-center fltr__h-wrp-state-btns-outer",
			children: [
				e_({
					tag: "div",
					clazz: "btn-group flex-v-center w-100",
					children: [
						btnAll,
						btnClear,
						btnNone,
						btnDefault,
					],
				}),
			],
		});
		this._getHeaderControls_addExtraStateBtns(opts, wrpStateBtnsOuter);

		const wrpSummary = e_({tag: "div", clazz: "flex-vh-center ve-hidden"});

		const btnCombineBlue = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn-logic--blue fltr__h-btn-logic w-100`,
			click: () => this._meta.combineBlue = Filter._getNextCombineMode(this._meta.combineBlue),
			title: `Positive matches mode for this filter. AND requires all blues to match, OR requires at least one blue to match, XOR requires exactly one blue to match.`,
		});
		const hookCombineBlue = () => e_({ele: btnCombineBlue, text: `${this._meta.combineBlue}`.toUpperCase()});
		this._addHook("meta", "combineBlue", hookCombineBlue);
		hookCombineBlue();

		const btnCombineRed = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn-logic--red fltr__h-btn-logic w-100`,
			click: () => this._meta.combineRed = Filter._getNextCombineMode(this._meta.combineRed),
			title: `Negative match mode for this filter. AND requires all reds to match, OR requires at least one red to match, XOR requires exactly one red to match.`,
		});
		const hookCombineRed = () => e_({ele: btnCombineRed, text: `${this._meta.combineRed}`.toUpperCase()});
		this._addHook("meta", "combineRed", hookCombineRed);
		hookCombineRed();

		const btnShowHide = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} ml-2`,
			click: () => this._meta.isHidden = !this._meta.isHidden,
			html: "Hide",
		});
		const hookShowHide = () => {
			e_({ele: btnShowHide}).toggleClass("active", this._meta.isHidden);
			wrpStateBtnsOuter.toggleVe(!this._meta.isHidden);

			// render summary
			const cur = this.getValues()[this.header];

			const htmlSummary = [
				cur._totals.yes
					? `<span class="fltr__summary_item fltr__summary_item--include" title="${cur._totals.yes} hidden &quot;required&quot; tags">${cur._totals.yes}</span>`
					: null,
				cur._totals.yes && cur._totals.no
					? `<span class="fltr__summary_item_spacer"></span>`
					: null,
				cur._totals.no
					? `<span class="fltr__summary_item fltr__summary_item--exclude" title="${cur._totals.no} hidden &quot;excluded&quot; tags">${cur._totals.no}</span>`
					: null,
			].filter(Boolean).join("");
			e_({ele: wrpSummary, html: htmlSummary}).toggleVe(this._meta.isHidden);
		};
		this._addHook("meta", "isHidden", hookShowHide);
		hookShowHide();

		return e_({
			tag: "div",
			clazz: `flex-v-center fltr__h-wrp-btns-outer`,
			children: [
				wrpSummary,
				wrpStateBtnsOuter,
				e_({tag: "span", clazz: `btn-group ml-2 flex-v-center`, children: [btnCombineBlue, btnCombineRed]}),
				btnShowHide,
			],
		});
	}

	_getHeaderControls_addExtraStateBtns () {
		// To be optionally implemented by child classes
	}

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$render (opts) {
		this._filterBox = opts.filterBox;
		this.__wrpMiniPills = e_({ele: opts.$wrpMini[0]});

		const wrpControls = this._getHeaderControls(opts);

		if (this._nests) {
			const wrpNestHead = e_({tag: "div", clazz: "fltr__wrp-pills--sub"}).appendTo(this.__wrpPills);
			this.__$wrpNestHeadInner = e_({tag: "div", clazz: "flex flex-wrap"}).appendTo(wrpNestHead);

			const wrpNestHeadSummary = e_({tag: "div", clazz: "fltr__summary_nest"}).appendTo(wrpNestHead);

			this._updateNestSummary = () => {
				const stats = {high: 0, low: 0};
				this._items.filter(it => this._state[it.item] && this._nestsHidden[it.nest]).forEach(it => {
					const key = this._state[it.item] === 1 ? "high" : "low";
					stats[key]++;
				});

				wrpNestHeadSummary.empty();

				if (stats.high) {
					e_({
						tag: "span",
						clazz: "fltr__summary_item fltr__summary_item--include",
						text: stats.high,
						title: `${stats.high} hidden "required" tag${stats.high === 1 ? "" : "s"}`,
					}).appendTo(wrpNestHeadSummary);
				}

				if (stats.high && stats.low) e_({tag: "span", clazz: "fltr__summary_item_spacer"}).appendTo(wrpNestHeadSummary);

				if (stats.low) {
					e_({
						tag: "span",
						clazz: "fltr__summary_item fltr__summary_item--exclude",
						text: stats.low,
						title: `${stats.low} hidden "excluded" tag${stats.low === 1 ? "" : "s"}`,
					}).appendTo(wrpNestHeadSummary);
				}
			};

			this._doRenderNests();
		}

		this._doRenderPills();

		const btnMobToggleControls = this._getBtnMobToggleControls(wrpControls);

		this.__$wrpFilter = $$`<div>
			${opts.isFirst ? "" : `<div class="fltr__dropdown-divider ${opts.isMulti ? "fltr__dropdown-divider--indented" : ""} mb-1"></div>`}
			<div class="split fltr__h ${this._minimalUi ? "fltr__minimal-hide" : ""} mb-1">
				<div class="ml-2 fltr__h-text flex-h-center">${opts.isMulti ? `<span class="mr-2">\u2012</span>` : ""}${this._getRenderedHeader()}${btnMobToggleControls}</div>
				${wrpControls}
			</div>
			${this.__wrpPills}
		</div>`;

		this._doToggleDisplay();

		return this.__$wrpFilter;
	}

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$renderMinis (opts) {
		this._filterBox = opts.filterBox;
		this.__wrpMiniPills = e_({ele: opts.$wrpMini[0]});

		this.__wrpPills = e_({tag: "div", clazz: `fltr__wrp-pills ${this._groupFn ? "fltr__wrp-subs" : ""}`});
		const hook = () => this.__wrpPills.toggleVe(!this._meta.isHidden);
		this._addHook("meta", "isHidden", hook);
		hook();

		this._doRenderMiniPills();
	}

	getValues () {
		const state = MiscUtil.copy(this._state);
		// remove state for any currently-absent filters
		Object.keys(state).filter(k => !this._items.some(it => `${it.item}` === k)).forEach(k => delete state[k]);
		const out = {...state};

		// add helper data
		out._isActive = Object.values(state).some(Boolean);
		out._totals = {yes: 0, no: 0, ignored: 0};
		Object.values(state).forEach(v => {
			const totalKey = v === 0 ? "ignored" : v === 1 ? "yes" : "no";
			out._totals[totalKey]++;
		});
		out._combineBlue = this._meta.combineBlue;
		out._combineRed = this._meta.combineRed;
		return {[this.header]: out};
	}

	reset (isResetAll) {
		if (isResetAll) {
			this.resetBase();
			this._resetNestsHidden();
		} else {
			// Always reset "AND/OR" states
			Object.assign(this._meta, {combineBlue: Filter._DEFAULT_META.combineBlue, combineRed: Filter._DEFAULT_META.combineRed});
		}
		Object.keys(this._state).forEach(k => delete this._state[k]);
		this._items.forEach(it => this._defaultItemState(it));
	}

	resetShallow () { return this.reset(); }

	_doRenderPills () {
		if (this._itemSortFn) this._items.sort(this._isSortByDisplayItems && this._displayFn ? (a, b) => this._itemSortFn(this._displayFn(a.item, a), this._displayFn(b.item, b)) : this._itemSortFn);

		this._items.forEach(it => {
			if (!it.rendered) {
				it.rendered = this._getPill(it);
				if (it.nest) {
					const hook = () => it.rendered.toggleVe(!this._nestsHidden[it.nest]);
					this._addHook("nestsHidden", it.nest, hook);
					hook();
				}
			}

			if (this._groupFn) {
				const group = this._groupFn(it);
				this._doRenderPills_doRenderWrpGroup(group);
				this._pillGroupsMeta[group].wrpPills.append(it.rendered);
			} else it.rendered.appendTo(this.__wrpPills);
		});
	}

	_doRenderPills_doRenderWrpGroup (group) {
		const existingMeta = this._pillGroupsMeta[group];
		if (existingMeta && !existingMeta.isAttached) {
			existingMeta.hrDivider.appendTo(this.__wrpPills);
			existingMeta.wrpPills.appendTo(this.__wrpPills);
			existingMeta.isAttached = true;
		}
		if (existingMeta) return

		this._pillGroupsMeta[group] = {
			hrDivider: this._doRenderPills_doRenderWrpGroup_getHrDivider(group).appendTo(this.__wrpPills),
			wrpPills: this._doRenderPills_doRenderWrpGroup_getWrpPillsSub(group).appendTo(this.__wrpPills),
			isAttached: true,
		};

		Object.entries(this._pillGroupsMeta)
			.sort((a, b) => SortUtil.ascSortLower(a[0], b[0]))
			.forEach(([groupKey, groupMeta], i) => {
				groupMeta.hrDivider.appendTo(this.__wrpPills);
				groupMeta.hrDivider.toggleVe(!this._isGroupDividerHidden(groupKey, i));
				groupMeta.wrpPills.appendTo(this.__wrpPills);
			});

		if (this._nests) {
			this._pillGroupsMeta[group].toggleDividerFromNestVisibility = () => {
				this._pillGroupsMeta[group].hrDivider.toggleVe(!this._isGroupDividerHidden(group));
			};

			// bind group dividers to show/hide depending on nest visibility state
			Object.keys(this._nests).forEach(nestName => {
				const hook = () => this._pillGroupsMeta[group].toggleDividerFromNestVisibility();
				this._addHook("nestsHidden", nestName, hook);
				hook();
				this._pillGroupsMeta[group].toggleDividerFromNestVisibility();
			});
		}
	}

	_isGroupDividerHidden (group, ixSortedGroups) {
		if (!this._nests) {
			// When not nested, always hide the first divider
			if (ixSortedGroups === undefined) return `${group}` === `${Object.keys(this._pillGroupsMeta).sort((a, b) => SortUtil.ascSortLower(a, b))[0]}`;
			return ixSortedGroups === 0;
		}

		const groupItems = this._items.filter(it => this._groupFn(it) === group);
		const hiddenGroupItems = groupItems.filter(it => this._nestsHidden[it.nest]);
		return groupItems.length === hiddenGroupItems.length;
	}

	_doRenderPills_doRenderWrpGroup_getHrDivider () { return e_({tag: "hr", clazz: `fltr__dropdown-divider--sub hr-2 mx-3`}); }
	_doRenderPills_doRenderWrpGroup_getWrpPillsSub () { return e_({tag: "div", clazz: `fltr__wrp-pills--sub`}); }

	_doRenderMiniPills () {
		// create a list view so we can freely sort
		const view = this._items.slice(0);
		if (this._itemSortFnMini || this._itemSortFn) {
			const fnSort = this._itemSortFnMini || this._itemSortFn;
			view.sort(this._isSortByDisplayItems && this._displayFn ? (a, b) => fnSort(this._displayFn(a.item, a), this._displayFn(b.item, b)) : fnSort);
		}

		view.forEach(it => {
			// re-append existing elements to sort them
			(it.btnMini = it.btnMini || this._getBtnMini(it)).appendTo(this.__wrpMiniPills);
		});
	}

	_doToggleDisplay () {
		// if there are no items, hide everything
		if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__no-items", !this._items.length);
	}

	_doRenderNests () {
		Object.entries(this._nests)
			.sort((a, b) => SortUtil.ascSort(a[0], b[0])) // array 0 (key) is the nest name
			.forEach(([nestName, nestMeta]) => {
				if (nestMeta._$btnNest == null) {
					// this can be restored from a saved state, otherwise, initialise it
					if (this._nestsHidden[nestName] == null) this._nestsHidden[nestName] = !!nestMeta.isHidden;

					const $btnText = $(`<span>${nestName} [${this._nestsHidden[nestName] ? "+" : "\u2212"}]</span>`);
					nestMeta._$btnNest = $$`<div class="fltr__btn_nest">${$btnText}</div>`
						.click(() => this._nestsHidden[nestName] = !this._nestsHidden[nestName]);

					const hook = () => {
						$btnText.text(`${nestName} [${this._nestsHidden[nestName] ? "+" : "\u2212"}]`);

						const stats = {high: 0, low: 0, total: 0};
						this._items
							.filter(it => it.nest === nestName)
							.find(it => {
								const key = this._state[it.item] === 1 ? "high" : this._state[it.item] ? "low" : "ignored";
								stats[key]++;
								stats.total++;
							});
						const allHigh = stats.total === stats.high;
						const allLow = stats.total === stats.low;
						nestMeta._$btnNest.toggleClass("fltr__btn_nest--include-all", this._nestsHidden[nestName] && allHigh)
							.toggleClass("fltr__btn_nest--exclude-all", this._nestsHidden[nestName] && allLow)
							.toggleClass("fltr__btn_nest--include", this._nestsHidden[nestName] && !!(!allHigh && !allLow && stats.high && !stats.low))
							.toggleClass("fltr__btn_nest--exclude", this._nestsHidden[nestName] && !!(!allHigh && !allLow && !stats.high && stats.low))
							.toggleClass("fltr__btn_nest--both", this._nestsHidden[nestName] && !!(!allHigh && !allLow && stats.high && stats.low));

						if (this._updateNestSummary) this._updateNestSummary();
					};

					this._items
						.filter(it => it.nest === nestName)
						.find(it => {
							this._addHook("state", it.item, hook);
						});

					this._addHook("nestsHidden", nestName, hook);
					hook();
				}
				nestMeta._$btnNest.appendTo(this.__$wrpNestHeadInner);
			});

		if (this._updateNestSummary) this._updateNestSummary();
	}

	update () {
		if (this._isNestsDirty) {
			this._isNestsDirty = false;

			this._doRenderNests();
		}

		if (this._isItemsDirty) {
			this._isItemsDirty = false;

			this._doRenderPills();
		}

		// always render the mini-pills, to ensure the overall order in the grid stays correct (shared between multiple filters)
		this._doRenderMiniPills();
		this._doToggleDisplay();
	}

	addItem (item) {
		if (item == null) return;
		if (item instanceof Array) {
			const len = item.length;
			for (let i = 0; i < len; ++i) this.addItem(item[i]);
		} else if (!this.__itemsSet.has(item.item || item)) {
			item = item instanceof FilterItem ? item : new FilterItem({item});
			Filter._validateItemNest(item, this._nests);

			this._isItemsDirty = true;
			this._items.push(item);
			this.__itemsSet.add(item.item);
			if (this._state[item.item] == null) this._defaultItemState(item);
		}
	}

	static _isItemsEqual (item1, item2) {
		return (item1 instanceof FilterItem ? item1.item : item1) === (item2 instanceof FilterItem ? item2.item : item2);
	}

	removeItem (item) {
		const ixItem = this._items.findIndex(it => Filter._isItemsEqual(it, item));
		if (~ixItem) {
			const item = this._items[ixItem];

			// FIXME this doesn't remove any associated hooks, and is therefore a minor memory leak
			this._isItemsDirty = true;
			item.rendered.detach();
			item.btnMini.detach();
			this._items.splice(ixItem, 1);
		}
	}

	addNest (nestName, nestMeta) {
		// may need to allow this in future
		// can easily be circumvented by initialising with empty nests in filter construction
		if (!this._nests) throw new Error(`Filter was not nested!`);
		if (!this._nests[nestName]) {
			this._isNestsDirty = true;
			this._nests[nestName] = nestMeta;

			// bind group dividers to show/hide based on the new nest
			if (this._groupFn) {
				Object.keys(this._pillGroupsMeta).forEach(group => {
					const hook = () => this._pillGroupsMeta[group].toggleDividerFromNestVisibility();
					this._addHook("nestsHidden", nestName, hook);
					hook();
					this._pillGroupsMeta[group].toggleDividerFromNestVisibility();
				});
			}
		}
	}

	_toDisplay_getMappedEntryVal (entryVal) {
		if (!(entryVal instanceof Array)) entryVal = [entryVal];
		entryVal = entryVal.map(it => it instanceof FilterItem ? it : new FilterItem({item: it}));
		return entryVal;
	}

	_toDisplay_getFilterState (boxState) { return boxState[this.header]; }

	toDisplay (boxState, entryVal) {
		const filterState = this._toDisplay_getFilterState(boxState);
		if (!filterState) return true;

		const totals = filterState._totals;

		entryVal = this._toDisplay_getMappedEntryVal(entryVal);

		const isUmbrella = () => {
			if (this._umbrellaItems) {
				if (!entryVal) return false;

				if (this._umbrellaExcludes && this._umbrellaExcludes.some(it => filterState[it.item])) return false;

				return this._umbrellaItems.some(u => entryVal.includes(u.item))
					&& (this._umbrellaItems.some(u => filterState[u.item] === 0) || this._umbrellaItems.some(u => filterState[u.item] === 1));
			}
		};

		let hide = false;
		let display = false;

		switch (filterState._combineBlue) {
			case "or": {
				// default to displaying
				if (totals.yes === 0) display = true;

				// if any are 1 (blue) include if they match
				display = display || entryVal.some(fi => filterState[fi.item] === 1 || isUmbrella());

				break;
			}
			case "xor": {
				// default to displaying
				if (totals.yes === 0) display = true;

				// if any are 1 (blue) include if precisely one matches
				display = display || entryVal.filter(fi => filterState[fi.item] === 1 || isUmbrella()).length === 1;

				break;
			}
			case "and": {
				const totalYes = entryVal.filter(fi => filterState[fi.item] === 1).length;
				display = !totals.yes || totals.yes === totalYes;

				break;
			}
			default: throw new Error(`Unhandled combine mode "${filterState._combineBlue}"`);
		}

		switch (filterState._combineRed) {
			case "or": {
				// if any are 2 (red) exclude if they match
				hide = hide || entryVal.filter(fi => !fi.isIgnoreRed).some(fi => filterState[fi.item] === 2);

				break;
			}
			case "xor": {
				// if exactly one is 2 (red) exclude if it matches
				hide = hide || entryVal.filter(fi => !fi.isIgnoreRed).filter(fi => filterState[fi.item] === 2).length === 1;

				break;
			}
			case "and": {
				const totalNo = entryVal.filter(fi => !fi.isIgnoreRed).filter(fi => filterState[fi.item] === 2).length;
				hide = totals.no && totals.no === totalNo;

				break;
			}
			default: throw new Error(`Unhandled combine mode "${filterState._combineRed}"`);
		}

		return display && !hide;
	}

	_doInvertPins () {
		const cur = MiscUtil.copy(this._state);
		Object.keys(this._state).forEach(k => this._state[k] = cur[k] === 1 ? 0 : 1);
	}

	getDefaultMeta () {
		// Key order is important, as @filter tags depend on it
		return {
			...Filter._DEFAULT_META,
			...super.getDefaultMeta(),
		};
	}

	handleSearch (searchTerm) {
		const isHeaderMatch = this.header.toLowerCase().includes(searchTerm);

		if (isHeaderMatch) {
			this._items.forEach(it => {
				if (!it.rendered) return;
				it.rendered.toggleClass("fltr__hidden--search", false);
			});

			if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__hidden--search", false);

			return true;
		}

		let visibleCount = 0;
		this._items.forEach(it => {
			if (!it.rendered) return;
			const isVisible = it.searchText.includes(searchTerm);
			it.rendered.toggleClass("fltr__hidden--search", !isVisible);
			if (isVisible) visibleCount++;
		});

		if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__hidden--search", visibleCount === 0);

		return visibleCount !== 0;
	}

	static _getNextCombineMode (combineMode) {
		let ix = Filter._COMBINE_MODES.indexOf(combineMode);
		if (ix === -1) ix = (Filter._COMBINE_MODES.length - 1);
		if (++ix === Filter._COMBINE_MODES.length) ix = 0;
		return Filter._COMBINE_MODES[ix];
	}

	_doTeardown () {
		this._items.forEach(it => {
			if (it.rendered) it.rendered.detach();
			if (it.btnMini) it.btnMini.detach();
		});

		Object.values(this._nests || {})
			.filter(nestMeta => nestMeta._$btnNest)
			.forEach(nestMeta => nestMeta._$btnNest.detach());

		Object.values(this._pillGroupsMeta || {})
			.forEach(it => {
				it.hrDivider.detach();
				it.wrpPills.detach();
				it.isAttached = false;
			});
	}
}
Filter._DEFAULT_META = {
	combineBlue: "or",
	combineRed: "or",
};
Filter._COMBINE_MODES = ["or", "and", "xor"];

class FilterTransientOptions {
	/**
	 * @param opts Options object.
	 * @param [opts.isExtendDefaultState]
	 */
	constructor (opts) {
		this.isExtendDefaultState = opts.isExtendDefaultState;
	}
}

class SourceFilterItem extends FilterItem {
	/**
	 * @param options
	 * @param [options.isOtherSource] If this is not the primary source of the entity.
	 */
	constructor (options) {
		super(options);
		this.isOtherSource = options.isOtherSource;
	}
}

class SourceFilter extends Filter {
	constructor (opts) {
		opts = opts || {};

		opts.header = opts.header === undefined ? FilterBox.SOURCE_HEADER : opts.header;
		opts.displayFn = opts.displayFn === undefined ? item => Parser.sourceJsonToFullCompactPrefix(item.item || item) : opts.displayFn;
		opts.itemSortFn = opts.itemSortFn === undefined ? (a, b) => SortUtil.ascSortLower(Parser.sourceJsonToFull(a.item), Parser.sourceJsonToFull(b.item)) : opts.itemSortFn;
		opts.groupFn = opts.groupFn === undefined ? SourceUtil.getFilterGroup : opts.groupFn;
		opts.selFn = opts.selFn === undefined ? PageFilter.defaultSourceSelFn : opts.selFn

		super(opts);

		this.__tmpState = {ixAdded: 0};
		this._tmpState = this._getProxy("tmpState", this.__tmpState);
	}

	doSetPillsClear () { return this._doSetPillsClear(); }

	addItem (item) {
		const out = super.addItem(item);
		this._tmpState.ixAdded++;
		return out;
	}

	removeItem (item) {
		const out = super.removeItem(item);
		this._tmpState.ixAdded--;
		return out;
	}

	_getHeaderControls_addExtraStateBtns (opts, wrpStateBtnsOuter) {
		const btnSupplements = e_({
			tag: "button",
			clazz: `btn btn-default w-100 ${opts.isMulti ? "btn-xxs" : "btn-xs"}`,
			title: `SHIFT to include UA/etc.`,
			html: `Core/Supplements`,
			click: evt => this._doSetPinsSupplements(evt.shiftKey),
		});

		const btnAdventures = e_({
			tag: "button",
			clazz: `btn btn-default w-100 ${opts.isMulti ? "btn-xxs" : "btn-xs"}`,
			title: `SHIFT to include UA/etc.`,
			html: `Adventures`,
			click: evt => this._doSetPinsAdventures(evt.shiftKey),
		});

		const btnHomebrew = e_({
			tag: "button",
			clazz: `btn btn-default w-100 ${opts.isMulti ? "btn-xxs" : "btn-xs"}`,
			html: `Homebrew`,
			click: () => this._doSetPinsHomebrew(),
		});

		const hkIsBrewActive = () => {
			const hasBrew = Object.keys(this.__state).some(src => SourceUtil.getFilterGroup(src) === 2);
			btnHomebrew.toggleClass("ve-hidden", !hasBrew);
		};
		this._addHook("tmpState", "ixAdded", hkIsBrewActive);
		hkIsBrewActive();

		const menu = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Select All Standard Sources",
				() => this._doSetPinsStandard(),
			),
			new ContextUtil.Action(
				"Select All Non-Standard Sources",
				() => this._doSetPinsNonStandard(),
			),
			new ContextUtil.Action(
				"Select All Homebrew Sources",
				() => this._doSetPinsHomebrew(),
			),
			null,
			new ContextUtil.Action(
				`Select "Vanilla" Sources`,
				() => this._doSetPinsVanilla(),
				{title: `Select a baseline set of sources suitable for any campaign.`},
			),
			null,
			new ContextUtil.Action(
				"Select SRD Sources",
				() => this._doSetPinsSrd(),
			),
			null,
			new ContextUtil.Action(
				"Invert Selection",
				() => this._doInvertPins(),
			),
		]);
		const btnBurger = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"}`,
			html: `<span class="glyphicon glyphicon-option-vertical"></span>`,
			click: evt => ContextUtil.pOpenMenu(evt, menu),
		});

		const btnOnlyPrimary = e_({
			tag: "button",
			clazz: `btn btn-default w-100 ${opts.isMulti ? "btn-xxs" : "btn-xs"}`,
			html: `Include References`,
			title: `Consider entities as belonging to every source they appear in (i.e. reprints) as well as their primary source`,
			click: () => this._meta.isIncludeOtherSources = !this._meta.isIncludeOtherSources,
		});
		const hkIsIncludeOtherSources = () => {
			btnOnlyPrimary.toggleClass("active", !!this._meta.isIncludeOtherSources);
		};
		hkIsIncludeOtherSources();
		this._addHook("meta", "isIncludeOtherSources", hkIsIncludeOtherSources);

		e_({
			tag: "div",
			clazz: `btn-group mr-2 w-100 flex-v-center mobile__m-1 mobile__mb-2`,
			children: [
				btnSupplements,
				btnAdventures,
				btnHomebrew,
				btnBurger,
				btnOnlyPrimary,
			],
		}).prependTo(wrpStateBtnsOuter);
	}

	_doSetPinsStandard () {
		Object.keys(this._state).forEach(k => this._state[k] = SourceUtil.getFilterGroup(k) === 0 ? 1 : 0);
	}

	_doSetPinsNonStandard () {
		Object.keys(this._state).forEach(k => this._state[k] = SourceUtil.getFilterGroup(k) === 1 ? 1 : 0);
	}

	_doSetPinsSupplements (isIncludeUnofficial) {
		Object.keys(this._state).forEach(k => this._state[k] = SourceUtil.isCoreOrSupplement(k) && (isIncludeUnofficial || !SourceUtil.isNonstandardSource(k)) ? 1 : 0);
	}

	_doSetPinsAdventures (isIncludeUnofficial) {
		Object.keys(this._state).forEach(k => this._state[k] = SourceUtil.isAdventure(k) && (isIncludeUnofficial || !SourceUtil.isNonstandardSource(k)) ? 1 : 0);
	}

	_doSetPinsHomebrew () {
		Object.keys(this._state).forEach(k => this._state[k] = SourceUtil.getFilterGroup(k) === 2 ? 1 : 0);
	}

	_doSetPinsVanilla () {
		Object.keys(this._state).forEach(k => this._state[k] = Parser.SOURCES_VANILLA.has(k) ? 1 : 0);
	}

	_doSetPinsSrd () {
		SourceFilter._SRD_SOURCES = SourceFilter._SRD_SOURCES || new Set([SRC_PHB, SRC_MM, SRC_DMG]);

		Object.keys(this._state).forEach(k => this._state[k] = SourceFilter._SRD_SOURCES.has(k) ? 1 : 0);

		const srdFilter = this._filterBox.filters.find(it => it.isSrdFilter);
		if (!srdFilter) return;
		srdFilter.setValue("SRD", 1);
	}

	static getCompleteFilterSources (ent) {
		return ent.otherSources
			? [ent.source].concat(ent.otherSources.map(src => new SourceFilterItem({item: src.source, isIgnoreRed: true, isOtherSource: true})))
			: ent.source;
	}

	_doRenderPills_doRenderWrpGroup_getHrDivider (group) {
		if (group !== 1) return super._doRenderPills_doRenderWrpGroup_getHrDivider(group);

		let dates = [];
		const comp = BaseComponent.fromObject({
			min: 0,
			max: 0,
			curMin: 0,
			curMax: 0,
		});

		const wrpSlider = new ComponentUiUtil.RangeSlider({
			comp,
			propMin: "min",
			propMax: "max",
			propCurMin: "curMin",
			propCurMax: "curMax",
			fnDisplay: val => dates[val]?.str,
		}).get();

		const wrpWrpSlider = e_({
			tag: "div",
			clazz: `"w-100 flex pt-2 pb-5 mb-2 mt-1 fltr-src__wrp-slider`,
			children: [
				wrpSlider,
			],
		}).hideVe();

		const btnCancel = e_({
			tag: "button",
			clazz: `btn btn-xs btn-default px-1`,
			html: "Cancel",
			click: () => {
				grpBtnsInactive.showVe();
				wrpWrpSlider.hideVe();
				grpBtnsActive.hideVe();
			},
		});

		const btnConfirm = e_({
			tag: "button",
			clazz: `btn btn-xs btn-default px-1`,
			html: "Confirm",
			click: () => {
				grpBtnsInactive.showVe();
				wrpWrpSlider.hideVe();
				grpBtnsActive.hideVe();

				const min = comp._state.curMin;
				const max = comp._state.curMax;

				const allowedDateSet = new Set(dates.slice(min, max + 1).map(it => it.str));
				const nxtState = {};
				Object.keys(this._state)
					.filter(k => SourceUtil.isNonstandardSource(k))
					.forEach(k => {
						const sourceDate = Parser.sourceJsonToDate(k);
						nxtState[k] = allowedDateSet.has(sourceDate) ? 1 : 0
					});
				this._proxyAssign("state", "_state", "__state", nxtState);
			},
		});

		const btnShowSlider = e_({
			tag: "button",
			clazz: `btn btn-xxs btn-default px-1`,
			html: "Select by Date",
			click: () => {
				grpBtnsInactive.hideVe();
				wrpWrpSlider.showVe();
				grpBtnsActive.showVe();

				dates = Object.keys(this._state)
					.filter(it => SourceUtil.isNonstandardSource(it))
					.map(it => Parser.sourceJsonToDate(it))
					.filter(Boolean)
					.unique()
					.map(it => ({str: it, date: new Date(it)}))
					.sort((a, b) => SortUtil.ascSortDate(a.date, b.date))
					.reverse();

				comp._proxyAssignSimple(
					"state",
					{
						min: 0,
						max: dates.length - 1,
						curMin: 0,
						curMax: dates.length - 1,
					},
				);
			},
		});

		const btnClear = e_({
			tag: "button",
			clazz: `btn btn-xxs btn-default px-1`,
			html: "Clear",
			click: () => {
				const nxtState = {};
				Object.keys(this._state)
					.filter(k => SourceUtil.isNonstandardSource(k))
					.forEach(k => nxtState[k] = 0);
				this._proxyAssign("state", "_state", "__state", nxtState);
			},
		});

		const grpBtnsActive = e_({
			tag: "div",
			clazz: `flex-v-center btn-group`,
			children: [
				btnCancel,
				btnConfirm,
			],
		}).hideVe();

		const grpBtnsInactive = e_({
			tag: "div",
			clazz: `flex-v-center btn-group`,
			children: [
				btnClear,
				btnShowSlider,
			],
		});

		return e_({
			tag: "div",
			clazz: `flex-col w-100`,
			children: [
				super._doRenderPills_doRenderWrpGroup_getHrDivider(),
				e_({
					tag: "div",
					clazz: `mb-1 flex-h-right`,
					children: [
						grpBtnsActive,
						grpBtnsInactive,
					],
				}),
				wrpWrpSlider,
			],
		});
	}

	_toDisplay_getMappedEntryVal (entryVal) {
		entryVal = super._toDisplay_getMappedEntryVal(entryVal);
		if (!this._meta.isIncludeOtherSources) entryVal = entryVal.filter(it => !it.isOtherSource);
		return entryVal;
	}

	getSources () {
		const out = {
			all: [],
			official: [],
			unofficial: [],
			homebrew: [],
		};
		this._items.forEach(it => {
			out.all.push(it.item);
			switch (this._groupFn(it)) {
				case 0: out.official.push(it.item); break;
				case 1: out.unofficial.push(it.item); break;
				case 2: out.homebrew.push(it.item); break;
			}
		});
		return out;
	}

	getDefaultMeta () {
		// Key order is important, as @filter tags depend on it
		return {
			...super.getDefaultMeta(),
			...SourceFilter._DEFAULT_META,
		};
	}
}
SourceFilter._DEFAULT_META = {
	isIncludeOtherSources: false,
}
SourceFilter._SRD_SOURCES = null;

class RangeFilter extends FilterBase {
	/**
	 * @param opts Options object.
	 * @param opts.header Filter header (name)
	 * @param [opts.headerHelp] Filter header help text (tooltip)
	 * @param [opts.min] Minimum slider value.
	 * @param [opts.max] Maximum slider value.
	 * @param [opts.isSparse] If this slider should only display known values, rather than a continual range.
	 * @param [opts.isLabelled] If this slider has labels.
	 * @param [opts.labels] Initial labels to populate this filter with.
	 * @param [opts.isAllowGreater] If this slider should allow all items greater than its max.
	 * @param [opts.isRequireFullRangeMatch] If range values, e.g. `[1, 5]`, must be entirely within the slider's
	 * selected range in order to be produce a positive `toDisplay` result.
	 * @param [opts.suffix] Suffix to add to number displayed above slider.
	 * @param [opts.labelSortFn] Function used to sort labels if new labels are added. Defaults to ascending alphabetical.
	 * @param [opts.labelDisplayFn] Function which converts a label to a display value.
	 * @param [opts.displayFn] Function which converts a (non-label) value to a display value.
	 * @param [opts.displayFnTooltip] Function which converts a (non-label) value to a tooltip display value.
	 */
	constructor (opts) {
		super(opts);

		if (opts.labels && opts.min == null) opts.min = 0;
		if (opts.labels && opts.max == null) opts.max = opts.labels.length - 1;

		this._min = Number(opts.min || 0);
		this._max = Number(opts.max || 0);
		this._hasPredefinedMin = opts.min != null;
		this._hasPredefinedMax = opts.max != null;
		this._labels = opts.isLabelled ? opts.labels : null;
		this._isAllowGreater = !!opts.isAllowGreater;
		this._isRequireFullRangeMatch = !!opts.isRequireFullRangeMatch;
		this._sparseValues = opts.isSparse ? [] : null;
		this._suffix = opts.suffix;
		this._labelSortFn = opts.labelSortFn === undefined ? SortUtil.ascSort : opts.labelSortFn;
		this._labelDisplayFn = opts.labelDisplayFn;
		this._displayFn = opts.displayFn;
		this._displayFnTooltip = opts.displayFnTooltip;

		this._filterBox = null;
		Object.assign(
			this.__state,
			{
				min: this._min,
				max: this._max,
				curMin: this._min,
				curMax: this._max,
			},
		);
		this.__$wrpFilter = null;
		this.__$wrpMini = null;
		this._slider = null;

		this._labelSearchCache = null;

		this._$btnMiniGt = null;
		this._$btnMiniLt = null;
		this._$btnMiniEq = null;
	}

	set isUseDropdowns (val) { this._meta.isUseDropdowns = !!val; }

	getSaveableState () {
		return {
			[this.header]: {
				...this.getBaseSaveableState(),
				state: {...this.__state},
			},
		};
	}

	setStateFromLoaded (filterState) {
		if (filterState && filterState[this.header]) {
			const toLoad = filterState[this.header];

			// region Ensure the provided min/max are a lower/upper bounds for the range to be set
			if (this._hasPredefinedMax) {
				const tgt = (toLoad.state || {});

				if (tgt.max == null) tgt.max = this._max;
				else if (tgt.max > this._max) tgt.max = this._max;

				if (tgt.curMax == null) tgt.curMax = tgt.max;
				else if (tgt.curMax > tgt.max) tgt.curMax = tgt.max;
			}

			if (this._hasPredefinedMin) {
				const tgt = (toLoad.state || {});

				if (tgt.min == null) tgt.min = this._min;
				else if (tgt.min < this._min) tgt.min = this._min;

				if (tgt.curMin == null) tgt.curMin = tgt.min;
				else if (tgt.curMin < tgt.min) tgt.curMin = tgt.min;
			}
			// endregion

			this.setBaseStateFromLoaded(toLoad);

			// Reduce the maximum/minimum ranges to their current values +/-1
			//   This allows the range filter to recover from being stretched out by homebrew
			//   The off-by-one trick is to prevent later filter expansion from assuming the filters are set to their min/max
			if (toLoad.state && !this._labels) {
				if (!this._hasPredefinedMax && toLoad.state.curMax != null && toLoad.state.max != null) {
					if (toLoad.state.curMax + 1 < toLoad.state.max) toLoad.state.max = toLoad.state.curMax + 1;
				}

				if (!this._hasPredefinedMin && toLoad.state.curMin != null && toLoad.state.min != null) {
					if (toLoad.state.curMin - 1 > toLoad.state.min) toLoad.state.min = toLoad.state.curMin - 1;
				}
			}

			Object.assign(this._state, toLoad.state);
		}
	}

	getSubHashes () {
		const out = [];

		const baseMeta = this.getMetaSubHashes();
		if (baseMeta) out.push(...baseMeta);

		const serSliderState = [
			this._state.min !== this._state.curMin ? `min=${this._state.curMin}` : null,
			this._state.max !== this._state.curMax ? `max=${this._state.curMax}` : null,
		].filter(Boolean);
		if (serSliderState.length) {
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("state", this.header), serSliderState));
		}

		return out.length ? out : null;
	}

	setFromSubHashState (state) {
		this.setMetaFromSubHashState(state);

		let hasState = false;

		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			if (prop === "state") {
				hasState = true;
				vals.forEach(v => {
					const [prop, val] = v.split("=");
					if (val.startsWith("&") && !this._labels) throw new Error(`Could not dereference label: "${val}"`);

					let num;
					if (val.startsWith("&")) { // prefixed with "&" for "address (index) of..."
						const clean = val.replace("&", "").toLowerCase();
						num = this._labels.findIndex(it => String(it).toLowerCase() === clean);
						if (!~num) throw new Error(`Could not find index for label "${clean}"`);
					} else num = Number(val);

					switch (prop) {
						case "min":
							if (num < this._state.min) this._state.min = num;
							this._state.curMin = Math.max(this._state.min, num);
							break;
						case "max":
							if (num > this._state.max) this._state.max = num;
							this._state.curMax = Math.min(this._state.max, num);
							break;
						default: throw new Error(`Unknown prop "${prop}"`);
					}
				});
			}
		});

		if (!hasState) this.reset();
	}

	setFromValues (values) {
		if (values[this.header]) {
			const vals = values[this.header];

			if (vals.min != null) this._state.curMin = Math.max(this._state.min, vals.min);
			else this._state.curMin = this._state.min;

			if (vals.max != null) this._state.curMax = Math.max(this._state.max, vals.max);
			else this._state.curMax = this._state.max;
		}
	}

	_$getHeaderControls () {
		const $btnForceMobile = ComponentUiUtil.$getBtnBool(
			this,
			"isUseDropdowns",
			{
				$ele: $(`<button class="btn btn-default btn-xs mr-2">Show as Dropdowns</button>`),
				stateName: "meta",
				stateProp: "_meta",
			},
		);
		const $btnReset = $(`<button class="btn btn-default btn-xs">Reset</button>`).click(() => this.reset());
		const $wrpBtns = $$`<div>${$btnForceMobile}${$btnReset}</div>`;

		const $wrpSummary = $(`<div class="flex-v-center fltr__summary_item fltr__summary_item--include"></div>`).hideVe();

		const $btnShowHide = $(`<button class="btn btn-default btn-xs ml-2 ${this._meta.isHidden ? "active" : ""}">Hide</button>`)
			.click(() => this._meta.isHidden = !this._meta.isHidden);
		const hkIsHidden = () => {
			$btnShowHide.toggleClass("active", this._meta.isHidden);
			$wrpBtns.toggleVe(!this._meta.isHidden);
			$wrpSummary.toggleVe(this._meta.isHidden);

			// render summary
			const cur = this.getValues()[this.header];

			const isRange = !cur.isMinVal && !cur.isMaxVal;
			const isCapped = !cur.isMinVal || !cur.isMaxVal;

			$wrpSummary
				.title(isRange ? `Hidden range` : isCapped ? `Hidden limit` : "")
				.text(isRange ? `${this._getDisplayText(cur.min)}-${this._getDisplayText(cur.max)}` : !cur.isMinVal ? `≥ ${this._getDisplayText(cur.min)}` : !cur.isMaxVal ? `≤ ${this._getDisplayText(cur.max)}` : "")
		};
		this._addHook("meta", "isHidden", hkIsHidden);
		hkIsHidden();

		return $$`
		<div class="flex-v-center">
			${$wrpBtns}
			${$wrpSummary}
			${$btnShowHide}
		</div>`;
	}

	_getDisplayText (value, {isBeyondMax = false, isTooltip = false} = {}) {
		value = `${this._labels ? this._labelDisplayFn ? this._labelDisplayFn(value) : value : (isTooltip && this._displayFnTooltip) ? this._displayFnTooltip(value) : this._displayFn ? this._displayFn(value) : value}${isBeyondMax ? "+" : ""}`;
		if (this._suffix) value += this._suffix;
		return value;
	}

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$render (opts) {
		this._filterBox = opts.filterBox;
		this.__$wrpMini = opts.$wrpMini;

		const $wrpControls = opts.isMulti ? null : this._$getHeaderControls();

		const $wrpSlider = $$`<div class="fltr__wrp-pills fltr__wrp-pills--flex"></div>`;
		const $wrpDropdowns = $$`<div class="fltr__wrp-pills fltr__wrp-pills--flex"></div>`;
		const hookHidden = () => {
			$wrpSlider.toggleVe(!this._meta.isHidden && !this._meta.isUseDropdowns);
			$wrpDropdowns.toggleVe(!this._meta.isHidden && !!this._meta.isUseDropdowns);
		};
		this._addHook("meta", "isHidden", hookHidden);
		this._addHook("meta", "isUseDropdowns", hookHidden);
		hookHidden();

		// region Slider
		// prepare slider options
		const getSliderOpts = () => {
			const fnDisplay = (val, {isTooltip = false} = {}) => {
				let out;

				if (this._labels) {
					if (this._labelSortFn) this._labels.sort(this._labelSortFn);

					const labels = this._labelDisplayFn ? this._labels.map(it => this._labelDisplayFn(it)) : this._labels;

					out = labels[val] ?? val;
				} else {
					out = this._getDisplayText(val, {isBeyondMax: this._isAllowGreater && val === this._state.max, isTooltip});
				}

				return out;
			};

			return {
				propMin: "min",
				propMax: "max",
				propCurMin: "curMin",
				propCurMax: "curMax",
				fnDisplay: (val) => fnDisplay(val),
				fnDisplayTooltip: (val) => fnDisplay(val, {isTooltip: true}),
				sparseValues: this._sparseValues,
			};
		};

		const hkUpdateLabelSearchCache = () => {
			if (this._labels) return this._doUpdateLabelSearchCache();
			this._labelSearchCache = null;
		};
		this._addHook("state", "curMin", hkUpdateLabelSearchCache);
		this._addHook("state", "curMax", hkUpdateLabelSearchCache);
		hkUpdateLabelSearchCache();

		this._slider = new ComponentUiUtil.RangeSlider({comp: this, ...getSliderOpts()})
		$wrpSlider.append(this._slider.get());
		// endregion

		// region Dropdowns
		const selMin = e_({
			tag: "select",
			clazz: `form-control mr-2`,
			change: () => {
				const nxtMin = Number(selMin.val());
				const [min, max] = [nxtMin, this._state.curMax].sort(SortUtil.ascSort);
				this._state.curMin = min;
				this._state.curMax = max;
			},
		});
		const selMax = e_({
			tag: "select",
			clazz: `form-control`,
			change: () => {
				const nxMax = Number(selMax.val());
				const [min, max] = [this._state.curMin, nxMax].sort(SortUtil.ascSort);
				this._state.curMin = min;
				this._state.curMax = max;
			},
		});
		$$`<div class="flex-v-center w-100 px-3 py-1">${selMin}${selMax}</div>`.appendTo($wrpDropdowns);
		// endregion

		const handleCurUpdate = () => {
			// Dropdowns
			selMin.val(`${this._state.curMin}`);
			selMax.val(`${this._state.curMax}`);
		};

		const handleLimitUpdate = () => {
			// Dropdowns
			this._doPopulateDropdown(selMin, this._state.curMin);
			this._doPopulateDropdown(selMax, this._state.curMax);
		};

		this._addHook("state", "min", handleLimitUpdate);
		this._addHook("state", "max", handleLimitUpdate);
		this._addHook("state", "curMin", handleCurUpdate);
		this._addHook("state", "curMax", handleCurUpdate);
		handleCurUpdate();
		handleLimitUpdate();

		if (opts.isMulti) {
			this._slider.get().classList.add("ve-grow");
			$wrpSlider.addClass("ve-grow");
			$wrpDropdowns.addClass("ve-grow");

			return this.__$wrpFilter = $$`<div class="flex">
				<div class="fltr__range-inline-label">${this._getRenderedHeader()}</div>
				${$wrpSlider}
				${$wrpDropdowns}
			</div>`;
		} else {
			const btnMobToggleControls = this._getBtnMobToggleControls($wrpControls);

			return this.__$wrpFilter = $$`<div class="flex-col">
				${opts.isFirst ? "" : `<div class="fltr__dropdown-divider mb-1"></div>`}
				<div class="split fltr__h ${this._minimalUi ? "fltr__minimal-hide" : ""} mb-1">
					<div class="fltr__h-text flex-h-center">${this._getRenderedHeader()}${btnMobToggleControls}</div>
					${$wrpControls}
				</div>
				${$wrpSlider}
				${$wrpDropdowns}
			</div>`;
		}
	}

	$renderMinis (opts) {
		this._filterBox = opts.filterBox;
		this.__$wrpMini = opts.$wrpMini;

		// region Mini pills
		this._$btnMiniGt = this._$btnMiniGt || $(`<div class="fltr__mini-pill" state="ignore"></div>`)
			.click(() => {
				this._state.curMin = this._state.min;
				this._filterBox.fireChangeEvent();
			});
		this._$btnMiniGt.appendTo(this.__$wrpMini);

		this._$btnMiniLt = this._$btnMiniLt || $(`<div class="fltr__mini-pill" state="ignore"></div>`)
			.click(() => {
				this._state.curMax = this._state.max;
				this._filterBox.fireChangeEvent();
			});
		this._$btnMiniLt.appendTo(this.__$wrpMini);

		this._$btnMiniEq = this._$btnMiniEq || $(`<div class="fltr__mini-pill" state="ignore"></div>`)
			.click(() => {
				this._state.curMin = this._state.min;
				this._state.curMax = this._state.max;
				this._filterBox.fireChangeEvent();
			});
		this._$btnMiniEq.appendTo(this.__$wrpMini);

		const hideHook = () => {
			const isHidden = this._filterBox.isMinisHidden(this.header);
			this._$btnMiniGt.toggleClass("ve-hidden", isHidden);
			this._$btnMiniLt.toggleClass("ve-hidden", isHidden);
			this._$btnMiniEq.toggleClass("ve-hidden", isHidden);
		};
		this._filterBox.registerMinisHiddenHook(this.header, hideHook);
		hideHook();

		const handleMiniUpdate = () => {
			if (this._state.curMin === this._state.curMax) {
				this._$btnMiniGt.attr("state", FilterBox._PILL_STATES[0]);
				this._$btnMiniLt.attr("state", FilterBox._PILL_STATES[0]);

				this._$btnMiniEq
					.attr("state", this._state.min === this._state.curMin && this._state.max === this._state.curMax ? FilterBox._PILL_STATES[0] : FilterBox._PILL_STATES[1])
					.text(`${this.header} = ${this._labels ? this._labels[this._state.curMin] : this._state.curMin}`);
			} else {
				if (this._state.min !== this._state.curMin) {
					this._$btnMiniGt.attr("state", FilterBox._PILL_STATES[1])
						.text(`${this.header} ≥ ${this._labels ? this._labels[this._state.curMin] : this._state.curMin}${this._suffix || ""}`);
				} else this._$btnMiniGt.attr("state", FilterBox._PILL_STATES[0]);

				if (this._state.max !== this._state.curMax) {
					this._$btnMiniLt.attr("state", FilterBox._PILL_STATES[1])
						.text(`${this.header} ≤ ${this._labels ? this._labels[this._state.curMax] : this._state.curMax}${this._suffix || ""}`);
				} else this._$btnMiniLt.attr("state", FilterBox._PILL_STATES[0]);

				this._$btnMiniEq.attr("state", FilterBox._PILL_STATES[0]);
			}
		};
		// endregion

		const handleCurUpdate = () => {
			handleMiniUpdate();
		};

		const handleLimitUpdate = () => {
			handleMiniUpdate();
		};

		this._addHook("state", "min", handleLimitUpdate);
		this._addHook("state", "max", handleLimitUpdate);
		this._addHook("state", "curMin", handleCurUpdate);
		this._addHook("state", "curMax", handleCurUpdate);
		handleCurUpdate();
		handleLimitUpdate();
	}

	_doPopulateDropdown (sel, curVal) {
		let tmp = "";
		for (let i = 0, len = this._state.max - this._state.min + 1; i < len; ++i) {
			const val = i + this._state.min;
			const label = this._labels ? `${this._labels[i]}`.qq() : val;
			tmp += `<option value="${val}" ${curVal === val ? "selected" : ""}>${label}</option>`;
		}
		sel.innerHTML = tmp;
		return sel;
	}

	getValues () {
		const out = {
			isMaxVal: this._state.max === this._state.curMax,
			isMinVal: this._state.min === this._state.curMin,
			max: this._state.curMax,
			min: this._state.curMin,
		};
		out._isActive = !(out.isMinVal && out.isMaxVal);
		return {[this.header]: out};
	}

	reset (isResetAll) {
		if (isResetAll) this.resetBase();
		this._state.curMin = this._state.min;
		this._state.curMax = this._state.max;
	}

	resetShallow (isResetAll) { return this.reset(); }

	update () {
		// (labels will be automatically updated by the slider handlers)
		// always render the mini-pills, to ensure the overall order in the grid stays correct (shared between multiple filters)
		if (this._$btnMiniGt) this.__$wrpMini.append(this._$btnMiniGt);
		if (this._$btnMiniLt) this.__$wrpMini.append(this._$btnMiniLt);
		if (this._$btnMiniEq) this.__$wrpMini.append(this._$btnMiniEq);
	}

	toDisplay (boxState, entryVal) {
		const filterState = boxState[this.header];
		if (!filterState) return true; // discount any filters which were not rendered

		// match everything if filter is set to complete range
		if (entryVal == null) return filterState.min === this._state.min && filterState.max === this._state.max;

		if (this._labels) {
			const slice = this._labels.slice(filterState.min, filterState.max + 1);
			if (entryVal instanceof Array) return !!entryVal.find(it => slice.includes(it));
			return slice.includes(entryVal);
		} else {
			if (entryVal instanceof Array) {
				// If we require a full match on the range, take the lowest/highest input and test them against our min/max
				if (this._isRequireFullRangeMatch) return filterState.min <= entryVal[0] && filterState.max >= entryVal.last();

				// Otherwise, If any of the item's values are in the range, return true
				return entryVal.some(ev => this._toDisplay_isToDisplayEntry(filterState, ev));
			}
			return this._toDisplay_isToDisplayEntry(filterState, entryVal);
		}
	}

	_toDisplay_isToDisplayEntry (filterState, ev) {
		const isGtMin = filterState.min <= ev;
		const isLtMax = filterState.max >= ev;
		if (this._isAllowGreater) return isGtMin && (isLtMax || filterState.max === this._state.max);
		return isGtMin && isLtMax;
	}

	addItem (item) {
		if (item == null) return;
		if (item instanceof Array) return item.forEach(it => this.addItem(it));

		if (this._labels) {
			if (!this._labels.some(it => it === item)) this._labels.push(item);

			this._doUpdateLabelSearchCache();

			// Fake an update to trigger label handling
			this._addItem_addNumber(this._labels.length - 1);
		} else {
			this._addItem_addNumber(item);
		}

		/* FIXME remove
		else if (this._sparseValues) {
			if (!this._sparseValues.some(it => it === item)) this._sparseValues.push(item);

			this._doUpdateLabelSearchCache();

			// Fake an update to trigger label handling
			this._addItem_addNumber(this._sparseValues.length - 1);
		}

		 */
	}

	_doUpdateLabelSearchCache () {
		this._labelSearchCache = [...new Array(Math.max(0, this._max - this._min))]
			.map((_, i) => i + this._min)
			.map(val => this._getDisplayText(val, {isBeyondMax: this._isAllowGreater && val === this._state.max, isTooltip: true}))
			.join(" -- ")
			.toLowerCase();
	}

	_addItem_addNumber (number) {
		if (number == null || isNaN(number)) return;

		if (this._sparseValues && !this._sparseValues.includes(number)) {
			this._sparseValues.push(number);
			this._sparseValues.sort(SortUtil.ascSort);
			// TODO might need to trigger some update here?
		}

		if (number >= this._state.min && number <= this._state.max) return; // it's already in the range
		if (this._state.min == null && this._state.max == null) this._state.min = this._state.max = number;
		else {
			const old = {...this.__state};

			if (number < old.min) this._state.min = number;
			if (number > old.max) this._state.max = number;

			// if the slider was previously at the full extent of its range, maintain this
			if (old.curMin === old.min) this._state.curMin = this._state.min;
			if (old.curMax === old.max) this._state.curMax = this._state.max;
		}
	}

	getDefaultMeta () {
		const out = {...RangeFilter._DEFAULT_META, ...super.getDefaultMeta()};
		if (Renderer.hover.isSmallScreen()) out.isUseDropdowns = true;
		return out;
	}

	handleSearch (searchTerm) {
		if (this.__$wrpFilter == null) return;

		const isVisible = this.header.toLowerCase().includes(searchTerm)
			|| (this._labelSearchCache != null
				? this._labelSearchCache.includes(searchTerm)
				: [...new Array(this._state.max - this._state.min)].map((_, n) => n + this._state.min).join(" -- ").includes(searchTerm));

		this.__$wrpFilter.toggleClass("fltr__hidden--search", !isVisible);

		return isVisible;
	}
}
RangeFilter._DEFAULT_META = {
	isUseDropdowns: false,
};

class OptionsFilter extends FilterBase {
	/**
	 * A filter which has a selection of true/false options.
	 * @param opts
	 * @param opts.defaultState The default options.
	 * @param opts.displayFn Display function which maps an option key to a user-friendly value.
	 * @param [opts.displayFnMini] As per `displayFn`, but used for mini pills.
	 */
	constructor (opts) {
		super(opts);
		this._defaultState = opts.defaultState;
		this._displayFn = opts.displayFn;
		this._displayFnMini = opts.displayFnMini;

		Object.assign(
			this.__state,
			MiscUtil.copy(opts.defaultState),
		);

		this._filterBox = null;
		this.__$wrpMini = null;
	}

	getSaveableState () {
		return {
			[this.header]: {
				...this.getBaseSaveableState(),
				state: {...this.__state},
			},
		};
	}

	setStateFromLoaded (filterState) {
		if (!filterState || !filterState[this.header]) return;

		const toLoad = filterState[this.header];

		this.setBaseStateFromLoaded(toLoad);

		const toAssign = {};
		Object.keys(this._defaultState).forEach(k => {
			if (toLoad.state[k] == null) return;
			if (typeof toLoad.state[k] !== typeof this._defaultState[k]) return; // Sanity check
			toAssign[k] = toLoad.state[k];
		});

		Object.assign(this._state, toAssign);
	}

	getSubHashes () {
		const out = [];

		const baseMeta = this.getMetaSubHashes();
		if (baseMeta) out.push(...baseMeta);

		const serOptionState = [];
		Object.entries(this._defaultState)
			.forEach(([k, vDefault]) => {
				if (this._state[k] !== vDefault) serOptionState.push(`${k.toLowerCase()}=${UrlUtil.mini.compress(this._state[k])}`);
			});
		if (serOptionState.length) {
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("state", this.header), serOptionState));
		}

		return out.length ? out : null;
	}

	setFromSubHashState (state) {
		this.setMetaFromSubHashState(state);

		let hasState = false;

		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			if (prop !== "state") return;

			hasState = true;
			vals.forEach(v => {
				const [prop, valCompressed] = v.split("=");
				const val = UrlUtil.mini.decompress(valCompressed);

				const casedProp = Object.keys(this._defaultState).find(k => k.toLowerCase() === prop);
				if (!casedProp) return;

				if (this._defaultState[casedProp] != null && typeof val === typeof this._defaultState[casedProp]) this._state[casedProp] = val;
			});
		});

		if (!hasState) this.reset();
	}

	setFromValues (values) {
		if (!values[this.header]) return;
		const vals = values[this.header];
		Object.entries(vals).forEach(([k, v]) => {
			if (this._defaultState[k] && typeof this._defaultState[k] === typeof v) this._state[k] = v;
		});
	}

	setValue (k, v) { this._state[k] = v; }

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$render (opts) {
		this._filterBox = opts.filterBox;
		this.__$wrpMini = opts.$wrpMini;

		const $wrpControls = opts.isMulti ? null : this._$getHeaderControls();

		const $btns = Object.keys(this._defaultState)
			.map(k => this._$render_$getPill(k));
		const $wrpButtons = $$`<div>${$btns}</div>`;

		if (opts.isMulti) {
			return this.__$wrpFilter = $$`<div class="flex">
				<div class="fltr__range-inline-label">${this._getRenderedHeader()}</div>
				${$wrpButtons}
			</div>`;
		} else {
			return this.__$wrpFilter = $$`<div class="flex-col">
				${opts.isFirst ? "" : `<div class="fltr__dropdown-divider mb-1"></div>`}
				<div class="split fltr__h ${this._minimalUi ? "fltr__minimal-hide" : ""} mb-1">
					<div class="fltr__h-text flex-h-center">${this._getRenderedHeader()}</div>
					${$wrpControls}
				</div>
				${$wrpButtons}
			</div>`;
		}
	}

	$renderMinis (opts) {
		this._filterBox = opts.filterBox;
		this.__$wrpMini = opts.$wrpMini;

		const $btnsMini = Object.keys(this._defaultState)
			.map(k => this._$render_$getMiniPill(k));
		$btnsMini.forEach($btn => $btn.appendTo(this.__$wrpMini));
	}

	_$render_$getPill (key) {
		const displayText = this._displayFn(key);

		const $btnPill = $(`<div class="fltr__pill">${displayText}</div>`)
			.click(() => {
				this._state[key] = !this._state[key];
			})
			.contextmenu((evt) => {
				evt.preventDefault();
				this._state[key] = !this._state[key];
			});
		const hook = () => {
			const val = FilterBox._PILL_STATES[this._state[key] ? 1 : 2];
			$btnPill.attr("state", val);
		};
		this._addHook("state", key, hook);
		hook();

		return $btnPill;
	}

	_$render_$getMiniPill (key) {
		const displayTextFull = this._displayFnMini ? this._displayFn(key) : null;
		const displayText = this._displayFnMini ? this._displayFnMini(key) : this._displayFn(key);

		const $btnMini = $(`<div class="fltr__mini-pill ${this._filterBox.isMinisHidden(this.header) ? "ve-hidden" : ""}" state="${FilterBox._PILL_STATES[this._defaultState[key] === this._state[key] ? 0 : this._state[key] ? 1 : 2]}">${displayText}</div>`)
			.title(`${displayTextFull ? `${displayTextFull} (` : ""}Filter: ${this.header}${displayTextFull ? ")" : ""}`)
			.click(() => {
				this._state[key] = this._defaultState[key];
				this._filterBox.fireChangeEvent();
			});

		const hook = () => $btnMini.attr("state", FilterBox._PILL_STATES[this._defaultState[key] === this._state[key] ? 0 : this._state[key] ? 1 : 2]);
		this._addHook("state", key, hook);

		const hideHook = () => $btnMini.toggleClass("ve-hidden", this._filterBox.isMinisHidden(this.header));
		this._filterBox.registerMinisHiddenHook(this.header, hideHook);

		return $btnMini;
	}

	_$getHeaderControls () {
		const $btnReset = $(`<button class="btn btn-default btn-xs">Reset</button>`).click(() => this.reset());
		const $wrpBtns = $$`<div class="flex-v-center">${$btnReset}</div>`;

		const $wrpSummary = $(`<div class="flex-v-center fltr__summary_item fltr__summary_item--include"></div>`).hideVe();

		const $btnShowHide = $(`<button class="btn btn-default btn-xs ml-2 ${this._meta.isHidden ? "active" : ""}">Hide</button>`)
			.click(() => this._meta.isHidden = !this._meta.isHidden);
		const hkIsHidden = () => {
			$btnShowHide.toggleClass("active", this._meta.isHidden);
			$wrpBtns.toggleVe(!this._meta.isHidden);
			$wrpSummary.toggleVe(this._meta.isHidden);

			// render summary
			const cntNonDefault = Object.entries(this._defaultState).filter(([k, v]) => this._state[k] != null && this._state[k] !== v).length;

			$wrpSummary
				.title(`${cntNonDefault} non-default option${cntNonDefault === 1 ? "" : "s"} selected`)
				.text(cntNonDefault)
		};
		this._addHook("meta", "isHidden", hkIsHidden);
		hkIsHidden();

		return $$`
		<div class="flex-v-center">
			${$wrpBtns}
			${$wrpSummary}
			${$btnShowHide}
		</div>`;
	}

	getValues () {
		const out = Object.entries(this._defaultState)
			.mergeMap(([k, v]) => ({[k]: this._state[k] == null ? v : this._state[k]}));
		out._isActive = Object.entries(this._defaultState).some(([k, v]) => this._state[k] != null && this._state[k] !== v);
		return {
			[this.header]: out,
		};
	}

	reset (isResetAll) {
		if (isResetAll) this.resetBase();
		this._proxyAssignSimple("state", MiscUtil.copy(this._defaultState));
	}

	resetShallow (isResetAll) { return this.reset(); }

	update () { /* No-op */ }

	toDisplay (boxState, entryVal) {
		const filterState = boxState[this.header];
		if (!filterState) return true; // discount any filters which were not rendered

		if (entryVal == null) return true; // Never filter if a null object, i.e. "no data," is passed in

		// If an object has a relevant value, display if the incoming value matches our state.
		return Object.entries(entryVal)
			.every(([k, v]) => this._state[k] === v);
	}

	getDefaultMeta () {
		return {...OptionsFilter._DEFAULT_META, ...super.getDefaultMeta()}
	}

	handleSearch (searchTerm) {
		if (this.__$wrpFilter == null) return;

		const isVisible = this.header.toLowerCase().includes(searchTerm)
			|| Object.keys(this._defaultState).map(it => this._displayFn(it).toLowerCase()).some(it => it.includes(searchTerm));

		this.__$wrpFilter.toggleClass("fltr__hidden--search", !isVisible);

		return isVisible;
	}
}
OptionsFilter._DEFAULT_META = {};

class MultiFilter extends FilterBase {
	constructor (opts) {
		super(opts);
		this._filters = opts.filters;
		this._isAddDropdownToggle = !!opts.isAddDropdownToggle;

		Object.assign(
			this.__state,
			{
				...MultiFilter._DETAULT_STATE,
				mode: opts.mode || MultiFilter._DETAULT_STATE.mode,
			},
		);
		this._defaultState = MiscUtil.copy(this.__state);
		this._state = this._getProxy("state", this.__state);

		this.__$wrpFilter = null;
		this._$wrpChildren = null;
	}

	getChildFilters () {
		return [...this._filters, ...this._filters.map(f => f.getChildFilters())].flat();
	}

	getSaveableState () {
		const out = {
			[this.header]: {
				...this.getBaseSaveableState(),
				state: {...this.__state},
			},
		};
		this._filters.forEach(it => Object.assign(out, it.getSaveableState()));
		return out;
	}

	setStateFromLoaded (filterState) {
		if (filterState && filterState[this.header]) {
			const toLoad = filterState[this.header];
			this.setBaseStateFromLoaded(toLoad);
			Object.assign(this._state, toLoad.state);
			this._filters.forEach(it => it.setStateFromLoaded(filterState));
		}
	}

	getSubHashes () {
		const out = [];

		const baseMeta = this.getMetaSubHashes();
		if (baseMeta) out.push(...baseMeta);

		const anyNotDefault = Object.keys(this._defaultState).find(k => this._state[k] !== this._defaultState[k]);
		if (anyNotDefault) {
			const serState = Object.keys(this._defaultState).map(k => UrlUtil.mini.compress(this._state[k] === undefined ? this._defaultState[k] : this._state[k]));
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("state", this.header), serState));
		}

		// each getSubHashes should return an array of arrays, or null
		// flatten any arrays of arrays into our array of arrays
		this._filters.map(it => it.getSubHashes()).filter(Boolean).forEach(it => out.push(...it));
		return out.length ? out : null;
	}

	setFromSubHashState (state) {
		this.setMetaFromSubHashState(state);

		let hasState = false;

		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			if (prop === "state") {
				hasState = true;
				const data = vals.map(v => UrlUtil.mini.decompress(v));
				Object.keys(this._defaultState).forEach((k, i) => this._state[k] = data[i]);
			}
		});

		if (!hasState) this._reset();
	}

	setFromValues (values) {
		this._filters.forEach(it => it.setFromValues(values));
	}

	_getHeaderControls (opts) {
		const wrpSummary = e_({
			tag: "div",
			clazz: "fltr__summary_item",
		}).hideVe();

		const btnForceMobile = this._isAddDropdownToggle ? ComponentUiUtil.getBtnBool(
			this,
			"isUseDropdowns",
			{
				$ele: $(`<button class="btn btn-default btn-xs ml-2">Show as Dropdowns</button>`),
				stateName: "meta",
				stateProp: "_meta",
			},
		) : null;
		// Propagate parent state to children
		const hkChildrenDropdowns = () => {
			this._filters
				.filter(it => it instanceof RangeFilter)
				.forEach(it => it.isUseDropdowns = this._meta.isUseDropdowns);
		};
		this._addHook("meta", "isUseDropdowns", hkChildrenDropdowns);
		hkChildrenDropdowns();

		const btnResetAll = e_({
			tag: "button",
			clazz: "btn btn-default btn-xs ml-2",
			text: "Reset All",
			click: () => this._filters.forEach(it => it.reset()),
		});

		const wrpBtns = e_({tag: "div", clazz: "flex", children: [btnForceMobile, btnResetAll].filter(Boolean)});
		this._getHeaderControls_addExtraStateBtns(opts, wrpBtns);

		const btnShowHide = e_({
			tag: "button",
			clazz: `btn btn-default btn-xs ml-2 ${this._meta.isHidden ? "active" : ""}`,
			text: "Hide",
			click: () => this._meta.isHidden = !this._meta.isHidden,
		});
		const wrpControls = e_({tag: "div", clazz: "flex-v-center", children: [wrpSummary, wrpBtns, btnShowHide]});

		const hookShowHide = () => {
			wrpBtns.toggleVe(!this._meta.isHidden);
			btnShowHide.toggleClass("active", this._meta.isHidden);
			this._$wrpChildren.toggleVe(!this._meta.isHidden);
			wrpSummary.toggleVe(this._meta.isHidden);

			const numActive = this._filters.map(it => it.getValues()[it.header]._isActive).filter(Boolean).length;
			if (numActive) {
				e_({ele: wrpSummary, title: `${numActive} hidden active filter${numActive === 1 ? "" : "s"}`, text: `(${numActive})`});
			}
		};
		this._addHook("meta", "isHidden", hookShowHide);
		hookShowHide();

		return wrpControls;
	}

	_getHeaderControls_addExtraStateBtns (opts, wrpStateBtnsOuter) {}

	$render (opts) {
		const $btnAndOr = $(`<div class="fltr__group-comb-toggle ve-muted"></div>`)
			.click(() => this._state.mode = this._state.mode === "and" ? "or" : "and");
		const hookAndOr = () => $btnAndOr.text(`(group ${this._state.mode.toUpperCase()})`);
		this._addHook("state", "mode", hookAndOr);
		hookAndOr();

		const $children = this._filters.map((it, i) => it.$render({...opts, isMulti: true, isFirst: i === 0}));
		this._$wrpChildren = $$`<div>${$children}</div>`;

		const wrpControls = this._getHeaderControls(opts);

		return this.__$wrpFilter = $$`<div class="flex-col">
			${opts.isFirst ? "" : `<div class="fltr__dropdown-divider mb-1"></div>`}
			<div class="split fltr__h fltr__h--multi ${this._minimalUi ? "fltr__minimal-hide" : ""} mb-1">
				<div class="flex-v-center">
					<div class="mr-2">${this._getRenderedHeader()}</div>
					${$btnAndOr}
				</div>
				${wrpControls}
			</div>
			${this._$wrpChildren}
		</div>`;
	}

	$renderMinis (opts) {
		this._filters.map((it, i) => it.$renderMinis({...opts, isMulti: true, isFirst: i === 0}));
	}

	/**
	 * @param vals Previously-read filter value may be passed in for performance.
	 */
	isActive (vals) {
		vals = vals || this.getValues();
		return this._filters.some(it => it.isActive(vals));
	}

	getValues () {
		const out = {};
		this._filters.forEach(it => Object.assign(out, it.getValues()));
		return out;
	}

	_reset () {
		Object.assign(this._state, this._defaultState);
	}

	reset (isResetAll) {
		if (isResetAll) this.resetBase();
		this._reset();
		this._filters.forEach(it => it.reset(isResetAll));
	}

	resetShallow (isResetAll) {
		if (isResetAll) this.resetBase();
		this._reset();
	}

	update () {
		this._filters.forEach(it => it.update());
	}

	toDisplay (boxState, entryValArr) {
		if (this._filters.length !== entryValArr.length) throw new Error("Number of filters and number of values did not match");

		const results = [];
		for (let i = this._filters.length - 1; i >= 0; --i) {
			const f = this._filters[i];
			if (f instanceof RangeFilter) {
				results.push(f.toDisplay(boxState, entryValArr[i]))
			} else {
				const totals = boxState[f.header]._totals;

				if (totals.yes === 0 && totals.no === 0) results.push(null);
				else results.push(f.toDisplay(boxState, entryValArr[i]));
			}
		}

		const resultsActive = results.filter(r => r !== null);
		if (this._state.mode === "or") {
			if (!resultsActive.length) return true;
			return resultsActive.find(r => r);
		} else {
			return resultsActive.filter(r => r).length === resultsActive.length;
		}
	}

	addItem () { throw new Error(`Cannot add item to MultiFilter! Add the item to a child filter instead.`); }

	handleSearch (searchTerm) {
		const isHeaderMatch = this.header.toLowerCase().includes(searchTerm);

		if (isHeaderMatch) {
			if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__hidden--search", false);
			// Force-display the children if the parent is visible
			this._filters.forEach(it => it.handleSearch(""));
			return true;
		}

		const numVisible = this._filters.map(it => it.handleSearch(searchTerm)).reduce((a, b) => a + b, 0);
		if (!this.__$wrpFilter) return;
		this.__$wrpFilter.toggleClass("fltr__hidden--search", numVisible === 0);
	}
}
MultiFilter._DETAULT_STATE = {
	mode: "and",
};

// validate subhash prefixes
(() => {
	const boxPrefixes = Object.values(FilterBox._SUB_HASH_PREFIXES).filter(it => it.length !== FilterUtil.SUB_HASH_PREFIX_LENGTH);
	const filterPrefixes = Object.values(FilterBase._SUB_HASH_PREFIXES).filter(it => it.length !== FilterUtil.SUB_HASH_PREFIX_LENGTH);
	const allPrefixes = boxPrefixes.concat(filterPrefixes);
	if (allPrefixes.length) throw new Error(`Invalid prefixes! ${allPrefixes.map(it => `"${it}"`).join(", ")} ${allPrefixes.length === 1 ? `is` : `was`} not of length ${FilterUtil.SUB_HASH_PREFIX_LENGTH}`);
})();
FilterUtil.SUB_HASH_PREFIXES = new Set([...Object.values(FilterBox._SUB_HASH_PREFIXES), ...Object.values(FilterBase._SUB_HASH_PREFIXES)]);

if (typeof module !== "undefined") {
	module.exports = {
		FilterUtil,
		PageFilter,
		FilterBox,
		FilterItem,
		FilterBase,
		Filter,
		SourceFilter,
		RangeFilter,
		MultiFilter,
	};
}

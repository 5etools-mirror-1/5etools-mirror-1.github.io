"use strict";

class ListItem {
	/**
	 * @param ix External ID information (e.g. the location of the entry this ListItem represents in a list of entries)
	 * @param ele An element, or jQuery element if the list is in jQuery mode.
	 * @param name A name for this item.
	 * @param values A dictionary of indexed values for this item.
	 * @param [data] An optional dictionary of additional data to store with the item (not indexed).
	 */
	constructor (ix, ele, name, values, data) {
		this.ix = ix;
		this.ele = ele;
		this.name = name;
		this.values = values || {};
		this.data = data || {};

		this.searchText = null;
		this.mutRegenSearchText();

		this._isSelected = false;
	}

	mutRegenSearchText () {
		let searchText = `${this.name} - `;
		for (const k in this.values) {
			const v = this.values[k]; // unsafe for performance
			if (!v) continue;
			searchText += `${v} - `;
		}
		this.searchText = searchText.toAscii().toLowerCase();
	}

	set isSelected (val) {
		if (this._isSelected === val) return;
		this._isSelected = val;

		if (this.ele instanceof $) {
			if (this._isSelected) this.ele.addClass("list-multi-selected");
			else this.ele.removeClass("list-multi-selected");
		} else {
			if (this._isSelected) this.ele.classList.add("list-multi-selected");
			else this.ele.classList.remove("list-multi-selected");
		}
	}

	get isSelected () { return this._isSelected; }
}

class _ListSearch {
	#isInterrupted = false;

	#term = null;
	#fn = null;
	#items = null;

	constructor ({term, fn, items}) {
		this.#term = term;
		this.#fn = fn;
		this.#items = [...items];
	}

	interrupt () { this.#isInterrupted = true; }

	async pRun () {
		const out = [];
		for (const item of this.#items) {
			if (this.#isInterrupted) break;
			if (await this.#fn(item, this.#term)) out.push(item);
		}
		return {isInterrupted: this.#isInterrupted, searchedItems: out};
	}
}

class List {
	#activeSearch = null;

	/**
	 * @param [opts] Options object.
	 * @param [opts.fnSort] Sort function. Should accept `(a, b, o)` where `o` is an options object. Pass `null` to
	 * disable sorting.
	 * @param [opts.fnSearch] Search function. Should accept `(li, searchTerm)` where `li` is a list item.
	 * @param [opts.$iptSearch] Search input.
	 * @param opts.$wrpList List wrapper.
	 * @param [opts.isUseJquery] If the list items are using jQuery elements. Significantly slower for large lists.
	 * @param [opts.sortByInitial] Initial sortBy.
	 * @param [opts.sortDirInitial] Initial sortDir.
	 * @param [opts.syntax] A dictionary of search syntax prefixes, each with an item "to display" checker function.
	 * @param [opts.isFuzzy]
	 * @param [opts.isSkipSearchKeybindingEnter]
	 * @param {array} [opts.helpText]
	 */
	constructor (opts) {
		if (opts.fnSearch && opts.isFuzzy) throw new Error(`The options "fnSearch" and "isFuzzy" are mutually incompatible!`);

		this._$iptSearch = opts.$iptSearch;
		this._$wrpList = opts.$wrpList;
		this._fnSort = opts.fnSort === undefined ? SortUtil.listSort : opts.fnSort;
		this._fnSearch = opts.fnSearch;
		this._syntax = opts.syntax;
		this._isFuzzy = !!opts.isFuzzy;
		this._isSkipSearchKeybindingEnter = !!opts.isSkipSearchKeybindingEnter;
		this._helpText = opts.helpText;

		this._items = [];
		this._eventHandlers = {};

		this._searchTerm = List._DEFAULTS.searchTerm;
		this._sortBy = opts.sortByInitial || List._DEFAULTS.sortBy;
		this._sortDir = opts.sortDirInitial || List._DEFAULTS.sortDir;
		this._sortByInitial = this._sortBy;
		this._sortDirInitial = this._sortDir;
		this._fnFilter = null;
		this._isUseJquery = opts.isUseJquery;

		if (this._isFuzzy) this._initFuzzySearch();

		this._searchedItems = [];
		this._filteredItems = [];
		this._sortedItems = [];

		this._isInit = false;
		this._isDirty = false;

		// region selection
		this._prevList = null;
		this._nextList = null;
		this._lastSelection = null;
		this._isMultiSelection = false;
		// endregion
	}

	get items () { return this._items; }
	get visibleItems () { return this._sortedItems; }
	get sortBy () { return this._sortBy; }
	get sortDir () { return this._sortDir; }
	set nextList (list) { this._nextList = list; }
	set prevList (list) { this._prevList = list; }

	setFnSearch (fn) {
		this._fnSearch = fn;
		this._isDirty = true;
	}

	init () {
		if (this._isInit) return;

		// This should only be run after all the elements are ready from page load
		if (this._$iptSearch) {
			UiUtil.bindTypingEnd({$ipt: this._$iptSearch, fnKeyup: () => this.search(this._$iptSearch.val())});
			this._searchTerm = List.getCleanSearchTerm(this._$iptSearch.val());
			this._init_bindKeydowns();

			// region Help text
			const helpText = [
				...(this._helpText || []),
				...Object.values(this._syntax || {})
					.filter(({help}) => help)
					.map(({help}) => help),
			];

			if (helpText.length) this._$iptSearch.title(helpText.join(" "));
			// endregion
		}

		this._doSearch();
		this._isInit = true;
	}

	_init_bindKeydowns () {
		this._$iptSearch
			.on("keydown", evt => {
				// Avoid handling the same event multiple times, if there are multiple lists bound to one input
				if (evt._List__isHandled) return;

				switch (evt.key) {
					case "Escape": return this._handleKeydown_escape(evt);
					case "Enter": return this._handleKeydown_enter(evt);
				}
			});
	}

	_handleKeydown_escape (evt) {
		evt._List__isHandled = true;

		if (!this._$iptSearch.val()) {
			$(document.activeElement).blur();
			return;
		}

		this._$iptSearch.val("");
		this.search("");
	}

	_handleKeydown_enter (evt) {
		if (this._isSkipSearchKeybindingEnter) return;

		if (IS_VTT) return;
		if (!EventUtil.noModifierKeys(evt)) return;

		const firstVisibleItem = this.visibleItems[0];
		if (!firstVisibleItem) return;

		evt._List__isHandled = true;

		$(firstVisibleItem.ele).click();
		if (firstVisibleItem.values.hash) window.location.hash = firstVisibleItem.values.hash;
	}

	_initFuzzySearch () {
		elasticlunr.clearStopWords();
		this._fuzzySearch = elasticlunr(function () {
			this.addField("s");
			this.setRef("ix");
		});
		SearchUtil.removeStemmer(this._fuzzySearch);
	}

	update ({isForce = false} = {}) {
		if (!this._isInit || !this._isDirty || isForce) return;
		return this._doSearch();
	}

	_doSearch () {
		this._doSearch_doInterruptExistingSearch();
		this._doSearch_doSearchTerm();
		this._doSearch_doPostSearchTerm();
	}

	_doSearch_doInterruptExistingSearch () {
		if (!this.#activeSearch) return;
		this.#activeSearch.interrupt();
		this.#activeSearch = null;
	}

	_doSearch_doSearchTerm () {
		if (this._doSearch_doSearchTerm_preSyntax()) return;

		const matchingSyntax = this._doSearch_getMatchingSyntax();
		if (matchingSyntax) {
			if (this._doSearch_doSearchTerm_syntax(matchingSyntax)) return;

			// For async syntax, blank the list for now, and allow the search to "resume" later
			this._searchedItems = [];
			this._doSearch_doSearchTerm_pSyntax(matchingSyntax)
				.then(isContinue => {
					if (!isContinue) return;
					this._doSearch_doPostSearchTerm();
				});

			return;
		}

		if (this._isFuzzy) return this._searchedItems = this._doSearch_doSearchTerm_fuzzy();

		if (this._fnSearch) return this._searchedItems = this._items.filter(it => this._fnSearch(it, this._searchTerm));

		this._searchedItems = this._items.filter(it => this.constructor.isVisibleDefaultSearch(it, this._searchTerm));
	}

	_doSearch_doSearchTerm_preSyntax () {
		if (!this._searchTerm && !this._fnSearch) {
			this._searchedItems = [...this._items];
			return true;
		}
	}

	_doSearch_getMatchingSyntax () {
		const [command, term] = this._searchTerm.split(/^([a-z]+):/).filter(Boolean);
		if (!command || !term || !this._syntax?.[command]) return null;
		return {term: this._doSearch_getSyntaxSearchTerm(term), syntax: this._syntax[command]};
	}

	_doSearch_getSyntaxSearchTerm (term) {
		if (!term.startsWith("/") || !term.endsWith("/")) return term;
		try {
			return new RegExp(term.slice(1, -1));
		} catch (ignored) {
			return term;
		}
	}

	_doSearch_doSearchTerm_syntax ({term, syntax: {fn, isAsync}}) {
		if (isAsync) return false;

		this._searchedItems = this._items.filter(it => fn(it, term));
		return true;
	}

	async _doSearch_doSearchTerm_pSyntax ({term, syntax: {fn, isAsync}}) {
		if (!isAsync) return false;

		this.#activeSearch = new _ListSearch({
			term,
			fn,
			items: this._items,
		});
		const {isInterrupted, searchedItems} = await this.#activeSearch.pRun();

		if (isInterrupted) return false;
		this._searchedItems = searchedItems;
		return true;
	}

	static isVisibleDefaultSearch (li, searchTerm) { return li.searchText.includes(searchTerm); }

	_doSearch_doSearchTerm_fuzzy () {
		const results = this._fuzzySearch
			.search(
				this._searchTerm,
				{
					fields: {
						s: {expand: true},
					},
					bool: "AND",
					expand: true,
				},
			);

		return results.map(res => this._items[res.doc.ix]);
	}

	_doSearch_doPostSearchTerm () {
		// Never show excluded items
		this._searchedItems = this._searchedItems.filter(it => !it.data.isExcluded);

		this._doFilter();
	}

	getFilteredItems ({items = null, fnFilter} = {}) {
		items = items || this._searchedItems;
		fnFilter = fnFilter || this._fnFilter;

		if (!fnFilter) return items;

		return items.filter(it => fnFilter(it));
	}

	_doFilter () {
		this._filteredItems = this.getFilteredItems();
		this._doSort();
	}

	getSortedItems ({items = null} = {}) {
		items = items || [...this._filteredItems];

		const opts = {
			sortBy: this._sortBy,
			// The sort function should generally ignore this, as we do the reversing here. We expose it in case there
			//   is specific functionality that requires it.
			sortDir: this._sortDir,
		};
		if (this._fnSort) items.sort((a, b) => this._fnSort(a, b, opts));
		if (this._sortDir === "desc") items.reverse();

		return items;
	}

	_doSort () {
		this._sortedItems = this.getSortedItems();
		this._doRender();
	}

	_doRender () {
		const len = this._sortedItems.length;

		if (this._isUseJquery) {
			this._$wrpList.children().detach();
			for (let i = 0; i < len; ++i) this._$wrpList.append(this._sortedItems[i].ele);
		} else {
			this._$wrpList[0].innerHTML = "";
			const frag = document.createDocumentFragment();
			for (let i = 0; i < len; ++i) frag.appendChild(this._sortedItems[i].ele);
			this._$wrpList[0].appendChild(frag);
		}

		this._isDirty = false;
		this._trigger("updated");
	}

	search (searchTerm) {
		const nextTerm = List.getCleanSearchTerm(searchTerm);
		if (nextTerm === this._searchTerm) return;
		this._searchTerm = nextTerm;
		return this._doSearch();
	}

	filter (fnFilter) {
		if (this._fnFilter === fnFilter) return;
		this._fnFilter = fnFilter;
		this._doFilter();
	}

	sort (sortBy, sortDir) {
		if (this._sortBy !== sortBy || this._sortDir !== sortDir) {
			this._sortBy = sortBy;
			this._sortDir = sortDir;
			this._doSort();
		}
	}

	reset () {
		if (this._searchTerm !== List._DEFAULTS.searchTerm) {
			this._searchTerm = List._DEFAULTS.searchTerm;
			return this._doSearch();
		} else if (this._sortBy !== this._sortByInitial || this._sortDir !== this._sortDirInitial) {
			this._sortBy = this._sortByInitial;
			this._sortDir = this._sortDirInitial;
		}
	}

	addItem (listItem) {
		this._isDirty = true;
		this._items.push(listItem);

		if (this._isFuzzy) this._fuzzySearch.addDoc({ix: listItem.ix, s: listItem.searchText});
	}

	removeItem (listItem) {
		const ixItem = this._items.indexOf(listItem);
		return this.removeItemByIndex(listItem.ix, ixItem);
	}

	removeItemByIndex (ix, ixItem) {
		ixItem = ixItem ?? this._items.findIndex(it => it.ix === ix);
		if (!~ixItem) return;

		this._isDirty = true;
		const removed = this._items.splice(ixItem, 1);

		if (this._isFuzzy) this._fuzzySearch.removeDocByRef(ix);

		return removed[0];
	}

	removeItemBy (valueName, value) {
		const ixItem = this._items.findIndex(it => it.values[valueName] === value);
		return this.removeItemByIndex(ixItem, ixItem);
	}

	removeItemByData (dataName, value) {
		const ixItem = this._items.findIndex(it => it.data[dataName] === value);
		return this.removeItemByIndex(ixItem, ixItem);
	}

	removeAllItems () {
		this._isDirty = true;
		this._items = [];
		if (this._isFuzzy) this._initFuzzySearch();
	}

	on (eventName, handler) { (this._eventHandlers[eventName] = this._eventHandlers[eventName] || []).push(handler); }
	_trigger (eventName) { (this._eventHandlers[eventName] || []).forEach(fn => fn()); }

	// region hacks
	/**
	 * Allows the current contents of the list wrapper to be converted to list items.
	 * Useful in situations where, for whatever reason, we can't fill the list after the fact (e.g. when using Foundry's
	 * template engine).
	 * Extremely fragile; use with caution.
	 * @param dataArr Array from which the list was rendered.
	 * @param opts Options object.
	 * @param opts.fnGetName Function which gets the name from a dataSource item.
	 * @param [opts.fnGetValues] Function which gets list values from a dataSource item.
	 * @param [opts.fnGetData] Function which gets list data from a listItem and dataSource item.
	 * @param [opts.fnBindListeners] Function which binds event listeners to the list.
	 */
	doAbsorbItems (dataArr, opts) {
		const children = [...this._$wrpList[0].children];

		const len = children.length;
		if (len !== dataArr.length) throw new Error(`Data source length and list element length did not match!`);

		for (let i = 0; i < len; ++i) {
			const node = children[i];
			const dataItem = dataArr[i];
			const listItem = new ListItem(
				i,
				node,
				opts.fnGetName(dataItem),
				opts.fnGetValues ? opts.fnGetValues(dataItem) : {},
				{},
			);
			if (opts.fnGetData) listItem.data = opts.fnGetData(listItem, dataItem);
			if (opts.fnBindListeners) opts.fnBindListeners(listItem, dataItem);
			this.addItem(listItem);
		}
	}
	// endregion

	// region selection
	doSelect (item, evt) {
		if (evt && evt.shiftKey) {
			evt.preventDefault(); // Stop a new window from being opened
			// Don't update the last selection, as we want to be able to "pivot" the multi-selection off the first selection
			if (this._prevList && this._prevList._lastSelection) {
				this._prevList._selectFromItemToEnd(this._prevList._lastSelection, true);
				this._selectToItemFromStart(item);
			} else if (this._nextList && this._nextList._lastSelection) {
				this._nextList._selectToItemFromStart(this._nextList._lastSelection, true);
				this._selectFromItemToEnd(item);
			} else if (this._lastSelection && this.visibleItems.includes(item)) {
				this._doSelect_doMulti(item);
			} else {
				this._doSelect_doSingle(item);
			}
		} else this._doSelect_doSingle(item);
	}

	_doSelect_doSingle (item) {
		if (this._isMultiSelection) {
			this.deselectAll();
			if (this._prevList) this._prevList.deselectAll();
			if (this._nextList) this._nextList.deselectAll();
		} else if (this._lastSelection) this._lastSelection.isSelected = false;

		item.isSelected = true;
		this._lastSelection = item;
	}

	_doSelect_doMulti (item) {
		this._selectFromItemToItem(this._lastSelection, item);

		if (this._prevList && this._prevList._isMultiSelection) {
			this._prevList.deselectAll();
		}

		if (this._nextList && this._nextList._isMultiSelection) {
			this._nextList.deselectAll();
		}
	}

	_selectFromItemToEnd (item, isKeepLastSelection = false) {
		this.deselectAll(isKeepLastSelection);
		this._isMultiSelection = true;
		const ixStart = this.visibleItems.indexOf(item);
		const len = this.visibleItems.length;
		for (let i = ixStart; i < len; ++i) {
			this.visibleItems[i].isSelected = true;
		}
	}

	_selectToItemFromStart (item, isKeepLastSelection = false) {
		this.deselectAll(isKeepLastSelection);
		this._isMultiSelection = true;
		const ixEnd = this.visibleItems.indexOf(item);
		for (let i = 0; i <= ixEnd; ++i) {
			this.visibleItems[i].isSelected = true;
		}
	}

	_selectFromItemToItem (item1, item2) {
		this.deselectAll(true);

		if (item1 === item2) {
			if (this._lastSelection) this._lastSelection.isSelected = false;
			item1.isSelected = true;
			this._lastSelection = item1;
			return;
		}

		const ix1 = this.visibleItems.indexOf(item1);
		const ix2 = this.visibleItems.indexOf(item2);

		this._isMultiSelection = true;
		const [ixStart, ixEnd] = [ix1, ix2].sort(SortUtil.ascSort);
		for (let i = ixStart; i <= ixEnd; ++i) {
			this.visibleItems[i].isSelected = true;
		}
	}

	deselectAll (isKeepLastSelection = false) {
		if (!isKeepLastSelection) this._lastSelection = null;
		this._isMultiSelection = false;
		this._items.forEach(it => it.isSelected = false);
	}

	updateSelected (item) {
		if (this.visibleItems.includes(item)) {
			if (this._isMultiSelection) this.deselectAll(true);

			if (this._lastSelection && this._lastSelection !== item) this._lastSelection.isSelected = false;

			item.isSelected = true;
			this._lastSelection = item;
		} else this.deselectAll();
	}

	getSelected () {
		return this.visibleItems.filter(it => it.isSelected);
	}
	// endregion

	static getCleanSearchTerm (str) {
		return (str || "").toAscii().trim().toLowerCase().split(/\s+/g).join(" ");
	}
}
List._DEFAULTS = {
	searchTerm: "",
	sortBy: "name",
	sortDir: "asc",
	fnFilter: null,
};

globalThis.List = List;
globalThis.ListItem = ListItem;

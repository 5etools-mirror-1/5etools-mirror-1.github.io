"use strict";

const ListUtil = {
	SUB_HASH_PREFIX: "sublistselected",

	_firstInit: true,
	_isPreviewable: false,
	_isFindHotkeyBound: false,
	initList (listOpts) {
		const $iptSearch = $("#lst__search");
		const $wrpList = $(`.list.${listOpts.listClass}`);
		const list = new List({$iptSearch, $wrpList, ...listOpts});

		if (listOpts.isPreviewable) ListUtil._isPreviewable = true;

		const helpText = [];

		if (listOpts.isBindFindHotkey && !ListUtil._isFindHotkeyBound) {
			helpText.push(`Hotkey: f.`);

			$(document.body).on("keypress", (e) => {
				if (!EventUtil.noModifierKeys(e) || EventUtil.isInInput(e)) return;
				if (e.key === "f") {
					e.preventDefault();
					$iptSearch.select().focus();
				}
			});
		}

		if (listOpts.syntax) {
			Object.values(listOpts.syntax)
				.filter(({help}) => help)
				.forEach(({help}) => {
					helpText.push(help);
				});
		}

		if (helpText.length) $iptSearch.title(helpText.join(" "));

		$("#reset").click(function () {
			$iptSearch.val("");
			list.reset();
		});

		// region Magnifying glass/clear button
		const $btnSearchClear = $(`#lst__search-glass`)
			.click(() => $iptSearch.val("").change().keydown().keyup());
		const _handleSearchChange = () => {
			setTimeout(() => {
				if ($iptSearch.val().length) $btnSearchClear.removeClass("no-events").addClass("clickable").title("Clear").html(`<span class="glyphicon glyphicon-remove"/>`);
				else $btnSearchClear.addClass("no-events").removeClass("clickable").title(null).html(`<span class="glyphicon glyphicon-search"/>`);
			})
		};
		const handleSearchChange = MiscUtil.throttle(_handleSearchChange, 50);
		$iptSearch.on("keydown", handleSearchChange);
		// endregion

		if (ListUtil._firstInit) {
			ListUtil._firstInit = false;
			const $headDesc = $(`.page__subtitle`);
			$headDesc.html(`${$headDesc.html()} Press J/K to navigate${ListUtil._isPreviewable ? `, M to expand` : ""}.`);
			ListUtil._initList_bindWindowHandlers();
		}

		return list;
	},

	_initList_scrollToItem () {
		const toShow = Hist.getSelectedListElementWithLocation();

		if (toShow) {
			const $li = $(toShow.item.ele);
			const $wrpList = $li.parent();
			const parentScroll = $wrpList.scrollTop();
			const parentHeight = $wrpList.height();
			const posInParent = $li.position().top;
			const height = $li.height();

			if (posInParent < 0) {
				$li[0].scrollIntoView();
			} else if (posInParent + height > parentHeight) {
				$wrpList.scrollTop(parentScroll + (posInParent - parentHeight + height));
			}
		}
	},

	_initList_bindWindowHandlers () {
		$(window).on("keypress", (evt) => {
			if (!EventUtil.noModifierKeys(evt)) return;

			// K up; J down
			if (evt.key === "k" || evt.key === "j") {
				// don't switch if the user is typing somewhere else
				if (EventUtil.isInInput(evt)) return;
				ListUtil._initList_handleListUpDownPress(evt.key === "k" ? -1 : 1);
			} else if (ListUtil._isPreviewable && evt.key === "m") {
				if (EventUtil.isInInput(evt)) return;
				const it = Hist.getSelectedListElementWithLocation();
				$(it.item.ele.firstElementChild.firstElementChild).click();
			}
		});
	},

	_initList_handleListUpDownPress (dir) {
		const it = Hist.getSelectedListElementWithLocation();
		if (!it) return;

		const lists = ListUtil.getPrimaryLists();

		const ixVisible = it.list.visibleItems.indexOf(it.item);
		if (!~ixVisible) {
			// If the currently-selected item is not visible, jump to the top/bottom of the list
			const listsWithVisibleItems = lists.filter(list => list.visibleItems.length);
			const tgtItem = dir === 1
				? listsWithVisibleItems[0].visibleItems[0]
				: listsWithVisibleItems.last().visibleItems.last();
			if (tgtItem) {
				window.location.hash = tgtItem.values.hash;
				ListUtil._initList_scrollToItem();
			}
			return;
		}

		const tgtItemSameList = it.list.visibleItems[ixVisible + dir];
		if (tgtItemSameList) {
			window.location.hash = tgtItemSameList.values.hash;
			ListUtil._initList_scrollToItem();
			return;
		}

		let tgtItemOtherList = null;
		for (let i = it.x + dir; i >= 0 && i < lists.length; i += dir) {
			if (!lists[i]?.visibleItems?.length) continue;

			tgtItemOtherList = dir === 1 ? lists[i].visibleItems[0] : lists[i].visibleItems.last();
		}

		if (tgtItemOtherList) {
			window.location.hash = tgtItemOtherList.values.hash;
			ListUtil._initList_scrollToItem();
		}
	},

	updateSelected () {
		const curSelectedItem = Hist.getSelectedListItem();
		ListUtil._primaryLists.forEach(l => l.updateSelected(curSelectedItem));
	},

	openContextMenu (evt, list, listItem) {
		const listsWithSelections = ListUtil._primaryLists.map(l => ({l, selected: l.getSelected()}));

		let selection;
		if (listsWithSelections.some(it => it.selected.length)) {
			const isItemInSelection = listsWithSelections.some(it => it.selected.some(li => li === listItem));
			if (isItemInSelection) {
				selection = listsWithSelections.map(it => it.selected).flat();
				// trigger a context menu event with all the selected items
			} else {
				ListUtil._primaryLists.forEach(l => l.deselectAll());
				list.doSelect(listItem);
				selection = [listItem]
			}
		} else {
			list.doSelect(listItem);
			selection = [listItem]
		}

		const menu = ListUtil.contextMenuPinnableList || ListUtil.contextMenuAddableList;
		ContextUtil.pOpenMenu(evt, menu, {ele: listItem.ele, selection});
	},

	openSubContextMenu (evt, listItem) {
		const menu = ListUtil.contextMenuPinnableListSub || ListUtil.contextMenuAddableListSub;

		const listSelected = ListUtil.sublist.getSelected();
		const isItemInSelection = listSelected.length && listSelected.some(li => li === listItem);
		const selection = isItemInSelection ? listSelected : [listItem];
		if (!isItemInSelection) {
			ListUtil.sublist.deselectAll();
			ListUtil.sublist.doSelect(listItem);
		}

		const ele = listItem.ele instanceof $ ? listItem.ele[0] : listItem.ele;
		ContextUtil.pOpenMenu(evt, menu, {ele: ele, selection});
	},

	$sublistContainer: null,
	sublist: null,
	_sublistChangeFn: null,
	_pCustomHashHandler: null,
	_fnSerializePinnedItemData: null,
	_fnDeserializePinnedItemData: null,
	_allItems: null,
	_primaryLists: [],
	initSublist (options) {
		if (options.itemList !== undefined) ListUtil._allItems = options.itemList; delete options.itemList;
		if (options.pGetSublistRow !== undefined) ListUtil._pGetSublistRow = options.pGetSublistRow; delete options.pGetSublistRow;
		if (options.onUpdate !== undefined) ListUtil._sublistChangeFn = options.onUpdate; delete options.onUpdate;
		if (options.primaryLists !== undefined) ListUtil._primaryLists = options.primaryLists; delete options.primaryLists;
		if (options.pCustomHashHandler !== undefined) ListUtil._pCustomHashHandler = options.pCustomHashHandler; delete options.pCustomHashHandler;
		if (options.fnSerializePinnedItemData !== undefined) ListUtil._fnSerializePinnedItemData = options.fnSerializePinnedItemData; delete options.fnSerializePinnedItemData;
		if (options.fnDeserializePinnedItemData !== undefined) ListUtil._fnDeserializePinnedItemData = options.fnDeserializePinnedItemData; delete options.fnDeserializePinnedItemData;

		ListUtil.$sublistContainer = $("#sublistcontainer");
		const $wrpSublist = $(`.${options.listClass}`);
		const sublist = new List({...options, $wrpList: $wrpSublist, isUseJquery: true});
		ListUtil.sublist = sublist;

		if (ListUtil.$sublistContainer.hasClass(`sublist--resizable`)) ListUtil._pBindSublistResizeHandlers(ListUtil.$sublistContainer);

		return sublist;
	},

	setOptions (options) {
		if (options.itemList !== undefined) ListUtil._allItems = options.itemList;
		if (options.pGetSublistRow !== undefined) ListUtil._pGetSublistRow = options.pGetSublistRow;
		if (options.onUpdate !== undefined) ListUtil._sublistChangeFn = options.onUpdate;
		if (options.primaryLists !== undefined) ListUtil._primaryLists = options.primaryLists;
		if (options.pCustomHashHandler !== undefined) ListUtil._pCustomHashHandler = options.pCustomHashHandler;
	},

	getPrimaryLists () { return this._primaryLists; },

	__mouseMoveId: 1,
	async _pBindSublistResizeHandlers ($ele) {
		const STORAGE_KEY = "SUBLIST_RESIZE";
		const BORDER_SIZE = 3;
		const MOUSE_MOVE_ID = ListUtil.__mouseMoveId++;
		const $doc = $(document);

		let mousePos;
		function resize (evt) {
			const dx = evt.clientY - mousePos;
			mousePos = evt.clientY;
			$ele.css("height", parseInt($ele.css("height")) + dx);
		}

		$ele.on("mousedown", (evt) => {
			if (evt.which === 1 && evt.target === $ele[0]) {
				evt.preventDefault();
				if (evt.offsetY > $ele.height() - BORDER_SIZE) {
					mousePos = evt.clientY;
					$doc.on(`mousemove.sublist_resize-${MOUSE_MOVE_ID}`, resize);
				}
			}
		});

		$doc.on("mouseup", (evt) => {
			if (evt.which === 1) {
				$(document).off(`mousemove.sublist_resize-${MOUSE_MOVE_ID}`);
				StorageUtil.pSetForPage(STORAGE_KEY, $ele.css("height"));
			}
		});

		const storedHeight = await StorageUtil.pGetForPage(STORAGE_KEY);
		if (storedHeight) $ele.css("height", storedHeight);
	},

	getOrTabRightButton: (id, icon) => {
		let $btn = $(`#${id}`);
		if (!$btn.length) {
			$btn = $(`<button class="ui-tab__btn-tab-head btn btn-default" id="${id}"><span class="glyphicon glyphicon-${icon}"></span></button>`).appendTo($(`#tabs-right`));
		}
		return $btn;
	},

	/**
	 * @param [opts]
	 * @param [opts.fnGetCustomHashId]
	 */
	bindPinButton: ({fnGetCustomHashId} = {}) => {
		ListUtil.getOrTabRightButton(`btn-pin`, `pushpin`)
			.off("click")
			.on("click", async () => {
				const customHashId = fnGetCustomHashId ? fnGetCustomHashId() : null;

				if (!ListUtil.isSublisted({index: Hist.lastLoadedId, customHashId})) {
					await ListUtil.pDoSublistAdd({index: Hist.lastLoadedId, doFinalize: true, customHashId});
					return;
				}

				await ListUtil.pDoSublistRemove({index: Hist.lastLoadedId, doFinalize: true, customHashId});
			})
			.title("Pin (Toggle)");
	},

	bindAddButton: ({fnGetCustomHashId, shiftCount = 20} = {}) => {
		ListUtil.getOrTabRightButton(`btn-sublist-add`, `plus`)
			.off("click")
			.title(`Add (SHIFT for ${shiftCount})`)
			.on("click", evt => {
				const addCount = evt.shiftKey ? shiftCount : 1;
				return ListUtil.pDoSublistAdd({
					index: Hist.lastLoadedId,
					doFinalize: true,
					addCount,
					customHashId: fnGetCustomHashId ? fnGetCustomHashId() : null,
				});
			});
	},

	bindSubtractButton: ({fnGetCustomHashId, shiftCount = 20} = {}) => {
		ListUtil.getOrTabRightButton(`btn-sublist-subtract`, `minus`)
			.off("click")
			.title(`Subtract (SHIFT for ${shiftCount})`)
			.on("click", evt => {
				const subtractCount = evt.shiftKey ? shiftCount : 1;
				return ListUtil.pDoSublistSubtract({
					index: Hist.lastLoadedId,
					subtractCount,
					customHashId: fnGetCustomHashId ? fnGetCustomHashId() : null,
				});
			});
	},

	/**
	 * @param opts
	 * @param [opts.download]
	 * @param [opts.upload]
	 * @param [opts.upload.pPreloadSublistSources]
	 * @param [opts.sendToBrew]
	 * @param [opts.sendToBrew.fnGetMeta]
	 */
	bindOtherButtons (opts) {
		opts = opts || {};

		const $btnOptions = ListUtil.getOrTabRightButton(`btn-sublist-other`, `option-vertical`);

		const contextOptions = [];

		if (opts.download) {
			const action = new ContextUtil.Action(
				"Download Pinned List (SHIFT to Copy Link)",
				async evt => {
					if (evt.shiftKey) {
						const toEncode = JSON.stringify(ListUtil.getExportableSublist());
						const parts = [window.location.href, (UrlUtil.packSubHash(ListUtil.SUB_HASH_PREFIX, [toEncode], {isEncodeBoth: true}))];
						await MiscUtil.pCopyTextToClipboard(parts.join(HASH_PART_SEP));
						JqueryUtil.showCopiedEffect($btnOptions);
					} else {
						const fileType = ListUtil._getDownloadName();
						DataUtil.userDownload(fileType, ListUtil.getExportableSublist(), {fileType});
					}
				},
			);
			contextOptions.push(action);
		}

		if (opts.upload) {
			const action = new ContextUtil.Action(
				"Upload Pinned List (SHIFT for Add Only)",
				async evt => {
					const {jsons, errors} = await DataUtil.pUserUpload({expectedFileType: ListUtil._getDownloadName()});

					DataUtil.doHandleFileLoadErrorsGeneric(errors);

					if (!jsons?.length) return;

					const json = jsons[0];

					if (typeof opts.upload === "object" && opts.upload.pFnPreLoad) await opts.upload.pFnPreLoad(json);
					await ListUtil.pDoJsonLoad(json, evt.shiftKey);
				},
			);
			contextOptions.push(action);
		}

		if (opts.sendToBrew) {
			if (contextOptions.length) contextOptions.push(null); // Add a spacer after the previous group

			const action = new ContextUtil.Action(
				"Edit in Homebrew Builder",
				() => {
					const meta = opts.sendToBrew.fnGetMeta();
					const toLoadData = [meta.page, meta.source, meta.hash];
					window.location = `${UrlUtil.PG_MAKE_BREW}#${opts.sendToBrew.mode.toUrlified()}${HASH_PART_SEP}${UrlUtil.packSubHash("statemeta", toLoadData)}`;
				},
			);
			contextOptions.push(action);
		}

		const menu = ContextUtil.getMenu(contextOptions);
		$btnOptions
			.off("click")
			.on("click", evt => ContextUtil.pOpenMenu(evt, menu));
	},

	async pDoJsonLoad (json, additive) {
		await ListUtil._pLoadSavedSublist(json.items, additive);
		await ListUtil._pFinaliseSublist();
	},

	async pSetFromSubHashes (subHashes, pFnPreLoad) {
		const unpacked = {};
		subHashes.forEach(s => Object.assign(unpacked, UrlUtil.unpackSubHash(s, true)));
		const setFrom = unpacked[ListUtil.SUB_HASH_PREFIX];
		if (setFrom) {
			const json = JSON.parse(setFrom);

			if (pFnPreLoad) {
				await pFnPreLoad(json);
			}

			await ListUtil._pLoadSavedSublist(json.items, false);
			await ListUtil._pFinaliseSublist();

			const [link] = Hist.getHashParts();
			const outSub = [];
			Object.keys(unpacked)
				.filter(k => k !== ListUtil.SUB_HASH_PREFIX)
				.forEach(k => {
					outSub.push(`${k}${HASH_SUB_KV_SEP}${unpacked[k].join(HASH_SUB_LIST_SEP)}`);
				});
			Hist.setSuppressHistory(true);
			window.location.hash = `#${link}${outSub.length ? `${HASH_PART_SEP}${outSub.join(HASH_PART_SEP)}` : ""}`;
		}
	},

	getSublistListItem ({index, customHashId}) {
		return ListUtil.sublist.items.find(it => customHashId != null ? it.data.customHashId === customHashId : (it.ix === index && it.data.customHashId == null));
	},

	async pDoSublistAdd ({index, doFinalize = false, addCount = 1, customHashId = null, initialData = null} = {}) {
		if (index == null) {
			return JqueryUtil.doToast({
				content: "Please first view something from the list.",
				type: "danger",
			});
		}

		const existingSublistItem = this.getSublistListItem({index, customHashId});
		if (existingSublistItem != null) {
			existingSublistItem.data.count += addCount;
			ListUtil._updateSublistItemDisplays(existingSublistItem);
			if (doFinalize) await ListUtil._pFinaliseSublist();
			return;
		}

		const sublistItem = await ListUtil._pGetSublistRow(ListUtil._allItems[index], index, {count: addCount, customHashId, initialData});
		ListUtil.sublist.addItem(sublistItem);
		if (doFinalize) await ListUtil._pFinaliseSublist();
	},

	async pDoSublistSubtract ({index, subtractCount = 1, customHashId = null} = {}) {
		const sublistItem = this.getSublistListItem({index, customHashId});
		if (!sublistItem) return;

		sublistItem.data.count -= subtractCount;
		if (sublistItem.data.count <= 0) {
			await ListUtil.pDoSublistRemove({index, doFinalize: true, customHashId});
			return;
		}

		ListUtil._updateSublistItemDisplays(sublistItem);
		await ListUtil._pFinaliseSublist();
	},

	async pSetDataEntry ({sublistItem, key, value}) {
		sublistItem.data[key] = value;
		ListUtil._updateSublistItemDisplays(sublistItem);
		await ListUtil._pFinaliseSublist();
	},

	getSublistedIds () {
		return ListUtil.sublist.items.map(({ix}) => ix);
	},

	_updateSublistItemDisplays (sublistItem) {
		(sublistItem.data.$elesCount || [])
			.forEach($ele => {
				if ($ele.is("input")) $ele.val(sublistItem.data.count);
				else $ele.text(sublistItem.data.count);
			});

		(sublistItem.data.fnsUpdate || [])
			.forEach(fn => fn());
	},

	async _pFinaliseSublist (noSave) {
		ListUtil.sublist.update();
		ListUtil._updateSublistVisibility();
		if (!noSave) await ListUtil._pSaveSublist();
		if (ListUtil._sublistChangeFn) ListUtil._sublistChangeFn();
	},

	getExportableSublist () {
		const sources = new Set();
		const toSave = ListUtil.sublist.items
			.map(it => {
				sources.add(ListUtil._allItems[it.ix].source);

				return {
					h: it.values.hash.split(HASH_PART_SEP)[0],
					c: it.data.count || undefined,
					customHashId: it.data.customHashId || undefined,
					...(ListUtil._fnSerializePinnedItemData ? ListUtil._fnSerializePinnedItemData(it.data) : {}),
				};
			});
		return {items: toSave, sources: Array.from(sources)};
	},

	async _pSaveSublist () {
		await StorageUtil.pSetForPage("sublist", ListUtil.getExportableSublist());
	},

	_updateSublistVisibility () {
		if (ListUtil.sublist.items.length) ListUtil.$sublistContainer.addClass("sublist--visible");
		else ListUtil.$sublistContainer.removeClass("sublist--visible");
	},

	async pDoSublistRemove ({index, customHashId = null, doFinalize = true} = {}) {
		const sublistItem = this.getSublistListItem({index, customHashId});
		if (!sublistItem) return;
		ListUtil.sublist.removeItem(sublistItem);
		if (doFinalize) await ListUtil._pFinaliseSublist();
	},

	async pDoSublistRemoveAll (noSave) {
		ListUtil.sublist.removeAllItems();
		await this._pFinaliseSublist(noSave);
	},

	isSublisted ({index, customHashId}) {
		return !!this.getSublistListItem({index, customHashId});
	},

	_hasLoadedState: false,
	async pLoadState () {
		if (ListUtil._hasLoadedState) return;
		ListUtil._hasLoadedState = true;
		try {
			const store = await StorageUtil.pGetForPage("sublist");
			if (store && store.items) {
				await ListUtil._pLoadSavedSublist(store.items);
			}
		} catch (e) {
			setTimeout(() => { throw e });
			await StorageUtil.pRemoveForPage("sublist");
		}
	},

	async _pLoadSavedSublist (items, additive) {
		if (!additive) await ListUtil.pDoSublistRemoveAll(true);

		const toAddOpts = items
			.map(it => {
				const item = Hist.getActiveListItem(it.h);
				if (item == null) return null;
				const initialData = ListUtil._fnDeserializePinnedItemData ? ListUtil._fnDeserializePinnedItemData(it) : null;
				return {
					index: item.ix,
					addCount: Number(it.c),
					customHashId: it.customHashId,
					initialData,
				};
			})
			.filter(Boolean);

		// Do this in series to ensure sublist items are added before having their counts updated
		//  This only becomes a problem when there are duplicate items in the list, but as we're not finalizing, the
		//  performance implications are negligible.
		for (const it of toAddOpts) {
			await ListUtil.pDoSublistAdd({...it, doFinalize: false});
		}

		await ListUtil._pFinaliseSublist(true);
	},

	async pGetSelectedSources () {
		let store;
		try {
			store = await StorageUtil.pGetForPage("sublist");
		} catch (e) {
			setTimeout(() => { throw e });
		}
		if (store && store.sources) return store.sources;
	},

	contextMenuPinnableList: null,
	contextMenuPinnableListSub: null,
	initGenericPinnable () {
		if (ListUtil.contextMenuPinnableList) return;

		ListUtil.contextMenuPinnableList = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Popout",
				(evt, userData) => {
					const {ele, selection} = userData;
					ListUtil._handleGenericContextMenuClick_pDoMassPopout(evt, ele, selection);
				},
			),
			new ContextUtil.Action(
				"Pin",
				async () => {
					for (const list of ListUtil._primaryLists) {
						for (const li of list.getSelected()) {
							li.isSelected = false;
							if (!ListUtil.isSublisted({index: li.ix})) await ListUtil.pDoSublistAdd({index: li.ix});
						}
					}

					await ListUtil._pFinaliseSublist();
				},
			),
		]);

		const subActions = [
			new ContextUtil.Action(
				"Popout",
				(evt, userData) => {
					const {ele, selection} = userData;
					ListUtil._handleGenericContextMenuClick_pDoMassPopout(evt, ele, selection);
				},
			),
			new ContextUtil.Action(
				"Unpin",
				async (evt, userData) => {
					const {selection} = userData;
					for (const item of selection) {
						await ListUtil.pDoSublistRemove({index: item.ix, isFinalize: false, customHashId: item.data.customHashId});
					}
					await ListUtil._pFinaliseSublist();
				},
			),
			new ContextUtil.Action(
				"Clear Pins",
				() => ListUtil.pDoSublistRemoveAll(),
			),
			null,
			new ContextUtil.Action(
				"Roll on List",
				() => ListUtil._rollSubListed(),
			),
			null,
			new ContextUtil.Action(
				"Send to DM Screen",
				() => ListUtil._pDoSendSublistToDmScreen(),
			),
			ExtensionUtil.ACTIVE
				? new ContextUtil.Action(
					"Send to Foundry",
					() => ListUtil._pDoSendSublistToFoundry(),
				)
				: undefined,
			null,
			new ContextUtil.Action(
				"Download JSON Data",
				() => ListUtil._pHandleJsonDownload(),
			),
		].filter(it => it !== undefined);
		ListUtil.contextMenuPinnableListSub = ContextUtil.getMenu(subActions);
	},

	contextMenuAddableList: null,
	contextMenuAddableListSub: null,
	initGenericAddable () {
		ListUtil.contextMenuAddableList = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Popout",
				(evt, userData) => {
					const {ele, selection} = userData;
					ListUtil._handleGenericContextMenuClick_pDoMassPopout(evt, ele, selection);
				},
			),
			new ContextUtil.Action(
				"Add",
				async () => {
					for (const list of ListUtil._primaryLists) {
						for (const li of list.getSelected()) {
							li.isSelected = false;
							await ListUtil.pDoSublistAdd({index: li.ix});
						}
					}

					await ListUtil._pFinaliseSublist();
					ListUtil.updateSelected();
				},
			),
		]);

		const subActions = [
			new ContextUtil.Action(
				"Popout",
				(evt, userData) => {
					const {ele, selection} = userData;
					ListUtil._handleGenericContextMenuClick_pDoMassPopout(evt, ele, selection)
				},
			),
			new ContextUtil.Action(
				"Remove",
				async (evt, userData) => {
					const {selection} = userData;
					await Promise.all(selection.map(item => ListUtil.pDoSublistRemove({index: item.ix, customHashId: item.data.customHashId, doFinalize: false})));
					await ListUtil._pFinaliseSublist();
				},
			),
			new ContextUtil.Action(
				"Clear List",
				() => ListUtil.pDoSublistRemoveAll(),
			),
			null,
			new ContextUtil.Action(
				"Roll on List",
				() => ListUtil._rollSubListed(),
			),
			null,
			new ContextUtil.Action(
				"Send to DM Screen",
				() => ListUtil._pDoSendSublistToDmScreen(),
			),
			ExtensionUtil.ACTIVE
				? new ContextUtil.Action(
					"Send to Foundry",
					() => ListUtil._pDoSendSublistToFoundry(),
				)
				: undefined,
			null,
			new ContextUtil.Action(
				"Download JSON Data",
				() => ListUtil._pHandleJsonDownload(),
			),
		].filter(it => it !== undefined);
		ListUtil.contextMenuAddableListSub = ContextUtil.getMenu(subActions);
	},

	async _pDoSendSublistToDmScreen () {
		try {
			const list = ListUtil.getExportableSublist();
			const len = list.items.length;
			await StorageUtil.pSet(VeCt.STORAGE_DMSCREEN_TEMP_SUBLIST, {page: UrlUtil.getCurrentPage(), list});
			JqueryUtil.doToast(`${len} pin${len === 1 ? "" : "s"} will be loaded into the DM Screen on your next visit.`)
		} catch (e) {
			JqueryUtil.doToast(`Failed! ${VeCt.STR_SEE_CONSOLE}`);
			setTimeout(() => { throw e; })
		}
	},

	async _pDoSendSublistToFoundry () {
		const list = ListUtil.getExportableSublist();
		const len = list.items.length;

		const page = UrlUtil.getCurrentPage();

		for (const it of list.items) {
			let toSend = await Renderer.hover.pCacheAndGetHash(page, it.h);

			switch (page) {
				case `${UrlUtil.PG_BESTIARY}`: {
					if (!it?.customHashId) break;

					const {_scaledCr, _scaledSpellSummonLevel, _scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(it.data.customHashId);
					if (_scaledCr != null) toSend = await ScaleCreature.scale(toSend, _scaledCr);
					else if (_scaledSpellSummonLevel != null) toSend = await ScaleSpellSummonedCreature.scale(toSend, _scaledSpellSummonLevel);
					else if (_scaledClassSummonLevel != null) toSend = await ScaleClassSummonedCreature.scale(toSend, _scaledClassSummonLevel);
				}
			}

			await ExtensionUtil._doSend("entity", {page, entity: toSend});
		}

		JqueryUtil.doToast(`Attempted to send ${len} item${len === 1 ? "" : "s"} to Foundry.`);
	},

	async _handleGenericContextMenuClick_pDoMassPopout (evt, ele, selection) {
		const elePos = ele.getBoundingClientRect();

		// do this in serial to have a "window cascade" effect
		for (let i = 0; i < selection.length; ++i) {
			const listItem = selection[i];
			const toRender = ListUtil._allItems[listItem.ix];
			const hash = UrlUtil.autoEncodeHash(toRender);
			const posOffset = Renderer.hover._BAR_HEIGHT * i;

			const page = UrlUtil.getCurrentPage();
			Renderer.hover.getShowWindow(
				Renderer.hover.$getHoverContent_stats(page, toRender),
				Renderer.hover.getWindowPositionExact(
					elePos.x + posOffset,
					elePos.y + posOffset,
					evt,
				),
				{
					title: toRender.name,
					isPermanent: true,
					pageUrl: `${page}#${hash}`,
					isBookContent: page === UrlUtil.PG_RECIPES,
				},
			);
		}
	},

	_isRolling: false,
	_rollSubListed () {
		const timerMult = RollerUtil.randomise(125, 75);
		const timers = [0, 1, 1, 1, 1, 1, 1.5, 1.5, 1.5, 2, 2, 2, 2.5, 3, 4, -1] // last element is always sliced off
			.map(it => it * timerMult)
			.slice(0, -RollerUtil.randomise(4, 1));

		function generateSequence (array, length) {
			const out = [RollerUtil.rollOnArray(array)];
			for (let i = 0; i < length; ++i) {
				let next = RollerUtil.rollOnArray(array);
				while (next === out.last()) {
					next = RollerUtil.rollOnArray(array);
				}
				out.push(next);
			}
			return out;
		}

		if (!ListUtil._isRolling) {
			ListUtil._isRolling = true;
			const $eles = ListUtil.sublist.items
				.map(it => $(it.ele).find(`a`));

			if ($eles.length <= 1) {
				JqueryUtil.doToast({
					content: "Not enough entries to roll!",
					type: "danger",
				});
				return ListUtil._isRolling = false;
			}

			const $sequence = generateSequence($eles, timers.length);

			let total = 0;
			timers.map((it, i) => {
				total += it;
				setTimeout(() => {
					$sequence[i][0].click();
					if (i === timers.length - 1) ListUtil._isRolling = false;
				}, total);
			});
		}
	},

	_getDownloadName () {
		return `${UrlUtil.getCurrentPage().replace(".html", "")}-sublist`;
	},

	async pGetPinnedEntities () {
		return Promise.all(
			ListUtil.sublist.items
				.map(({ix, data}) => {
					const entity = ListUtil._allItems[ix];
					if (ListUtil._pCustomHashHandler && data.customHashId) return ListUtil._pCustomHashHandler(entity, data.customHashId);
					return MiscUtil.copy(entity);
				}),
		);
	},

	async _pHandleJsonDownload () {
		const entities = await ListUtil.pGetPinnedEntities();
		entities.forEach(cpy => DataUtil.cleanJson(cpy));
		DataUtil.userDownload(`${ListUtil._getDownloadName()}-data`, entities);
	},

	bindShowTableButton (id, title, dataList, colTransforms, filter, sorter) {
		$(`#${id}`).click("click", () => ListUtil.showTable(title, dataList, colTransforms, filter, sorter));
	},

	basicFilterGenerator () {
		const slIds = ListUtil.getSublistedIds();
		if (slIds.length) {
			const slIdSet = new Set(slIds);
			return slIdSet.has.bind(slIdSet);
		} else {
			const visibleIds = new Set(ListUtil.getVisibleIds());
			return visibleIds.has.bind(visibleIds);
		}
	},

	getVisibleIds () {
		return ListUtil._primaryLists.map(l => l.visibleItems.map(it => it.ix)).flat();
	},

	// FIXME move this out
	showTable (title, dataList, colTransforms, filter, sorter) {
		const {$modal} = UiUtil.getShowModal({
			isWidth100: true,
			isHeight100: true,
			isUncappedWidth: true,
			isUncappedHeight: true,
			isEmpty: true,
		});

		const $pnlControl = $(`<div class="split my-3"/>`).appendTo($modal);
		const $pnlCols = $(`<div class="flex" style="align-items: center;"/>`).appendTo($pnlControl);
		Object.values(colTransforms).forEach((c, i) => {
			const $wrpCb = $(`<label class="flex-${c.flex || 1} px-2 mr-2 no-wrap flex-inline-v-center"><span class="mr-2">${c.name}</span></label>`).appendTo($pnlCols);
			const $cbToggle = $(`<input type="checkbox" data-name="${c.name}" checked>`)
				.click(() => {
					const toToggle = $modal.find(`.col_${i}`);
					if ($cbToggle.prop("checked")) {
						toToggle.show();
					} else {
						toToggle.hide();
					}
				})
				.appendTo($wrpCb);
		});
		const $pnlBtns = $(`<div/>`).appendTo($pnlControl);
		function getAsCsv () {
			const headers = $pnlCols.find(`input:checked`).map((i, e) => $(e).data("name")).get();
			const rows = $modal.find(`.data-row`).map((i, e) => $(e)).get().map($e => {
				return $e.children().filter(`td:visible`).map((j, d) => $(d).text().trim()).get();
			});
			return DataUtil.getCsv(headers, rows);
		}
		const $btnCsv = $(`<button class="btn btn-primary mr-3">Download CSV</button>`).click(() => {
			DataUtil.userDownloadText(`${title}.csv`, getAsCsv());
		}).appendTo($pnlBtns);
		const $btnCopy = $(`<button class="btn btn-primary">Copy CSV to Clipboard</button>`).click(async () => {
			await MiscUtil.pCopyTextToClipboard(getAsCsv());
			JqueryUtil.showCopiedEffect($btnCopy);
		}).appendTo($pnlBtns);
		$modal.append(`<hr class="hr-1">`);

		if (typeof filter === "object" && filter.generator) filter = filter.generator();

		let stack = `<div class="overflow-y-auto w-100 h-100 flex-col"><table class="table-striped stats stats--book stats--book-large" style="width: 100%;"><thead><tr>${Object.values(colTransforms).map((c, i) => `<th class="col_${i} px-2" colspan="${c.flex || 1}">${c.name}</th>`).join("")}</tr></thead><tbody>`;
		const listCopy = JSON.parse(JSON.stringify(dataList)).filter((it, i) => filter ? filter(i) : it);
		if (sorter) listCopy.sort(sorter);
		listCopy.forEach(it => {
			stack += `<tr class="data-row">`;
			stack += Object.keys(colTransforms).map((k, i) => {
				const c = colTransforms[k];
				return `<td class="col_${i} px-2" colspan="${c.flex || 1}">${c.transform === true ? it[k] : c.transform(k[0] === "_" ? it : it[k])}</td>`;
			}).join("");
			stack += `</tr>`;
		});
		stack += `</tbody></table></div>`;
		$modal.append(stack);
	},

	addListShowHide () {
		$(`#filter-search-group`).find(`#reset`).before(`<button class="btn btn-default" id="hidesearch">Hide</button>`);
		$(`#contentwrapper`).prepend(`<div class="col-12" id="showsearch"><button class="btn btn-block btn-default btn-xs" type="button">Show Filter</button><br></div>`);

		const $wrpList = $(`#listcontainer`);
		const $wrpBtnShowSearch = $("div#showsearch");
		const $btnHideSearch = $("button#hidesearch");
		$btnHideSearch.title("Hide Search Bar and Entry List");
		// collapse/expand search button
		$btnHideSearch.click(function () {
			$wrpList.hide();
			$wrpBtnShowSearch.show();
			$btnHideSearch.hide();
		});
		$wrpBtnShowSearch.find("button").click(function () {
			$wrpList.show();
			$wrpBtnShowSearch.hide();
			$btnHideSearch.show();
		});
	},

	doDeselectAll () { ListUtil.getPrimaryLists().forEach(list => list.deselectAll()); },
	doSublistDeselectAll () { ListUtil.sublist.deselectAll(); },
};

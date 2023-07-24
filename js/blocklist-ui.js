"use strict";

class BlocklistUtil {
	static _IGNORED_CATEGORIES = new Set([
		"_meta",
		"linkedLootTables",

		// `items-base.json`
		"itemProperty",
		"itemType",
		"itemEntry",
		"itemTypeAdditionalEntries",
	]);

	static _BASIC_FILES = [
		"actions.json",
		"adventures.json",
		"backgrounds.json",
		"books.json",
		"cultsboons.json",
		"charcreationoptions.json",
		"conditionsdiseases.json",
		"deities.json",
		"feats.json",
		"items-base.json",
		"magicvariants.json",
		"items.json",
		"objects.json",
		"optionalfeatures.json",
		"psionics.json",
		"recipes.json",
		"rewards.json",
		"trapshazards.json",
		"variantrules.json",
		"vehicles.json",
		"decks.json",
	];

	static async pLoadData () {
		const out = {};

		this._addData(out, {monster: MiscUtil.copy(await DataUtil.monster.pLoadAll())});
		this._addData(out, {spell: MiscUtil.copy(await DataUtil.spell.pLoadAll())});
		this._addData(out, MiscUtil.copy(await DataUtil.class.loadRawJSON()));
		this._addData(out, MiscUtil.copy(await DataUtil.race.loadJSON({isAddBaseRaces: true})));

		const jsons = await Promise.all(this._BASIC_FILES.map(url => DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${url}`)));
		for (let json of jsons) {
			if (json.magicvariant) {
				json = MiscUtil.copy(json);
				json.magicvariant.forEach(it => it.source = SourceUtil.getEntitySource(it));
			}
			this._addData(out, json);
		}

		return out;
	}

	static _addData (out, json) {
		Object.keys(json)
			.filter(it => !this._IGNORED_CATEGORIES.has(it))
			.forEach(k => out[k] ? out[k] = out[k].concat(json[k]) : out[k] = json[k]);
	}
}

globalThis.BlocklistUtil = BlocklistUtil;

class BlocklistUi {
	constructor (
		{
			$wrpContent,
			data,
			isCompactUi = false,
			isAutoSave = true,
		},
	) {
		this._$wrpContent = $wrpContent;
		this._data = data;
		this._isCompactUi = !!isCompactUi;
		this._isAutoSave = !!isAutoSave;

		this._excludes = ExcludeUtil.getList();

		this._subBlocklistEntries = {};

		this._allSources = null;
		this._allCategories = null;

		this._$wrpControls = null;

		this._comp = null;

		this._$wrpSelName = null;
		this._metaSelName = null;
	}

	_addExclude (displayName, hash, category, source) {
		if (!this._excludes.find(row => row.source === source && row.category === category && row.hash === hash)) {
			this._excludes.push({displayName, hash, category, source});
			if (this._isAutoSave) ExcludeUtil.pSetList(MiscUtil.copy(this._excludes)).then(null);
			return true;
		}
		return false;
	}

	_removeExclude (hash, category, source) {
		const ix = this._excludes.findIndex(row => row.source === source && row.category === category && row.hash === hash);
		if (~ix) {
			this._excludes.splice(ix, 1);
			if (this._isAutoSave) ExcludeUtil.pSetList(MiscUtil.copy(this._excludes)).then(null);
		}
	}

	_resetExcludes () {
		this._excludes = [];
		if (this._isAutoSave) ExcludeUtil.pSetList(MiscUtil.copy(this._excludes)).then(null);
	}

	async _pInitSubBlocklistEntries () {
		for (const c of (this._data.class || [])) {
			const classHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](c);

			const subBlocklist = this._data.classFeature
				.filter(it => it.className === c.name && it.classSource === c.source)
				.map(it => {
					const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](it);
					const displayName = `${this._getDisplayNamePrefix_classFeature(it)}${it.name}`;
					return {displayName, hash, category: "classFeature", source: it.source};
				});
			MiscUtil.set(this._subBlocklistEntries, "class", classHash, subBlocklist);
		}

		for (const sc of (this._data.subclass || [])) {
			const subclassHash = UrlUtil.URL_TO_HASH_BUILDER["subclass"](sc);

			const subBlocklist = this._data.subclassFeature
				.filter(it => it.className === sc.className && it.classSource === sc.classSource && it.subclassShortName === sc.shortName && it.subclassSource === sc.source)
				.map(it => {
					const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](it);
					const displayName = `${this._getDisplayNamePrefix_subclassFeature(it)}${it.name}`;
					return {displayName, hash, category: "subclassFeature", source: it.source};
				});
			MiscUtil.set(this._subBlocklistEntries, "subclass", subclassHash, subBlocklist);
		}

		for (const it of (this._data.itemGroup || [])) {
			const itemGroupHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](it);

			const subBlocklist = (await it.items.pSerialAwaitMap(async uid => {
				let [name, source] = uid.split("|");
				source = Parser.getTagSource("item", source);
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source});
				const item = await DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, source, hash);
				if (!item) return null;
				return {displayName: item.name, hash, category: "item", source: item.source};
			})).filter(Boolean);

			MiscUtil.set(this._subBlocklistEntries, "itemGroup", itemGroupHash, subBlocklist);
		}

		for (const it of (this._data.race || []).filter(it => it._isBaseRace || it._versions?.length)) {
			const baseRaceHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES](it);
			const subBlocklist = [];

			if (it._isBaseRace) {
				subBlocklist.push(
					...it._subraces.map(sr => {
						const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES](sr);
						return {displayName: sr.name, hash, category: "race", source: sr.source};
					}),
				);
			}

			if (it._versions?.length) {
				subBlocklist.push(
					...DataUtil.proxy.getVersions(it.__prop, it).map(ver => {
						const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES](ver);
						return {displayName: ver.name, hash, category: "race", source: ver.source};
					}),
				);
			}

			MiscUtil.set(this._subBlocklistEntries, "race", baseRaceHash, subBlocklist);
		}
	}

	_getDisplayValues (category, source) {
		const displaySource = source === "*" ? source : Parser.sourceJsonToFullCompactPrefix(source);
		const displayCategory = category === "*" ? category : Parser.getPropDisplayName(category);
		return {displaySource, displayCategory};
	}

	_renderList () {
		this._excludes
			.sort((a, b) => SortUtil.ascSort(a.source, b.source) || SortUtil.ascSort(a.category, b.category) || SortUtil.ascSort(a.displayName, b.displayName))
			.forEach(({displayName, hash, category, source}) => this._addListItem(displayName, hash, category, source));
		this._list.init();
		this._list.update();
	}

	_getDisplayNamePrefix_classFeature (it) { return `${it.className} ${it.level}: `; }
	_getDisplayNamePrefix_subclassFeature (it) { return `${it.className} (${it.subclassShortName}) ${it.level}: `; }

	async pInit () {
		await this._pInitSubBlocklistEntries();
		this._pInit_initUi();
		this._pInit_render();
		this._renderList();
	}

	_pInit_initUi () {
		this._$wrpControls = $(`<div ${this._isCompactUi ? "" : `class="bg-solid py-5 px-3 shadow-big b-1p"`}></div>`);

		const $iptSearch = $(`<input type="search" class="search form-control lst__search lst__search--no-border-h h-100">`).disableSpellcheck();

		const $btnReset = $(`<button class="btn btn-default">Reset Search</button>`)
			.click(() => {
				$iptSearch.val("");
				this._list.reset();
			});

		const $wrpFilterTools = $$`<div class="input-group input-group--bottom ve-flex no-shrink">
			<button class="col-4 sort btn btn-default btn-xs ve-grow" data-sort="source">Source</button>
			<button class="col-2 sort btn btn-default btn-xs" data-sort="category">Category</button>
			<button class="col-5 sort btn btn-default btn-xs" data-sort="name">Name</button>
			<button class="col-1 sort btn btn-default btn-xs" disabled>&nbsp;</button>
		</div>`;

		const $wrpList = $(`<div class="list-display-only smooth-scroll overflow-y-auto h-100 min-h-0"></div>`);

		$$(this._$wrpContent.empty())`
			${this._$wrpControls}

			<hr class="${this._isCompactUi ? "hr-2" : "hr-5"}">

			<h4 class="my-0">Blocklist</h4>
			<div class="text-muted ${this._isCompactUi ? "mb-2" : "mb-3"}"><i>Rows marked with an asterisk (*) in a field match everything in that field.</i></div>

			<div class="ve-flex-col min-h-0">
				<div class="ve-flex-v-stretch input-group input-group--top no-shrink">
					<div class="w-100 relative">
						${$iptSearch}
						<div class="lst__wrp-search-glass no-events ve-flex-vh-center"><span class="glyphicon glyphicon-search"></span></div>
						<div class="lst__wrp-search-visible no-events ve-flex-vh-center"></div>
					</div>
					${$btnReset}
				</div>

				${$wrpFilterTools}

				${$wrpList}
			</div>`;

		this._list = new List({
			$iptSearch,
			$wrpList,
			isUseJquery: true,
		});
		this._listId = 1;

		SortUtil.initBtnSortHandlers($wrpFilterTools, this._list);
	}

	_pInit_render () {
		// region Helper controls
		const $btnExcludeAllUa = $(this._getBtnHtml_addToBlocklist())
			.click(() => this._addAllUa());
		const $btnIncludeAllUa = $(this._getBtnHtml_removeFromBlocklist())
			.click(() => this._removeAllUa());

		const $btnExcludeAllSources = $(this._getBtnHtml_addToBlocklist())
			.click(() => this._addAllSources());
		const $btnIncludeAllSources = $(this._getBtnHtml_removeFromBlocklist())
			.click(() => this._removeAllSources());

		const $btnExcludeAllComedySources = $(this._getBtnHtml_addToBlocklist())
			.click(() => this._addAllComedySources());
		const $btnIncludeAllComedySources = $(this._getBtnHtml_removeFromBlocklist())
			.click(() => this._removeAllComedySources());

		const $btnExcludeAllNonForgottenRealmsSources = $(this._getBtnHtml_addToBlocklist())
			.click(() => this._addAllNonForgottenRealms());
		const $btnIncludeAllNonForgottenRealmsSources = $(this._getBtnHtml_removeFromBlocklist())
			.click(() => this._removeAllNonForgottenRealms());
		// endregion

		// region Primary controls
		const sourceSet = new Set();
		const propSet = new Set();
		Object.keys(this._data).forEach(prop => {
			propSet.add(prop);
			const arr = this._data[prop];
			arr.forEach(it => sourceSet.has(it.source) || sourceSet.add(it.source));
		});

		this._allSources = [...sourceSet]
			.sort((a, b) => SortUtil.ascSort(Parser.sourceJsonToFull(a), Parser.sourceJsonToFull(b)));

		this._allCategories = [...propSet]
			.sort((a, b) => SortUtil.ascSort(Parser.getPropDisplayName(a), Parser.getPropDisplayName(b)));

		this._comp = new BlocklistUi.Component();

		const $selSource = ComponentUiUtil.$getSelSearchable(
			this._comp,
			"source",
			{
				values: ["*", ...this._allSources],
				fnDisplay: val => val === "*" ? val : Parser.sourceJsonToFull(val),
			},
		);
		this._comp.addHook("source", () => this._doHandleSourceCategorySelChange());

		const $selCategory = ComponentUiUtil.$getSelSearchable(
			this._comp,
			"category",
			{
				values: ["*", ...this._allCategories],
				fnDisplay: val => val === "*" ? val : Parser.getPropDisplayName(val),
			},
		);
		this._comp.addHook("category", () => this._doHandleSourceCategorySelChange());

		this._$wrpSelName = $(`<div class="w-100 ve-flex"></div>`);
		this._doHandleSourceCategorySelChange();

		const $btnAddExclusion = $(`<button class="btn btn-default btn-xs">Add to Blocklist</button>`)
			.click(() => this._pAdd());
		// endregion

		// Utility controls
		const $btnSendToFoundry = !IS_VTT && ExtensionUtil.ACTIVE
			? $(`<button title="Send to Foundry" class="btn btn-xs btn-default mr-2"><span class="glyphicon glyphicon-send"></span></button>`)
				.click(evt => this._pDoSendToFoundry({isTemp: !!evt.shiftKey}))
			: null;
		const $btnExport = $(`<button class="btn btn-default btn-xs">Export List</button>`)
			.click(() => this._export());
		const $btnImport = $(`<button class="btn btn-default btn-xs" title="SHIFT for Add Only">Import List</button>`)
			.click(evt => this._pImport(evt));
		const $btnReset = $(`<button class="btn btn-danger btn-xs">Reset List</button>`)
			.click(async () => {
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset Blocklist", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
				this._reset();
			});
		// endregion

		$$`<div class="${this._isCompactUi ? "mb-2" : "mb-5"} ve-flex-v-center">
			<div class="ve-flex-vh-center mr-4">
				<div class="mr-2">UA/Etc. Sources</div>
				<div class="ve-flex-v-center btn-group">
					${$btnExcludeAllUa}
					${$btnIncludeAllUa}
				</div>
			</div>

			<div class="ve-flex-vh-center mr-3">
				<div class="mr-2">Comedy Sources</div>
				<div class="ve-flex-v-center btn-group">
					${$btnExcludeAllComedySources}
					${$btnIncludeAllComedySources}
				</div>
			</div>

			<div class="ve-flex-vh-center mr-3">
				<div class="mr-2">Non-<i>Forgotten Realms</i></div>
				<div class="ve-flex-v-center btn-group">
					${$btnExcludeAllNonForgottenRealmsSources}
					${$btnIncludeAllNonForgottenRealmsSources}
				</div>
			</div>

			<div class="ve-flex-vh-center mr-3">
				<div class="mr-2">All Sources</div>
				<div class="ve-flex-v-center btn-group">
					${$btnExcludeAllSources}
					${$btnIncludeAllSources}
				</div>
			</div>
		</div>

		<div class="ve-flex-v-end ${this._isCompactUi ? "mb-2" : "mb-5"}">
			<div class="ve-flex-col w-25 pr-2">
				<label class="mb-1">Source</label>
				${$selSource}
			</div>

			<div class="ve-flex-col w-25 px-2">
				<label class="mb-1">Category</label>
				${$selCategory}
			</div>

			<div class="ve-flex-col w-25 px-2">
				<label class="mb-1">Name</label>
				${this._$wrpSelName}
			</div>

			<div class="ve-flex-col w-25 pl-2">
				<div class="mt-auto">
					${$btnAddExclusion}
				</div>
			</div>
		</div>

		<div class="w-100 ve-flex-v-center">
			${$btnSendToFoundry}
			<div class="ve-flex-v-center btn-group mr-2">
				${$btnExport}
				${$btnImport}
			</div>
			${$btnReset}
		</div>`.appendTo(this._$wrpControls.empty());
	}

	_getBtnHtml_addToBlocklist () {
		return `<button class="btn btn-danger btn-xs w-20p h-21p ve-flex-vh-center" title="Add to Blocklist"><span class="glyphicon glyphicon-trash"></span></button>`;
	}

	_getBtnHtml_removeFromBlocklist () {
		return `<button class="btn btn-success btn-xs w-20p h-21p ve-flex-vh-center" title="Remove from Blocklist"><span class="glyphicon glyphicon-thumbs-up"></span></button>`;
	}

	_doHandleSourceCategorySelChange () {
		if (this._metaSelName) this._metaSelName.unhook();
		this._$wrpSelName.empty();

		const filteredData = this._doHandleSourceCategorySelChange_getFilteredData();

		const $selName = ComponentUiUtil.$getSelSearchable(
			this._comp,
			"name",
			{
				values: [
					{hash: "*", name: "*", category: this._comp.category},
					...this._getDataUids(filteredData),
				],
				fnDisplay: val => val.name,
			},
		);

		this._$wrpSelName.append($selName);
	}

	_doHandleSourceCategorySelChange_getFilteredData () {
		// If the user has not selected either of source or category, avoid displaying the entire data set
		if (this._comp.source === "*" && this._comp.category === "*") return [];

		if (this._comp.source === "*" && this._comp.category !== "*") {
			return this._data[this._comp.category].map(it => ({...it, category: this._comp.category}));
		}

		if (this._comp.source !== "*" && this._comp.category === "*") {
			return Object.entries(this._data).map(([cat, arr]) => arr.filter(it => it.source === this._comp.source).map(it => ({...it, category: cat}))).flat();
		}

		return this._data[this._comp.category].filter(it => it.source === this._comp.source).map(it => ({...it, category: this._comp.category}));
	}

	_getDataUids (arr) {
		const copy = arr
			.map(it => {
				switch (it.category) {
					case "subclass": {
						return {...it, name: it.name, source: it.source, className: it.className, classSource: it.classSource, shortName: it.shortName};
					}
					case "classFeature": {
						return {...it, name: it.name, source: it.source, className: it.className, classSource: it.classSource, level: it.level};
					}
					case "subclassFeature": {
						return {...it, name: it.name, source: it.source, className: it.className, classSource: it.classSource, level: it.level, subclassShortName: it.subclassShortName, subclassSource: it.subclassSource};
					}
					case "adventure":
					case "book": {
						return {...it, name: it.name, source: it.source, id: it.id};
					}
					default: {
						return it;
					}
				}
			})
			.sort(this.constructor._fnSortDataUids.bind(this.constructor));

		const dupes = new Set();
		return copy.map((it, i) => {
			let prefix = "";
			let hash;
			if (UrlUtil.URL_TO_HASH_BUILDER[it.category]) {
				hash = UrlUtil.URL_TO_HASH_BUILDER[it.category](it);
			}
			switch (it.category) {
				case "subclass": prefix = `${it.className}: `; break;
				case "classFeature": prefix = this._getDisplayNamePrefix_classFeature(it); break;
				case "subclassFeature": prefix = this._getDisplayNamePrefix_subclassFeature(it); break;
			}
			if (!hash) hash = UrlUtil.encodeForHash([it.name, it.source]);
			const displayName = `${prefix}${it.name}${(dupes.has(it.name) || (copy[i + 1] && copy[i + 1].name === it.name)) ? ` (${Parser.sourceJsonToAbv(it.source)})` : ""}`;

			dupes.add(it.name);
			return {
				hash,
				name: displayName,
				category: it.category,
			};
		});
	}

	static _fnSortDataUids (a, b) {
		if (a.category !== b.category) return SortUtil.ascSortLower(a.category, b.category);
		switch (a.category) {
			case "subclass": {
				return SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source);
			}
			case "classFeature": {
				return SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source);
			}
			case "subclassFeature": {
				return SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSortLower(a.subclassShortName, b.subclassShortName) || SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source);
			}
			default: {
				return SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source);
			}
		}
	}

	_addListItem (displayName, hash, category, source) {
		const display = this._getDisplayValues(category, source);

		const id = this._listId++;
		const sourceFull = Parser.sourceJsonToFull(source);

		const $btnRemove = $(`<button class="btn btn-xxs btn-danger">Remove</button>`)
			.click(() => {
				this._remove(id, hash, category, source);
			});

		const $ele = $$`<div class="${this._addListItem_getItemStyles()}">
			<span class="col-4 ve-text-center">${sourceFull}</span>
			<span class="col-2 ve-text-center">${display.displayCategory}</span>
			<span class="col-5 ve-text-center">${displayName}</span>
			<span class="col-1 ve-text-center">${$btnRemove}</span>
		</div>`;

		const listItem = new ListItem(
			id,
			$ele,
			displayName,
			{
				category: display.displayCategory,
				source: sourceFull,
			},
			{
				displayName: displayName,
				hash: hash,
				category: category,
				source: source,
			},
		);

		this._list.addItem(listItem);
	}

	_addListItem_getItemStyles () { return `no-click ve-flex-v-center lst__row lst--border veapp__list-row lst__row-inner no-shrink`; }

	async _pAdd () {
		const {hash, name: displayName, category: categoryName} = this._comp.name;
		const category = categoryName === "*" ? this._comp.category : categoryName;

		if (
			this._comp.source === "*"
			&& category === "*"
			&& hash === "*"
			&& !await InputUiUtil.pGetUserBoolean({title: "Exclude All", htmlDescription: `This will exclude all content from all list pages. Are you sure?`, textYes: "Yes", textNo: "Cancel"})
		) return;

		if (this._addExclude(displayName, hash, category, this._comp.source)) {
			this._addListItem(displayName, hash, category, this._comp.source);

			const subBlocklist = MiscUtil.get(this._subBlocklistEntries, category, hash);
			if (subBlocklist) {
				subBlocklist.forEach(it => {
					const {displayName, hash, category, source} = it;
					this._addExclude(displayName, hash, category, source);
					this._addListItem(displayName, hash, category, source);
				});
			}

			this._list.update();
		}
	}

	_addMassSources ({fnFilter = null} = {}) {
		const sources = fnFilter
			? this._allSources.filter(source => fnFilter(source))
			: this._allSources;
		sources
			.forEach(source => {
				if (this._addExclude("*", "*", "*", source)) {
					this._addListItem("*", "*", "*", source);
				}
			});
		this._list.update();
	}

	_removeMassSources ({fnFilter = null} = {}) {
		const sources = fnFilter
			? this._allSources.filter(source => fnFilter(source))
			: this._allSources;
		sources
			.forEach(source => {
				const item = this._list.items.find(it => it.data.hash === "*" && it.data.category === "*" && it.data.source === source);
				if (item) {
					this._remove(item.ix, "*", "*", source, {isSkipListUpdate: true});
				}
			});
		this._list.update();
	}

	_addAllUa () { this._addMassSources({fnFilter: SourceUtil.isNonstandardSource}); }
	_removeAllUa () { this._removeMassSources({fnFilter: SourceUtil.isNonstandardSource}); }

	_addAllSources () { this._addMassSources(); }
	_removeAllSources () { this._removeMassSources(); }

	_addAllComedySources () { this._addMassSources({fnFilter: source => Parser.SOURCES_COMEDY.has(source)}); }
	_removeAllComedySources () { this._removeMassSources({fnFilter: source => Parser.SOURCES_COMEDY.has(source)}); }

	_addAllNonForgottenRealms () { this._addMassSources({fnFilter: source => Parser.SOURCES_NON_FR.has(source)}); }
	_removeAllNonForgottenRealms () { this._removeMassSources({fnFilter: source => Parser.SOURCES_NON_FR.has(source)}); }

	_remove (ix, hash, category, source, {isSkipListUpdate = false} = {}) {
		this._removeExclude(hash, category, source);
		this._list.removeItemByIndex(ix);
		if (!isSkipListUpdate) this._list.update();
	}

	async _pDoSendToFoundry () {
		await ExtensionUtil.pDoSend({type: "5etools.blocklist.excludes", data: this._excludes});
	}

	_export () {
		DataUtil.userDownload(`content-blocklist`, {fileType: "content-blocklist", blocklist: this._excludes});
	}

	async _pImport_getUserUpload () {
		return DataUtil.pUserUpload({expectedFileTypes: ["content-blocklist", "content-blacklist"]}); // Supports old fileType "content-blacklist"
	}

	async _pImport (evt) {
		const {jsons, errors} = await this._pImport_getUserUpload();

		DataUtil.doHandleFileLoadErrorsGeneric(errors);

		if (!jsons?.length) return;

		// clear list display
		this._list.removeAllItems();
		this._list.update();

		const json = jsons[0];

		// update storage
		const nxtList = evt.shiftKey
			// Supports old key "blacklist"
			? MiscUtil.copy(this._excludes).concat(json.blocklist || json.blacklist || [])
			: json.blocklist || json.blacklist || [];
		this._excludes = nxtList;
		if (this._isAutoSave) await ExcludeUtil.pSetList(nxtList);

		// render list display
		this._renderList();
	}

	_reset () {
		this._resetExcludes();
		this._list.removeAllItems();
		this._list.update();
	}
}

globalThis.BlocklistUi = BlocklistUi;

BlocklistUi.Component = class extends BaseComponent {
	get source () { return this._state.source; }
	get category () { return this._state.category; }
	get name () { return this._state.name; }

	addHook (prop, hk) { return this._addHookBase(prop, hk); }

	_getDefaultState () {
		return {
			source: "*",
			category: "*",
			name: {
				hash: "*",
				name: "*",
				category: "*",
			},
		};
	}
};

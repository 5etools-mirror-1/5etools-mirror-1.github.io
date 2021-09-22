"use strict";

class Blacklist {
	static _getDisplayCategory (cat) {
		if (cat === "variantrule") return "Variant Rule";
		if (cat === "optionalfeature") return "Optional Feature";
		if (cat === "variant") return "Magic Item Variant";
		if (cat === "classFeature") return "Class Feature";
		if (cat === "subclassFeature") return "Subclass Feature";
		return cat.uppercaseFirst();
	}

	static _getDisplayValues (category, source) {
		const displaySource = source === "*" ? source : Parser.sourceJsonToFullCompactPrefix(source);
		const displayCategory = category === "*" ? category : Blacklist._getDisplayCategory(category);
		return {displaySource, displayCategory};
	}

	static _renderList () {
		ExcludeUtil.getList()
			.sort((a, b) => SortUtil.ascSort(a.source, b.source) || SortUtil.ascSort(a.category, b.category) || SortUtil.ascSort(a.displayName, b.displayName))
			.forEach(({displayName, hash, category, source}) => Blacklist._addListItem(displayName, hash, category, source));
		Blacklist._list.init();
		Blacklist._list.update();
	}

	static _getDisplayNamePrefix_classFeature (it) { return `${it.className} ${it.level}: ` }
	static _getDisplayNamePrefix_subclassFeature (it) { return `${it.className} (${it.subclassShortName}) ${it.level}: ` }

	static async pInitialise () {
		await this._pInitialise_pInitList();
		const data = await this._pInitialise_pLoadData();
		await this._pInitialise_pRender(data);
		Blacklist._renderList();
		window.dispatchEvent(new Event("toolsLoaded"));
	}

	static _pInitialise_pInitList () {
		const $iptSearch = $(`#search`);
		Blacklist._list = new List({
			$iptSearch,
			$wrpList: $(`.blacklist`),
			isUseJquery: true,
		});
		Blacklist._listId = 1;
	}

	static async _pInitialise_pLoadData () {
		const data = {};

		function mergeData (fromRec) {
			Object.keys(fromRec).filter(it => !Blacklist._IGNORED_CATEGORIES.has(it))
				.forEach(k => data[k] ? data[k] = data[k].concat(fromRec[k]) : data[k] = fromRec[k])
		}

		// LOAD DATA ===============================================================================
		// bestiary
		mergeData({monster: await DataUtil.monster.pLoadAll()});

		// spells
		mergeData({spell: await DataUtil.spell.pLoadAll()});

		// classes
		const classData = MiscUtil.copy(await DataUtil.class.loadRawJSON());
		for (const c of classData.class) {
			const classHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](c);

			const subBlacklist = classData.classFeature
				.filter(it => it.className === c.name && it.classSource === c.source)
				.map(it => {
					const hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](it);
					const displayName = `${Blacklist._getDisplayNamePrefix_subclassFeature(it)}${it.name}`;
					return {displayName, hash, category: "classFeature", source: it.source};
				});
			MiscUtil.set(Blacklist._SUB_BLACKLIST_ENTRIES, "class", classHash, subBlacklist);
		}

		for (const sc of (classData.subclass || [])) {
			const subclassHash = UrlUtil.URL_TO_HASH_BUILDER["subclass"](sc);

			const subBlacklist = classData.subclassFeature
				.filter(it => it.className === sc.className && it.classSource === sc.classSource && it.subclassShortName === sc.shortName && it.subclassSource === sc.source)
				.map(it => {
					const hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](it);
					const displayName = `${Blacklist._getDisplayNamePrefix_subclassFeature(it)}${it.name}`;
					return {displayName, hash, category: "subclassFeature", source: it.source};
				});
			MiscUtil.set(Blacklist._SUB_BLACKLIST_ENTRIES, "subclass", subclassHash, subBlacklist);
		}
		mergeData(classData);

		// everything else
		const promises = Blacklist._BASIC_FILES.map(url => DataUtil.loadJSON(`data/${url}`));
		promises.push(async () => ({item: await Renderer.items.pBuildList({isAddGroups: true})}));
		const contentData = await Promise.all(promises);
		contentData.forEach(d => {
			if (d.race) d.race = Renderer.race.mergeSubraces(d.race);
			if (d.variant) d.variant.forEach(it => it.source = it.source || it.inherits.source);
			mergeData(d);
		});

		return data;
	}

	static _pInitialise_pRender (data) {
		// region Helper controls
		const $btnExcludeAllUa = $(this._getBtnHtml_addToBlacklist())
			.click(() => Blacklist._addAllUa());
		const $btnIncludeAllUa = $(this._getBtnHtml_removeFromBlacklist())
			.click(() => Blacklist._removeAllUa());

		const $btnExcludeAllSources = $(this._getBtnHtml_addToBlacklist())
			.click(() => Blacklist._addAllSources());
		const $btnIncludeAllSources = $(this._getBtnHtml_removeFromBlacklist())
			.click(() => Blacklist._removeAllSources());

		const $btnExcludeAllComedySources = $(this._getBtnHtml_addToBlacklist())
			.click(() => Blacklist._addAllComedySources());
		const $btnIncludeAllComedySources = $(this._getBtnHtml_removeFromBlacklist())
			.click(() => Blacklist._removeAllComedySources());

		const $btnExcludeAllNonForgottenRealmsSources = $(this._getBtnHtml_addToBlacklist())
			.click(() => Blacklist._addAllNonForgottenRealms());
		const $btnIncludeAllNonForgottenRealmsSources = $(this._getBtnHtml_removeFromBlacklist())
			.click(() => Blacklist._removeAllNonForgottenRealms());
		// endregion

		// region Primary controls
		const sourceSet = new Set();
		const catSet = new Set();
		Object.keys(data).forEach(cat => {
			catSet.add(cat);
			const arr = data[cat];
			arr.forEach(it => sourceSet.has(it.source) || sourceSet.add(it.source));
		});

		Blacklist._ALL_SOURCES = [...sourceSet]
			.sort((a, b) => SortUtil.ascSort(Parser.sourceJsonToFull(a), Parser.sourceJsonToFull(b)));

		Blacklist._ALL_CATEGORIES = [...catSet]
			.sort((a, b) => SortUtil.ascSort(Blacklist._getDisplayCategory(a), Blacklist._getDisplayCategory(b)));

		Blacklist._comp = new Blacklist.Component();

		const $selSource = ComponentUiUtil.$getSelSearchable(
			Blacklist._comp,
			"source",
			{
				values: ["*", ...Blacklist._ALL_SOURCES],
				fnDisplay: val => val === "*" ? val : Parser.sourceJsonToFull(val),
			},
		);
		Blacklist._comp.addHook("source", () => this._doHandleSourceCategorySelChange(data));

		const $selCategory = ComponentUiUtil.$getSelSearchable(
			Blacklist._comp,
			"category",
			{
				values: ["*", ...Blacklist._ALL_CATEGORIES],
				fnDisplay: val => val === "*" ? val : Blacklist._getDisplayCategory(val),
			},
		);
		Blacklist._comp.addHook("category", () => this._doHandleSourceCategorySelChange(data));

		Blacklist._$wrpSelName = $(`<div class="w-100 flex"></div>`);
		this._doHandleSourceCategorySelChange(data);

		const $btnAddExclusion = $(`<button class="btn btn-default btn-xs">Add Exclusion</button>`)
			.click(() => Blacklist._pAdd());
		// endregion

		// Utility controls
		const $btnExport = $(`<button class="btn btn-default btn-xs">Export List</button>`)
			.click(() => Blacklist._export())
		const $btnImport = $(`<button class="btn btn-default btn-xs" title="SHIFT for Add Only">Import List</button>`)
			.click(evt => Blacklist._pImport(evt));
		const $btnReset = $(`<button class="btn btn-danger btn-xs">Reset List</button>`)
			.click(async () => {
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset Blacklist", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
				Blacklist.reset();
			})
		// endregion

		$$`<div class="mb-5 flex-v-center">
			<div class="flex-vh-center mr-4">
				<div class="mr-2">UA/Etc. Sources</div>
				<div class="flex-v-center btn-group">
					${$btnExcludeAllUa}
					${$btnIncludeAllUa}
				</div>
			</div>

			<div class="flex-vh-center mr-3">
				<div class="mr-2">Comedy Sources</div>
				<div class="flex-v-center btn-group">
					${$btnExcludeAllComedySources}
					${$btnIncludeAllComedySources}
				</div>
			</div>

			<div class="flex-vh-center mr-3">
				<div class="mr-2">Non-<i>Forgotten Realms</i></div>
				<div class="flex-v-center btn-group">
					${$btnExcludeAllNonForgottenRealmsSources}
					${$btnIncludeAllNonForgottenRealmsSources}
				</div>
			</div>

			<div class="flex-vh-center mr-3">
				<div class="mr-2">All Sources</div>
				<div class="flex-v-center btn-group">
					${$btnExcludeAllSources}
					${$btnIncludeAllSources}
				</div>
			</div>
		</div>

		<div class="flex-v-end mb-5">
			<div class="flex-col w-25 pr-2">
				<label class="mb-1">Source</label>
				${$selSource}
			</div>

			<div class="flex-col w-25 px-2">
				<label class="mb-1">Category</label>
				${$selCategory}
			</div>

			<div class="flex-col w-25 px-2">
				<label class="mb-1">Name</label>
				${Blacklist._$wrpSelName}
			</div>

			<div class="flex-col w-25 pl-2">
				<div class="mt-auto">
					${$btnAddExclusion}
				</div>
			</div>
		</div>

		<div class="w-100 flex-v-center">
			<div class="btn-group mr-2">
				${$btnExport}
				${$btnImport}
			</div>
			${$btnReset}
		</div>`.appendTo($(`#blacklist-controls`).empty());
	}

	static _getBtnHtml_addToBlacklist () {
		return `<button class="btn btn-danger btn-xs btn-icon flex-vh-center" title="Add to Blacklist"><span class="glyphicon glyphicon-trash"></span></button>`;
	}

	static _getBtnHtml_removeFromBlacklist () {
		return `<button class="btn btn-success btn-xs btn-icon flex-vh-center" title="Remove from Blacklist"><span class="glyphicon glyphicon-thumbs-up"></span></button>`
	}

	static _doHandleSourceCategorySelChange (data) {
		if (Blacklist._metaSelName) Blacklist._metaSelName.unhook();
		Blacklist._$wrpSelName.empty();

		const filteredData = Blacklist._comp.category === "*"
			? []
			: Blacklist._comp.source === "*"
				? data[Blacklist._comp.category]
				: data[Blacklist._comp.category].filter(it => it.source === Blacklist._comp.source);

		const $selName = ComponentUiUtil.$getSelSearchable(
			Blacklist._comp,
			"name",
			{
				values: [
					{hash: "*", name: "*"},
					...this._getDataUids(filteredData, Blacklist._comp.category),
				],
				fnDisplay: val => val.name,
			},
		);

		Blacklist._$wrpSelName.append($selName);
	}

	static _getDataUids (arr, cat) {
		let copy;
		switch (cat) {
			case "subclass": {
				copy = arr
					.map(it => ({name: it.name, source: it.source, className: it.className, classSource: it.classSource, shortName: it.shortName}))
					.sort((a, b) => SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
				break;
			}
			case "classFeature": {
				copy = arr
					.map(it => ({name: it.name, source: it.source, className: it.className, classSource: it.classSource, level: it.level}))
					.sort((a, b) => SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
				break;
			}
			case "subclassFeature": {
				copy = arr
					.map(it => ({name: it.name, source: it.source, className: it.className, classSource: it.classSource, level: it.level, subclassShortName: it.subclassShortName, subclassSource: it.subclassSource}))
					.sort((a, b) => SortUtil.ascSortLower(a.className, b.className) || SortUtil.ascSortLower(a.subclassShortName, b.subclassShortName) || SortUtil.ascSort(a.level, b.level) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
				break;
			}
			case "adventure":
			case "book": {
				copy = arr
					.map(it => ({name: it.name, source: it.source, id: it.id}))
					.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
				break;
			}
			default: {
				copy = arr.map(({name, source}) => ({name, source})).sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source))
				break;
			}
		}
		const dupes = new Set();
		return copy.map((it, i) => {
			let hash;
			let prefix = "";
			switch (cat) {
				case "subclass": hash = UrlUtil.URL_TO_HASH_BUILDER["subclass"](it); prefix = `${it.className}: `; break;
				case "classFeature": hash = UrlUtil.URL_TO_HASH_BUILDER["classFeature"](it); prefix = Blacklist._getDisplayNamePrefix_classFeature(it); break;
				case "subclassFeature": hash = UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](it); prefix = Blacklist._getDisplayNamePrefix_subclassFeature(it); break;
				case "adventure": hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURE](it); break;
				case "book": hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BOOK](it); break;
			}
			if (!hash) hash = UrlUtil.encodeForHash([it.name, it.source]);
			const displayName = `${prefix}${it.name}${(dupes.has(it.name) || (copy[i + 1] && copy[i + 1].name === it.name)) ? ` (${Parser.sourceJsonToAbv(it.source)})` : ""}`;

			dupes.add(it.name);
			return {
				hash,
				name: displayName,
			};
		});
	}

	static _addListItem (displayName, hash, category, source) {
		const display = Blacklist._getDisplayValues(category, source);

		const id = Blacklist._listId++;

		const $btnRemove = $(`<button class="btn btn-xxs btn-danger m-1">Remove</button>`)
			.click(() => {
				Blacklist._remove(id, hash, category, source);
			});

		const $ele = $$`<div class="no-click flex-v-center lst__row lst--border lst__row-inner no-shrink">
			<span class="col-5 text-center">${Parser.sourceJsonToFull(source)}</span>
			<span class="col-3 text-center">${display.displayCategory}</span>
			<span class="bold col-3 text-center">${displayName}</span>
			<span class="col-1 text-center">${$btnRemove}</span>
		</div>`;

		const listItem = new ListItem(
			id,
			$ele,
			displayName,
			{category: display.displayCategory},
			{
				displayName: displayName,
				hash: hash,
				category: category,
				source: source,
			},
		);

		Blacklist._list.addItem(listItem);
	}

	static async _pAdd () {
		const {hash, name: displayName} = Blacklist._comp.name;

		if (
			Blacklist._comp.source === "*"
			&& Blacklist._comp.category === "*"
			&& hash === "*"
			&& !await InputUiUtil.pGetUserBoolean({title: "Exclude All", htmlDescription: `This will exclude all content from all list pages. Are you sure?`, textYes: "Yes", textNo: "Cancel"})
		) return;

		if (ExcludeUtil.addExclude(displayName, hash, Blacklist._comp.category, Blacklist._comp.source)) {
			Blacklist._addListItem(displayName, hash, Blacklist._comp.category, Blacklist._comp.source);

			const subBlacklist = MiscUtil.get(Blacklist._SUB_BLACKLIST_ENTRIES, Blacklist._comp.category, hash);
			if (subBlacklist) {
				subBlacklist.forEach(it => {
					const {displayName, hash, category, source} = it;
					ExcludeUtil.addExclude(displayName, hash, category, source)
					Blacklist._addListItem(displayName, hash, category, source);
				});
			}

			Blacklist._list.update();
		}
	}

	static _addMassSources ({fnFilter = null} = {}) {
		const sources = fnFilter
			? Blacklist._ALL_SOURCES.filter(source => fnFilter(source))
			: Blacklist._ALL_SOURCES;
		sources
			.forEach(source => {
				if (ExcludeUtil.addExclude("*", "*", "*", source)) {
					Blacklist._addListItem("*", "*", "*", source);
				}
			});
		Blacklist._list.update();
	}

	static _removeMassSources ({fnFilter = null} = {}) {
		const sources = fnFilter
			? Blacklist._ALL_SOURCES.filter(source => fnFilter(source))
			: Blacklist._ALL_SOURCES;
		sources
			.forEach(source => {
				const item = Blacklist._list.items.find(it => it.data.hash === "*" && it.data.category === "*" && it.data.source === source);
				if (item) {
					Blacklist._remove(item.ix, "*", "*", source, {isSkipListUpdate: true});
				}
			});
		Blacklist._list.update();
	}

	static _addAllUa () { this._addMassSources({fnFilter: SourceUtil.isNonstandardSource}); }
	static _removeAllUa () { this._removeMassSources({fnFilter: SourceUtil.isNonstandardSource}); }

	static _addAllSources () { this._addMassSources(); }
	static _removeAllSources () { this._removeMassSources(); }

	static _addAllComedySources () { this._addMassSources({fnFilter: source => Parser.SOURCES_COMEDY.has(source)}); }
	static _removeAllComedySources () { this._removeMassSources({fnFilter: source => Parser.SOURCES_COMEDY.has(source)}); }

	static _addAllNonForgottenRealms () { this._addMassSources({fnFilter: source => Parser.SOURCES_NON_FR.has(source)}); }
	static _removeAllNonForgottenRealms () { this._removeMassSources({fnFilter: source => Parser.SOURCES_NON_FR.has(source)}); }

	static _remove (ix, hash, category, source, {isSkipListUpdate = false} = {}) {
		ExcludeUtil.removeExclude(hash, category, source);
		Blacklist._list.removeItem(ix);
		if (!isSkipListUpdate) Blacklist._list.update();
	}

	static _export () {
		DataUtil.userDownload(`content-blacklist`, {fileType: "content-blacklist", blacklist: ExcludeUtil.getList()});
	}

	static async _pImport (evt) {
		const {jsons, errors} = await DataUtil.pUserUpload({expectedFileType: "content-blacklist"});

		DataUtil.doHandleFileLoadErrorsGeneric(errors);

		if (!jsons?.length) return;

		// clear list display
		Blacklist._list.removeAllItems();
		Blacklist._list.update();

		const json = jsons[0];

		// update storage
		if (!evt.shiftKey) await ExcludeUtil.pSetList(json.blacklist || []);
		else await ExcludeUtil.pSetList(ExcludeUtil.getList().concat(json.blacklist || []));

		// render list display
		Blacklist._renderList();
	}

	static reset () {
		ExcludeUtil.resetExcludes();
		Blacklist._list.removeAllItems();
		Blacklist._list.update();
	}
}
Blacklist._IGNORED_CATEGORIES = new Set([
	"_meta",
	"linkedLootTables",
]);
Blacklist._SUB_BLACKLIST_ENTRIES = {};
Blacklist._BASIC_FILES = [
	"adventures.json",
	"backgrounds.json",
	"books.json",
	"cultsboons.json",
	"deities.json",
	"feats.json",
	"magicvariants.json",
	"optionalfeatures.json",
	"objects.json",
	"psionics.json",
	"races.json",
	"recipes.json",
	"rewards.json",
	"trapshazards.json",
	"variantrules.json",
];

Blacklist._ALL_SOURCES = null;
Blacklist._ALL_CATEGORIES = null;

Blacklist._comp = null;

Blacklist._$wrpSelName = null;
Blacklist._metaSelName = null;

Blacklist.Component = class extends BaseComponent {
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
			},
		};
	}
}

window.addEventListener("load", async () => {
	await ExcludeUtil.pInitialise();
	Blacklist.pInitialise();
});

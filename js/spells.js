"use strict";

const JSON_DIR = "data/spells/";

const SUBCLASS_LOOKUP = {};

class SpellsPage extends ListPage {
	constructor () {
		super({
			pageFilter: new PageFilterSpells(),

			sublistClass: "subspells",

			dataProp: ["spell"],
		})
		this._multiSource = new MultiSource({
			fnHandleData: this._addSpells.bind(this),
			prop: "spell",
		});

		this._seenHashes = new Set();

		this._spellBookView = null;

		this._lastFilterValues = null;
	}

	getListItem (spell, spI) {
		const hash = UrlUtil.autoEncodeHash(spell);
		if (!spell.uniqueId && this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		const isExcluded = ExcludeUtil.isExcluded(hash, "spell", spell.source);

		this._pageFilter.mutateAndAddToFilters(spell, isExcluded);

		const source = Parser.sourceJsonToAbv(spell.source);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const concentration = spell._isConc ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		const eleLi = e_({
			tag: "div",
			clazz: `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`,
			click: (evt) => this._list.doSelect(listItem, evt),
			contextmenu: (evt) => ListUtil.openContextMenu(evt, this._list, listItem),
			children: [
				e_({
					tag: "a",
					href: `#${hash}`,
					clazz: "lst--border lst__row-inner",
					children: [
						e_({tag: "span", clazz: `bold col-2-9 pl-0`, text: spell.name}),
						e_({tag: "span", clazz: `col-1-5 text-center`, text: PageFilterSpells.getTblLevelStr(spell)}),
						e_({tag: "span", clazz: `col-1-7 text-center`, text: time}),
						e_({
							tag: "span",
							clazz: `col-1-2 sp__school-${spell.school} text-center`,
							title: Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools),
							style: Parser.spSchoolAbvToStylePart(spell.school),
							text: school,
						}),
						e_({tag: "span", clazz: `col-0-6 text-center`, title: "Concentration", text: concentration}),
						e_({tag: "span", clazz: `col-2-4 text-right`, text: range}),
						e_({
							tag: "span",
							clazz: `col-1-7 text-center ${Parser.sourceJsonToColor(spell.source)} pr-0`,
							style: BrewUtil.sourceJsonToStylePart(spell.source),
							title: `${Parser.sourceJsonToFull(spell.source)}${Renderer.utils.getSourceSubText(spell)}`,
							text: source,
						}),
					],
				}),
			],
		});

		const listItem = new ListItem(
			spI,
			eleLi,
			spell.name,
			{
				hash,
				source,
				level: spell.level,
				time,
				school: Parser.spSchoolAbvToFull(spell.school),
				classes: Parser.spClassesToFull(spell, true, SUBCLASS_LOOKUP),
				concentration,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
			{
				uniqueId: spell.uniqueId ? spell.uniqueId : spI,
				isExcluded,
			},
		);

		return listItem;
	}

	handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => {
			const s = this._dataList[li.ix];
			return this._pageFilter.toDisplay(f, s);
		});
		this._multiSource.onFilterChangeMulti(this._dataList, f);
	}

	getSublistItem (spell, ix) {
		const hash = UrlUtil.autoEncodeHash(spell);
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const concentration = spell._isConc ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${UrlUtil.autoEncodeHash(spell)}" title="${spell.name}" class="lst--border lst__row-inner">
				<span class="bold col-3-2 pl-0">${spell.name}</span>
				<span class="capitalise col-1-5 text-center">${PageFilterSpells.getTblLevelStr(spell)}</span>
				<span class="col-1-8 text-center">${time}</span>
				<span class="capitalise col-1-6 sp__school-${spell.school} text-center" title="${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}" ${Parser.spSchoolAbvToStyle(spell.school)}>${school}</span>
				<span class="concentration--sublist col-0-7 text-center" title="Concentration">${concentration}</span>
				<span class="range col-3-2 pr-0 text-right">${range}</span>
			</a>
		</div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			spell.name,
			{
				hash,
				school,
				level: spell.level,
				time,
				concentration,
				range,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		Renderer.get().setFirstSection(true);
		this._$pgContent.empty();
		const spell = this._dataList[id];

		const buildStatsTab = () => {
			this._$pgContent.append(RenderSpells.$getRenderedSpell(spell, SUBCLASS_LOOKUP));
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				entity: spell,
				pFnGetFluff: Renderer.spell.pGetFluff,
			});
		};

		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Spell",
				fnPopulate: buildStatsTab,
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnPopulate: buildFluffTab,
				isVisible: Renderer.utils.hasFluffText(spell, "spellFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(spell, "spellFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._pageFilter.filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub, this.pPreloadSublistSources.bind(this));

		await this._spellBookView.pHandleSub(sub);
	}

	async pOnLoad () {
		this._$pgContent = $(`#pagecontent`);

		window.loadHash = this.doLoadHash.bind(this);
		window.loadSubHash = this.pDoLoadSubHash.bind(this);
		window.pHandleUnknownHash = this.pHandleUnknownHash.bind(this);

		await this._pageFilter.pInitFilterBox({
			$iptSearch: $(`#lst__search`),
			$wrpFormTop: $(`#filter-search-group`),
			$btnReset: $(`#reset`),
		});

		const [subclassLookup] = await Promise.all([
			DataUtil.class.pGetSubclassLookup(),
			ExcludeUtil.pInitialise(),
		]);
		Object.assign(SUBCLASS_LOOKUP, subclassLookup);
		await this._multiSource.pMultisourceLoad(
			JSON_DIR,
			this._pageFilter.filterBox,
			this._pPageInit.bind(this),
			this._addSpells.bind(this),
			this._pPostLoad.bind(this),
		);
		if (Hist.lastLoadedId == null) Hist._freshLoad();
		ListPage._checkShowAllExcluded(this._dataList, this._$pgContent);

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	// TODO refactor this and bestiary markdown section
	static popoutHandlerGenerator (toList) {
		return (evt) => {
			if (Hist.lastLoadedId !== null) {
				const toRender = toList[Hist.lastLoadedId];

				if (evt.shiftKey) {
					const $content = Renderer.hover.$getHoverContent_statsCode(toRender);
					Renderer.hover.getShowWindow(
						$content,
						Renderer.hover.getWindowPositionFromEvent(evt),
						{
							title: `${toRender.name} \u2014 Source Data`,
							isPermanent: true,
							isBookContent: true,
						},
					);
				} else if (evt.ctrlKey || evt.metaKey) {
					const name = `${toRender._displayName || toRender.name} \u2014 Markdown`;
					const mdText = RendererMarkdown.get().render({entries: [{type: "dataSpell", dataSpell: toRender}]});
					const $content = Renderer.hover.$getHoverContent_miscCode(name, mdText);

					Renderer.hover.getShowWindow(
						$content,
						Renderer.hover.getWindowPositionFromEvent(evt),
						{
							title: name,
							isPermanent: true,
							isBookContent: true,
						},
					);
				} else {
					Renderer.hover.doPopoutCurPage(evt, toList[Hist.lastLoadedId]);
				}
			}
		}
	}

	async _pPostLoad () {
		const homebrew = await BrewUtil.pAddBrewData();
		await this._handleBrew(homebrew);
		BrewUtil.bind({list: this._list, pHandleBrew: this._handleBrew.bind(this)});
		BrewUtil.makeBrewButton("manage-brew");
		BrewUtil.bind({filterBox: this._pageFilter.filterBox, sourceFilter: this._pageFilter.sourceFilter});
		await ListUtil.pLoadState();

		ListUtil.bindShowTableButton(
			"btn-show-table",
			"Spells",
			this._dataList,
			{
				name: {name: "Name", transform: true},
				source: {name: "Source", transform: (it) => `<span class="${Parser.sourceJsonToColor(it)}" title="${Parser.sourceJsonToFull(it)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${Parser.sourceJsonToAbv(it)}</span>`},
				level: {name: "Level", transform: (it) => Parser.spLevelToFull(it)},
				time: {name: "Casting Time", transform: (it) => PageFilterSpells.getTblTimeStr(it[0])},
				duration: {name: "Duration", transform: (it) => Parser.spDurationToFull(it)},
				_school: {name: "School", transform: (sp) => `<span class="sp__school-${sp.school}" ${Parser.spSchoolAbvToStyle(sp.school)}>${Parser.spSchoolAndSubschoolsAbvsToFull(sp.school, sp.subschools)}</span>`},
				range: {name: "Range", transform: (it) => Parser.spRangeToFull(it)},
				_components: {name: "Components", transform: (sp) => Parser.spComponentsToFull(sp.components, sp.level)},
				_classes: {
					name: "Classes",
					transform: (sp) => {
						const fromClassList = Renderer.spell.getCombinedClasses(sp, "fromClassList");
						return Parser.spMainClassesToFull(fromClassList);
					},
				},
				entries: {name: "Text", transform: (it) => Renderer.get().render({type: "entries", entries: it}, 1), flex: 3},
				entriesHigherLevel: {name: "At Higher Levels", transform: (it) => Renderer.get().render({type: "entries", entries: (it || [])}, 1), flex: 2},
			},
			{generator: ListUtil.basicFilterGenerator},
			(a, b) => SortUtil.ascSort(a.name, b.name) || SortUtil.ascSort(a.source, b.source),
		);
	}

	_handleBrew (homebrew) {
		DataUtil.class.mergeHomebrewSubclassLookup(SUBCLASS_LOOKUP, homebrew);
		this._addSpells(homebrew.spell);
		return Promise.resolve();
	}

	async _pPageInit (loadedSources) {
		Object.keys(loadedSources)
			.map(src => new FilterItem({item: src, pFnChange: this._multiSource.pLoadSource.bind(this._multiSource)}))
			.forEach(fi => this._pageFilter.sourceFilter.addItem(fi));

		this._list = ListUtil.initList({
			listClass: "spells",
			fnSort: PageFilterSpells.sortSpells,
			syntax: this._listSyntax,
			isBindFindHotkey: true,
		});
		ListUtil.setOptions({primaryLists: [this._list]});
		SortUtil.initBtnSortHandlers($(`#filtertools`), this._list);

		const $outVisibleResults = $(`.lst__wrp-search-visible`);
		this._list.on("updated", () => {
			$outVisibleResults.html(`${this._list.visibleItems.length}/${this._list.items.length}`);
		});

		// filtering function
		this._pageFilter.filterBox.on(
			FilterBox.EVNT_VALCHANGE,
			this.handleFilterChange.bind(this),
		);

		this._listSub = ListUtil.initSublist({
			listClass: "subspells",
			fnSort: PageFilterSpells.sortSpells,
		});
		SortUtil.initBtnSortHandlers($("#sublistsort"), this._listSub);
		ListUtil.initGenericPinnable();

		this._spellBookView = new BookModeView({
			hashKey: "bookview",
			$openBtn: $(`#btn-spellbook`),
			$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple spells, please first make a list</span>`),
			pageTitle: "Spells Book View",
			popTblGetNumShown: ($wrpContent, $dispName, $wrpControls) => {
				const toShow = ListUtil.getSublistedIds().map(id => this._dataList[id])
					.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

				const renderSpell = (stack, sp) => {
					stack.push(`<div class="bkmv__wrp-item"><table class="stats stats--book stats--bkmv"><tbody>`);
					stack.push(Renderer.spell.getCompactRenderedString(sp));
					stack.push(`</tbody></table></div>`);
				};

				let lastOrder = StorageUtil.syncGetForPage(SpellsPage._BOOK_VIEW_MODE_K);
				if (lastOrder != null) lastOrder = `${lastOrder}`;

				const $selSortMode = $(`<select class="form-control input-sm">
					<option value="0">Spell Level</option>
					<option value="1">Alphabetical</option>
				</select>`)
					.change(() => {
						if (!toShow.length && Hist.lastLoadedId != null) return;

						const val = Number($selSortMode.val());
						if (val === 0) renderByLevel();
						else renderByAlpha();

						StorageUtil.syncSetForPage(SpellsPage._BOOK_VIEW_MODE_K, val);
					});
				if (lastOrder != null) $selSortMode.val(lastOrder);

				$$`<div class="flex-vh-center ml-3"><div class="mr-2 no-wrap">Sort order:</div>${$selSortMode}</div>`.appendTo($wrpControls);

				// region Markdown
				// TODO refactor this and bestiary markdown section
				const getAsMarkdown = () => {
					const toRender = toShow.length ? toShow : [this._dataList[Hist.lastLoadedId]];
					const parts = [...toRender]
						.sort((a, b) => lastOrder === "0" ? SortUtil.ascSort(a.level, b.level) : SortUtil.ascSortLower(a.name, b.name))
						.map(sp => RendererMarkdown.get().render({type: "dataSpell", dataSpell: sp}).trim());

					const out = [];
					let charLimit = RendererMarkdown._PAGE_CHARS;
					for (let i = 0; i < parts.length; ++i) {
						const part = parts[i];
						out.push(part);

						if (i < parts.length - 1) {
							if ((charLimit -= part.length) < 0) {
								if (RendererMarkdown._isAddPageBreaks) out.push("", "\\pagebreak", "");
								charLimit = RendererMarkdown._PAGE_CHARS;
							}
						}
					}

					return out.join("\n\n");
				};

				const $btnDownloadMarkdown = $(`<button class="btn btn-default btn-sm">Download as Markdown</button>`)
					.click(() => DataUtil.userDownloadText("spells.md", getAsMarkdown()));

				const $btnCopyMarkdown = $(`<button class="btn btn-default btn-sm px-2" title="Copy Markdown to Clipboard"><span class="glyphicon glyphicon-copy"/></button>`)
					.click(async () => {
						await MiscUtil.pCopyTextToClipboard(await getAsMarkdown());
						JqueryUtil.showCopiedEffect($btnCopyMarkdown);
					});

				const $btnDownloadMarkdownSettings = $(`<button class="btn btn-default btn-sm px-2" title="Markdown Settings"><span class="glyphicon glyphicon-cog"/></button>`)
					.click(async () => RendererMarkdown.pShowSettingsModal());

				$$`<div class="flex-v-center btn-group ml-3">
					${$btnDownloadMarkdown}
					${$btnCopyMarkdown}
					${$btnDownloadMarkdownSettings}
				</div>`.appendTo($wrpControls);
				// endregion

				const renderByLevel = () => {
					const stack = [];
					for (let i = 0; i < 10; ++i) {
						const atLvl = toShow.filter(sp => sp.level === i);
						if (atLvl.length) {
							stack.push(`<div class="w-100 h-100 bkmv__no-breaks">`);
							stack.push(`<div class="bkmv__spacer-name flex-v-center no-shrink">${Parser.spLevelToFullLevelText(i)}</div>`);
							atLvl.forEach(sp => renderSpell(stack, sp));
							stack.push(`</div>`);
						}
					}
					$wrpContent.empty().append(stack.join(""));
					lastOrder = "0";
				};

				const renderByAlpha = () => {
					const stack = [];
					toShow.forEach(sp => renderSpell(stack, sp));
					$wrpContent.empty().append(stack.join(""));
					lastOrder = "1";
				};

				const renderNoneSelected = () => {
					const stack = [];
					stack.push(`<div class="w-100 h-100 no-breaks">`);
					const sp = this._dataList[Hist.lastLoadedId];
					renderSpell(stack, sp);
					$dispName.text(Parser.spLevelToFullLevelText(sp.level));
					stack.push(`</div>`);
					$wrpContent.empty().append(stack.join(""));
				};

				if (!toShow.length && Hist.lastLoadedId != null) renderNoneSelected();
				else if (lastOrder === 1) renderByAlpha();
				else renderByLevel();

				return toShow.length;
			},
			hasPrintColumns: true,
		});

		const homebrew = await BrewUtil.pAddBrewData();
		Renderer.spell.populateHomebrewLookup(homebrew);

		return {list: this._list, listSub: this._listSub};
	}

	_addSpells (data) {
		if (!data || !data.length) return;

		this._dataList.push(...data);

		for (; this._ixData < this._dataList.length; this._ixData++) {
			const spell = this._dataList[this._ixData];
			const listItem = this.getListItem(spell, this._ixData);
			if (!listItem) continue;
			this._list.addItem(listItem);
		}
		this._list.update();

		this._pageFilter.filterBox.render();
		this.handleFilterChange();

		ListUtil.setOptions({
			itemList: this._dataList,
			pGetSublistRow: this.getSublistItem.bind(this),
			primaryLists: [this._list],
		});
		ListUtil.bindPinButton();
		const $btnPop = ListUtil.getOrTabRightButton(`btn-popout`, `new-window`);
		Renderer.hover.bindPopoutButton(
			$btnPop,
			this._dataList,
			{
				handlerGenerator: SpellsPage.popoutHandlerGenerator.bind(SpellsPage),
				title: "Popout Window (SHIFT for Source Data; CTRL for Markdown Render)",
			},
		);
		UrlUtil.bindLinkExportButton(this._pageFilter.filterBox);
		ListUtil.bindOtherButtons({
			download: true,
			upload: {
				pFnPreLoad: this.pPreloadSublistSources.bind(this),
			},
			sendToBrew: {
				mode: "spellBuilder",
				fnGetMeta: () => ({
					page: UrlUtil.getCurrentPage(),
					source: Hist.getHashSource(),
					hash: Hist.getHashParts()[0],
				}),
			},
		});
	}

	_getSearchCache (entity) {
		if (this.constructor._INDEXABLE_PROPS.every(it => !entity[it])) return "";
		const ptrOut = {_: ""};
		this.constructor._INDEXABLE_PROPS.forEach(it => this._getSearchCache_handleEntryProp(entity, it, ptrOut));
		return ptrOut._;
	}

	async pPreloadSublistSources (json) {
		const loaded = Object.keys(this._multiSource.loadedSources)
			.filter(it => this._multiSource.loadedSources[it].loaded);
		const lowerSources = json.sources.map(it => it.toLowerCase());
		const toLoad = Object.keys(this._multiSource.loadedSources)
			.filter(it => !loaded.includes(it))
			.filter(it => lowerSources.includes(it.toLowerCase()));
		const loadTotal = toLoad.length;
		if (loadTotal) {
			await Promise.all(toLoad.map(src => this._multiSource.pLoadSource(src, "yes")));
		}
	}

	async pHandleUnknownHash (link, sub) {
		const src = Object.keys(this._multiSource.loadedSources)
			.find(src => src.toLowerCase() === (UrlUtil.decodeHash(link)[1] || "").toLowerCase());
		if (src) {
			await this._multiSource.pLoadSource(src, "yes");
			Hist.hashChange();
		}
	}
}
SpellsPage._BOOK_VIEW_MODE_K = "bookViewMode";
SpellsPage._INDEXABLE_PROPS = [
	"entries",
	"entriesHigherLevel",
];

const spellsPage = new SpellsPage();
window.addEventListener("load", () => spellsPage.pOnLoad());

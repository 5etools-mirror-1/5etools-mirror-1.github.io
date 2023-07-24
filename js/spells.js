"use strict";

class SpellsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subspells",
			sublistListOptions: {
				fnSort: PageFilterSpells.sortSpells,
			},
		});
	}

	pGetSublistItem (spell, hash) {
		const school = Parser.spSchoolAndSubschoolsAbvsShort(spell.school, spell.subschools);
		const time = PageFilterSpells.getTblTimeStr(spell.time[0]);
		const concentration = spell._isConc ? "×" : "";
		const range = Parser.spRangeToFull(spell.range);

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${UrlUtil.autoEncodeHash(spell)}" title="${spell.name}" class="lst--border lst__row-inner">
				<span class="bold col-3-2 pl-0">${spell.name}</span>
				<span class="capitalize col-1-5 ve-text-center">${PageFilterSpells.getTblLevelStr(spell)}</span>
				<span class="col-1-8 ve-text-center">${time}</span>
				<span class="capitalize col-1-6 sp__school-${spell.school} ve-text-center" title="${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}" ${Parser.spSchoolAbvToStyle(spell.school)}>${school}</span>
				<span class="concentration--sublist col-0-7 ve-text-center" title="Concentration">${concentration}</span>
				<span class="range col-3-2 pr-0 text-right">${range}</span>
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
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
			{
				entity: spell,
			},
		);
		return listItem;
	}
}

class SpellsPageSettingsManager extends ListPageSettingsManager {
	_getSettings () {
		return {
			...RenderSpells.SETTINGS,
		};
	}
}

class SpellPageBookView extends ListPageBookView {
	static _BOOK_VIEW_MODE_K = "bookViewMode";

	constructor (opts) {
		super({
			pageTitle: "Spells Book View",
			namePlural: "spells",
			propMarkdown: "spell",
			...opts,
		});

		this._bookViewLastOrder = null;
	}

	_getSorted (a, b) {
		return this._bookViewLastOrder === "0" ? SortUtil.ascSort(a.level, b.level) : SortUtil.ascSortLower(a.name, b.name);
	}

	async _pGetRenderContentMeta ({$wrpContent, $wrpControls}) {
		$wrpContent.addClass("p-2");

		this._bookViewToShow = this._sublistManager.getSublistedEntities()
			.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

		let isAnyEntityRendered = false;

		const renderSpell = (stack, sp) => {
			isAnyEntityRendered = true;
			stack.push(`<div class="bkmv__wrp-item ve-inline-block print__ve-block print__my-2"><table class="w-100 stats stats--book stats--bkmv"><tbody>`);
			stack.push(Renderer.spell.getCompactRenderedString(sp));
			stack.push(`</tbody></table></div>`);
		};

		this._bookViewLastOrder = StorageUtil.syncGetForPage(SpellPageBookView._BOOK_VIEW_MODE_K);
		if (this._bookViewLastOrder != null) this._bookViewLastOrder = `${this._bookViewLastOrder}`;

		const $selSortMode = $(`<select class="form-control input-sm">
			<option value="0">Spell Level</option>
			<option value="1">Alphabetical</option>
		</select>`)
			.change(() => {
				if (!this._bookViewToShow.length && Hist.lastLoadedId != null) return;

				const val = $selSortMode.val();
				if (val === "0") renderByLevel();
				else renderByAlpha();

				StorageUtil.syncSetForPage(SpellPageBookView._BOOK_VIEW_MODE_K, val);
			});
		if (this._bookViewLastOrder != null) $selSortMode.val(this._bookViewLastOrder);

		$$`<div class="ve-flex-vh-center ml-3"><div class="mr-2 no-wrap">Sort order:</div>${$selSortMode}</div>`.appendTo($wrpControls);

		// region Markdown
		this._$getControlsMarkdown().appendTo($wrpControls);
		// endregion

		const renderByLevel = () => {
			const stack = [];
			for (let i = 0; i < 10; ++i) {
				const atLvl = this._bookViewToShow.filter(sp => sp.level === i);
				if (atLvl.length) {
					stack.push(`<div class="bkmv__no-breaks">`);
					stack.push(`<div class="bkmv__spacer-name ve-flex-v-center no-shrink no-print">${Parser.spLevelToFullLevelText(i)}</div>`);
					atLvl.forEach(sp => renderSpell(stack, sp));
					stack.push(`</div>`);
				}
			}
			$wrpContent.empty().append(stack.join(""));
			this._bookViewLastOrder = "0";
		};

		const renderByAlpha = () => {
			const stack = [];
			this._bookViewToShow.forEach(sp => renderSpell(stack, sp));
			$wrpContent.empty().append(stack.join(""));
			this._bookViewLastOrder = "1";
		};

		const renderNoneSelected = () => {
			const stack = [];
			stack.push(`<div class="w-100 h-100 no-breaks">`);
			renderSpell(stack, this._fnGetEntLastLoaded());
			stack.push(`</div>`);
			$wrpContent.empty().append(stack.join(""));
		};

		if (!this._bookViewToShow.length && Hist.lastLoadedId != null) renderNoneSelected();
		else if (this._bookViewLastOrder === "1") renderByAlpha();
		else renderByLevel();

		return {
			cntSelectedEnts: this._bookViewToShow.length,
			isAnyEntityRendered,
		};
	}
}

class SpellsPage extends ListPageMultiSource {
	constructor () {
		const pFnGetFluff = Renderer.spell.pGetFluff.bind(Renderer.spell);

		super({
			pageFilter: new PageFilterSpells(),

			listClass: "spells",
			listOptions: {
				fnSort: PageFilterSpells.sortSpells,
			},

			dataProps: ["spell"],

			pFnGetFluff,

			bookViewOptions: {
				ClsBookView: SpellPageBookView,
			},

			tableViewOptions: {
				title: "Spells",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					level: {name: "Level", transform: (it) => Parser.spLevelToFull(it)},
					time: {name: "Casting Time", transform: (it) => PageFilterSpells.getTblTimeStr(it[0])},
					duration: {name: "Duration", transform: (it) => Parser.spDurationToFull(it)},
					_school: {
						name: "School",
						transform: (sp) => {
							const ptMeta = Parser.spMetaToArr(sp.meta);
							return `<span class="sp__school-${sp.school}" ${Parser.spSchoolAbvToStyle(sp.school)}>${Parser.spSchoolAndSubschoolsAbvsToFull(sp.school, sp.subschools)}</span>${ptMeta.length ? ` (${ptMeta.join(", ")})` : ""}`;
						},
					},
					range: {name: "Range", transform: (it) => Parser.spRangeToFull(it)},
					_components: {name: "Components", transform: (sp) => Parser.spComponentsToFull(sp.components, sp.level, {isPlainText: true})},
					_classes: {
						name: "Classes",
						transform: (sp) => {
							const [current] = Parser.spClassesToCurrentAndLegacy(Renderer.spell.getCombinedClasses(sp, "fromClassList"));
							return Parser.spMainClassesToFull(current);
						},
					},
					_classesVariant: {
						name: "Optional/Variant Classes",
						transform: (sp) => {
							const [current] = Parser.spVariantClassesToCurrentAndLegacy(Renderer.spell.getCombinedClasses(sp, "fromClassListVariant"));
							return Parser.spMainClassesToFull(current);
						},
					},
					entries: {name: "Text", transform: (it) => Renderer.get().render({type: "entries", entries: it}, 1), flex: 3},
					entriesHigherLevel: {name: "At Higher Levels", transform: (it) => Renderer.get().render({type: "entries", entries: (it || [])}, 1), flex: 2},
				},
			},

			isMarkdownPopout: true,

			propLoader: "spell",

			listSyntax: new ListSyntaxSpells({fnGetDataList: () => this._dataList, pFnGetFluff}),

			compSettings: new SpellsPageSettingsManager(),
		});

		this._lastFilterValues = null;
		this._subclassLookup = {};
		this._bookViewLastOrder = null;
	}

	get _bindOtherButtonsOptions () {
		return {
			upload: {
				pFnPreLoad: (...args) => this.pPreloadSublistSources(...args),
			},
			sendToBrew: {
				mode: "spellBuilder",
				fnGetMeta: () => ({
					page: UrlUtil.getCurrentPage(),
					source: Hist.getHashSource(),
					hash: Hist.getHashParts()[0],
				}),
			},
			other: [
				this._bindOtherButtonsOptions_openAsSinglePage({slugPage: "spells", fnGetHash: () => Hist.getHashParts()[0]}),
			].filter(Boolean),
		};
	}

	getListItem (spell, spI) {
		const hash = UrlUtil.autoEncodeHash(spell);
		if (this._seenHashes.has(hash)) return null;
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
			clazz: `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`,
			click: (evt) => this._list.doSelect(listItem, evt),
			contextmenu: (evt) => this._openContextMenu(evt, this._list, listItem),
			children: [
				e_({
					tag: "a",
					href: `#${hash}`,
					clazz: "lst--border lst__row-inner",
					children: [
						e_({tag: "span", clazz: `bold col-2-9 pl-0`, text: spell.name}),
						e_({tag: "span", clazz: `col-1-5 ve-text-center`, text: PageFilterSpells.getTblLevelStr(spell)}),
						e_({tag: "span", clazz: `col-1-7 ve-text-center`, text: time}),
						e_({
							tag: "span",
							clazz: `col-1-2 sp__school-${spell.school} ve-text-center`,
							title: Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools),
							style: Parser.spSchoolAbvToStylePart(spell.school),
							text: school,
						}),
						e_({tag: "span", clazz: `col-0-6 ve-text-center`, title: "Concentration", text: concentration}),
						e_({tag: "span", clazz: `col-2-4 text-right`, text: range}),
						e_({
							tag: "span",
							clazz: `col-1-7 ve-text-center ${Parser.sourceJsonToColor(spell.source)} pr-0`,
							style: Parser.sourceJsonToStylePart(spell.source),
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
				classes: Parser.spClassesToFull(spell, {isTextOnly: true, subclassLookup: this._subclassLookup}),
				concentration,
				normalisedTime: spell._normalisedTime,
				normalisedRange: spell._normalisedRange,
			},
			{
				isExcluded,
			},
		);

		return listItem;
	}

	_tabTitleStats = "Spell";

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderSpells.$getRenderedSpell(ent, this._subclassLookup, {settings: this._compSettings.getValues()}));
	}

	async _pOnLoad_pPreDataLoad () {
		const subclassLookup = await DataUtil.class.pGetSubclassLookup();
		Object.assign(this._subclassLookup, subclassLookup);
	}

	async _pOnLoad_pPreDataAdd () {
		Renderer.spell.populatePrereleaseLookup(await PrereleaseUtil.pGetBrewProcessed());
		Renderer.spell.populateBrewLookup(await BrewUtil2.pGetBrewProcessed());
	}

	async pPreloadSublistSources (json) {
		const loaded = Object.keys(this._loadedSources)
			.filter(it => this._loadedSources[it].loaded);
		const lowerSources = json.sources.map(it => it.toLowerCase());
		const toLoad = Object.keys(this._loadedSources)
			.filter(it => !loaded.includes(it))
			.filter(it => lowerSources.includes(it.toLowerCase()));
		const loadTotal = toLoad.length;
		if (loadTotal) {
			await Promise.all(toLoad.map(src => this._pLoadSource(src, "yes")));
		}
	}

	async pHandleUnknownHash (link, sub) {
		const src = Object.keys(this._loadedSources)
			.find(src => src.toLowerCase() === (UrlUtil.decodeHash(link)[1] || "").toLowerCase());
		if (src) {
			await this._pLoadSource(src, "yes");
			Hist.hashChange();
		}
	}
}

const spellsPage = new SpellsPage();
spellsPage.sublistManager = new SpellsSublistManager();
window.addEventListener("load", () => spellsPage.pOnLoad());

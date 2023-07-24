"use strict";

class MapsPage extends BaseComponent {
	static _STORAGE_STATE = "state";
	static _PROPS_NON_STORABLE_STATE = [
		"search",
	];
	static _PROP_PREFIX_DISPLAY = "isDisplay";

	static _RenderState = class {
		constructor () {
			this.isBubblingUp = false;
			this.isBubblingDown = false;
			this.eleStyle = null;
		}
	};

	constructor () {
		super();

		this.saveSettingsDebounced = MiscUtil.debounce(() => StorageUtil.pSetForPage(this.constructor._STORAGE_STATE, this.getBaseSaveableState()), 50);
	}

	getBaseSaveableState () {
		const cpy = MiscUtil.copyFast(this.__state);

		this.constructor._PROPS_NON_STORABLE_STATE
			.forEach(prop => delete cpy[prop]);

		return {
			state: cpy,
		};
	}

	async _pGetStoredState ({mapData}) {
		const savedState = await StorageUtil.pGetForPage(this.constructor._STORAGE_STATE);
		if (!savedState) return savedState;

		const cpy = MiscUtil.copyFast(savedState);

		// region Remove keys for invalid sources/chapters
		const validPropsDisplay = new Set(
			Object.values(mapData)
				.flatMap(sourceMeta => [
					this._getPropsId(sourceMeta.id).propDisplaySource,
					...sourceMeta.chapters
						.map((_, ixChapter) => this._getPropsChapter(sourceMeta.id, ixChapter).propDisplayChapter),
				]),
		);

		Object.keys(cpy)
			.filter(k => k.startsWith(this.constructor._PROP_PREFIX_DISPLAY))
			.filter(k => !validPropsDisplay.has(k))
			.forEach(k => delete cpy[k]);
		// endregion

		return cpy;
	}

	async pOnLoad () {
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		await ExcludeUtil.pInitialise();

		const mapData = await this._pGetMapData();

		const savedState = await this._pGetStoredState({mapData});
		if (savedState) this.setBaseSaveableStateFrom(savedState);

		this._addHookAllBase(() => this.saveSettingsDebounced());

		Renderer.get().setLazyImages(true);
		this._renderContent({mapData});
		Renderer.initLazyImageLoaders();
		Renderer.get().setLazyImages(false);

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	async _pGetMapData () {
		const mapDataBase = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-maps.json`);

		const mapData = {};

		// Apply the prerelease/brew data first, so the "official" data takes precedence, where required
		Object.assign(mapData, MiscUtil.copy(await this._pGetPrereleaseBrewMaps({brewUtil: BrewUtil2})));
		Object.assign(mapData, MiscUtil.copy(await this._pGetPrereleaseBrewMaps({brewUtil: PrereleaseUtil})));
		Object.assign(mapData, MiscUtil.copy(mapDataBase));

		return mapData;
	}

	async _pGetPrereleaseBrewMaps ({brewUtil}) {
		const brew = await brewUtil.pGetBrewProcessed();

		const tuples = [
			{prop: "adventure", propData: "adventureData"},
			{prop: "book", propData: "bookData"},
		]
			.map(({prop, propData}) => {
				if (!brew[prop]?.length || !brew[propData]?.length) return null;

				return brew[prop].map(head => {
					const body = brew[propData].find(body => body.id === head.id);
					if (!body) return null;
					return {prop, head, body: body.data};
				})
					.filter(Boolean);
			})
			.filter(Boolean)
			.flat();

		return tuples
			.mergeMap(({prop, head, body}) => MapsUtil.getImageData({prop, head, body}));
	}

	_getPropsId (id) {
		return {
			propDisplaySource: `${this.constructor._PROP_PREFIX_DISPLAY}Id_${id}`,
		};
	}

	_getPropsChapter (id, ixCh) {
		return {
			propDisplayChapter: `${this.constructor._PROP_PREFIX_DISPLAY}Chapter_${id}_${ixCh}`,
		};
	}

	_render_source ({source, sourceMeta, renderState, propsDisplaySource}) {
		const {propDisplaySource} = this._getPropsId(sourceMeta.id);
		if (this._state[propDisplaySource] === undefined) this.__state[propDisplaySource] = false;
		propsDisplaySource.push(propDisplaySource);

		const shortNameHtml = this._getShortNameHtml({source, sourceMeta});
		const titleName = this._getTitleName({source, sourceMeta});
		const searchName = this._getSearchName({source, sourceMeta});

		const propsDisplayChapter = [];
		const rendersChapter = sourceMeta.chapters
			.map((chapter, ixChapter) => this._render_chapter({chapter, ixChapter, propsDisplayChapter, renderState, source, sourceMeta, propDisplaySource}));

		// region Display
		const $wrpContent = $$`<div class="ve-flex-col w-100 px-4 py-2 maps-gallery__wrp-book">
			<h3 class="mt-0 mb-2">${Renderer.get().render(`{@${sourceMeta.prop} ${Parser.sourceJsonToFull(source)}|${sourceMeta.id}}`)}</h3>
			${rendersChapter.map(({$wrpContent}) => $wrpContent)}
			<hr class="hr-4">
		</div>`;
		// endregion

		// region Menu
		const $cbSource = ComponentUiUtil.$getCbBool(this, propDisplaySource, {isDisplayNullAsIndeterminate: true, isTreatIndeterminateNullAsPositive: true});

		const $wrpMenu = $$`<div class="ve-flex-col w-100">
			<label class="split-v-center maps-menu__label-cb pl-2 clickable">
				<div class="mr-3 text-clip-ellipsis" title="${titleName.qq()}">${shortNameHtml}</div>
				${$cbSource.addClass("no-shrink")}
			</label>
			<div class="ve-flex-col">
				${rendersChapter.map(({$wrpMenu}) => $wrpMenu)}
			</div>
		</div>`;
		// endregion

		const hkBubbleUp = () => {
			if (renderState.isBubblingDown) return;
			renderState.isBubblingUp = true;

			const sourceValues = propsDisplaySource.map(prop => this._state[prop]);

			if (sourceValues.every(it => it)) this._state.isAllChecked = true;
			else if (sourceValues.every(it => it === false)) this._state.isAllChecked = false;
			else this._state.isAllChecked = null;

			renderState.isBubblingUp = false;
		};
		this._addHookBase(propDisplaySource, hkBubbleUp);

		const hkBubbleDown = () => {
			if (renderState.isBubblingUp) return;
			renderState.isBubblingDown = true;

			if (this._state[propDisplaySource] != null) {
				const nxtVal = this._state[propDisplaySource];
				propsDisplayChapter.forEach(prop => this._state[prop] = nxtVal);
			}

			renderState.isBubblingDown = false;
		};
		this._addHookBase(propDisplaySource, hkBubbleDown);

		const hkDisplaySource = () => $wrpContent.toggleVe(this._state[propDisplaySource] !== false);
		this._addHookBase(propDisplaySource, hkDisplaySource);
		hkDisplaySource();

		const hkSearch = () => $wrpMenu.toggleVe(this._isVisibleSourceSearch({searchName}));
		this._addHookBase("search", hkSearch);
		hkSearch();

		return {$wrpMenu, $wrpContent, searchName, propDisplaySource};
	}

	_render_chapter ({chapter, ixChapter, propsDisplayChapter, renderState, source, sourceMeta, propDisplaySource}) {
		const {propDisplayChapter} = this._getPropsChapter(sourceMeta.id, ixChapter);
		if (this._state[propDisplayChapter] === undefined) this.__state[propDisplayChapter] = false;
		propsDisplayChapter.push(propDisplayChapter);

		const hkBubbleUp = () => {
			if (renderState.isBubblingDown) return;
			renderState.isBubblingUp = true;

			const chapterValues = propsDisplayChapter.map(prop => this._state[prop]);
			if (chapterValues.every(it => it)) this._state[propDisplaySource] = true;
			else if (chapterValues.every(it => it === false)) this._state[propDisplaySource] = false;
			else this._state[propDisplaySource] = null;

			renderState.isBubblingUp = false;
		};
		this._addHookBase(propDisplayChapter, hkBubbleUp);

		const $btnScrollTo = $(`<button class="btn btn-default btn-xxs maps-menu__btn-chapter-scroll no-shrink" title="Scroll To"><span class="glyphicon glyphicon-triangle-right"></span></button>`)
			.click(() => {
				if (!this._state[propDisplayChapter]) this._state[propDisplayChapter] = true;
				$wrpContent[0].scrollIntoView({block: "nearest", inline: "nearest"});
			});

		const $cbChapter = ComponentUiUtil.$getCbBool(this, propDisplayChapter, {isDisplayNullAsIndeterminate: true, isTreatIndeterminateNullAsPositive: true});

		const $wrpMenu = $$`<div class="ve-flex-v-center maps-menu__label-cb">
			${$btnScrollTo}
			<label class="split-v-center clickable w-100 min-w-0">
				<div class="mr-3 text-clip-ellipsis" title="${chapter.name.qq()}">${chapter.name}</div>
				${$cbChapter.addClass("no-shrink")}
			</label>
		</div>`;

		const $wrpContent = $$`<div class="ve-flex-col w-100 maps-gallery__wrp-chapter px-2 py-3 my-2 shadow-big">
			<h4 class="mt-0 mb-2">${Renderer.get().render(`{@${sourceMeta.prop} ${chapter.name}|${sourceMeta.id}|${chapter.ix}}`)}</h4>
			<div class="ve-flex ve-flex-wrap">${chapter.images.map(it => Renderer.get().render(it))}</div>
		</div>`;

		const hkDisplayChapter = () => $wrpContent.toggleVe(this._state[propDisplayChapter]);
		this._addHookBase(propDisplayChapter, hkDisplayChapter);
		hkDisplayChapter();

		return {$wrpMenu, $wrpContent};
	}

	_getShortNameHtml ({source, sourceMeta}) {
		if (!sourceMeta.parentSource) return Parser.sourceJsonToFull(source).qq();
		const fullSource = Parser.sourceJsonToFull(source);
		const fullParentSource = Parser.sourceJsonToFull(sourceMeta.parentSource);
		return fullSource.replace(new RegExp(`^${fullParentSource.escapeRegexp()}: `, "i"), `<span title="${Parser.sourceJsonToFull(sourceMeta.parentSource).qq()}">${Parser.sourceJsonToAbv(sourceMeta.parentSource).qq()}</span>: `);
	}

	_getTitleName ({source, sourceMeta}) {
		if (!sourceMeta.parentSource) return Parser.sourceJsonToFull(source).toLowerCase().trim();
		return `${Parser.sourceJsonToFull(sourceMeta.parentSource)}: ${Parser.sourceJsonToFull(source)}`.toLowerCase().trim();
	}

	_getSearchName ({source, sourceMeta}) {
		return this._getTitleName({source, sourceMeta}).toLowerCase().trim();
	}

	_isVisibleSourceSearch ({searchName}) { return searchName.includes(this._state.search.trim().toLowerCase()); }

	_renderContent ({mapData}) {
		const $root = $(`#content`);

		const renderState = new this.constructor._RenderState();

		const propsDisplaySource = [];
		const rendersSource = Object.entries(mapData)
			.filter(([, {source, prop}]) => !ExcludeUtil.isExcluded(UrlUtil.encodeForHash(source.toLowerCase()), prop, source, {isNoCount: true}))
			.map(([, sourceMeta]) => this._render_source({source: sourceMeta.source, sourceMeta, renderState, propsDisplaySource}));

		const hkBubbleDown = () => {
			if (renderState.isBubblingUp) return;
			renderState.isBubblingDown = true;

			let isAnyHidden = false;
			if (this._state.isAllChecked != null) {
				const nxtVal = this._state.isAllChecked;
				rendersSource.forEach(({propDisplaySource, searchName}) => {
					if (!this._isVisibleSourceSearch({searchName})) return isAnyHidden = true;
					this._state[propDisplaySource] = nxtVal;
				});
			}

			renderState.isBubblingDown = false;

			if (isAnyHidden) this._state.isAllChecked = null;
		};
		this._addHookBase("isAllChecked", hkBubbleDown);

		const {$wrp: $wrpIptSearch} = ComponentUiUtil.$getIptStr(this, "search", {placeholder: "Search sources...", decorationLeft: "search", decorationRight: "clear", asMeta: true});

		const $cbIsAllChecked = ComponentUiUtil.$getCbBool(this, "isAllChecked", {isDisplayNullAsIndeterminate: true, isTreatIndeterminateNullAsPositive: true});

		const $sldImageScale = ComponentUiUtil.$getSliderNumber(this, "imageScale", {min: 0.1, max: 2.0, step: 0.1});

		const hkImageScale = () => {
			if (!renderState.eleStyle) renderState.eleStyle = e_({tag: "style"}).appendTo(document.head);
			renderState.eleStyle.html(`
				.maps .rd__image { max-height: ${60 * this._state.imageScale}vh; }
			`);
		};
		this._addHookBase("imageScale", hkImageScale);
		hkImageScale();

		const $dispNoneVisible = $(`<div class="ve-flex-vh-center h-100 w-100">
			<div class="ve-flex ve-muted initial-message italic maps__disp-message-initial px-3">Select some sources to view from the sidebar</div>
		</div>`);
		const hkAnyVisible = () => $dispNoneVisible.toggleVe(this._state.isAllChecked === false);
		this._addHookBase("isAllChecked", hkAnyVisible);
		hkAnyVisible();

		$$($root.empty())`
			<div class="ve-flex-col h-100 no-shrink maps-menu pr-4 py-3 shadow-big overflow-y-auto smooth-scroll scrollbar-stable mobile__w-100 mobile__my-4">
				<label class="split-v-center pl-2 py-1">
					<div class="mr-3 no-shrink">Image Scale</div>
					${$sldImageScale}
				</label>

				<div class="split-v-center pl-2 py-1">
					${$wrpIptSearch.addClass("mr-3")}
					${$cbIsAllChecked.title("Select All")}
				</div>

				<hr class="hr-3">

				${rendersSource.map(({$wrpMenu}) => $wrpMenu)}
			</div>

			<div class="w-100 h-100 mobile__h-initial overflow-y-auto smooth-scroll ve-flex-col">
				${$dispNoneVisible}
				${rendersSource.map(({$wrpContent}) => $wrpContent)}
			</div>
		`;
	}

	_getDefaultState () {
		return {
			isAllChecked: false,
			imageScale: 0.6,
			search: "",
		};
	}
}

const mapsPage = new MapsPage();
window.addEventListener("load", () => mapsPage.pOnLoad());

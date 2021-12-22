class MapsPage extends BaseComponent {
	static _STORAGE_STATE = "state";
	static _PROPS_STORABLE_STATE = [
		"imageScale",
	];

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
		return {
			state: this.constructor._PROPS_STORABLE_STATE.mergeMap(prop => ({[prop]: this._state[prop]})),
		};
	}

	async pOnLoad () {
		const savedState = await StorageUtil.pGetForPage(this.constructor._STORAGE_STATE);
		if (savedState) this.setBaseSaveableStateFrom(savedState);

		const hkSave = () => this.saveSettingsDebounced();
		this.constructor._PROPS_STORABLE_STATE.forEach(prop => this._addHookBase(prop, hkSave));

		await ExcludeUtil.pInitialise();

		const mapData = await this._pGetMapData();

		Renderer.get().setLazyImages(true);
		this._renderContent({mapData});
		Renderer.initLazyImageLoaders();

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	async _pGetMapData () {
		const mapDataBase = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-maps.json`);
		const mapDataBrew = await this._pGetBrewMaps();

		const mapData = {};

		// Apply the brew data first, so the "official" data takes precedence, where required
		Object.assign(mapData, MiscUtil.copy(mapDataBrew));
		Object.assign(mapData, MiscUtil.copy(mapDataBase));

		return mapData;
	}

	async _pGetBrewMaps () {
		const brew = await BrewUtil.pAddBrewData();

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

	_getPropsSource (source) {
		return {
			propDisplaySource: `isDisplaySource_${source}`,
		};
	}

	_getPropsChapter (source, ixCh) {
		return {
			propDisplayChapter: `isDisplayChapter_${source}_${ixCh}`,
		};
	}

	_render_source ({source, sourceMeta, renderState, propsDisplaySource}) {
		const {propDisplaySource} = this._getPropsSource(source);
		if (this._state[propDisplaySource] === undefined) this.__state[propDisplaySource] = false;
		propsDisplaySource.push(propDisplaySource);

		const shortNameHtml = this._getShortNameHtml({source, sourceMeta});
		const titleName = this._getTitleName({source, sourceMeta});
		const searchName = this._getSearchName({source, sourceMeta});

		const propsDisplayChapter = [];
		const rendersChapter = sourceMeta.chapters
			.map((chapter, ixChapter) => this._render_chapter({chapter, ixChapter, propsDisplayChapter, renderState, source, propDisplaySource}));

		// region Display
		const $wrpContent = $$`<div class="flex-col w-100 px-4 py-2 maps-gallery__wrp-book">
			<h3 class="mt-0 mb-2">${Parser.sourceJsonToFull(source)}</h3>
			${rendersChapter.map(({$wrpContent}) => $wrpContent)}
			<hr class="hr-4">
		</div>`;
		// endregion

		// region Menu
		const $cbSource = ComponentUiUtil.$getCbBool(this, propDisplaySource, {displayNullAsIndeterminate: true});

		const $wrpMenu = $$`<div class="flex-col w-100">
			<label class="split-v-center maps-menu__label-cb pl-2 clickable">
				<div class="mr-3 text-clip-ellipsis" title="${titleName.qq()}">${shortNameHtml}</div>
				${$cbSource.addClass("no-shrink")}
			</label>
			<div class="flex-col">
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

	_render_chapter ({chapter, ixChapter, propsDisplayChapter, renderState, source, propDisplaySource}) {
		const {propDisplayChapter} = this._getPropsChapter(source, ixChapter);
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

		const $cbChapter = ComponentUiUtil.$getCbBool(this, propDisplayChapter, {displayNullAsIndeterminate: true});

		const $wrpMenu = $$`<label class="split-v-center maps-menu__label-cb maps-menu__label-cb--chapter clickable">
			<div class="mr-3 text-clip-ellipsis" title="${chapter.name.qq()}">${chapter.name}</div>
			${$cbChapter.addClass("no-shrink")}
		</label>`;

		const $wrpContent = $$`<div class="flex-col w-100 maps-gallery__wrp-chapter px-2 py-3 my-2 shadow-big">
			<h4 class="mt-0 mb-2">${chapter.name}</h4>
			<div class="flex flex-wrap">${chapter.images.map(it => Renderer.get().render(it))}</div>
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
			.filter(([source, {prop}]) => !ExcludeUtil.isExcluded(UrlUtil.encodeForHash(source.toLowerCase()), prop, source, {isNoCount: true}))
			.map(([source, sourceMeta]) => this._render_source({source, sourceMeta, renderState, propsDisplaySource}));

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

		const $cbIsAllChecked = ComponentUiUtil.$getCbBool(this, "isAllChecked", {displayNullAsIndeterminate: true});

		const $sldImageScale = ComponentUiUtil.$getSliderNumber(this, "imageScale", {min: 0.1, max: 2.0, step: 0.1});

		const hkImageScale = () => {
			if (!renderState.eleStyle) renderState.eleStyle = e_({tag: "style"}).appendTo(document.head);
			renderState.eleStyle.html(`
				.maps .rd__image { max-height: ${60 * this._state.imageScale}vh; }
			`);
		};
		this._addHookBase("imageScale", hkImageScale);
		hkImageScale();

		const $dispNoneVisible = $(`<div class="flex-vh-center ve-muted w-100 h-100 initial-message italic">Select some sources to view from the sidebar</div>`);
		const hkAnyVisible = () => $dispNoneVisible.toggleVe(this._state.isAllChecked === false);
		this._addHookBase("isAllChecked", hkAnyVisible);
		hkAnyVisible();

		$$($root.empty())`
			<div class="flex-col h-100 no-shrink maps-menu pr-4 py-3 shadow-big overflow-y-auto smooth-scroll scrollbar-stable mobile__w-100 mobile__my-4">
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

			<div class="w-100 h-100 mobile__h-initial overflow-y-auto smooth-scroll flex-col">
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

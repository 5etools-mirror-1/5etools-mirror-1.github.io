"use strict";

class SidemenuRenderCache {
	constructor ({$lastStageSaved, $lastWrpBtnLoadExisting}) {
		this.$lastStageSaved = $lastStageSaved;
		this.$lastWrpBtnLoadExisting = $lastWrpBtnLoadExisting;
	}
}

class SideMenuListRenderCache {
	constructor () {
		this._metas = [];
	}

	getIxMaxRendered () { return this._metas.length; }
	getMeta (ix) { return this._metas[ix]; }
	setMeta (ix, meta) { this._metas[ix] = meta; }
}

class PageUi {
	constructor () {
		this._builders = {};

		this._$menuInner = null;
		this._$selBuilderMode = null;
		this._$wrpSource = null;
		this._$wrpMain = null;
		this._$wrpInput = null;
		this._$wrpInputControls = null;
		this._$wrpOutput = null;

		this._allSources = [];
		this._$selSource = null;

		this.__saveableStates = null;
		this.doSaveDebounced = MiscUtil.debounce(() => this._doSave(), 50);

		this._settings = {};
		this._saveSettingsDebounced = MiscUtil.debounce(() => this._doSaveSettings(), 50);

		this._isLastRenderInputFail = false;

		this._sidemenuRenderCache = null;
		this._sidemenuListRenderCache = null;
	}

	set creatureBuilder (creatureBuilder) { this._builders.creatureBuilder = creatureBuilder; }
	set legendaryGroupBuilder (legendaryGroupBuilder) { this._builders.legendaryGroupBuilder = legendaryGroupBuilder; }
	set spellBuilder (spellBuilder) { this._builders.spellBuilder = spellBuilder; }

	get creatureBuilder () { return this._builders.creatureBuilder; }

	get activeBuilder () { return this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER; }

	get $wrpInput () { return this._$wrpInput; }

	get $wrpInputControls () { return this._$wrpInputControls; }

	get $wrpOutput () { return this._$wrpOutput; }

	get $wrpSideMenu () { return this._$menuInner; }

	get source () { return this._settings.activeSource || ""; }

	get allSources () { return this._allSources; }

	set source (json) {
		const prevSource = this._settings.activeSource;

		this._$selSource.val(json);
		this._settings.activeSource = json;
		this._doHandleUpdateSource();

		if (!prevSource && json) this.__setStageMain();
	}

	get sidemenuRenderCache () { return this._sidemenuRenderCache; }
	set sidemenuRenderCache (val) { this._sidemenuRenderCache = val; }

	_doSave () {
		this.__saveableStates = this.__saveableStates || {builders: {}};

		Object.entries(this._builders).forEach(([name, builder]) => {
			if (!this.__saveableStates.builders[name] || builder.isStateDirty) {
				this.__saveableStates.builders[name] = builder.getSaveableState();
				builder.isStateDirty = false;
			}
		});
		StorageUtil.pSetForPage(PageUi.STORAGE_STATE, this.__saveableStates);
	}

	_doSaveSettings () { StorageUtil.pSetForPage(PageUi.STORAGE_SETTINGS, this._settings); }

	async init () {
		this._settings = await StorageUtil.pGetForPage(PageUi.STORAGE_SETTINGS) || {};

		this._$wrpLoad = $(`#page_loading`);
		this._$wrpSource = $(`#page_source`);
		this._$wrpMain = $(`#page_main`);

		this._settings.activeBuilder = this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER;

		this._initLhs();
		this._initRhs();
		this._initSideMenu();

		const storedState = await StorageUtil.pGetForPage(PageUi.STORAGE_STATE) || {};
		if (storedState.builders) {
			Object.entries(storedState.builders).forEach(([name, state]) => {
				if (this._builders[name]) this._builders[name].setStateFromLoaded(state);
			});
		}

		this._doRenderActiveBuilder();
		this._doInitNavHandler();

		if (this._settings.activeSource && BrewUtil.homebrewMeta.sources.some(it => it.json === this._settings.activeSource)) {
			this.__setStageMain();
			this._sideMenuEnabled = true;
		} else if (BrewUtil.homebrewMeta.sources.length) {
			this._doRebuildStageSource({mode: "select", isRequired: true});
			this.__setStageSource();
		} else {
			this._doRebuildStageSource({mode: "add", isRequired: true});
			this.__setStageSource();
		}
	}

	__setStageSource () {
		this._$wrpLoad.hide();
		this._$wrpSource.show();
		this._$wrpMain.hide();
	}

	__setStageMain () {
		this._$wrpLoad.hide();
		this._$wrpSource.hide();
		this._$wrpMain.show();
	}

	_doRebuildStageSource (options) {
		SourceUiUtil.render({
			...options,
			$parent: this._$wrpSource,
			cbConfirm: (source, isNewSource) => {
				if (isNewSource) BrewUtil.addSource(source);
				else BrewUtil.updateSource(source);

				this._settings.activeSource = source.json;

				if (isNewSource) this._doAddSourceOption(source);
				this._doHandleUpdateSource();
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
			cbConfirmExisting: (source) => {
				this._settings.activeSource = source.json;
				this._doHandleUpdateSource();
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
			cbCancel: () => {
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
		});
	}

	_initLhs () {
		this._$wrpInput = $(`#content_input`);
		this._$wrpInputControls = $(`#content_input_controls`);
	}

	_initRhs () {
		this._$wrpOutput = $(`#content_output`);
	}

	getBuilderById (id) {
		id = id.toLowerCase().trim();
		const key = Object.keys(this._builders).find(k => k.toLowerCase().trim() === id);
		if (key) return this._builders[key];
	}

	setActiveBuilderById (id) {
		id = id.toLowerCase().trim();
		const key = Object.keys(this._builders).find(k => k.toLowerCase().trim() === id);
		this._setActiveBuilder(key);
	}

	_setActiveBuilder (nxtActiveBuilder) {
		if (!this._builders[nxtActiveBuilder]) throw new Error(`Builder "${nxtActiveBuilder}" does not exist!`);

		this._$selBuilderMode.val(nxtActiveBuilder);
		this._settings.activeBuilder = nxtActiveBuilder;
		if (!Hist.initialLoad) Hist.replaceHistoryHash(UrlUtil.encodeForHash(this._settings.activeBuilder));
		const builder = this._builders[this._settings.activeBuilder];
		builder.renderInput();
		builder.renderOutput();
		builder.renderSideMenu();
		this._saveSettingsDebounced();
	}

	_initSideMenu () {
		const $mnu = $(`.sidemenu`);

		const prevMode = this._settings.activeBuilder;

		const $wrpMode = $(`<div class="sidemenu__row split-v-center"><div class="sidemenu__row__label mr-2">Mode</div></div>`).appendTo($mnu);
		this._$selBuilderMode = $(`
			<select class="form-control input-xs">
				<option value="creatureBuilder">Creature</option>
				<option value="legendaryGroupBuilder">Legendary Group</option>
				<option value="spellBuilder">Spell</option>
				<option value="none" class="italic">Everything Else?</option>
			</select>
		`)
			.appendTo($wrpMode)
			.change(() => {
				const val = this._$selBuilderMode.val();
				if (val === "none") {
					InputUiUtil.pGetUserBoolean({
						title: "Homebrew Builder Support",
						htmlDescription: `<p>The Homebrew Builder only supports a limited set of entity types. For everything else, you will need to <a href="https://github.com/TheGiddyLimit/homebrew/blob/master/README.md" rel="noopener noreferrer">manually</a> create or convert content.</p>`,
						isAlert: true,
					});
					this._$selBuilderMode.val(this._settings.activeBuilder);
					return;
				}
				this._setActiveBuilder(val);
			});

		const $btnManageHomebrew = $(`<button class="btn btn-xs btn-info">Manage Homebrew</button>`)
			.click(() => BrewUtil.manageBrew());
		$$`<div class="sidemenu__row">${$btnManageHomebrew}</div>`.appendTo($mnu);

		$mnu.append(PageUi.__$getSideMenuDivider(true));

		const $wrpSource = $(`<div class="sidemenu__row split-v-center"><div class="sidemenu__row__label mr-2">Source</div></div>`).appendTo($mnu);
		this._allSources = (BrewUtil.homebrewMeta.sources || []).sort((a, b) => SortUtil.ascSortLower(a.full, b.full))
			.map(it => it.json);
		this._$selSource = $$`
			<select class="form-control input-xs">
				<option disabled>Select</option>
				${this._allSources.map(s => `<option value="${s.escapeQuotes()}">${Parser.sourceJsonToFull(s).escapeQuotes()}</option>`)}
			</select>`
			.appendTo($wrpSource)
			.change(() => {
				this._settings.activeSource = this._$selSource.val();
				this._doHandleUpdateSource();
			});
		if (this._settings.activeSource) this._$selSource.val(this._settings.activeSource);
		else this._$selSource[0].selectedIndex = 0;

		const $btnSourceEdit = $(`<button class="btn btn-default btn-xs mr-2">Edit Selected Source</button>`)
			.click(() => {
				const curSourceJson = this._settings.activeSource;
				const curSource = BrewUtil.sourceJsonToSource(curSourceJson);
				if (!curSource) return;
				this._doRebuildStageSource({mode: "edit", source: MiscUtil.copy(curSource)});
				this.__setStageSource();
			});
		$$`<div class="sidemenu__row">${$btnSourceEdit}</div>`.appendTo($mnu);

		const $btnSourceAdd = $(`<button class="btn btn-default btn-xs">Add New Source</button>`).click(() => {
			this._doRebuildStageSource({mode: "add"});
			this.__setStageSource();
		});
		$$`<div class="sidemenu__row">${$btnSourceAdd}</div>`.appendTo($mnu);

		$mnu.append(PageUi.__$getSideMenuDivider(true));
		this._$menuInner = $(`<div/>`).appendTo($mnu);

		if (prevMode) this._setActiveBuilder(prevMode);
	}

	set _sideMenuEnabled (val) { $(`.sidemenu__toggle`).toggle(!!val); }

	static __$getSideMenuDivider (heavy) {
		return $(`<hr class="sidemenu__row__divider ${heavy ? "sidemenu__row__divider--heavy" : ""}">`);
	}

	_doRenderActiveBuilder () {
		const activeBuilder = this._builders[this._settings.activeBuilder];
		activeBuilder.renderInput();
		activeBuilder.renderOutput();
	}

	_doInitNavHandler () {
		// More obnoxious than useful (the form is auto-saved automatically); disabled until further notice
		/*
		$(window).on("beforeunload", evt => {
			const message = this._builders[this._settings.activeBuilder].getOnNavMessage();
			if (message) {
				(evt || window.event).message = message;
				return message;
			}
		});
		*/
	}

	_doAddSourceOption (source) {
		this._allSources.push(source.json);
		// TODO this should detach + re-order. Ensure correct is re-selected; ensure disabled option is first
		this._$selSource.append(`<option value="${source.json.escapeQuotes()}">${source.full.escapeQuotes()}</option>`);
		this._builders[this._settings.activeBuilder].doHandleSourcesAdd();
	}

	_doHandleUpdateSource () {
		if (this._$selSource) this._$selSource.val(this._settings.activeSource);
		this._saveSettingsDebounced();
		this._builders[this._settings.activeBuilder].doHandleSourceUpdate();
	}

	_getJsonOutputTemplate () {
		const timestamp = Math.round(Date.now() / 1000);
		return {
			_meta: {
				sources: [MiscUtil.copy(BrewUtil.sourceJsonToSource(this._settings.activeSource))],
				dateAdded: timestamp,
				dateLastModified: timestamp,
			},
		};
	}
}
PageUi.STORAGE_STATE = "brewbuilderState";
PageUi.STORAGE_SETTINGS = "brewbuilderSettings";
PageUi._DEFAULT_ACTIVE_BUILDER = "creatureBuilder";

class Builder extends ProxyBase {
	static async pInitAll () {
		return Promise.all(Builder._BUILDERS.map(b => b.pInit()));
	}

	/**
	 * @param opts Options object.
	 * @param opts.titleSidebarLoadExisting Text for "Load Existing" sidebar button.
	 * @param opts.titleSidebarDownloadJson Text for "Download JSON" sidebar button.
	 * @param opts.metaSidebarDownloadMarkdown Meta for a "Download Markdown" sidebar button.
	 * @param opts.prop Homebrew prop.
	 * @param opts.typeRenderData Renderer "dataX" entry type.
	 */
	constructor (opts) {
		super();
		opts = opts || {};
		this._titleSidebarLoadExisting = opts.titleSidebarLoadExisting;
		this._titleSidebarDownloadJson = opts.titleSidebarDownloadJson;
		this._metaSidebarDownloadMarkdown = opts.metaSidebarDownloadMarkdown;
		this._prop = opts.prop;
		this._typeRenderData = opts.typeRenderData;

		Builder._BUILDERS.push(this);
		TabUiUtil.decorate(this);

		this._ui = null;
		this._isStateDirty = false;
		this._isEntrySaved = true;

		this._sourcesCache = []; // the JSON sources from the main UI
		this._$selSource = null;
		this._cbCache = null;

		this.__state = this._getInitialState();
		this._state = null; // proxy used to access state
		this.__meta = this.getInitialMetaState(); // meta state
		this._meta = null; // proxy used to access meta state
		this.doCreateProxies(); // init proxies

		this._$btnSave = null;
		this._$wrpBtnLoadExisting = null;
		this._$sideMenuStageSaved = null;
		this._$sideMenuWrpList = null;
		this._$eles = {}; // Generic internal element storage
	}

	doCreateProxies () {
		this._resetHooks("state");
		this._resetHooks("meta");
		this._state = this._getProxy("state", this.__state);
		this._meta = this._getProxy("meta", this.__meta);
	}

	set ui (ui) { this._ui = ui; }

	get isStateDirty () { return this._isStateDirty; }
	set isStateDirty (val) { this._isStateDirty = val; }

	get isEntrySaved () { return this._isEntrySaved; }
	set isEntrySaved (val) { this._isEntrySaved = val; }

	getSaveableState () {
		return {
			s: this.__state,
			m: this.__meta,
			// parent/other meta-state
			_m: {
				isEntrySaved: this.isEntrySaved,
			},
		};
	}

	setStateFromLoaded () { throw new TypeError(`Unimplemented method!`); }

	getIxBrew (entity) {
		return (BrewUtil.homebrew[this._prop] || []).findIndex(it => it.source === entity.source && it.name === entity.name);
	}

	doHandleSourceUpdate () {
		const nuSource = this._ui.source;

		// if the source we were using is gone, update
		if (!this._sourcesCache.includes(nuSource)) {
			this._state.source = nuSource;
			this._sourcesCache = MiscUtil.copy(this._ui.allSources);

			const $cache = this._$selSource;
			this._$selSource = this.$getSourceInput(this._cbCache);
			$cache.replaceWith(this._$selSource);
		}

		this.renderInput();
		this.renderOutput();
		this.renderSideMenu();
		this.doUiSave();
	}

	async _pHashChange_pHandleSubHashes (sub, toLoad) {
		return toLoad;
	}

	$getSourceInput (cb) {
		return BuilderUi.$getStateIptEnum(
			"Source",
			cb,
			this._state,
			{
				vals: this._sourcesCache, fnDisplay: Parser.sourceJsonToFull, type: "string", nullable: false,
			},
			"source",
		);
	}

	doUiSave () {
		// set our state to dirty, and trigger a save at a higher level
		this._isStateDirty = true;
		this._ui.doSaveDebounced();
	}

	renderSideMenu () {
		// region Detach any sidemenu renders from other builders
		if (this._ui.sidemenuRenderCache) {
			if (this._ui.sidemenuRenderCache.$lastStageSaved !== this._$sideMenuStageSaved) this._ui.sidemenuRenderCache.$lastStageSaved.detach();

			if (this._ui.sidemenuRenderCache.$lastWrpBtnLoadExisting !== this._$wrpBtnLoadExisting) this._ui.sidemenuRenderCache.$lastWrpBtnLoadExisting.detach();
		}
		// endregion

		// region If this is our first sidemenu render, create elements
		if (!this._$sideMenuStageSaved) {
			const $btnLoadExisting = $(`<button class="btn btn-xs btn-default">${this._titleSidebarLoadExisting}</button>`)
				.click(() => this.pHandleSidebarLoadExistingClick());
			this._$wrpBtnLoadExisting = $$`<div class="sidemenu__row">${$btnLoadExisting}</div>`;

			const $btnDownloadJson = $(`<button class="btn btn-default btn-xs mb-2">${this._titleSidebarDownloadJson}</button>`)
				.click(() => this.handleSidebarDownloadJsonClick());

			const $wrpDownloadMarkdown = (() => {
				if (!this._metaSidebarDownloadMarkdown) return null;

				const $btnDownload = $(`<button class="btn btn-default btn-xs mb-2">${this._metaSidebarDownloadMarkdown.title}</button>`)
					.click(async () => {
						const entities = this._getSidebarVisibleEntities();
						const mdOut = await this._metaSidebarDownloadMarkdown.pFnGetText(entities);
						DataUtil.userDownloadText(`${DataUtil.getCleanFilename(BrewUtil.sourceJsonToFull(this._ui.source))}.md`, mdOut);
					});

				const $btnSettings = $(`<button class="btn btn-default btn-xs mb-2"><span class="glyphicon glyphicon-cog"/></button>`)
					.click(() => RendererMarkdown.pShowSettingsModal());

				return $$`<div class="flex-v-center btn-group">${$btnDownload}${$btnSettings}</div>`;
			})();

			this._$sideMenuWrpList = this._$sideMenuWrpList || $(`<div class="sidemenu__row flex-col">`);
			this._$sideMenuStageSaved = $$`<div>
			${PageUi.__$getSideMenuDivider().hide()}
			<div class="flex-v-center">${$btnDownloadJson}</div>
			${$wrpDownloadMarkdown}
			${this._$sideMenuWrpList}
			</div>`;
		}
		// endregion

		// Make our sidemenu internal wrapper visible
		this._$wrpBtnLoadExisting.appendTo(this._ui.$wrpSideMenu);
		this._$sideMenuStageSaved.appendTo(this._ui.$wrpSideMenu);

		this._ui.sidemenuRenderCache = new SidemenuRenderCache({
			$lastWrpBtnLoadExisting: this._$wrpBtnLoadExisting,
			$lastStageSaved: this._$sideMenuStageSaved,
		});

		this.doUpdateSidemenu();
	}

	get ixBrew () { return this._meta.ixBrew; }
	set ixBrew (val) { this._meta.ixBrew = val; }

	getOnNavMessage () {
		if (!this.isEntrySaved && ~this.ixBrew) return "You have unsaved changes! Are you sure you want to leave?";
		else return null;
	}

	getSideMenuItems () {
		return MiscUtil.copy((BrewUtil.homebrew[this._prop] || []).filter(entry => entry.source === this._ui.source))
			.sort((a, b) => SortUtil.ascSort(a.name, b.name));
	}

	doUpdateSidemenu () {
		this._sidemenuListRenderCache = this._sidemenuListRenderCache || new SideMenuListRenderCache();

		const toList = this.getSideMenuItems();
		this._$sideMenuStageSaved.toggleVe(!!toList.length);

		// region Create a sparse array, of brew index -> entry
		const toListSparse = [];
		toList.forEach((entry, i) => {
			const ix = BrewUtil.getEntryIxByEntry(this._prop, entry);
			toListSparse[ix] = {
				entry,
				position: i,
			};
		});
		// endregion

		const ixs = toList.map(entry => BrewUtil.getEntryIxByEntry(this._prop, entry));
		const ixCap = Math.max(...ixs) + 1; // +1 so our "<" loop functions

		for (let ix = 0, len = Math.max(ixCap, this._sidemenuListRenderCache.getIxMaxRendered()); ix < len; ++ix) {
			const {entry, position} = toListSparse[ix] ?? {};
			const meta = this._sidemenuListRenderCache.getMeta(ix);

			if (meta) {
				if (entry) {
					meta.$row.showVe();

					if (meta.name !== entry.name) {
						meta.$dispName.text(entry.name);
						meta.name = entry.name;
					}

					if (meta.position !== position) {
						meta.$row.css("order", position);
						meta.position = position;
					}
				} else {
					meta.$row.hideVe();
				}
				continue;
			}

			if (!entry) continue;

			const $btnEdit = $(`<button class="btn btn-xs btn-default mr-2" title="Edit"><span class="glyphicon glyphicon-pencil"/></button>`)
				.click(() => {
					if (this.getOnNavMessage() && !confirm("You have unsaved changes. Are you sure?")) return;
					this.setStateFromLoaded({s: MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix)), m: {...this.getInitialMetaState(), ixBrew: ix}});
					this.renderInput();
					this.renderOutput();
					this.doUiSave();
				});

			const menu = ContextUtil.getMenu([
				new ContextUtil.Action(
					"Duplicate",
					async () => {
						const copy = MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix));

						// Get the root name without trailing numbers, e.g. "Goblin (2)" -> "Goblin"
						const m = /^(.*?) \((\d+)\)$/.exec(copy.name.trim());
						if (m) copy.name = `${m[1]} (${Number(m[2]) + 1})`;
						else copy.name = `${copy.name} (1)`;
						await BrewUtil.pAddEntry(this._prop, copy);
						this.doUpdateSidemenu();
					},
				),
				new ContextUtil.Action(
					"View JSON",
					(evt) => {
						const out = this._ui._getJsonOutputTemplate();
						out[this._prop] = [PropOrder.getOrdered(DataUtil.cleanJson(MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix))), this._prop)];

						const $content = Renderer.hover.$getHoverContent_statsCode(this._state);

						Renderer.hover.getShowWindow(
							$content,
							Renderer.hover.getWindowPositionFromEvent(evt),
							{
								title: `${this._state.name} \u2014 Source Data`,
								isPermanent: true,
								isBookContent: true,
							},
						);
					},
				),
				new ContextUtil.Action(
					"Download JSON",
					() => {
						const out = this._ui._getJsonOutputTemplate();
						const cpy = MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix));
						out[this._prop] = [DataUtil.cleanJson(cpy)];
						DataUtil.userDownload(DataUtil.getCleanFilename(cpy.name), out);
					},
				),
				new ContextUtil.Action(
					"View Markdown",
					(evt) => {
						const entry = MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix));
						const name = `${entry._displayName || entry.name} \u2014 Markdown`;
						const mdText = RendererMarkdown.get().render({entries: [{type: this._typeRenderData, [this._typeRenderData]: entry}]});
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
					},
				),
				new ContextUtil.Action(
					"Download Markdown",
					() => {
						const entry = MiscUtil.copy(BrewUtil.getEntryByEntryIx(this._prop, ix));
						const mdText = CreatureBuilder._getAsMarkdown(entry).trim();
						DataUtil.userDownloadText(`${DataUtil.getCleanFilename(entry.name)}.md`, mdText);
					},
				),
			]);

			const $btnBurger = $(`<button class="btn btn-xs btn-default mr-2" title="More Options"><span class="glyphicon glyphicon-option-vertical"/></button>`)
				.click(evt => ContextUtil.pOpenMenu(evt, menu));

			const $btnDelete = $(`<button class="btn btn-xs btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"/></button>`)
				.click(async () => {
					if (confirm("Are you sure?")) {
						if (this.ixBrew === ix) {
							this.isEntrySaved = false;
							this.ixBrew = null;
							this.mutSavedButtonText();
						} else if (this.ixBrew > ix) {
							this.ixBrew--; // handle the splice -- our index is now one lower
						}
						await BrewUtil.pRemoveEntry(this._prop, entry);
						this.doUpdateSidemenu();
						await this.pDoPostDelete();
					}
				});

			const $dispName = $$`<span class="py-1">${entry.name}</span>`;

			const $row = $$`<div class="mkbru__sidebar-entry flex-v-center split px-2" style="order: ${position}">
			${$dispName}
			<div class="py-1 no-shrink">${$btnEdit}${$btnBurger}${$btnDelete}</div>
			</div>`.appendTo(this._$sideMenuWrpList);

			const nuMeta = {
				$dispName,
				$row,
				name: entry.name,
				position,
			};
			this._sidemenuListRenderCache.setMeta(ix, nuMeta);
		}
	}

	_getSidebarVisibleEntities () {
		return (BrewUtil.homebrew[this._prop] || []).filter(entry => entry.source === this._ui.source);
	}

	handleSidebarDownloadJsonClick () {
		const out = this._ui._getJsonOutputTemplate();
		out[this._prop] = this._getSidebarVisibleEntities().map(entry => PropOrder.getOrdered(DataUtil.cleanJson(MiscUtil.copy(entry)), this._prop));
		DataUtil.userDownload(DataUtil.getCleanFilename(BrewUtil.sourceJsonToFull(this._ui.source)), out);
	}

	renderInputControls () {
		const $wrpControls = this._ui.$wrpInputControls.empty();

		this._$btnSave = BuilderUi.$getSaveButton().click(async () => {
			await this._renderInputControls_pSaveBrew();
			this.doUpdateSidemenu();
		}).appendTo($wrpControls);

		BuilderUi.$getResetButton().click(() => {
			if (!confirm("Are you sure?")) return;
			this.reset();
		}).appendTo($wrpControls);
	}

	reset () {
		this.setStateFromLoaded({s: this._getInitialState(), m: this.getInitialMetaState()});
		this.renderInput();
		this.renderOutput();
		this.isEntrySaved = true;
		this.mutSavedButtonText();
		this.doUiSave();
	}

	async _renderInputControls_pSaveBrew () {
		if (this.ixBrew != null) {
			await BrewUtil.pUpdateEntryByIx(this._prop, this.ixBrew, MiscUtil.copy(this.__state));
			this.renderSideMenu();
		} else {
			const cpy = MiscUtil.copy(this.__state);
			this.ixBrew = await BrewUtil.pAddEntry(this._prop, cpy);
			await Omnisearch.pAddToIndex(this._prop, cpy);
			await SearchWidget.P_LOADING_CONTENT;
			await SearchWidget.pAddToIndexes(this._prop, cpy);
		}
		this.isEntrySaved = true;
		this.mutSavedButtonText();
		this.doUiSave();
		await this.pDoPostSave();
	}

	mutSavedButtonText () {
		if (this._$btnSave) this._$btnSave.text(this.isEntrySaved ? "Saved" : "Save *");
	}

	// TODO use this in creature builder
	/**
	 * @param doUpdateState
	 * @param rowArr
	 * @param row
	 * @param $wrpRow
	 * @param title
	 * @param [opts] Options object.
	 * @param [opts.isProtectLast]
	 * @param [opts.isExtraSmall]
	 * @return {JQuery}
	 */
	static $getBtnRemoveRow (doUpdateState, rowArr, row, $wrpRow, title, opts) {
		opts = opts || {};

		return $(`<button class="btn ${opts.isExtraSmall ? "btn-xxs" : "btn-xs"} btn-danger ${opts.isProtectLast ? "mkbru__btn-rm-row" : ""}" title="Remove ${title}"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				rowArr.splice(rowArr.indexOf(row), 1);
				$wrpRow.empty().remove();
				doUpdateState();
			});
	}

	$getFluffInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Flavor Info");

		const imageRows = [];

		const doUpdateState = () => {
			const out = {};

			const entries = UiUtil.getTextAsEntries($iptEntries.val());
			if (entries && entries.length) out.entries = entries;

			const images = imageRows.map(it => it.getState()).filter(Boolean);

			if (images.length) out.images = images;

			if (out.entries || out.images) this._state.fluff = out;
			else delete this._state.fluff;

			cb();
		};

		const doUpdateOrder = () => {
			imageRows.forEach(it => it.$ele.detach().appendTo($wrpRows));
			doUpdateState();
		};

		const $wrpRowsOuter = $(`<div class="relative"/>`);
		const $wrpRows = $(`<div class="flex-col"/>`).appendTo($wrpRowsOuter);

		const rowOptions = {$wrpRowsOuter};

		const $iptEntries = $(`<textarea class="form-control form-control--minimal resize-vertical mb-2"/>`)
			.change(() => doUpdateState());

		const $btnAddImage = $(`<button class="btn btn-xs btn-default">Add Image</button>`)
			.click(async () => {
				const url = await InputUiUtil.pGetUserString({title: "Enter a URL"});
				if (!url) return;
				Builder.__$getFluffInput__getImageRow(doUpdateState, doUpdateOrder, rowOptions, imageRows, {href: {url: url}}).$ele.appendTo($wrpRows);
				doUpdateState();
			});

		$$`<div class="flex-col">
		${$iptEntries}
		${$wrpRowsOuter}
		<div>${$btnAddImage}</div>
		</div>`.appendTo($rowInner);

		if (this._state.fluff) {
			if (this._state.fluff.entries) $iptEntries.val(UiUtil.getEntriesAsText(this._state.fluff.entries));
			if (this._state.fluff.images) this._state.fluff.images.forEach(img => Builder.__$getFluffInput__getImageRow(doUpdateState, doUpdateOrder, rowOptions, imageRows, img).$ele.appendTo($wrpRows));
		}

		return $row;
	}

	static __$getFluffInput__getImageRow (doUpdateState, doUpdateOrder, options, imageRows, image) {
		const out = {};

		const getState = () => {
			const rawUrl = $iptUrl.val().trim();
			return rawUrl ? {type: "image", href: {type: "external", url: rawUrl}} : null;
		};

		const $iptUrl = $(`<input class="form-control form-control--minimal input-xs mr-2">`)
			.change(() => doUpdateState());
		if (image) {
			const href = ((image || {}).href || {});
			if (href.url) $iptUrl.val(href.url);
			else if (href.path) {
				$iptUrl.val(`${window.location.origin.replace(/\/+$/, "")}/img/${href.path}`);
			}
		}

		const $btnPreview = $(`<button class="btn btn-xs btn-default mr-2" title="Preview Image"><span class="glyphicon glyphicon-fullscreen"/></button>`)
			.click((evt) => {
				const toRender = getState();
				if (!toRender) return JqueryUtil.doToast({content: "Please enter an image URL", type: "warning"});

				const $content = Renderer.hover.$getHoverContent_generic(toRender, {isBookContent: true});
				Renderer.hover.getShowWindow(
					$content,
					Renderer.hover.getWindowPositionFromEvent(evt),
					{
						isPermanent: true,
						title: "Image Preview",
						isBookContent: true,
					},
				);
			});

		const $btnRemove = $(`<button class="btn btn-xs btn-danger" title="Remove Image"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				imageRows.splice(imageRows.indexOf(out), 1);
				out.$ele.empty().remove();
				doUpdateState();
			});

		const $dragOrder = BuilderUi.$getDragPad(doUpdateOrder, imageRows, out, {
			$wrpRowsOuter: options.$wrpRowsOuter,
		});

		out.$ele = $$`<div class="flex-v-center mb-2 mkbru__wrp-rows--removable">${$iptUrl}${$btnPreview}${$btnRemove}${$dragOrder}</div>`;
		out.getState = getState;
		imageRows.push(out);

		return out;
	}

	_getRenderedMarkdownCode () {
		const mdText = this.constructor._getAsMarkdown(this._state);
		return Renderer.get().render({
			type: "entries",
			entries: [
				{
					type: "code",
					name: `Markdown`,
					preformatted: mdText,
				},
			],
		});
	}

	doHandleSourcesAdd () { throw new TypeError(`Unimplemented method!`); }
	renderInput () {
		try {
			this._renderInputImpl();
			this._isLastRenderInputFail = false;
		} catch (e) {
			if (!this._isLastRenderInputFail) {
				JqueryUtil.doToast({type: "danger", content: `Could not load homebrew, it contained errors! ${VeCt.STR_SEE_CONSOLE}`});
				setTimeout(() => { throw e; });
			}
			const tmp = this._isLastRenderInputFail;
			this._isLastRenderInputFail = true;
			if (!tmp) this.reset();
		}
	}
	_renderInputImpl () { throw new TypeError(`Unimplemented method!`); }
	renderOutput () { throw new TypeError(`Unimplemented method!`); }
	async pHandleSidebarLoadExistingClick () { throw new TypeError(`Unimplemented method!`); }
	async pHandleSidebarLoadExistingData (entity, opts) { throw new TypeError(`Unimplemented method!`); }
	getInitialMetaState () { return {}; }
	async pInit () {}
	async pDoPostSave () {}
	async pDoPostDelete () {}
}
Builder._BUILDERS = [];

class BuilderUi {
	static $getSaveButton () {
		return $(`<button class="btn btn-xs btn-default mr-2 mkbru__cnt-save">Save</button>`);
	}

	static $getResetButton () {
		return $(`<button class="btn btn-xs btn-default">Reset</button>`);
	}

	static __setProp (toVal, options, state, ...path) {
		if (path.length > 1) {
			let cur = state;
			for (let i = 0; i < path.length - 1; ++i) cur = state[path[i]];

			if (toVal == null) {
				delete cur[path.last()];
				return null;
			} else return cur[path.last()] = toVal;
		} else {
			if (toVal == null) {
				delete state[path[0]];
				return null;
			} else return state[path[0]] = toVal;
		}
	}

	static fnPostProcessDice (ents) { return ents.map(ent => DiceConvert.getTaggedEntry(ent)); }

	/**
	 *
	 * @param name Row name.
	 * @param [options] Options object.
	 * @param [options.eleType] HTML element to use.
	 * @param [options.isMarked] If a "group" vertical marker should be displayed between the name and the row body.
	 * @param [options.isRow] If the row body should use flex row (instead of flex col).
	 * @param [options.title] Tooltip text.
	 */
	static getLabelledRowTuple (name, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		const $rowInner = $(`<div class="${options.isRow ? "flex" : "flex-col"} w-100"/>`);
		const $row = $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row flex-v-center"><span class="mr-2 mkbru__row-name ${options.isMarked ? `mkbru__row-name--marked` : ""} ${options.title ? "help" : ""}" ${options.title ? `title="${options.title}"` : ""}>${name}</span>${options.isMarked ? `<div class="mkbru__row-mark mr-2"/>` : ""}${$rowInner}</${eleType}></div>`;
		return [$row, $rowInner];
	}

	static __$getRow (name, $ipt, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		return $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row flex-v-center">
		<span class="mr-2 mkbru__row-name ${options.title ? "help" : ""}" ${options.title ? `title="${options.title}"` : ""}>${name}</span>
		${$ipt}
		<${eleType}/></div>`;
	}

	static $getStateIptString (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="form-control input-xs form-control--minimal ${options.type ? `type="${options.type}"` : ""}">`)
			.val(initialState)
			.change(() => {
				const raw = $ipt.val().trim();
				const set = BuilderUi.__setProp(raw || !options.nullable ? raw : null, options, state, ...path);
				fnRender();
				if (options.callback) options.callback(set);
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options
	 * @param [options.nullable]
	 * @param [options.placeholder]
	 * @param [options.withHeader]
	 * @param [options.fnPostProcess]
	 * @param path
	 * @return {*}
	 */
	static $getStateIptEntries (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		let initialState = MiscUtil.get(state, ...path);
		if (options.withHeader && initialState) initialState = initialState[0].entries;

		const $ipt = $(`<textarea class="form-control form-control--minimal resize-vertical" ${options.placeholder ? `placeholder="${options.placeholder}"` : ""}/>`)
			.val(UiUtil.getEntriesAsText(initialState))
			.change(() => {
				const raw = $ipt.val();
				let out = raw || !options.nullable ? UiUtil.getTextAsEntries(raw) : null;

				if (out && options.fnPostProcess) {
					out = options.fnPostProcess(out);
					$ipt.val(UiUtil.getEntriesAsText(out));
				}

				if (options.withHeader && out) {
					out = [
						{
							name: options.withHeader,
							entries: out,
						},
					];
				}

				BuilderUi.__setProp(out, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	static $getStateIptStringArray (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple(name, {isMarked: true});
		const initialState = MiscUtil.get(state, ...path) || [];
		const stringRows = [];

		const doUpdateState = () => {
			const raw = stringRows.map(row => row.getState()).filter(it => it.trim());
			BuilderUi.__setProp(raw.length || !options.nullable ? raw : null, options, state, ...path);
			fnRender();
		};

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		initialState.forEach(string => BuilderUi._$getStateIptStringArray_getRow(doUpdateState, stringRows, string).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add ${options.shortName}</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				BuilderUi._$getStateIptStringArray_getRow(doUpdateState, stringRows).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	static _$getStateIptStringArray_getRow (doUpdateState, stringRows, initialString) {
		const getState = () => $iptString.val().trim();

		const $iptString = $(`<input class="form-control form-control--minimal input-xs mr-2">`)
			.change(() => doUpdateState());
		if (initialString && initialString.trim()) $iptString.val(initialString);

		const $btnRemove = $(`<button class="btn btn-xs btn-danger" title="Remove Row"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				stringRows.splice(stringRows.indexOf(out), 1);
				$wrp.empty().remove();
				doUpdateState();
			});

		const $wrp = $$`<div class="flex-v-center mb-2">${$iptString}${$btnRemove}</div>`;
		const out = {$wrp, getState};
		stringRows.push(out);
		return out;
	}

	static $getStateIptNumber (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="form-control input-xs form-control--minimal" ${options.placeholder ? `placeholder="${options.placeholder}"` : ""}>`)
			.val(initialState)
			.change(() => {
				const defaultVal = options.nullable ? null : 0;
				const val = UiUtil.strToInt($ipt.val(), defaultVal, {fallbackOnNaN: defaultVal});
				BuilderUi.__setProp(val, options, state, ...path);
				$ipt.val(val);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $ipt, options);
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options Options object.
	 * @param options.nullable
	 * @param options.fnDisplay
	 * @param options.vals
	 * @param path
	 */
	static $getStateIptEnum (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $sel = $(`<select class="form-control input-xs form-control--minimal">`);
		if (options.nullable) $sel.append(`<option value="-1">(None)</option>`);
		options.vals.forEach((v, i) => $(`<option>`).val(i).text(options.fnDisplay ? options.fnDisplay(v) : v).appendTo($sel));
		const ixInitial = options.vals.indexOf(initialState);
		$sel.val(ixInitial)
			.change(() => {
				const ixOut = Number($sel.val());
				const out = ~ixOut ? options.vals[ixOut] : null;
				BuilderUi.__setProp(out, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $sel, options);
	}

	static $getStateIptBoolean (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;

		const initialState = MiscUtil.get(state, ...path);
		const $ipt = $(`<input class="mkbru__ipt-cb" type="checkbox">`)
			.prop("checked", initialState)
			.change(() => {
				// assumes false => null, unless not nullable
				const raw = !!$ipt.prop("checked");
				BuilderUi.__setProp(raw || !options.nullable ? raw : null, options, state, ...path);
				fnRender();
			});
		return BuilderUi.__$getRow(name, $$`<div class="w-100 flex-v-center">${$ipt}</div>`, {...options, eleType: "label"});
	}

	/**
	 * @param name
	 * @param fnRender
	 * @param state
	 * @param options
	 * @param options.vals
	 * @param [options.nullable]
	 * @param [options.fnDisplay]
	 * @param path
	 * @return {*}
	 */
	static $getStateIptBooleanArray (name, fnRender, state, options, ...path) {
		if (options.nullable == null) options.nullable = true;
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple(name, {isMarked: true});

		const initialState = MiscUtil.get(state, ...path) || [];
		const $wrpIpts = $(`<div class="flex-col w-100 mr-2"/>`).appendTo($rowInner);
		const inputs = [];
		options.vals.forEach(val => {
			const $cb = $(`<input class="mkbru__ipt-cb" type="checkbox">`)
				.prop("checked", initialState.includes(val))
				.change(() => {
					BuilderUi.__setProp(getState(), options, state, ...path);
					fnRender();
				});
			inputs.push({$ipt: $cb, val});
			$$`<label class="flex-v-center split stripe-odd--faint"><span>${options.fnDisplay ? options.fnDisplay(val) : val}</span>${$cb}</label>`.appendTo($wrpIpts);
		});

		const getState = () => {
			const raw = inputs.map(it => it.$ipt.prop("checked") ? it.val : false).filter(Boolean);
			return raw.length || !options.nullable ? raw : null;
		};

		return $row;
	}

	/**
	 * @param $ipt The input to sort.
	 * @param cb Callback function.
	 * @param sortOptions Sort order options.
	 * @param sortOptions.bottom Regex patterns that, should a token match, that token should be sorted to the end. Warning: slow.
	 */
	static $getSplitCommasSortButton ($ipt, cb, sortOptions) {
		sortOptions = sortOptions || {};
		return $(`<button class="btn btn-xs btn-default">Sort</button>`)
			.click(() => {
				const spl = $ipt.val().split(StrUtil.COMMAS_NOT_IN_PARENTHESES_REGEX);
				$ipt.val(spl.sort((a, b) => {
					if (sortOptions.bottom) {
						const ixA = sortOptions.bottom.findIndex(re => {
							const m = re.test(a);
							re.lastIndex = 0;
							return m;
						});
						const ixB = sortOptions.bottom.findIndex(re => {
							const m = re.test(b);
							re.lastIndex = 0;
							return m;
						});

						if (~ixA && ~ixB) return 0;
						else if (~ixA) return 1;
						else if (~ixB) return -1;
						else return SortUtil.ascSortLower(a, b);
					} else return SortUtil.ascSortLower(a, b);
				}).join(", "));
				cb();
			});
	}

	static $getUpButton (cbUpdate, rows, myRow) {
		return $(`<button class="btn btn-xs btn-default mkbru__btn-up-row ml-2" title="Move Up"><span class="glyphicon glyphicon-arrow-up"/></button>`)
			.click(() => {
				const ix = rows.indexOf(myRow);
				const cache = rows[ix - 1];
				rows[ix - 1] = myRow;
				rows[ix] = cache;
				cbUpdate();
			});
	}

	static $getDownButton (cbUpdate, rows, myRow) {
		return $(`<button class="btn btn-xs btn-default mkbru__btn-down-row ml-2" title="Move Down"><span class="glyphicon glyphicon-arrow-down"/></button>`)
			.click(() => {
				const ix = rows.indexOf(myRow);
				const cache = rows[ix + 1];
				rows[ix + 1] = myRow;
				rows[ix] = cache;
				cbUpdate();
			});
	}

	// FIXME refactor this to use one of the variant in utils-ui
	static $getDragPad (cbUpdate, rows, myRow, options) {
		const dragMeta = {};
		const doDragCleanup = () => {
			dragMeta.on = false;
			dragMeta.$wrap.remove();
			dragMeta.$dummies.forEach($d => $d.remove());
			$(document.body).off(`mouseup.drag__stop`);
		};

		const doDragRender = () => {
			if (dragMeta.on) doDragCleanup();

			$(document.body).on(`mouseup.drag__stop`, () => {
				if (dragMeta.on) doDragCleanup();
			});

			dragMeta.on = true;
			dragMeta.$wrap = $(`<div class="flex-col ui-drag__wrp-drag-block"/>`).appendTo(options.$wrpRowsOuter);
			dragMeta.$dummies = [];

			const ixRow = rows.indexOf(myRow);

			rows.forEach((row, i) => {
				const dimensions = {w: row.$ele.outerWidth(true), h: row.$ele.outerHeight(true)};
				const $dummy = $(`<div class="${i === ixRow ? "ui-drag__wrp-drag-dummy--highlight" : "ui-drag__wrp-drag-dummy--lowlight"}"/>`)
					.width(dimensions.w).height(dimensions.h)
					.mouseup(() => {
						if (dragMeta.on) {
							doDragCleanup();
						}
					})
					.appendTo(dragMeta.$wrap);
				dragMeta.$dummies.push($dummy);

				if (i !== ixRow) { // on entering other areas, swap positions
					$dummy.mouseenter(() => {
						const cache = rows[i];
						rows[i] = myRow;
						rows[ixRow] = cache;

						if (options.cbSwap) options.cbSwap(cache);

						cbUpdate();
						doDragRender();
					});
				}
			});
		};

		return $(`<div class="ml-2 ui-drag__patch" title="Drag to Reorder">
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		<div class="ui-drag__patch-col"><div>&#8729</div><div>&#8729</div><div>&#8729</div></div>
		</div>`).mousedown(() => doDragRender());
	}
}

class Makebrew {
	static async doPageInit () {
		Makebrew._LOCK = new VeLock();

		// generic init
		ExcludeUtil.pInitialise(); // don't await, as this is only used for search
		await BrewUtil.pAddBrewData();
		await SearchUiUtil.pDoGlobalInit();
		// Do this asynchronously, to avoid blocking the load
		SearchWidget.pDoGlobalInit();

		// page-specific init
		await Builder.pInitAll();
		Renderer.utils.bindPronounceButtons();
		await ui.init();

		if (window.location.hash.length) await Makebrew.pHashChange();
		window.addEventListener("hashchange", Makebrew.pHashChange.bind(Makebrew));

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	static async pHashChange () {
		try {
			await Makebrew._LOCK.pLock();

			const [builderMode, ...sub] = Hist.getHashParts();
			Hist.initialLoad = false; // Once we've extracted the hash's parts, we no longer care about preserving it

			if (!builderMode) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

			const builder = ui.getBuilderById(builderMode);
			if (!builder) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

			ui.setActiveBuilderById(builderMode); // (This will update the hash to the active builder)

			if (sub.length) {
				const initialLoadMeta = UrlUtil.unpackSubHash(sub[0]);
				if (!initialLoadMeta.statemeta) return;

				const [page, source, hash] = initialLoadMeta.statemeta;
				let toLoad = await Renderer.hover.pCacheAndGet(page, source, hash, {isCopy: true});

				toLoad = await builder._pHashChange_pHandleSubHashes(sub, toLoad);

				// Try to link up the ixBrew for homebrew entities, so that we can cleanly edit and save them without
				//   creating duplicates.
				const meta = {};
				if (toLoad.uniqueId !== null) {
					const ixBrew = builder.getIxBrew(toLoad);
					if (~ixBrew) {
						meta.ixBrew = ixBrew;

						// If we're using an existing ixBrew, use its source, too
						if (toLoad.source) ui.source = toLoad.source;
					}
				}

				return builder.pHandleSidebarLoadExistingData(toLoad, {isForce: true, meta});
			}
		} finally { Makebrew._LOCK.unlock(); }
	}
}
Makebrew._LOCK = null;

const ui = new PageUi();

window.addEventListener("load", async () => {
	await Makebrew.doPageInit();
});

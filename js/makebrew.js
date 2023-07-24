"use strict";

class SidemenuRenderCache {
	constructor ({$lastStageSaved, $lastWrpBtnLoadExisting}) {
		this.$lastStageSaved = $lastStageSaved;
		this.$lastWrpBtnLoadExisting = $lastWrpBtnLoadExisting;
	}
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

		this._isInitialLoad = true;
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

	get builders () { return this._builders; }

	get activeBuilder () { return this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER; }

	get $wrpInput () { return this._$wrpInput; }

	get $wrpInputControls () { return this._$wrpInputControls; }

	get $wrpOutput () { return this._$wrpOutput; }

	get $wrpSideMenu () { return this._$menuInner; }

	get source () { return this._settings.activeSource || ""; }

	get allSources () { return this._allSources; }

	get sidemenuRenderCache () { return this._sidemenuRenderCache; }
	set sidemenuRenderCache (val) { this._sidemenuRenderCache = val; }

	_doSave () {
		if (this._isInitialLoad) return;
		return StorageUtil.pSetForPage(
			PageUi._STORAGE_STATE,
			{
				builders: Object.entries(this._builders).mergeMap(([name, builder]) => ({[name]: builder.getSaveableState()})),
			},
		);
	}

	_doSaveSettings () { return StorageUtil.pSetForPage(PageUi._STORAGE_SETTINGS, this._settings); }

	async init () {
		this._settings = await StorageUtil.pGetForPage(PageUi._STORAGE_SETTINGS) || {};

		this._$wrpLoad = $(`#page_loading`);
		this._$wrpSource = $(`#page_source`);
		this._$wrpMain = $(`#page_main`);

		this._settings.activeBuilder = this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER;

		this._initLhs();
		this._initRhs();
		await this._pInitSideMenu();

		const storedState = await StorageUtil.pGetForPage(PageUi._STORAGE_STATE) || {};
		if (storedState.builders) {
			Object.entries(storedState.builders).forEach(([name, state]) => {
				if (this._builders[name]) this._builders[name].setStateFromLoaded(state);
			});
		}

		this._doRenderActiveBuilder();
		this._doInitNavHandler();

		const brewSources = BrewUtil2.getSources();
		if (this._settings.activeSource && brewSources.some(it => it.json === this._settings.activeSource)) {
			this.__setStageMain();
			this._sideMenuEnabled = true;
		} else if (brewSources.length) {
			this._doRebuildStageSource({mode: "select", isRequired: true});
			this.__setStageSource();
		} else {
			this._doRebuildStageSource({mode: "add", isRequired: true});
			this.__setStageSource();
		}

		this._isInitialLoad = false;
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
			cbConfirm: async (source, isNewSource) => {
				if (isNewSource) await BrewUtil2.pAddSource(source);
				else await BrewUtil2.pEditSource(source);

				this._settings.activeSource = source.json;

				if (isNewSource) this._doAddSourceOption(source);
				await this._pDoHandleUpdateSource();
				this._sideMenuEnabled = true;
				this.__setStageMain();
			},
			cbConfirmExisting: async (source) => {
				this._settings.activeSource = source.json;
				await this._pDoHandleUpdateSource();
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

	async pSetActiveBuilderById (id) {
		id = id.toLowerCase().trim();
		const key = Object.keys(this._builders).find(k => k.toLowerCase().trim() === id);
		await this._pSetActiveBuilder(key);
	}

	async _pSetActiveBuilder (nxtActiveBuilder) {
		if (!this._builders[nxtActiveBuilder]) throw new Error(`Builder "${nxtActiveBuilder}" does not exist!`);

		this._$selBuilderMode.val(nxtActiveBuilder);
		this._settings.activeBuilder = nxtActiveBuilder;
		if (!Hist.initialLoad) Hist.replaceHistoryHash(UrlUtil.encodeForHash(this._settings.activeBuilder));
		const builder = this._builders[this._settings.activeBuilder];
		builder.renderInput();
		builder.renderOutput();
		await builder.pRenderSideMenu();
		this._saveSettingsDebounced();
	}

	async _pInitSideMenu () {
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
			.change(async () => {
				const val = this._$selBuilderMode.val();
				if (val === "none") {
					InputUiUtil.pGetUserBoolean({
						title: "Homebrew Builder Support",
						htmlDescription: `<p>The Homebrew Builder only supports a limited set of entity types. For everything else, you will need to <a href="https://github.com/TheGiddyLimit/homebrew/blob/master/README.md" rel="noopener noreferrer">manually</a> create or convert content.</p>`,
						isAlert: true,
					}).then(null);
					this._$selBuilderMode.val(this._settings.activeBuilder);
					return;
				}
				await this._pSetActiveBuilder(val);
			});

		$mnu.append(PageUi.__$getSideMenuDivider(true));

		const $wrpSource = $(`<div class="sidemenu__row split-v-center"><div class="sidemenu__row__label mr-2">Source</div></div>`).appendTo($mnu);
		this._allSources = BrewUtil2.getSources().sort((a, b) => SortUtil.ascSortLower(a.full, b.full))
			.map(it => it.json);
		this._$selSource = $$`
			<select class="form-control input-xs">
				<option disabled>Select</option>
				${this._allSources.map(s => `<option value="${s.escapeQuotes()}">${Parser.sourceJsonToFull(s).escapeQuotes()}</option>`)}
			</select>`
			.appendTo($wrpSource)
			.change(async () => {
				this._settings.activeSource = this._$selSource.val();
				await this._pDoHandleUpdateSource();
			});
		if (this._settings.activeSource) this._$selSource.val(this._settings.activeSource);
		else this._$selSource[0].selectedIndex = 0;

		const $btnSourceEdit = $(`<button class="btn btn-default btn-xs mr-2">Edit Selected Source</button>`)
			.click(() => {
				const curSourceJson = this._settings.activeSource;
				const curSource = BrewUtil2.sourceJsonToSource(curSourceJson);
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

		if (prevMode) await this._pSetActiveBuilder(prevMode);
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

	async _pDoHandleUpdateSource () {
		if (this._$selSource) this._$selSource.val(this._settings.activeSource);
		this._saveSettingsDebounced();
		await this._builders[this._settings.activeBuilder].pDoHandleSourceUpdate();
	}

	_getJsonOutputTemplate () {
		const timestamp = Math.round(Date.now() / 1000);
		return {
			_meta: {
				sources: [MiscUtil.copy(BrewUtil2.sourceJsonToSource(this._settings.activeSource))],
				dateAdded: timestamp,
				dateLastModified: timestamp,
			},
		};
	}
}
PageUi._STORAGE_STATE = "brewbuilderState";
PageUi._STORAGE_SETTINGS = "brewbuilderSettings";
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
	 */
	constructor (opts) {
		super();
		opts = opts || {};
		this._titleSidebarLoadExisting = opts.titleSidebarLoadExisting;
		this._titleSidebarDownloadJson = opts.titleSidebarDownloadJson;
		this._metaSidebarDownloadMarkdown = opts.metaSidebarDownloadMarkdown;
		this._prop = opts.prop;

		Builder._BUILDERS.push(this);
		TabUiUtil.decorate(this);

		this._ui = null;
		this._isInitialLoad = true;

		this._sourcesCache = []; // the JSON sources from the main UI
		this._$selSource = null;
		this._cbCache = null;

		this.__state = this._getInitialState();
		this._state = null; // proxy used to access state
		this.__meta = this._getInitialMetaState(); // meta state
		this._meta = null; // proxy used to access meta state

		this._$wrpBtnLoadExisting = null;
		this._$sideMenuStageSaved = null;
		this._$sideMenuWrpList = null;
		this._$eles = {}; // Generic internal element storage
	}

	_doResetProxies () {
		this._resetHooks("state");
		this._resetHooks("meta");
	}

	doCreateProxies () {
		this._doResetProxies();
		this._state = this._getProxy("state", this.__state);
		this._meta = this._getProxy("meta", this.__meta);
	}

	set ui (ui) { this._ui = ui; }

	get prop () { return this._prop; }

	prepareExistingEditableBrew ({brew}) {
		let isAnyMod = false;
		if (!brew.body[this.prop]?.length) return;

		brew.body[this.prop].forEach(ent => {
			if (ent.uniqueId) return;
			ent.uniqueId = CryptUtil.uid();
			isAnyMod = true;
		});
		return isAnyMod;
	}

	getSaveableState () {
		return {
			s: this.__state,
			m: this.__meta,
		};
	}

	setStateFromLoaded () { throw new TypeError(`Unimplemented method!`); }

	async pDoHandleSourceUpdate () {
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
		await this.pRenderSideMenu();
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
		// Trigger a save at a higher level
		this._ui.doSaveDebounced();
	}

	async pRenderSideMenu () {
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
				.click(() => this.pHandleSidebarDownloadJsonClick());

			const $wrpDownloadMarkdown = (() => {
				if (!this._metaSidebarDownloadMarkdown) return null;

				const $btnDownload = $(`<button class="btn btn-default btn-xs mb-2">${this._metaSidebarDownloadMarkdown.title}</button>`)
					.click(async () => {
						const entities = await this._pGetSideMenuBrewEntities();
						const mdOut = await this._metaSidebarDownloadMarkdown.pFnGetText(entities);
						DataUtil.userDownloadText(`${DataUtil.getCleanFilename(BrewUtil2.sourceJsonToFull(this._ui.source))}.md`, mdOut);
					});

				const $btnSettings = $(`<button class="btn btn-default btn-xs mb-2"><span class="glyphicon glyphicon-cog"/></button>`)
					.click(() => RendererMarkdown.pShowSettingsModal());

				return $$`<div class="ve-flex-v-center btn-group">${$btnDownload}${$btnSettings}</div>`;
			})();

			this._$sideMenuWrpList = this._$sideMenuWrpList || $(`<div class="sidemenu__row ve-flex-col">`);
			this._$sideMenuStageSaved = $$`<div>
				${PageUi.__$getSideMenuDivider().hide()}
				<div class="ve-flex-v-center">${$btnDownloadJson}</div>
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

		await this._pDoUpdateSidemenu();
	}

	getOnNavMessage () {
		if (!this._meta.isPersisted && this._meta.isModified) return "You have unsaved changes! Are you sure you want to leave?";
		else return null;
	}

	async _pGetSideMenuBrewEntities () {
		const brew = await BrewUtil2.pGetOrCreateEditableBrewDoc();
		return MiscUtil.copy((brew.body[this._prop] || []).filter(entry => entry.source === this._ui.source))
			.sort((a, b) => SortUtil.ascSort(a.name, b.name));
	}

	async _pDoUpdateSidemenu () {
		this._sidemenuListRenderCache = this._sidemenuListRenderCache || {};

		const toList = await this._pGetSideMenuBrewEntities();
		this._$sideMenuStageSaved.toggleVe(!!toList.length);

		const metasVisible = new Set();
		toList.forEach((ent, ix) => {
			metasVisible.add(ent.uniqueId);

			if (this._sidemenuListRenderCache[ent.uniqueId]) {
				const meta = this._sidemenuListRenderCache[ent.uniqueId];

				meta.$row.showVe();

				if (meta.name !== ent.name) {
					meta.$dispName.text(ent.name);
					meta.name = ent.name;
				}

				if (meta.position !== ix) {
					meta.$row.css("order", ix);
					meta.position = ix;
				}

				return;
			}

			const $btnEdit = $(`<button class="btn btn-xs btn-default mr-2" title="Edit"><span class="glyphicon glyphicon-pencil"/></button>`)
				.click(async () => {
					if (this.getOnNavMessage() && !confirm("You have unsaved changes. Are you sure?")) return;
					const entEditable = await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId);
					this.setStateFromLoaded({
						s: MiscUtil.copy(entEditable),
						m: this._getInitialMetaState({
							isModified: false,
							isPersisted: true,
						}),
					});
					this.renderInput();
					this.renderOutput();
					this.doUiSave();
				});

			const menu = ContextUtil.getMenu([
				new ContextUtil.Action(
					"Duplicate",
					async () => {
						const copy = MiscUtil.copy(await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId, {isDuplicate: true}));

						// Get the root name without trailing numbers, e.g. "Goblin (2)" -> "Goblin"
						const m = /^(.*?) \((\d+)\)$/.exec(copy.name.trim());
						if (m) copy.name = `${m[1]} (${Number(m[2]) + 1})`;
						else copy.name = `${copy.name} (1)`;

						await BrewUtil2.pPersistEditableBrewEntity(this._prop, copy);

						await this._pDoUpdateSidemenu();
					},
				),
				new ContextUtil.Action(
					"View JSON",
					async (evt) => {
						const out = this._ui._getJsonOutputTemplate();

						out[this._prop] = [
							PropOrder.getOrdered(
								DataUtil.cleanJson(MiscUtil.copy(await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId))),
								this._prop,
							),
						];

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
					async () => {
						const out = this._ui._getJsonOutputTemplate();
						const cpy = MiscUtil.copy(await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId));
						out[this._prop] = [DataUtil.cleanJson(cpy)];
						DataUtil.userDownload(DataUtil.getCleanFilename(cpy.name), out);
					},
				),
				new ContextUtil.Action(
					"View Markdown",
					async (evt) => {
						const entry = MiscUtil.copy(await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId));
						const name = `${entry._displayName || entry.name} \u2014 Markdown`;
						const mdText = RendererMarkdown.get().render({
							entries: [
								{
									type: "statblockInline",
									dataType: this._prop,
									data: entry,
								},
							],
						});
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
					async () => {
						const entry = MiscUtil.copy(await BrewUtil2.pGetEditableBrewEntity(this._prop, ent.uniqueId));
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
						if (this._state.uniqueId === ent.uniqueId) {
							this.reset();
						}
						await BrewUtil2.pRemoveEditableBrewEntity(this._prop, ent.uniqueId);
						await this._pDoUpdateSidemenu();
						await this.pDoPostDelete();
					}
				});

			const $dispName = $$`<span class="py-1">${ent.name}</span>`;

			const $row = $$`<div class="mkbru__sidebar-entry ve-flex-v-center split px-2" style="order: ${ix}">
			${$dispName}
			<div class="py-1 no-shrink">${$btnEdit}${$btnBurger}${$btnDelete}</div>
			</div>`.appendTo(this._$sideMenuWrpList);

			this._sidemenuListRenderCache[ent.uniqueId] = {
				$dispName,
				$row,
				name: ent.name,
				ix,
			};
		});

		Object.entries(this._sidemenuListRenderCache)
			.filter(([uniqueId]) => !metasVisible.has(uniqueId))
			.forEach(([, meta]) => meta.$row.hideVe());
	}

	async pHandleSidebarDownloadJsonClick () {
		const out = this._ui._getJsonOutputTemplate();
		out[this._prop] = (await this._pGetSideMenuBrewEntities()).map(entry => PropOrder.getOrdered(DataUtil.cleanJson(MiscUtil.copy(entry)), this._prop));
		DataUtil.userDownload(DataUtil.getCleanFilename(BrewUtil2.sourceJsonToFull(this._ui.source)), out);
	}

	renderInputControls () {
		const $wrpControls = this._ui.$wrpInputControls.empty();

		const $btnSave = $(`<button class="btn btn-xs btn-default mr-2 mkbru__cnt-save">Save</button>`)
			.click(() => this._pHandleClick_pSaveBrew())
			.appendTo($wrpControls);
		const hkBtnSaveText = () => $btnSave.text(this._meta.isModified ? "Save *" : "Saved");
		this._addHook("meta", "isModified", hkBtnSaveText);
		hkBtnSaveText();

		$(`<button class="btn btn-xs btn-default" title="SHIFT to reset additional state (such as whether or not certain attributes are auto-calculated)">New</button>`)
			.click(async (evt) => {
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset Builder", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
				this.reset({isResetAllMeta: !!evt.shiftKey});
			})
			.appendTo($wrpControls);
	}

	reset ({isResetAllMeta = false} = {}) {
		const metaNext = this._getInitialMetaState();
		if (!isResetAllMeta) this._reset_mutNextMetaState({metaNext});
		this.setStateFromLoaded({
			s: this._getInitialState(),
			m: metaNext,
		});
		this.renderInput();
		this.renderOutput();
		this.doUiSave();
	}

	_reset_mutNextMetaState ({metaNext}) { /* Implement as required */ }

	async _pHandleClick_pSaveBrew () {
		const source = this._state.source;
		if (!source) throw new Error(`Current state has no "source"!`);

		const clean = DataUtil.cleanJson(MiscUtil.copy(this.__state), {isDeleteUniqueId: false});
		if (this._meta.isPersisted) {
			await BrewUtil2.pPersistEditableBrewEntity(this._prop, clean);
			await this.pRenderSideMenu();
		} else {
			// If we are e.g. editing a copy of a non-editable brew's entity, we need to first convert the parent brew
			//   to "editable."
			if (
				BrewUtil2.sourceJsonToSource(source)
				&& !await BrewUtil2.pIsEditableSourceJson(source)
			) {
				const isMove = await InputUiUtil.pGetUserBoolean({
					title: "Move to Editable Homebrew Document",
					htmlDescription: `<div>Saving "${this._state.name}" with source "${this._state.source}" will move all homebrew from that source to the editable homebrew document.<br>Moving homebrew to the editable document will prevent it from being automatically updated in future.<br>Do you wish to proceed?<br><i class="ve-muted">Giving "${this._state.name}" an editable source will avoid this issue.</i></div>`,
					textYes: "Yes",
					textNo: "Cancel",
				});
				if (!isMove) return;

				const brew = await BrewUtil2.pMoveOrCopyToEditableBySourceJson(source);
				if (!brew) throw new Error(`Failed to make brew for source "${source}" editable!`);

				const nxtBrew = MiscUtil.copy(brew);
				// Ensure everything has a `uniqueId`
				let isAnyMod = this.prepareExistingEditableBrew({brew: nxtBrew});

				// We then need to attempt a find-replace on the hash of our current entity, as we may be trying to update
				//   one exact entity. This is not needed if e.g. a renamed copy of an existing entity is being made.
				const hash = UrlUtil.URL_TO_HASH_BUILDER[this._prop](clean);
				const ixExisting = (brew.body[this._prop] || []).findIndex(it => UrlUtil.URL_TO_HASH_BUILDER[this._prop](it) === hash);
				if (~ixExisting) {
					clean.uniqueId = clean.uniqueId || nxtBrew.body[this._prop][ixExisting].uniqueId;
					nxtBrew.body[this._prop][ixExisting] = clean;
					isAnyMod = true;
				}

				if (isAnyMod) await BrewUtil2.pSetEditableBrewDoc(nxtBrew);
			}

			await BrewUtil2.pPersistEditableBrewEntity(this._prop, clean);
			this._meta.isPersisted = true;
			await SearchWidget.P_LOADING_CONTENT;
			await SearchWidget.pAddToIndexes(this._prop, clean);
		}

		this._meta.isModified = false;
		this.doUiSave();
		await this.pDoPostSave();
		await this._pDoUpdateSidemenu();
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
	 * @return {jQuery}
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
		const $wrpRows = $(`<div class="ve-flex-col"/>`).appendTo($wrpRowsOuter);

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

		$$`<div class="ve-flex-col">
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

		out.$ele = $$`<div class="ve-flex-v-center mb-2 mkbru__wrp-rows--removable">${$iptUrl}${$btnPreview}${$btnRemove}${$dragOrder}</div>`;
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

	_getInitialState () {
		return {
			uniqueId: CryptUtil.uid(),
		};
	}

	_getInitialMetaState ({isModified = true, isPersisted = false} = {}) {
		return {
			isModified,
			isPersisted,
		};
	}

	async pInit () { await this._pInit(); }

	doHandleSourcesAdd () { throw new TypeError(`Unimplemented method!`); }
	_renderInputImpl () { throw new TypeError(`Unimplemented method!`); }
	renderOutput () { throw new TypeError(`Unimplemented method!`); }
	async pHandleSidebarLoadExistingClick () { throw new TypeError(`Unimplemented method!`); }
	async pHandleSidebarLoadExistingData (entity, opts) { throw new TypeError(`Unimplemented method!`); }
	async _pInit () {}
	async pDoPostSave () {}
	async pDoPostDelete () {}
}
Builder._BUILDERS = [];

class BuilderUi {
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
	 * @param [options.isRow] If the row body should use ve-flex row (instead of ve-flex col).
	 * @param [options.title] Tooltip text.
	 */
	static getLabelledRowTuple (name, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		const $rowInner = $(`<div class="${options.isRow ? "ve-flex" : "ve-flex-col"} w-100"/>`);
		const $row = $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row ve-flex-v-center"><span class="mr-2 mkbru__row-name ${options.isMarked ? `mkbru__row-name--marked` : ""} ${options.title ? "help" : ""}" ${options.title ? `title="${options.title}"` : ""}>${name}</span>${options.isMarked ? `<div class="mkbru__row-mark mr-2"/>` : ""}${$rowInner}</${eleType}></div>`;
		return [$row, $rowInner];
	}

	static __$getRow (name, $ipt, options) {
		options = options || {};

		const eleType = options.eleType || "div";

		return $$`<div class="mb-2 mkbru__row stripe-even"><${eleType} class="mkbru__wrp-row ve-flex-v-center">
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
							type: "entries",
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
		const initialState = this._$getStateIptStringArray_getInitialState(state, ...path);
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

	static _$getStateIptStringArray_getInitialState (state, ...path) {
		const initialState = MiscUtil.get(state, ...path) || [];
		if (initialState == null || initialState instanceof Array) return initialState;
		// Tolerate/"migrate" single-string data, as this is a common change in data structures
		if (typeof initialState === "string") return [initialState];
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

		const $wrp = $$`<div class="ve-flex-v-center mb-2">${$iptString}${$btnRemove}</div>`;
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
		return BuilderUi.__$getRow(name, $$`<div class="w-100 ve-flex-v-center">${$ipt}</div>`, {...options, eleType: "label"});
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
		const $wrpIpts = $(`<div class="ve-flex-col w-100 mr-2"/>`).appendTo($rowInner);
		const inputs = [];
		options.vals.forEach(val => {
			const $cb = $(`<input class="mkbru__ipt-cb" type="checkbox">`)
				.prop("checked", initialState.includes(val))
				.change(() => {
					BuilderUi.__setProp(getState(), options, state, ...path);
					fnRender();
				});
			inputs.push({$ipt: $cb, val});
			$$`<label class="ve-flex-v-center split stripe-odd--faint"><span>${options.fnDisplay ? options.fnDisplay(val) : val}</span>${$cb}</label>`.appendTo($wrpIpts);
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
			dragMeta.$wrap = $(`<div class="ve-flex-col ui-drag__wrp-drag-block"/>`).appendTo(options.$wrpRowsOuter);
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
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search
		await this.pPrepareExistingEditableBrew();
		await BrewUtil2.pGetBrewProcessed();
		await SearchUiUtil.pDoGlobalInit();
		// Do this asynchronously, to avoid blocking the load
		SearchWidget.pDoGlobalInit();

		TaggerUtils.init({legendaryGroups: await DataUtil.legendaryGroup.pLoadAll(), spells: await DataUtil.spell.pLoadAll()});

		// page-specific init
		await Builder.pInitAll();
		Renderer.utils.bindPronounceButtons();
		await ui.init();

		if (window.location.hash.length) await Makebrew.pHashChange();
		window.addEventListener("hashchange", Makebrew.pHashChange.bind(Makebrew));

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	/**
	 * The editor requires that each entity has a `uniqueId`, as e.g. hashing the entity does not produce a
	 * stable ID (since there may be duplicates, or the name may change).
	 */
	static async pPrepareExistingEditableBrew () {
		const brew = MiscUtil.copy(await BrewUtil2.pGetOrCreateEditableBrewDoc());

		let isAnyMod = false;
		Object.values(ui.builders)
			.forEach(builder => {
				const isAnyModBuilder = builder.prepareExistingEditableBrew({brew});
				isAnyMod = isAnyMod || isAnyModBuilder;
			});

		if (!isAnyMod) return;

		await BrewUtil2.pSetEditableBrewDoc(brew);
	}

	static async pHashChange () {
		try {
			await Makebrew._LOCK.pLock();
			return (await this._pHashChange());
		} finally {
			Makebrew._LOCK.unlock();
		}
	}

	static async _pHashChange () {
		const [builderMode, ...sub] = Hist.getHashParts();
		Hist.initialLoad = false; // Once we've extracted the hash's parts, we no longer care about preserving it

		if (!builderMode) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

		const builder = ui.getBuilderById(builderMode);
		if (!builder) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

		await ui.pSetActiveBuilderById(builderMode); // (This will update the hash to the active builder)

		if (!sub.length) return;

		const initialLoadMeta = UrlUtil.unpackSubHash(sub[0]);
		if (!initialLoadMeta.statemeta) return;

		const [page, source, hash] = initialLoadMeta.statemeta;
		let toLoad = await DataLoader.pCacheAndGet(page, source, hash, {isCopy: true});

		toLoad = await builder._pHashChange_pHandleSubHashes(sub, toLoad);

		return builder.pHandleSidebarLoadExistingData(toLoad, {isForce: true});
	}
}
Makebrew._LOCK = null;

const ui = new PageUi();

window.addEventListener("load", async () => {
	await Makebrew.doPageInit();
});

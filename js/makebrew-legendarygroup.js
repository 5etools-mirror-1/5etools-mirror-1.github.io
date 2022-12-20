"use strict";

class LegendaryGroupBuilder extends Builder {
	constructor () {
		super({
			titleSidebarLoadExisting: "Load Existing Legendary Group",
			titleSidebarDownloadJson: "Download Legendary Groups as JSON",
			prop: "legendaryGroup",
			titleSelectDefaultSource: "(Same as Legendary Group)",
		});

		this._renderOutputDebounced = MiscUtil.debounce(() => this._renderOutput(), 50);
	}

	async pHandleSidebarLoadExistingClick () {
		const result = await SearchWidget.pGetUserLegendaryGroupSearch();
		if (result) {
			const legGroup = MiscUtil.copy(await DataLoader.pCacheAndGet(result.page, result.source, result.hash));
			return this.pHandleSidebarLoadExistingData(legGroup);
		}
	}

	/**
	 * @param legGroup
	 * @param [opts]
	 * @param [opts.meta]
	 */
	async pHandleSidebarLoadExistingData (legGroup, opts) {
		opts = opts || {};

		legGroup.source = this._ui.source;

		delete legGroup.uniqueId;

		const meta = {...(opts.meta || {}), ...this._getInitialMetaState()};

		this.setStateFromLoaded({s: legGroup, m: meta});

		this.renderInput();
		this.renderOutput();
	}

	_getInitialState () {
		return {
			...super._getInitialState(),
			name: "New Legendary Group",
			lairActions: [],
			regionalEffects: [],
			mythicEncounter: [],
			source: this._ui ? this._ui.source : "",
		};
	}

	setStateFromLoaded (state) {
		if (!state?.s || !state?.m) return;

		this._doResetProxies();

		if (!state.s.uniqueId) state.s.uniqueId = CryptUtil.uid();

		this.__state = state.s;
		this.__meta = state.m;
	}

	doHandleSourcesAdd () { /* No-op */ }

	_renderInputImpl () {
		this.doCreateProxies();
		this.renderInputControls();
		this._renderInputMain();
	}

	_renderInputMain () {
		this._sourcesCache = MiscUtil.copy(this._ui.allSources);
		const $wrp = this._ui.$wrpInput.empty();

		const _cb = () => {
			// Prefer numerical pages if possible
			if (!isNaN(this._state.page)) this._state.page = Number(this._state.page);

			// do post-processing
			TagCondition.tryTagConditions(this._state, {isTagInflicted: true});

			this.renderOutput();
			this.doUiSave();
			this._meta.isModified = true;
		};
		const cb = MiscUtil.debounce(_cb, 33);
		this._cbCache = cb; // cache for use when updating sources

		// initialise tabs
		this._resetTabs({tabGroup: "input"});

		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Info", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Lair Actions", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Regional Effects", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Mythic Encounter", hasBorder: true}),
			],
			{
				tabGroup: "input",
				cbTabChange: this.doUiSave.bind(this),
			},
		);
		const [infoTab, lairActionsTab, regionalEffectsTab, mythicEncounterTab] = tabs;
		$$`<div class="ve-flex-v-center w-100 no-shrink ui-tab__wrp-tab-heads--border">${tabs.map(it => it.$btnTab)}</div>`.appendTo($wrp);
		tabs.forEach(it => it.$wrpTab.appendTo($wrp));

		// INFO
		BuilderUi.$getStateIptString("Name", cb, this._state, {nullable: false, callback: () => this.pRenderSideMenu()}, "name").appendTo(infoTab.$wrpTab);
		this._$selSource = this.$getSourceInput(cb).appendTo(infoTab.$wrpTab);

		// LAIR ACTIONS
		this.__$getLairActionsInput(cb).appendTo(lairActionsTab.$wrpTab);

		// REGIONAL EFFECTS
		this.__$getRegionalEffectsInput(cb).appendTo(regionalEffectsTab.$wrpTab);

		// MYTHIC ENCOUNTER
		this.__$getMythicEncounterEffectsInput(cb).appendTo(mythicEncounterTab.$wrpTab);
	}

	__$getLairActionsInput (cb) {
		return BuilderUi.$getStateIptEntries("Lair Actions", cb, this._state, {}, "lairActions");
	}

	__$getRegionalEffectsInput (cb) {
		return BuilderUi.$getStateIptEntries("Regional Effects", cb, this._state, {}, "regionalEffects");
	}

	__$getMythicEncounterEffectsInput (cb) {
		return BuilderUi.$getStateIptEntries("Mythic Encounter", cb, this._state, {}, "mythicEncounter");
	}

	renderOutput () {
		this._renderOutputDebounced();
	}

	_renderOutput () {
		const $wrp = this._ui.$wrpOutput.empty();

		// initialise tabs
		this._resetTabs({tabGroup: "output"});
		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Legendary Group"}),
				new TabUiUtil.TabMeta({name: "Data"}),
			],
			{
				tabGroup: "output",
				cbTabChange: this.doUiSave.bind(this),
			},
		);
		const [legGroupTab, dataTab] = tabs;
		$$`<div class="ve-flex-v-center w-100 no-shrink">${tabs.map(it => it.$btnTab)}</div>`.appendTo($wrp);
		tabs.forEach(it => it.$wrpTab.appendTo($wrp));

		// Legendary Group
		const $tblLegGroup = $(`<table class="w-100 stats"/>`).appendTo(legGroupTab.$wrpTab);
		RenderBestiary.$getRenderedLegendaryGroup(this._state).appendTo($tblLegGroup);

		// Data
		const $tblData = $(`<table class="stats stats--book mkbru__wrp-output-tab-data"/>`).appendTo(dataTab.$wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [
				{
					type: "code",
					name: `Data`,
					preformatted: JSON.stringify(DataUtil.cleanJson(MiscUtil.copy(this._state)), null, "\t"),
				},
			],
		});
		$tblData.append(Renderer.utils.getBorderTr());
		$tblData.append(`<tr><td colspan="6">${asCode}</td></tr>`);
		$tblData.append(Renderer.utils.getBorderTr());
	}

	async pDoPostSave () { await ui.creatureBuilder.pUpdateLegendaryGroups(); }
	async pDoPostDelete () { await ui.creatureBuilder.pUpdateLegendaryGroups(); }
}

const legendaryGroupBuilder = new LegendaryGroupBuilder();

ui.legendaryGroupBuilder = legendaryGroupBuilder;
legendaryGroupBuilder.ui = ui;

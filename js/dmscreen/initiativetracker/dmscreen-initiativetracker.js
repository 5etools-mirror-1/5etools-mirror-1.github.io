import {InitiativeTrackerConst} from "./dmscreen-initiativetracker-consts.js";
import {InitiativeTrackerNetworking} from "./dmscreen-initiativetracker-networking.js";
import {InitiativeTrackerSettings} from "./dmscreen-initiativetracker-settings.js";
import {InitiativeTrackerSettingsImport} from "./dmscreen-initiativetracker-importsettings.js";
import {InitiativeTrackerMonsterAdd} from "./dmscreen-initiativetracker-monsteradd.js";
import {InitiativeTrackerRoller} from "./dmscreen-initiativetracker-roller.js";
import {InitiativeTrackerEncounterConverter} from "./dmscreen-initiativetracker-encounterconverter.js";
import {
	InitiativeTrackerStatColumnFactory,
	IS_PLAYER_VISIBLE_ALL,
} from "./dmscreen-initiativetracker-statcolumns.js";
import {
	InitiativeTrackerRowDataViewActive,
} from "./dmscreen-initiativetracker-rowsactive.js";
import {
	InitiativeTrackerConditionCustomSerializer,
	InitiativeTrackerRowDataSerializer,
	InitiativeTrackerStatColumnDataSerializer,
} from "./dmscreen-initiativetracker-serial.js";
import {InitiativeTrackerSort} from "./dmscreen-initiativetracker-sort.js";
import {InitiativeTrackerUtil} from "../../initiativetracker/initiativetracker-utils.js";
import {DmScreenUtil} from "../dmscreen-util.js";
import {
	InitiativeTrackerRowStateBuilderActive,
	InitiativeTrackerRowStateBuilderDefaultParty,
} from "./dmscreen-initiativetracker-rowstatebuilder.js";
import {InitiativeTrackerDefaultParty} from "./dmscreen-initiativetracker-defaultparty.js";

export class InitiativeTracker extends BaseComponent {
	constructor ({board, savedState}) {
		super();

		this._board = board;
		this._savedState = savedState;

		this._networking = new InitiativeTrackerNetworking({board});
		this._roller = new InitiativeTrackerRoller();
		this._rowStateBuilderActive = new InitiativeTrackerRowStateBuilderActive({comp: this, roller: this._roller});
		this._rowStateBuilderDefaultParty = new InitiativeTrackerRowStateBuilderDefaultParty({comp: this, roller: this._roller});

		this._viewRowsActive = null;
		this._viewRowsActiveMeta = null;

		this._compDefaultParty = null;

		this._creatureViewers = [];
	}

	render () {
		if (this._viewRowsActiveMeta) this._viewRowsActiveMeta.cbDoCleanup();
		this._resetHooks("state");
		this._resetHooksAll("state");

		this._setStateFromSerialized();

		this._render_bindSortDirHooks();

		const $wrpTracker = $(`<div class="dm-init dm__panel-bg dm__data-anchor"></div>`);

		const sendStateToClientsDebounced = MiscUtil.debounce(
			() => {
				this._networking.sendStateToClients({fnGetToSend: this._getPlayerFriendlyState.bind(this)});
				this._sendStateToCreatureViewers();
			},
			100, // long delay to avoid network spam
		);

		const doUpdateExternalStates = () => {
			this._board.doSaveStateDebounced();
			sendStateToClientsDebounced();
		};
		this._addHookAllBase(doUpdateExternalStates);

		this._viewRowsActive = new InitiativeTrackerRowDataViewActive({
			comp: this,
			prop: "rows",
			roller: this._roller,
			networking: this._networking,
			rowStateBuilder: this._rowStateBuilderActive,
		});
		this._viewRowsActiveMeta = this._viewRowsActive.getRenderedView();
		this._viewRowsActiveMeta.$ele.appendTo($wrpTracker);

		this._render_$getWrpFooter({doUpdateExternalStates}).appendTo($wrpTracker);

		$wrpTracker.data("pDoConnectLocalV1", async () => {
			const {token} = await this._networking.startServerV1({doUpdateExternalStates});
			return token;
		});

		$wrpTracker.data("pDoConnectLocalV0", async (clientView) => {
			await this._networking.pHandleDoConnectLocalV0({clientView});
			sendStateToClientsDebounced();
		});

		$wrpTracker.data("getState", () => this._getSerializedState());
		$wrpTracker.data("getSummary", () => {
			const names = this._state.rows
				.map(({entity}) => entity.name)
				.filter(name => name && name.trim());

			return `${this._state.rows.length} creature${this._state.rows.length === 1 ? "" : "s"} ${names.length ? `(${names.slice(0, 3).join(", ")}${names.length > 3 ? "..." : ""})` : ""}`;
		});

		$wrpTracker.data("pDoLoadEncounter", ({entityInfos, encounterInfo}) => this._pDoLoadEncounter({entityInfos, encounterInfo}));

		$wrpTracker.data("getApi", () => this);

		return $wrpTracker;
	}

	_render_$getWrpButtonsSort () {
		const $btnSortAlpha = $(`<button title="Sort Alphabetically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-alphabet"></span></button>`)
			.on("click", () => {
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA) return this._doReverseSortDir();
				this._proxyAssignSimple(
					"state",
					{
						sort: InitiativeTrackerConst.SORT_ORDER_ALPHA,
						dir: InitiativeTrackerConst.SORT_DIR_ASC,
					},
				);
			});

		const $btnSortNumber = $(`<button title="Sort Numerically" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-sort-by-order"></span></button>`)
			.on("click", () => {
				if (this._state.sort === InitiativeTrackerConst.SORT_ORDER_NUM) return this._doReverseSortDir();
				this._proxyAssignSimple(
					"state",
					{
						sort: InitiativeTrackerConst.SORT_ORDER_NUM,
						dir: InitiativeTrackerConst.SORT_DIR_DESC,
					},
				);
			});

		const hkSortDir = () => {
			$btnSortAlpha.toggleClass("active", this._state.sort === InitiativeTrackerConst.SORT_ORDER_ALPHA);
			$btnSortNumber.toggleClass("active", this._state.sort === InitiativeTrackerConst.SORT_ORDER_NUM);
		};
		this._addHookBase("sort", hkSortDir);
		this._addHookBase("dir", hkSortDir);
		hkSortDir();

		return $$`<div class="btn-group ve-flex">
			${$btnSortAlpha}
			${$btnSortNumber}
		</div>`;
	}

	_render_$getWrpFooter ({doUpdateExternalStates}) {
		const $btnAdd = $(`<button class="btn btn-primary btn-xs dm-init-lockable" title="Add Player"><span class="glyphicon glyphicon-plus"></span></button>`)
			.on("click", async () => {
				if (this._state.isLocked) return;
				this._state.rows = [
					...this._state.rows,
					await this._rowStateBuilderActive.pGetNewRowState({
						isPlayerVisible: true,
					}),
				]
					.filter(Boolean);
			});

		const $btnAddMonster = $(`<button class="btn btn-success btn-xs dm-init-lockable mr-2" title="Add Monster"><span class="glyphicon glyphicon-print"></span></button>`)
			.on("click", async () => {
				if (this._state.isLocked) return;

				const [isDataEntered, monstersToLoad] = await new InitiativeTrackerMonsterAdd({board: this._board, isRollHp: this._state.isRollHp})
					.pGetShowModalResults();
				if (!isDataEntered) return;

				this._state.isRollHp = monstersToLoad.isRollHp;

				const isGroupRollEval = monstersToLoad.count > 1 && this._state.isRollGroups;

				const mon = isGroupRollEval
					? await DmScreenUtil.pGetScaledCreature({
						name: monstersToLoad.name,
						source: monstersToLoad.source,
						scaledCr: monstersToLoad.scaledCr,
						scaledSummonSpellLevel: monstersToLoad.scaledSummonSpellLevel,
						scaledSummonClassLevel: monstersToLoad.scaledSummonClassLevel,
					})
					: null;

				const initiative = isGroupRollEval
					? await this._roller.pGetRollInitiative({mon})
					: null;

				const rowsNxt = [...this._state.rows];

				(await [...new Array(monstersToLoad.count)]
					.pSerialAwaitMap(async () => {
						const rowNxt = await this._rowStateBuilderActive.pGetNewRowState({
							name: monstersToLoad.name,
							source: monstersToLoad.source,
							initiative,
							rows: rowsNxt,
							displayName: monstersToLoad.displayName,
							customName: monstersToLoad.customName,
							scaledCr: monstersToLoad.scaledCr,
							scaledSummonSpellLevel: monstersToLoad.scaledSummonSpellLevel,
							scaledSummonClassLevel: monstersToLoad.scaledSummonClassLevel,
						});
						if (!rowNxt) return;
						rowsNxt.push(rowNxt);
					}));

				this._state.rows = rowsNxt;
			});

		const $btnSetPrevActive = $(`<button class="btn btn-default btn-xs" title="Previous Turn"><span class="glyphicon glyphicon-step-backward"></span></button>`)
			.click(() => this._viewRowsActive.pDoShiftActiveRow({direction: InitiativeTrackerConst.DIR_BACKWARDS}));
		const $btnSetNextActive = $(`<button class="btn btn-default btn-xs mr-2" title="Next Turn"><span class="glyphicon glyphicon-step-forward"></span></button>`)
			.click(() => this._viewRowsActive.pDoShiftActiveRow({direction: InitiativeTrackerConst.DIR_FORWARDS}));

		const $iptRound = ComponentUiUtil.$getIptInt(this, "round", 1, {min: 1})
			.addClass("dm-init__rounds")
			.removeClass("text-right")
			.addClass("ve-text-center")
			.title("Round");

		const menuPlayerWindow = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Standard",
				async () => {
					this._networking.handleClick_playerWindowV1({doUpdateExternalStates});
				},
			),
			new ContextUtil.Action(
				"Manual (Legacy)",
				async () => {
					this._networking.handleClick_playerWindowV0({doUpdateExternalStates});
				},
			),
		]);

		const $btnNetworking = $(`<button class="btn btn-primary btn-xs mr-2" title="Player View (SHIFT to Open &quot;Standard&quot; View)"><span class="glyphicon glyphicon-user"></span></button>`)
			.click(evt => {
				if (evt.shiftKey) return this._networking.handleClick_playerWindowV1({doUpdateExternalStates});
				return ContextUtil.pOpenMenu(evt, menuPlayerWindow);
			});

		const $btnLock = $(`<button class="btn btn-danger btn-xs" title="Lock Tracker"><span class="glyphicon glyphicon-lock"></span></button>`)
			.on("click", () => this._state.isLocked = !this._state.isLocked);
		this._addHookBase("isLocked", () => {
			$btnLock
				.toggleClass("btn-success", !!this._state.isLocked)
				.toggleClass("btn-danger", !this._state.isLocked)
				.title(this._state.isLocked ? "Unlock Tracker" : "Lock Tracker");
			$(".dm-init-lockable").toggleClass("disabled", !!this._state.isLocked);
			$("input.dm-init-lockable").prop("disabled", !!this._state.isLocked);
		})();

		this._compDefaultParty = new InitiativeTrackerDefaultParty({comp: this, roller: this._roller, rowStateBuilder: this._rowStateBuilderDefaultParty});

		const pHandleClickSettings = async () => {
			const compSettings = new InitiativeTrackerSettings({state: MiscUtil.copyFast(this._state)});
			await compSettings.pGetShowModalResults();
			Object.assign(this._state, compSettings.getStateUpdate());
		};

		const menuConfigure = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Settings",
				() => pHandleClickSettings(),
			),
			null,
			new ContextUtil.Action(
				"Edit Default Party",
				async () => {
					await this._compDefaultParty.pGetShowModalResults();
				},
			),
		]);

		const $btnConfigure = $(`<button class="btn btn-default btn-xs mr-2" title="Configure (SHIFT to Open &quot;Settings&quot;)"><span class="glyphicon glyphicon-cog"></span></button>`)
			.click(async evt => {
				if (evt.shiftKey) return pHandleClickSettings();
				return ContextUtil.pOpenMenu(evt, menuConfigure);
			});

		const menuImport = ContextUtil.getMenu([
			...ListUtilBestiary.getContextOptionsLoadSublist({
				pFnOnSelect: this._pDoLoadEncounter.bind(this),
			}),
			null,
			new ContextUtil.Action(
				"Import Settings",
				async () => {
					const compImportSettings = new InitiativeTrackerSettingsImport({state: MiscUtil.copyFast(this._state)});
					await compImportSettings.pGetShowModalResults();
					Object.assign(this._state, compImportSettings.getStateUpdate());
				},
			),
		]);

		const $btnLoad = $(`<button title="Import an encounter from the Bestiary" class="btn btn-success btn-xs dm-init-lockable"><span class="glyphicon glyphicon-upload"></span></button>`)
			.click((evt) => {
				if (this._state.isLocked) return;
				ContextUtil.pOpenMenu(evt, menuImport);
			});
		const $btnReset = $(`<button title="Reset" class="btn btn-danger btn-xs dm-init-lockable"><span class="glyphicon glyphicon-trash"></span></button>`)
			.click(async () => {
				if (this._state.isLocked) return;
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;

				const stateNxt = {
					rows: await this._compDefaultParty.pGetConvertedDefaultPartyActiveRows(),
				};
				const defaultState = this._getDefaultState();
				["round", "sort", "dir"]
					.forEach(prop => stateNxt[prop] = defaultState[prop]);

				this._proxyAssignSimple("state", stateNxt);
			});

		return $$`<div class="dm-init__wrp-controls">
			<div class="ve-flex">
				<div class="btn-group ve-flex">
					${$btnAdd}
					${$btnAddMonster}
				</div>
				<div class="btn-group">${$btnSetPrevActive}${$btnSetNextActive}</div>
				${$iptRound}
			</div>

			${this._render_$getWrpButtonsSort()}

			<div class="ve-flex">
				${$btnNetworking}

				<div class="btn-group ve-flex-v-center">
					${$btnLock}
					${$btnConfigure}
				</div>

				<div class="btn-group ve-flex-v-center">
					${$btnLoad}
					${$btnReset}
				</div>
			</div>
		</div>`;
	}

	_render_bindSortDirHooks () {
		const hkSortDir = () => {
			this._state.rows = InitiativeTrackerSort.getSortedRows({
				rows: this._state.rows,
				sortBy: this._state.sort,
				sortDir: this._state.dir,
			});
		};
		this._addHookBase("sort", hkSortDir);
		this._addHookBase("dir", hkSortDir);
		hkSortDir();
	}

	/* -------------------------------------------- */

	_doReverseSortDir () {
		this._state.dir = this._state.dir === InitiativeTrackerConst.SORT_DIR_ASC ? InitiativeTrackerConst.SORT_DIR_DESC : InitiativeTrackerConst.SORT_DIR_ASC;
	}

	/* -------------------------------------------- */

	_getPlayerFriendlyState () {
		const visibleStatsCols = this._state.statsCols
			.filter(data => data.isPlayerVisible);

		const rows = this._state.rows
			.map(({entity}) => {
				if (!entity.isPlayerVisible) return null;

				const isMon = !!entity.source;

				const out = {
					name: entity.name,
					initiative: entity.initiative,
					isActive: entity.isActive,
					conditions: entity.conditions || [],
					rowStatColData: entity.rowStatColData
						.map(cell => {
							const mappedCol = visibleStatsCols.find(sc => sc.id === cell.id);
							if (!mappedCol) return null;

							if (mappedCol.isPlayerVisible === IS_PLAYER_VISIBLE_ALL || !isMon) {
								const meta = InitiativeTrackerStatColumnFactory.fromStateData({data: mappedCol});
								return meta.getPlayerFriendlyState({cell});
							}

							return {id: null, entity: {isUnknown: true}};
						})
						.filter(Boolean),
				};

				if (entity.customName) out.customName = entity.customName;

				if (isMon ? !!this._state.playerInitShowExactMonsterHp : !!this._state.playerInitShowExactPlayerHp) {
					out.hpCurrent = entity.hpCurrent;
					out.hpMax = entity.hpMax;
				} else {
					out.hpWoundLevel = isNaN(entity.hpCurrent) || isNaN(entity.hpMax)
						? -1
						: InitiativeTrackerUtil.getWoundLevel(100 * entity.hpCurrent / entity.hpMax);
				}

				if (this._state.playerInitShowOrdinals && entity.isShowOrdinal) out.ordinal = entity.ordinal;

				return out;
			})
			.filter(Boolean);

		return {
			type: "state",
			payload: {
				rows,
				statsCols: visibleStatsCols
					.map(({id, abbreviation}) => ({id, abbreviation})),
				round: this._state.round,
			},
		};
	}

	/* -------------------------------------------- */

	async _pDoLoadEncounter ({entityInfos, encounterInfo}) {
		// Reset rows early, such that our ordinals are correct for creatures from the encounter
		this._state.rows = [];

		const isAddPlayers = this._state.importIsAddPlayers && !this._state.rowsDefaultParty.length;

		const nxtState = await new InitiativeTrackerEncounterConverter({
			roller: this._roller,
			rowStateBuilderActive: this._rowStateBuilderActive,

			importIsAddPlayers: isAddPlayers,
			importIsRollGroups: this._state.importIsRollGroups,
			isRollInit: this._state.isRollInit,
			isRollHp: this._state.isRollHp,
			isRollGroups: this._state.isRollGroups,
		}).pGetConverted({entityInfos, encounterInfo});

		const rowsFromDefaultParty = await this._compDefaultParty.pGetConvertedDefaultPartyActiveRows();

		const stateNxt = {
			// region TODO(DMS) not ideal--merge columns instead? Note that this also clobbers default party info
			isStatsAddColumns: nxtState.isStatsAddColumns,
			statsCols: nxtState.statsCols
				.map(it => it.getAsStateData()),
			// endregion

			rows: this._state.importIsAppend
				? [
					...this._state.rows,
					...rowsFromDefaultParty,
					...nxtState.rows,
				]
				: [
					...rowsFromDefaultParty,
					...nxtState.rows,
				],
		};

		if (!this._state.importIsAppend) {
			const defaultState = this._getDefaultState();
			["round", "sort", "dir"]
				.forEach(prop => stateNxt[prop] = defaultState[prop]);
		}

		this._proxyAssignSimple("state", stateNxt);
	}

	/* -------------------------------------------- */

	doConnectCreatureViewer ({creatureViewer}) {
		if (this._creatureViewers.includes(creatureViewer)) return this;
		this._creatureViewers.push(creatureViewer);
		creatureViewer.setCreatureState(this._getCreatureViewerFriendlyState());
		return this;
	}

	static _CREATURE_VIEWER_STATE_PROPS = [
		"name",
		"source",
		"scaledCr",
		"scaledSummonSpellLevel",
		"scaledSummonClassLevel",
	];

	_getCreatureViewerFriendlyState () {
		const activeRowPrime = this._state.rows
			.filter(({entity}) => entity.isActive)
			.find(Boolean);

		if (!activeRowPrime) {
			return Object.fromEntries(this.constructor._CREATURE_VIEWER_STATE_PROPS.map(prop => [prop, null]));
		}

		return Object.fromEntries(this.constructor._CREATURE_VIEWER_STATE_PROPS.map(prop => [prop, activeRowPrime.entity[prop]]));
	}

	doDisconnectCreatureViewer ({creatureViewer}) {
		this._creatureViewers = this._creatureViewers.filter(it => it !== creatureViewer);
	}

	_sendStateToCreatureViewers () {
		if (!this._creatureViewers.length) return;
		const creatureViewerFriendlyState = this._getCreatureViewerFriendlyState();
		this._creatureViewers.forEach(it => it.setCreatureState(creatureViewerFriendlyState));
	}

	/* -------------------------------------------- */

	_setStateFromSerialized () {
		const stateNxt = {
			// region Config
			sort: this._savedState.s || InitiativeTrackerConst.SORT_ORDER_NUM,
			dir: this._savedState.d || InitiativeTrackerConst.SORT_DIR_DESC,
			statsCols: (this._savedState.c || [])
				.map(dataSerial => this._setStateFromSerialized_statsCol({dataSerial}))
				.filter(Boolean),
			// endregion

			// region Custom conditions
			conditionsCustom: (this._savedState.cndc || [])
				.map(dataSerial => InitiativeTrackerConditionCustomSerializer.fromSerial(dataSerial)),
			// endregion

			// region Rows
			rows: (this._savedState.r || [])
				.map(dataSerial => InitiativeTrackerRowDataSerializer.fromSerial(dataSerial))
				.filter(Boolean),
			rowsDefaultParty: (this._savedState.rdp || [])
				.map(dataSerial => InitiativeTrackerRowDataSerializer.fromSerial(dataSerial))
				.filter(Boolean),
			// endregion

			// region Round
			round: isNaN(this._savedState.n) ? 1 : Number(this._savedState.n),
			// endregion

			// region Temporary
			isLocked: false,
			// endregion
		};

		// region Config
		if (this._savedState.ri != null) stateNxt.isRollInit = this._savedState.ri;
		if (this._savedState.m != null) stateNxt.isRollHp = this._savedState.m;
		if (this._savedState.rg != null) stateNxt.isRollGroups = this._savedState.rg;
		if (this._savedState.rri != null) stateNxt.isRerollInitiativeEachRound = this._savedState.rri;
		if (this._savedState.g != null) stateNxt.importIsRollGroups = this._savedState.g;
		if (this._savedState.p != null) stateNxt.importIsAddPlayers = this._savedState.p;
		if (this._savedState.a != null) stateNxt.importIsAppend = this._savedState.a;
		if (this._savedState.k != null) stateNxt.statsAddColumns = this._savedState.k;
		if (this._savedState.piHp != null) stateNxt.playerInitShowExactPlayerHp = this._savedState.piHp;
		if (this._savedState.piHm != null) stateNxt.playerInitShowExactMonsterHp = this._savedState.piHm;
		if (this._savedState.piV != null) stateNxt.playerInitHideNewMonster = this._savedState.piV;
		if (this._savedState.piO != null) stateNxt.playerInitShowOrdinals = this._savedState.piO;
		// endregion

		this._proxyAssignSimple("state", stateNxt);
	}

	_setStateFromSerialized_statsCol ({dataSerial}) {
		if (!dataSerial) return null;
		return InitiativeTrackerStatColumnFactory.fromStateData({dataSerial})
			.getAsStateData();
	}

	_getSerializedState () {
		return {
			// region Config
			s: this._state.sort,
			d: this._state.dir,
			ri: this._state.isRollInit,
			m: this._state.isRollHp,
			rg: this._state.isRollGroups,
			rri: this._state.isRerollInitiativeEachRound,
			g: this._state.importIsRollGroups,
			p: this._state.importIsAddPlayers,
			a: this._state.importIsAppend,
			k: this._state.statsAddColumns,
			piHp: this._state.playerInitShowExactPlayerHp,
			piHm: this._state.playerInitShowExactMonsterHp,
			piV: this._state.playerInitHideNewMonster,
			piO: this._state.playerInitShowOrdinals,
			c: (this._state.statsCols || [])
				.map(data => InitiativeTrackerStatColumnDataSerializer.toSerial(data)),
			// endregion

			// region Custom conditions
			cndc: (this._state.conditionsCustom || [])
				.map(data => InitiativeTrackerConditionCustomSerializer.toSerial(data)),
			// endregion

			// region Rows
			r: (this._state.rows || [])
				.map(data => InitiativeTrackerRowDataSerializer.toSerial(data)),
			rdp: (this._state.rowsDefaultParty || [])
				.map(data => InitiativeTrackerRowDataSerializer.toSerial(data)),
			// endregion

			// region Round
			n: this._state.round,
			// endregion
		};
	}

	_getDefaultState () {
		return {
			// region Config
			sort: InitiativeTrackerConst.SORT_ORDER_NUM,
			dir: InitiativeTrackerConst.SORT_DIR_DESC,
			isRollInit: true,
			isRollHp: false,
			isRollGroups: false,
			isRerollInitiativeEachRound: false,
			importIsRollGroups: true,
			importIsAddPlayers: true,
			importIsAppend: false,
			statsAddColumns: false,
			playerInitShowExactPlayerHp: false,
			playerInitShowExactMonsterHp: false,
			playerInitHideNewMonster: true,
			playerInitShowOrdinals: false,
			statsCols: [],
			// endregion

			// region Custom conditions
			conditionsCustom: [],
			// endregion

			// region Rows
			rows: [],
			rowsDefaultParty: [],
			// endregion

			// region Round
			round: 1,
			// endregion

			// region Temporary
			isLocked: false,
			// endregion
		};
	}

	/* -------------------------------------------- */

	static $getPanelElement (board, savedState) {
		return new this({board, savedState}).render();
	}
}

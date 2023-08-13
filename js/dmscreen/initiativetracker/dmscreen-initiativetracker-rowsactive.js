import {
	INITIATIVE_APPLICABILITY_NOT_APPLICABLE,
	InitiativeTrackerStatColumnFactory,
	IS_PLAYER_VISIBLE_ALL,
	IS_PLAYER_VISIBLE_NONE,
} from "./dmscreen-initiativetracker-statcolumns.js";
import {InitiativeTrackerConditionAdd} from "./dmscreen-initiativetracker-conditionadd.js";
import {InitiativeTrackerUi} from "./dmscreen-initiativetracker-ui.js";
import {InitiativeTrackerConst} from "./dmscreen-initiativetracker-consts.js";
import {InitiativeTrackerSort} from "./dmscreen-initiativetracker-sort.js";
import {RenderableCollectionConditions} from "../../initiativetracker/initiativetracker-utils.js";
import {
	InitiativeTrackerRowDataViewBase,
	RenderableCollectionRowDataBase,
} from "./dmscreen-initiativetracker-rowsbase.js";
import {InitiativeTrackerRowStateBuilderActive} from "./dmscreen-initiativetracker-rowstatebuilder.js";

class _RenderableCollectionRowDataActive extends RenderableCollectionRowDataBase {
	constructor (
		{
			comp,
			$wrpRows,
			roller,
			networking,
			rowStateBuilder,
		},
	) {
		super({comp, prop: "rows", $wrpRows, roller, networking, rowStateBuilder});
	}

	async _pPopulateRow_pGetMonsterMeta ({comp}) {
		const isMon = !!comp._state.source;

		const mon = isMon
			? await this._rowStateBuilder.pGetScaledCreature({isMon, ...comp._state})
			: null;
		const fluff = mon ? await Renderer.monster.pGetFluff(mon) : null;

		return {
			isMon,
			mon,
			fluff,
		};
	}

	/* ----- */

	_pPopulateRow_monster ({comp, $wrpLhs, isMon, mon, fluff}) {
		if (!isMon) return;

		const $dispOrdinal = $(`<span class="dm-init__number"></span>`);
		comp._addHookBase("ordinal", () => $dispOrdinal.text(`(${comp._state.ordinal})`))();
		comp._addHookBase("isShowOrdinal", () => $dispOrdinal.toggleVe(comp._state.isShowOrdinal))();

		const $lnk = $(this._pPopulateRow_monster_getRenderedLink({comp}))
			.attr("tabindex", "-1");
		comp._addHookBase("customName", () => {
			$lnk.text(comp._state.customName ? comp._state.customName : comp._state.displayName || comp._state.name);
		})();

		const $btnRename = $(`<button class="btn btn-default btn-xs dm-init-lockable dm-init__btn-creature" title="Rename (SHIFT to Reset)" tabindex="-1"><span class="glyphicon glyphicon-pencil"></span></button>`)
			.click(async evt => {
				if (this._comp._state.isLocked) return;

				if (evt.shiftKey) return comp._state.customName = null;

				const customName = await InputUiUtil.pGetUserString({title: "Enter Name"});
				if (customName == null || !customName.trim()) return;
				comp._state.customName = customName;
			});

		const $btnDuplicate = $(`<button class="btn btn-success btn-xs dm-init-lockable dm-init__btn-creature" title="Add Another (SHIFT for Roll New)" tabindex="-1"><span class="glyphicon glyphicon-plus"></span></button>`)
			.click(async (evt) => {
				if (this._comp._state.isLocked) return;

				const isRollNew = !!evt.shiftKey;

				const initiative = isRollNew ? await this._roller.pGetRollInitiative({mon}) : comp._state.initiative;
				const isActive = isRollNew ? (initiative === comp._state.initiative) : comp._state.isActive;

				const hpMax = isRollNew ? await this._roller.pGetOrRollHp(mon, {isRollHp: this._comp._state.isRollHp}) : comp._state.hpMax;

				const similarCreatureRows = this._rowStateBuilder.getSimilarRows({rowEntity: comp._state});

				this._comp._state[this._prop] = InitiativeTrackerSort.getSortedRows({
					rows: [
						...this._comp._state[this._prop],
						await this._rowStateBuilder.pGetNewRowState({
							isActive,
							isPlayerVisible: comp._state.isPlayerVisible,
							name: comp._state.name,
							displayName: comp._state.displayName,
							scaledCr: comp._state.scaledCr,
							scaledSummonSpellLevel: comp._state.scaledSummonSpellLevel,
							scaledSummonClassLevel: comp._state.scaledSummonClassLevel,
							customName: comp._state.customName,
							source: comp._state.source,
							hpCurrent: hpMax, // Always reset to max HP
							hpMax: hpMax,
							initiative,
							ordinal: Math.max(...similarCreatureRows.map(row => row.entity.ordinal)) + 1,
							rowStatColData: isRollNew ? this._rowStateBuilder._getInitialRowStatColData({mon, fluff}) : MiscUtil.copyFast(comp._state.rowStatColData),
							conditions: [],
						}),
					]
						.filter(Boolean),
					sortBy: this._comp._state.sort,
					sortDir: this._comp._state.dir,
				});
			});

		$$`<div class="dm-init__wrp-creature split">
			<span class="dm-init__wrp-creature-link">
				${$lnk}
				${$dispOrdinal}
			</span>
			<div class="ve-flex-v-center btn-group mr-3p">
				${$btnRename}
				${$btnDuplicate}
			</div>
		</div>`.appendTo($wrpLhs);
	}

	_pPopulateRow_monster_getRenderedLink ({comp}) {
		if (
			comp._state.scaledCr == null
			&& comp._state.scaledSummonSpellLevel == null
			&& comp._state.scaledSummonClassLevel == null
		) return Renderer.get().render(`{@creature ${comp._state.name}|${comp._state.source}}`);

		const parts = [
			comp._state.name,
			comp._state.source,
			comp._state.displayName,
			comp._state.scaledCr != null
				? `${VeCt.HASH_SCALED}=${Parser.numberToCr(comp._state.scaledCr)}`
				: comp._state.scaledSummonSpellLevel != null
					? `${VeCt.HASH_SCALED_SPELL_SUMMON}=${comp._state.scaledSummonSpellLevel}`
					: comp._state.scaledSummonClassLevel != null
						? `${VeCt.HASH_SCALED_CLASS_SUMMON}=${comp._state.scaledSummonClassLevel}`
						: null,
		];
		return Renderer.get().render(`{@creature ${parts.join("|")}}`);
	}

	/* ----- */

	_pPopulateRow_conditions ({comp, $wrpLhs}) {
		const $btnAddCond = $(`<button class="btn btn-warning btn-xs dm-init__row-btn dm-init__row-btn-flag" title="Add Condition" tabindex="-1"><span class="glyphicon glyphicon-flag"></span></button>`)
			.on("click", async () => {
				const compAdd = new InitiativeTrackerConditionAdd({conditionsCustom: MiscUtil.copyFast(this._comp._state.conditionsCustom)});
				const [isDataEntered, conditionToAdd] = await compAdd.pGetShowModalResults();

				// Always update the set of custom conditions
				this._comp._state.conditionsCustom = compAdd.getConditionsCustom();

				if (!isDataEntered) return;

				comp._state.conditions = [
					...comp._state.conditions,
					conditionToAdd,
				];
			});

		const $wrpConds = $(`<div class="init__wrp_conds h-100"></div>`);

		$$`<div class="split">
			${$wrpConds}
			${$btnAddCond}
		</div>`.appendTo($wrpLhs);

		const collectionConditions = new RenderableCollectionConditions({
			comp: comp,
			$wrpRows: $wrpConds,
		});
		comp._addHookBase("conditions", () => collectionConditions.render())();
	}

	/* ----- */

	_pPopulateRow_initiative ({comp, $wrpRhs}) {
		const $iptInitiative = ComponentUiUtil.$getIptNumber(
			comp,
			"initiative",
			null,
			{
				isAllowNull: true,
				fallbackOnNaN: null,
				html: `<input class="form-control input-sm score dm-init-lockable dm-init__row-input ve-text-center dm-init__ipt--rhs">`,
			},
		)
			.on("click", () => $iptInitiative.select())
			.appendTo($wrpRhs);
	}

	/* ----- */

	_pPopulateRow_btns ({comp, entity, $wrpRhs}) {
		const $btnVisible = InitiativeTrackerUi.$getBtnPlayerVisible(
			comp._state.isPlayerVisible,
			() => comp._state.isPlayerVisible = $btnVisible.hasClass("btn-primary")
				? IS_PLAYER_VISIBLE_ALL
				: IS_PLAYER_VISIBLE_NONE,
			false,
		)
			.title("Shown in player view")
			.addClass("dm-init__row-btn")
			.addClass("dm-init__btn_eye")
			.appendTo($wrpRhs);

		$(`<button class="btn btn-danger btn-xs dm-init__row-btn dm-init-lockable" title="Delete (SHIFT to Also Delete Similar)" tabindex="-1"><span class="glyphicon glyphicon-trash"></span></button>`)
			.appendTo($wrpRhs)
			.on("click", evt => {
				if (this._comp._state.isLocked) return;

				if (evt.shiftKey) {
					return this._utils.doDeleteMultiple({
						entities: this._rowStateBuilder.getSimilarRows({
							rows: this._comp[this._prop],
							rowEntity: entity.entity,
						}),
					});
				}

				this._utils.doDelete({entity});
			});
	}

	/* -------------------------------------------- */

	_doHandleTurnStart ({rows, direction, row, isSkipRoundStart}) {
		const {isRoundStart = false} = isSkipRoundStart ? {} : this._doHandleRoundStart({rows, direction, row});

		this._comp._getRenderedCollection({prop: this._prop})[row.id]?.cbOnTurnStart({state: row, direction});

		return {isRoundStart};
	}

	_doHandleRoundStart ({rows, direction, row}) {
		if (!rows.length) return {isRoundStart: false};

		if (rows[0]?.id !== row?.id) return {isRoundStart: false};

		if (direction === InitiativeTrackerConst.DIR_FORWARDS) ++this._comp._state.round;

		const rendereds = this._comp._getRenderedCollection({prop: this._prop});
		rows.forEach(row => rendereds[row.id]?.cbOnRoundStart({state: row, direction}));

		return {isRoundStart: true};
	}

	/* -------------------------------------------- */

	_getSortedRowsCopy ({rows}) {
		return InitiativeTrackerSort.getSortedRows({
			rows: MiscUtil.copyFast(rows),
			sortBy: this._comp._state.sort,
			sortDir: this._comp._state.dir,
		});
	}

	doEnsureAtLeastOneRowActive ({isSilent = false} = {}) {
		if (this._isAnyRowActive()) return;

		const rows = this._getSortedRowsCopy({rows: (isSilent ? this._comp.__state : this._comp._state)[this._prop]});
		if (!rows?.length) return;

		const [rowActive] = rows;

		this._doHandleRowSetActive({rows, rowActive, direction: InitiativeTrackerConst.DIR_NEUTRAL});

		if (isSilent) this._comp.__state.rows = rows;
		else this._comp._triggerCollectionUpdate(this._prop);
	}

	_isAnyRowActive () {
		return this._comp._state[this._prop].some(it => it.entity.isActive);
	}

	_doHandleRowSetActive ({rows, rowActive, direction, isSkipRoundStart}) {
		const similarRows = this._rowStateBuilder.getSimilarRows({
			rows,
			rowEntity: rowActive.entity,
		});

		if (!similarRows.some(row => row.id === rowActive.id)) throw new Error(`Active row should be "similar" to itself!`); // Should never occur

		const isRoundStart = similarRows
			.map(row => {
				const {entity} = row;

				if (
					this._comp._state.sort === InitiativeTrackerConst.SORT_ORDER_NUM
					&& entity.initiative !== rowActive.entity.initiative
				) return false;

				entity.isActive = true;

				return this._doHandleTurnStart({rows, direction, row, isSkipRoundStart}).isRoundStart;
			})
			.some(Boolean);

		return {isRoundStart};
	}

	_pDoShiftActiveRow_doInitialShift ({direction}) {
		const rows = this._getSortedRowsCopy({rows: this._comp._state[this._prop]});

		if (!this._isAnyRowActive()) return this.doEnsureAtLeastOneRowActive();

		if (direction === InitiativeTrackerConst.DIR_BACKWARDS) rows.reverse();

		const rowsActive = rows.filter(({entity}) => entity.isActive);

		// If advancing, tick down conditions
		if (direction === InitiativeTrackerConst.DIR_FORWARDS) {
			rowsActive
				.forEach(({entity}) => {
					entity.conditions = entity.conditions
						.filter(cond => !(cond.entity.turns != null && (--cond.entity.turns <= 0)));
				});
		}

		rowsActive.forEach(({entity}) => entity.isActive = false);

		const ixLastActive = rows.indexOf(rowsActive.last());
		const ixNextActive = ixLastActive + 1 < rows.length ? ixLastActive + 1 : 0;
		rows[ixNextActive].entity.isActive = true;

		const {isRoundStart} = this._doHandleRowSetActive({rows, rowActive: rows[ixNextActive], direction});

		return {
			isRoundStart,
			rows: InitiativeTrackerSort.getSortedRows({
				rows,
				sortBy: this._comp._state.sort,
				sortDir: this._comp._state.dir,
			}),
		};
	}

	async _pDoShiftActiveRow_pDoRerollAndShift ({direction, rows}) {
		await this._pMutRowsRerollInitiative({rows});

		rows = InitiativeTrackerSort.getSortedRows({
			rows,
			sortBy: this._comp._state.sort,
			sortDir: this._comp._state.dir,
		});

		rows.forEach(({entity}) => entity.isActive = false);
		const rowActive = rows[0];
		rowActive.entity.isActive = true;

		// FIXME(Future) this results in turn-start triggering twice on rows which were at the top of the pre-reroll order
		//   and the post-reroll order (current turn-start callbacks are idempotent, so this is not relevant)
		this._doHandleRowSetActive({rows, rowActive, direction, isSkipRoundStart: true});

		return rows;
	}

	async pDoShiftActiveRow ({direction}) {
		const {isRoundStart, rows} = this._pDoShiftActiveRow_doInitialShift({direction});

		if (direction !== InitiativeTrackerConst.DIR_FORWARDS || !isRoundStart || !this._comp._state.isRerollInitiativeEachRound) return this._comp._state[this._prop] = rows;

		this._comp._state[this._prop] = await this._pDoShiftActiveRow_pDoRerollAndShift({direction, rows});
	}

	/* -------------------------------------------- */

	async _pMutRowsRerollInitiative ({rows}) {
		rows = rows || this._comp._state[this._prop];

		if (!this._comp._state.isRollGroups) {
			return rows
				.pSerialAwaitMap(async row => {
					const {entity} = row;
					const {mon, initiativeModifier} = await this._rowStateBuilder.pGetRowInitiativeMeta({row});
					entity.initiative = await this._roller.pGetRollInitiative({mon, initiativeModifier, name: mon ? null : entity.name});
				});
		}

		await Object.values(
			await rows
				.pSerialAwaitReduce(
					async (accum, row) => {
						const rowEntityHash = InitiativeTrackerRowStateBuilderActive.getSimilarRowEntityHash({rowEntity: row.entity});
						const {initiativeModifier} = await this._rowStateBuilder.pGetRowInitiativeMeta({row});
						// Add the initiative modifier to the key, such that e.g. creatures with non-standard initiative
						//   modifiers are rolled outwith the group
						const k = [rowEntityHash, initiativeModifier].join("__");
						(accum[k] ||= []).push(row);
						return accum;
					},
					{},
				),
		)
			.pSerialAwaitMap(async rows => {
				const [row] = rows;
				const {mon, initiativeModifier} = await this._rowStateBuilder.pGetRowInitiativeMeta({row});
				const initiative = await this._roller.pGetRollInitiative({mon, initiativeModifier, name: mon ? null : row.entity.name});
				rows.forEach(({entity}) => entity.initiative = initiative);
			});
	}
}

export class InitiativeTrackerRowDataViewActive extends InitiativeTrackerRowDataViewBase {
	_TextHeaderLhs = "Creature/Status";
	_ClsRenderableCollectionRowData = _RenderableCollectionRowDataActive;

	_render_$getWrpHeaderRhs ({rdState}) {
		return $$`<div class="dm-init__row-rhs">
			<div class="dm-init__header dm-init__header--input dm-init__header--input-wide" title="Hit Points">HP</div>
			<div class="dm-init__header dm-init__header--input" title="Initiative Score">#</div>
			<div class="dm-init__spc-header-buttons"></div>
		</div>`;
	}

	_render_bindHooksRows ({rdState}) {
		const hkRowsSync = () => {
			// Sort rows
			this._comp.__state.rows = InitiativeTrackerSort.getSortedRows({
				rows: this._comp._state.rows,
				sortBy: this._comp._state.sort,
				sortDir: this._comp._state.dir,
			});

			// Ensure a row is active
			this._compRows.doEnsureAtLeastOneRowActive({isSilent: true});

			// region Show/hide creature ordinals
			const ordinalsToShow = new Set(
				Object.entries(
					this._rowStateBuilder.getSimilarRowCounts({rows: this._comp.__state.rows}),
				)
					.filter(([, v]) => v > 1)
					.map(([name]) => name),
			);
			this._comp.__state.rows
				.forEach(({entity}) => entity.isShowOrdinal = ordinalsToShow.has(InitiativeTrackerRowStateBuilderActive.getSimilarRowEntityHash({rowEntity: entity})));
			// endregion
		};
		this._comp._addHookBase(this._prop, hkRowsSync)();
		rdState.fnsCleanup.push(() => this._comp._removeHookBase(this._prop, hkRowsSync));

		const hkRowsAsync = async () => {
			try {
				await this._compRowsLock.pLock();
				await this._compRows.pRender();

				// region Scroll active rows into view
				const rendereds = this._comp._getRenderedCollection({prop: this._prop});
				const renderedsActive = this._comp._state.rows
					.filter(row => row.entity.isActive)
					.map(row => rendereds[row.id])
					.filter(Boolean);

				if (!renderedsActive.length) return;

				// First scroll the last active row into view to scroll down as far as necessary...
				renderedsActive.last()?.$wrpRow?.[0]?.scrollIntoView({block: "nearest", inline: "nearest"});
				// ...then scroll the first active row into view, as this is the one we prioritize
				renderedsActive[0]?.$wrpRow?.[0]?.scrollIntoView({block: "nearest", inline: "nearest"});
				// endregion
			} finally {
				this._compRowsLock.unlock();
			}
		};
		this._comp._addHookBase(this._prop, hkRowsAsync)();
		rdState.fnsCleanup.push(() => this._comp._removeHookBase(this._prop, hkRowsAsync));
	}

	/* -------------------------------------------- */

	pDoShiftActiveRow (...args) { return this._compRows.pDoShiftActiveRow(...args); }
}

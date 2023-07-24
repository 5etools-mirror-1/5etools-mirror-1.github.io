import {
	InitiativeTrackerStatColumnFactory,
} from "./dmscreen-initiativetracker-statcolumns.js";
import {InitiativeTrackerUtil} from "../../initiativetracker/initiativetracker-utils.js";

class _RenderableCollectionRowStatColData extends RenderableCollectionGenericRows {
	constructor (
		{
			rootComp,
			comp,
			$wrpRows,
			networking,
			mon,
		},
	) {
		super(comp, "rowStatColData", $wrpRows);
		this._rootComp = rootComp;
		this._networking = networking;
		this._mon = mon;
	}

	_$getWrpRow () {
		return $(`<div class="ve-flex-vh-center"></div>`);
	}

	_populateRow ({comp, $wrpRow, entity}) {
		const statsColData = this._rootComp._state.statsCols.find(statsCol => statsCol.id === entity.id);
		if (!statsColData) return {};

		const meta = InitiativeTrackerStatColumnFactory.fromStateData({data: statsColData});
		meta.$getRendered({comp, mon: this._mon, networking: this._networking}).appendTo($wrpRow);

		return {
			cbOnTurnStart: ({state, direction}) => {
				meta.onTurnStart({state, direction, mon: this._mon});
			},
			cbOnRoundStart: ({state, direction}) => {
				meta.onRoundStart({state, direction, mon: this._mon});
			},
		};
	}
}

/** @abstract */
export class RenderableCollectionRowDataBase extends RenderableCollectionAsyncGenericRows {
	constructor (
		{
			comp,
			prop,
			$wrpRows,
			roller,
			networking = null,
			rowStateBuilder,
		},
	) {
		super(comp, prop, $wrpRows);
		this._roller = roller;
		this._networking = networking;
		this._rowStateBuilder = rowStateBuilder;
	}

	/* -------------------------------------------- */

	_$getWrpRow () {
		return $(`<div class="dm-init__row overflow-hidden pr-1"></div>`);
	}

	async _pPopulateRow ({comp, $wrpRow, entity}) {
		const fnsCleanup = [];

		const {isMon, mon, fluff} = await this._pPopulateRow_pGetMonsterMeta({comp});

		comp._addHookBase("isActive", () => $wrpRow.toggleClass("dm-init__row-active", !!comp._state.isActive))();

		this._pPopulateRow_bindParentRowStatColsIsEditableHook({comp, entity, mon, fluff, fnsCleanup});

		const $wrpLhs = $(`<div class="dm-init__row-lhs"></div>`).appendTo($wrpRow);

		this._pPopulateRow_player({comp, $wrpLhs, isMon});
		this._pPopulateRow_monster({comp, $wrpLhs, isMon, mon, fluff});

		this._pPopulateRow_conditions({comp, $wrpLhs});

		this._pPopulateRow_statsCols({comp, $wrpRow, mon, fnsCleanup});

		const $wrpRhs = $(`<div class="dm-init__row-rhs"></div>`).appendTo($wrpRow);

		this._pPopulateRow_hp({comp, $wrpRhs});
		this._pPopulateRow_initiative({comp, $wrpRhs});
		this._pPopulateRow_btns({comp, entity, $wrpRhs});

		return {
			cbOnTurnStart: ({state, direction}) => {
				Object.values(comp._getRenderedCollection({prop: "rowStatColData"}))
					.forEach(rendered => {
						if (!rendered.cbOnTurnStart) return;

						const stateSub = state.entity.rowStatColData
							.find(cell => cell.id === rendered.id);
						rendered.cbOnTurnStart({state: stateSub, direction});
					});
			},
			cbOnRoundStart: ({state, direction}) => {
				Object.values(comp._getRenderedCollection({prop: "rowStatColData"}))
					.forEach(rendered => {
						if (!rendered.cbOnRoundStart) return;

						const stateSub = state.entity.rowStatColData
							.find(cell => cell.id === rendered.id);
						rendered.cbOnRoundStart({state: stateSub, direction});
					});
			},
			fnsCleanup,
		};
	}

	/* ----- */

	/**
	 * @abstract
	 * @return {object}
	 */
	async _pPopulateRow_pGetMonsterMeta ({comp}) {
		throw new Error("Unimplemented!");
	}

	/* ----- */

	_pPopulateRow_bindParentRowStatColsIsEditableHook ({comp, entity, mon, fluff, fnsCleanup}) {
		const hkParentStatCols = () => {
			const isRowExists = this._comp._state[this._prop]
				.some(row => row.id === entity.id);
			if (!isRowExists) return; // Avoid race condition (row removed, but async render has not yet cleaned it up)

			const rowStatColDataNxt = [];

			this._comp._state.statsCols
				.forEach(data => {
					const existing = comp._state.rowStatColData.find(cell => cell.id === data.id);
					if (existing) {
						// Copy the parent isEditable flag to the child
						existing.entity.isEditable = data.isEditable;
						return rowStatColDataNxt.push(existing);
					}

					const meta = InitiativeTrackerStatColumnFactory.fromStateData({data});
					const initialState = meta.getInitialCellStateData({mon, fluff});
					rowStatColDataNxt.push(initialState);
				});

			comp._state.rowStatColData = rowStatColDataNxt;
		};
		this._comp._addHookBase("statsCols", hkParentStatCols)();
		fnsCleanup.push(() => this._comp._removeHookBase("statsCols", hkParentStatCols));
	}

	/* ----- */

	_pPopulateRow_player ({comp, $wrpLhs, isMon}) {
		if (isMon) return;

		ComponentUiUtil.$getIptStr(
			comp,
			"name",
			{
				html: `<input class="form-control input-sm name dm-init__ipt-name dm-init-lockable dm-init__row-input" placeholder="Name">`,
			},
		).appendTo($wrpLhs);
	}

	/* ----- */

	/**
	 * @abstract
	 * @return void
	 */
	_pPopulateRow_monster ({comp, $wrpLhs, isMon, mon, fluff}) {
		throw new Error("Unimplemented!");
	}

	/* ----- */

	/**
	 * @abstract
	 * @return void
	 */
	_pPopulateRow_conditions ({comp, $wrpLhs}) {
		throw new Error("Unimplemented!");
	}

	/* ----- */

	_pPopulateRow_statsCols ({comp, $wrpRow, mon, fnsCleanup}) {
		const $wrp = $(`<div class="dm-init__row-mid"></div>`)
			.appendTo($wrpRow);

		const hkParentStatsAddCols = () => $wrp.toggleVe(!!this._comp._state.statsAddColumns);
		this._comp._addHookBase("statsAddColumns", hkParentStatsAddCols)();
		fnsCleanup.push(() => this._comp._removeHookBase("statsAddColumns", hkParentStatsAddCols));

		const renderableCollection = new _RenderableCollectionRowStatColData({
			rootComp: this._comp,
			comp,
			$wrpRows: $wrp,
			networking: this._networking,
			mon,
		});
		comp._addHookBase("rowStatColData", () => renderableCollection.render())();
	}

	/* ----- */

	_pPopulateRow_hp ({comp, $wrpRhs}) {
		const $iptHpCurrent = ComponentUiUtil.$getIptNumber(
			comp,
			"hpCurrent",
			null,
			{
				isAllowNull: true,
				fallbackOnNaN: null,
				html: `<input class="form-control input-sm hp dm-init__row-input text-right w-40p mr-0 br-0">`,
			},
		)
			.on("click", () => $iptHpCurrent.select());

		const $iptHpMax = ComponentUiUtil.$getIptNumber(
			comp,
			"hpMax",
			null,
			{
				isAllowNull: true,
				fallbackOnNaN: null,
				html: `<input class="form-control input-sm hp-max dm-init__row-input w-40p mr-0 bl-0">`,
			},
		)
			.on("click", () => $iptHpMax.select());

		const hkHpColors = () => {
			const woundLevel = InitiativeTrackerUtil.getWoundLevel(100 * comp._state.hpCurrent / comp._state.hpMax);
			if (~woundLevel) {
				const woundMeta = InitiativeTrackerUtil.getWoundMeta(woundLevel);
				$iptHpCurrent.css("color", woundMeta.color);
				$iptHpMax.css("color", woundMeta.color);
			} else {
				$iptHpCurrent.css("color", "");
				$iptHpMax.css("color", "");
			}
		};
		comp._addHookBase("hpCurrent", hkHpColors);
		comp._addHookBase("hpMax", hkHpColors);
		hkHpColors();

		$$`<div class="ve-flex relative mr-3p">
			<div class="text-right">${$iptHpCurrent}</div>
			<div class="dm-init__sep-fields-slash ve-flex-vh-center">/</div>
			<div class="text-left">${$iptHpMax}</div>
		</div>`
			.appendTo($wrpRhs);
	}

	/* ----- */

	/**
	 * @abstract
	 * @return void
	 */
	_pPopulateRow_initiative ({comp, $wrpRhs}) {
		throw new Error("Unimplemented!");
	}

	/* ----- */

	/**
	 * @abstract
	 * @return void
	 */
	_pPopulateRow_btns ({comp, entity, $wrpRhs}) {
		throw new Error("Unimplemented!");
	}

	/* -------------------------------------------- */

	pDoDeleteExistingRender (rendered) {
		rendered.fnsCleanup.forEach(fn => fn());
	}
}

/** @abstract */
export class InitiativeTrackerRowDataViewBase {
	static _RenderState = class {
		constructor () {
			this.fnsCleanup = [];
		}
	};

	_TextHeaderLhs;
	_ClsRenderableCollectionRowData;

	constructor ({comp, prop, roller, networking, rowStateBuilder}) {
		this._comp = comp;
		this._prop = prop;
		this._roller = roller;
		this._networking = networking;
		this._rowStateBuilder = rowStateBuilder;

		this._compRowsLock = new VeLock({name: "Row render"});
		this._compRows = null;
	}

	/* -------------------------------------------- */

	getRenderedView () {
		const rdState = new this.constructor._RenderState();

		const $ele = $$`<div class="dm-init__wrp-header-outer">
				<div class="dm-init__wrp-header pr-1">
					<div class="dm-init__row-lhs dm-init__header">
						<div class="w-100">${this._TextHeaderLhs}</div>
					</div>

					${this._render_$getWrpHeaderStatsCols({rdState})}

					${this._render_$getWrpHeaderRhs({rdState})}
				</div>

				${this._render_$getWrpRows({rdState})}
		</div>`;

		return {
			$ele,
			cbDoCleanup: () => rdState.fnsCleanup.forEach(fn => fn()),
		};
	}

	_render_$getWrpHeaderStatsCols ({rdState}) {
		const $wrpHeaderStatsCols = $(`<div class="dm-init__row-mid"></div>`);
		const hkHeaderStatsCols = () => {
			$wrpHeaderStatsCols.empty();

			if (!this._comp._state.statsAddColumns) return;

			this._comp._state.statsCols.forEach(data => {
				const meta = InitiativeTrackerStatColumnFactory.fromStateData({data});
				$wrpHeaderStatsCols.append(meta.$getRenderedHeader());
			});
		};
		this._comp._addHookBase("statsAddColumns", hkHeaderStatsCols);
		this._comp._addHookBase("statsCols", hkHeaderStatsCols);
		hkHeaderStatsCols();
		rdState.fnsCleanup.push(
			() => this._comp._removeHookBase("statsAddColumns", hkHeaderStatsCols),
			() => this._comp._removeHookBase("statsCols", hkHeaderStatsCols),
		);

		return $wrpHeaderStatsCols;
	}

	/**
	 * @abstract
	 * @return {jQuery}
	 */
	_render_$getWrpHeaderRhs ({rdState}) {
		throw new Error("Unimplemented!");
	}

	_render_$getWrpRows ({rdState}) {
		const $wrpRows = $(`<div class="dm-init__wrp-entries"></div>`);

		this._compRows = new this._ClsRenderableCollectionRowData({
			comp: this._comp,
			$wrpRows,
			roller: this._roller,
			networking: this._networking,
			rowStateBuilder: this._rowStateBuilder,
		});

		this._render_bindHooksRows({rdState});

		return $wrpRows;
	}

	/**
	 * @abstract
	 * @return void
	 */
	_render_bindHooksRows ({rdState}) {
		throw new Error("Unimplemented!");
	}
}

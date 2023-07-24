import {InitiativeTrackerUtil, UtilConditions} from "../../initiativetracker/initiativetracker-utils.js";
import {InitiativeTrackerConditionCustomEdit} from "./dmscreen-initiativetracker-conditioncustom.js";
import {InitiativeTrackerConditionUtil} from "./dmscreen-initiativetracker-condition.js";

class _UtilConditionsCustomView {
	static $getBtnCondition ({comp, cbSubmit, cbClick}) {
		const $btn = $(`<button class="btn btn-default btn-xs dm-init-cond__btn-cond" title="SHIFT to add with &quot;Unlimited&quot; duration; CTRL to add with 1-turn duration; SHIFT+CTRL to add with 10-turn duration."></button>`)
			.on("click", evt => {
				cbClick({
					name: comp._state.name,
					color: comp._state.color,
					turns: comp._state.turns,
				});

				if (evt.shiftKey && EventUtil.isCtrlMetaKey(evt)) return cbSubmit({turns: 10});

				if (EventUtil.isCtrlMetaKey(evt)) return cbSubmit({turns: 1});

				if (evt.shiftKey) return cbSubmit({turns: null});
			});

		comp._addHookBase("color", () => $btn.css({"background-color": `${comp._state.color}`}))();
		comp._addHookBase("name", () => $btn.text(comp._state.name || "\u00A0"))();

		return $btn;
	}
}

class _RenderableCollectionConditionsCustomView extends RenderableCollectionGenericRows {
	constructor (
		{
			comp,
			$wrpRows,
			rdState,
			cbDoSubmit,
		},
	) {
		super(comp, "conditionsCustom", $wrpRows);
		this._rdState = rdState;
		this._cbDoSubmit = cbDoSubmit;
	}

	_$getWrpRow () {
		return $(`<div class="ve-flex-vh-center w-33 my-1"></div>`);
	}

	/* -------------------------------------------- */

	_populateRow ({comp, $wrpRow, entity}) {
		_UtilConditionsCustomView.$getBtnCondition({
			comp,
			cbClick: ({name, color, turns}) => {
				this._comp._state.name = name;
				this._comp._state.color = color;
				this._comp._state.turns = turns;
			},
			cbSubmit: ({turns}) => {
				this._comp._state.turns = turns;
				this._cbDoSubmit({rdState: this._rdState});
			},
		}).appendTo($wrpRow);
	}
}

export class InitiativeTrackerConditionAdd extends BaseComponent {
	static _RenderState = class {
		constructor () {
			this.cbDoClose = null;
		}
	};

	constructor ({conditionsCustom}) {
		super();
		this.__state.conditionsCustom = conditionsCustom;
	}

	getConditionsCustom () {
		return MiscUtil.copyFast(this._state.conditionsCustom);
	}

	async pGetShowModalResults () {
		const rdState = new this.constructor._RenderState();

		const {$modalInner, doClose, pGetResolved} = UiUtil.getShowModal({
			isMinHeight0: true,
			isHeaderBorder: true,
			title: "Add Condition",
			$titleSplit: this._render_$getBtnEditCustom({rdState}),
		});
		rdState.cbDoClose = doClose;

		$$($modalInner)`
			${this._render_$getStgConditionsStandard({rdState})}

			<hr class="hr-3">

			${this._render_$getStgConditionsCustom({rdState})}

			${this._render_$getStgIpts({rdState})}
			${this._render_$getStgSubmit({rdState})}
		`;

		return pGetResolved();
	}

	_render_$getBtnEditCustom ({rdState}) {
		return $(`<button class="btn btn-default btn-xs" title="Manage Custom Conditions"><span class="glyphicon glyphicon-cog"></span></button>`)
			.on("click", async () => {
				const compEdit = new InitiativeTrackerConditionCustomEdit({conditionsCustom: MiscUtil.copyFast(this._state.conditionsCustom)});
				await compEdit.pGetShowModalResults();
				this._state.conditionsCustom = compEdit.getConditionsCustom();
			});
	}

	_render_$getStgConditionsStandard ({rdState}) {
		const $wrps = InitiativeTrackerUtil.CONDITIONS
			.map(cond => {
				const $btn = _UtilConditionsCustomView.$getBtnCondition({
					comp: BaseComponent.fromObject({
						name: cond.name,
						color: cond.color,
						turns: cond.turns,
					}, "*"),
					cbClick: ({name, color, turns}) => {
						this._state.name = name;
						this._state.color = color;
					},
					cbSubmit: ({turns}) => {
						this._state.turns = turns;
						this._doSubmit({rdState});
					},
				});

				return $$`<div class="ve-flex-vh-center w-33 my-1">${$btn}</div>`;
			});

		return $$`
			<div class="ve-flex-col w-100 h-100 min-h-0 ve-flex-v-center">
				<div class="ve-flex-wrap w-100 h-100 min-h-0 dm-init-cond__wrp-btns">
					${$wrps}
				</div>
			</div>
		`;
	}

	_render_$getStgConditionsCustom ({rdState}) {
		const $wrpRows = $(`<div class="ve-flex-wrap w-100 min-h-0 dm-init-cond__wrp-btns"></div>`);

		const compRows = new _RenderableCollectionConditionsCustomView({
			comp: this,
			$wrpRows,
			rdState,
			cbDoSubmit: this._doSubmit.bind(this),
		});
		this._addHookBase("conditionsCustom", () => compRows.render())();

		const $stg = $$`<div class="ve-flex-col w-100 h-100 min-h-0 ve-flex-v-center">
			${$wrpRows}
			<hr class="hr-3">
		</div>`;

		this._addHookBase("conditionsCustom", () => $stg.toggleVe(!!this._state.conditionsCustom.length))();

		return $stg;
	}

	_render_$getStgIpts ({rdState}) {
		const $iptName = ComponentUiUtil.$getIptStr(this, "name", {html: `<input class="form-control">`})
			.on("keydown", evt => {
				if (evt.key !== "Enter") return;
				$iptName.trigger("change");
				this._doSubmit({rdState});
			});

		const $iptColor = ComponentUiUtil.$getIptColor(this, "color", {html: `<input class="form-control" type="color">`});

		const $iptTurns = ComponentUiUtil.$getIptInt(this, "turns", null, {isAllowNull: true, fallbackOnNaN: null, html: `<input class="form-control" placeholder="Unlimited">`})
			.on("keydown", evt => {
				if (evt.key !== "Enter") return;
				$iptTurns.trigger("change");
				this._doSubmit({rdState});
			});

		const $btnSave = $(`<button class="btn btn-default w-100" title="Save as New Custom Condition"><span class="glyphicon glyphicon-floppy-disk"></span></button>`)
			.click(() => {
				this._state.conditionsCustom = [
					...this._state.conditionsCustom,
					InitiativeTrackerConditionUtil.getNewRowState({
						name: this._state.name,
						color: this._state.color,
						turns: this._state.turns,
					}),
				];
			});

		return $$`
			<div class="ve-flex-v-center mb-2">
				<div class="small-caps col-5 pr-1">Name</div>
				<div class="small-caps col-2 px-1">Color</div>
				<div class="small-caps col-4 px-1">Duration</div>
				<div class="col-1 pl-1">&nbsp;</div>
			</div>
			<div class="ve-flex-v-center mb-3">
				<div class="col-5 pr-1">${$iptName}</div>
				<div class="col-2 px-1">${$iptColor}</div>
				<div class="col-4 px-1">${$iptTurns}</div>
				<div class="col-1 pl-1">${$btnSave}</div>
			</div>
		`;
	}

	_render_$getStgSubmit ({rdState}) {
		const $btnAdd = $(`<button class="btn btn-primary w-100">Set Condition</button>`)
			.click(() => this._doSubmit({rdState}));
		return $$`
			<div class="ve-flex-v-center">
				${$btnAdd}
			</div>
		`;
	}

	_doSubmit ({rdState}) {
		rdState.cbDoClose(
			true,
			UtilConditions.getDefaultState({
				name: this._state.name,
				color: this._state.color,
				turns: this._state.turns,
			}),
		);
	}

	_getDefaultState () {
		return {
			name: "",
			color: MiscUtil.randomColor(),
			turns: null,
			conditionsCustom: [],
		};
	}
}

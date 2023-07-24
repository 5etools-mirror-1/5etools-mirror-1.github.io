import {InitiativeTrackerConditionUtil} from "./dmscreen-initiativetracker-condition.js";

class _RenderableCollectionConditionsCustomEdit extends RenderableCollectionGenericRows {
	constructor (
		{
			comp,
			$wrpRows,
		},
	) {
		super(comp, "conditionsCustom", $wrpRows);
	}

	/* -------------------------------------------- */

	_populateRow ({comp, $wrpRow, entity}) {
		const $iptName = ComponentUiUtil.$getIptStr(comp, "name");

		const $iptColor = ComponentUiUtil.$getIptColor(comp, "color")
			.addClass("w-100");

		const $iptTurns = ComponentUiUtil.$getIptInt(comp, "turns", null, {isAllowNull: true, fallbackOnNaN: null})
			.addClass("mr-2")
			.placeholder("Unlimited");

		const $btnDelete = this._utils.$getBtnDelete({entity});

		$$($wrpRow)`
			<div class="ve-flex-vh-center w-100 my-1">
				<div class="col-5 pr-1 ve-flex-v-center">${$iptName}</div>
				<div class="col-2 px-1 ve-flex-v-center">${$iptColor}</div>
				<div class="col-5 pr-1 ve-flex-v-center">
					${$iptTurns}
					<div class="ve-flex-vh-center btn-group">
						${$btnDelete}
					</div>
				</div>
			</div>
		`;
	}
}

export class InitiativeTrackerConditionCustomEdit extends BaseComponent {
	static _RenderState = class {
		constructor () {
			this.cbDoClose = null;
		}
	};

	constructor ({conditionsCustom}) {
		super();
		this._state.conditionsCustom = conditionsCustom;
	}

	getConditionsCustom () {
		return MiscUtil.copyFast(this._state.conditionsCustom);
	}

	async pGetShowModalResults () {
		const rdState = new this.constructor._RenderState();

		const {$modalInner, $modalFooter, doClose, pGetResolved} = UiUtil.getShowModal({
			title: "Manage Custom Conditions",
			isHeaderBorder: true,
			hasFooter: true,
		});
		rdState.cbDoClose = doClose;

		const $btnAdd = $(`<button class="btn btn-default btn-xs bb-0 bbr-0 bbl-0" title="Add"><span class="glyphicon glyphicon-plus"></span></button>`)
			.on("click", () => {
				this._state.conditionsCustom = [...this._state.conditionsCustom, InitiativeTrackerConditionUtil.getNewRowState()];
			});

		const $wrpRows = $(`<div class="ve-flex-col h-100 min-h-0 overflow-y-auto"></div>`);

		const compRows = new _RenderableCollectionConditionsCustomEdit({comp: this, $wrpRows});
		this._addHookBase("conditionsCustom", () => compRows.render())();

		$$($modalInner)`
			<div class="ve-flex-col mt-2 h-100 min-h-0">
				<div class="ve-flex-vh-center w-100 mb-2 bb-1p-trans">
					<div class="col-5">Name</div>
					<div class="col-2">Color</div>
					<div class="col-4">Turns</div>
					<div class="col-1 ve-flex-v-center ve-flex-h-right">${$btnAdd}</div>
				</div>

				${$wrpRows}
			</div>
		`;

		$$($modalFooter)`
			${this._render_$getFooter({rdState})}
		`;

		return pGetResolved();
	}

	_render_$getFooter ({rdState}) {
		const $btnSave = $(`<button class="btn btn-primary btn-sm w-100">Save</button>`)
			.click(() => rdState.cbDoClose(true));

		return $$`<div class="w-100 py-3 no-shrink">
			${$btnSave}
		</div>`;
	}

	_getDefaultState () {
		return {
			conditionsCustom: [],
		};
	}
}

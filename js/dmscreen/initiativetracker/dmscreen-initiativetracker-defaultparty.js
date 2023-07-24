import {
	InitiativeTrackerRowDataViewDefaultParty,
} from "./dmscreen-initiativetracker-rowsdefaultparty.js";

export class InitiativeTrackerDefaultParty extends BaseComponent {
	static _RenderState = class {
		constructor () {
			this.cbDoClose = null;
			this.fnsCleanup = [];
		}
	};

	constructor ({comp, roller, rowStateBuilder}) {
		super();
		this._comp = comp;
		this._roller = roller;
		this._rowStateBuilder = rowStateBuilder;
		this._prop = "rowsDefaultParty";

		this._viewRowsDefaultParty = null;
	}

	/* -------------------------------------------- */

	pGetShowModalResults () {
		const rdState = new this.constructor._RenderState();

		const {$modalInner, $modalFooter, pGetResolved, doClose} = UiUtil.getShowModal({
			title: "Edit Default Party",
			isHeaderBorder: true,
			isUncappedHeight: true,
			hasFooter: true,
			cbClose: () => rdState.fnsCleanup.forEach(fn => fn()),
			$titleSplit: this._render_$getBtnAdd({rdState}),
		});
		rdState.cbDoClose = doClose;

		this._render_renderBody({rdState, $modalInner});
		this._render_renderFooter({rdState, $modalFooter});

		return pGetResolved();
	}

	_render_$getBtnAdd ({rdState}) {
		return $(`<button class="btn btn-default btn-xs" title="Add Player"><span class="glyphicon glyphicon-plus"></span></button>`)
			.on("click", async () => {
				this._comp._state[this._prop] = [
					...this._comp._state[this._prop],
					await this._rowStateBuilder.pGetNewRowState(),
				];
			});
	}

	/* -------------------------------------------- */

	_render_renderBody ({rdState, $modalInner}) {
		this._viewRowsDefaultParty = new InitiativeTrackerRowDataViewDefaultParty({
			comp: this._comp,
			prop: this._prop,
			roller: this._roller,
			rowStateBuilder: this._rowStateBuilder,
		});
		this._viewRowsDefaultPartyMeta = this._viewRowsDefaultParty.getRenderedView();
		this._viewRowsDefaultPartyMeta.$ele.appendTo($modalInner);
		rdState.fnsCleanup.push(this._viewRowsDefaultPartyMeta.cbDoCleanup);
	}

	/* -------------------------------------------- */

	_render_renderFooter ({rdState, $modalFooter}) {
		const $btnSave = $(`<button class="btn btn-primary btn-sm w-100">Save</button>`)
			.click(() => rdState.cbDoClose(true));

		$$($modalFooter)`<div class="w-100 py-3 no-shrink">
			${$btnSave}
		</div>`;
	}

	/* -------------------------------------------- */

	async pGetConvertedDefaultPartyActiveRows () {
		const rows = MiscUtil.copyFast(this._comp._state.rowsDefaultParty);

		if (!this._comp._state.isRollInit) return rows;

		await rows.pSerialAwaitMap(async row => {
			const {entity} = row;
			const {initiativeModifier} = await this._rowStateBuilder.pGetRowInitiativeMeta({row});

			// Skip rolling no-modifier-exists initiative for player rows, as we assume the user wants to input them
			//   manually.
			if (initiativeModifier == null) return;

			entity.initiative = await this._roller.pGetRollInitiative({initiativeModifier, name: entity.name});
		});

		return rows;
	}
}

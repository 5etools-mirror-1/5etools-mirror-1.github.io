export class InitiativeTrackerSettingsImport extends BaseComponent {
	static _PROPS_TRACKED = [
		"isRollInit",
		"isRollHp",
		"importIsRollGroups",
		"importIsAddPlayers",
		"importIsAppend",
	];

	constructor ({state}) {
		super();

		this._proxyAssignSimple(
			"state",
			InitiativeTrackerSettingsImport._PROPS_TRACKED
				.mergeMap(prop => ({[prop]: state[prop]})),
		);
	}

	/* -------------------------------------------- */

	getStateUpdate () {
		return MiscUtil.copyFast(this._state);
	}

	/* -------------------------------------------- */

	pGetShowModalResults () {
		const {$modalInner, $modalFooter, pGetResolved, doClose} = UiUtil.getShowModal({
			title: "Import Settings",
			isUncappedHeight: true,
			hasFooter: true,
		});

		UiUtil.addModalSep($modalInner);
		this._pGetShowModalResults_renderSection_isRolls({$modalInner});
		UiUtil.addModalSep($modalInner);
		this._pGetShowModalResults_renderSection_import({$modalInner});

		this._pGetShowModalResults_renderFooter({$modalFooter, doClose});

		return pGetResolved();
	}

	/* -------------------------------------------- */

	_pGetShowModalResults_renderSection_isRolls ({$modalInner}) {
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "isRollInit", text: "Roll creature initiative"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "isRollHp", text: "Roll creature hit points"});
	}

	_pGetShowModalResults_renderSection_import ({$modalInner}) {
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "importIsRollGroups", text: "Roll groups of creatures together"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "importIsAddPlayers", text: "Add players"});
		UiUtil.$getAddModalRowCb2({$wrp: $modalInner, comp: this, prop: "importIsAppend", text: "Add to existing tracker state"});
	}

	/* -------------------------------------------- */

	_pGetShowModalResults_renderFooter ({$modalFooter, doClose}) {
		const $btnSave = $(`<button class="btn btn-primary btn-sm w-100">Save</button>`)
			.click(() => doClose(true));

		$$($modalFooter)`<div class="w-100 py-3 no-shrink">
			${$btnSave}
		</div>`;
	}
}

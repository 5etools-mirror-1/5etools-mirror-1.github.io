import {
	InitiativeTrackerRowDataViewBase,
	RenderableCollectionRowDataBase,
} from "./dmscreen-initiativetracker-rowsbase.js";

class _RenderableCollectionRowDataDefaultParty extends RenderableCollectionRowDataBase {
	constructor (
		{
			comp,
			$wrpRows,
			roller,
			rowStateBuilder,
		},
	) {
		super({comp, prop: "rowsDefaultParty", $wrpRows, roller, networking: null, rowStateBuilder});
	}

	async _pPopulateRow_pGetMonsterMeta ({comp}) {
		return {
			isMon: false,
			mon: null,
			fluff: null,
		};
	}

	/* ----- */

	_pPopulateRow_monster ({comp, $wrpLhs, isMon, mon, fluff}) {
		/* No-op */
	}

	/* ----- */

	_pPopulateRow_conditions ({comp, $wrpLhs}) {
		/* No-op */
	}

	/* ----- */

	_pPopulateRow_initiative ({comp, $wrpRhs}) {
		/* No-op */
	}

	/* ----- */

	_pPopulateRow_btns ({comp, entity, $wrpRhs}) {
		$(`<button class="btn btn-danger btn-xs dm-init__row-btn dm-init-lockable" tabindex="-1"><span class="glyphicon glyphicon-trash"></span></button>`)
			.appendTo($wrpRhs)
			.on("click", () => {
				if (this._comp._state.isLocked) return;
				this._utils.doDelete({entity});
			});
	}
}

export class InitiativeTrackerRowDataViewDefaultParty extends InitiativeTrackerRowDataViewBase {
	_TextHeaderLhs = "Player";
	_ClsRenderableCollectionRowData = _RenderableCollectionRowDataDefaultParty;

	_render_$getWrpHeaderRhs ({rdState}) {
		return $$`<div class="dm-init__row-rhs">
			<div class="dm-init__header dm-init__header--input dm-init__header--input-wide" title="Hit Points">HP</div>
			<div class="dm-init__spc-header-buttons--single"></div>
		</div>`;
	}

	_render_bindHooksRows ({rdState}) {
		const hkRowsAsync = async () => {
			try {
				await this._compRowsLock.pLock();
				await this._compRows.pRender();
			} finally {
				this._compRowsLock.unlock();
			}
		};
		this._comp._addHookBase(this._prop, hkRowsAsync)();
		rdState.fnsCleanup.push(
			() => this._comp._removeHookBase(this._prop, hkRowsAsync),
			() => this._comp._detachCollection(this._prop),
		);
	}
}

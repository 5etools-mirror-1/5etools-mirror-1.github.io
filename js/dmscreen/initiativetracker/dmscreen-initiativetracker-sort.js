import {InitiativeTrackerConst} from "./dmscreen-initiativetracker-consts.js";

export class InitiativeTrackerSort {
	static _getSortMultiplier ({sortDir}) {
		return sortDir === InitiativeTrackerConst.SORT_DIR_DESC ? -1 : 1;
	}

	static _sortRowsNameBasic ({sortDir}, rowA, rowB) {
		return this._getSortMultiplier({sortDir}) * SortUtil.ascSortLower(
			rowA.entity.customName || rowA.entity.name || "",
			rowB.entity.customName || rowB.entity.name || "",
		);
	}

	static _sortRowsInitiativeBasic ({sortDir}, rowA, rowB) {
		return this._getSortMultiplier({sortDir}) * SortUtil.ascSort(
			rowA.entity.initiative || 0,
			rowB.entity.initiative || 0,
		);
	}

	static _sortRowsOrdinal (rowA, rowB) {
		// (Ordinals are always sorted ascending)
		return SortUtil.ascSort(rowA.entity.ordinal || 0, rowB.entity.ordinal || 0);
	}

	static _sortRowsId (rowA, rowB) {
		// (IDs are always sorted ascending)
		return SortUtil.ascSort(rowA.id, rowB.id);
	}

	static _sortRowsName ({sortDir}, rowA, rowB) {
		return this._sortRowsNameBasic({sortDir}, rowA, rowB)
			|| this._sortRowsOrdinal(rowA, rowB)
			|| this._sortRowsInitiativeBasic({sortDir}, rowA, rowB)
			|| this._sortRowsId(rowA, rowB); // Fallback on ID to guarantee stable sort
	}

	static _sortRowsInitiative ({sortDir}, rowA, rowB) {
		return this._sortRowsInitiativeBasic({sortDir}, rowA, rowB)
			|| this._sortRowsNameBasic({sortDir}, rowA, rowB)
			|| this._sortRowsOrdinal(rowA, rowB)
			|| this._sortRowsId(rowA, rowB); // Fallback on ID to guarantee stable sort
	}

	static getSortedRows ({rows, sortBy, sortDir}) {
		const fnSort = sortBy === InitiativeTrackerConst.SORT_ORDER_ALPHA
			? this._sortRowsName.bind(this, {sortDir})
			: this._sortRowsInitiative.bind(this, {sortDir});

		return [...rows].sort(fnSort);
	}

	/* -------------------------------------------- */

	static sortInitiativeInfos (a, b) {
		return SortUtil.ascSort(b.applicability, a.applicability)
			|| SortUtil.ascSort(b.initiative, a.initiative)
			|| SortUtil.ascSort(a.id, b.id); // Fallback on ID to guarantee stable sort
	}
}

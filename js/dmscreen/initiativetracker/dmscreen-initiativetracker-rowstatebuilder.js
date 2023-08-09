import {
	INITIATIVE_APPLICABILITY_NOT_APPLICABLE,
	InitiativeTrackerStatColumnFactory,
} from "./dmscreen-initiativetracker-statcolumns.js";
import {DmScreenUtil} from "../dmscreen-util.js";
import {InitiativeTrackerSort} from "./dmscreen-initiativetracker-sort.js";

/** @abstract */
class _InitiativeTrackerRowStateBuilderBase {
	constructor ({comp, roller}) {
		this._comp = comp;
		this._roller = roller;
	}

	/* -------------------------------------------- */

	/**
	 * @param {?array} rows Existing/partial rows, for calculating ordinal.
	 * @param {?boolean} isActive
	 * @param {?boolean} isPlayerVisible
	 * @param {?string} name
	 * @param {?string} displayName
	 * @param {?number} scaledCr
	 * @param {?number} scaledSummonSpellLevel
	 * @param {?number} scaledSummonClassLevel
	 * @param {?string} customName
	 * @param {?string} source
	 * @param {?number} hpCurrent
	 * @param {?number} hpMax
	 * @param {?number} initiative
	 * @param {?number} ordinal
	 * @param {?array} rowStatColData
	 * @param {?array} conditions
	 */
	async pGetNewRowState (
		{
			rows = null,

			isActive = null,
			isPlayerVisible = null,
			name = null,
			displayName = null,
			scaledCr = null,
			scaledSummonSpellLevel = null,
			scaledSummonClassLevel = null,
			customName = null,
			source = null,
			hpCurrent = null,
			hpMax = null,
			initiative = null,
			ordinal = null,
			rowStatColData = null,
			conditions = null,
		} = {},
	) {
		if (rowStatColData == null) rowStatColData = this._getInitialRowStatColData();

		return {
			id: CryptUtil.uid(),
			entity: {
				isActive: !!isActive,
				isPlayerVisible: !!isPlayerVisible,
				name,
				displayName,
				scaledCr,
				scaledSummonSpellLevel,
				scaledSummonClassLevel,
				customName,
				source,
				hpCurrent,
				hpMax,
				initiative,
				ordinal,
				rowStatColData: rowStatColData ?? [],
				conditions: conditions ?? [],
			},
		};
	}

	/**
	 * @param {?object} mon
	 * @param {?object} fluff
	 */
	_getInitialRowStatColData ({mon = null, fluff = null} = {}) {
		return this._comp._state.statsCols
			.map(data => {
				return InitiativeTrackerStatColumnFactory.fromStateData({data})
					.getInitialCellStateData({mon, fluff});
			});
	}

	/* -------------------------------------------- */

	async pGetRowInitiativeMeta ({row}) {
		const out = {mon: null, initiativeModifier: null};

		const {entity} = row;

		const initiativeInfos = this._comp._state.statsCols
			.map(data => {
				const cell = entity.rowStatColData.find(cell => cell.id === data.id);
				if (!cell) return null;
				return {
					id: cell.id,
					...InitiativeTrackerStatColumnFactory.fromStateData({data})
						.getInitiativeInfo({state: cell}),
				};
			})
			.filter(Boolean)
			.filter(info => info.applicability !== INITIATIVE_APPLICABILITY_NOT_APPLICABLE)
			.sort(InitiativeTrackerSort.sortInitiativeInfos.bind(InitiativeTrackerSort));

		const maxApplicability = Math.max(INITIATIVE_APPLICABILITY_NOT_APPLICABLE, ...initiativeInfos.map(info => info.applicability));
		if (maxApplicability !== INITIATIVE_APPLICABILITY_NOT_APPLICABLE) {
			const initiativeInfosApplicable = initiativeInfos.filter(info => info.applicability === maxApplicability);
			out.initiativeModifier = Math.max(...initiativeInfosApplicable.map(info => info.initiative));
		}

		return out;
	}
}

export class InitiativeTrackerRowStateBuilderActive extends _InitiativeTrackerRowStateBuilderBase {
	_prop = "rows";

	async pGetScaledCreature ({isMon, name, source, scaledCr, scaledSummonSpellLevel, scaledSummonClassLevel}) {
		if (!isMon) return null;
		return DmScreenUtil.pGetScaledCreature({name, source, scaledCr, scaledSummonSpellLevel, scaledSummonClassLevel});
	}

	/* -------------------------------------------- */

	/**
	 * @inheritDoc
	 */
	async pGetNewRowState (
		{
			rows = null,

			isActive = null,
			isPlayerVisible = null,
			name = null,
			displayName = null,
			scaledCr = null,
			scaledSummonSpellLevel = null,
			scaledSummonClassLevel = null,
			customName = null,
			source = null,
			hpCurrent = null,
			hpMax = null,
			initiative = null,
			ordinal = null,
			rowStatColData = null,
			conditions = null,
		} = {},
	) {
		const isMon = name && source;
		const mon = await this.pGetScaledCreature({isMon, name, source, scaledCr, scaledSummonSpellLevel, scaledSummonClassLevel});
		if (isMon && !mon) return null;

		const fluff = mon ? await Renderer.monster.pGetFluff(mon) : null;

		if (isMon) {
			if (hpCurrent == null && hpMax == null) {
				hpCurrent = hpMax = await this._roller.pGetOrRollHp(mon, {isRollHp: this._comp._state.isRollHp});
			}

			if (initiative == null && this._comp._state.isRollInit) {
				initiative = await this._roller.pGetRollInitiative({mon});
			}

			if (ordinal == null) {
				const existingCreatures = this.getSimilarRows({
					rows,
					rowEntity: {
						name,
						customName,
						scaledCr,
						scaledSummonSpellLevel,
						scaledSummonClassLevel,
						source,
					},
				});

				ordinal = existingCreatures.length + 1;
			}

			if (isPlayerVisible == null) isPlayerVisible = !this._comp._state.playerInitHideNewMonster;
		}

		if (!isMon) {
			if (isPlayerVisible == null) isPlayerVisible = true;
		}

		if (rowStatColData == null) rowStatColData = this._getInitialRowStatColData({mon, fluff});

		return {
			id: CryptUtil.uid(),
			entity: {
				isActive: !!isActive,
				isPlayerVisible: !!isPlayerVisible,
				name,
				displayName,
				scaledCr,
				scaledSummonSpellLevel,
				scaledSummonClassLevel,
				customName,
				source,
				hpCurrent,
				hpMax,
				initiative,
				ordinal,
				rowStatColData: rowStatColData ?? [],
				conditions: conditions ?? [],
			},
		};
	}

	/* -------------------------------------------- */

	async pGetRowInitiativeMeta ({row}) {
		const out = await super.pGetRowInitiativeMeta({row});

		const mon = await this.pGetScaledCreature(row.entity);
		if (!mon) return out;

		out.mon = mon;
		out.initiativeModifier ||= Parser.getAbilityModifier(mon.dex);

		return out;
	}

	/* -------------------------------------------- */

	static _SIMILAR_ROW_PROPS = [
		"name",
		"customName",
		"scaledCr",
		"scaledSummonSpellLevel",
		"scaledSummonClassLevel",
		"source",
	];

	static getSimilarRowEntityHash ({rowEntity}) {
		return this._SIMILAR_ROW_PROPS
			.map(prop => JSON.stringify(rowEntity[prop] ?? null))
			.join("__");
	}

	getSimilarRows (
		{
			rows = null,

			rowEntity,
		},
	) {
		const rowEntityHash = this.constructor.getSimilarRowEntityHash({rowEntity});

		return (rows || this._comp._state[this._prop])
			.filter(({entity}) => {
				return this.constructor.getSimilarRowEntityHash({rowEntity: entity}) === rowEntityHash;
			});
	}

	getSimilarRowCounts (
		{
			rows = null,
		},
	) {
		return (rows || this._comp._state[this._prop])
			.reduce(
				(accum, {entity}) => {
					const rowEntityHash = InitiativeTrackerRowStateBuilderActive.getSimilarRowEntityHash({rowEntity: entity});
					accum[rowEntityHash] = (accum[rowEntityHash] || 0) + 1;
					return accum;
				},
				{},
			);
	}
}

export class InitiativeTrackerRowStateBuilderDefaultParty extends _InitiativeTrackerRowStateBuilderBase {
	_prop = "rowsDefaultParty";
}

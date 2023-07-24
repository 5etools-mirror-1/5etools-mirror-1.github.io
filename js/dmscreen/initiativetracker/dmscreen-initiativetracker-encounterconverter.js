import {InitiativeTrackerStatColumnFactory} from "./dmscreen-initiativetracker-statcolumns.js";

class _ConvertedEncounter {
	constructor () {
		this.isStatsAddColumns = false;

		this.statsCols = [];
		this.rows = [];
	}
}

export class InitiativeTrackerEncounterConverter {
	constructor (
		{
			roller,
			rowStateBuilderActive,
			importIsAddPlayers,
			importIsRollGroups,
			isRollInit,
			isRollHp,
		},
	) {
		this._roller = roller;
		this._rowStateBuilderActive = rowStateBuilderActive;

		this._importIsAddPlayers = importIsAddPlayers;
		this._importIsRollGroups = importIsRollGroups;
		this._isRollInit = isRollInit;
		this._isRollHp = isRollHp;
	}

	async pGetConverted ({entityInfos, encounterInfo}) {
		const out = new _ConvertedEncounter();

		await this._pGetConverted_pPlayers({entityInfos, encounterInfo, out});
		await this._pGetConverted_pCreatures({entityInfos, encounterInfo, out});

		return out;
	}

	/* -------------------------------------------- */

	async _pGetConverted_pPlayers ({entityInfos, encounterInfo, out}) {
		if (!this._importIsAddPlayers) return;

		await this._pGetConverted_pPlayers_advanced({entityInfos, encounterInfo, out});
		await this._pGetConverted_pPlayers_simple({entityInfos, encounterInfo, out});
	}

	async _pGetConverted_pPlayers_advanced ({entityInfos, encounterInfo, out}) {
		if (!encounterInfo.isAdvanced || !encounterInfo.playersAdvanced) return;

		const colNameIndex = {};
		encounterInfo.colsExtraAdvanced = encounterInfo.colsExtraAdvanced || [];
		if (encounterInfo.colsExtraAdvanced.length) out.isStatsAddColumns = true;

		encounterInfo.colsExtraAdvanced.forEach((col, i) => colNameIndex[i] = (col?.name || "").toLowerCase());

		const {ixsColLookup, ixExtrasHp, statsCols} = this._pGetConverted_pPlayers_advanced_getExtrasInfo({encounterInfo});
		out.statsCols.push(...statsCols);

		await encounterInfo.playersAdvanced
			.pSerialAwaitMap(async playerDetails => {
				out.rows.push(
					await this._rowStateBuilderActive
						.pGetNewRowState({
							isActive: false,
							isPlayerVisible: true,
							name: playerDetails.name || "",
							initiative: null,
							conditions: [],
							...this._pGetConverted_pPlayers_advanced_extras({
								playerDetails,
								ixExtrasHp,
								ixsColLookup,
							}),
						}),
				);
			});
	}

	_pGetConverted_pPlayers_advanced_getExtrasInfo ({encounterInfo}) {
		const statsCols = [];
		const ixsColLookup = {};
		let ixExtrasHp = null;

		encounterInfo.colsExtraAdvanced.forEach((col, i) => {
			let colName = col?.name || "";
			if (colName.toLowerCase() === "hp") {
				ixExtrasHp = i;
				return;
			}

			const newCol = InitiativeTrackerStatColumnFactory.fromEncounterAdvancedColName({colName});
			ixsColLookup[i] = newCol;
			statsCols.push(newCol);
		});

		return {ixsColLookup, ixExtrasHp, statsCols};
	}

	_pGetConverted_pPlayers_advanced_extras ({playerDetails, ixExtrasHp, ixsColLookup}) {
		const out = {
			hpCurrent: null,
			hpMax: null,
		};

		if (playerDetails.extras?.length) return out;

		const rowStatColData = playerDetails.extras
			.map((extra, i) => {
				const val = extra?.value || "";
				if (i === ixExtrasHp) return null;

				const meta = ixsColLookup[i];
				return meta.getInitialCellStateData({obj: {value: val}});
			})
			.filter(Boolean);

		if (ixExtrasHp == null) {
			return {
				...out,
				rowStatColData,
			};
		}

		const [hpCurrent, hpMax] = (playerDetails.extras[ixExtrasHp]?.value || "")
			.split("/")
			.map(it => {
				const clean = it.trim();
				if (!clean) return null;
				if (isNaN(clean)) return null;
				return Number(clean);
			});

		return {
			...out,
			hpCurrent,
			hpMax: hpCurrent != null && hpMax == null ? hpCurrent : hpCurrent,
			rowStatColData,
		};
	}

	async _pGetConverted_pPlayers_simple ({entityInfos, encounterInfo, out}) {
		if (encounterInfo.isAdvanced || !encounterInfo.playersSimple) return;

		await encounterInfo.playersSimple
			.pSerialAwaitMap(async playerGroup => {
				await [...new Array(playerGroup.count || 1)]
					.pSerialAwaitMap(async () => {
						out.rows.push(
							await this._rowStateBuilderActive
								.pGetNewRowState({
									name: "",
									hpCurrent: null,
									hpMax: null,
									initiative: null,
									isActive: false,
									conditions: [],
									isPlayerVisible: true,
								}),
						);
					});
			});
	}

	/* -------------------------------------------- */

	async _pGetConverted_pCreatures ({entityInfos, encounterInfo, out}) {
		if (!entityInfos?.length) return;

		await entityInfos
			.filter(Boolean)
			.pSerialAwaitMap(async entityInfo => {
				const groupInit = this._importIsRollGroups && this._isRollInit ? await this._roller.pGetRollInitiative({mon: entityInfo.entity}) : null;
				const groupHp = this._importIsRollGroups ? await this._roller.pGetOrRollHp(entityInfo.entity, {isRollHp: this._isRollHp}) : null;

				await [...new Array(entityInfo.count || 1)]
					.pSerialAwaitMap(async () => {
						const hpVal = this._importIsRollGroups
							? groupHp
							: await this._roller.pGetOrRollHp(entityInfo.entity, {isRollHp: this._isRollHp});

						out.rows.push(
							await this._rowStateBuilderActive
								.pGetNewRowState({
									rows: out.rows,
									name: entityInfo.entity.name,
									displayName: entityInfo.entity._displayName,
									scaledCr: entityInfo.entity._scaledCr,
									scaledSummonSpellLevel: entityInfo.entity._summonedBySpell_level,
									scaledSummonClassLevel: entityInfo.entity._summonedByClass_level,
									initiative: this._isRollInit
										? this._importIsRollGroups ? groupInit : await this._roller.pGetRollInitiative({mon: entityInfo.entity})
										: null,
									isActive: false,
									source: entityInfo.entity.source,
									conditions: [],
									hpCurrent: hpVal,
									hpMax: hpVal,
								}),
						);
					});
			});
	}
}

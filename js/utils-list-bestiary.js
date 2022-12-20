"use strict";

class ListUtilBestiary extends ListUtilEntity {
	static _getString_action_currentPinned_name ({page}) { return "From Current Bestiary Encounter"; }
	static _getString_action_savedPinned_name ({page}) { return "From Saved Bestiary Encounter"; }
	static _getString_action_file_name ({page}) { return "From Bestiary Encounter File"; }

	static _getString_action_currentPinned_msg_noSaved ({page}) { return "No saved encounter! Please first go to the Bestiary and create one."; }
	static _getString_action_savedPinned_msg_noSaved ({page}) { return "No saved encounters were found! Go to the Bestiary and create some first."; }

	static async _pGetLoadableSublist_getAdditionalState ({exportedSublist}) {
		const encounterInfo = await EncounterBuilderSublistPlugin.pGetEncounterSummary({exportedSublist});
		return {encounterInfo};
	}

	static async pGetLoadableSublist (opts) {
		return super.pGetLoadableSublist({...opts, page: UrlUtil.PG_BESTIARY});
	}

	static async _pHandleExportedSublist_pMutAdditionalState ({exportedSublist}) {
		await EncounterBuilderSublistPlugin.pMutLegacyData({exportedSublist});
	}

	static _getFileTypes ({page}) {
		return [
			...super._getFileTypes({page}),
			"encounter",
		];
	}

	static getContextOptionsLoadSublist (opts) {
		return super.getContextOptionsLoadSublist({...opts, page: UrlUtil.PG_BESTIARY});
	}
}

class EncounterBuilderSublistPlugin extends SublistPlugin {
	static _DEFAULT_PARTY_SIZE = 4;

	/** Get a generic representation of the encounter, which can be used elsewhere. */
	static async pGetEncounterSummary ({exportedSublist}) {
		exportedSublist = MiscUtil.copyFast(exportedSublist);
		await this.pMutLegacyData({exportedSublist});

		const out = this._getDefaultState();
		Object.keys(out)
			.filter(k => exportedSublist[k] != null)
			.forEach(k => out[k] = exportedSublist[k]);
		return out;
	}

	constructor () {
		super();
		this._encounterBuilder = null;
		this._sublistManager = null;
	}

	set encounterBuilder (val) { this._encounterBuilder = val; }
	set sublistManager (val) { this._sublistManager = val; }

	get isAdvanced () { return this._state.isAdvanced; }
	set isAdvanced (val) { this._state.isAdvanced = !!val; }

	get playersSimple () { return this._state.playersSimple; }
	set playersSimple (val) { this._state.playersSimple = val; }

	get colsExtraAdvanced () { return this._state.colsExtraAdvanced; }
	set colsExtraAdvanced (val) { this._state.colsExtraAdvanced = val; }

	get playersAdvanced () { return this._state.playersAdvanced; }
	set playersAdvanced (val) { this._state.playersAdvanced = val; }

	addHookIsAdvanced (hk, {isCall = true} = {}) {
		this._addHookBase("isAdvanced", hk);
		if (isCall) hk();
	}

	addHookPlayersSimple (hk, {isCall = true} = {}) {
		this._addHookBase("playersSimple", hk);
		if (isCall) hk();
	}

	addHookPlayersAdvanced (hk, {isCall = true} = {}) {
		this._addHookBase("playersAdvanced", hk);
		if (isCall) hk();
	}

	addHookColsExtraAdvanced (hk, {isCall = true} = {}) {
		this._addHookBase("colsExtraAdvanced", hk);
		if (isCall) hk();
	}

	initLate () {
		const hkStateChange = () => {
			this._sublistManager.pSaveSublistDebounced().then(null);
		};
		this._addHookAllBase(hkStateChange);
	}

	static async pGetEncounterName (exportedSublist) {
		if (exportedSublist.name) return exportedSublist.name;

		const expandedList = await ListUtil.pGetSublistEntities_fromHover({
			exportedSublist,
			page: UrlUtil.PG_BESTIARY,
		});

		if (!expandedList?.length) return "(Unnamed Encounter)";

		const {count, entity: {name}} = expandedList
			.sort((a, b) => SortUtil.ascSort(b.count, a.count) || SortUtil.ascSort(b.entity.name, a.entity.name))[0];

		return `Encounter with ${name}${count > 1 ? ` ×${count}` : ""}`;
	}

	async pLoadData ({exportedSublist, isMemoryOnly}) {
		const nxt = this._getDefaultState();

		// Allow URLified versions of keys
		const keyLookup = Object.keys(nxt).mergeMap(k => ({[k]: k, [k.toUrlified()]: k}));

		if (exportedSublist) {
			Object.entries(exportedSublist)
				.filter(([, v]) => v != null)
				.forEach(([k, v]) => {
					// Only add specific keys, as we do not want to track e.g. sublist state
					k = keyLookup[k];
					if (!k) return;

					if (isMemoryOnly) return nxt[k] = v;

					// When loading from non-memory sources, expand the data
					switch (k) {
						case "playersSimple": return nxt[k] = v.map(it => this.constructor._getDefaultPlayerRow_simple(it));
						case "colsExtraAdvanced": return nxt[k] = v.map(it => this.constructor._getDefaultColExtraAdvanced(it));
						case "playersAdvanced": return nxt[k] = v.map(it => this.constructor._getDefaultPlayerRow_advanced({
							...it,
							extras: it.extras.map(x => this.constructor._getDefaultPlayerAdvancedExtra(x)),
							colsExtraAdvanced: this._state.colsExtraAdvanced,
						}));

						default: return nxt[k] = v;
					}
				});
		}

		this._proxyAssignSimple("state", nxt, true);

		this._doEnsureAtLeastOnePlayer();
	}

	_doEnsureAtLeastOnePlayer () {
		if (!this._state.playersAdvanced.length) this._addPlayerRow_advanced();
		if (!this._state.playersSimple.length) this._addPlayerRow_simple();
	}

	_addPlayerRow_advanced () {
		const prevRowLevel = this._state.playersAdvanced.last()?.entity?.level;

		this._state.playersAdvanced = [
			...this._state.playersAdvanced,
			this.constructor._getDefaultPlayerRow_advanced({
				level: prevRowLevel,
				colsExtraAdvanced: this._state.colsExtraAdvanced,
			}),
		];
	}

	_addPlayerRow_simple () {
		const prevRowLevel = this._state.playersSimple.last()?.entity?.level;

		this._state.playersSimple = [
			...this._state.playersSimple,
			this.constructor._getDefaultPlayerRow_simple({
				level: prevRowLevel,
			}),
		];
	}

	doAddPlayer () {
		if (this._state.isAdvanced) return this._addPlayerRow_advanced();
		return this._addPlayerRow_simple();
	}

	doAddColExtraAdvanced () {
		this._state.colsExtraAdvanced = [
			...this._state.colsExtraAdvanced,
			this.constructor._getDefaultColExtraAdvanced(),
		];

		// region When adding a new advanced column, add a new cell to each player row
		this._state.playersAdvanced.forEach(it => it.entity.extras.push(this.constructor._getDefaultPlayerAdvancedExtra()));
		this._triggerCollectionUpdate("playersAdvanced");
		// endregion
	}

	doRemoveColExtraAdvanced (id) {
		// region When removing an advanced column, remove matching values from player rows
		const ix = this._state.colsExtraAdvanced.findIndex(it => it.id === id);
		if (!~ix) return;
		this._state.playersAdvanced.forEach(player => {
			player.entity.extras = player.entity.extras.filter((_, i) => i !== ix);
		});
		this._triggerCollectionUpdate("playersAdvanced");
		// endregion

		this._state.colsExtraAdvanced = this._state.colsExtraAdvanced.filter(it => it.id !== id);
	}

	async pMutSaveableData ({exportedSublist, isForce = false, isMemoryOnly = false}) {
		if (!isForce && !this._encounterBuilder.isActive()) return;

		const defaultState = this._getDefaultState();
		[
			"playersSimple",
			"isAdvanced",
			"colsExtraAdvanced",
			"playersAdvanced",
		].forEach(k => {
			exportedSublist[k] = this._state[k] != null ? MiscUtil.copyFast(this._state[k]) : defaultState[k];

			if (isMemoryOnly) return;

			this.constructor._mutExternalize({obj: exportedSublist, k});
		});
	}

	static _WALKER_EXTERNALIZE = null;
	static _HANDLERS_EXTERNALIZE = {
		array: (arr) => {
			if (arr.some(it => !it.id || !it.entity)) return arr;
			return arr.map(({entity}) => entity);
		},
	};
	static _mutExternalize ({obj, k}) {
		this._WALKER_EXTERNALIZE = this._WALKER_EXTERNALIZE || MiscUtil.getWalker();

		obj[k] = this._WALKER_EXTERNALIZE.walk(
			obj[k],
			this._HANDLERS_EXTERNALIZE,
		);
	}

	async pDoInitNewState ({prevExportableSublist, evt}) {
		const keys = ["playersSimple", "playersAdvanced"];

		// If SHIFT pressed, reset players
		if (evt.shiftKey) {
			keys.forEach(k => this._state[k] = []);
			this._doEnsureAtLeastOnePlayer();
			return;
		}

		// Otherwise, pass players on
		keys
			.filter(k => prevExportableSublist[k] != null)
			.forEach(k => this._state[k] = MiscUtil.copyFast(prevExportableSublist[k]));
	}

	getDownloadName () {
		if (!this._encounterBuilder.isActive()) return null;
		return "encounter";
	}

	getDownloadFileType () {
		if (!this._encounterBuilder.isActive()) return null;
		return "encounter";
	}

	getRawPartyMeta () {
		if (this._state.isAdvanced) return this._getRawPartyMeta_advanced();
		return this._getRawPartyMeta_simple();
	}

	_getRawPartyMeta_advanced () {
		const countByLevel = {};
		this._state.playersAdvanced
			.forEach(it => {
				countByLevel[it.entity.level] = (countByLevel[it.entity.level] || 0) + 1;
			});

		return Object.entries(countByLevel)
			.map(([level, count]) => ({level: Number(level), count}));
	}

	_getRawPartyMeta_simple () {
		return this._state.playersSimple
			.map(it => ({count: it.entity.count, level: it.entity.level}));
	}

	static async pMutLegacyData ({exportedSublist, isMemoryOnly}) {
		if (!exportedSublist) return;

		// region Legacy Bestiary Encounter Builder format
		if (exportedSublist.p) {
			exportedSublist.playersSimple = exportedSublist.p.map(it => this._getDefaultPlayerRow_simple(it));
			if (!isMemoryOnly) this._mutExternalize({obj: exportedSublist, k: "playersSimple"});
			delete exportedSublist.p;
		}

		if (exportedSublist.l) {
			Object.assign(exportedSublist, exportedSublist.l);
			delete exportedSublist.l;
		}

		if (exportedSublist.a != null) {
			exportedSublist.isAdvanced = !!exportedSublist.a;
			delete exportedSublist.a;
		}

		if (exportedSublist.c) {
			exportedSublist.colsExtraAdvanced = exportedSublist.c.map(name => this._getDefaultColExtraAdvanced({name}));
			if (!isMemoryOnly) this._mutExternalize({obj: exportedSublist, k: "colsExtraAdvanced"});
			delete exportedSublist.c;
		}

		if (exportedSublist.d) {
			exportedSublist.playersAdvanced = exportedSublist.d.map(({n, l, x}) => this._getDefaultPlayerRow_advanced({
				name: n,
				level: l,
				extras: x.map(value => this._getDefaultPlayerAdvancedExtra({value})),
				colsExtraAdvanced: exportedSublist.colsExtraAdvanced,
			}));
			if (!isMemoryOnly) this._mutExternalize({obj: exportedSublist, k: "playersAdvanced"});
			delete exportedSublist.d;
		}
		// endregion

		// region Legacy "reference" format
		// These are general save manager properties, but we set them here, as encounter data was the only thing to make
		//   use of this system.
		if (exportedSublist.bestiaryId) {
			exportedSublist.saveId = exportedSublist.bestiaryId;
			delete exportedSublist.bestiaryId;
		}

		if (exportedSublist.isRef) {
			exportedSublist.managerClient_isReferencable = true;
			exportedSublist.managerClient_isLoadAsCopy = false;
		}
		delete exportedSublist.isRef;
		// endregion
	}

	async pMutLegacyData ({exportedSublist, isMemoryOnly}) {
		await this.constructor.pMutLegacyData({exportedSublist, isMemoryOnly});
	}

	static _getDefaultPlayerRow_advanced ({name = "", level = 1, extras = null, colsExtraAdvanced = null} = {}) {
		extras = extras || [...new Array(colsExtraAdvanced?.length || 0)]
			.map(() => this._getDefaultPlayerAdvancedExtra());
		return {
			id: CryptUtil.uid(),
			entity: {
				name,
				level,
				extras,
			},
		};
	}

	static _getDefaultPlayerRow_simple (
		{
			count = this._DEFAULT_PARTY_SIZE,
			level = 1,
		} = {},
	) {
		return {
			id: CryptUtil.uid(),
			entity: {
				count,
				level,
			},
		};
	}

	static _getDefaultColExtraAdvanced (
		{
			name = "",
		} = {},
	) {
		return {
			id: CryptUtil.uid(),
			entity: {
				name,
			},
		};
	}

	static _getDefaultPlayerAdvancedExtra (
		{
			value = "",
		} = {},
	) {
		return {
			id: CryptUtil.uid(),
			entity: {
				value,
			},
		};
	}

	static _getDefaultState () {
		return {
			playersSimple: [],

			isAdvanced: false,
			colsExtraAdvanced: [],
			playersAdvanced: [],
		};
	}

	_getDefaultState () {
		return {
			...super._getDefaultState(),
			...this.constructor._getDefaultState(),
		};
	}
}

class EncounterBuilderLegacyStorageMigration {
	static _VERSION = 2;

	static _STORAGE_KEY_LEGACY_SAVED_ENCOUNTERS = "ENCOUNTER_SAVED_STORAGE";
	static _STORAGE_KEY_LEGACY_ENCOUNTER = "ENCOUNTER_STORAGE";

	static _STORAGE_KEY_LEGACY_ENCOUNTER_MIGRATION_VERSION = "ENCOUNTER_STORAGE_MIGRATION_VERSION";
	static _STORAGE_KEY_LEGACY_SAVED_ENCOUNTER_MIGRATION_VERSION = "ENCOUNTER_SAVED_STORAGE_MIGRATION_VERSION";

	static register () {
		SublistPersistor._LEGACY_MIGRATOR.registerLegacyMigration(this._pMigrateSublist.bind(this));
		SaveManager._LEGACY_MIGRATOR.registerLegacyMigration(this._pMigrateSaves.bind(this));
	}

	static async _pMigrateSublist (stored) {
		let version = await StorageUtil.pGet(this._STORAGE_KEY_LEGACY_ENCOUNTER_MIGRATION_VERSION);
		if (version && version >= 2) return false;
		if (!version) version = 1;

		const encounter = await StorageUtil.pGet(this._STORAGE_KEY_LEGACY_ENCOUNTER);
		if (!encounter) return false;

		Object.entries(encounter)
			.forEach(([k, v]) => {
				if (stored[k] != null) return;
				stored[k] = v;
			});

		await EncounterBuilderSublistPlugin.pMutLegacyData({exportedSublist: stored});

		await StorageUtil.pSet(this._STORAGE_KEY_LEGACY_ENCOUNTER_MIGRATION_VERSION, this._VERSION);

		JqueryUtil.doToast(`Migrated active Bestiary encounter from version ${version} to version ${this._VERSION}!`);

		return true;
	}

	static async _pMigrateSaves (stored) {
		let version = await StorageUtil.pGet(this._STORAGE_KEY_LEGACY_SAVED_ENCOUNTER_MIGRATION_VERSION);
		if (version && version >= 2) return false;
		if (!version) version = 1;

		const encounters = await StorageUtil.pGet(this._STORAGE_KEY_LEGACY_SAVED_ENCOUNTERS);
		if (!encounters) return false;

		await Object.entries(encounters.savedEncounters || {})
			.pSerialAwaitMap(async ([id, enc]) => {
				const legacyData = MiscUtil.copyFast(enc.data || {});
				legacyData.name = enc.name || "(Unnamed encounter)";
				legacyData.saveId = id;
				legacyData.manager_isSaved = true;
				await EncounterBuilderSublistPlugin.pMutLegacyData({exportedSublist: legacyData});

				const tgt = MiscUtil.getOrSet(stored, "state", "saves", []);
				tgt.push({
					id: CryptUtil.uid(),
					entity: legacyData,
				});
			});

		await StorageUtil.pSet(this._STORAGE_KEY_LEGACY_SAVED_ENCOUNTER_MIGRATION_VERSION, this._VERSION);

		JqueryUtil.doToast(`Migrated saved Bestiary encounters from version ${version} to version ${this._VERSION}!`);

		return true;
	}
}

EncounterBuilderLegacyStorageMigration.register();

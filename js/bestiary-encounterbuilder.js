"use strict";

/**
 * TODO rework this to use doubled multipliers for XP, so we avoid the 0.5x issue for 6+ party sizes. Then scale
 *   everything back down at the end.
 */
class EncounterBuilder extends ProxyBase {
	constructor (bestiaryPage) {
		super();

		this._bestiaryPage = bestiaryPage;

		this.stateInit = false;
		this._cache = new EncounterBuilder.Cache({bestiaryPage});
		this._lastPartyMeta = null;
		this._isAdvanced = false;
		this._lock = new VeLock();

		this._cachedTitle = null;

		// Encounter save/load
		this.__state = {
			savedEncounters: {},
			activeKey: null,
		};
		this._state = this._getProxy("state", this.__state);
		this._$iptName = null;
		this._$btnSave = null;
		this._$btnReload = null;
		this._$btnLoad = null;
		this.pSetSavedEncountersThrottled = MiscUtil.throttle(this._pSetSavedEncounters.bind(this), 50);
		this._infoHoverId = null;

		this.doSaveStateDebounced = MiscUtil.debounce(this.doSaveState, 50);

		// region Elements
		this._wrpRandomAndAdjust = null;
		this._wrpGroupAndDifficulty = null;

		this._$wrpAddidionalPlayers = null;
		this._$btnAddPlayers = null;
		this._$cbIsAdvanced = null;
		this._$btnAddAdvancedCol = null;
		this._$wrpGroupInfoLhs = null;
		this._$hrHasCreatures = null;
		this._$wrpDifficulty = null;
		this._$wrpAdvancedHelp = null;
		this._$dispXpEasy = null;
		this._$dispXpMedium = null;
		this._$dispXpHard = null;
		this._$dispXpDeadly = null;
		this._$dispXpAbsurd = null;
		this._$dispTtk = null;
		this._$dispBudgetDaily = null;
		this._$dispDifficulty = null;
		this._$dispXpRawTotal = null;
		this._$dispXpRawPerPlayer = null;
		this._$dispXpAdjustedTotal = null;
		this._$dispXpAdjustedPerPlayer = null;

		this._playerGroupMetas = [];
		this._playerAdvancedMetas = [];
		this._advancedHeaderMetas = [];
		this._advancedFooterMetas = [];
		// endregion
	}

	initUi () {
		// region Init elements
		this._wrpRandomAndAdjust = document.getElementById("wrp-encounterbuild-random-and-adjust");
		this._wrpGroupAndDifficulty = document.getElementById("wrp-encounterbuild-group-and-difficulty");
		// endregion

		$(`#btn-encounterbuild`).click(() => Hist.setSubhash(EncounterBuilder.HASH_KEY, true));

		this._renderRandomAndAdjust();
		this._renderGroupAndDifficulty();
	}

	async _handleClickSaveToUrl (evt) {
		const encounterPart = UrlUtil.packSubHash(EncounterUtil.SUB_HASH_PREFIX, [JSON.stringify(this._getSaveableState())], {isEncodeBoth: true});
		const parts = [location.href, encounterPart];
		await MiscUtil.pCopyTextToClipboard(parts.join(HASH_PART_SEP));
		JqueryUtil.showCopiedEffect(evt.currentTarget);
	}

	_handleClickSaveToFile () {
		DataUtil.userDownload(`encounter`, this._getSaveableState(), {fileType: "encounter"})
	}

	async _handleClickLoadFromFile () {
		const {jsons, errors} = await DataUtil.pUserUpload({expectedFileType: "encounter"});

		DataUtil.doHandleFileLoadErrorsGeneric(errors);

		if (jsons?.length && jsons[0].items && jsons[0].sources) { // if it's a bestiary sublist
			jsons.l = {
				items: jsons.items,
				sources: jsons.sources,
			}
		}
		await this._pDoLoadState(jsons[0]);
	}

	_handleClickCopyAsText (evt) {
		let xpTotal = 0;
		const toCopyCreatures = ListUtil.sublist.items
			.sort((a, b) => SortUtil.ascSortLower(a.name, b.name))
			.map(it => {
				xpTotal += Parser.crToXpNumber(it.values.cr) * it.data.count;
				return `${it.data.count}× ${it.name}`;
			})
			.join(", ");
		MiscUtil.pCopyTextToClipboard(`${toCopyCreatures} (${xpTotal.toLocaleString()} XP)`);
		JqueryUtil.showCopiedEffect(evt.currentTarget);
	}

	async _handleClickReset (evt) {
		if (!await InputUiUtil.pGetUserBoolean({title: "Reset Encounter", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
		await this._pReset({isNotResetPlayers: !evt.shiftKey, isNotAddInitialPlayers: !evt.shiftKey});
	}

	_handleClickBackToStatblocks () {
		Hist.setSubhash(EncounterBuilder.HASH_KEY, null);
	}

	_renderRandomAndAdjust () {
		// region Random
		let modeRandom = "medium";

		const pSetRandomMode = async (mode) => {
			const randomizer = new EncounterBuilder.Randomizer({partyMeta: this._getPartyMeta(), cache: this._cache});
			const random = await randomizer.pGetRandomEncounter(mode);
			if (random != null) await this._pLoadSublist(random);

			modeRandom = mode;
			$btnRandom
				.text(`Random ${mode.toTitleCase()}`)
				.title(`Randomly generate ${Parser.getArticle(mode)} ${mode.toTitleCase()} encounter`);
		};

		const $getLiRandom = (mode) => {
			return $(`<li title="Randomly generate ${Parser.getArticle(mode)} ${mode.toTitleCase()} encounter"><a href="#">Random ${mode.toTitleCase()}</a></li>`)
				.click((evt) => {
					evt.preventDefault();
					pSetRandomMode(mode);
				});
		};

		const $btnRandom = $(`<button class="btn btn-primary" style="min-width: 135px;" title="Randomly generate a Medium encounter">Random Medium</button>`)
			.click(evt => {
				evt.preventDefault();
				pSetRandomMode(modeRandom);
			});

		const $btnRandomMode = $(`<button class="btn btn-primary dropdown-toggle"><span class="caret"></span></button>`);
		JqueryUtil.bindDropdownButton($btnRandomMode);

		const $liRandomEasy = $getLiRandom("easy");
		const $liRandomMedium = $getLiRandom("medium");
		const $liRandomHard = $getLiRandom("hard");
		const $liRandomDeadly = $getLiRandom("deadly");
		// endregion

		// region Adjust
		let modeAdjust = "medium";

		const pSetAdjustMode = async (mode) => {
			const adjuster = new EncounterBuilder.Adjuster({partyMeta: this._getPartyMeta()});
			const adjusted = await adjuster.pGetAdjustedEncounter(mode);
			if (adjusted != null) await this._pLoadSublist(adjusted);

			modeAdjust = mode;
			$btnAdjust
				.text(`Adjust to ${mode.toTitleCase()}`)
				.title(`Adjust the current encounter difficulty to ${mode.toTitleCase()}`);
		};

		const $getLiAdjust = (mode) => {
			return $(`<li title="Adjust the current encounter difficulty to ${mode.toTitleCase()}"><a href="#">Adjust to ${mode.toTitleCase()}</a></li>`)
				.click((evt) => {
					evt.preventDefault();
					pSetAdjustMode(mode);
				});
		};

		const $btnAdjust = $(`<button class="btn btn-primary" style="min-width: 135px;" title="Adjust the current encounter difficulty to Medium">Adjust to Medium</button>`)
			.click(evt => {
				evt.preventDefault();
				pSetAdjustMode(modeAdjust);
			});

		const $btnAdjustMode = $(`<button class="btn btn-primary dropdown-toggle"><span class="caret"></span></button>`);
		JqueryUtil.bindDropdownButton($btnAdjustMode);

		const $liAdjustEasy = $getLiAdjust("easy");
		const $liAdjustMedium = $getLiAdjust("medium");
		const $liAdjustHard = $getLiAdjust("hard");
		const $liAdjustDeadly = $getLiAdjust("deadly");
		// endregion

		$$(this._wrpRandomAndAdjust)`<div class="row">
			<div class="flex-h-right">
				<div class="btn-group mr-3">
					${$btnRandom}
					${$btnRandomMode}
					<ul class="dropdown-menu">
						${$liRandomEasy}
						${$liRandomMedium}
						${$liRandomHard}
						${$liRandomDeadly}
					</ul>
				</div>

				<div class="btn-group">
					${$btnAdjust}
					${$btnAdjustMode}
					<ul class="dropdown-menu">
						${$liAdjustEasy}
						${$liAdjustMedium}
						${$liAdjustHard}
						${$liAdjustDeadly}
					</ul>
				</div>
			</div>
		</div>`;
	}

	_renderGroupAndDifficulty () {
		const $btnSaveToUrl = $(`<button class="btn btn-primary btn-xs mr-2">Save to URL</button>`).click((evt) => this._handleClickSaveToUrl(evt))
		const $btnSaveToFile = $(`<button class="btn btn-primary btn-xs">Save to File</button>`).click((evt) => this._handleClickSaveToFile(evt))
		const $btnLoadFromFile = $(`<button class="btn btn-primary btn-xs">Load from File</button>`).click((evt) => this._handleClickLoadFromFile(evt))
		const $btnCopyAsText = $(`<button class="btn btn-primary btn-xs mr-2">Copy as Text</button>`).click((evt) => this._handleClickCopyAsText(evt))
		const $btnReset = $(`<button class="btn btn-danger btn-xs" title="SHIFT-click to reset players">Reset</button>`).click((evt) => this._handleClickReset(evt))

		const $btnBackToStatblocks = $(`<button class="btn btn-default btn-xs ecgen__visible">Back to Statblocks</button>`).click((evt) => this._handleClickBackToStatblocks(evt));

		this._$wrpGroupInfoLhs = this._renderGroupAndDifficulty_$getGroupInfoLhs();
		this._$hrHasCreatures = $(`<hr class="hr-1">`);
		this._$wrpDifficulty = $$`<div class="flex">
			${this._renderGroupAndDifficulty_$getDifficultyLhs()}
			${this._renderGroupAndDifficulty_$getDifficultyRhs()}
		</div>`;

		$$(this._wrpGroupAndDifficulty)`
		<h3 class="mt-1 m-2">Group Info</h3>
		<div class="flex">
			${this._$wrpGroupInfoLhs}
			${this._renderGroupAndDifficulty_$getGroupInfoRhs()}
		</div>

		${this._$hrHasCreatures}
		${this._$wrpDifficulty}

		<hr class="hr-1">

		<div class="flex-v-center mb-2">
			${$btnSaveToUrl}
			<div class="btn-group flex-v-center mr-2">
				${$btnSaveToFile}
				${$btnLoadFromFile}
			</div>
			${$btnCopyAsText}
			${$btnReset}
		</div>

		<div class="flex">
			${$btnBackToStatblocks}
		</div>`;
	}

	_renderGroupAndDifficulty_$getGroupInfoLhs () {
		this._$btnAddAdvancedCol = $(`<button class="btn btn-primary btn-xs ecgen__advanced_add_col" title="Add Column"><span class="glyphicon glyphicon-list-alt"></span></button>`)
			.click(() => this._addAdvancedColumn());

		this._$btnAddPlayers = $(`<button class="btn btn-primary btn-xs"><span class="glyphicon glyphicon-plus"></span> Add Another Level</button>`)
			.click(() => {
				if (this._isAdvanced) this._addAdvancedPlayerRow(false);
				else this._addPlayerRow(false)
			});

		this._$cbIsAdvanced = $(`<input type="checkbox">`)
			.change(() => {
				const party = this._getPartyMeta();
				this._isAdvanced = !!this._$cbIsAdvanced.prop("checked");
				if (this._isAdvanced) {
					let first = true;
					party.levelMetas.forEach(it => {
						[...new Array(it.count)].forEach(() => {
							this._addAdvancedPlayerRow(first, false, "", it.level);
							first = false;
						});
					});
					this._playerGroupMetas.forEach(({fnRemove}) => fnRemove());
					this.updateDifficulty();
				} else {
					let first = true;
					party.levelMetas.forEach(it => {
						this._addPlayerRow(first, false, it.count, it.level);
						first = false;
					});
					this._playerAdvancedMetas.forEach(({fnRemove}) => fnRemove());
					this.updateDifficulty();
				}
				this._updateUiIsAdvanced(this._isAdvanced);
			});

		this._$wrpAddidionalPlayers = $$`<div class="mb-1 flex">
			<div class="ecgen__wrp_add_players_btn_wrp">
				${this._$btnAddPlayers}
			</div>
		</div>`;

		this._$wrpAdvancedHelp = $(`<div class="row">
			<div class="w-100">
				<i>Additional columns will be imported into the DM Screen.</i>
			</div>
		</div>`).hideVe();

		return $$`<div class="w-70">
			<div class="flex ecgen__players_head_simple">
				<div class="w-20">Players:</div>
				<div class="w-20">Level:</div>
			</div>

			<div class="ecgen__players_head_advanced">
				<div class="ecgen__player_advanced__name_head mr-1 ecgen__player_head_tall">Name</div>
				<div class="ecgen__player_advanced_narrow text-center mr-1 ecgen__player_head_tall">Level</div>
				${this._$btnAddAdvancedCol}
			</div>

			${this._$wrpAddidionalPlayers}

			<label class="flex-v-center">
				<div class="mr-2">Advanced Mode</div>
				${this._$cbIsAdvanced}
			</label>

			${this._$wrpAdvancedHelp}
		</div>`
	}

	_renderGroupAndDifficulty_$getGroupInfoRhs () {
		this._$dispXpEasy = $(`<div>Easy: ? XP</div>`);
		this._$dispXpMedium = $(`<div>Medium: ? XP</div>`);
		this._$dispXpHard = $(`<div>Hard: ? XP</div>`);
		this._$dispXpDeadly = $(`<div>Deadly: ? XP</div>`);
		this._$dispXpAbsurd = $(`<div>Absurd: ? XP</div>`);

		this._$dispTtk = $(`<div>TTK: ?</div>`);

		this._$dispBudgetDaily = $(`<div>Daily Budget: ? XP</div>`);

		return $$`<div class="w-30 text-right">
			${this._$dispXpEasy}
			${this._$dispXpMedium}
			${this._$dispXpHard}
			${this._$dispXpDeadly}
			${this._$dispXpAbsurd}
			<br>
			${this._$dispTtk}
			<br>
			${this._$dispBudgetDaily}
		</div>`
	}

	_renderGroupAndDifficulty_$getDifficultyLhs () {
		this._$dispDifficulty = $(`<h3 class="mt-2">Difficulty: ?</h3>`);
		return $$`<div class="w-50">
			${this._$dispDifficulty}
		</div>`;
	}

	_renderGroupAndDifficulty_$getDifficultyRhs () {
		this._$dispXpRawTotal = $(`<h4>Total XP: ?</h4>`);
		this._$dispXpRawPerPlayer = $(`<i>(? per player)</i>`);

		this._$hovXpAdjustedInfo = $(`<span class="glyphicon glyphicon-info-sign"></span>`);

		this._$dispXpAdjustedTotal = $(`<h4 class="inline-block">Adjusted XP: ?</h4>`)
		this._$dispXpAdjustedPerPlayer = $(`<i>(? per player)</i>`)

		return $$`<div class="w-50 text-right">
			${this._$dispXpRawTotal}
			<div>${this._$dispXpRawPerPlayer}</div>
			<div>${this._$hovXpAdjustedInfo} ${this._$dispXpAdjustedTotal}</div>
			<div>${this._$dispXpAdjustedPerPlayer}</div>
		</div>`;
	}

	_updateUiIsAdvanced () {
		this._$cbIsAdvanced.prop("checked", this._isAdvanced);

		this._advancedHeaderMetas.forEach(({fnRemove}) => fnRemove());
		this._advancedFooterMetas.forEach(({fnRemove}) => fnRemove())

		if (this._isAdvanced) {
			this._$btnAddPlayers.html(`<span class="glyphicon glyphicon-plus"></span> Add Another Player`);
			this._$wrpGroupInfoLhs.addClass(`ecgen__group_lhs--advanced`);
			this._$wrpAdvancedHelp.showVe();
		} else {
			this._$btnAddPlayers.html(`<span class="glyphicon glyphicon-plus"></span> Add Another Level`);
			this._$wrpGroupInfoLhs.removeClass(`ecgen__group_lhs--advanced`);
			this._$wrpAdvancedHelp.hideVe();
		}
	}

	async initState () {
		const initialState = await EncounterUtil.pGetInitialState();
		if (initialState && initialState.data) await this._pDoLoadState(initialState.data, initialState.type === "local");
		else this._addInitialPlayerRows();
		this.stateInit = true;
		await this._initSavedEncounters();
	}

	_addInitialPlayerRows (first) {
		if (this._isAdvanced) this._addAdvancedPlayerRow(first);
		else this._addPlayerRow(first, true, ECGEN_BASE_PLAYERS);
	}

	/**
	 * @param [opts] Options object
	 * @param [opts.isNotRemoveCreatures] If creature rows should not be removed.
	 * @param [opts.isNotResetPlayers] If player info should not be reset.
	 * @param [opts.isNotAddInitialPlayers] If initial player info should not be added.
	 */
	async _pReset (opts) {
		opts = opts || {};
		if (!opts.isNotRemoveCreatures) await ListUtil.pDoSublistRemoveAll();
		if (!opts.isNotResetPlayers) this._removeAllPlayerRows();
		if (!opts.isNotAddInitialPlayers) this._addInitialPlayerRows();

		this._state.activeKey = null;
		this.pSetSavedEncountersThrottled();
		this.doSaveStateDebounced();
	}

	async _pDoLoadState (savedState, playersOnly) {
		await this._pReset({isNotAddInitialPlayers: true, isNotRemoveCreatures: playersOnly});
		if (!savedState) return;
		try {
			if (savedState.a) {
				this._isAdvanced = true;
				this._updateUiIsAdvanced();
				if (savedState.d && savedState.d.length) {
					savedState.d.forEach((details, i) => this._addAdvancedPlayerRow(!i, false, details.n, details.l, details.x));
				} else this._addInitialPlayerRows(false);

				if (savedState.c && savedState.c.length) {
					savedState.c.forEach(col => {
						this._addAdvancedColumnHeader(col);
						this._addAdvancedColumnFooter();
					});
				}
			} else {
				if (savedState.p && savedState.p.length) {
					savedState.p.forEach(({count, level}, i) => this._addPlayerRow(!i, false, count, level));
				} else this._addInitialPlayerRows(false);
			}

			if (savedState.l && !playersOnly) {
				await this._bestiaryPage.pPreloadSublistSources(savedState.l);
				await ListUtil.pDoJsonLoad(savedState.l, false);
			}

			this.updateDifficulty();
		} catch (e) {
			JqueryUtil.doToast({content: `Could not load encounter! Was the file valid?`, type: "danger"});
			this._pReset();
		}
	}

	_getSaveableState () {
		const out = {
			p: this._getPartyMeta().levelMetas,
			l: ListUtil.getExportableSublist(),
			a: this._isAdvanced,
		};
		if (this._isAdvanced) {
			out.c = this._advancedHeaderMetas.map(({iptName}) => iptName.val());
			out.d = this._playerAdvancedMetas.map(({iptName, iptLevel, iptsExtra}) => {
				const extras = iptsExtra.map(ipt => ipt.val());
				while (extras.length < out.c.length) extras.push(""); // pad array to match columns length

				return {
					n: iptName.val(),
					l: Number(iptLevel.val()),
					x: extras.slice(0, out.c.length), // cap at columns length
				};
			});
		}
		return out;
	}

	doSaveState () {
		if (this.stateInit) EncounterUtil.pDoSaveState(this._getSaveableState());
	}

	resetCache () { this._cache.reset(); }

	async _pLoadSublist (toLoad) {
		await this._bestiaryPage.pPreloadSublistSources(toLoad);
		await ListUtil.pDoJsonLoad(toLoad, false);
		this.updateDifficulty();
	}

	_addAdvancedPlayerRow (first = true, doUpdate = true, name, level, extraCols) {
		this._$wrpAddidionalPlayers.before(this._getAdvancedPlayerRow(first, name, level, extraCols));
		if (doUpdate) this.updateDifficulty();
	}

	_addPlayerRow (first = true, doUpdate = true, count, level) {
		this._$wrpAddidionalPlayers.before(this._getPlayerRow(first, count, level));
		if (doUpdate) this.updateDifficulty();
	}

	_removeAllPlayerRows () {
		this._playerGroupMetas.forEach(({fnRemove}) => fnRemove());
		this._playerAdvancedMetas.forEach(({fnRemove}) => fnRemove());
	}

	isActive () {
		return Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true";
	}

	_showBuilder () {
		this._cachedTitle = this._cachedTitle || document.title;
		document.title = "Encounter Builder - 5etools";
		$(document.body).addClass("ecgen_active");
		this.updateDifficulty();
		ListUtil.doDeselectAll();
		ListUtil.doSublistDeselectAll();
	}

	_hideBuilder () {
		if (this._cachedTitle) {
			document.title = this._cachedTitle;
			this._cachedTitle = null;
		}
		$(document.body).removeClass("ecgen_active");
	}

	_handleClick ({evt, index, mode, customHashId}) {
		if (mode === "add") {
			return ListUtil.pDoSublistAdd({index, customHashId, doFinalize: true, addCount: evt.shiftKey ? 5 : 1});
		}

		return ListUtil.pDoSublistSubtract({index, subtractCount: evt.shiftKey ? 5 : 1, customHashId});
	}

	async _pHandleShuffleClick (ix) {
		await this._lock.pLock();

		try {
			const mon = this._bestiaryPage.dataList_[ix];
			const xp = Parser.crToXpNumber(mon.cr);
			if (!xp) return; // if Unknown/etc

			const curr = ListUtil.getExportableSublist();
			const hash = UrlUtil.autoEncodeHash(mon);
			const itemToSwitch = curr.items.find(it => it.h === hash);

			const availMons = this._cache.getCreaturesByXp(xp);
			if (availMons.length > 1) {
				// note that this process does not remove any old sources

				let reroll = mon;
				let rolledHash = hash;
				while (rolledHash === hash) {
					reroll = RollerUtil.rollOnArray(availMons);
					rolledHash = UrlUtil.autoEncodeHash(reroll);
				}
				itemToSwitch.h = rolledHash;
				if (!curr.sources.includes(reroll.source)) {
					curr.sources.push(reroll.source);
				}

				// do a pass to merge any duplicates
				outer: for (let i = 0; i < curr.items.length; ++i) {
					const item = curr.items[i];
					for (let j = i - 1; j >= 0; --j) {
						const prevItem = curr.items[j];

						if (item.h === prevItem.h) {
							prevItem.c = String(Number(prevItem.c) + Number(item.c));
							curr.items.splice(i, 1);
							continue outer;
						}
					}
				}

				await this._pLoadSublist(curr);
			} // else can't reroll
		} finally {
			this._lock.unlock();
		}
	}

	handleSubhash () {
		// loading state from the URL is instead handled as part of EncounterUtil.pGetInitialState
		if (Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true") this._showBuilder();
		else this._hideBuilder();
	}

	_getApproxTurnsToKill () {
		const party = this._getPartyMeta().levelMetas;
		const encounter = EncounterBuilderUtils.getSublistedEncounter();

		const totalDpt = party
			.map(it => this._getApproxDpt(it.level) * it.count)
			.reduce((a, b) => a + b, 0);
		const totalHp = encounter
			.filter(it => it.approxHp != null && it.approxAc != null)
			.map(it => (it.approxHp * it.approxAc / 10) * it.count)
			.reduce((a, b) => a + b, 0);

		return totalHp / totalDpt;
	}

	_getApproxDpt (pcLevel) {
		const approxOutputFighterChampion = [
			{hit: 0, dmg: 17.38}, {hit: 0, dmg: 17.38}, {hit: 0, dmg: 17.59}, {hit: 0, dmg: 33.34}, {hit: 1, dmg: 50.92}, {hit: 2, dmg: 53.92}, {hit: 2, dmg: 53.92}, {hit: 3, dmg: 56.92}, {hit: 4, dmg: 56.92}, {hit: 4, dmg: 56.92}, {hit: 4, dmg: 76.51}, {hit: 4, dmg: 76.51}, {hit: 5, dmg: 76.51}, {hit: 5, dmg: 76.51}, {hit: 5, dmg: 77.26}, {hit: 5, dmg: 77.26}, {hit: 6, dmg: 77.26}, {hit: 6, dmg: 77.26}, {hit: 6, dmg: 77.26}, {hit: 6, dmg: 97.06},
		];
		const approxOutputRogueTrickster = [
			{hit: 5, dmg: 11.4}, {hit: 5, dmg: 11.4}, {hit: 10, dmg: 15.07}, {hit: 11, dmg: 16.07}, {hit: 12, dmg: 24.02}, {hit: 12, dmg: 24.02}, {hit: 12, dmg: 27.7}, {hit: 13, dmg: 28.7}, {hit: 14, dmg: 32.38}, {hit: 14, dmg: 32.38}, {hit: 14, dmg: 40.33}, {hit: 14, dmg: 40.33}, {hit: 15, dmg: 44}, {hit: 15, dmg: 44}, {hit: 15, dmg: 47.67}, {hit: 15, dmg: 47.67}, {hit: 16, dmg: 55.63}, {hit: 16, dmg: 55.63}, {hit: 16, dmg: 59.3}, {hit: 16, dmg: 59.3},
		];
		const approxOutputWizard = [
			{hit: 5, dmg: 14.18}, {hit: 5, dmg: 14.18}, {hit: 5, dmg: 22.05}, {hit: 6, dmg: 22.05}, {hit: 2, dmg: 28}, {hit: 2, dmg: 28}, {hit: 2, dmg: 36}, {hit: 3, dmg: 36}, {hit: 6, dmg: 67.25}, {hit: 6, dmg: 67.25}, {hit: 4, dmg: 75}, {hit: 4, dmg: 75}, {hit: 5, dmg: 85.5}, {hit: 5, dmg: 85.5}, {hit: 5, dmg: 96}, {hit: 5, dmg: 96}, {hit: 6, dmg: 140}, {hit: 6, dmg: 140}, {hit: 6, dmg: 140}, {hit: 6, dmg: 140},
		];
		const approxOutputCleric = [
			{hit: 5, dmg: 17.32}, {hit: 5, dmg: 17.32}, {hit: 5, dmg: 23.1}, {hit: 6, dmg: 23.1}, {hit: 7, dmg: 28.88}, {hit: 7, dmg: 28.88}, {hit: 7, dmg: 34.65}, {hit: 8, dmg: 34.65}, {hit: 9, dmg: 40.42}, {hit: 9, dmg: 40.42}, {hit: 9, dmg: 46.2}, {hit: 9, dmg: 46.2}, {hit: 10, dmg: 51.98}, {hit: 10, dmg: 51.98}, {hit: 11, dmg: 57.75}, {hit: 11, dmg: 57.75}, {hit: 11, dmg: 63.52}, {hit: 11, dmg: 63.52}, {hit: 11, dmg: 63.52}, {hit: 11, dmg: 63.52},
		];

		const approxOutputs = [approxOutputFighterChampion, approxOutputRogueTrickster, approxOutputWizard, approxOutputCleric];

		const approxOutput = approxOutputs.map(it => it[pcLevel - 1]);
		return approxOutput.map(it => it.dmg * ((it.hit + 10.5) / 20)).mean(); // 10.5 = average d20
	}

	updateDifficulty () {
		const partyMeta = this._getPartyMeta();
		const encounter = EncounterBuilderUtils.calculateListEncounterXp(partyMeta);

		const $elEasy = this._$dispXpEasy.removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_EASY}">Easy:</span> ${partyMeta.easy.toLocaleString()} XP`);
		const $elmed = this._$dispXpMedium.removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_MEDIUM}">Medium:</span> ${partyMeta.medium.toLocaleString()} XP`);
		const $elHard = this._$dispXpHard.removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_HARD}">Hard:</span> ${partyMeta.hard.toLocaleString()} XP`);
		const $elDeadly = this._$dispXpDeadly.removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_DEADLY}">Deadly:</span> ${partyMeta.deadly.toLocaleString()} XP`);
		const $elAbsurd = this._$dispXpAbsurd.removeClass("bold").html(`<span class="help" title="${EncounterBuilder._TITLE_ABSURD}">Absurd:</span> ${partyMeta.absurd.toLocaleString()} XP`);

		this._$dispTtk.html(`<span class="help" title="${EncounterBuilder._TITLE_TTK}">TTK:</span> ${this._getApproxTurnsToKill().toFixed(2)}`);

		this._$dispBudgetDaily.removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_BUDGET_DAILY}">Daily Budget:</span> ${partyMeta.dailyBudget.toLocaleString()} XP`);

		let difficulty = "Trivial";
		if (encounter.adjustedXp >= partyMeta.absurd) {
			difficulty = "Absurd";
			$elAbsurd.addClass("bold");
		} else if (encounter.adjustedXp >= partyMeta.deadly) {
			difficulty = "Deadly";
			$elDeadly.addClass("bold");
		} else if (encounter.adjustedXp >= partyMeta.hard) {
			difficulty = "Hard";
			$elHard.addClass("bold");
		} else if (encounter.adjustedXp >= partyMeta.medium) {
			difficulty = "Medium";
			$elmed.addClass("bold");
		} else if (encounter.adjustedXp >= partyMeta.easy) {
			difficulty = "Easy";
			$elEasy.addClass("bold");
		}

		if (encounter.relevantCount) {
			this._$hrHasCreatures.showVe();
			this._$wrpDifficulty.showVe();

			this._$dispDifficulty.text(`Difficulty: ${difficulty}`);
			this._$dispXpRawTotal.text(`Total XP: ${encounter.baseXp.toLocaleString()}`);
			this._$dispXpRawPerPlayer.text(`(${Math.floor(encounter.baseXp / partyMeta.cntPlayers).toLocaleString()} per player)`);

			// TODO(Future) update this based on the actual method being used
			const infoEntry = {
				type: "entries",
				entries: [
					`{@b Adjusted by a ${encounter.meta.playerAdjustedXpMult}× multiplier, based on a minimum challenge rating threshold of approximately ${`${encounter.meta.crCutoff.toFixed(2)}`.replace(/[,.]?0+$/, "")}*&dagger;, and a party size of ${encounter.meta.playerCount} players.}`,
					// `{@note * If the maximum challenge rating is two or less, there is no minimum threshold. Similarly, if less than a third of the party are level 5 or higher, there is no minimum threshold. Otherwise, for each creature in the encounter, the average CR of the encounter is calculated while excluding that creature. The highest of these averages is then halved to produce a minimum CR threshold. CRs less than this minimum are ignored for the purposes of calculating the final CR multiplier.}`,
					`{@note * If the maximum challenge rating is two or less, there is no minimum threshold. Similarly, if less than a third of the party are level 5 or higher, there is no minimum threshold. Otherwise, for each creature in the encounter in lowest-to-highest CR order, the average CR of the encounter is calculated while excluding that creature. Then, if the removed creature's CR is more than one deviation less than  this average, the process repeats. Once the process halts, this threshold value (average minus one deviation) becomes the final CR cutoff.}`,
					`<hr>`,
					{
						type: "quote",
						entries: [
							`&dagger; [...] don't count any monsters whose challenge rating is significantly below the average challenge rating of the other monsters in the group [...]`,
						],
						"by": "{@book Dungeon Master's Guide, page 82|DMG|3|4 Modify Total XP for Multiple Monsters}",
					},
					`<hr>`,
					{
						"type": "table",
						"caption": "Encounter Multipliers",
						"colLabels": [
							"Number of Monsters",
							"Multiplier",
						],
						"colStyles": [
							"col-6 text-center",
							"col-6 text-center",
						],
						"rows": [
							[
								"1",
								"×1",
							],
							[
								"2",
								"×1.5",
							],
							[
								"3-6",
								"×2",
							],
							[
								"7-10",
								"×2.5",
							],
							[
								"11-14",
								"×3",
							],
							[
								"15 or more",
								"×4",
							],
						],
					},
				],
			};

			if (this._infoHoverId == null) {
				const hoverMeta = Renderer.hover.getMakePredefinedHover(infoEntry, {isBookContent: true});
				this._infoHoverId = hoverMeta.id;

				this._$hovXpAdjustedInfo
					.off("mouseover")
					.off("mousemove")
					.off("mouseleave")
					.on("mouseover", function (event) { hoverMeta.mouseOver(event, this) })
					.on("mousemove", function (event) { hoverMeta.mouseMove(event, this) })
					.on("mouseleave", function (event) { hoverMeta.mouseLeave(event, this) });
			} else {
				Renderer.hover.updatePredefinedHover(this._infoHoverId, infoEntry);
			}

			this._$dispXpAdjustedTotal.text(`Adjusted XP: ${encounter.adjustedXp.toLocaleString()}`);
			this._$dispXpAdjustedPerPlayer.text(`(${Math.floor(encounter.adjustedXp / partyMeta.cntPlayers).toLocaleString()} per player)`);
		} else {
			this._$hrHasCreatures.hideVe();
			this._$wrpDifficulty.hideVe();
		}

		this.doSaveState();
	}

	_getPartyMeta () {
		let rawPlayerArr;
		if (this._isAdvanced) {
			const countByLevel = {};
			this._playerAdvancedMetas
				.forEach(({iptLevel}) => {
					const level = Number(iptLevel.val());
					countByLevel[level] = (countByLevel[level] || 0) + 1;
				});
			rawPlayerArr = Object.entries(countByLevel).map(([level, count]) => ({level: Number(level), count}));
		} else {
			rawPlayerArr = this._playerGroupMetas
				.map(({selCount, selLevel}) => {
					return {
						count: Number(selCount.val()),
						level: Number(selLevel.val()),
					};
				});
		}

		const out = new EncounterPartyMeta(rawPlayerArr);
		this._lastPartyMeta = out;
		return out;
	}

	get lastPartyMeta () { return this._lastPartyMeta; }

	_calculateXp () {
		const partyMeta = this._getPartyMeta();
		const encounter = EncounterBuilderUtils.calculateListEncounterXp(partyMeta);
		return {partyMeta: partyMeta, encounter: encounter};
	}

	async doStatblockMouseOver (evt, ele, ixMon, customHashId) {
		const mon = this._bestiaryPage.dataList_[ixMon];

		const hash = UrlUtil.autoEncodeHash(mon);
		return Renderer.hover.pHandleLinkMouseOver(evt, ele, {page: UrlUtil.PG_BESTIARY, source: mon.source, hash, preloadId: customHashId});
	}

	static getTokenHoverMeta (mon) {
		const hasToken = mon.tokenUrl || mon.hasToken;
		if (!hasToken) return null;

		return Renderer.hover.getMakePredefinedHover(
			{
				type: "image",
				href: {
					type: "external",
					url: Renderer.monster.getTokenUrl(mon),
				},
				data: {
					hoverTitle: `Token \u2014 ${mon.name}`,
				},
			},
			{isBookContent: true},
		);
	}

	async handleImageMouseOver (evt, $ele, ixMon) {
		// We'll rebuild the mouseover handler with whatever we load
		$ele.off("mouseover");

		const mon = this._bestiaryPage.dataList_[ixMon];

		const handleNoImages = () => {
			const hoverMeta = Renderer.hover.getMakePredefinedHover(
				{
					type: "entries",
					entries: [
						Renderer.utils.HTML_NO_IMAGES,
					],
					data: {
						hoverTitle: `Image \u2014 ${mon.name}`,
					},
				},
				{isBookContent: true},
			);
			$ele.mouseover(evt => hoverMeta.mouseOver(evt, $ele[0]))
				.mousemove(evt => hoverMeta.mouseMove(evt, $ele[0]))
				.mouseleave(evt => hoverMeta.mouseLeave(evt, $ele[0]));
			$ele.mouseover();
		};

		const handleHasImages = () => {
			if (fluff && fluff.images && fluff.images.length) {
				const hoverMeta = Renderer.hover.getMakePredefinedHover(
					{
						type: "image",
						href: fluff.images[0].href,
						data: {
							hoverTitle: `Image \u2014 ${mon.name}`,
						},
					},
					{isBookContent: true},
				);
				$ele.mouseover(evt => hoverMeta.mouseOver(evt, $ele[0]))
					.mousemove(evt => hoverMeta.mouseMove(evt, $ele[0]))
					.mouseleave(evt => hoverMeta.mouseLeave(evt, $ele[0]));
				$ele.mouseover();
			} else return handleNoImages();
		};

		const fluff = await Renderer.monster.pGetFluff(mon);

		if (fluff) handleHasImages();
		else handleNoImages();
	}

	static _getFauxMon (name, source, scaledTo) {
		return {name, source, _isScaledCr: scaledTo != null, _scaledCr: scaledTo};
	}

	async pDoCrChange ($iptCr, ixMon, scaledTo) {
		await this._lock.pLock();

		if (!$iptCr) return; // Should never occur, but if the creature has a non-adjustable CR, this field will not exist

		try {
			const mon = this._bestiaryPage.dataList_[ixMon];
			const baseCr = mon.cr.cr || mon.cr;
			if (baseCr == null) return;
			const baseCrNum = Parser.crToNumber(baseCr);
			const targetCr = $iptCr.val();

			if (Parser.isValidCr(targetCr)) {
				const targetCrNum = Parser.crToNumber(targetCr);

				if (targetCrNum === scaledTo) return;

				const state = ListUtil.getExportableSublist();
				const toFindHash = UrlUtil.autoEncodeHash(mon);

				const toFindUid = !(scaledTo == null || baseCrNum === scaledTo) ? Renderer.monster.getCustomHashId(EncounterBuilder._getFauxMon(mon.name, mon.source, scaledTo)) : null;
				const ixCurrItem = state.items.findIndex(it => {
					if (scaledTo == null || scaledTo === baseCrNum) return !it.customHashId && it.h === toFindHash;
					else return it.customHashId === toFindUid;
				});
				if (!~ixCurrItem) throw new Error(`Could not find previously sublisted item!`);

				const toFindNxtUid = baseCrNum !== targetCrNum ? Renderer.monster.getCustomHashId(EncounterBuilder._getFauxMon(mon.name, mon.source, targetCrNum)) : null;
				const nextItem = state.items.find(it => {
					if (targetCrNum === baseCrNum) return !it.customHashId && it.h === toFindHash;
					else return it.customHashId === toFindNxtUid;
				});

				// if there's an existing item with a matching UID (or lack of), merge into it
				if (nextItem) {
					const curr = state.items[ixCurrItem];
					nextItem.c = `${Number(nextItem.c || 1) + Number(curr.c || 1)}`;
					state.items.splice(ixCurrItem, 1);
				} else {
					// if we're returning to the original CR, wipe the existing UID. Otherwise, adjust it
					if (targetCrNum === baseCrNum) delete state.items[ixCurrItem].customHashId;
					else state.items[ixCurrItem].customHashId = Renderer.monster.getCustomHashId(EncounterBuilder._getFauxMon(mon.name, mon.source, targetCrNum));
				}

				await this._pLoadSublist(state);
			} else {
				JqueryUtil.doToast({
					content: `"${$iptCr.val()}" is not a valid Challenge Rating! Please enter a valid CR (0-30). For fractions, "1/X" should be used.`,
					type: "danger",
				});
				$iptCr.val(Parser.numberToCr(scaledTo || baseCr));
			}
		} finally {
			this._lock.unlock();
		}
	}

	_addAdvancedColumnHeader (name) {
		this._$btnAddAdvancedCol.before(this._getAdvancedPlayerDetailHeader(name));
	}

	_addAdvancedColumnFooter () {
		const wrpFooter = e_({
			tag: "div",
			clazz: "ecgen__player_advanced_narrow flex-v-baseline flex-h-center no-shrink no-grow mr-1",
			children: [
				e_({
					tag: "button",
					clazz: "btn btn-xs btn-danger ecgen__advanced_remove_col",
					click: () => {
						const pos = this._advancedFooterMetas.indexOf(meta);
						this._playerAdvancedMetas.forEach(({fnRemoveIptExtra}) => fnRemoveIptExtra(pos));
						this._advancedHeaderMetas[pos].fnRemove();
						fnRemove();
					},
					title: "Remove Column",
					html: `<span class="glyphicon-trash glyphicon"></span>`,
				}),
			],
		});

		const fnRemove = () => {
			wrpFooter.remove();
			this._advancedFooterMetas = this._advancedFooterMetas.filter(it => it !== meta);
			this.doSaveStateDebounced();
		};

		const meta = {
			wrp: wrpFooter,
			fnRemove,
		};
		this._advancedFooterMetas.push(meta);

		this._$wrpAddidionalPlayers.append(wrpFooter)
	}

	_addAdvancedColumn () {
		this._addAdvancedColumnHeader();
		this._playerAdvancedMetas.forEach(({fnAddIptExtra}) => fnAddIptExtra());
		this._addAdvancedColumnFooter();
		this.doSaveStateDebounced();
	}

	_getAdvancedPlayerDetailHeader (name) {
		const iptName = e_({
			tag: "input",
			clazz: `ecgen__player_advanced_narrow form-control form-control--minimal input-xs text-center mr-1`,
			val: name || "",
			change: () => this.doSaveStateDebounced(),
			attrs: {
				autocomplete: "new-password",
			},
		});

		const fnRemove = () => {
			iptName.remove();
			this._advancedHeaderMetas = this._advancedHeaderMetas.filter(it => it !== meta);
			this.doSaveStateDebounced();
		};

		const meta = {
			iptName,
			fnRemove,
		};
		this._advancedHeaderMetas.push(meta);

		return iptName;
	}

	_getIptAdvancedPlayerDetail (value) {
		return e_({
			tag: "input",
			clazz: `ecgen__player_advanced_narrow ecgen__player_advanced_extra form-control form-control--minimal input-xs text-center mr-1`,
			val: value || "",
			change: () => this.doSaveStateDebounced(),
		});
	}

	_getAdvancedPlayerRow (isFirst, name, level, extraVals) {
		extraVals = extraVals || this._advancedHeaderMetas.map(() => "");

		const iptName = e_({
			tag: "input",
			clazz: `ecgen__player_advanced__name form-control form-control--minimal input-xs mr-1`,
			val: name || "",
			change: () => this.doSaveStateDebounced(),
		});

		const iptLevel = e_({
			tag: "input",
			clazz: `ecgen__player_advanced__level ecgen__player_advanced_narrow form-control form-control--minimal input-xs text-right mr-1`,
			val: level || 1,
			type: "number",
			attrs: {
				min: 1,
				max: 20,
			},
			change: () => this.updateDifficulty(),
		});

		const iptsExtra = extraVals.map(it => this._getIptAdvancedPlayerDetail(it));

		const btnRemove = isFirst
			? e_({tag: "div", clazz: `ecgen__del_players_filler`})
			: e_({
				tag: "button",
				clazz: `btn btn-danger btn-xs ecgen__del_players`,
				click: () => {
					this._playerAdvancedMetas = this._playerAdvancedMetas.filter(it => it !== meta);
					wrpRow.remove();
					this.updateDifficulty();
				},
				title: "Remove Player",
				html: `<span class="glyphicon glyphicon-trash"></span>`,
			});

		const wrpRow = e_({
			tag: "div",
			clazz: `row mb-2`,
			children: [
				e_({
					tag: "div",
					clazz: `w-100 flex ecgen__player_advanced_flex`,
					children: [
						iptName,
						iptLevel,
						...iptsExtra,
						btnRemove,
					],
				}),
			],
		});

		const fnAddIptExtra = () => {
			const iptExtra = this._getIptAdvancedPlayerDetail();
			(iptsExtra.last() || iptLevel).after(iptExtra);
			iptsExtra.push(iptExtra);
			this.doSaveStateDebounced();
		};

		const fnRemoveIptExtra = (ix) => {
			const iptExtra = iptsExtra[ix];
			iptsExtra.splice(ix, 1);
			iptExtra.remove();
			this.doSaveStateDebounced();
		};

		const fnRemove = () => {
			wrpRow.remove();
			this._playerAdvancedMetas = this._playerAdvancedMetas.filter(it => it !== meta);
			this.doSaveStateDebounced();
		};

		const meta = {
			wrp: wrpRow,
			iptName,
			iptLevel,
			iptsExtra,
			fnAddIptExtra,
			fnRemoveIptExtra,
			fnRemove,
		};
		this._playerAdvancedMetas.push(meta);

		return wrpRow;
	}

	_getPlayerRow (isFirst, count, level) {
		count = Number(count) || 1;
		level = Number(level) || 1;

		const selLevel = e_({
			tag: "select",
			clazz: `form-control form-control--minimal input-xs`,
			change: () => this.updateDifficulty(),
			html: `${[...new Array(20)].map((_, i) => `<option ${(level === i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}`,
		});

		const selCount = e_({
			tag: "select",
			clazz: `form-control form-control--minimal input-xs`,
			change: () => this.updateDifficulty(),
			html: `${[...new Array(12)].map((_, i) => `<option ${(count === i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}`,
		});

		const wrpRow = e_({
			tag: "div",
			clazz: `flex-v-center mb-2`,
			children: [
				e_({
					tag: "div",
					clazz: `w-20`,
					children: [
						selCount,
					],
				}),

				e_({
					tag: "div",
					clazz: `w-20`,
					children: [
						selLevel,
					],
				}),

				isFirst ? null : e_({
					tag: "div",
					clazz: `ml-2 flex-v-center`,
					children: [
						e_({
							tag: "button",
							clazz: `btn btn-danger btn-xs ecgen__del_players`,
							click: () => {
								this._playerGroupMetas = this._playerGroupMetas.filter(it => it !== meta);
								wrpRow.remove();
								this.updateDifficulty();
							},
							title: `Remove Player Group`,
							html: `<span class="glyphicon glyphicon-trash"></span>`,
						}),
					],
				}),
			],
		});

		const fnRemove = () => {
			wrpRow.remove();
			this._playerGroupMetas = this._playerGroupMetas.filter(it => it !== meta);
		};

		const meta = {
			wrp: wrpRow,
			selLevel,
			selCount,
			fnRemove,
		};
		this._playerGroupMetas.push(meta);

		return wrpRow;
	}

	getButtons (monId) {
		return e_({
			tag: "span",
			clazz: `ecgen__visible col-1 no-wrap pl-0 btn-group`,
			click: evt => {
				evt.preventDefault();
				evt.stopPropagation();
			},
			children: [
				e_({
					tag: "button",
					title: `Add (SHIFT for 5)`,
					clazz: `btn btn-success btn-xs ecgen__btn_list`,
					click: evt => this._handleClick({evt, index: monId, mode: "add"}),
					children: [
						e_({
							tag: "span",
							clazz: `glyphicon glyphicon-plus`,
						}),
					],
				}),
				e_({
					tag: "button",
					title: `Subtract (SHIFT for 5)`,
					clazz: `btn btn-danger btn-xs ecgen__btn_list`,
					click: evt => this._handleClick({evt, index: monId, mode: "subtract"}),
					children: [
						e_({
							tag: "span",
							clazz: `glyphicon glyphicon-minus`,
						}),
					],
				}),
			],
		});
	}

	getSublistButtonsMeta (sublistItem) {
		const $btnAdd = $(`<button title="Add (SHIFT for 5)" class="btn btn-success btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-plus"></span></button>`)
			.click(evt => this._handleClick({evt, index: sublistItem.ix, mode: "add", customHashId: sublistItem.data.customHashId}));

		const $btnSub = $(`<button title="Subtract (SHIFT for 5)" class="btn btn-danger btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-minus"></span></button>`)
			.click(evt => this._handleClick({evt, index: sublistItem.ix, mode: "subtract", customHashId: sublistItem.data.customHashId}));

		const $btnRandomize = $(`<button title="Randomize Monster" class="btn btn-default btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-random"></span></button>`)
			.click(() => this._pHandleShuffleClick(sublistItem.ix));

		const $btnLock = $(`<button title="Lock Monster against Randomizing/Adjusting" class="btn btn-default btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-lock"></span></button>`)
			.click(() => ListUtil.pSetDataEntry({sublistItem, key: "isLocked", value: !sublistItem.data.isLocked}))
			.toggleClass("active", sublistItem.data.isLocked);

		const $wrp = $$`<span class="ecgen__visible col-1-5 no-wrap pl-0 btn-group">
			${$btnAdd}
			${$btnSub}
			${$btnRandomize}
			${$btnLock}
		</span>`
			.click(evt => {
				evt.preventDefault();
				evt.stopPropagation()
			});

		return {
			$wrp,
			fnUpdate: () => $btnLock.toggleClass("active", sublistItem.data.isLocked),
		};
	}

	// region saved encounters
	async _initSavedEncounters () {
		const $wrpControls = $(`#ecgen__wrp-save-controls`).empty();

		const savedState = await EncounterUtil.pGetSavedState();
		Object.assign(this._state, savedState);

		const pLoadActiveEncounter = async () => {
			// save/restore the active key, to prevent it from being killed by the reset
			const cached = this._state.activeKey;
			const encounter = this._state.savedEncounters[this._state.activeKey];
			await this._pDoLoadState(encounter.data);
			this._state.activeKey = cached;
			this.pSetSavedEncountersThrottled();
		};

		this._$iptName = $(`<input class="form-control form-control--minimal mb-3 mt-0 px-2 text-right bold" style="max-width: 330px;"/>`)
			.change(() => {
				const name = this._$iptName.val().trim() || "(Unnamed Encounter)";
				this._$iptName.val(name);
				const encounter = this._state.savedEncounters[this._state.activeKey];
				encounter.name = name;
				this._state.savedEncounters = {
					...this._state.savedEncounters,
					[this._state.activeKey]: encounter,
				};
				this.pSetSavedEncountersThrottled();
			});
		const hookName = () => {
			if (this._state.activeKey) {
				const encounter = this._state.savedEncounters[this._state.activeKey];
				this._$iptName.val(encounter.name);
			} else this._$iptName.val("");
			this.pSetSavedEncountersThrottled();
		};
		this._addHook("state", "savedEncounters", hookName);
		this._addHook("state", "activeKey", hookName);
		hookName();

		this._$btnNew = $(`<button class="btn btn-default btn-xs mr-2" title="New Encounter (SHIFT-click to reset players)"><span class="glyphicon glyphicon glyphicon-file"/></button>`)
			.click(evt => {
				this._state.activeKey = null;
				this._pReset({isNotResetPlayers: !evt.shiftKey, isNotAddInitialPlayers: !evt.shiftKey});
			});
		const hookDisplayNew = () => this._$btnNew.toggleClass("hidden", !this._state.activeKey);
		this._addHook("state", "activeKey", hookDisplayNew);
		hookDisplayNew();

		// TODO set window title to encounter name on save?
		this._$btnSave = $(`<button class="btn btn-default btn-xs mr-2" title="Save Encounter"/>`)
			.click(async () => {
				if (this._state.activeKey) {
					const encounter = this._state.savedEncounters[this._state.activeKey];
					encounter.data = this._getSaveableState();

					this._state.savedEncounters = {
						...this._state.savedEncounters,
						[this._state.activeKey]: encounter,
					};
					this.pSetSavedEncountersThrottled();
					JqueryUtil.doToast({type: "success", content: "Saved!"});
				} else {
					const name = await InputUiUtil.pGetUserString({title: "Enter Encounter Name"});

					if (name != null) {
						const key = CryptUtil.uid();
						this._state.savedEncounters = {
							...this._state.savedEncounters,
							[key]: {
								name,
								data: this._getSaveableState(),
							},
						};
						this._state.activeKey = key;
						this.pSetSavedEncountersThrottled();
						JqueryUtil.doToast({type: "success", content: "Saved!"});
					}
				}
			});
		const hookButtonText = () => this._$btnSave.html(this._state.activeKey ? `<span class="glyphicon glyphicon-floppy-disk"/>` : "Save Encounter");
		this._addHook("state", "activeKey", hookButtonText);
		hookButtonText();

		const pDoReload = async () => {
			const inStorage = await EncounterUtil.pGetSavedState();
			const prev = inStorage.savedEncounters[this._state.activeKey];
			if (!prev) {
				return JqueryUtil.doToast({
					content: `Could not find encounter in storage! Has it been deleted?`,
					type: "danger",
				});
			} else {
				this._state.savedEncounters = {
					...this._state.savedEncounters,
					[this._state.activeKey]: prev,
				};
				await pLoadActiveEncounter();
			}
		};
		this._$btnReload = $(`<button class="btn btn-default btn-xs mr-2" title="Reload Current Encounter"><span class="glyphicon glyphicon-refresh"/></button>`)
			.click(() => pDoReload());

		this._$btnLoad = $(`<button class="btn btn-default btn-xs">Load Encounter</button>`)
			.click(async () => {
				const inStorage = await EncounterUtil.pGetSavedState();
				const {$modalInner, doClose} = UiUtil.getShowModal({title: "Saved Encounters"});
				const $wrpRows = $(`<div class="flex-col w-100 h-100"/>`).appendTo($modalInner);

				const encounters = inStorage.savedEncounters;
				if (Object.keys(encounters).length) {
					let rendered = Object.keys(encounters).length;
					Object.entries(encounters)
						.sort((a, b) => SortUtil.ascSortLower(a[1].name || "", b[1].name || ""))
						.forEach(([k, v]) => {
							const $iptName = $(`<input class="input input-xs form-control form-control--minimal mr-2">`)
								.val(v.name)
								.change(() => {
									const name = $iptName.val().trim() || "(Unnamed Encounter)";
									$iptName.val(name);
									const loaded = this._state.savedEncounters[k];
									loaded.name = name;
									this._state.savedEncounters = {...this._state.savedEncounters};
									this.pSetSavedEncountersThrottled();
								});

							const $btnLoad = $(`<button class="btn btn-primary btn-xs mr-2">Load</button>`)
								.click(async () => {
									// if we've already got the correct encounter loaded, reload it
									if (this._state.activeKey === k) await pDoReload();
									else this._state.activeKey = k;

									await pLoadActiveEncounter();
									await doClose();
								});

							const $btnDelete = $(`<button class="btn btn-danger btn-xs"><span class="glyphicon glyphicon-trash"/></button>`)
								.click(() => {
									if (this._state.activeKey === k) this._state.activeKey = null;
									this._state.savedEncounters = Object.keys(this._state.savedEncounters)
										.filter(it => it !== k)
										.mergeMap(it => ({[it]: this._state.savedEncounters[it]}));
									$row.remove();
									if (!--rendered) $$`<div class="w-100 flex-vh-center italic">No saved encounters</div>`.appendTo($wrpRows);
									this.pSetSavedEncountersThrottled();
								});

							const $row = $$`<div class="flex-v-center w-100 mb-2">
								${$iptName}
								${$btnLoad}
								${$btnDelete}
							</div>`.appendTo($wrpRows);
						});
				} else $$`<div class="w-100 flex-vh-center italic">No saved encounters</div>`.appendTo($wrpRows)
			});

		const hookActiveKey = () => {
			// show/hide controls
			this._$iptName.toggle(!!this._state.activeKey);
			this._$btnReload.toggle(!!this._state.activeKey);
		};
		this._addHook("state", "activeKey", hookActiveKey);
		hookActiveKey();

		$$`<div class="flex-col" style="align-items: flex-end;">
			${this._$iptName}
			<div class="flex-h-right">${this._$btnNew}${this._$btnSave}${this._$btnReload}${this._$btnLoad}</div>
		</div>`.appendTo($wrpControls);
	}

	_pSetSavedEncounters () {
		if (!this.stateInit) return;
		return StorageUtil.pSet(EncounterUtil.SAVED_ENCOUNTER_SAVE_LOCATION, this.__state);
	}
	// endregion
}
EncounterBuilder.HASH_KEY = "encounterbuilder";
EncounterBuilder.TIERS = ["easy", "medium", "hard", "deadly", "absurd"];
EncounterBuilder._TITLE_EASY = "An easy encounter doesn't tax the characters' resources or put them in serious peril. They might lose a few hit points, but victory is pretty much guaranteed.";
EncounterBuilder._TITLE_MEDIUM = "A medium encounter usually has one or two scary moments for the players, but the characters should emerge victorious with no casualties. One or more of them might need to use healing resources.";
EncounterBuilder._TITLE_HARD = "A hard encounter could go badly for the adventurers. Weaker characters might get taken out of the fight, and there's a slim chance that one or more characters might die.";
EncounterBuilder._TITLE_DEADLY = "A deadly encounter could be lethal for one or more player characters. Survival often requires good tactics and quick thinking, and the party risks defeat";
EncounterBuilder._TITLE_ABSURD = "An &quot;absurd&quot; encounter is a deadly encounter as per the rules, but is differentiated here to provide an additional tool for judging just how deadly a &quot;deadly&quot; encounter will be. It is calculated as: &quot;deadly + (deadly - hard)&quot;.";
EncounterBuilder._TITLE_BUDGET_DAILY = "This provides a rough estimate of the adjusted XP value for encounters the party can handle before the characters will need to take a long rest.";
EncounterBuilder._TITLE_TTK = "Time to Kill: The estimated number of turns the party will require to defeat the encounter. This assumes single-target damage only.";

/**
 * A cache of XP value -> creature.
 */
EncounterBuilder.Cache = class {
	constructor ({bestiaryPage}) {
		this._bestiaryPage = bestiaryPage;
		this._cache = null;
	}

	_build () {
		if (this._cache != null) return;
		// create a map of {XP: [monster list]}
		this._cache = this._getBuiltCache();
	}

	_getBuiltCache () {
		const out = {};
		this._bestiaryPage.list_.visibleItems.map(it => this._bestiaryPage.dataList_[it.ix]).filter(m => !m.isNpc).forEach(m => {
			const mXp = Parser.crToXpNumber(m.cr);
			if (mXp) (out[mXp] = out[mXp] || []).push(m);
		});
		return out;
	}

	reset () { this._cache = null; }

	getCreaturesByXp (xp) {
		this._build();
		return this._cache[xp] || [];
	}

	getXpKeys () {
		this._build();
		return Object.keys(this._cache).map(it => Number(it));
	}
}

EncounterBuilder.Adjuster = class {
	constructor ({partyMeta}) {
		this._partyMeta = partyMeta;
	}

	async pGetAdjustedEncounter (difficulty) {
		let currentEncounter = EncounterBuilderUtils.getSublistedEncounter();
		if (!currentEncounter.length) {
			JqueryUtil.doToast({content: `The current encounter contained no creatures! Please add some first.`, type: "warning"});
			return;
		}

		if (currentEncounter.every(it => it.isLocked)) {
			JqueryUtil.doToast({content: `The current encounter contained only locked creatures! Please unlock or add some other creatures some first.`, type: "warning"});
			return;
		}

		currentEncounter
			.filter(it => !it.isLocked)
			.forEach(creatureMeta => creatureMeta.count = 1);

		const ixLow = EncounterBuilder.TIERS.indexOf(difficulty);
		if (!~ixLow) throw new Error(`Unhandled difficulty level: "${difficulty}"`);

		// fudge min/max numbers slightly
		const [targetMin, targetMax] = [
			Math.floor(this._partyMeta[EncounterBuilder.TIERS[ixLow]] * 0.9),
			Math.ceil((this._partyMeta[EncounterBuilder.TIERS[ixLow + 1]] - 1) * 1.1),
		];

		if (EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta).adjustedXp > targetMax) {
			JqueryUtil.doToast({content: `Could not adjust the current encounter to ${difficulty.uppercaseFirst()}, try removing some creatures!`, type: "danger"});
			return;
		}

		// only calculate this once rather than during the loop, to ensure stable conditions
		// less accurate in some cases, but should prevent infinite loops
		const crCutoff = EncounterBuilderUtils.getCrCutoff(currentEncounter, this._partyMeta);

		// randomly choose creatures to skip
		// generate array of [0, 1, ... n-1] where n = number of unique creatures
		// this will be used to determine how many of the unique creatures we want to skip
		const numSkipTotals = [...new Array(currentEncounter.filter(it => !it.isLocked).length)].map((_, ix) => ix);

		const invalidSolutions = [];
		let lastAdjustResult;
		for (let maxTries = 999; maxTries >= 0; --maxTries) {
			// -1/1 = complete; 0 = continue
			lastAdjustResult = this._pGetAdjustedEncounter_doTryAdjusting({currentEncounter, numSkipTotals, targetMin, targetMax});
			if (lastAdjustResult !== EncounterBuilder.Adjuster._INCOMPLETE_EXHAUSTED) break;

			invalidSolutions.push(MiscUtil.copy(currentEncounter));

			// reset for next attempt
			currentEncounter
				.filter(it => !it.isLocked)
				.forEach(creatureMeta => creatureMeta.count = 1);
		}

		// no good solution was found, so pick the closest invalid solution
		if (lastAdjustResult !== EncounterBuilder.Adjuster._COMPLETE && invalidSolutions.length) {
			currentEncounter = invalidSolutions
				.map(soln => ({
					encounter: soln,
					distance: (() => {
						const xp = EncounterBuilderUtils.calculateEncounterXp(soln, this._partyMeta.cntPlayers);
						if (xp > targetMax) return xp - targetMax;
						else if (xp < targetMin) return targetMin - xp;
						else return 0;
					})(),
				}))
				.sort((a, b) => SortUtil.ascSort(a.distance, b.distance))[0].encounter;
		}

		// do a post-step to randomly bulk out our counts of "irrelevant" creatures, ensuring plenty of fireball fodder
		this._pGetAdjustedEncounter_doIncreaseIrrelevantCreatureCount({currentEncounter, crCutoff, targetMax});

		// Return data in "loadable sublist" format
		return {
			items: currentEncounter.map(creatureMeta => ({
				h: creatureMeta.hash,
				c: `${creatureMeta.count}`,
				customHashId: creatureMeta.customHashId || undefined,
				l: creatureMeta.isLocked,
			})),
			sources: ListUtil.getExportableSublist().sources,
		};
	}

	_pGetAdjustedEncounter_doTryAdjusting ({currentEncounter, numSkipTotals, targetMin, targetMax}) {
		if (!numSkipTotals.length) return EncounterBuilder.Adjuster._INCOMPLETE_FAILED; // no solution possible, so exit loop

		let skipIx = 0;
		// 7/12 * 7/12 * ... chance of moving the skipIx along one
		while (!(RollerUtil.randomise(12) > 7) && skipIx < numSkipTotals.length - 1) skipIx++;

		const numSkips = numSkipTotals.splice(skipIx, 1)[0]; // remove the selected skip amount; we'll try the others if this one fails
		const curUniqueCreatures = [...currentEncounter.filter(it => !it.isLocked)];
		if (numSkips) {
			[...new Array(numSkips)].forEach(() => {
				const ixRemove = RollerUtil.randomise(curUniqueCreatures.length) - 1;
				if (!~ixRemove) return;
				curUniqueCreatures.splice(ixRemove, 1);
			});
		}

		for (let maxTries = 999; maxTries >= 0; --maxTries) {
			const encounterXp = EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta);
			if (encounterXp.adjustedXp > targetMin && encounterXp.adjustedXp < targetMax) {
				return EncounterBuilder.Adjuster._COMPLETE;
			}

			// chance to skip each creature at each iteration
			// otherwise, the case where every creature is relevant produces an equal number of every creature
			const pickFrom = [...curUniqueCreatures];
			if (pickFrom.length > 1) {
				let loops = Math.floor(pickFrom.length / 2);
				// skip [half, n-1] creatures
				loops = RollerUtil.randomise(pickFrom.length - 1, loops);
				while (loops-- > 0) {
					const ix = RollerUtil.randomise(pickFrom.length) - 1;
					pickFrom.splice(ix, 1);
				}
			}

			while (pickFrom.length) {
				const ix = RollerUtil.randomise(pickFrom.length) - 1;
				const picked = pickFrom.splice(ix, 1)[0];
				picked.count++;
				if (EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta.cntPlayers).adjustedXp > targetMax) {
					picked.count--;
				}
			}
		}

		return EncounterBuilder.Adjuster._INCOMPLETE_EXHAUSTED;
	}

	_pGetAdjustedEncounter_doIncreaseIrrelevantCreatureCount ({currentEncounter, crCutoff, targetMax}) {
		const belowCrCutoff = currentEncounter.filter(it => !it.isLocked && it.cr && it.cr < crCutoff);
		if (!belowCrCutoff.length) return;

		let budget = targetMax - EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta).adjustedXp;
		if (budget > 0) {
			belowCrCutoff.forEach(it => it._xp = Parser.crToXpNumber(Parser.numberToCr(it.cr)));
			const usable = belowCrCutoff.filter(it => it._xp < budget);

			if (usable.length) {
				const totalPlayers = this._partyMeta.levelMetas.map(it => it.count).reduce((a, b) => a + b, 0);
				const averagePlayerLevel = this._partyMeta.levelMetas.map(it => it.level * it.count).reduce((a, b) => a + b, 0) / totalPlayers;

				// try to avoid flooding low-level parties
				const playerToCreatureRatio = (() => {
					if (averagePlayerLevel < 5) return [0.8, 1.3];
					else if (averagePlayerLevel < 11) return [1, 2];
					else if (averagePlayerLevel < 17) return [1, 3];
					else return [1, 4];
				})();

				const [minDesired, maxDesired] = [Math.floor(playerToCreatureRatio[0] * totalPlayers), Math.ceil(playerToCreatureRatio[1] * totalPlayers)];

				// keep rolling until we fail to add a creature, or until we're out of budget
				while (EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta).adjustedXp <= targetMax) {
					const totalCreatures = currentEncounter.map(it => it.count).reduce((a, b) => a + b, 0);

					// if there's less than min desired, large chance of adding more
					// if there's more than max desired, small chance of adding more
					// if there's between min and max desired, medium chance of adding more
					const chanceToAdd = totalCreatures < minDesired ? 90 : totalCreatures > maxDesired ? 40 : 75;

					const isAdd = RollerUtil.roll(100) < chanceToAdd;
					if (isAdd) {
						RollerUtil.rollOnArray(belowCrCutoff).count++;
					} else break;
				}
			}
		}
	}
}
EncounterBuilder.Adjuster._INCOMPLETE_EXHAUSTED = 0;
EncounterBuilder.Adjuster._INCOMPLETE_FAILED = -1;
EncounterBuilder.Adjuster._COMPLETE = 1;

EncounterBuilder.Randomizer = class {
	constructor ({partyMeta, cache}) {
		this._partyMeta = partyMeta;
		this._cache = cache;

		// region Pre-cache various "constants" required during generation, for performance
		this._STANDARD_XP_VALUES = new Set(Object.values(Parser.XP_CHART_ALT));
		this._DESCENDING_AVAILABLE_XP_VALUES = this._cache.getXpKeys().sort(SortUtil.ascSort).reverse();

		/*
		Sorted array of:
		{
			cr: "1/2",
			xp: 50,
			crNum: 0.5
		}
		 */
		this._CR_METAS = Object.entries(Parser.XP_CHART_ALT)
			.map(([cr, xp]) => ({cr, xp, crNum: Parser.crToNumber(cr)}))
			.sort((a, b) => SortUtil.ascSort(b.crNum, a.crNum));
		// endregion
	}

	async pGetRandomEncounter (difficulty) {
		const ixLow = EncounterBuilder.TIERS.indexOf(difficulty);
		if (!~ixLow) throw new Error(`Unhandled difficulty level: "${difficulty}"`);

		const budget = this._partyMeta[EncounterBuilder.TIERS[ixLow + 1]] - 1;
		const lockedEncounterCreatures = await EncounterBuilderUtils.getSublistedEncounter()
			.filter(it => it.isLocked)
			.pSerialAwaitMap(async ({baseCreature, count, customHashId}) => {
				const creature = await Renderer.monster.pGetModifiedCreature(baseCreature, customHashId);
				const xp = Parser.crToXpNumber(creature.cr);

				return new EncounterBuilder.CandidateEncounterCreature({
					xp,
					count,
					creature,
					isLocked: true,
					customHashId,
				});
			});

		const closestSolution = this._pDoGenerateEncounter_getSolution({budget, lockedEncounterCreatures});

		if (!closestSolution) {
			JqueryUtil.doToast({content: `Failed to generate a valid encounter within the provided parameters!`, type: "warning"});
			return;
		}

		const toLoad = {items: []};
		const sources = new Set();
		closestSolution.creatures
			.forEach(it => {
				toLoad.items.push({
					h: UrlUtil.autoEncodeHash(it.creature),
					c: String(it.count),
					l: it.isLocked,
					customHashId: it.customHashId ?? undefined,
				});
				sources.add(it.creature.source);
			});
		toLoad.sources = [...sources];
		return toLoad;
	}

	_pDoGenerateEncounter_getSolution ({budget, lockedEncounterCreatures}) {
		const solutions = this._pDoGenerateEncounter_getSolutions({budget, lockedEncounterCreatures});
		const validSolutions = solutions.filter(it => this._isValidEncounter({candidateEncounter: it, budget}));
		if (validSolutions.length) return RollerUtil.rollOnArray(validSolutions);
		return null;
	}

	_pDoGenerateEncounter_getSolutions ({budget, lockedEncounterCreatures}) {
		// If there are enough players that single-monster XP is halved, generate twice as many solutions, half with double XP cap
		if (this._partyMeta.cntPlayers > 5) {
			return [...new Array(EncounterBuilder.Randomizer._NUM_SAMPLES * 2)]
				.map((_, i) => {
					return this._pDoGenerateEncounter_generateClosestEncounter({
						budget: budget * (Number((i >= EncounterBuilder.Randomizer._NUM_SAMPLES)) + 1),
						rawBudget: budget,
						lockedEncounterCreatures,
					});
				});
		}

		return [...new Array(EncounterBuilder.Randomizer._NUM_SAMPLES)]
			.map(() => this._pDoGenerateEncounter_generateClosestEncounter({budget: budget, lockedEncounterCreatures}));
	}

	_isValidEncounter ({candidateEncounter, budget}) {
		const encounterXp = candidateEncounter.getXp({partyMeta: this._partyMeta});
		return encounterXp.adjustedXp >= (budget * 0.6) && encounterXp.adjustedXp <= (budget * 1.1)
	}

	_pDoGenerateEncounter_generateClosestEncounter ({budget, rawBudget, lockedEncounterCreatures}) {
		if (rawBudget == null) rawBudget = budget;

		const candidateEncounter = new EncounterBuilder.CandidateEncounter({lockedEncounterCreatures});
		const xps = this._getUsableXpsForBudget({budget});

		let nextBudget = budget;
		let skips = 0;
		let steps = 0;
		while (xps.length) {
			if (steps++ > 100) break;

			if (skips) {
				skips--;
				xps.shift();
				continue;
			}

			const xp = xps[0];

			if (xp > nextBudget) {
				xps.shift();
				continue;
			}

			skips = this._getNumSkips({xps, candidateEncounter, xp});
			if (skips) {
				skips--;
				xps.shift();
				continue;
			}

			this._mutEncounterAddCreatureByXp({candidateEncounter, xp});

			nextBudget = this._getBudgetRemaining({candidateEncounter, budget, rawBudget});
		}

		return candidateEncounter;
	}

	_getUsableXpsForBudget ({budget}) {
		const xps = this._DESCENDING_AVAILABLE_XP_VALUES
			.filter(it => {
				// Make TftYP values (i.e. those that are not real XP thresholds) get skipped 9/10 times
				if (!this._STANDARD_XP_VALUES.has(it) && RollerUtil.randomise(10) !== 10) return false;
				return it <= budget;
			});

		// region Do initial skips--discard some potential XP values early
		// 50% of the time, skip the first 0-1/3rd of available CRs
		if (xps.length > 4 && RollerUtil.roll(2) === 1) {
			const skips = RollerUtil.roll(Math.ceil(xps.length / 3));
			return xps.slice(skips);
		}

		return xps;
		// endregion
	}

	_getBudgetRemaining ({candidateEncounter, budget, rawBudget}) {
		if (!candidateEncounter.creatures.length) return budget;

		const curr = candidateEncounter.getXp({partyMeta: this._partyMeta});
		const budgetRemaining = budget - curr.adjustedXp;

		const meta = this._CR_METAS.filter(it => it.xp <= budgetRemaining);

		// If we're a large party, and we're doing a "single creature worth less XP" generation, force the generation
		//   to stop.
		if (rawBudget !== budget && curr.count === 1 && (rawBudget - curr.baseXp) <= 0) {
			return 0;
		}

		// if the highest CR creature has CR greater than the cutoff, adjust for next multiplier
		if (meta.length && meta[0].crNum >= curr.meta.crCutoff) {
			const nextMult = Parser.numMonstersToXpMult(curr.relevantCount + 1, this._partyMeta.cntPlayers);
			return Math.floor((budget - (nextMult * curr.baseXp)) / nextMult);
		}

		// otherwise, no creature has CR greater than the cutoff, don't worry about multipliers
		return budgetRemaining;
	}

	_mutEncounterAddCreatureByXp ({candidateEncounter, xp}) {
		// region Try to add another copy of an existing creature
		const existingMetas = candidateEncounter.creatures.filter(it => !it.isLocked && it.xp === xp);
		if (existingMetas.length && RollerUtil.roll(100) < 85) { // 85% chance to add another copy of an existing monster
			RollerUtil.rollOnArray(existingMetas).count++;
			return;
		}
		// endregion

		// region Try to add a new creature
		// We retrieve the list of all available creatures for this XP, then randomly pick creatures from that list until
		//   we exhaust all options.
		// Generally, the first creature picked should be usable. We only need to continue our search loop if the creature
		//   picked is already included in our encounter, and is locked.
		const availableCreatures = [...this._cache.getCreaturesByXp(xp)];
		while (availableCreatures.length) {
			const ixRolled = RollerUtil.randomise(availableCreatures.length) - 1;
			const rolled = availableCreatures[ixRolled];
			availableCreatures.splice(ixRolled, 1);

			const existingMeta = candidateEncounter.creatures
				.find(it => it.creature.source === rolled.source && (it.creature._displayName || it.creature.name) === rolled.name);
			if (existingMeta?.isLocked) continue;

			if (existingMeta) existingMeta.count++;
			else candidateEncounter.addCreature({xp, creature: rolled, count: 1});

			break;
		}
		// endregion
	}

	_getNumSkips ({xps, candidateEncounter, xp}) {
		// if there are existing entries at this XP, don't skip
		const existing = candidateEncounter.creatures.filter(it => it.xp === xp);
		if (existing.length) return 0;

		if (xps.length <= 1) return 0;

		// skip 70% of the time by default, less 13% chance per item skipped
		const isSkip = RollerUtil.roll(100) < (70 - (13 * candidateEncounter.skipCount));
		if (!isSkip) return 0;

		candidateEncounter.skipCount++;
		const maxSkip = xps.length - 1;
		// flip coins; so long as we get heads, keep skipping
		for (let i = 0; i < maxSkip; ++i) {
			if (RollerUtil.roll(2) === 0) {
				return i;
			}
		}
		return maxSkip - 1;
	}
}
EncounterBuilder.Randomizer._NUM_SAMPLES = 20;

EncounterBuilder.CandidateEncounter = class {
	constructor ({lockedEncounterCreatures = null} = {}) {
		this.skipCount = 0;
		this.creatures = [...(lockedEncounterCreatures || [])];
	}

	getXp ({partyMeta}) {
		const data = this.creatures
			// Avoid including e.g. locked "summon" creatures.
			// Since we always use "10 XP" for CR 0 creatures, this condition is logical.
			// Note that this effectively discounts non-XP-carrying creatures from "creature count XP multiplier"
			//   calculations. This is intentional; we make the simplifying assumption that if a creature doesn't carry XP,
			//   it should have no impact on the difficulty encounter.
			.filter(it => it.xp)
			.map(it => ({cr: Parser.crToNumber(it.creature.cr), count: it.count}));
		return EncounterBuilderUtils.calculateEncounterXp(data, partyMeta);
	}

	addCreature ({xp, count, creature}) {
		this.creatures.push(
			new EncounterBuilder.CandidateEncounterCreature({
				xp,
				creature,
				count,
			}),
		);
	}
}

EncounterBuilder.CandidateEncounterCreature = class {
	constructor ({xp, creature, count, isLocked = false, customHashId}) {
		this.xp = xp;
		this.creature = creature;
		this.count = count;

		// region These are stored and passed back to the list if/when we load our generated encounter
		this.isLocked = !!isLocked;
		this.customHashId = customHashId;
		// endregion
	}
}

class EncounterPartyMeta {
	constructor (arr) {
		this.levelMetas = []; // Array of `{level: x, count: y}`

		arr.forEach(it => {
			const existingLvl = this.levelMetas.find(x => x.level === it.level);
			if (existingLvl) existingLvl.count += it.count;
			else this.levelMetas.push({count: it.count, level: it.level})
		});

		this.cntPlayers = 0;
		this.avgPlayerLevel = 0;
		this.maxPlayerLevel = 0;

		this.threshEasy = 0;
		this.threshMedium = 0;
		this.threshHard = 0;
		this.threshDeadly = 0;
		this.threshAbsurd = 0;

		this.dailyBudget = 0;

		this.levelMetas.forEach(meta => {
			this.cntPlayers += meta.count;
			this.avgPlayerLevel += meta.level * meta.count;
			this.maxPlayerLevel = Math.max(this.maxPlayerLevel, meta.level);

			this.threshEasy += LEVEL_TO_XP_EASY[meta.level] * meta.count;
			this.threshMedium += LEVEL_TO_XP_MEDIUM[meta.level] * meta.count;
			this.threshHard += LEVEL_TO_XP_HARD[meta.level] * meta.count;
			this.threshDeadly += LEVEL_TO_XP_DEADLY[meta.level] * meta.count;

			this.dailyBudget += LEVEL_TO_XP_DAILY[meta.level] * meta.count;
		});
		if (this.avgPlayerLevel) this.avgPlayerLevel /= this.cntPlayers;

		this.threshAbsurd = this.threshDeadly + (this.threshDeadly - this.threshHard);
	}

	/** Return true if at least a third of the party is level 5+. */
	isPartyLevelFivePlus () {
		const [levelMetasHigher, levelMetasLower] = this.levelMetas.partition(it => it.level >= 5);
		const cntLower = levelMetasLower.map(it => it.count).reduce((a, b) => a + b, 0);
		const cntHigher = levelMetasHigher.map(it => it.count).reduce((a, b) => a + b, 0);
		return (cntHigher / (cntLower + cntHigher)) >= 0.333;
	}

	// Expose these as getters to ease factoring elsewhere
	get easy () { return this.threshEasy; }
	get medium () { return this.threshMedium; }
	get hard () { return this.threshHard; }
	get deadly () { return this.threshDeadly; }
	get absurd () { return this.threshAbsurd; }
}

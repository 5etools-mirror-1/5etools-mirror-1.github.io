"use strict";

class EncounterBuilderUtils {
	static getSublistedEncounter ({sublistItems}) {
		return sublistItems
			.map(li => {
				const mon = li.data.entityBase;
				if (!mon.cr) return null;

				// (N.b.: we don't handle scaled summon creatures here, as they *shouldn't* have CRs.)
				const crScaled = li.data.customHashId
					? Number(Renderer.monster.getUnpackedCustomHashId(li.data.customHashId)._scaledCr)
					: null;
				return {
					cr: li.values.cr,
					crNumber: Parser.crToNumber(li.values.cr),
					count: Number(li.data.count),

					approxHp: li.data.approxHp,
					approxAc: li.data.approxAc,

					isLocked: li.data.isLocked,

					// used for encounter adjuster
					crScaled: crScaled,
					customHashId: li.data.customHashId,
					hash: UrlUtil.autoEncodeHash(mon),
					baseCreature: mon,
				};
			})
			.filter(it => it && it.crNumber < VeCt.CR_CUSTOM)
			.sort((a, b) => SortUtil.ascSort(b.crNumber, a.crNumber));
	}

	static getCrCutoff (data, partyMeta) {
		data = data.filter(it => EncounterBuilderUtils.getCr(it) < VeCt.CR_CUSTOM).sort((a, b) => SortUtil.ascSort(EncounterBuilderUtils.getCr(b), EncounterBuilderUtils.getCr(a)));
		if (!data.length) return 0;

		// no cutoff for CR 0-2
		if (EncounterBuilderUtils.getCr(data[0]) <= 2) return 0;

		// ===============================================================================================================
		// "When making this calculation, don't count any monsters whose challenge rating is significantly below the average
		// challenge rating of the other monsters in the group unless you think the weak monsters significantly contribute
		// to the difficulty of the encounter." -- DMG, p. 82
		// ===============================================================================================================

		// "unless you think the weak monsters significantly contribute to the difficulty of the encounter"
		// For player levels <5, always include every monster. We assume that levels 5> will have strong
		//   AoE/multiattack, allowing trash to be quickly cleared.
		if (!partyMeta.isPartyLevelFivePlus()) return 0;

		// Spread the CRs into a single array
		const crValues = [];
		data.forEach(it => {
			const cr = EncounterBuilderUtils.getCr(it);
			for (let i = 0; i < it.count; ++i) crValues.push(cr);
		});

		// TODO(Future) allow this to be controlled by the user
		let CR_THRESH_MODE = "statisticallySignificant";

		switch (CR_THRESH_MODE) {
			// "Statistically significant" method--note that this produces very passive filtering; the threshold is below
			//   the minimum CR in the vast majority of cases.
			case "statisticallySignificant": {
				const cpy = MiscUtil.copy(crValues)
					.sort(SortUtil.ascSort);

				const avg = cpy.mean();
				const deviation = cpy.meanAbsoluteDeviation();

				return avg - (deviation * 2);
			}

			case "5etools": {
				// The ideal interpretation of this:
				//   "don't count any monsters whose challenge rating is significantly below the average
				//   challenge rating of the other monsters in the group"
				// Is:
				//   Arrange the creatures in CR order, lowest to highest. Remove the lowest CR creature (or one of them, if there
				//   are ties). Calculate the average CR without this removed creature. If the removed creature's CR is
				//   "significantly below" this average, repeat the process with the next lowest CR creature.
				// However, this can produce a stair-step pattern where our average CR keeps climbing as we remove more and more
				//   creatures. Therefore, only do this "remove creature -> calculate average CR" step _once_, and use the
				//   resulting average CR to calculate a cutoff.

				const crMetas = [];

				// If there's precisely one CR value, use it
				if (crValues.length === 1) {
					crMetas.push({
						mean: crValues[0],
						deviation: 0,
					});
				} else {
					// Get an average CR for every possible encounter without one of the creatures in the encounter
					for (let i = 0; i < crValues.length; ++i) {
						const crValueFilt = crValues.filter((_, j) => i !== j);
						const crMean = crValueFilt.mean();
						const crStdDev = Math.sqrt((1 / crValueFilt.length) * crValueFilt.map(it => (it - crMean) ** 2).reduce((a, b) => a + b, 0));
						crMetas.push({mean: crMean, deviation: crStdDev});
					}
				}

				// Sort by descending average CR -> ascending deviation
				crMetas.sort((a, b) => SortUtil.ascSort(b.mean, a.mean) || SortUtil.ascSort(a.deviation, b.deviation));

				// "significantly below the average" -> cutoff at half the average
				return crMetas[0].mean / 2;
			}

			default: return 0;
		}
	}

	/**
	 * @param data an array of {cr: n, count: m} objects
	 * @param partyMeta number of players in the party
	 */
	static calculateEncounterXp (data, partyMeta = null) {
		if (partyMeta == null) partyMeta = new EncounterPartyMeta([{level: 1, count: 1}]);

		data = data.filter(it => EncounterBuilderUtils.getCr(it) < VeCt.CR_CUSTOM)
			.sort((a, b) => SortUtil.ascSort(EncounterBuilderUtils.getCr(b), EncounterBuilderUtils.getCr(a)));

		let baseXp = 0;
		let relevantCount = 0;
		let count = 0;
		if (!data.length) return {baseXp: 0, relevantCount: 0, count: 0, adjustedXp: 0};

		const crCutoff = EncounterBuilderUtils.getCrCutoff(data, partyMeta);
		data.forEach(it => {
			if (EncounterBuilderUtils.getCr(it) >= crCutoff) relevantCount += it.count;
			count += it.count;
			baseXp += (Parser.crToXpNumber(Parser.numberToCr(EncounterBuilderUtils.getCr(it))) || 0) * it.count;
		});

		const playerAdjustedXpMult = Parser.numMonstersToXpMult(relevantCount, partyMeta.cntPlayers);

		const adjustedXp = playerAdjustedXpMult * baseXp;
		return {baseXp, relevantCount, count, adjustedXp, meta: {crCutoff, playerCount: partyMeta.cntPlayers, playerAdjustedXpMult}};
	}

	static getCr (obj) {
		if (obj.crScaled != null) return obj.crScaled;
		if (obj.cr == null || obj.cr === "Unknown" || obj.cr === "\u2014") return null;
		return typeof obj.cr === "string" ? obj.cr.includes("/") ? Parser.crToNumber(obj.cr) : Number(obj.cr) : obj.cr;
	}
}

/**
 * TODO rework this to use doubled multipliers for XP, so we avoid the 0.5x issue for 6+ party sizes. Then scale
 *   everything back down at the end.
 */
class EncounterBuilder extends ProxyBase {
	constructor () {
		super();

		this._bestiaryPage = null;
		this._sublistManager = null;

		this._cache = null;
		this._lastPartyMeta = null;
		this._lock = new VeLock();

		this._cachedTitle = null;

		this._infoHoverId = null;

		this._sublistPlugin = null;

		// region Elements
		this._$wrpRowsSimple = null;
		this._$wrpRowsAdvanced = null;
		this._$wrpHeadersAdvanced = null;
		this._$wrpFootersAdvanced = null;

		this._wrpRandomAndAdjust = null;
		this._wrpGroupAndDifficulty = null;

		this._$hrHasCreatures = null;
		this._$wrpDifficulty = null;
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

		this._collectionPlayersSimple = null;
		this._collectionColsExtraAdvanced = null;
		this._collectionPlayersAdvanced = null;
		// endregion
	}

	set bestiaryPage (val) {
		this._bestiaryPage = val;
		this._cache = new EncounterBuilder.Cache({bestiaryPage: val});
	}

	set sublistManager (val) {
		this._sublistManager = val;

		this._sublistPlugin = new EncounterBuilderSublistPlugin();
		this._sublistPlugin.encounterBuilder = this;
		this._sublistPlugin.sublistManager = val;

		this._sublistManager.addPlugin(this._sublistPlugin);
	}

	calculateListEncounterXp (partyMeta) {
		partyMeta = partyMeta || this._lastPartyMeta;

		return EncounterBuilderUtils.calculateEncounterXp(
			EncounterBuilderUtils.getSublistedEncounter({
				sublistItems: this._sublistManager.sublistItems,
			}),
			partyMeta,
		);
	}

	initUi () {
		// region Init elements
		this._wrpRandomAndAdjust = document.getElementById("wrp-encounterbuild-random-and-adjust");
		this._wrpSaveLoad = document.getElementById("ecgen__wrp-save-controls");
		this._wrpGroupAndDifficulty = document.getElementById("wrp-encounterbuild-group-and-difficulty");
		// endregion

		$(`#btn-encounterbuild`).click(() => Hist.setSubhash(EncounterBuilder.HASH_KEY, true));

		this._renderRandomAndAdjust();
		this._renderSaveLoad();
		this._renderGroupAndDifficulty();
		this._renderCollections();
		this._renderAddHooks();
	}

	_handleClickCopyAsText (evt) {
		let xpTotal = 0;
		const ptsCreature = this._sublistManager.sublistItems
			.sort((a, b) => SortUtil.ascSortLower(a.name, b.name))
			.map(it => {
				xpTotal += Parser.crToXpNumber(it.values.cr) * it.data.count;
				return `${it.data.count}× ${it.name}`;
			});
		const ptXp = `${xpTotal.toLocaleString()} XP`;

		if (evt.shiftKey) {
			MiscUtil.pCopyTextToClipboard([...ptsCreature, ptXp].join("\n")).then(null);
		} else {
			MiscUtil.pCopyTextToClipboard(`${ptsCreature.join(", ")} (${ptXp})`).then(null);
		}
		JqueryUtil.showCopiedEffect(evt.currentTarget);
	}

	_handleClickBackToStatblocks () {
		Hist.setSubhash(EncounterBuilder.HASH_KEY, null);
	}

	async _pGetLockedEncounterCreatures () {
		return EncounterBuilderUtils.getSublistedEncounter({
			sublistItems: this._sublistManager.sublistItems,
		})
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
	}

	_renderRandomAndAdjust () {
		const {
			$btnRandom,
			$btnRandomMode,
			$liRandomEasy,
			$liRandomMedium,
			$liRandomHard,
			$liRandomDeadly,
		} = this._renderRandomAndAdjust_getRandomMeta();

		const {
			$btnAdjust,
			$btnAdjustMode,
			$liAdjustEasy,
			$liAdjustMedium,
			$liAdjustHard,
			$liAdjustDeadly,
		} = this._renderRandomAndAdjust_getAdjustMeta();

		$$(this._wrpRandomAndAdjust)`<div class="ve-flex-col">
			<div class="ve-flex-h-right">
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

	_renderRandomAndAdjust_getRandomMeta () {
		let modeRandom = "medium";

		const pSetRandomMode = async (mode) => {
			const randomizer = new EncounterBuilder.Randomizer({
				partyMeta: this._getPartyMeta(),
				cache: this._cache,
			});
			const random = await randomizer.pGetRandomEncounter({
				difficulty: mode,
				lockedEncounterCreatures: await this._pGetLockedEncounterCreatures(),
			});

			if (random != null) {
				const nxtState = await this._sublistManager.pGetExportableSublist({isMemoryOnly: true});
				Object.assign(nxtState, random.getAsExportedSublistState());
				await this._sublistManager.pDoLoadExportedSublist(nxtState, {isMemoryOnly: true});
			}

			modeRandom = mode;
			$btnRandom
				.text(`Random ${mode.toTitleCase()}`)
				.title(`Randomly generate ${Parser.getArticle(mode)} ${mode.toTitleCase()} encounter`);
		};

		const $getLiRandom = (mode) => {
			return $(`<li title="Randomly generate ${Parser.getArticle(mode)} ${mode.toTitleCase()} encounter"><a href="#">Random ${mode.toTitleCase()}</a></li>`)
				.click(async (evt) => {
					evt.preventDefault();
					await pSetRandomMode(mode);
				});
		};

		const $btnRandom = $(`<button class="btn btn-primary" style="min-width: 135px;" title="Randomly generate a Medium encounter">Random Medium</button>`)
			.click(async evt => {
				evt.preventDefault();
				await pSetRandomMode(modeRandom);
			});

		const $btnRandomMode = $(`<button class="btn btn-primary dropdown-toggle"><span class="caret"></span></button>`);
		JqueryUtil.bindDropdownButton($btnRandomMode);

		return {
			$btnRandom,
			$btnRandomMode,
			$liRandomEasy: $getLiRandom("easy"),
			$liRandomMedium: $getLiRandom("medium"),
			$liRandomHard: $getLiRandom("hard"),
			$liRandomDeadly: $getLiRandom("deadly"),
		};
	}

	_renderRandomAndAdjust_getAdjustMeta () {
		let modeAdjust = "medium";

		const pSetAdjustMode = async (mode) => {
			const adjuster = new EncounterBuilder.Adjuster({
				partyMeta: this._getPartyMeta(),
			});
			const adjusted = await adjuster.pGetAdjustedEncounter({
				difficulty: mode,
				currentEncounter: EncounterBuilderUtils.getSublistedEncounter({
					sublistItems: this._sublistManager.sublistItems,
				}),
			});

			if (adjusted != null) {
				const nxtState = await this._sublistManager.pGetExportableSublist({isMemoryOnly: true});
				Object.assign(nxtState, adjusted.getAsExportedSublistState());
				await this._sublistManager.pDoLoadExportedSublist(nxtState, {isMemoryOnly: true});
			}

			modeAdjust = mode;
			$btnAdjust
				.text(`Adjust to ${mode.toTitleCase()}`)
				.title(`Adjust the current encounter difficulty to ${mode.toTitleCase()}`);
		};

		const $getLiAdjust = (mode) => {
			return $(`<li title="Adjust the current encounter difficulty to ${mode.toTitleCase()}"><a href="#">Adjust to ${mode.toTitleCase()}</a></li>`)
				.click(async (evt) => {
					evt.preventDefault();
					await pSetAdjustMode(mode);
				});
		};

		const $btnAdjust = $(`<button class="btn btn-primary" style="min-width: 135px;" title="Adjust the current encounter difficulty to Medium">Adjust to Medium</button>`)
			.click(async evt => {
				evt.preventDefault();
				await pSetAdjustMode(modeAdjust);
			});

		const $btnAdjustMode = $(`<button class="btn btn-primary dropdown-toggle"><span class="caret"></span></button>`);
		JqueryUtil.bindDropdownButton($btnAdjustMode);

		return {
			$btnAdjust,
			$btnAdjustMode,
			$liAdjustEasy: $getLiAdjust("easy"),
			$liAdjustMedium: $getLiAdjust("medium"),
			$liAdjustHard: $getLiAdjust("hard"),
			$liAdjustDeadly: $getLiAdjust("deadly"),
		};
	}

	_renderSaveLoad () {
		const $btnSave = $(`<button class="btn btn-default btn-xs">Save Encounter</button>`)
			.click(evt => this._sublistManager.pHandleClick_save(evt));

		const $btnLoad = $(`<button class="btn btn-default btn-xs">Load Encounter</button>`)
			.click(evt => this._sublistManager.pHandleClick_load(evt));

		$$(this._wrpSaveLoad)`<div class="ve-flex-col">
				<div class="ve-flex-h-right btn-group">
					${$btnSave}
					${$btnLoad}
			</div>
		</div>`;
	}

	_renderGroupAndDifficulty () {
		const $btnSaveToUrl = $(`<button class="btn btn-default btn-xs mr-2">Save to URL</button>`)
			.click(() => this._sublistManager.pHandleClick_download({isUrl: true, $eleCopyEffect: $btnSaveToUrl}));
		const $btnSaveToFile = $(`<button class="btn btn-default btn-xs">Save to File</button>`)
			.click(() => this._sublistManager.pHandleClick_download());
		const $btnLoadFromFile = $(`<button class="btn btn-default btn-xs">Load from File</button>`)
			.click(evt => this._sublistManager.pHandleClick_upload({isAdditive: evt.shiftKey}));
		const $btnCopyAsText = $(`<button class="btn btn-default btn-xs mr-2" title="SHIFT for Multi-Line Format">Copy as Text</button>`).click((evt) => this._handleClickCopyAsText(evt));
		const $btnReset = $(`<button class="btn btn-danger btn-xs" title="SHIFT to Reset Players">Reset</button>`)
			.click((evt) => this._sublistManager.pHandleClick_new(evt));

		const $btnBackToStatblocks = $(`<button class="btn btn-success btn-xs">Back to Stat Blocks</button>`).click((evt) => this._handleClickBackToStatblocks(evt));

		const {
			$stg: $stgSimple,
			$wrpRows: $wrpRowsSimple,
		} = this._renderGroupAndDifficulty_getGroupEles_simple();
		this._$wrpRowsSimple = $wrpRowsSimple;

		const {
			$stg: $stgAdvanced,
			$wrpRows: $wrpRowsAdvanced,
			$wrpHeaders: $wrpHeadersAdvanced,
			$wrpFooters: $wrpFootersAdvanced,
		} = this._renderGroupAndDifficulty_getGroupEles_advanced();
		this._$wrpRowsAdvanced = $wrpRowsAdvanced;
		this._$wrpHeadersAdvanced = $wrpHeadersAdvanced;
		this._$wrpFootersAdvanced = $wrpFootersAdvanced;

		this._$hrHasCreatures = $(`<hr class="hr-1">`);
		this._$wrpDifficulty = $$`<div class="ve-flex">
			${this._renderGroupAndDifficulty_$getDifficultyLhs()}
			${this._renderGroupAndDifficulty_$getDifficultyRhs()}
		</div>`;

		$$(this._wrpGroupAndDifficulty)`
		<h3 class="mt-1 m-2">Group Info</h3>
		<div class="ve-flex">
			${$stgSimple}
			${$stgAdvanced}
			${this._renderGroupAndDifficulty_$getGroupInfoRhs()}
		</div>

		${this._$hrHasCreatures}
		${this._$wrpDifficulty}

		<hr class="hr-1">

		<div class="ve-flex-v-center mb-2">
			${$btnSaveToUrl}
			<div class="btn-group ve-flex-v-center mr-2">
				${$btnSaveToFile}
				${$btnLoadFromFile}
			</div>
			${$btnCopyAsText}
			${$btnReset}
		</div>

		<div class="ve-flex">
			${$btnBackToStatblocks}
		</div>`;
	}

	_renderGroupAndDifficulty_getGroupEles_advanced () {
		const $btnAddPlayers = $(`<button class="btn btn-primary btn-xs"><span class="glyphicon glyphicon-plus"></span> Add Another Player</button>`)
			.click(() => this._sublistPlugin.doAddPlayer());

		const $btnAddAdvancedCol = $(`<button class="btn btn-primary btn-xxs ecgen-player__btn-inline h-ipt-xs bl-0 bb-0 bbl-0 bbr-0 btl-0 ml-n1" title="Add Column" tabindex="-1"><span class="glyphicon glyphicon-list-alt"></span></button>`)
			.click(() => this._sublistPlugin.doAddColExtraAdvanced());

		const $wrpHeaders = $(`<div class="ve-flex"></div>`);
		const $wrpFooters = $(`<div class="ve-flex"></div>`);

		const $wrpRows = $(`<div class="ve-flex-col"></div>`);

		const $stg = $$`<div class="w-70 overflow-x-auto ve-flex-col">
			<div class="ve-flex-h-center mb-2 bb-1p small-caps ve-self-flex-start">
				<div class="w-100p mr-1 h-ipt-xs no-shrink">Name</div>
				<div class="w-40p text-center mr-1 h-ipt-xs no-shrink">Level</div>
				${$wrpHeaders}
				${$btnAddAdvancedCol}
			</div>

			${$wrpRows}

			<div class="mb-1 ve-flex">
				<div class="ecgen__wrp_add_players_btn_wrp no-shrink no-grow">
					${$btnAddPlayers}
				</div>
				${$wrpFooters}
			</div>

			${this._renderGroupAndDifficulty_$getPtAdvancedMode()}

			<div class="row">
				<div class="w-100">
					${Renderer.get().render(`{@note Additional columns will be imported into the DM Screen.}`)}
				</div>
			</div>
		</div>`;

		const hkIsAdvanced = () => {
			$stg.toggleVe(this._sublistPlugin.isAdvanced);
		};
		this._sublistPlugin.addHookIsAdvanced(hkIsAdvanced);

		return {
			$stg,
			$wrpRows,
			$wrpHeaders,
			$wrpFooters,
		};
	}

	_renderGroupAndDifficulty_getGroupEles_simple () {
		const $btnAddPlayers = $(`<button class="btn btn-primary btn-xs"><span class="glyphicon glyphicon-plus"></span> Add Another Level</button>`)
			.click(() => this._sublistPlugin.doAddPlayer());

		const $wrpRows = $(`<div class="ve-flex-col w-100"></div>`);

		const $stg = $$`<div class="w-70 ve-flex-col">
			<div class="ve-flex">
				<div class="w-20">Players:</div>
				<div class="w-20">Level:</div>
			</div>

			${$wrpRows}

			<div class="mb-1 ve-flex">
				<div class="ecgen__wrp_add_players_btn_wrp">
					${$btnAddPlayers}
				</div>
			</div>

			${this._renderGroupAndDifficulty_$getPtAdvancedMode()}

		</div>`;

		const hkIsAdvanced = () => {
			$stg.toggleVe(!this._sublistPlugin.isAdvanced);
		};
		this._sublistPlugin.addHookIsAdvanced(hkIsAdvanced);

		return {
			$wrpRows,
			$stg,
		};
	}

	_renderGroupAndDifficulty_$getPtAdvancedMode () {
		const $cbAdvanced = ComponentUiUtil.$getCbBool(this._sublistPlugin, "isAdvanced");

		return $$`<div class="ve-flex-v-center">
			<label class="ve-flex-v-center">
				<div class="mr-2">Advanced Mode</div>
				${$cbAdvanced}
			</label>
		</div>`;
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
		</div>`;
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

		this._$hovXpAdjustedInfo = $(`<span class="glyphicon glyphicon-info-sign mr-2"></span>`);

		this._$dispXpAdjustedTotal = $(`<h4 class="ve-flex-v-center">Adjusted XP: ?</h4>`);
		this._$dispXpAdjustedPerPlayer = $(`<i>(? per player)</i>`);

		return $$`<div class="w-50 text-right">
			${this._$dispXpRawTotal}
			<div>${this._$dispXpRawPerPlayer}</div>
			<div class="ve-flex-v-center ve-flex-h-right">${this._$hovXpAdjustedInfo}${this._$dispXpAdjustedTotal}</div>
			<div>${this._$dispXpAdjustedPerPlayer}</div>
		</div>`;
	}

	_renderCollections () {
		this._collectionPlayersSimple = new EncounterBuilder.RenderableCollectionPlayersSimple({
			comp: this._sublistPlugin,
			$wrpRows: this._$wrpRowsSimple,
		});

		this._collectionColsExtraAdvanced = new EncounterBuilder.RenderableCollectionColsExtraAdvanced({
			comp: this._sublistPlugin,
			$wrpHeadersAdvanced: this._$wrpHeadersAdvanced,
			$wrpFootersAdvanced: this._$wrpFootersAdvanced,
		});

		this._collectionPlayersAdvanced = new EncounterBuilder.RenderableCollectionPlayersAdvanced({
			comp: this._sublistPlugin,
			$wrpRows: this._$wrpRowsAdvanced,
		});
	}

	_renderAddHooks () {
		const hkPlayersSimple = () => {
			this._collectionPlayersSimple.render();

			this.updateDifficulty();
		};
		this._sublistPlugin.addHookPlayersSimple(hkPlayersSimple);

		const hkPlayersAdvanced = () => {
			this._collectionPlayersAdvanced.render();

			this.updateDifficulty();
		};
		this._sublistPlugin.addHookPlayersAdvanced(hkPlayersAdvanced);

		const hkColsExtraAdvanced = () => {
			this._collectionColsExtraAdvanced.render();
		};
		this._sublistPlugin.addHookColsExtraAdvanced(hkColsExtraAdvanced);

		this._sublistPlugin.addHookIsAdvanced(hkPlayersSimple, {isCall: false});
		this._sublistPlugin.addHookIsAdvanced(hkPlayersAdvanced, {isCall: false});

		this._sublistPlugin.addHookPulseSublist(hkPlayersSimple, {isCall: false});
		this._sublistPlugin.addHookPulseSublist(hkPlayersAdvanced, {isCall: false});
	}

	resetCache () { this._cache.reset(); }

	isActive () {
		return Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true";
	}

	_showBuilder () {
		this._cachedTitle = this._cachedTitle || document.title;
		document.title = "Encounter Builder - 5etools";
		$(document.body).addClass("ecgen_active");
		this._bestiaryPage.doDeselectAll();
		this._sublistManager.doSublistDeselectAll();
	}

	_hideBuilder () {
		if (this._cachedTitle) {
			document.title = this._cachedTitle;
			this._cachedTitle = null;
		}
		$(document.body).removeClass("ecgen_active");
	}

	_handleClick ({evt, mode, entity}) {
		if (mode === "add") {
			return this._sublistManager.pDoSublistAdd({entity, doFinalize: true, addCount: evt.shiftKey ? 5 : 1});
		}

		return this._sublistManager.pDoSublistSubtract({entity, subtractCount: evt.shiftKey ? 5 : 1});
	}

	async _pHandleShuffleClick (ix) {
		await this._lock.pLock();

		try {
			const mon = this._bestiaryPage.dataList_[ix];
			const xp = Parser.crToXpNumber(mon.cr);
			if (!xp) return; // if Unknown/etc

			const curr = await this._sublistManager.pGetExportableSublist({isForceIncludePlugins: true, isMemoryOnly: true});
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

				await this._sublistManager.pDoLoadExportedSublist(curr, {isMemoryOnly: true});
			} // else can't reroll
		} finally {
			this._lock.unlock();
		}
	}

	handleSubhash () {
		if (Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true") this._showBuilder();
		else this._hideBuilder();
	}

	_getApproxTurnsToKill () {
		const party = this._getPartyMeta().levelMetas;
		if (!party.length) return 0;

		const encounter = EncounterBuilderUtils.getSublistedEncounter({
			sublistItems: this._sublistManager.sublistItems,
		});

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
		const encounter = this.calculateListEncounterXp(partyMeta);

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
					...(partyMeta.cntPlayers < 3
						? [
							{
								type: "quote",
								entries: [
									"If the party contains fewer than three characters, apply the next highest multiplier on the Encounter Multipliers table.",
								],
								"by": "{@book Dungeon Master's Guide, page 83|DMG|3|Party Size}",
							},
						]
						: partyMeta.cntPlayers >= 6
							? [
								{
									type: "quote",
									entries: [
										"If the party contains six or more characters, use the next lowest multiplier on the table. Use a multiplier of 0.5 for a single monster.",
									],
									"by": "{@book Dungeon Master's Guide, page 83|DMG|3|Party Size}",
								},
							]
							: []
					),
				],
			};

			if (this._infoHoverId == null) {
				const hoverMeta = Renderer.hover.getMakePredefinedHover(infoEntry, {isBookContent: true});
				this._infoHoverId = hoverMeta.id;

				this._$hovXpAdjustedInfo
					.off("mouseover")
					.off("mousemove")
					.off("mouseleave")
					.on("mouseover", function (event) { hoverMeta.mouseOver(event, this); })
					.on("mousemove", function (event) { hoverMeta.mouseMove(event, this); })
					.on("mouseleave", function (event) { hoverMeta.mouseLeave(event, this); });
			} else {
				Renderer.hover.updatePredefinedHover(this._infoHoverId, infoEntry);
			}

			this._$dispXpAdjustedTotal.html(`Adjusted XP <span class="ve-small ve-muted ml-2" title="XP Multiplier">(×${encounter.meta.playerAdjustedXpMult})</span>: ${encounter.adjustedXp.toLocaleString()}`);
			this._$dispXpAdjustedPerPlayer.text(`(${Math.floor(encounter.adjustedXp / partyMeta.cntPlayers).toLocaleString()} per player)`);
		} else {
			this._$hrHasCreatures.hideVe();
			this._$wrpDifficulty.hideVe();
		}
	}

	_getPartyMeta () {
		const out = new EncounterPartyMeta(this._sublistPlugin.getRawPartyMeta());
		this._lastPartyMeta = out;
		return out;
	}

	async doStatblockMouseOver ({evt, ele, source, hash, customHashId}) {
		return Renderer.hover.pHandleLinkMouseOver(
			evt,
			ele,
			{
				page: UrlUtil.PG_BESTIARY,
				source,
				hash,
				customHashId,
			},
		);
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

	async handleImageMouseOver (evt, $ele, mon) {
		// We'll rebuild the mouseover handler with whatever we load
		$ele.off("mouseover");

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

	async pDoCrChange ($iptCr, monScaled, scaledTo) {
		await this._lock.pLock();

		if (!$iptCr) return; // Should never occur, but if the creature has a non-adjustable CR, this field will not exist

		try {
			// Fetch original
			const mon = await DataLoader.pCacheAndGetHash(
				UrlUtil.PG_BESTIARY,
				UrlUtil.autoEncodeHash(monScaled),
			);

			const baseCr = mon.cr.cr || mon.cr;
			if (baseCr == null) return;
			const baseCrNum = Parser.crToNumber(baseCr);
			const targetCr = $iptCr.val();

			if (Parser.isValidCr(targetCr)) {
				const targetCrNum = Parser.crToNumber(targetCr);

				if (targetCrNum === scaledTo) return;

				const state = await this._sublistManager.pGetExportableSublist({isForceIncludePlugins: true, isMemoryOnly: true});
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

				await this._sublistManager.pDoLoadExportedSublist(state, {isMemoryOnly: true});
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
					click: evt => this._handleClick({evt, entity: this._bestiaryPage.dataList_[monId], mode: "add"}),
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
					click: evt => this._handleClick({evt, entity: this._bestiaryPage.dataList_[monId], mode: "subtract"}),
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
			.click(evt => this._handleClick({evt, entity: sublistItem.data.entity, mode: "add"}));

		const $btnSub = $(`<button title="Subtract (SHIFT for 5)" class="btn btn-danger btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-minus"></span></button>`)
			.click(evt => this._handleClick({evt, entity: sublistItem.data.entity, mode: "subtract"}));

		const $btnRandomize = $(`<button title="Randomize Monster" class="btn btn-default btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-random"></span></button>`)
			.click(() => this._pHandleShuffleClick(sublistItem.ix));

		const $btnLock = $(`<button title="Lock Monster against Randomizing/Adjusting" class="btn btn-default btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-lock"></span></button>`)
			.click(() => this._sublistManager.pSetDataEntry({sublistItem, key: "isLocked", value: !sublistItem.data.isLocked}))
			.toggleClass("active", sublistItem.data.isLocked);

		const $wrp = $$`<span class="ecgen__visible col-1-5 no-wrap pl-0 btn-group">
			${$btnAdd}
			${$btnSub}
			${$btnRandomize}
			${$btnLock}
		</span>`
			.click(evt => {
				evt.preventDefault();
				evt.stopPropagation();
			});

		return {
			$wrp,
			fnUpdate: () => $btnLock.toggleClass("active", sublistItem.data.isLocked),
		};
	}
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

EncounterBuilder.RenderableCollectionPlayersSimple = class extends RenderableCollectionBase {
	constructor (
		{
			comp,

			$wrpRows,
		},
	) {
		super(comp, "playersSimple");
		this._$wrpRows = $wrpRows;
	}

	getNewRender (playerGroup, i) {
		playerGroup.entity.count = playerGroup.entity.count || 1;
		playerGroup.entity.level = playerGroup.entity.level || 1;

		const comp = BaseComponent.fromObject(playerGroup.entity, "*");
		comp._addHookAll("state", () => {
			this._getCollectionItem(playerGroup.id).entity = comp.toObject("*");
			this._comp._triggerCollectionUpdate("playersSimple");
		});

		const $selCount = ComponentUiUtil.$getSelEnum(
			comp,
			"count",
			{
				values: [...new Array(12)].map((_, i) => i + 1),
			},
		).addClass("form-control--minimal no-shrink");

		const $selLevel = ComponentUiUtil.$getSelEnum(
			comp,
			"level",
			{
				values: [...new Array(20)].map((_, i) => i + 1),
			},
		).addClass("form-control--minimal no-shrink bl-0");

		const $btnRemove = $(`<button class="btn btn-danger btn-xxs ecgen-player__btn-inline h-ipt-xs no-shrink bl-0 bbl-0 btl-0" title="Remove Player Group" tabindex="-1"><span class="glyphicon glyphicon-trash"></span></button>`)
			.click(() => {
				this._comp.playersSimple = this._comp.playersSimple.filter(it => it.id !== playerGroup.id);
			});

		const $wrpRow = $$`<div class="ve-flex-v-center mb-2 ecgen-player__wrp-row">
			<div class="w-20">${$selCount}</div>
			<div class="w-20">${$selLevel}</div>
			<div class="ve-flex-v-center">${$btnRemove}</div>
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, playerGroup, i) {
		renderedMeta.comp._proxyAssignSimple("state", playerGroup.entity, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
};

EncounterBuilder.RenderableCollectionColsExtraAdvanced = class extends RenderableCollectionBase {
	constructor (
		{
			comp,

			$wrpHeadersAdvanced,
			$wrpFootersAdvanced,
		},
	) {
		super(comp, "colsExtraAdvanced");

		this._$wrpHeadersAdvanced = $wrpHeadersAdvanced;
		this._$wrpFootersAdvanced = $wrpFootersAdvanced;
	}

	getNewRender (colExtra, i) {
		const comp = BaseComponent.fromObject(colExtra.entity, "*");
		comp._addHookAll("state", () => {
			this._getCollectionItem(colExtra.id).entity = comp.toObject("*");
			this._comp._triggerCollectionUpdate("colsExtraAdvanced");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name")
			.addClass("w-40p form-control--minimal no-shrink text-center mr-1 bb-0");

		const $wrpHeader = $$`<div class="ve-flex">
			${$iptName}
		</div>`
			.appendTo(this._$wrpHeadersAdvanced);

		const $btnDelete = $(`<button class="btn btn-xxs ecgen-player__btn-inline w-40p btn-danger no-shrink mt-n2 bt-0 btl-0 btr-0" title="Remove Column" tabindex="-1"><span class="glyphicon-trash glyphicon"></span></button>`)
			.click(() => this._comp.doRemoveColExtraAdvanced(colExtra.id));

		const $wrpFooter = $$`<div class="w-40p ve-flex-v-baseline ve-flex-h-center no-shrink no-grow mr-1">
			${$btnDelete}
		</div>`
			.appendTo(this._$wrpFootersAdvanced);

		return {
			comp,
			$wrpHeader,
			$wrpFooter,
			fmRemoveEles: () => {
				$wrpHeader.remove();
				$wrpFooter.remove();
			},
		};
	}

	doUpdateExistingRender (renderedMeta, colExtra, i) {
		renderedMeta.comp._proxyAssignSimple("state", colExtra.entity, true);
		if (!renderedMeta.$wrpHeader.parent().is(this._$wrpHeadersAdvanced)) renderedMeta.$wrpHeader.appendTo(this._$wrpHeadersAdvanced);
		if (!renderedMeta.$wrpFooter.parent().is(this._$wrpFootersAdvanced)) renderedMeta.$wrpFooter.appendTo(this._$wrpFootersAdvanced);
	}
};

EncounterBuilder.RenderableCollectionPlayersAdvanced = class extends RenderableCollectionBase {
	constructor (
		{
			comp,

			$wrpRows,
		},
	) {
		super(comp, "playersAdvanced");
		this._$wrpRows = $wrpRows;
	}

	getNewRender (player, i) {
		player.entity.name = player.entity.name || "";
		player.entity.level = player.entity.level || 1;
		player.entity.extraCols = player.entity.extraCols || this._comp.colsExtraAdvanced.map(() => "");

		const comp = BaseComponent.fromObject(player.entity, "*");
		comp._addHookAll("state", () => {
			this._getCollectionItem(player.id).entity = comp.toObject("*");
			this._comp._triggerCollectionUpdate("playersAdvanced");
		});

		const $iptName = ComponentUiUtil.$getIptStr(comp, "name")
			.addClass(`w-100p form-control--minimal no-shrink mr-1`);

		const $iptLevel = ComponentUiUtil.$getIptInt(
			comp,
			"level",
			1,
			{
				min: 1,
				max: 20,
				fallbackOnNaN: 1,
			},
		).addClass("w-40p form-control--minimal no-shrink mr-1 text-center");

		const $wrpIptsExtra = $(`<div class="ve-flex-v-center"></div>`);
		const collectionExtras = new EncounterBuilder.RenderableCollectionPlayerAdvancedExtras({
			comp,
			$wrpIptsExtra,
		});
		const hkExtras = () => collectionExtras.render();
		comp._addHookBase("extras", hkExtras);
		hkExtras();

		const $btnRemove = $(`<button class="btn btn-danger btn-xxs ecgen-player__btn-inline h-ipt-xs no-shrink ml-n1 bl-0 bbl-0 btl-0" title="Remove Player" tabindex="-1"><span class="glyphicon glyphicon-trash"></span></button>`)
			.click(() => {
				this._comp.playersAdvanced = this._comp.playersAdvanced.filter(it => it.id !== player.id);
			});

		const $wrpRow = $$`<div class="ve-flex-v-center mb-2 ecgen-player__wrp-row">
			${$iptName}
			${$iptLevel}
			${$wrpIptsExtra}
			${$btnRemove}
		</div>`.appendTo(this._$wrpRows);

		return {
			comp,
			$wrpRow,
			$wrpIptsExtra,
		};
	}

	doUpdateExistingRender (renderedMeta, player, i) {
		renderedMeta.comp._proxyAssignSimple("state", player.entity, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpRows)) renderedMeta.$wrpRow.appendTo(this._$wrpRows);
	}
};

EncounterBuilder.RenderableCollectionPlayerAdvancedExtras = class extends RenderableCollectionBase {
	constructor (
		{
			comp,

			$wrpIptsExtra,
		},
	) {
		super(comp, "extras");
		this._$wrpIptsExtra = $wrpIptsExtra;
	}

	getNewRender (extra, i) {
		const comp = BaseComponent.fromObject(extra.entity, "*");
		comp._addHookAll("state", () => {
			this._getCollectionItem(extra.id).entity = comp.toObject("*");
			this._comp._triggerCollectionUpdate("extras");
		});

		const $iptVal = ComponentUiUtil.$getIptStr(comp, "value")
			.addClass(`w-40p no-shrink form-control--minimal text-center mr-1`);

		const $wrpRow = $$`<div class="ve-flex-v-h-center">
			${$iptVal}
		</div>`
			.appendTo(this._$wrpIptsExtra);

		return {
			comp,
			$wrpRow,
		};
	}

	doUpdateExistingRender (renderedMeta, extra, i) {
		renderedMeta.comp._proxyAssignSimple("state", extra.entity, true);
		if (!renderedMeta.$wrpRow.parent().is(this._$wrpIptsExtra)) renderedMeta.$wrpRow.appendTo(this._$wrpIptsExtra);
	}
};

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
};

EncounterBuilder.Adjuster = class {
	static _INCOMPLETE_EXHAUSTED = 0;
	static _INCOMPLETE_FAILED = -1;
	static _COMPLETE = 1;

	constructor ({partyMeta}) {
		this._partyMeta = partyMeta;
	}

	async pGetAdjustedEncounter ({difficulty, currentEncounter}) {
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
						const xp = EncounterBuilderUtils.calculateEncounterXp(soln, this._partyMeta);
						if (xp > targetMax) return xp - targetMax;
						else if (xp < targetMin) return targetMin - xp;
						else return 0;
					})(),
				}))
				.sort((a, b) => SortUtil.ascSort(a.distance, b.distance))[0].encounter;
		}

		// do a post-step to randomly bulk out our counts of "irrelevant" creatures, ensuring plenty of fireball fodder
		this._pGetAdjustedEncounter_doIncreaseIrrelevantCreatureCount({currentEncounter, crCutoff, targetMax});

		return new EncounterBuilder.AdjustedEncounter({currentEncounter});
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
				if (EncounterBuilderUtils.calculateEncounterXp(currentEncounter, this._partyMeta).adjustedXp > targetMax) {
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
};

// TODO use this earlier in the adjuster
EncounterBuilder.AdjustedEncounter = class {
	constructor ({currentEncounter}) {
		this._currentEncounter = currentEncounter;
	}

	getAsExportedSublistState () {
		return {
			items: this._currentEncounter.map(creatureMeta => ({
				h: creatureMeta.hash,
				c: `${creatureMeta.count}`,
				customHashId: creatureMeta.customHashId || undefined,
				l: creatureMeta.isLocked,
			})),
		};
	}
};

EncounterBuilder.Randomizer = class {
	static _NUM_SAMPLES = 20;

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

	async pGetRandomEncounter ({difficulty, lockedEncounterCreatures}) {
		const ixLow = EncounterBuilder.TIERS.indexOf(difficulty);
		if (!~ixLow) throw new Error(`Unhandled difficulty level: "${difficulty}"`);

		const budget = this._partyMeta[EncounterBuilder.TIERS[ixLow + 1]] - 1;

		const closestSolution = this._pDoGenerateEncounter_getSolution({budget, lockedEncounterCreatures});

		if (!closestSolution) {
			JqueryUtil.doToast({content: `Failed to generate a valid encounter within the provided parameters!`, type: "warning"});
			return;
		}

		return closestSolution;
	}

	_pDoGenerateEncounter_getSolution ({budget, lockedEncounterCreatures}) {
		const solutions = this._pDoGenerateEncounter_getSolutions({budget, lockedEncounterCreatures});
		const validSolutions = solutions.filter(it => this._isValidEncounter({candidateEncounter: it, budget}));
		if (validSolutions.length) return RollerUtil.rollOnArray(validSolutions);
		return null;
	}

	_pDoGenerateEncounter_getSolutions ({budget, lockedEncounterCreatures}) {
		// If there are enough players that single-monster XP is halved, generate twice as many solutions, half with double XP cap
		if (this._partyMeta.cntPlayers >= 6) {
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
		return encounterXp.adjustedXp >= (budget * 0.6) && encounterXp.adjustedXp <= (budget * 1.1);
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
};

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

	getAsExportedSublistState () {
		const toLoad = {items: []};
		const sources = new Set();
		this.creatures
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
};

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
};

class EncounterPartyMeta {
	constructor (arr) {
		this.levelMetas = []; // Array of `{level: x, count: y}`

		arr.forEach(it => {
			const existingLvl = this.levelMetas.find(x => x.level === it.level);
			if (existingLvl) existingLvl.count += it.count;
			else this.levelMetas.push({count: it.count, level: it.level});
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

			this.threshEasy += Parser.LEVEL_TO_XP_EASY[meta.level] * meta.count;
			this.threshMedium += Parser.LEVEL_TO_XP_MEDIUM[meta.level] * meta.count;
			this.threshHard += Parser.LEVEL_TO_XP_HARD[meta.level] * meta.count;
			this.threshDeadly += Parser.LEVEL_TO_XP_DEADLY[meta.level] * meta.count;

			this.dailyBudget += Parser.LEVEL_TO_XP_DAILY[meta.level] * meta.count;
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

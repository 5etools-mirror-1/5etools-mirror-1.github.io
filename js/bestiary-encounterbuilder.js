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
		this._cache = null;
		this._lastPartyMeta = null;
		this._advanced = false;
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
	}

	initUi () {
		$(`#btn-encounterbuild`).click(() => Hist.setSubhash(EncounterBuilder.HASH_KEY, true));
		$(`#btn-encounterstatblock`).click(() => Hist.setSubhash(EncounterBuilder.HASH_KEY, null));

		this._initRandomHandlers();
		this._initAdjustHandlers();

		$(`.ecgen__add_players`).click(() => {
			if (this._advanced) this.addAdvancedPlayerRow(false);
			else this.addPlayerRow(false)
		});

		const $cbAdvanced = $(`.ecgen__players_advanced`).change(() => {
			const party = this.getPartyMeta();
			this._advanced = !!$cbAdvanced.prop("checked");
			if (this._advanced) {
				let first = true;
				party.levelMetas.forEach(it => {
					[...new Array(it.count)].forEach(() => {
						this.addAdvancedPlayerRow(first, false, "", it.level);
						first = false;
					});
				});
				$(`.ecgen__player_group`).remove();
				this.updateDifficulty();
			} else {
				let first = true;
				party.levelMetas.forEach(it => {
					this.addPlayerRow(first, false, it.count, it.level);
					first = false;
				});
				$(`.ecgen__player_advanced`).remove();
				this.updateDifficulty();
			}
			this.updateUiIsAdvanced(this._advanced);
		});

		const $btnSvUrl = $(`.ecgen__sv_url`).click(async () => {
			const encounterPart = UrlUtil.packSubHash(EncounterUtil.SUB_HASH_PREFIX, [JSON.stringify(this.getSaveableState())], {isEncodeBoth: true});
			const parts = [location.href, encounterPart];
			await MiscUtil.pCopyTextToClipboard(parts.join(HASH_PART_SEP));
			JqueryUtil.showCopiedEffect($btnSvUrl);
		});
		$(`.ecgen__sv_file`).click(() => DataUtil.userDownload(`encounter`, this.getSaveableState(), {fileType: "encounter"}));
		$(`.ecgen__ld_file`).click(async () => {
			const {jsons, errors} = await DataUtil.pUserUpload({expectedFileType: "encounter"});

			DataUtil.doHandleFileLoadErrorsGeneric(errors);

			if (jsons?.length && jsons[0].items && jsons[0].sources) { // if it's a bestiary sublist
				jsons.l = {
					items: jsons.items,
					sources: jsons.sources,
				}
			}
			this.pDoLoadState(jsons[0]);
		});
		$(`.ecgen__reset`).title(`SHIFT-click to reset players`).click(evt => confirm("Are you sure?") && encounterBuilder.pReset({isNotResetPlayers: !evt.shiftKey, isNotAddInitialPlayers: !evt.shiftKey}));

		const $btnSvTxt = $(`.ecgen__sv_text`).click(() => {
			let xpTotal = 0;
			const toCopyCreatures = ListUtil.sublist.items
				.map(it => ({name: it.name, ...it.values}))
				.sort((a, b) => SortUtil.ascSortLower(a.name, b.name))
				.map(it => {
					xpTotal += Parser.crToXpNumber(it.cr) * it.count;
					return `${it.count}× ${it.name}`;
				})
				.join(", ");
			MiscUtil.pCopyTextToClipboard(`${toCopyCreatures} (${xpTotal.toLocaleString()} XP)`);
			JqueryUtil.showCopiedEffect($btnSvTxt);
		});
	}

	_initRandomHandlers () {
		JqueryUtil.bindDropdownButton($(`#ecgen_dropdown_rng`));

		const $btnGen = $(`.ecgen_rng`).click((evt) => {
			evt.preventDefault();
			this.pDoGenerateEncounter($btnGen.data("mode"))
		});

		$(`.ecgen_rng_easy`).click((evt) => {
			evt.preventDefault();
			this.pDoGenerateEncounter("easy");
			$btnGen.data("mode", "easy").text("Random Easy").title("Randomly generate an Easy encounter");
		});
		$(`.ecgen_rng_medium`).click((evt) => {
			evt.preventDefault();
			this.pDoGenerateEncounter("medium");
			$btnGen.data("mode", "medium").text("Random Medium").title("Randomly generate a Medium encounter");
		});
		$(`.ecgen_rng_hard`).click((evt) => {
			evt.preventDefault();
			this.pDoGenerateEncounter("hard");
			$btnGen.data("mode", "hard").text("Random Hard").title("Randomly generate a Hard encounter");
		});
		$(`.ecgen_rng_deadly`).click((evt) => {
			evt.preventDefault();
			this.pDoGenerateEncounter("deadly");
			$btnGen.data("mode", "deadly").text("Random Deadly").title("Randomly generate a Deadly encounter");
		});
	}

	_initAdjustHandlers () {
		JqueryUtil.bindDropdownButton($(`#ecgen_dropdown_adj`));

		const $btnAdjust = $(`.ecgen_adj`).click((evt) => {
			evt.preventDefault();
			this.pDoAdjustEncounter($btnAdjust.data("mode"))
		});

		$(`.ecgen_adj_easy`).click((evt) => {
			evt.preventDefault();
			this.pDoAdjustEncounter("easy");
			$btnAdjust.data("mode", "easy").text("Adjust to Easy").title("Adjust the current encounter difficulty to Easy");
		});
		$(`.ecgen_adj_medium`).click((evt) => {
			evt.preventDefault();
			this.pDoAdjustEncounter("medium");
			$btnAdjust.data("mode", "medium").text("Adjust to Medium").title("Adjust the current encounter difficulty to Medium");
		});
		$(`.ecgen_adj_hard`).click((evt) => {
			evt.preventDefault();
			this.pDoAdjustEncounter("hard");
			$btnAdjust.data("mode", "hard").text("Adjust to Hard").title("Adjust the current encounter difficulty to Hard");
		});
		$(`.ecgen_adj_deadly`).click((evt) => {
			evt.preventDefault();
			this.pDoAdjustEncounter("deadly");
			$btnAdjust.data("mode", "deadly").text("Adjust to Deadly").title("Adjust the current encounter difficulty to Deadly");
		});
	}

	updateUiIsAdvanced () {
		$(`.ecgen__players_advanced`).prop("checked", this._advanced);
		$(`.ecgen__player_advanced_extra_head `).remove();
		$(`.ecgen__player_advanced_extra_foot`).remove();
		if (this._advanced) {
			$(`.ecgen__add_players`).html(`<span class="glyphicon glyphicon-plus"></span> Add Another Player`);
			$(`.ecgen__group_lhs`).addClass(`ecgen__group_lhs--advanced`);
			$(`.ecgen__advanced_help`).show();
		} else {
			$(`.ecgen__add_players`).html(`<span class="glyphicon glyphicon-plus"></span> Add Another Level`);
			$(`.ecgen__group_lhs`).removeClass(`ecgen__group_lhs--advanced`);
			$(`.ecgen__advanced_help`).hide();
		}
	}

	async initState () {
		const initialState = await EncounterUtil.pGetInitialState();
		if (initialState && initialState.data) await this.pDoLoadState(initialState.data, initialState.type === "local");
		else this.addInitialPlayerRows();
		this.stateInit = true;
		await this._initSavedEncounters();
	}

	addInitialPlayerRows (first) {
		if (this._advanced) this.addAdvancedPlayerRow(first);
		else this.addPlayerRow(first, true, ECGEN_BASE_PLAYERS);
	}

	/**
	 * @param [opts] Options object
	 * @param [opts.isNotRemoveCreatures] If creature rows should not be removed.
	 * @param [opts.isNotResetPlayers] If player info should not be reset.
	 * @param [opts.isNotAddInitialPlayers] If initial player info should not be added.
	 */
	async pReset (opts) {
		opts = opts || {};
		if (!opts.isNotRemoveCreatures) await ListUtil.pDoSublistRemoveAll();
		if (!opts.isNotResetPlayers) this.removeAllPlayerRows();
		if (!opts.isNotAddInitialPlayers) this.addInitialPlayerRows();

		this._state.activeKey = null;
		this.pSetSavedEncountersThrottled();
	}

	async pDoLoadState (savedState, playersOnly) {
		await this.pReset({isNotAddInitialPlayers: true, isNotRemoveCreatures: playersOnly});
		if (!savedState) return;
		try {
			if (savedState.a) {
				this._advanced = true;
				this.updateUiIsAdvanced();
				if (savedState.d && savedState.d.length) {
					savedState.d.forEach((details, i) => this.addAdvancedPlayerRow(!i, false, details.n, details.l, details.x));
				} else this.addInitialPlayerRows(false);

				if (savedState.c && savedState.c.length) {
					savedState.c.forEach(col => {
						this.addAdvancedColumnHeader(col);
						this.addAdvancedColumnFooter();
					});
				}
			} else {
				if (savedState.p && savedState.p.length) {
					savedState.p.forEach(({count, level}, i) => this.addPlayerRow(!i, false, count, level));
				} else this.addInitialPlayerRows(false);
			}

			if (savedState.l && !playersOnly) {
				await this._bestiaryPage.pPreloadSublistSources(savedState.l);
				await ListUtil.pDoJsonLoad(savedState.l, false);
			}

			this.updateDifficulty();
		} catch (e) {
			JqueryUtil.doToast({content: `Could not load encounter! Was the file valid?`, type: "danger"});
			this.pReset();
		}
	}

	getSaveableState () {
		const out = {
			p: this.getPartyMeta().levelMetas,
			l: ListUtil.getExportableSublist(),
			a: this._advanced,
		};
		if (this._advanced) {
			out.c = $(`.ecgen__players_head_advanced`).find(`.ecgen__player_advanced_extra_head`).map((i, e) => $(e).val()).get();
			out.d = $(`.ecgen__player_advanced`).map((i, e) => {
				const $e = $(e);
				const extras = $e.find(`.ecgen__player_advanced_extra`).map((i, e) => $(e).val()).get();
				while (extras.length < out.c.length) extras.push(""); // pad array to match columns length

				return {
					n: $e.find(`.ecgen__player_advanced__name`).val(),
					l: Number($e.find(`.ecgen__player_advanced__level`).val()),
					x: extras.slice(0, out.c.length), // cap at columns length
				};
			}).get();
		}
		return out;
	}

	doSaveState () {
		if (this.stateInit) EncounterUtil.pDoSaveState(this.getSaveableState());
	}

	generateCache () {
		// create a map of {XP: [monster list]}
		if (this._cache == null) {
			this._cache = (() => {
				const out = {};
				bestiaryPage._list.visibleItems.map(it => bestiaryPage._dataList[it.ix]).filter(m => !m.isNpc).forEach(m => {
					const mXp = Parser.crToXpNumber(m.cr);
					if (mXp) (out[mXp] = out[mXp] || []).push(m);
				});
				return out;
			})();
		}
	}

	resetCache () {
		this._cache = null;
	}

	async pDoAdjustEncounter (difficulty) {
		let currentEncounter = EncounterBuilderUtils.getSublistedEncounter();
		if (!currentEncounter.length) {
			return JqueryUtil.doToast({content: `The current encounter contained no creatures! Please add some first.`, type: "warning"})
		}
		currentEncounter.forEach(creatureType => creatureType.count = 1);

		const partyMeta = this.getPartyMeta();
		let encounterXp = EncounterBuilderUtils.calculateEncounterXp(currentEncounter, partyMeta.cntPlayers);

		const ixLow = EncounterBuilder.TIERS.indexOf(difficulty);
		if (!~ixLow) throw new Error(`Unhandled difficulty level: "${difficulty}"`);
		// fudge min/max numbers slightly
		const [targetMin, targetMax] = [
			Math.floor(partyMeta[EncounterBuilder.TIERS[ixLow]] * 0.9),
			Math.ceil((partyMeta[EncounterBuilder.TIERS[ixLow + 1]] - 1) * 1.1),
		];

		if (encounterXp.adjustedXp > targetMax) {
			JqueryUtil.doToast({content: `Could not adjust the current encounter to ${difficulty.uppercaseFirst()}, try removing some creatures!`, type: "danger"})
		} else {
			// only calculate this once rather than during the loop, to ensure stable conditions
			// less accurate in some cases, but should prevent infinite loops
			const crCutoff = EncounterBuilderUtils.getCrCutoff(currentEncounter, partyMeta);

			// randomly choose creatures to skip
			// generate array of [0, 1, ... n-1] where n = number of unique creatures
			// this will be used to determine how many of the unique creatures we want to skip
			const numSkipTotals = [...new Array(currentEncounter.length)].map((_, ix) => ix);

			const doTryAdjusting = () => {
				if (!numSkipTotals.length) return -1; // no solution possible, so exit loop

				let skipIx = 0;
				// 7/12 * 7/12 * ... chance of moving the skipIx along one
				while (!(RollerUtil.randomise(12) > 7) && skipIx < numSkipTotals.length - 1) skipIx++;

				const numSkips = numSkipTotals.splice(skipIx, 1)[0]; // remove the selected skip amount; we'll try the others if this one fails
				const curUniqueCreatures = [...currentEncounter];
				if (numSkips) {
					[...new Array(numSkips)].forEach(() => {
						const ixRemove = RollerUtil.randomise(curUniqueCreatures.length) - 1;
						curUniqueCreatures.splice(ixRemove, 1);
					});
				}

				let maxTries = 999;
				while (!(encounterXp.adjustedXp > targetMin && encounterXp.adjustedXp < targetMax) && maxTries-- > 0) {
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
						encounterXp = EncounterBuilderUtils.calculateEncounterXp(currentEncounter, partyMeta.cntPlayers);
						if (encounterXp.adjustedXp > targetMax) {
							picked.count--;
							encounterXp = EncounterBuilderUtils.calculateEncounterXp(currentEncounter, partyMeta.cntPlayers);
						}
					}
				}

				return maxTries < 0 ? 0 : 1; // 1 if a solution was found, 0 otherwise
			};

			const invalidSolutions = [];
			let lastSolution;
			while (!(lastSolution = doTryAdjusting())) { // -1/1 = complete; 0 = continue
				invalidSolutions.push(MiscUtil.copy(currentEncounter));
				currentEncounter.forEach(it => it.count = 1); // reset for next attempt
			}

			// no good solution was found, so pick the closest invalid solution
			if (lastSolution === -1 && invalidSolutions.length) {
				currentEncounter = invalidSolutions.map(is => ({
					encounter: is,
					distance: (() => {
						const xp = EncounterBuilderUtils.calculateEncounterXp(is, partyMeta.cntPlayers);
						if (xp > targetMax) return xp - targetMax;
						else if (xp < targetMin) return targetMin - xp;
						else return 0;
					})(),
				})).sort((a, b) => SortUtil.ascSort(a.distance, b.distance))[0].encounter;
			}

			const belowCrCutoff = currentEncounter.filter(it => it.cr && it.cr < crCutoff);

			if (belowCrCutoff.length) {
				// do a post-step to randomly add "irrelevant" creatures, ensuring plenty of fireball fodder
				let budget = targetMax - encounterXp.adjustedXp;
				if (budget > 0) {
					belowCrCutoff.forEach(it => it._xp = Parser.crToXpNumber(Parser.numberToCr(it.cr)));
					const usable = belowCrCutoff.filter(it => it._xp < budget);

					if (usable.length) {
						const totalPlayers = partyMeta.levelMetas.map(it => it.count).reduce((a, b) => a + b, 0);
						const averagePlayerLevel = partyMeta.levelMetas.map(it => it.level * it.count).reduce((a, b) => a + b, 0) / totalPlayers;

						// try to avoid flooding low-level parties
						const playerToCreatureRatio = (() => {
							if (averagePlayerLevel < 5) return [0.8, 1.3];
							else if (averagePlayerLevel < 11) return [1, 2];
							else if (averagePlayerLevel < 17) return [1, 3];
							else return [1, 4];
						})();

						const [minDesired, maxDesired] = [Math.floor(playerToCreatureRatio[0] * totalPlayers), Math.ceil(playerToCreatureRatio[1] * totalPlayers)];

						// keep rolling until we fail to add a creature, or until we're out of budget
						while (encounterXp.adjustedXp <= targetMax) {
							const totalCreatures = currentEncounter.map(it => it.count).reduce((a, b) => a + b, 0);

							// if there's less than min desired, large chance of adding more
							// if there's more than max desired, small chance of adding more
							// if there's between min and max desired, medium chance of adding more
							const chanceToAdd = totalCreatures < minDesired ? 90 : totalCreatures > maxDesired ? 40 : 75;

							const isAdd = RollerUtil.roll(100) < chanceToAdd;
							if (isAdd) {
								RollerUtil.rollOnArray(belowCrCutoff).count++;
								encounterXp = EncounterBuilderUtils.calculateEncounterXp(currentEncounter, partyMeta.cntPlayers);
							} else break;
						}
					}
				}
			}
		}

		await this._pLoadSublist({
			items: currentEncounter.map(creatureType => ({
				h: creatureType.hash,
				c: `${creatureType.count}`,
				customHashId: creatureType.customHashId || undefined,
			})),
			sources: ListUtil.getExportableSublist().sources,
		});
	}

	async pDoGenerateEncounter (difficulty) {
		const {partyMeta} = this.calculateXp();

		const ixLow = EncounterBuilder.TIERS.indexOf(difficulty);
		if (!~ixLow) throw new Error(`Unhandled difficulty level: "${difficulty}"`);
		const budget = partyMeta[EncounterBuilder.TIERS[ixLow + 1]] - 1;

		this.generateCache();

		const closestSolution = (() => {
			// If there are enough players that single-monster XP is halved, try generating a range of solutions.
			if (partyMeta.cntPlayers > 5) {
				const NUM_SAMPLES = 10; // should ideally be divisible by 2
				const solutions = [...new Array(NUM_SAMPLES)]
					.map((_, i) => this._pDoGenerateEncounter_generateClosestEncounter(partyMeta, budget * ((i >= Math.floor(NUM_SAMPLES / 2)) + 1), budget));
				const validSolutions = solutions.filter(it => it.adjustedXp >= (budget * 0.6) && it.adjustedXp <= (budget * 1.1));
				if (validSolutions.length) return RollerUtil.rollOnArray(validSolutions);
				return null;
			} else return this._pDoGenerateEncounter_generateClosestEncounter(partyMeta, budget, budget);
		})();

		if (closestSolution) {
			const toLoad = {items: []};
			const sources = new Set();
			closestSolution.encounter.forEach(it => {
				toLoad.items.push({h: UrlUtil.autoEncodeHash(it.mon), c: String(it.count)});
				sources.add(it.mon.source);
			});
			toLoad.sources = [...sources];
			await this._pLoadSublist(toLoad);
		} else {
			await ListUtil.pDoSublistRemoveAll();
			this.updateDifficulty();
		}
	}

	_pDoGenerateEncounter_generateClosestEncounter (partyMeta, budget, rawBudget) {
		const _xps = Object.keys(this._cache).map(it => Number(it)).sort(SortUtil.ascSort).reverse();
		/*
		Sorted array of:
		{
			cr: "1/2",
			xp: 50,
			crNum: 0.5
		}
		 */
		const _meta = Object.entries(Parser.XP_CHART_ALT).map(([cr, xp]) => ({cr, xp, crNum: Parser.crToNumber(cr)}))
			.sort((a, b) => SortUtil.ascSort(b.crNum, a.crNum));
		const standardXpValues = new Set(Object.values(Parser.XP_CHART_ALT));
		const getXps = budget => _xps.filter(it => {
			// Make TftYP values (i.e. those that are not real XP thresholds) get skipped 9/10 times
			if (!standardXpValues.has(it) && RollerUtil.randomise(10) !== 10) return false;
			return it <= budget;
		});

		const getCurrentEncounterMeta = (encounter) => {
			const data = encounter.map(it => ({cr: Parser.crToNumber(it.mon.cr), count: it.count}));
			return EncounterBuilderUtils.calculateEncounterXp(data, partyMeta);
		};

		const calcNextBudget = (encounter) => {
			if (!encounter.length) return budget;

			const curr = getCurrentEncounterMeta(encounter);
			const budgetRemaining = budget - curr.adjustedXp;

			const meta = _meta.filter(it => it.xp <= budgetRemaining);

			// If we're a large party and we're doing a "single creature worth less XP" generation, force the generation
			//   to stop.
			if (rawBudget !== budget && curr.count === 1 && (rawBudget - curr.baseXp) <= 0) {
				return 0;
			}

			// if the highest CR creature has CR greater than the cutoff, adjust for next multiplier
			if (meta.length && meta[0].crNum >= curr.meta.crCutoff) {
				const nextMult = Parser.numMonstersToXpMult(curr.relevantCount + 1, partyMeta.cntPlayers);
				return Math.floor((budget - (nextMult * curr.baseXp)) / nextMult);
			}

			// otherwise, no creature has CR greater than the cutoff, don't worry about multipliers
			return budgetRemaining;
		};

		const addToEncounter = (encounter, xp) => {
			const existing = encounter.filter(it => it.xp === xp);
			if (existing.length && RollerUtil.roll(100) < 85) { // 85% chance to add another copy of an existing monster
				RollerUtil.rollOnArray(existing).count++;
			} else {
				const rolled = RollerUtil.rollOnArray(this._cache[xp]);
				// add to an existing group, if present
				const existing = encounter.find(it => it.mon.source === rolled.source && it.mon.name === rolled.name);
				if (existing) existing.count++;
				else {
					encounter.push({
						xp: xp,
						mon: rolled,
						count: 1,
					});
				}
			}
		};

		let skipCount = 0;
		const doSkip = (xps, encounter, xp) => {
			// if there are existing entries at this XP, don't skip
			const existing = encounter.filter(it => it.xp === xp);
			if (existing.length) return false;

			// skip 70% of the time by default, less 13% chance per item skipped
			if (xps.length > 1) {
				const isSkip = RollerUtil.roll(100) < (70 - (13 * skipCount));
				if (isSkip) {
					skipCount++;
					const maxSkip = xps.length - 1;
					// flip coins; so long as we get heads, keep skipping
					for (let i = 0; i < maxSkip; ++i) {
						if (RollerUtil.roll(2) === 0) {
							return i;
						}
					}
					return maxSkip - 1;
				} else return 0;
			} else return false;
		};

		const doInitialSkip = xps => {
			// 50% of the time, skip the first 0-1/3rd of available CRs
			if (xps.length > 4 && RollerUtil.roll(2) === 1) {
				const skips = RollerUtil.roll(Math.ceil(xps.length / 3));
				return xps.slice(skips);
			} else return xps;
		};

		const doFind = (budget) => {
			const enc = [];
			const xps = doInitialSkip(getXps(budget));

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

				skips = doSkip(xps, enc, xp);
				if (skips) {
					skips--;
					xps.shift();
					continue;
				}

				addToEncounter(enc, xp);

				nextBudget = calcNextBudget(enc);
			}

			return enc;
		};

		const encounter = doFind(budget);
		return {encounter, adjustedXp: getCurrentEncounterMeta(encounter).adjustedXp};
	}

	async _pLoadSublist (toLoad) {
		await this._bestiaryPage.pPreloadSublistSources(toLoad);
		await ListUtil.pDoJsonLoad(toLoad, false);
		this.updateDifficulty();
	}

	addAdvancedPlayerRow (first = true, doUpdate = true, name, level, extraCols) {
		$(`.ecgen__wrp_add_players`).before(EncounterBuilder.getAdvancedPlayerRow(first, name, level, extraCols));
		if (doUpdate) this.updateDifficulty();
	}

	addPlayerRow (first = true, doUpdate = true, count, level) {
		$(`.ecgen__wrp_add_players`).before(EncounterBuilder.getPlayerRow(first, count, level));
		if (doUpdate) this.updateDifficulty();
	}

	removeAllPlayerRows () {
		$(`.ecgen__player_group`).remove();
		$(`.ecgen__player_advanced`).remove();
	}

	isActive () {
		return Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true";
	}

	showBuilder () {
		this._cachedTitle = this._cachedTitle || document.title;
		document.title = "Encounter Builder - 5etools";
		$(`body`).addClass("ecgen_active");
		this.updateDifficulty();
		ListUtil.doDeselectAll();
		ListUtil.doSublistDeselectAll();
	}

	hideBuilder () {
		if (this._cachedTitle) {
			document.title = this._cachedTitle;
			this._cachedTitle = null;
		}
		$(`body`).removeClass("ecgen_active");
	}

	handleClick (evt, ix, add, customHashId) {
		const data = customHashId ? {customHashId} : undefined;
		if (add) ListUtil.pDoSublistAdd(ix, {doFinalize: true, addCount: evt.shiftKey ? 5 : 1, data});
		else ListUtil.pDoSublistSubtract(ix, {subtractCount: evt.shiftKey ? 5 : 1, data});
	}

	async pHandleShuffleClick (ix) {
		await this._lock.pLock();

		try {
			const mon = bestiaryPage._dataList[ix];
			const xp = Parser.crToXpNumber(mon.cr);
			if (!xp) return; // if Unknown/etc

			const curr = ListUtil.getExportableSublist();
			const hash = UrlUtil.autoEncodeHash(mon);
			const itemToSwitch = curr.items.find(it => it.h === hash);

			this.generateCache();
			const availMons = this._cache[xp];
			if (availMons.length !== 1) {
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
		if (Hist.getSubHash(EncounterBuilder.HASH_KEY) === "true") this.showBuilder();
		else this.hideBuilder();
	}

	removeAdvancedPlayerRow (ele) {
		const $ele = $(ele);
		$ele.closest(`.ecgen__player_advanced`).remove();
		this.updateDifficulty();
	}

	removePlayerRow (ele) {
		const $ele = $(ele);
		$ele.closest(`.ecgen__player_group`).remove();
		this.updateDifficulty();
	}

	_getApproxTurnsToKill () {
		const party = this.getPartyMeta().levelMetas;
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
		const {partyMeta, encounter} = this.calculateXp();

		const $elEasy = $(`.ecgen__easy`).removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_EASY}">Easy:</span> ${partyMeta.easy.toLocaleString()} XP`);
		const $elmed = $(`.ecgen__medium`).removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_MEDIUM}">Medium:</span> ${partyMeta.medium.toLocaleString()} XP`);
		const $elHard = $(`.ecgen__hard`).removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_HARD}">Hard:</span> ${partyMeta.hard.toLocaleString()} XP`);
		const $elDeadly = $(`.ecgen__deadly`).removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_DEADLY}">Deadly:</span> ${partyMeta.deadly.toLocaleString()} XP`);
		const $elAbsurd = $(`.ecgen__absurd`).removeClass("bold").html(`<span class="help" title="${EncounterBuilder._TITLE_ABSURD}">Absurd:</span> ${partyMeta.absurd.toLocaleString()} XP`);

		$(`.ecgen__ttk`).html(`<span class="help" title="${EncounterBuilder._TITLE_TTK}">TTK:</span> ${this._getApproxTurnsToKill().toFixed(2)}`);

		$(`.ecgen__daily_budget`).removeClass("bold").html(`<span class="help-subtle" title="${EncounterBuilder._TITLE_BUDGET_DAILY}">Daily Budget:</span> ${partyMeta.dailyBudget.toLocaleString()} XP`);

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
			$(`.ecgen__req_creatures`).showVe();
			$(`.ecgen__rating`).text(`Difficulty: ${difficulty}`);
			$(`.ecgen__raw_total`).text(`Total XP: ${encounter.baseXp.toLocaleString()}`);
			$(`.ecgen__raw_per_player`).text(`(${Math.floor(encounter.baseXp / partyMeta.cntPlayers).toLocaleString()} per player)`);

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

				const $hvInfo = $(`.ecgen__adjusted_total_info`);
				$hvInfo.on("mouseover", function (event) { hoverMeta.mouseOver(event, this) });
				$hvInfo.on("mousemove", function (event) { hoverMeta.mouseMove(event, this) });
				$hvInfo.on("mouseleave", function (event) { hoverMeta.mouseLeave(event, this) });
			} else {
				Renderer.hover.updatePredefinedHover(this._infoHoverId, infoEntry);
			}

			$(`.ecgen__adjusted_total`).text(`Adjusted XP: ${encounter.adjustedXp.toLocaleString()}`);
			$(`.ecgen__adjusted_per_player`).text(`(${Math.floor(encounter.adjustedXp / partyMeta.cntPlayers).toLocaleString()} per player)`);
		} else {
			$(`.ecgen__req_creatures`).hideVe();
		}

		this.doSaveState();
	}

	getPartyMeta () {
		let rawPlayerArr;
		if (this._advanced) {
			const $players = $(`.ecgen__player_advanced`);
			const countByLevel = {};
			$players.each((i, e) => {
				const level = $(e).find(`.ecgen__player_advanced__level`).val();
				countByLevel[level] = (countByLevel[level] || 0) + 1;
			});
			rawPlayerArr = Object.entries(countByLevel).map(([level, count]) => ({level: Number(level), count}));
		} else {
			rawPlayerArr = $(`.ecgen__player_group`).map((i, e) => {
				const $e = $(e);
				return {
					count: Number($e.find(`.ecgen__player_group__count`).val()),
					level: Number($e.find(`.ecgen__player_group__level`).val()),
				}
			}).get();
		}

		const out = new EncounterPartyMeta(rawPlayerArr);
		this._lastPartyMeta = out;
		return out;
	}

	get lastPartyMeta () { return this._lastPartyMeta; }

	calculateXp () {
		const partyMeta = this.getPartyMeta();
		const encounter = EncounterBuilderUtils.calculateListEncounterXp(partyMeta);
		return {partyMeta: partyMeta, encounter: encounter};
	}

	static async doStatblockMouseOver (evt, ele, ixMon, metadata) {
		const mon = bestiaryPage._dataList[ixMon];

		const hash = UrlUtil.autoEncodeHash(mon);
		return Renderer.hover.pHandleLinkMouseOver(evt, ele, {page: UrlUtil.PG_BESTIARY, source: mon.source, hash, preloadId: metadata?.customHashId});
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

	static async handleImageMouseOver (evt, $ele, ixMon) {
		// We'll rebuild the mouseover handler with whatever we load
		$ele.off("mouseover");

		const mon = bestiaryPage._dataList[ixMon];

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
			const mon = bestiaryPage._dataList[ixMon];
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

	addAdvancedColumnHeader (name) {
		$(`.ecgen__advanced_add_col`).before(EncounterBuilder.getAdvancedPlayerDetailHeader(name));
	}

	addAdvancedColumnFooter () {
		$(`.ecgen__wrp_add_players`).append(`
			<div class="ecgen__player_advanced_narrow ecgen__player_advanced_extra_foot mr-1">
				<button class="btn btn-xs btn-danger ecgen__advanced_remove_col" onclick="encounterBuilder.removeAdvancedColumn(this)" title="Remove Column"><span class="glyphicon-trash glyphicon"/></button>
			</div>
		`);
	}

	addAdvancedColumn () {
		this.addAdvancedColumnHeader();
		$(`.ecgen__player_advanced`).each((i, e) => {
			$(e).find(`input`).last().after(EncounterBuilder.getAdvancedPlayerDetailColumn());
		});
		this.addAdvancedColumnFooter();
		this.doSaveStateDebounced();
	}

	removeAdvancedColumn (ele) {
		const $e = $(ele);
		const pos = $(`.ecgen__wrp_add_players`).find(`.ecgen__player_advanced_extra_foot`).index($e.parent());
		$e.parent().remove();
		$(`.ecgen__player_advanced`).each((i, e) => {
			$($(e).find(`.ecgen__player_advanced_extra`)[pos]).remove();
		});
		$($(`.ecgen__players_head_advanced .ecgen__player_advanced_extra_head`)[pos]).remove();
	}

	static getAdvancedPlayerDetailHeader (name) {
		return `
			<input class="ecgen__player_advanced_narrow ecgen__player_advanced_extra_head form-control form-control--minimal input-xs text-center mr-1" autocomplete="new-password" value="${(name || "").escapeQuotes()}" onchange="encounterBuilder.doSaveStateDebounced()">
		`;
	}

	static getAdvancedPlayerDetailColumn (value) {
		return `
			<input class="ecgen__player_advanced_narrow ecgen__player_advanced_extra form-control form-control--minimal input-xs text-center mr-1" value="${(value || "").escapeQuotes()}" onchange="encounterBuilder.doSaveStateDebounced()">
		`;
	}

	static getAdvancedPlayerRow (isFirst, name, level, extraVals) {
		extraVals = extraVals || [...new Array($(`.ecgen__player_advanced_extra_head`).length)].map(() => "");
		return `
			<div class="row mb-2 ecgen__player_advanced">
				<div class="w-100 flex ecgen__player_advanced_flex">
					<input class="ecgen__player_advanced__name form-control form-control--minimal input-xs mr-1" value="${(name || "").escapeQuotes()}" onchange="encounterBuilder.doSaveStateDebounced()">
					<input value="${level || 1}" min="1" max="20" type="number" class="ecgen__player_advanced__level ecgen__player_advanced_narrow form-control form-control--minimal input-xs text-right mr-1" onchange="encounterBuilder.updateDifficulty()">
					${extraVals.map(it => EncounterBuilder.getAdvancedPlayerDetailColumn(it)).join("")}
					${!isFirst ? `
					<button class="btn btn-danger btn-xs ecgen__del_players" onclick="encounterBuilder.removeAdvancedPlayerRow(this)" title="Remove Player">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
					` : `<div class="ecgen__del_players_filler"/>`}
				</div>
			</div>
		`;
	}

	static getPlayerRow (isFirst, count, level) {
		count = Number(count) || 1;
		level = Number(level) || 1;
		return `
			<div class="flex-v-center mb-2 ecgen__player_group">
				<div class="w-20">
					<select class="ecgen__player_group__count form-control form-control--minimal input-xs" onchange="encounterBuilder.updateDifficulty()">
					${[...new Array(12)].map((_, i) => `<option ${(count === i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}
					</select>
				</div>
				<div class="w-20">
					<select class="ecgen__player_group__level form-control form-control--minimal input-xs" onchange="encounterBuilder.updateDifficulty()" >
						${[...new Array(20)].map((_, i) => `<option ${(level === i + 1) ? "selected" : ""}>${i + 1}</option>`).join("")}
					</select>
				</div>
				${!isFirst ? `
				<div class="ml-2 flex-v-center" style="height: 20px;">
					<button class="btn btn-danger btn-xs ecgen__del_players" onclick="encounterBuilder.removePlayerRow(this)" title="Remove Player Group">
						<span class="glyphicon glyphicon-trash"></span>
					</button>
				</div>
				` : ""}
			</div>
		`;
	}

	static getButtons (monId) {
		return e_({
			tag: "span",
			clazz: `ecgen__visible col-1 no-wrap pl-0`,
			click: evt => {
				evt.preventDefault();
				evt.stopPropagation();
			},
			children: [
				e_({
					tag: "button",
					title: `Add (SHIFT for 5)`,
					clazz: `btn btn-success btn-xs ecgen__btn_list`,
					click: evt => encounterBuilder.handleClick(evt, monId, 1),
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
					click: evt => encounterBuilder.handleClick(evt, monId, 0),
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

	static $getSublistButtons (monId, customHashId) {
		const $btnAdd = $(`<button title="Add (SHIFT for 5)" class="btn btn-success btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-plus"/></button>`)
			.click(evt => encounterBuilder.handleClick(evt, monId, true, customHashId));

		const $btnSub = $(`<button title="Subtract (SHIFT for 5)" class="btn btn-danger btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-minus"/></button>`)
			.click(evt => encounterBuilder.handleClick(evt, monId, false, customHashId));

		const $btnRandomize = $(`<button title="Randomize Monster" class="btn btn-default btn-xs ecgen__btn_list"><span class="glyphicon glyphicon-random" style="right: 1px"/></button>`)
			.click(() => encounterBuilder.pHandleShuffleClick(monId));

		return $$`<span class="ecgen__visible col-1-5 no-wrap pl-0">
			${$btnAdd}
			${$btnSub}
			${$btnRandomize}
		</span>`
			.click(evt => {
				evt.preventDefault();
				evt.stopPropagation()
			});
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
			await this.pDoLoadState(encounter.data);
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
				encounterBuilder.pReset({isNotResetPlayers: !evt.shiftKey, isNotAddInitialPlayers: !evt.shiftKey});
			});
		const hookDisplayNew = () => this._$btnNew.toggleClass("hidden", !this._state.activeKey);
		this._addHook("state", "activeKey", hookDisplayNew);
		hookDisplayNew();

		// TODO set window title to encounter name on save?
		this._$btnSave = $(`<button class="btn btn-default btn-xs mr-2" title="Save Encounter"/>`)
			.click(async () => {
				if (this._state.activeKey) {
					const encounter = this._state.savedEncounters[this._state.activeKey];
					encounter.data = this.getSaveableState();

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
								data: this.getSaveableState(),
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
				const {$modalInner} = UiUtil.getShowModal({title: "Saved Encounters"});
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

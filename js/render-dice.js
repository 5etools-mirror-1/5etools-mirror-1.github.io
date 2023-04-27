"use strict";

Renderer.dice = {
	SYSTEM_USER: {
		name: "Avandra", // goddess of luck
	},
	POS_INFINITE: 100000000000000000000, // larger than this, and we start to see "e" numbers appear
	_SYMBOL_PARSE_FAILED: Symbol("parseFailed"),

	_$wrpRoll: null,
	_$minRoll: null,
	_$iptRoll: null,
	_$outRoll: null,
	_$head: null,
	_hist: [],
	_histIndex: null,
	_$lastRolledBy: null,
	_storage: null,

	_isManualMode: false,

	// region Utilities
	DICE: [4, 6, 8, 10, 12, 20, 100],
	getNextDice (faces) {
		const idx = Renderer.dice.DICE.indexOf(faces);
		if (~idx) return Renderer.dice.DICE[idx + 1];
		else return null;
	},

	getPreviousDice (faces) {
		const idx = Renderer.dice.DICE.indexOf(faces);
		if (~idx) return Renderer.dice.DICE[idx - 1];
		else return null;
	},
	// endregion

	// region DM Screen integration
	_panel: null,
	bindDmScreenPanel (panel, title) {
		if (Renderer.dice._panel) { // there can only be one roller box
			Renderer.dice.unbindDmScreenPanel();
		}
		Renderer.dice._showBox();
		Renderer.dice._panel = panel;
		panel.doPopulate_Rollbox(title);
	},

	unbindDmScreenPanel () {
		if (Renderer.dice._panel) {
			$(`body`).append(Renderer.dice._$wrpRoll);
			Renderer.dice._panel.close$TabContent();
			Renderer.dice._panel = null;
			Renderer.dice._hideBox();
			Renderer.dice._$wrpRoll.removeClass("rollbox-panel");
		}
	},

	get$Roller () {
		return Renderer.dice._$wrpRoll;
	},
	// endregion

	/**
	 * Silently roll an expression and get the result.
	 * Note that this does not support dynamic variables (e.g. user proficiency bonus).
	 */
	parseRandomise2 (str) {
		if (!str || !str.trim()) return null;
		const wrpTree = Renderer.dice.lang.getTree3(str);
		if (wrpTree) return wrpTree.tree.evl({});
		else return null;
	},

	/**
	 * Silently get the average of an expression.
	 * Note that this does not support dynamic variables (e.g. user proficiency bonus).
	 */
	parseAverage (str) {
		if (!str || !str.trim()) return null;
		const wrpTree = Renderer.dice.lang.getTree3(str);
		if (wrpTree) return wrpTree.tree.avg({});
		else return null;
	},

	// region Roll box UI
	_showBox () {
		Renderer.dice._$minRoll.hideVe();
		Renderer.dice._$wrpRoll.showVe();
		Renderer.dice._$iptRoll.prop("placeholder", `${Renderer.dice._getRandomPlaceholder()} or "/help"`);
	},

	_hideBox () {
		Renderer.dice._$minRoll.showVe();
		Renderer.dice._$wrpRoll.hideVe();
	},

	_getRandomPlaceholder () {
		const count = RollerUtil.randomise(10);
		const faces = Renderer.dice.DICE[RollerUtil.randomise(Renderer.dice.DICE.length - 1)];
		const mod = (RollerUtil.randomise(3) - 2) * RollerUtil.randomise(10);
		const drop = (count > 1) && RollerUtil.randomise(5) === 5;
		const dropDir = drop ? RollerUtil.randomise(2) === 2 ? "h" : "l" : "";
		const dropAmount = drop ? RollerUtil.randomise(count - 1) : null;
		return `${count}d${faces}${drop ? `d${dropDir}${dropAmount}` : ""}${mod < 0 ? mod : mod > 0 ? `+${mod}` : ""}`;
	},

	/** Initialise the roll box UI. */
	async _pInit () {
		const $wrpRoll = $(`<div class="rollbox ve-flex-col min-h-0"></div>`).hideVe();
		const $minRoll = $(`<button class="rollbox-min"><span class="glyphicon glyphicon-chevron-up"></span></button>`).on("click", () => {
			Renderer.dice._showBox();
			Renderer.dice._$iptRoll.focus();
		});
		const $head = $(`<div class="head-roll"><span class="hdr-roll">Dice Roller</span><span class="p-2 glyphicon glyphicon-remove"></span></div>`)
			.on("click", () => {
				if (!Renderer.dice._panel) Renderer.dice._hideBox();
			});
		const $outRoll = $(`<div class="out-roll">`);
		const $iptRoll = $(`<input class="ipt-roll form-control" autocomplete="off" spellcheck="false">`)
			.on("keypress", async evt => {
				evt.stopPropagation();
				if (evt.key !== "Enter") return;

				const strDice = $iptRoll.val();
				const result = await Renderer.dice.pRoll2(
					strDice,
					{
						isUser: true,
						name: "Anon",
					},
				);
				$iptRoll.val("");

				if (result === Renderer.dice._SYMBOL_PARSE_FAILED) {
					Renderer.dice._showInvalid();
					$iptRoll.addClass("form-control--error");
				}
			}).on("keydown", (evt) => {
				$iptRoll.removeClass("form-control--error");

				// arrow keys only work on keydown
				if (evt.key === "ArrowUp") {
					evt.preventDefault();
					Renderer.dice._prevHistory();
					return;
				}

				if (evt.key === "ArrowDown") {
					evt.preventDefault();
					Renderer.dice._nextHistory();
				}
			});
		$wrpRoll.append($head).append($outRoll).append($iptRoll);

		Renderer.dice._$wrpRoll = $wrpRoll;
		Renderer.dice._$minRoll = $minRoll;
		Renderer.dice._$head = $head;
		Renderer.dice._$outRoll = $outRoll;
		Renderer.dice._$iptRoll = $iptRoll;

		$(`body`).append($minRoll).append($wrpRoll);

		$wrpRoll.on("click", ".out-roll-item-code", (evt) => Renderer.dice._$iptRoll.val($(evt.target).text()).focus());

		Renderer.dice.storage = await StorageUtil.pGet(VeCt.STORAGE_ROLLER_MACRO) || {};
	},

	_prevHistory () { Renderer.dice._histIndex--; Renderer.dice._prevNextHistory_load(); },
	_nextHistory () { Renderer.dice._histIndex++; Renderer.dice._prevNextHistory_load(); },

	_prevNextHistory_load () {
		Renderer.dice._cleanHistoryIndex();
		const nxtVal = Renderer.dice._hist[Renderer.dice._histIndex];
		Renderer.dice._$iptRoll.val(nxtVal);
		if (nxtVal) Renderer.dice._$iptRoll[0].selectionStart = Renderer.dice._$iptRoll[0].selectionEnd = nxtVal.length;
	},

	_cleanHistoryIndex: () => {
		if (!Renderer.dice._hist.length) {
			Renderer.dice._histIndex = null;
		} else {
			Renderer.dice._histIndex = Math.min(Renderer.dice._hist.length, Math.max(Renderer.dice._histIndex, 0));
		}
	},

	_addHistory: (str) => {
		Renderer.dice._hist.push(str);
		// point index at the top of the stack
		Renderer.dice._histIndex = Renderer.dice._hist.length;
	},

	_scrollBottom: () => {
		Renderer.dice._$outRoll.scrollTop(1e10);
	},
	// endregion

	// region Event handling
	async pRollerClickUseData (evt, ele) {
		const $ele = $(ele);
		const rollData = $ele.data("packed-dice");
		let name = $ele.data("roll-name");
		let shiftKey = evt.shiftKey;
		let ctrlKey = evt.ctrlKey || evt.metaKey;

		const options = rollData.toRoll.split(";").map(it => it.trim()).filter(Boolean);

		let chosenRollData;
		if (options.length > 1) {
			const cpyRollData = MiscUtil.copyFast(rollData);
			const menu = ContextUtil.getMenu([
				new ContextUtil.Action(
					"Choose Roll",
					null,
					{isDisabled: true},
				),
				null,
				...options.map(it => new ContextUtil.Action(
					`Roll ${it}`,
					evt => {
						shiftKey = shiftKey || evt.shiftKey;
						ctrlKey = ctrlKey || (evt.ctrlKey || evt.metaKey);
						cpyRollData.toRoll = it;
						return cpyRollData;
					},
				)),
			]);

			chosenRollData = await ContextUtil.pOpenMenu(evt, menu);
		} else chosenRollData = rollData;

		if (!chosenRollData) return;

		const rePrompt = /#\$prompt_number:?([^$]*)\$#/g;
		const results = [];
		let m;
		while ((m = rePrompt.exec(chosenRollData.toRoll))) {
			const optionsRaw = m[1];
			const opts = {};
			if (optionsRaw) {
				const spl = optionsRaw.split(",");
				spl.map(it => it.trim()).forEach(part => {
					const [k, v] = part.split("=").map(it => it.trim());
					switch (k) {
						case "min":
						case "max":
							opts[k] = Number(v); break;
						default:
							opts[k] = v; break;
					}
				});
			}

			if (opts.min == null) opts.min = 0;
			if (opts.max == null) opts.max = Renderer.dice.POS_INFINITE;
			if (opts.default == null) opts.default = 0;

			const input = await InputUiUtil.pGetUserNumber(opts);
			if (input == null) return;
			results.push(input);
		}

		const rollDataCpy = MiscUtil.copyFast(chosenRollData);
		rePrompt.lastIndex = 0;
		rollDataCpy.toRoll = rollDataCpy.toRoll.replace(rePrompt, () => results.shift());

		// If there's a prompt, prompt the user to select the dice
		let rollDataCpyToRoll;
		if (rollData.prompt) {
			const sortedKeys = Object.keys(rollDataCpy.prompt.options).sort(SortUtil.ascSortLower);
			const menu = ContextUtil.getMenu([
				new ContextUtil.Action(rollDataCpy.prompt.entry, null, {isDisabled: true}),
				null,
				...sortedKeys
					.map(it => {
						const title = rollDataCpy.prompt.mode === "psi"
							? `${it} point${it === "1" ? "" : "s"}`
							: `${Parser.spLevelToFull(it)} level`;

						return new ContextUtil.Action(
							title,
							evt => {
								shiftKey = shiftKey || evt.shiftKey;
								ctrlKey = ctrlKey || (evt.ctrlKey || evt.metaKey);

								const fromScaling = rollDataCpy.prompt.options[it];
								if (!fromScaling) {
									name = "";
									return rollDataCpy;
								} else {
									name = rollDataCpy.prompt.mode === "psi" ? `${it} psi activation` : `${Parser.spLevelToFull(it)}-level cast`;
									rollDataCpy.toRoll += `+${fromScaling}`;
									return rollDataCpy;
								}
							},
						);
					}),
			]);

			rollDataCpyToRoll = await ContextUtil.pOpenMenu(evt, menu);
		} else rollDataCpyToRoll = rollDataCpy;

		if (!rollDataCpyToRoll) return;
		await Renderer.dice.pRollerClick({shiftKey, ctrlKey}, ele, JSON.stringify(rollDataCpyToRoll), name);
	},

	__rerollNextInlineResult (ele) {
		const $ele = $(ele);
		const $result = $ele.next(`.result`);
		const r = Renderer.dice.__rollPackedData($ele);
		$result.text(r);
	},

	__rollPackedData ($ele) {
		// Note that this does not support dynamic variables (e.g. user proficiency bonus)
		const wrpTree = Renderer.dice.lang.getTree3($ele.data("packed-dice").toRoll);
		return wrpTree.tree.evl({});
	},

	$getEleUnknownTableRoll (total) { return $(Renderer.dice._pRollerClick_getMsgBug(total)); },

	_pRollerClick_getMsgBug (total) { return `<span class="message">No result found matching roll ${total}?! <span class="help-subtle" title="Bug!">🐛</span></span>`; },

	async pRollerClick (evtMock, ele, packed, name) {
		const $ele = $(ele);
		const entry = JSON.parse(packed);
		const additionalData = {...ele.dataset};

		const rolledBy = {
			name: Renderer.dice._pRollerClick_attemptToGetNameOfRoller({$ele}),
			label: name != null ? name : Renderer.dice._pRollerClick_attemptToGetNameOfRoll({entry, $ele}),
		};

		const modRollMeta = Renderer.dice.getEventModifiedRollMeta(evtMock, entry);
		const $parent = $ele.closest("th, p, table");

		const rollResult = await this._pRollerClick_pGetResult({
			$parent,
			$ele,
			entry,
			modRollMeta,
			rolledBy,
			additionalData,
		});

		if (!entry.autoRoll) return;

		const $tgt = $ele.next(`[data-rd-is-autodice-result="true"]`);
		const curTxt = $tgt.text();
		$tgt.text(rollResult);
		JqueryUtil.showCopiedEffect($tgt, curTxt, true);
	},

	async _pRollerClick_pGetResult ({$parent, $ele, entry, modRollMeta, rolledBy, additionalData}) {
		const sharedRollOpts = {
			rollCount: modRollMeta.rollCount,
			additionalData,
			isHidden: !!entry.autoRoll,
		};

		if ($parent.is("th") && $parent.attr("data-rd-isroller") === "true") {
			if ($parent.attr("data-rd-namegeneratorrolls")) {
				return Renderer.dice._pRollerClick_pRollGeneratorTable({
					$parent,
					$ele,
					rolledBy,
					modRollMeta,
					rollOpts: sharedRollOpts,
				});
			}

			return Renderer.dice.pRollEntry(
				modRollMeta.entry,
				rolledBy,
				{
					...sharedRollOpts,
					fnGetMessage: Renderer.dice._pRollerClick_fnGetMessageTable.bind(Renderer.dice, $ele),
				},
			);
		}

		return Renderer.dice.pRollEntry(
			modRollMeta.entry,
			rolledBy,
			{
				...sharedRollOpts,
			},
		);
	},

	_pRollerClick_fnGetMessageTable ($ele, total) {
		const elesTd = Renderer.dice._pRollerClick_$getTdsFromTotal($ele, total);
		if (elesTd) {
			const tableRow = elesTd.map(ele => ele.innerHTML.trim()).filter(it => it).join(" | ");
			const $row = $(`<span class="message">${tableRow}</span>`);
			Renderer.dice._pRollerClick_rollInlineRollers($ele);
			return $row.html();
		}
		return Renderer.dice._pRollerClick_getMsgBug(total);
	},

	// Aka "getTableName", probably
	_pRollerClick_attemptToGetNameOfRoll ({entry, $ele}) {
		// Try to use the entry's built-in name
		if (entry.name) return entry.name;

		// try to use table caption
		let titleMaybe = $ele.closest(`table:not(.stats)`).children(`caption`).text();
		if (titleMaybe) return titleMaybe.trim();

		// try to use list item title
		titleMaybe = $ele.parent().children(`.rd__list-item-name`).text();
		if (titleMaybe) return titleMaybe.trim().replace(/[.,:]$/, "");

		// use the section title, where applicable
		titleMaybe = $ele.closest(`div`).children(`.rd__h`).first().find(`.entry-title-inner`).text();
		if (titleMaybe) {
			titleMaybe = titleMaybe.trim().replace(/[.,:]$/, "");
			return titleMaybe;
		}

		// try to use stats table name row
		titleMaybe = $ele.closest(`table.stats`).children(`tbody`).first().children(`tr`).first().find(`.rnd-name .stats-name`).text();
		if (titleMaybe) return titleMaybe.trim();

		if (UrlUtil.getCurrentPage() === UrlUtil.PG_CHARACTERS) {
			// try use mini-entity name
			titleMaybe = ($ele.closest(`.chr-entity__row`).find(".chr-entity__ipt-name").val() || "").trim();
			if (titleMaybe) return titleMaybe;
		}

		return titleMaybe;
	},

	_pRollerClick_attemptToGetNameOfRoller ({$ele}) {
		const $hov = $ele.closest(`.hwin`);
		if ($hov.length) return $hov.find(`.stats-name`).first().text();
		const $roll = $ele.closest(`.out-roll-wrp`);
		if ($roll.length) return $roll.data("name");
		const $dispPanelTitle = $ele.closest(`.dm-screen-panel`).children(`.panel-control-title`);
		if ($dispPanelTitle.length) return $dispPanelTitle.text().trim();
		let name = document.title.replace("- 5etools", "").trim();
		return name === "DM Screen" ? "Dungeon Master" : name;
	},

	_pRollerClick_$getTdsFromTotal ($ele, total) {
		const $table = $ele.closest(`table`);
		const $tdRoll = $table.find(`td`).filter((i, e) => {
			const $e = $(e);
			if (!$e.closest(`table`).is($table)) return false;
			return total >= Number($e.data("roll-min")) && total <= Number($e.data("roll-max"));
		});
		if ($tdRoll.length && $tdRoll.nextAll().length) {
			return $tdRoll.nextAll().get();
		}
		return null;
	},

	// TODO erm
	_pRollerClick_rollInlineRollers ($ele) {
		$ele.find(`.render-roller`).each((i, e) => {
			const $e = $(e);
			const r = Renderer.dice.__rollPackedData($e);
			$e.attr("onclick", `Renderer.dice.__rerollNextInlineResult(this)`);
			$e.after(` (<span class="result">${r}</span>)`);
		});
	},

	_pRollerClick_fnGetMessageGeneratorTable ($ele, ix, total) {
		const elesTd = Renderer.dice._pRollerClick_$getTdsFromTotal($ele, total);
		if (elesTd) {
			const $row = $(`<span class="message">${elesTd[ix].innerHTML.trim()}</span>`);
			Renderer.dice._pRollerClick_rollInlineRollers($ele);
			return $row.html();
		}
		return Renderer.dice._pRollerClick_getMsgBug(total);
	},

	async _pRollerClick_pRollGeneratorTable ({$parent, $ele, rolledBy, modRollMeta, rollOpts}) {
		Renderer.dice.addElement({rolledBy, html: `<i>${rolledBy.label}:</i>`, isMessage: true});

		// Track a total of all rolls--this is a bit meaningless, but this method is expected to return a result value
		let total = 0;

		const out = [];
		const numRolls = Number($parent.attr("data-rd-namegeneratorrolls"));
		const $ths = $ele.closest(`table`).find(`th`);
		for (let i = 0; i < numRolls; ++i) {
			const cpyRolledBy = MiscUtil.copyFast(rolledBy);
			cpyRolledBy.label = $($ths.get(i + 1)).text().trim();

			const result = await Renderer.dice.pRollEntry(
				modRollMeta.entry,
				cpyRolledBy,
				{
					...rollOpts,
					fnGetMessage: Renderer.dice._pRollerClick_fnGetMessageGeneratorTable.bind(Renderer.dice, $ele, i),
				},
			);
			total += result;
			const elesTd = Renderer.dice._pRollerClick_$getTdsFromTotal($ele, result);

			if (!elesTd) {
				out.push(`(no result)`);
				continue;
			}

			out.push(elesTd[i].innerHTML.trim());
		}

		Renderer.dice.addElement({rolledBy, html: `= ${out.join(" ")}`, isMessage: true});

		return total;
	},

	getEventModifiedRollMeta (evt, entry) {
		// Change roll type/count depending on CTRL/SHIFT status
		const out = {rollCount: 1, entry};

		if (evt.shiftKey) {
			if (entry.subType === "damage") { // If SHIFT is held, roll crit
				const dice = [];
				// TODO(future) in order for this to correctly catch everything, would need to parse the toRoll as a tree and then pull all dice expressions from the first level of that tree
				entry.toRoll
					.replace(/\s+/g, "") // clean whitespace
					.replace(/\d*?d\d+/gi, m0 => dice.push(m0));
				entry.toRoll = `${entry.toRoll}${dice.length ? `+${dice.join("+")}` : ""}`;
			} else if (entry.subType === "d20") { // If SHIFT is held, roll advantage
				// If we have a cached d20mod value, use it
				if (entry.d20mod != null) entry.toRoll = `2d20dl1${entry.d20mod}`;
				else entry.toRoll = entry.toRoll.replace(/^\s*1?\s*d\s*20/, "2d20dl1");
			} else out.rollCount = 2; // otherwise, just roll twice
		}

		if (evt.ctrlKey || evt.metaKey) {
			if (entry.subType === "damage") { // If CTRL is held, half the damage
				entry.toRoll = `floor((${entry.toRoll}) / 2)`;
			} else if (entry.subType === "d20") { // If CTRL is held, roll disadvantage (assuming SHIFT is not held)
				// If we have a cached d20mod value, use it
				if (entry.d20mod != null) entry.toRoll = `2d20dh1${entry.d20mod}`;
				else entry.toRoll = entry.toRoll.replace(/^\s*1?\s*d\s*20/, "2d20dh1");
			} else out.rollCount = 2; // otherwise, just roll twice
		}

		return out;
	},
	// endregion

	/**
	 * Parse and roll a string, and display the result in the roll box.
	 * Returns the total rolled, if available.
	 * @param str
	 * @param rolledBy
	 * @param rolledBy.isUser
	 * @param rolledBy.name The name of the roller.
	 * @param rolledBy.label The label for this roll.
	 * @param [opts] Options object.
	 * @param [opts.isResultUsed] If an input box should be provided for the user to enter the result (manual mode only).
	 */
	async pRoll2 (str, rolledBy, opts) {
		opts = opts || {};
		str = str
			.trim()
			.replace(/\/r(?:oll)? /gi, "").trim() // Remove any leading "/r"s, for ease of use
		;
		if (!str) return;
		if (rolledBy.isUser) Renderer.dice._addHistory(str);

		if (str.startsWith("/")) return Renderer.dice._pHandleCommand(str, rolledBy);
		if (str.startsWith("#")) return Renderer.dice._pHandleSavedRoll(str, rolledBy, opts);

		const [head, ...tail] = str.split(":");
		if (tail.length) {
			str = tail.join(":");
			rolledBy.label = head;
		}
		const wrpTree = Renderer.dice.lang.getTree3(str);
		if (!wrpTree) return Renderer.dice._SYMBOL_PARSE_FAILED;
		return Renderer.dice._pHandleRoll2(wrpTree, rolledBy, opts);
	},

	/**
	 * Parse and roll an entry, and display the result in the roll box.
	 * Returns the total rolled, if available.
	 * @param entry
	 * @param rolledBy
	 * @param [opts] Options object.
	 * @param [opts.isResultUsed] If an input box should be provided for the user to enter the result (manual mode only).
	 * @param [opts.rollCount]
	 * @param [opts.additionalData]
	 * @param [opts.isHidden] If the result should not be posted to the rollbox.
	 */
	async pRollEntry (entry, rolledBy, opts) {
		opts = opts || {};

		const rollCount = Math.round(opts.rollCount || 1);
		delete opts.rollCount;
		if (rollCount <= 0) throw new Error(`Invalid roll count: ${rollCount} (must be a positive integer)`);

		const wrpTree = Renderer.dice.lang.getTree3(entry.toRoll);
		wrpTree.tree.successThresh = entry.successThresh;
		wrpTree.tree.successMax = entry.successMax;
		wrpTree.tree.chanceSuccessText = entry.chanceSuccessText;
		wrpTree.tree.chanceFailureText = entry.chanceFailureText;
		wrpTree.tree.isColorSuccessFail = entry.isColorSuccessFail;

		// arbitrarily return the result of the highest roll if we roll multiple times
		const results = [];
		if (rollCount > 1 && !opts.isHidden) Renderer.dice._showMessage(`Rolling twice...`, rolledBy);
		for (let i = 0; i < rollCount; ++i) {
			const result = await Renderer.dice._pHandleRoll2(wrpTree, rolledBy, opts);
			if (result == null) return null;
			results.push(result);
		}
		return Math.max(...results);
	},

	/**
	 * @param wrpTree
	 * @param rolledBy
	 * @param [opts] Options object.
	 * @param [opts.fnGetMessage]
	 * @param [opts.isResultUsed]
	 * @param [opts.additionalData]
	 */
	async _pHandleRoll2 (wrpTree, rolledBy, opts) {
		opts = {...opts};

		if (wrpTree.meta && wrpTree.meta.hasPb) {
			const userPb = await InputUiUtil.pGetUserNumber({
				min: 0,
				int: true,
				title: "Enter Proficiency Bonus",
				default: 2,
				storageKey_default: "dice.playerProficiencyBonus",
				isGlobal_default: true,
			});
			if (userPb == null) return null;
			opts.pb = userPb;
		}

		if (wrpTree.meta && wrpTree.meta.hasSummonSpellLevel) {
			const predefinedSpellLevel = opts.additionalData?.summonedBySpellLevel != null && !isNaN(opts.additionalData?.summonedBySpellLevel)
				? Number(opts.additionalData.summonedBySpellLevel)
				: null;

			const userSummonSpellLevel = await InputUiUtil.pGetUserNumber({
				min: predefinedSpellLevel ?? 0,
				int: true,
				title: "Enter Spell Level",
				default: predefinedSpellLevel ?? 1,
			});
			if (userSummonSpellLevel == null) return null;
			opts.summonSpellLevel = userSummonSpellLevel;
		}

		if (wrpTree.meta && wrpTree.meta.hasSummonClassLevel) {
			const predefinedClassLevel = opts.additionalData?.summonedByClassLevel != null && !isNaN(opts.additionalData?.summonedByClassLevel)
				? Number(opts.additionalData.summonedByClassLevel)
				: null;

			const userSummonClassLevel = await InputUiUtil.pGetUserNumber({
				min: predefinedClassLevel ?? 0,
				int: true,
				title: "Enter Class Level",
				default: predefinedClassLevel ?? 1,
			});
			if (userSummonClassLevel == null) return null;
			opts.summonClassLevel = userSummonClassLevel;
		}

		if (Renderer.dice._isManualMode) return Renderer.dice._pHandleRoll2_manual(wrpTree.tree, rolledBy, opts);
		else return Renderer.dice._pHandleRoll2_automatic(wrpTree.tree, rolledBy, opts);
	},

	/**
	 * @param tree
	 * @param rolledBy
	 * @param [opts] Options object.
	 * @param [opts.fnGetMessage]
	 * @param [opts.pb] User-entered proficiency bonus, to be propagated to the meta.
	 * @param [opts.summonSpellLevel] User-entered summon spell level, to be propagated to the meta.
	 * @param [opts.summonClassLevel] User-entered summon class level, to be propagated to the meta.
	 * @param [opts.target] Generic target number (e.g. save DC, AC) to meet/beat.
	 * @param [opts.isHidden] If the result should not be posted to the rollbox.
	 */
	_pHandleRoll2_automatic (tree, rolledBy, opts) {
		opts = opts || {};

		if (!opts.isHidden) Renderer.dice._showBox();
		Renderer.dice._checkHandleName(rolledBy.name);
		const $out = Renderer.dice._$lastRolledBy;

		if (tree) {
			const meta = {};
			if (opts.pb) meta.pb = opts.pb;
			if (opts.summonSpellLevel) meta.summonSpellLevel = opts.summonSpellLevel;
			if (opts.summonClassLevel) meta.summonClassLevel = opts.summonClassLevel;

			const result = tree.evl(meta);
			const fullHtml = (meta.html || []).join("");
			const allMax = meta.allMax && meta.allMax.length && !(meta.allMax.filter(it => !it).length);
			const allMin = meta.allMin && meta.allMin.length && !(meta.allMin.filter(it => !it).length);

			const lbl = rolledBy.label && (!rolledBy.name || rolledBy.label.trim().toLowerCase() !== rolledBy.name.trim().toLowerCase()) ? rolledBy.label : null;

			const ptTarget = opts.target != null
				? result >= opts.target ? ` <b>&geq;${opts.target}</b>` : ` <span class="ve-muted">&lt;${opts.target}</span>`
				: "";

			const isThreshSuccess = tree.successThresh != null && result > (tree.successMax || 100) - tree.successThresh;
			const isColorSuccess = tree.isColorSuccessFail || !tree.chanceSuccessText;
			const isColorFail = tree.isColorSuccessFail || !tree.chanceFailureText;
			const totalPart = tree.successThresh != null
				? `<span class="roll ${isThreshSuccess && isColorSuccess ? "roll-max" : !isThreshSuccess && isColorFail ? "roll-min" : ""}">${isThreshSuccess ? (tree.chanceSuccessText || "Success!") : (tree.chanceFailureText || "Failure")}</span>`
				: `<span class="roll ${allMax ? "roll-max" : allMin ? "roll-min" : ""}">${result}</span>`;

			const title = `${rolledBy.name ? `${rolledBy.name} \u2014 ` : ""}${lbl ? `${lbl}: ` : ""}${tree}`;

			const message = opts.fnGetMessage ? opts.fnGetMessage(result) : null;
			ExtensionUtil.doSendRoll({
				dice: tree.toString(),
				result,
				rolledBy: rolledBy.name,
				label: [lbl, message].filter(Boolean).join(" \u2013 "),
			});

			if (!opts.isHidden) {
				$out.append(`
					<div class="out-roll-item" title="${title}">
						<div>
							${lbl ? `<span class="roll-label">${lbl}: </span>` : ""}
							${totalPart}
							${ptTarget}
							<span class="all-rolls ve-muted">${fullHtml}</span>
							${message ? `<span class="message">${message}</span>` : ""}
						</div>
						<div class="out-roll-item-button-wrp">
							<button title="Copy to input" class="btn btn-default btn-xs btn-copy-roll" onclick="Renderer.dice._$iptRoll.val('${tree.toString().replace(/\s+/g, "")}'); Renderer.dice._$iptRoll.focus()"><span class="glyphicon glyphicon-pencil"></span></button>
						</div>
					</div>`);

				Renderer.dice._scrollBottom();
			}

			return result;
		} else {
			if (!opts.isHidden) {
				$out.append(`<div class="out-roll-item">Invalid input! Try &quot;/help&quot;</div>`);
				Renderer.dice._scrollBottom();
			}
			return null;
		}
	},

	_pHandleRoll2_manual (tree, rolledBy, opts) {
		opts = opts || {};

		if (!tree) return JqueryUtil.doToast({type: "danger", content: `Invalid roll input!`});

		const title = (rolledBy.label || "").toTitleCase() || "Roll Dice";
		const $dispDice = $(`<div class="p-2 bold ve-flex-vh-center rll__prompt-header">${tree.toString()}</div>`);
		if (opts.isResultUsed) {
			return InputUiUtil.pGetUserNumber({
				title,
				$elePre: $dispDice,
			});
		} else {
			const {$modalInner} = UiUtil.getShowModal({
				title,
				isMinHeight0: true,
			});
			$dispDice.appendTo($modalInner);
			return null;
		}
	},

	_showMessage (message, rolledBy) {
		Renderer.dice._showBox();
		Renderer.dice._checkHandleName(rolledBy.name);
		const $out = Renderer.dice._$lastRolledBy;
		$out.append(`<div class="out-roll-item out-roll-item--message">${message}</div>`);
		Renderer.dice._scrollBottom();
	},

	_showInvalid () {
		Renderer.dice._showMessage("Invalid input! Try &quot;/help&quot;", Renderer.dice.SYSTEM_USER);
	},

	_validCommands: new Set(["/c", "/cls", "/clear", "/iterroll"]),
	async _pHandleCommand (com, rolledBy) {
		Renderer.dice._showMessage(`<span class="out-roll-item-code">${com}</span>`, rolledBy); // parrot the user's command back to them

		const comParsed = Renderer.dice._getParsedCommand(com);
		const [comOp] = comParsed;

		if (comOp === "/help" || comOp === "/h") {
			Renderer.dice._showMessage(
				`<ul class="rll__list">
					<li>Keep highest; <span class="out-roll-item-code">4d6kh3</span></li>
					<li>Drop lowest; <span class="out-roll-item-code">4d6dl1</span></li>
					<li>Drop highest; <span class="out-roll-item-code">3d4dh1</span></li>
					<li>Keep lowest; <span class="out-roll-item-code">3d4kl1</span></li>

					<li>Reroll equal; <span class="out-roll-item-code">2d4r1</span></li>
					<li>Reroll less; <span class="out-roll-item-code">2d4r&lt;2</span></li>
					<li>Reroll less or equal; <span class="out-roll-item-code">2d4r&lt;=2</span></li>
					<li>Reroll greater; <span class="out-roll-item-code">2d4r&gt;2</span></li>
					<li>Reroll greater equal; <span class="out-roll-item-code">2d4r&gt;=3</span></li>

					<li>Explode equal; <span class="out-roll-item-code">2d4x4</span></li>
					<li>Explode less; <span class="out-roll-item-code">2d4x&lt;2</span></li>
					<li>Explode less or equal; <span class="out-roll-item-code">2d4x&lt;=2</span></li>
					<li>Explode greater; <span class="out-roll-item-code">2d4x&gt;2</span></li>
					<li>Explode greater equal; <span class="out-roll-item-code">2d4x&gt;=3</span></li>

					<li>Count Successes equal; <span class="out-roll-item-code">2d4cs=4</span></li>
					<li>Count Successes less; <span class="out-roll-item-code">2d4cs&lt;2</span></li>
					<li>Count Successes less or equal; <span class="out-roll-item-code">2d4cs&lt;=2</span></li>
					<li>Count Successes greater; <span class="out-roll-item-code">2d4cs&gt;2</span></li>
					<li>Count Successes greater equal; <span class="out-roll-item-code">2d4cs&gt;=3</span></li>

					<li>Margin of Success; <span class="out-roll-item-code">2d4ms=4</span></li>

					<li>Dice pools; <span class="out-roll-item-code">{2d8, 1d6}</span></li>
					<li>Dice pools with modifiers; <span class="out-roll-item-code">{1d20+7, 10}kh1</span></li>

					<li>Rounding; <span class="out-roll-item-code">floor(1.5)</span>, <span class="out-roll-item-code">ceil(1.5)</span>, <span class="out-roll-item-code">round(1.5)</span></li>

					<li>Average; <span class="out-roll-item-code">avg(8d6)</span></li>
					<li>Maximize dice; <span class="out-roll-item-code">dmax(8d6)</span></li>
					<li>Minimize dice; <span class="out-roll-item-code">dmin(8d6)</span></li>

					<li>Other functions; <span class="out-roll-item-code">sign(1d6-3)</span>, <span class="out-roll-item-code">abs(1d6-3)</span>, ...etc.</li>
				</ul>
				Up and down arrow keys cycle input history.<br>
				Anything before a colon is treated as a label (<span class="out-roll-item-code">Fireball: 8d6</span>)<br>
Use <span class="out-roll-item-code">/macro list</span> to list saved macros.<br>
				Use <span class="out-roll-item-code">/macro add myName 1d2+3</span> to add (or update) a macro. Macro names should not contain spaces or hashes.<br>
				Use <span class="out-roll-item-code">/macro remove myName</span> to remove a macro.<br>
				Use <span class="out-roll-item-code">#myName</span> to roll a macro.<br>
				Use <span class="out-roll-item-code">/iterroll roll count [target]</span> to roll multiple times, optionally against a target.
				Use <span class="out-roll-item-code">/clear</span> to clear the roller.`,
				Renderer.dice.SYSTEM_USER,
			);
			return;
		}

		if (comOp === "/macro") {
			const [, mode, ...others] = comParsed;

			if (!["list", "add", "remove", "clear"].includes(mode)) Renderer.dice._showInvalid();
			else {
				switch (mode) {
					case "list":
						if (!others.length) {
							Object.keys(Renderer.dice.storage).forEach(name => {
								Renderer.dice._showMessage(`<span class="out-roll-item-code">#${name}</span> \u2014 ${Renderer.dice.storage[name]}`, Renderer.dice.SYSTEM_USER);
							});
						} else {
							Renderer.dice._showInvalid();
						}
						break;
					case "add": {
						if (others.length === 2) {
							const [name, macro] = others;
							if (name.includes(" ") || name.includes("#")) Renderer.dice._showInvalid();
							else {
								Renderer.dice.storage[name] = macro;
								await Renderer.dice._pSaveMacros();
								Renderer.dice._showMessage(`Saved macro <span class="out-roll-item-code">#${name}</span>`, Renderer.dice.SYSTEM_USER);
							}
						} else {
							Renderer.dice._showInvalid();
						}
						break;
					}
					case "remove":
						if (others.length === 1) {
							if (Renderer.dice.storage[others[0]]) {
								delete Renderer.dice.storage[others[0]];
								await Renderer.dice._pSaveMacros();
								Renderer.dice._showMessage(`Removed macro <span class="out-roll-item-code">#${others[0]}</span>`, Renderer.dice.SYSTEM_USER);
							} else {
								Renderer.dice._showMessage(`Macro <span class="out-roll-item-code">#${others[0]}</span> not found`, Renderer.dice.SYSTEM_USER);
							}
						} else {
							Renderer.dice._showInvalid();
						}
						break;
				}
			}
			return;
		}

		if (Renderer.dice._validCommands.has(comOp)) {
			switch (comOp) {
				case "/c":
				case "/cls":
				case "/clear":
					Renderer.dice._$outRoll.empty();
					Renderer.dice._$lastRolledBy.empty();
					Renderer.dice._$lastRolledBy = null;
					return;

				case "/iterroll": {
					let [, exp, count, target] = comParsed;

					if (!exp) return Renderer.dice._showInvalid();
					const wrpTree = Renderer.dice.lang.getTree3(exp);
					if (!wrpTree) return Renderer.dice._showInvalid();

					count = count && !isNaN(count) ? Number(count) : 1;
					target = target && !isNaN(target) ? Number(target) : undefined;

					for (let i = 0; i < count; ++i) {
						await Renderer.dice.pRoll2(
							exp,
							{
								name: "Anon",
							},
							{
								target,
							},
						);
					}
				}
			}
			return;
		}

		Renderer.dice._showInvalid();
	},

	async _pSaveMacros () {
		await StorageUtil.pSet(VeCt.STORAGE_ROLLER_MACRO, Renderer.dice.storage);
	},

	_getParsedCommand (str) {
		// TODO(Future) this is probably too naive
		return str.split(/\s+/);
	},

	_pHandleSavedRoll (id, rolledBy, opts) {
		id = id.replace(/^#/, "");
		const macro = Renderer.dice.storage[id];
		if (macro) {
			rolledBy.label = id;
			const wrpTree = Renderer.dice.lang.getTree3(macro);
			return Renderer.dice._pHandleRoll2(wrpTree, rolledBy, opts);
		} else Renderer.dice._showMessage(`Macro <span class="out-roll-item-code">#${id}</span> not found`, Renderer.dice.SYSTEM_USER);
	},

	addRoll ({rolledBy, html, $ele}) {
		if (html && $ele) throw new Error(`Must specify one of html or $ele!`);

		if (html != null && !html.trim()) return;

		Renderer.dice._showBox();
		Renderer.dice._checkHandleName(rolledBy.name);

		if (html) {
			Renderer.dice._$lastRolledBy.append(`<div class="out-roll-item" title="${(rolledBy.name || "").qq()}">${html}</div>`);
		} else {
			$$`<div class="out-roll-item" title="${(rolledBy.name || "").qq()}">${$ele}</div>`
				.appendTo(Renderer.dice._$lastRolledBy);
		}

		Renderer.dice._scrollBottom();
	},

	addElement ({rolledBy, html, $ele}) {
		if (html && $ele) throw new Error(`Must specify one of html or $ele!`);

		if (html != null && !html.trim()) return;

		Renderer.dice._showBox();
		Renderer.dice._checkHandleName(rolledBy.name);

		if (html) {
			Renderer.dice._$lastRolledBy.append(`<div class="out-roll-item out-roll-item--message" title="${(rolledBy.name || "").qq()}">${html}</div>`);
		} else {
			$$`<div class="out-roll-item out-roll-item--message" title="${(rolledBy.name || "").qq()}">${$ele}</div>`
				.appendTo(Renderer.dice._$lastRolledBy);
		}

		Renderer.dice._scrollBottom();
	},

	_checkHandleName (name) {
		if (!Renderer.dice._$lastRolledBy || Renderer.dice._$lastRolledBy.data("name") !== name) {
			Renderer.dice._$outRoll.prepend(`<div class="ve-muted out-roll-id">${name}</div>`);
			Renderer.dice._$lastRolledBy = $(`<div class="out-roll-wrp"></div>`).data("name", name);
			Renderer.dice._$outRoll.prepend(Renderer.dice._$lastRolledBy);
		}
	},
};

Renderer.dice.util = {
	getReducedMeta (meta) {
		return {pb: meta.pb};
	},
};

Renderer.dice.lang = {
	// region Public API
	validate3 (str) {
		str = str.trim();

		// region Lexing
		let lexed;
		try {
			lexed = Renderer.dice.lang._lex3(str).lexed;
		} catch (e) {
			return e.message;
		}
		// endregion

		// region Parsing
		try {
			Renderer.dice.lang._parse3(lexed);
		} catch (e) {
			return e.message;
		}
		// endregion

		return null;
	},

	getTree3 (str, isSilent = true) {
		str = str.trim();
		if (isSilent) {
			try {
				const {lexed, lexedMeta} = Renderer.dice.lang._lex3(str);
				return {tree: Renderer.dice.lang._parse3(lexed), meta: lexedMeta};
			} catch (e) {
				return null;
			}
		} else {
			const {lexed, lexedMeta} = Renderer.dice.lang._lex3(str);
			return {tree: Renderer.dice.lang._parse3(lexed), meta: lexedMeta};
		}
	},
	// endregion

	// region Lexer
	_M_NUMBER_CHAR: /[0-9.]/,
	_M_SYMBOL_CHAR: /[-+/*^=><florceidhkxunavgsmpbtqw,]/,

	_M_NUMBER: /^[\d.,]+$/,
	_lex3 (str) {
		const self = {
			tokenStack: [],
			parenCount: 0,
			braceCount: 0,
			mode: null,
			token: "",
			hasPb: false,
			hasSummonSpellLevel: false,
			hasSummonClassLevel: false,
		};

		str = str
			.trim()
			.toLowerCase()
			// region Convert some natural language
			.replace(/\s*?\bplus\b\s*?/g, " + ")
			.replace(/\s*?\bminus\b\s*?/g, " - ")
			.replace(/\s*?\btimes\b\s*?/g, " * ")
			.replace(/\s*?\bover\b\s*?/g, " / ")
			.replace(/\s*?\bdivided by\b\s*?/g, " / ")
			// endregion
			.replace(/\s+/g, "")
			.replace(/[\u2012\u2013\u2014]/g, "-") // convert dashes
			.replace(/[×]/g, "*") // convert mult signs
			.replace(/\*\*/g, "^") // convert ** to ^
			.replace(/÷/g, "/") // convert div signs
			.replace(/--/g, "+") // convert double negatives
			.replace(/\+-|-\+/g, "-") // convert negatives
		;

		if (!str) return {lexed: [], lexedMeta: {}};

		this._lex3_lex(self, str);

		return {lexed: self.tokenStack, lexedMeta: {hasPb: self.hasPb, hasSummonSpellLevel: self.hasSummonSpellLevel, hasSummonClassLevel: self.hasSummonClassLevel}};
	},

	_lex3_lex (self, l) {
		const len = l.length;

		for (let i = 0; i < len; ++i) {
			const c = l[i];

			switch (c) {
				case "(":
					self.parenCount++;
					this._lex3_outputToken(self);
					self.token = "(";
					this._lex3_outputToken(self);
					break;
				case ")":
					self.parenCount--;
					if (self.parenCount < 0) throw new Error(`Syntax error: closing <code>)</code> without opening <code>(</code>`);
					this._lex3_outputToken(self);
					self.token = ")";
					this._lex3_outputToken(self);
					break;
				case "{":
					self.braceCount++;
					this._lex3_outputToken(self);
					self.token = "{";
					this._lex3_outputToken(self);
					break;
				case "}":
					self.braceCount--;
					if (self.parenCount < 0) throw new Error(`Syntax error: closing <code>}</code> without opening <code>(</code>`);
					this._lex3_outputToken(self);
					self.token = "}";
					this._lex3_outputToken(self);
					break;
				// single-character operators
				case "+": case "-": case "*": case "/": case "^": case ",":
					this._lex3_outputToken(self);
					self.token += c;
					this._lex3_outputToken(self);
					break;
				default: {
					if (Renderer.dice.lang._M_NUMBER_CHAR.test(c)) {
						if (self.mode === "symbol") this._lex3_outputToken(self);
						self.token += c;
						self.mode = "text";
					} else if (Renderer.dice.lang._M_SYMBOL_CHAR.test(c)) {
						if (self.mode === "text") this._lex3_outputToken(self);
						self.token += c;
						self.mode = "symbol";
					} else throw new Error(`Syntax error: unexpected character <code>${c}</code>`);
					break;
				}
			}
		}

		// empty the stack of any remaining content
		this._lex3_outputToken(self);
	},

	_lex3_outputToken (self) {
		if (!self.token) return;

		switch (self.token) {
			case "(": self.tokenStack.push(Renderer.dice.tk.PAREN_OPEN); break;
			case ")": self.tokenStack.push(Renderer.dice.tk.PAREN_CLOSE); break;
			case "{": self.tokenStack.push(Renderer.dice.tk.BRACE_OPEN); break;
			case "}": self.tokenStack.push(Renderer.dice.tk.BRACE_CLOSE); break;
			case ",": self.tokenStack.push(Renderer.dice.tk.COMMA); break;
			case "+": self.tokenStack.push(Renderer.dice.tk.ADD); break;
			case "-": self.tokenStack.push(Renderer.dice.tk.SUB); break;
			case "*": self.tokenStack.push(Renderer.dice.tk.MULT); break;
			case "/": self.tokenStack.push(Renderer.dice.tk.DIV); break;
			case "^": self.tokenStack.push(Renderer.dice.tk.POW); break;
			case "pb": self.tokenStack.push(Renderer.dice.tk.PB); self.hasPb = true; break;
			case "summonspelllevel": self.tokenStack.push(Renderer.dice.tk.SUMMON_SPELL_LEVEL); self.hasSummonSpellLevel = true; break;
			case "summonclasslevel": self.tokenStack.push(Renderer.dice.tk.SUMMON_CLASS_LEVEL); self.hasSummonClassLevel = true; break;
			case "floor": self.tokenStack.push(Renderer.dice.tk.FLOOR); break;
			case "ceil": self.tokenStack.push(Renderer.dice.tk.CEIL); break;
			case "round": self.tokenStack.push(Renderer.dice.tk.ROUND); break;
			case "avg": self.tokenStack.push(Renderer.dice.tk.AVERAGE); break;
			case "dmax": self.tokenStack.push(Renderer.dice.tk.DMAX); break;
			case "dmin": self.tokenStack.push(Renderer.dice.tk.DMIN); break;
			case "sign": self.tokenStack.push(Renderer.dice.tk.SIGN); break;
			case "abs": self.tokenStack.push(Renderer.dice.tk.ABS); break;
			case "cbrt": self.tokenStack.push(Renderer.dice.tk.CBRT); break;
			case "sqrt": self.tokenStack.push(Renderer.dice.tk.SQRT); break;
			case "exp": self.tokenStack.push(Renderer.dice.tk.EXP); break;
			case "log": self.tokenStack.push(Renderer.dice.tk.LOG); break;
			case "random": self.tokenStack.push(Renderer.dice.tk.RANDOM); break;
			case "trunc": self.tokenStack.push(Renderer.dice.tk.TRUNC); break;
			case "pow": self.tokenStack.push(Renderer.dice.tk.POW); break;
			case "max": self.tokenStack.push(Renderer.dice.tk.MAX); break;
			case "min": self.tokenStack.push(Renderer.dice.tk.MIN); break;
			case "d": self.tokenStack.push(Renderer.dice.tk.DICE); break;
			case "dh": self.tokenStack.push(Renderer.dice.tk.DROP_HIGHEST); break;
			case "kh": self.tokenStack.push(Renderer.dice.tk.KEEP_HIGHEST); break;
			case "dl": self.tokenStack.push(Renderer.dice.tk.DROP_LOWEST); break;
			case "kl": self.tokenStack.push(Renderer.dice.tk.KEEP_LOWEST); break;
			case "r": self.tokenStack.push(Renderer.dice.tk.REROLL_EXACT); break;
			case "r>": self.tokenStack.push(Renderer.dice.tk.REROLL_GT); break;
			case "r>=": self.tokenStack.push(Renderer.dice.tk.REROLL_GTEQ); break;
			case "r<": self.tokenStack.push(Renderer.dice.tk.REROLL_LT); break;
			case "r<=": self.tokenStack.push(Renderer.dice.tk.REROLL_LTEQ); break;
			case "x": self.tokenStack.push(Renderer.dice.tk.EXPLODE_EXACT); break;
			case "x>": self.tokenStack.push(Renderer.dice.tk.EXPLODE_GT); break;
			case "x>=": self.tokenStack.push(Renderer.dice.tk.EXPLODE_GTEQ); break;
			case "x<": self.tokenStack.push(Renderer.dice.tk.EXPLODE_LT); break;
			case "x<=": self.tokenStack.push(Renderer.dice.tk.EXPLODE_LTEQ); break;
			case "cs=": self.tokenStack.push(Renderer.dice.tk.COUNT_SUCCESS_EXACT); break;
			case "cs>": self.tokenStack.push(Renderer.dice.tk.COUNT_SUCCESS_GT); break;
			case "cs>=": self.tokenStack.push(Renderer.dice.tk.COUNT_SUCCESS_GTEQ); break;
			case "cs<": self.tokenStack.push(Renderer.dice.tk.COUNT_SUCCESS_LT); break;
			case "cs<=": self.tokenStack.push(Renderer.dice.tk.COUNT_SUCCESS_LTEQ); break;
			case "ms=": self.tokenStack.push(Renderer.dice.tk.MARGIN_SUCCESS_EXACT); break;
			case "ms>": self.tokenStack.push(Renderer.dice.tk.MARGIN_SUCCESS_GT); break;
			case "ms>=": self.tokenStack.push(Renderer.dice.tk.MARGIN_SUCCESS_GTEQ); break;
			case "ms<": self.tokenStack.push(Renderer.dice.tk.MARGIN_SUCCESS_LT); break;
			case "ms<=": self.tokenStack.push(Renderer.dice.tk.MARGIN_SUCCESS_LTEQ); break;
			default: {
				if (Renderer.dice.lang._M_NUMBER.test(self.token)) {
					if (self.token.split(Parser._decimalSeparator).length > 2) throw new Error(`Syntax error: too many decimal separators <code>${self.token}</code>`);
					self.tokenStack.push(Renderer.dice.tk.NUMBER(self.token));
				} else throw new Error(`Syntax error: unexpected token <code>${self.token}</code>`);
			}
		}

		self.token = "";
	},
	// endregion

	// region Parser
	_parse3 (lexed) {
		const self = {
			ixSym: -1,
			syms: lexed,
			sym: null,
			lastAccepted: null,
			// Workaround for comma-separated numbers--if we're e.g. inside a dice pool, treat the commas as dice pool
			//   separators. Otherwise, merge together adjacent numbers, to convert e.g. "1,000,000" to "1000000".
			isIgnoreCommas: true,
		};

		this._parse3_nextSym(self);
		return this._parse3_expression(self);
	},

	_parse3_nextSym (self) {
		const cur = self.syms[self.ixSym];
		self.ixSym++;
		self.sym = self.syms[self.ixSym];
		return cur;
	},

	_parse3_match (self, symbol) {
		if (self.sym == null) return false;
		if (symbol.type) symbol = symbol.type; // If it's a typed token, convert it to its underlying type
		return self.sym.type === symbol;
	},

	_parse3_accept (self, symbol) {
		if (this._parse3_match(self, symbol)) {
			const out = self.sym;
			this._parse3_nextSym(self);
			self.lastAccepted = out;
			return out;
		}
		return false;
	},

	_parse3_expect (self, symbol) {
		const accepted = this._parse3_accept(self, symbol);
		if (accepted) return accepted;
		if (self.sym) throw new Error(`Unexpected input: Expected <code>${symbol}</code> but found <code>${self.sym}</code>`);
		else throw new Error(`Unexpected end of input: Expected <code>${symbol}</code>`);
	},

	_parse3_factor (self, {isSilent = false} = {}) {
		if (this._parse3_accept(self, Renderer.dice.tk.TYP_NUMBER)) {
			// Workaround for comma-separated numbers
			if (self.isIgnoreCommas) {
				// Combine comma-separated parts
				const syms = [self.lastAccepted];
				while (this._parse3_accept(self, Renderer.dice.tk.COMMA)) {
					const sym = this._parse3_expect(self, Renderer.dice.tk.TYP_NUMBER);
					syms.push(sym);
				}
				const sym = Renderer.dice.tk.NUMBER(syms.map(it => it.value).join(""));
				return new Renderer.dice.parsed.Factor(sym);
			}

			return new Renderer.dice.parsed.Factor(self.lastAccepted);
		} else if (this._parse3_accept(self, Renderer.dice.tk.PB)) {
			return new Renderer.dice.parsed.Factor(Renderer.dice.tk.PB);
		} else if (this._parse3_accept(self, Renderer.dice.tk.SUMMON_SPELL_LEVEL)) {
			return new Renderer.dice.parsed.Factor(Renderer.dice.tk.SUMMON_SPELL_LEVEL);
		} else if (this._parse3_accept(self, Renderer.dice.tk.SUMMON_CLASS_LEVEL)) {
			return new Renderer.dice.parsed.Factor(Renderer.dice.tk.SUMMON_CLASS_LEVEL);
		} else if (
			// Single-arg functions
			this._parse3_match(self, Renderer.dice.tk.FLOOR)
			|| this._parse3_match(self, Renderer.dice.tk.CEIL)
			|| this._parse3_match(self, Renderer.dice.tk.ROUND)
			|| this._parse3_match(self, Renderer.dice.tk.AVERAGE)
			|| this._parse3_match(self, Renderer.dice.tk.DMAX)
			|| this._parse3_match(self, Renderer.dice.tk.DMIN)
			|| this._parse3_match(self, Renderer.dice.tk.SIGN)
			|| this._parse3_match(self, Renderer.dice.tk.ABS)
			|| this._parse3_match(self, Renderer.dice.tk.CBRT)
			|| this._parse3_match(self, Renderer.dice.tk.SQRT)
			|| this._parse3_match(self, Renderer.dice.tk.EXP)
			|| this._parse3_match(self, Renderer.dice.tk.LOG)
			|| this._parse3_match(self, Renderer.dice.tk.RANDOM)
			|| this._parse3_match(self, Renderer.dice.tk.TRUNC)
		) {
			const children = [];

			children.push(this._parse3_nextSym(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_OPEN);
			children.push(this._parse3_expression(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_CLOSE);

			return new Renderer.dice.parsed.Function(children);
		} else if (
			// 2-arg functions
			this._parse3_match(self, Renderer.dice.tk.POW)
		) {
			self.isIgnoreCommas = false;

			const children = [];

			children.push(this._parse3_nextSym(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_OPEN);
			children.push(this._parse3_expression(self));
			this._parse3_expect(self, Renderer.dice.tk.COMMA);
			children.push(this._parse3_expression(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_CLOSE);

			self.isIgnoreCommas = true;

			return new Renderer.dice.parsed.Function(children);
		} else if (
			// N-arg functions
			this._parse3_match(self, Renderer.dice.tk.MAX)
			|| this._parse3_match(self, Renderer.dice.tk.MIN)
		) {
			self.isIgnoreCommas = false;

			const children = [];

			children.push(this._parse3_nextSym(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_OPEN);
			children.push(this._parse3_expression(self));
			while (this._parse3_accept(self, Renderer.dice.tk.COMMA)) children.push(this._parse3_expression(self));
			this._parse3_expect(self, Renderer.dice.tk.PAREN_CLOSE);

			self.isIgnoreCommas = true;

			return new Renderer.dice.parsed.Function(children);
		} else if (this._parse3_accept(self, Renderer.dice.tk.PAREN_OPEN)) {
			const exp = this._parse3_expression(self);
			this._parse3_expect(self, Renderer.dice.tk.PAREN_CLOSE);
			return new Renderer.dice.parsed.Factor(exp, {hasParens: true});
		} else if (this._parse3_accept(self, Renderer.dice.tk.BRACE_OPEN)) {
			self.isIgnoreCommas = false;

			const children = [];

			children.push(this._parse3_expression(self));
			while (this._parse3_accept(self, Renderer.dice.tk.COMMA)) children.push(this._parse3_expression(self));

			this._parse3_expect(self, Renderer.dice.tk.BRACE_CLOSE);

			self.isIgnoreCommas = true;

			const modPart = [];
			this._parse3__dice_modifiers(self, modPart);

			return new Renderer.dice.parsed.Pool(children, modPart[0]);
		} else {
			if (isSilent) return null;

			if (self.sym) throw new Error(`Unexpected input: <code>${self.sym}</code>`);
			else throw new Error(`Unexpected end of input`);
		}
	},

	_parse3_dice (self) {
		const children = [];

		// if we've omitted the X in XdY, add it here
		if (this._parse3_match(self, Renderer.dice.tk.DICE)) children.push(new Renderer.dice.parsed.Factor(Renderer.dice.tk.NUMBER(1)));
		else children.push(this._parse3_factor(self));

		while (this._parse3_match(self, Renderer.dice.tk.DICE)) {
			this._parse3_nextSym(self);
			children.push(this._parse3_factor(self));
			this._parse3__dice_modifiers(self, children);
		}
		return new Renderer.dice.parsed.Dice(children);
	},

	_parse3__dice_modifiers (self, children) { // used in both dice and dice pools
		// Collect together all dice mods
		const modsMeta = new Renderer.dice.lang.DiceModMeta();

		while (
			this._parse3_match(self, Renderer.dice.tk.DROP_HIGHEST)
			|| this._parse3_match(self, Renderer.dice.tk.KEEP_HIGHEST)
			|| this._parse3_match(self, Renderer.dice.tk.DROP_LOWEST)
			|| this._parse3_match(self, Renderer.dice.tk.KEEP_LOWEST)
			|| this._parse3_match(self, Renderer.dice.tk.REROLL_EXACT)
			|| this._parse3_match(self, Renderer.dice.tk.REROLL_GT)
			|| this._parse3_match(self, Renderer.dice.tk.REROLL_GTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.REROLL_LT)
			|| this._parse3_match(self, Renderer.dice.tk.REROLL_LTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.EXPLODE_EXACT)
			|| this._parse3_match(self, Renderer.dice.tk.EXPLODE_GT)
			|| this._parse3_match(self, Renderer.dice.tk.EXPLODE_GTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.EXPLODE_LT)
			|| this._parse3_match(self, Renderer.dice.tk.EXPLODE_LTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.COUNT_SUCCESS_EXACT)
			|| this._parse3_match(self, Renderer.dice.tk.COUNT_SUCCESS_GT)
			|| this._parse3_match(self, Renderer.dice.tk.COUNT_SUCCESS_GTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.COUNT_SUCCESS_LT)
			|| this._parse3_match(self, Renderer.dice.tk.COUNT_SUCCESS_LTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.MARGIN_SUCCESS_EXACT)
			|| this._parse3_match(self, Renderer.dice.tk.MARGIN_SUCCESS_GT)
			|| this._parse3_match(self, Renderer.dice.tk.MARGIN_SUCCESS_GTEQ)
			|| this._parse3_match(self, Renderer.dice.tk.MARGIN_SUCCESS_LT)
			|| this._parse3_match(self, Renderer.dice.tk.MARGIN_SUCCESS_LTEQ)
		) {
			const nxtSym = this._parse3_nextSym(self);
			const nxtFactor = this._parse3__dice_modifiers_nxtFactor(self, nxtSym);

			if (nxtSym.isSuccessMode) modsMeta.isSuccessMode = true;
			modsMeta.mods.push({modSym: nxtSym, numSym: nxtFactor});
		}

		if (modsMeta.mods.length) children.push(modsMeta);
	},

	_parse3__dice_modifiers_nxtFactor (self, nxtSym) {
		if (nxtSym.diceModifierImplicit == null) return this._parse3_factor(self, {isSilent: true});

		const fallback = new Renderer.dice.parsed.Factor(Renderer.dice.tk.NUMBER(nxtSym.diceModifierImplicit));
		if (self.sym == null) return fallback;

		const out = this._parse3_factor(self, {isSilent: true});
		if (out) return out;

		return fallback;
	},

	_parse3_exponent (self) {
		const children = [];
		children.push(this._parse3_dice(self));
		while (this._parse3_match(self, Renderer.dice.tk.POW)) {
			this._parse3_nextSym(self);
			children.push(this._parse3_dice(self));
		}
		return new Renderer.dice.parsed.Exponent(children);
	},

	_parse3_term (self) {
		const children = [];
		children.push(this._parse3_exponent(self));
		while (this._parse3_match(self, Renderer.dice.tk.MULT) || this._parse3_match(self, Renderer.dice.tk.DIV)) {
			children.push(this._parse3_nextSym(self));
			children.push(this._parse3_exponent(self));
		}
		return new Renderer.dice.parsed.Term(children);
	},

	_parse3_expression (self) {
		const children = [];
		if (this._parse3_match(self, Renderer.dice.tk.ADD) || this._parse3_match(self, Renderer.dice.tk.SUB)) children.push(this._parse3_nextSym(self));
		children.push(this._parse3_term(self));
		while (this._parse3_match(self, Renderer.dice.tk.ADD) || this._parse3_match(self, Renderer.dice.tk.SUB)) {
			children.push(this._parse3_nextSym(self));
			children.push(this._parse3_term(self));
		}
		return new Renderer.dice.parsed.Expression(children);
	},
	// endregion

	// region Utilities
	DiceModMeta: class {
		constructor () {
			this.isDiceModifierGroup = true;
			this.isSuccessMode = false;
			this.mods = [];
		}
	},
	// endregion
};

Renderer.dice.tk = {
	Token: class {
		/**
		 * @param type
		 * @param value
		 * @param asString
		 * @param [opts] Options object.
		 * @param [opts.isDiceModifier] If the token is a dice modifier, e.g. "dl"
		 * @param [opts.diceModifierImplicit] If the dice modifier has an implicit value (e.g. "kh" is shorthand for "kh1")
		 * @param [opts.isSuccessMode] If the token is a "success"-based dice modifier, e.g. "cs="
		 */
		constructor (type, value, asString, opts) {
			opts = opts || {};
			this.type = type;
			this.value = value;
			this._asString = asString;
			if (opts.isDiceModifier) this.isDiceModifier = true;
			if (opts.diceModifierImplicit) this.diceModifierImplicit = true;
			if (opts.isSuccessMode) this.isSuccessMode = true;
		}

		eq (other) { return other && other.type === this.type; }

		toString () {
			if (this._asString) return this._asString;
			return this.toDebugString();
		}

		toDebugString () { return `${this.type}${this.value ? ` :: ${this.value}` : ""}`; }
	},

	_new (type, asString, opts) { return new Renderer.dice.tk.Token(type, null, asString, opts); },

	TYP_NUMBER: "NUMBER",
	TYP_DICE: "DICE",
	TYP_SYMBOL: "SYMBOL", // Cannot be created by lexing, only parsing

	NUMBER (val) { return new Renderer.dice.tk.Token(Renderer.dice.tk.TYP_NUMBER, val); },
};
Renderer.dice.tk.PAREN_OPEN = Renderer.dice.tk._new("PAREN_OPEN", "(");
Renderer.dice.tk.PAREN_CLOSE = Renderer.dice.tk._new("PAREN_CLOSE", ")");
Renderer.dice.tk.BRACE_OPEN = Renderer.dice.tk._new("BRACE_OPEN", "{");
Renderer.dice.tk.BRACE_CLOSE = Renderer.dice.tk._new("BRACE_CLOSE", "}");
Renderer.dice.tk.COMMA = Renderer.dice.tk._new("COMMA", ",");
Renderer.dice.tk.ADD = Renderer.dice.tk._new("ADD", "+");
Renderer.dice.tk.SUB = Renderer.dice.tk._new("SUB", "-");
Renderer.dice.tk.MULT = Renderer.dice.tk._new("MULT", "*");
Renderer.dice.tk.DIV = Renderer.dice.tk._new("DIV", "/");
Renderer.dice.tk.POW = Renderer.dice.tk._new("POW", "^");
Renderer.dice.tk.PB = Renderer.dice.tk._new("PB", "pb");
Renderer.dice.tk.SUMMON_SPELL_LEVEL = Renderer.dice.tk._new("SUMMON_SPELL_LEVEL", "summonspelllevel");
Renderer.dice.tk.SUMMON_CLASS_LEVEL = Renderer.dice.tk._new("SUMMON_CLASS_LEVEL", "summonclasslevel");
Renderer.dice.tk.FLOOR = Renderer.dice.tk._new("FLOOR", "floor");
Renderer.dice.tk.CEIL = Renderer.dice.tk._new("CEIL", "ceil");
Renderer.dice.tk.ROUND = Renderer.dice.tk._new("ROUND", "round");
Renderer.dice.tk.AVERAGE = Renderer.dice.tk._new("AVERAGE", "avg");
Renderer.dice.tk.DMAX = Renderer.dice.tk._new("DMAX", "avg");
Renderer.dice.tk.DMIN = Renderer.dice.tk._new("DMIN", "avg");
Renderer.dice.tk.SIGN = Renderer.dice.tk._new("SIGN", "sign");
Renderer.dice.tk.ABS = Renderer.dice.tk._new("ABS", "abs");
Renderer.dice.tk.CBRT = Renderer.dice.tk._new("CBRT", "cbrt");
Renderer.dice.tk.SQRT = Renderer.dice.tk._new("SQRT", "sqrt");
Renderer.dice.tk.EXP = Renderer.dice.tk._new("EXP", "exp");
Renderer.dice.tk.LOG = Renderer.dice.tk._new("LOG", "log");
Renderer.dice.tk.RANDOM = Renderer.dice.tk._new("RANDOM", "random");
Renderer.dice.tk.TRUNC = Renderer.dice.tk._new("TRUNC", "trunc");
Renderer.dice.tk.POW = Renderer.dice.tk._new("POW", "pow");
Renderer.dice.tk.MAX = Renderer.dice.tk._new("MAX", "max");
Renderer.dice.tk.MIN = Renderer.dice.tk._new("MIN", "min");
Renderer.dice.tk.DICE = Renderer.dice.tk._new("DICE", "d");
Renderer.dice.tk.DROP_HIGHEST = Renderer.dice.tk._new("DH", "dh", {isDiceModifier: true, diceModifierImplicit: 1});
Renderer.dice.tk.KEEP_HIGHEST = Renderer.dice.tk._new("KH", "kh", {isDiceModifier: true, diceModifierImplicit: 1});
Renderer.dice.tk.DROP_LOWEST = Renderer.dice.tk._new("DL", "dl", {isDiceModifier: true, diceModifierImplicit: 1});
Renderer.dice.tk.KEEP_LOWEST = Renderer.dice.tk._new("KL", "kl", {isDiceModifier: true, diceModifierImplicit: 1});
Renderer.dice.tk.REROLL_EXACT = Renderer.dice.tk._new("REROLL", "r", {isDiceModifier: true});
Renderer.dice.tk.REROLL_GT = Renderer.dice.tk._new("REROLL_GT", "r>", {isDiceModifier: true});
Renderer.dice.tk.REROLL_GTEQ = Renderer.dice.tk._new("REROLL_GTEQ", "r>=", {isDiceModifier: true});
Renderer.dice.tk.REROLL_LT = Renderer.dice.tk._new("REROLL_LT", "r<", {isDiceModifier: true});
Renderer.dice.tk.REROLL_LTEQ = Renderer.dice.tk._new("REROLL_LTEQ", "r<=", {isDiceModifier: true});
Renderer.dice.tk.EXPLODE_EXACT = Renderer.dice.tk._new("EXPLODE", "x", {isDiceModifier: true});
Renderer.dice.tk.EXPLODE_GT = Renderer.dice.tk._new("EXPLODE_GT", "x>", {isDiceModifier: true});
Renderer.dice.tk.EXPLODE_GTEQ = Renderer.dice.tk._new("EXPLODE_GTEQ", "x>=", {isDiceModifier: true});
Renderer.dice.tk.EXPLODE_LT = Renderer.dice.tk._new("EXPLODE_LT", "x<", {isDiceModifier: true});
Renderer.dice.tk.EXPLODE_LTEQ = Renderer.dice.tk._new("EXPLODE_LTEQ", "x<=", {isDiceModifier: true});
Renderer.dice.tk.COUNT_SUCCESS_EXACT = Renderer.dice.tk._new("COUNT_SUCCESS_EXACT", "cs=", {isDiceModifier: true, isSuccessMode: true});
Renderer.dice.tk.COUNT_SUCCESS_GT = Renderer.dice.tk._new("COUNT_SUCCESS_GT", "cs>", {isDiceModifier: true, isSuccessMode: true});
Renderer.dice.tk.COUNT_SUCCESS_GTEQ = Renderer.dice.tk._new("COUNT_SUCCESS_GTEQ", "cs>=", {isDiceModifier: true, isSuccessMode: true});
Renderer.dice.tk.COUNT_SUCCESS_LT = Renderer.dice.tk._new("COUNT_SUCCESS_LT", "cs<", {isDiceModifier: true, isSuccessMode: true});
Renderer.dice.tk.COUNT_SUCCESS_LTEQ = Renderer.dice.tk._new("COUNT_SUCCESS_LTEQ", "cs<=", {isDiceModifier: true, isSuccessMode: true});
Renderer.dice.tk.MARGIN_SUCCESS_EXACT = Renderer.dice.tk._new("MARGIN_SUCCESS_EXACT", "ms=", {isDiceModifier: true});
Renderer.dice.tk.MARGIN_SUCCESS_GT = Renderer.dice.tk._new("MARGIN_SUCCESS_GT", "ms>", {isDiceModifier: true});
Renderer.dice.tk.MARGIN_SUCCESS_GTEQ = Renderer.dice.tk._new("MARGIN_SUCCESS_GTEQ", "ms>=", {isDiceModifier: true});
Renderer.dice.tk.MARGIN_SUCCESS_LT = Renderer.dice.tk._new("MARGIN_SUCCESS_LT", "ms<", {isDiceModifier: true});
Renderer.dice.tk.MARGIN_SUCCESS_LTEQ = Renderer.dice.tk._new("MARGIN_SUCCESS_LTEQ", "ms<=", {isDiceModifier: true});

Renderer.dice.AbstractSymbol = class {
	constructor () { this.type = Renderer.dice.tk.TYP_SYMBOL; }
	eq (symbol) { return symbol && this.type === symbol.type; }
	evl (meta) { this.meta = meta; return this._evl(meta); }
	avg (meta) { this.meta = meta; return this._avg(meta); }
	min (meta) { this.meta = meta; return this._min(meta); } // minimum value of all _rolls_, not the minimum possible result
	max (meta) { this.meta = meta; return this._max(meta); } // maximum value of all _rolls_, not the maximum possible result
	_evl () { throw new Error("Unimplemented!"); }
	_avg () { throw new Error("Unimplemented!"); }
	_min () { throw new Error("Unimplemented!"); } // minimum value of all _rolls_, not the minimum possible result
	_max () { throw new Error("Unimplemented!"); } // maximum value of all _rolls_, not the maximum possible result
	toString () { throw new Error("Unimplemented!"); }
	addToMeta (meta, {text, html = null, md = null} = {}) {
		if (!meta) return;
		html = html || text;
		md = md || text;
		(meta.html = meta.html || []).push(html);
		(meta.text = meta.text || []).push(text);
		(meta.md = meta.md || []).push(md);
	}
};

Renderer.dice.parsed = {
	_PARTITION_EQ: (r, compareTo) => r === compareTo,
	_PARTITION_GT: (r, compareTo) => r > compareTo,
	_PARTITION_GTEQ: (r, compareTo) => r >= compareTo,
	_PARTITION_LT: (r, compareTo) => r < compareTo,
	_PARTITION_LTEQ: (r, compareTo) => r <= compareTo,

	/**
	 * @param fnName
	 * @param meta
	 * @param vals
	 * @param nodeMod
	 * @param opts Options object.
	 * @param [opts.fnGetRerolls] Function which takes a set of rolls to be rerolled and generates the next set of rolls.
	 * @param [opts.fnGetExplosions] Function which takes a set of rolls to be exploded and generates the next set of rolls.
	 * @param [opts.faces]
	 */
	_handleModifiers (fnName, meta, vals, nodeMod, opts) {
		opts = opts || {};

		const displayVals = vals.slice(); // copy the array so we can sort the original

		const {mods} = nodeMod;

		for (const mod of mods) {
			vals.sort(SortUtil.ascSortProp.bind(null, "val")).reverse();
			const valsAlive = vals.filter(it => !it.isDropped);

			const modNum = mod.numSym[fnName]();

			switch (mod.modSym.type) {
				case Renderer.dice.tk.DROP_HIGHEST.type:
				case Renderer.dice.tk.KEEP_HIGHEST.type:
				case Renderer.dice.tk.DROP_LOWEST.type:
				case Renderer.dice.tk.KEEP_LOWEST.type: {
					const isHighest = mod.modSym.type.endsWith("H");

					const splitPoint = isHighest ? modNum : valsAlive.length - modNum;

					const highSlice = valsAlive.slice(0, splitPoint);
					const lowSlice = valsAlive.slice(splitPoint, valsAlive.length);

					switch (mod.modSym.type) {
						case Renderer.dice.tk.DROP_HIGHEST.type:
						case Renderer.dice.tk.KEEP_LOWEST.type:
							highSlice.forEach(val => val.isDropped = true);
							break;
						case Renderer.dice.tk.KEEP_HIGHEST.type:
						case Renderer.dice.tk.DROP_LOWEST.type:
							lowSlice.forEach(val => val.isDropped = true);
							break;
						default: throw new Error(`Unimplemented!`);
					}
					break;
				}

				case Renderer.dice.tk.REROLL_EXACT.type:
				case Renderer.dice.tk.REROLL_GT.type:
				case Renderer.dice.tk.REROLL_GTEQ.type:
				case Renderer.dice.tk.REROLL_LT.type:
				case Renderer.dice.tk.REROLL_LTEQ.type: {
					let fnPartition;
					switch (mod.modSym.type) {
						case Renderer.dice.tk.REROLL_EXACT.type: fnPartition = Renderer.dice.parsed._PARTITION_EQ; break;
						case Renderer.dice.tk.REROLL_GT.type: fnPartition = Renderer.dice.parsed._PARTITION_GT; break;
						case Renderer.dice.tk.REROLL_GTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_GTEQ; break;
						case Renderer.dice.tk.REROLL_LT.type: fnPartition = Renderer.dice.parsed._PARTITION_LT; break;
						case Renderer.dice.tk.REROLL_LTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_LTEQ; break;
						default: throw new Error(`Unimplemented!`);
					}

					const toReroll = valsAlive.filter(val => fnPartition(val.val, modNum));
					toReroll.forEach(val => val.isDropped = true);

					const nuVals = opts.fnGetRerolls(toReroll);

					vals.push(...nuVals);
					displayVals.push(...nuVals);
					break;
				}

				case Renderer.dice.tk.EXPLODE_EXACT.type:
				case Renderer.dice.tk.EXPLODE_GT.type:
				case Renderer.dice.tk.EXPLODE_GTEQ.type:
				case Renderer.dice.tk.EXPLODE_LT.type:
				case Renderer.dice.tk.EXPLODE_LTEQ.type: {
					let fnPartition;
					switch (mod.modSym.type) {
						case Renderer.dice.tk.EXPLODE_EXACT.type: fnPartition = Renderer.dice.parsed._PARTITION_EQ; break;
						case Renderer.dice.tk.EXPLODE_GT.type: fnPartition = Renderer.dice.parsed._PARTITION_GT; break;
						case Renderer.dice.tk.EXPLODE_GTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_GTEQ; break;
						case Renderer.dice.tk.EXPLODE_LT.type: fnPartition = Renderer.dice.parsed._PARTITION_LT; break;
						case Renderer.dice.tk.EXPLODE_LTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_LTEQ; break;
						default: throw new Error(`Unimplemented!`);
					}

					let tries = 999; // limit the maximum explosions to a sane amount
					let lastLen;
					let toExplodeNext = valsAlive;
					do {
						lastLen = vals.length;

						const [toExplode] = toExplodeNext.partition(roll => !roll.isExploded && fnPartition(roll.val, modNum));
						toExplode.forEach(roll => roll.isExploded = true);

						const nuVals = opts.fnGetExplosions(toExplode);

						// cache the new rolls, to improve performance over massive explosion sets
						toExplodeNext = nuVals;

						vals.push(...nuVals);
						displayVals.push(...nuVals);
					} while (tries-- > 0 && vals.length !== lastLen);

					if (!~tries) JqueryUtil.doToast({type: "warning", content: `Stopped exploding after 999 additional rolls.`});

					break;
				}

				case Renderer.dice.tk.COUNT_SUCCESS_EXACT.type:
				case Renderer.dice.tk.COUNT_SUCCESS_GT.type:
				case Renderer.dice.tk.COUNT_SUCCESS_GTEQ.type:
				case Renderer.dice.tk.COUNT_SUCCESS_LT.type:
				case Renderer.dice.tk.COUNT_SUCCESS_LTEQ.type: {
					let fnPartition;
					switch (mod.modSym.type) {
						case Renderer.dice.tk.COUNT_SUCCESS_EXACT.type: fnPartition = Renderer.dice.parsed._PARTITION_EQ; break;
						case Renderer.dice.tk.COUNT_SUCCESS_GT.type: fnPartition = Renderer.dice.parsed._PARTITION_GT; break;
						case Renderer.dice.tk.COUNT_SUCCESS_GTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_GTEQ; break;
						case Renderer.dice.tk.COUNT_SUCCESS_LT.type: fnPartition = Renderer.dice.parsed._PARTITION_LT; break;
						case Renderer.dice.tk.COUNT_SUCCESS_LTEQ.type: fnPartition = Renderer.dice.parsed._PARTITION_LTEQ; break;
						default: throw new Error(`Unimplemented!`);
					}

					const successes = valsAlive.filter(val => fnPartition(val.val, modNum));
					successes.forEach(val => val.isSuccess = true);

					break;
				}

				case Renderer.dice.tk.MARGIN_SUCCESS_EXACT.type:
				case Renderer.dice.tk.MARGIN_SUCCESS_GT.type:
				case Renderer.dice.tk.MARGIN_SUCCESS_GTEQ.type:
				case Renderer.dice.tk.MARGIN_SUCCESS_LT.type:
				case Renderer.dice.tk.MARGIN_SUCCESS_LTEQ.type: {
					const total = valsAlive.map(it => it.val).reduce((valA, valB) => valA + valB, 0);

					const subDisplayDice = displayVals.map(r => `[${Renderer.dice.parsed._rollToNumPart_html(r, opts.faces)}]`).join("+");

					let delta;
					let subDisplay;
					switch (mod.modSym.type) {
						case Renderer.dice.tk.MARGIN_SUCCESS_EXACT.type:
						case Renderer.dice.tk.MARGIN_SUCCESS_GT.type:
						case Renderer.dice.tk.MARGIN_SUCCESS_GTEQ.type: {
							delta = total - modNum;

							subDisplay = `(${subDisplayDice})-${modNum}`;

							break;
						}
						case Renderer.dice.tk.MARGIN_SUCCESS_LT.type:
						case Renderer.dice.tk.MARGIN_SUCCESS_LTEQ.type: {
							delta = modNum - total;

							subDisplay = `${modNum}-(${subDisplayDice})`;

							break;
						}
						default: throw new Error(`Unimplemented!`);
					}

					while (vals.length) {
						vals.pop();
						displayVals.pop();
					}

					vals.push({val: delta});
					displayVals.push({val: delta, htmlDisplay: subDisplay});

					break;
				}

				default: throw new Error(`Unimplemented!`);
			}
		}

		return displayVals;
	},

	_rollToNumPart_html (r, faces) {
		if (faces == null) return r.val;
		return r.val === faces ? `<span class="rll__max--muted">${r.val}</span>` : r.val === 1 ? `<span class="rll__min--muted">${r.val}</span>` : r.val;
	},

	Function: class extends Renderer.dice.AbstractSymbol {
		constructor (nodes) {
			super();
			this._nodes = nodes;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			const [symFunc] = this._nodes;
			switch (symFunc.type) {
				case Renderer.dice.tk.FLOOR.type:
				case Renderer.dice.tk.CEIL.type:
				case Renderer.dice.tk.ROUND.type:
				case Renderer.dice.tk.SIGN.type:
				case Renderer.dice.tk.CBRT.type:
				case Renderer.dice.tk.SQRT.type:
				case Renderer.dice.tk.EXP.type:
				case Renderer.dice.tk.LOG.type:
				case Renderer.dice.tk.RANDOM.type:
				case Renderer.dice.tk.TRUNC.type:
				case Renderer.dice.tk.POW.type:
				case Renderer.dice.tk.MAX.type:
				case Renderer.dice.tk.MIN.type: {
					const [, ...symExps] = this._nodes;
					this.addToMeta(meta, {text: `${symFunc.toString()}(`});
					const args = [];
					symExps.forEach((symExp, i) => {
						if (i !== 0) this.addToMeta(meta, {text: `, `});
						args.push(symExp[fnName](meta));
					});
					const out = Math[symFunc.toString()](...args);
					this.addToMeta(meta, {text: ")"});
					return out;
				}
				case Renderer.dice.tk.AVERAGE.type: {
					const [, symExp] = this._nodes;
					return symExp.avg(meta);
				}
				case Renderer.dice.tk.DMAX.type: {
					const [, symExp] = this._nodes;
					return symExp.max(meta);
				}
				case Renderer.dice.tk.DMIN.type: {
					const [, symExp] = this._nodes;
					return symExp.min(meta);
				}
				default: throw new Error(`Unimplemented!`);
			}
		}

		toString () {
			let out;
			const [symFunc, symExp] = this._nodes;
			switch (symFunc.type) {
				case Renderer.dice.tk.FLOOR.type:
				case Renderer.dice.tk.CEIL.type:
				case Renderer.dice.tk.ROUND.type:
				case Renderer.dice.tk.AVERAGE.type:
				case Renderer.dice.tk.DMAX.type:
				case Renderer.dice.tk.DMIN.type:
				case Renderer.dice.tk.SIGN.type:
				case Renderer.dice.tk.ABS.type:
				case Renderer.dice.tk.CBRT.type:
				case Renderer.dice.tk.SQRT.type:
				case Renderer.dice.tk.EXP.type:
				case Renderer.dice.tk.LOG.type:
				case Renderer.dice.tk.RANDOM.type:
				case Renderer.dice.tk.TRUNC.type:
				case Renderer.dice.tk.POW.type:
				case Renderer.dice.tk.MAX.type:
				case Renderer.dice.tk.MIN.type:
					out = symFunc.toString(); break;
				default: throw new Error(`Unimplemented!`);
			}
			out += `(${symExp.toString()})`;
			return out;
		}
	},

	Pool: class extends Renderer.dice.AbstractSymbol {
		constructor (nodesPool, nodeMod) {
			super();
			this._nodesPool = nodesPool;
			this._nodeMod = nodeMod;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			const vals = this._nodesPool.map(it => {
				const subMeta = {};
				return {node: it, val: it[fnName](subMeta), meta: subMeta};
			});

			if (this._nodeMod && vals.length) {
				const isSuccessMode = this._nodeMod.isSuccessMode;

				const modOpts = {
					fnGetRerolls: toReroll => toReroll.map(val => {
						const subMeta = {};
						return {node: val.node, val: val.node[fnName](subMeta), meta: subMeta};
					}),
					fnGetExplosions: toExplode => toExplode.map(val => {
						const subMeta = {};
						return {node: val.node, val: val.node[fnName](subMeta), meta: subMeta};
					}),
				};

				const displayVals = Renderer.dice.parsed._handleModifiers(fnName, meta, vals, this._nodeMod, modOpts);

				const asHtml = displayVals.map(v => {
					const html = v.meta.html.join("");
					if (v.isDropped) return `<span class="rll__dropped">(${html})</span>`;
					else if (v.isExploded) return `<span class="rll__exploded">(</span>${html}<span class="rll__exploded">)</span>`;
					else if (v.isSuccess) return `<span class="rll__success">(${html})</span>`;
					else return `(${html})`;
				}).join("+");

				const asText = displayVals.map(v => `(${v.meta.text.join("")})`).join("+");
				const asMd = displayVals.map(v => `(${v.meta.md.join("")})`).join("+");

				this.addToMeta(meta, {html: asHtml, text: asText, md: asMd});

				if (isSuccessMode) {
					return vals.filter(it => !it.isDropped && it.isSuccess).length;
				} else {
					return vals.filter(it => !it.isDropped).map(it => it.val).sum();
				}
			} else {
				this.addToMeta(
					meta,
					["html", "text", "md"].mergeMap(prop => ({
						[prop]: `${vals.map(it => `(${it.meta[prop].join("")})`).join("+")}`,
					})),
				);
				return vals.map(it => it.val).sum();
			}
		}

		toString () {
			return `{${this._nodesPool.map(it => it.toString()).join(", ")}}${this._nodeMod ? this._nodeMod.toString() : ""}`;
		}
	},

	Factor: class extends Renderer.dice.AbstractSymbol {
		constructor (node, opts) {
			super();
			opts = opts || {};
			this._node = node;
			this._hasParens = !!opts.hasParens;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			switch (this._node.type) {
				case Renderer.dice.tk.TYP_NUMBER: {
					this.addToMeta(meta, {text: this.toString()});
					return Number(this._node.value);
				}
				case Renderer.dice.tk.TYP_SYMBOL: {
					if (this._hasParens) this.addToMeta(meta, {text: "("});
					const out = this._node[fnName](meta);
					if (this._hasParens) this.addToMeta(meta, {text: ")"});
					return out;
				}
				case Renderer.dice.tk.PB.type: {
					this.addToMeta(meta, {text: this.toString(meta)});
					return meta.pb == null ? 0 : meta.pb;
				}
				case Renderer.dice.tk.SUMMON_SPELL_LEVEL.type: {
					this.addToMeta(meta, {text: this.toString(meta)});
					return meta.summonSpellLevel == null ? 0 : meta.summonSpellLevel;
				}
				case Renderer.dice.tk.SUMMON_CLASS_LEVEL.type: {
					this.addToMeta(meta, {text: this.toString(meta)});
					return meta.summonClassLevel == null ? 0 : meta.summonClassLevel;
				}
				default: throw new Error(`Unimplemented!`);
			}
		}

		toString (indent) {
			let out;
			switch (this._node.type) {
				case Renderer.dice.tk.TYP_NUMBER: out = this._node.value; break;
				case Renderer.dice.tk.TYP_SYMBOL: out = this._node.toString(); break;
				case Renderer.dice.tk.PB.type: out = this.meta ? (this.meta.pb || 0) : "PB"; break;
				case Renderer.dice.tk.SUMMON_SPELL_LEVEL.type: out = this.meta ? (this.meta.summonSpellLevel || 0) : "the spell's level"; break;
				case Renderer.dice.tk.SUMMON_CLASS_LEVEL.type: out = this.meta ? (this.meta.summonClassLevel || 0) : "your class level"; break;
				default: throw new Error(`Unimplemented!`);
			}
			return this._hasParens ? `(${out})` : out;
		}
	},

	Dice: class extends Renderer.dice.AbstractSymbol {
		static _facesToValue (faces, fnName) {
			switch (fnName) {
				case "evl": return RollerUtil.randomise(faces);
				case "avg": return (faces + 1) / 2;
				case "min": return 1;
				case "max": return faces;
			}
		}

		constructor (nodes) {
			super();
			this._nodes = nodes;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			if (this._nodes.length === 1) return this._nodes[0][fnName](meta); // if it's just a factor

			// N.B. we don't pass the full "meta" to symbol evaluation inside the dice expression--we therefore won't see
			//   the metadata from the nested rolls, but that's OK.

			const view = this._nodes.slice();
			// Shift the first symbol and use that as our initial number of dice
			//   e.g. the "2" in 2d3d5
			const numSym = view.shift();
			let tmp = numSym[fnName](Renderer.dice.util.getReducedMeta(meta));

			while (view.length) {
				if (Math.round(tmp) !== tmp) throw new Error(`Number of dice to roll (${tmp}) was not an integer!`);

				// Use the next symbol as our number of faces
				//   e.g. the "3" in `2d3d5`
				// When looping, the number of dice may have been a complex expression with modifiers; take the next
				//   non-modifier symbol as the faces.
				//   e.g. the "20" in `(2d3kh1r1)d20` (parentheses for emphasis)
				const facesSym = view.shift();
				const faces = facesSym[fnName]();
				if (Math.round(faces) !== faces) throw new Error(`Dice face count (${faces}) was not an integer!`);

				const isLast = view.length === 0 || (view.length === 1 && view.last().isDiceModifierGroup);
				tmp = this._invoke_handlePart(fnName, meta, view, tmp, faces, isLast);
			}

			return tmp;
		}

		_invoke_handlePart (fnName, meta, view, num, faces, isLast) {
			const rolls = [...new Array(num)].map(() => ({val: Renderer.dice.parsed.Dice._facesToValue(faces, fnName)}));
			let displayRolls;
			let isSuccessMode = false;

			if (view.length && view[0].isDiceModifierGroup) {
				const nodeMod = view[0];

				if (fnName === "evl" || fnName === "min" || fnName === "max") { // avoid handling dice modifiers in "average" mode
					isSuccessMode = nodeMod.isSuccessMode;

					const modOpts = {
						faces,
						fnGetRerolls: toReroll => [...new Array(toReroll.length)].map(() => ({val: Renderer.dice.parsed.Dice._facesToValue(faces, fnName)})),
						fnGetExplosions: toExplode => [...new Array(toExplode.length)].map(() => ({val: Renderer.dice.parsed.Dice._facesToValue(faces, fnName)})),
					};

					displayRolls = Renderer.dice.parsed._handleModifiers(fnName, meta, rolls, nodeMod, modOpts);
				}

				view.shift();
			} else displayRolls = rolls;

			if (isLast) { // only display the dice for the final roll, e.g. in 2d3d4 show the Xd4
				const asHtml = displayRolls.map(r => {
					if (r.htmlDisplay) return r.htmlDisplay;

					const numPart = Renderer.dice.parsed._rollToNumPart_html(r, faces);

					if (r.isDropped) return `<span class="rll__dropped">[${numPart}]</span>`;
					else if (r.isExploded) return `<span class="rll__exploded">[</span>${numPart}<span class="rll__exploded">]</span>`;
					else if (r.isSuccess) return `<span class="rll__success">[${numPart}]</span>`;
					else return `[${numPart}]`;
				}).join("+");

				const asText = displayRolls.map(r => `[${r.val}]`).join("+");

				const asMd = displayRolls.map(r => {
					if (r.isDropped) return `~~[${r.val}]~~`;
					else if (r.isExploded) return `_[${r.val}]_`;
					else if (r.isSuccess) return `**[${r.val}]**`;
					else return `[${r.val}]`;
				}).join("+");

				this.addToMeta(
					meta,
					{
						html: asHtml,
						text: asText,
						md: asMd,
					},
				);
			}

			if (fnName === "evl") {
				const maxRolls = rolls.filter(it => it.val === faces && !it.isDropped);
				const minRolls = rolls.filter(it => it.val === 1 && !it.isDropped);
				meta.allMax = meta.allMax || [];
				meta.allMin = meta.allMin || [];
				meta.allMax.push(maxRolls.length && maxRolls.length === rolls.length);
				meta.allMin.push(minRolls.length && minRolls.length === rolls.length);
			}

			if (isSuccessMode) {
				return rolls.filter(it => !it.isDropped && it.isSuccess).length;
			} else {
				return rolls.filter(it => !it.isDropped).map(it => it.val).sum();
			}
		}

		toString () {
			if (this._nodes.length === 1) return this._nodes[0].toString(); // if it's just a factor

			const [numSym, facesSym] = this._nodes;
			let out = `${numSym.toString()}d${facesSym.toString()}`;

			for (let i = 2; i < this._nodes.length; ++i) {
				const n = this._nodes[i];
				if (n.isDiceModifierGroup) out += n.mods.map(it => `${it.modSym.toString()}${it.numSym.toString()}`).join("");
				else out += `d${n.toString()}`;
			}

			return out;
		}
	},

	Exponent: class extends Renderer.dice.AbstractSymbol {
		constructor (nodes) {
			super();
			this._nodes = nodes;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			const view = this._nodes.slice();
			let val = view.pop()[fnName](meta);
			while (view.length) {
				this.addToMeta(meta, {text: "^"});
				val = view.pop()[fnName](meta) ** val;
			}
			return val;
		}

		toString () {
			const view = this._nodes.slice();
			let out = view.pop().toString();
			while (view.length) out = `${view.pop().toString()}^${out}`;
			return out;
		}
	},

	Term: class extends Renderer.dice.AbstractSymbol {
		constructor (nodes) {
			super();
			this._nodes = nodes;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			let out = this._nodes[0][fnName](meta);

			for (let i = 1; i < this._nodes.length; i += 2) {
				if (this._nodes[i].eq(Renderer.dice.tk.MULT)) {
					this.addToMeta(meta, {text: " × "});
					out *= this._nodes[i + 1][fnName](meta);
				} else if (this._nodes[i].eq(Renderer.dice.tk.DIV)) {
					this.addToMeta(meta, {text: " ÷ "});
					out /= this._nodes[i + 1][fnName](meta);
				} else throw new Error(`Unimplemented!`);
			}

			return out;
		}

		toString () {
			let out = this._nodes[0].toString();
			for (let i = 1; i < this._nodes.length; i += 2) {
				if (this._nodes[i].eq(Renderer.dice.tk.MULT)) out += ` * ${this._nodes[i + 1].toString()}`;
				else if (this._nodes[i].eq(Renderer.dice.tk.DIV)) out += ` / ${this._nodes[i + 1].toString()}`;
				else throw new Error(`Unimplemented!`);
			}
			return out;
		}
	},

	Expression: class extends Renderer.dice.AbstractSymbol {
		constructor (nodes) {
			super();
			this._nodes = nodes;
		}

		_evl (meta) { return this._invoke("evl", meta); }
		_avg (meta) { return this._invoke("avg", meta); }
		_min (meta) { return this._invoke("min", meta); }
		_max (meta) { return this._invoke("max", meta); }

		_invoke (fnName, meta) {
			const view = this._nodes.slice();

			let isNeg = false;
			if (view[0].eq(Renderer.dice.tk.ADD) || view[0].eq(Renderer.dice.tk.SUB)) {
				isNeg = view.shift().eq(Renderer.dice.tk.SUB);
				if (isNeg) this.addToMeta(meta, {text: "-"});
			}

			let out = view[0][fnName](meta);
			if (isNeg) out = -out;

			for (let i = 1; i < view.length; i += 2) {
				if (view[i].eq(Renderer.dice.tk.ADD)) {
					this.addToMeta(meta, {text: " + "});
					out += view[i + 1][fnName](meta);
				} else if (view[i].eq(Renderer.dice.tk.SUB)) {
					this.addToMeta(meta, {text: " - "});
					out -= view[i + 1][fnName](meta);
				} else throw new Error(`Unimplemented!`);
			}

			return out;
		}

		toString (indent = 0) {
			let out = "";
			const view = this._nodes.slice();

			let isNeg = false;
			if (view[0].eq(Renderer.dice.tk.ADD) || view[0].eq(Renderer.dice.tk.SUB)) {
				isNeg = view.shift().eq(Renderer.dice.tk.SUB);
				if (isNeg) out += "-";
			}

			out += view[0].toString(indent);
			for (let i = 1; i < view.length; i += 2) {
				if (view[i].eq(Renderer.dice.tk.ADD)) out += ` + ${view[i + 1].toString(indent)}`;
				else if (view[i].eq(Renderer.dice.tk.SUB)) out += ` - ${view[i + 1].toString(indent)}`;
				else throw new Error(`Unimplemented!`);
			}
			return out;
		}
	},
};

if (!IS_VTT && typeof window !== "undefined") {
	window.addEventListener("load", Renderer.dice._pInit);
}

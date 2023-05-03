"use strict";

class StatGenUi extends BaseComponent {
	static _PROPS_POINT_BUY_CUSTOM = [
		"pb_rules",
		"pb_budget",
		"pb_isCustom",
	];

	/**
	 * @param opts
	 * @param opts.races
	 * @param opts.backgrounds
	 * @param opts.feats
	 * @param [opts.tabMetasAdditional]
	 * @param [opts.isCharacterMode] Disables some functionality (e.g. changing number of ability scores)
	 * @param [opts.isFvttMode]
	 * @param [opts.modalFilterRaces]
	 * @param [opts.modalFilterBackgrounds]
	 * @param [opts.modalFilterFeats]
	 * @param [opts.existingScores]
	 */
	constructor (opts) {
		super();
		opts = opts || {};

		TabUiUtilSide.decorate(this, {isInitMeta: true});

		this._races = opts.races;
		this._backgrounds = opts.backgrounds;
		this._feats = opts.feats;
		this._tabMetasAdditional = opts.tabMetasAdditional;
		this._isCharacterMode = opts.isCharacterMode;
		this._isFvttMode = opts.isFvttMode;

		this._MODES = this._isFvttMode ? StatGenUi.MODES_FVTT : StatGenUi.MODES;
		if (this._isFvttMode) {
			let cnt = 0;
			this._IX_TAB_NONE = cnt++;
			this._IX_TAB_ROLLED = cnt++;
			this._IX_TAB_ARRAY = cnt++;
			this._IX_TAB_PB = cnt++;
			this._IX_TAB_MANUAL = cnt;
		} else {
			this._IX_TAB_NONE = -1;
			let cnt = 0;
			this._IX_TAB_ROLLED = cnt++;
			this._IX_TAB_ARRAY = cnt++;
			this._IX_TAB_PB = cnt++;
			this._IX_TAB_MANUAL = cnt;
		}

		this._modalFilterRaces = opts.modalFilterRaces || new ModalFilterRaces({namespace: "statgen.races", isRadio: true, allData: this._races});
		this._modalFilterBackgrounds = opts.modalFilterBackgrounds || new ModalFilterBackgrounds({namespace: "statgen.backgrounds", isRadio: true, allData: this._backgrounds});
		this._modalFilterFeats = opts.modalFilterFeats || new ModalFilterFeats({namespace: "statgen.feats", isRadio: true, allData: this._feats});

		this._isLevelUp = !!opts.existingScores;
		this._existingScores = opts.existingScores;

		// region Rolled
		this._$rollIptFormula = null;
		// endregion

		// region Point buy
		this._compAsi = new StatGenUi.CompAsi({parent: this});
		// endregion
	}

	get MODES () { return this._MODES; }

	get ixActiveTab () { return this._getIxActiveTab(); }
	set ixActiveTab (ix) { this._setIxActiveTab({ixActiveTab: ix}); }

	// region Expose for external use
	addHookPointBuyCustom (hook) { this.constructor._PROPS_POINT_BUY_CUSTOM.forEach(prop => this._addHookBase(prop, hook)); }

	addHookAbilityScores (hook) { Parser.ABIL_ABVS.forEach(ab => this._addHookBase(`common_export_${ab}`, hook)); }
	addHookPulseAsi (hook) { this._addHookBase("common_pulseAsi", hook); }
	getFormDataAsi () { return this._compAsi.getFormData(); }

	getMode (ix, namespace) {
		const {propMode} = this.getPropsAsi(ix, namespace);
		return this._state[propMode];
	}

	setIxFeat (ix, namespace, ixFeat) {
		const {propMode, propIxFeat} = this.getPropsAsi(ix, namespace);

		if (ixFeat == null && (this._state[propMode] === "asi" || this._state[propMode] == null)) {
			this._state[propIxFeat] = null;
			return;
		}

		this._state[propMode] = "feat";
		this._state[propIxFeat] = ixFeat;
	}

	setIxFeatSet (namespace, ixSet) {
		const {propIxSel} = this.getPropsAdditionalFeats_(namespace);
		this._state[propIxSel] = ixSet;
	}

	setIxFeatSetIxFeats (namespace, metaFeats) {
		const nxtState = {};
		metaFeats.forEach(({ix, ixFeat}) => {
			const {propIxFeat} = this.getPropsAdditionalFeatsFeatSet_(namespace, "fromFilter", ix);
			nxtState[propIxFeat] = ixFeat;
		});
		this._proxyAssignSimple("state", nxtState);
	}

	set common_cntAsi (val) { this._state.common_cntAsi = val; }

	addHookIxRace (hook) { this._addHookBase("common_ixRace", hook); }
	get ixRace () { return this._state.common_ixRace; }
	set ixRace (ixRace) { this._state.common_ixRace = ixRace; }

	addHookIxBackground (hook) { this._addHookBase("common_ixBackground", hook); }
	get ixBackground () { return this._state.common_ixBackground; }
	set ixBackground (ixBackground) { this._state.common_ixBackground = ixBackground; }

	addCustomFeat () { this._state.common_cntFeatsCustom = Math.min(StatGenUi._MAX_CUSTOM_FEATS, (this._state.common_cntFeatsCustom || 0) + 1); }
	setCntCustomFeats (val) { this._state.common_cntFeatsCustom = Math.min(StatGenUi._MAX_CUSTOM_FEATS, val || 0); }
	// endregion

	// region Expose for ASI component
	get isCharacterMode () { return this._isCharacterMode; }
	get state () { return this._state; }
	get modalFilterFeats () { return this._modalFilterFeats; }
	get feats () { return this._feats; }
	addHookBase (prop, hook) { return this._addHookBase(prop, hook); }
	removeHookBase (prop, hook) { return this._removeHookBase(prop, hook); }
	proxyAssignSimple (hookProp, toObj, isOverwrite) { return this._proxyAssignSimple(hookProp, toObj, isOverwrite); }
	get race () { return this._races[this._state.common_ixRace]; }
	get background () { return this._backgrounds[this._state.common_ixBackground]; }
	get isLevelUp () { return this._isLevelUp; }
	// endregion

	getTotals () {
		if (this._isLevelUp) {
			return {
				mode: "levelUp",
				totals: {
					levelUp: this._getTotals_levelUp(),
				},
			};
		}

		return {
			mode: this._MODES[this.ixActiveTab || 0],
			totals: {
				rolled: this._getTotals_rolled(),
				array: this._getTotals_array(),
				pointbuy: this._getTotals_pb(),
				manual: this._getTotals_manual(),
			},
		};
	}

	_getTotals_rolled () { return Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: this._rolled_getTotalScore(ab)})); }
	_getTotals_array () { return Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: this._array_getTotalScore(ab)})); }
	_getTotals_pb () { return Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: this._pb_getTotalScore(ab)})); }
	_getTotals_manual () { return Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: this._manual_getTotalScore(ab)})); }
	_getTotals_levelUp () { return Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: this._levelUp_getTotalScore(ab)})); }

	addHook (hookProp, prop, hook) { return this._addHook(hookProp, prop, hook); }
	addHookAll (hookProp, hook) {
		this._addHookAll(hookProp, hook);
		this._compAsi._addHookAll(hookProp, hook);
	}

	addHookActiveTag (hook) { this._addHookActiveTab(hook); }

	async pInit () {
		await this._modalFilterRaces.pPreloadHidden();
		await this._modalFilterBackgrounds.pPreloadHidden();
		await this._modalFilterFeats.pPreloadHidden();
	}

	getPropsAsi (ix, namespace) {
		return {
			prefix: `common_asi_${namespace}_${ix}_`,
			propMode: `common_asi_${namespace}_${ix}_mode`,
			propIxAsiPointOne: `common_asi_${namespace}_${ix}_asiPointOne`,
			propIxAsiPointTwo: `common_asi_${namespace}_${ix}_asiPointTwo`,
			propIxFeat: `common_asi_${namespace}_${ix}_ixFeat`,
			propIxFeatAbility: `common_asi_${namespace}_${ix}_ixFeatAbility`,
			propFeatAbilityChooseFrom: `common_asi_${namespace}_${ix}_featAbilityChooseFrom`,
		};
	}

	getPropsAdditionalFeats_ (namespace) {
		return {
			propPrefix: `common_additionalFeats_${namespace}_`,
			propIxSel: `common_additionalFeats_${namespace}_ixSel`,
		};
	}

	getPropsAdditionalFeatsFeatSet_ (namespace, type, ix) {
		return {
			propIxFeat: `common_additionalFeats_${namespace}_${type}_${ix}_ixFeat`,
			propIxFeatAbility: `common_additionalFeats_${namespace}_${type}_${ix}_ixFeatAbility`,
			propFeatAbilityChooseFrom: `common_additionalFeats_${namespace}_${type}_${ix}_featAbilityChooseFrom`,
		};
	}

	_roll_getRolledStats () {
		const wrpTree = Renderer.dice.lang.getTree3(this._state.rolled_formula);
		if (!wrpTree) return this._$rollIptFormula.addClass("form-control--error");

		const rolls = [];
		for (let i = 0; i < this._state.rolled_rollCount; i++) {
			const meta = {};
			meta.total = wrpTree.tree.evl(meta);
			rolls.push(meta);
		}
		rolls.sort((a, b) => SortUtil.ascSort(b.total, a.total));

		return rolls.map(r => ({total: r.total, text: (r.text || []).join("")}));
	}

	render ($parent) {
		$parent.empty().addClass("statgen");

		const iptTabMetas = this._isLevelUp
			? [
				new TabUiUtil.TabMeta({name: "Existing", icon: this._isFvttMode ? `fas fa-fw fa-user` : `far fa-fw fa-user`, hasBorder: true}),
				...this._tabMetasAdditional || [],
			]
			: [
				this._isFvttMode ? new TabUiUtil.TabMeta({name: "Select...", icon: this._isFvttMode ? `fas fa-fw fa-square` : `far fa-fw fa-square`, hasBorder: true, isNoPadding: this._isFvttMode}) : null,
				new TabUiUtil.TabMeta({name: "Roll", icon: this._isFvttMode ? `fas fa-fw fa-dice` : `far fa-fw fa-dice`, hasBorder: true, isNoPadding: this._isFvttMode}),
				new TabUiUtil.TabMeta({name: "Standard Array", icon: this._isFvttMode ? `fas fa-fw fa-signal` : `far fa-fw fa-signal-alt`, hasBorder: true, isNoPadding: this._isFvttMode}),
				new TabUiUtil.TabMeta({name: "Point Buy", icon: this._isFvttMode ? `fas fa-fw fa-chart-bar` : `far fa-fw fa-chart-bar`, hasBorder: true, isNoPadding: this._isFvttMode}),
				new TabUiUtil.TabMeta({name: "Manual", icon: this._isFvttMode ? `fas fa-fw fa-tools` : `far fa-fw fa-tools`, hasBorder: true, isNoPadding: this._isFvttMode}),
				...this._tabMetasAdditional || [],
			].filter(Boolean);

		const tabMetas = this._renderTabs(iptTabMetas, {$parent: this._isFvttMode ? null : $parent});
		if (this._isFvttMode) {
			if (!this._isLevelUp) {
				const {propActive: propActiveTab, propProxy: propProxyTabs} = this._getTabProps();
				const $selMode = ComponentUiUtil.$getSelEnum(
					this,
					propActiveTab,
					{
						values: iptTabMetas.map((_, ix) => ix),
						fnDisplay: ix => iptTabMetas[ix].name,
						propProxy: propProxyTabs,
					},
				)
					.addClass("max-w-200p");
				$$`<div class="ve-flex-v-center statgen-shared__wrp-header">
					<div class="mr-2"><b>Mode</b></div>
					${$selMode}
				</div>
				<hr class="hr-2">`.appendTo($parent);
			}

			tabMetas.forEach(it => it.$wrpTab.appendTo($parent));
		}

		const $wrpAll = $(`<div class="ve-flex-col w-100 h-100"></div>`);
		this._render_all($wrpAll);

		const hkTab = () => {
			tabMetas[this.ixActiveTab || 0].$wrpTab.append($wrpAll);
		};
		this._addHookActiveTab(hkTab);
		hkTab();

		this._addHookBase("common_cntAsi", () => this._state.common_pulseAsi = !this._state.common_pulseAsi);
		this._addHookBase("common_cntFeatsCustom", () => this._state.common_pulseAsi = !this._state.common_pulseAsi);
	}

	_render_$getStgRolledHeader () {
		this._$rollIptFormula = ComponentUiUtil.$getIptStr(this, "rolled_formula")
			.addClass("text-center max-w-100p")
			.keydown(evt => {
				if (evt.key === "Enter") setTimeout(() => $btnRoll.click()); // Defer to allow `.change` to fire first
			})
			.change(() => this._$rollIptFormula.removeClass("form-control--error"));

		const $iptRollCount = this._isCharacterMode ? null : ComponentUiUtil.$getIptInt(this, "rolled_rollCount", 1, {min: 1, fallbackOnNaN: 1, html: `<input type="text" class="form-control input-xs form-control--minimal text-center max-w-100p">`})
			.keydown(evt => {
				if (evt.key === "Enter") setTimeout(() => $btnRoll.click()); // Defer to allow `.change` to fire first
			})
			.change(() => this._$rollIptFormula.removeClass("form-control--error"));

		const $btnRoll = $(`<button class="btn btn-primary bold">Roll</button>`)
			.click(() => {
				this._state.rolled_rolls = this._roll_getRolledStats();
			});

		const $btnRandom = $(`<button class="btn btn-xs btn-default mt-2">Randomly Assign</button>`)
			.hideVe()
			.click(() => {
				const abs = [...Parser.ABIL_ABVS].shuffle();
				abs.forEach((ab, i) => {
					const {propAbilSelectedRollIx} = this.constructor._rolled_getProps(ab);
					this._state[propAbilSelectedRollIx] = i;
				});
			});

		const $wrpRolled = $(`<div class="ve-flex-v-center mr-auto statgen-rolled__wrp-results py-1"></div>`);
		const $wrpRolledOuter = $$`<div class="ve-flex-v-center"><div class="mr-2">=</div>${$wrpRolled}</div>`;

		const hkRolled = () => {
			$wrpRolledOuter.toggleVe(this._state.rolled_rolls.length);
			$btnRandom.toggleVe(this._state.rolled_rolls.length);

			$wrpRolled.html(this._state.rolled_rolls.map((it, i) => {
				const cntPrevRolls = this._state.rolled_rolls.slice(0, i).filter(r => r.total === it.total).length;
				return `<div class="px-3 py-1 help-subtle ve-flex-vh-center" title="${it.text}"><div class="ve-muted">[</div><div class="ve-flex-vh-center statgen-rolled__disp-result">${it.total}${cntPrevRolls ? Parser.numberToSubscript(cntPrevRolls) : ""}</div><div class="ve-muted">]</div></div>`;
			}));
		};
		this._addHookBase("rolled_rolls", hkRolled);
		hkRolled();

		return $$`<div class="ve-flex-col mb-3 mr-auto">
			<div class="ve-flex mb-2">
				<div class="ve-flex-col ve-flex-h-center mr-3">
					<label class="ve-flex-v-center"><div class="mr-2 no-shrink w-100p">Formula:</div>${this._$rollIptFormula}</label>

					${this._isCharacterMode ? null : $$`<label class="ve-flex-v-center mt-2"><div class="mr-2 no-shrink w-100p">Number of rolls:</div>${$iptRollCount}</label>`}
				</div>
				${$btnRoll}
			</div>

			${$wrpRolledOuter}

			<div class="ve-flex-v-center">${$btnRandom}</div>
		</div>`;
	}

	_render_$getStgArrayHeader () {
		const $btnRandom = $(`<button class="btn btn-xs btn-default">Randomly Assign</button>`)
			.click(() => {
				const abs = [...Parser.ABIL_ABVS].shuffle();
				abs.forEach((ab, i) => {
					const {propAbilSelectedScoreIx} = this.constructor._array_getProps(ab);
					this._state[propAbilSelectedScoreIx] = i;
				});
			});

		return $$`<div class="ve-flex-col mb-3 mr-auto">
			<div class="mb-2">Assign these numbers to your abilities as desired:</div>
			<div class="bold mb-2">${StatGenUi._STANDARD_ARRAY.join(", ")}</div>
			<div class="ve-flex">${$btnRandom}</div>
		</div>`;
	}

	_render_$getStgManualHeader () {
		return $$`<div class="ve-flex-col mb-3 mr-auto">
			<div>Enter your desired ability scores in the &quot;Base&quot; column below.</div>
		</div>`;
	}

	_doReset () {
		if (this._isLevelUp) return; // Should never occur

		const nxtState = this._getDefaultStateCommonResettable();

		switch (this.ixActiveTab) {
			case this._IX_TAB_NONE: Object.assign(nxtState, this._getDefaultStateNoneResettable()); break;
			case this._IX_TAB_ROLLED: Object.assign(nxtState, this._getDefaultStateRolledResettable()); break;
			case this._IX_TAB_ARRAY: Object.assign(nxtState, this._getDefaultStateArrayResettable()); break;
			case this._IX_TAB_PB: Object.assign(nxtState, this._getDefaultStatePointBuyResettable()); break;
			case this._IX_TAB_MANUAL: Object.assign(nxtState, this._getDefaultStateManualResettable()); break;
		}

		this._proxyAssignSimple("state", nxtState);
	}

	doResetAll () {
		this._proxyAssignSimple("state", this._getDefaultState(), true);
	}

	_render_$getStgPbHeader () {
		const $iptBudget = ComponentUiUtil.$getIptInt(
			this,
			"pb_budget",
			0,
			{
				html: `<input type="text" class="form-control statgen-pb__ipt-budget text-center statgen-shared__ipt">`,
				min: 0,
				fallbackOnNaN: 0,
			},
		);
		const hkIsCustom = () => {
			$iptBudget.attr("readonly", !this._state.pb_isCustom);
		};
		this._addHookBase("pb_isCustom", hkIsCustom);
		hkIsCustom();

		const $iptRemaining = ComponentUiUtil.$getIptInt(
			this,
			"pb_points",
			0,
			{
				html: `<input type="text" class="form-control statgen-pb__ipt-budget text-center statgen-shared__ipt">`,
				min: 0,
				fallbackOnNaN: 0,
			},
		).attr("readonly", true);

		const hkPoints = () => {
			this._state.pb_points = this._pb_getPointsRemaining(this._state);
			$iptRemaining.toggleClass(`statgen-pb__ipt-budget--error`, this._state.pb_points < 0);
		};
		this._addHookAll("state", hkPoints);
		hkPoints();

		const $btnReset = $(`<button class="btn btn-default">Reset</button>`)
			.click(() => this._doReset());

		const $btnRandom = $(`<button class="btn btn-default">Random</button>`)
			.click(() => {
				this._doReset();

				let canIncrease = Parser.ABIL_ABVS.map(it => `pb_${it}`);
				const cpyBaseState = canIncrease.mergeMap(it => ({[it]: this._state[it]}));
				const cntRemaining = this._pb_getPointsRemaining(cpyBaseState);
				if (cntRemaining <= 0) return;

				for (let step = 0; step < 10000; ++step) {
					if (!canIncrease.length) break;

					const prop = RollerUtil.rollOnArray(canIncrease);
					if (!this._state.pb_rules.some(rule => rule.entity.score === cpyBaseState[prop] + 1)) {
						canIncrease = canIncrease.filter(it => it !== prop);
						continue;
					}

					const draftCpyBaseState = MiscUtil.copy(cpyBaseState);
					draftCpyBaseState[prop]++;

					const cntRemaining = this._pb_getPointsRemaining(draftCpyBaseState);

					if (cntRemaining > 0) {
						Object.assign(cpyBaseState, draftCpyBaseState);
					} else if (cntRemaining === 0) {
						this._proxyAssignSimple("state", draftCpyBaseState);
						break;
					} else {
						canIncrease = canIncrease.filter(it => it !== prop);
					}
				}
			});

		return $$`<div class="ve-flex mobile__ve-flex-col mb-2">
			<div class="ve-flex-v-center">
				<div class="statgen-pb__cell mr-4 mobile__hidden"></div>

				<label class="ve-flex-col mr-2">
					<div class="mb-1 text-center">Budget</div>
					${$iptBudget}
				</label>

				<label class="ve-flex-col mr-2">
					<div class="mb-1 text-center">Remain</div>
					${$iptRemaining}
				</label>
			</div>

			<div class="ve-flex-v-center mobile__mt-2">
				<div class="ve-flex-col mr-2">
					<div class="mb-1 text-center mobile__hidden">&nbsp;</div>
					${$btnReset}
				</div>

				<div class="ve-flex-col">
					<div class="mb-1 text-center mobile__hidden">&nbsp;</div>
					${$btnRandom}
				</div>
			</div>
		</div>`;
	}

	_render_$getStgPbCustom () {
		const $btnAddLower = $(`<button class="btn btn-default btn-xs">Add Lower Score</button>`)
			.click(() => {
				const prevLowest = this._state.pb_rules[0];
				const score = prevLowest.entity.score - 1;
				const cost = prevLowest.entity.cost;
				this._state.pb_rules = [this._getDefaultState_pb_rule(score, cost), ...this._state.pb_rules];
			});

		const $btnAddHigher = $(`<button class="btn btn-default btn-xs">Add Higher Score</button>`)
			.click(() => {
				const prevHighest = this._state.pb_rules.last();
				const score = prevHighest.entity.score + 1;
				const cost = prevHighest.entity.cost;
				this._state.pb_rules = [...this._state.pb_rules, this._getDefaultState_pb_rule(score, cost)];
			});

		const $btnResetRules = $(`<button class="btn btn-danger btn-xs mr-2">Reset</button>`)
			.click(() => {
				this._state.pb_rules = this._getDefaultStatePointBuyCosts().pb_rules;
			});

		const menuCustom = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Export as Code",
				async () => {
					await MiscUtil.pCopyTextToClipboard(this._serialize_pb_rules());
					JqueryUtil.showCopiedEffect($btnContext);
				},
			),
			new ContextUtil.Action(
				"Import from Code",
				async () => {
					const raw = await InputUiUtil.pGetUserString({title: "Enter Code", isCode: true});
					if (raw == null) return;
					const parsed = this._deserialize_pb_rules(raw);
					if (parsed == null) return;

					const {pb_rules, pb_budget} = parsed;
					this._proxyAssignSimple(
						"state",
						{
							pb_rules,
							pb_budget,
							pb_isCustom: true,
						},
					);
					JqueryUtil.doToast("Imported!");
				},
			),
		]);

		const $btnContext = $(`<button class="btn btn-default btn-xs" title="Menu"><span class="glyphicon glyphicon-option-vertical"></span></button>`)
			.click(evt => ContextUtil.pOpenMenu(evt, menuCustom));

		const $stgCustomCostControls = $$`<div class="ve-flex-col mb-auto ml-2 mobile__ml-0 mobile__mt-3">
			<div class="btn-group-vertical ve-flex-col mb-2">${$btnAddLower}${$btnAddHigher}</div>
			<div class="ve-flex-v-center">
				${$btnResetRules}
				${$btnContext}
			</div>
		</div>`;

		const $stgCostRows = $$`<div class="ve-flex-col"></div>`;

		const renderableCollectionRules = new StatGenUi.RenderableCollectionPbRules(
			this,
			$stgCostRows,
		);
		const hkRules = () => {
			renderableCollectionRules.render();

			// region Clamp values between new min/max scores
			const {min: minScore, max: maxScore} = this._pb_getMinMaxScores();
			Parser.ABIL_ABVS.forEach(it => {
				const prop = `pb_${it}`;
				this._state[prop] = Math.min(maxScore, Math.max(minScore, this._state[prop]));
			});
			// endregion
		};
		this._addHookBase("pb_rules", hkRules);
		hkRules();

		let lastIsCustom = this._state.pb_isCustom;
		const hkIsCustomReset = () => {
			$stgCustomCostControls.toggleVe(this._state.pb_isCustom);

			if (lastIsCustom === this._state.pb_isCustom) return;
			lastIsCustom = this._state.pb_isCustom;

			// On resetting to non-custom, reset the rules
			if (!this._state.pb_isCustom) this._state.pb_rules = this._getDefaultStatePointBuyCosts().pb_rules;
		};
		this._addHookBase("pb_isCustom", hkIsCustomReset);
		hkIsCustomReset();

		return $$`<div class="ve-flex-col">
			<h4>Ability Score Point Cost</h4>

			<div class="ve-flex-col">
				<div class="ve-flex mobile__ve-flex-col">
					<div class="ve-flex-col mr-3mobile__mr-0">
						<div class="ve-flex-v-center mb-1">
							<div class="statgen-pb__col-cost ve-flex-vh-center bold">Score</div>
							<div class="statgen-pb__col-cost ve-flex-vh-center bold">Modifier</div>
							<div class="statgen-pb__col-cost ve-flex-vh-center bold">Point Cost</div>
							<div class="statgen-pb__col-cost-delete"></div>
						</div>

						${$stgCostRows}
					</div>

					${$stgCustomCostControls}
				</div>
			</div>

			<hr class="hr-4 mb-2">

			<label class="ve-flex-v-center">
				<div class="mr-2">Custom Rules</div>
				${ComponentUiUtil.$getCbBool(this, "pb_isCustom")}
			</label>
		</div>`;
	}

	_serialize_pb_rules () {
		const out = [
			this._state.pb_budget,
			...MiscUtil.copyFast(this._state.pb_rules).map(it => [it.entity.score, it.entity.cost]),
		];
		return JSON.stringify(out);
	}

	static _DESERIALIZE_MSG_INVALID = "Code was not valid!";

	_deserialize_pb_rules (raw) {
		let json;
		try {
			json = JSON.parse(raw);
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to decode JSON! ${e.message}`});
			return null;
		}

		if (!(json instanceof Array)) return void JqueryUtil.doToast({type: "danger", content: this.constructor._DESERIALIZE_MSG_INVALID});

		const [budget, ...rules] = json;

		if (isNaN(budget)) return void JqueryUtil.doToast({type: "danger", content: this.constructor._DESERIALIZE_MSG_INVALID});

		if (
			!rules
				.every(it => it instanceof Array && it[0] != null && !isNaN(it[0]) && it[1] != null && !isNaN(it[1]))
		) return void JqueryUtil.doToast({type: "danger", content: this.constructor._DESERIALIZE_MSG_INVALID});

		return {
			pb_budget: budget,
			pb_rules: rules.map(it => this._getDefaultState_pb_rule(it[0], it[1])),
		};
	}

	_render_all ($wrpTab) {
		if (this._isLevelUp) return this._render_isLevelUp($wrpTab);
		this._render_isLevelOne($wrpTab);
	}

	_render_isLevelOne ($wrpTab) {
		let $stgNone;
		let $stgMain;
		const $elesRolled = [];
		const $elesArray = [];
		const $elesPb = [];
		const $elesManual = [];

		// region Rolled header
		const $stgRolledHeader = this._render_$getStgRolledHeader();
		const hkStgRolled = () => $stgRolledHeader.toggleVe(this.ixActiveTab === this._IX_TAB_ROLLED);
		this._addHookActiveTab(hkStgRolled);
		hkStgRolled();
		// endregion

		// region Point Buy stages
		const $stgPbHeader = this._render_$getStgPbHeader();
		const $stgPbCustom = this._render_$getStgPbCustom();
		const $vrPbCustom = $(`<div class="vr-5 mobile-ish__hidden"></div>`);
		const $hrPbCustom = $(`<hr class="hr-5 mobile-ish__visible">`);
		const hkStgPb = () => {
			$stgPbHeader.toggleVe(this.ixActiveTab === this._IX_TAB_PB);
			$stgPbCustom.toggleVe(this.ixActiveTab === this._IX_TAB_PB);
			$vrPbCustom.toggleVe(this.ixActiveTab === this._IX_TAB_PB);
			$hrPbCustom.toggleVe(this.ixActiveTab === this._IX_TAB_PB);
		};
		this._addHookActiveTab(hkStgPb);
		hkStgPb();
		// endregion

		// region Array header
		const $stgArrayHeader = this._render_$getStgArrayHeader();
		const hkStgArray = () => $stgArrayHeader.toggleVe(this.ixActiveTab === this._IX_TAB_ARRAY);
		this._addHookActiveTab(hkStgArray);
		hkStgArray();
		// endregion

		// region Manual header
		const $stgManualHeader = this._render_$getStgManualHeader();
		const hkStgManual = () => $stgManualHeader.toggleVe(this.ixActiveTab === this._IX_TAB_MANUAL);
		this._addHookActiveTab(hkStgManual);
		hkStgManual();
		// endregion

		// region Other elements
		const hkElesMode = () => {
			$stgNone.toggleVe(this.ixActiveTab === this._IX_TAB_NONE);
			$stgMain.toggleVe(this.ixActiveTab !== this._IX_TAB_NONE);

			$elesRolled.forEach($ele => $ele.toggleVe(this.ixActiveTab === this._IX_TAB_ROLLED));
			$elesArray.forEach($ele => $ele.toggleVe(this.ixActiveTab === this._IX_TAB_ARRAY));
			$elesPb.forEach($ele => $ele.toggleVe(this.ixActiveTab === this._IX_TAB_PB));
			$elesManual.forEach($ele => $ele.toggleVe(this.ixActiveTab === this._IX_TAB_MANUAL));
		};
		this._addHookActiveTab(hkElesMode);
		// endregion

		const $btnResetRolledOrArrayOrManual = $(`<button class="btn btn-default btn-xxs relative statgen-shared__btn-reset" title="Reset"><span class="glyphicon glyphicon-refresh"></span></button>`)
			.click(() => this._doReset());
		const hkRolledOrArray = () => $btnResetRolledOrArrayOrManual.toggleVe(this.ixActiveTab === this._IX_TAB_ROLLED || this.ixActiveTab === this._IX_TAB_ARRAY || this.ixActiveTab === this._IX_TAB_MANUAL);
		this._addHookActiveTab(hkRolledOrArray);
		hkRolledOrArray();

		const $wrpsBase = Parser.ABIL_ABVS.map(ab => {
			// region Rolled
			const {propAbilSelectedRollIx} = this.constructor._rolled_getProps(ab);

			const $selRolled = $(`<select class="form-control input-xs form-control--minimal statgen-shared__ipt statgen-shared__ipt--sel"></select>`)
				.change(() => {
					const ix = Number($selRolled.val());

					const nxtState = {
						...Parser.ABIL_ABVS
							.map(ab => this.constructor._rolled_getProps(ab).propAbilSelectedRollIx)
							.filter(prop => ix != null && this._state[prop] === ix)
							.mergeMap(prop => ({[prop]: null})),
						[propAbilSelectedRollIx]: ~ix ? ix : null,
					};
					this._proxyAssignSimple("state", nxtState);
				});
			$(`<option/>`, {value: -1, text: "\u2014"}).appendTo($selRolled);

			let $optionsRolled = [];
			const hkRolls = () => {
				$optionsRolled.forEach($opt => $opt.remove());

				this._state.rolled_rolls.forEach((it, i) => {
					const cntPrevRolls = this._state.rolled_rolls.slice(0, i).filter(r => r.total === it.total).length;
					const $opt = $(`<option/>`, {value: i, text: `${it.total}${cntPrevRolls ? Parser.numberToSubscript(cntPrevRolls) : ""}`}).appendTo($selRolled);
					$optionsRolled.push($opt);
				});

				let nxtSelIx = this._state[propAbilSelectedRollIx];
				if (nxtSelIx >= this._state.rolled_rolls.length) nxtSelIx = null;
				$selRolled.val(`${nxtSelIx == null ? -1 : nxtSelIx}`);
				if ((nxtSelIx) !== this._state[propAbilSelectedRollIx]) this._state[propAbilSelectedRollIx] = nxtSelIx;
			};
			this._addHookBase("rolled_rolls", hkRolls);
			hkRolls();

			const hookIxRolled = () => {
				const ix = this._state[propAbilSelectedRollIx] == null ? -1 : this._state[propAbilSelectedRollIx];
				$selRolled.val(`${ix}`);
			};
			this._addHookBase(propAbilSelectedRollIx, hookIxRolled);
			hookIxRolled();

			$elesRolled.push($selRolled);
			// endregion

			// region Array
			const {propAbilSelectedScoreIx} = this.constructor._array_getProps(ab);

			const $selArray = $(`<select class="form-control input-xs form-control--minimal statgen-shared__ipt statgen-shared__ipt--sel"></select>`)
				.change(() => {
					const ix = Number($selArray.val());

					const nxtState = {
						...Parser.ABIL_ABVS
							.map(ab => this.constructor._array_getProps(ab).propAbilSelectedScoreIx)
							.filter(prop => ix != null && this._state[prop] === ix)
							.mergeMap(prop => ({[prop]: null})),
						[propAbilSelectedScoreIx]: ~ix ? ix : null,
					};
					this._proxyAssignSimple("state", nxtState);
				});
			$(`<option/>`, {value: -1, text: "\u2014"}).appendTo($selArray);

			StatGenUi._STANDARD_ARRAY.forEach((it, i) => $(`<option/>`, {value: i, text: it}).appendTo($selArray));

			const hookIxArray = () => {
				const ix = this._state[propAbilSelectedScoreIx] == null ? -1 : this._state[propAbilSelectedScoreIx];
				$selArray.val(`${ix}`);
			};
			this._addHookBase(propAbilSelectedScoreIx, hookIxArray);
			hookIxArray();

			$elesArray.push($selArray);
			// endregion

			// region Point buy
			const propPb = `pb_${ab}`;
			const $iptPb = ComponentUiUtil.$getIptInt(
				this,
				propPb,
				0,
				{
					fallbackOnNaN: 0,
					min: 0,
					html: `<input class="form-control form-control--minimal statgen-shared__ipt text-right" type="number">`,
				},
			);

			const hkPb = () => {
				const {min: minScore, max: maxScore} = this._pb_getMinMaxScores();
				this._state[propPb] = Math.min(maxScore, Math.max(minScore, this._state[propPb]));
			};
			this._addHookBase(propPb, hkPb);
			hkPb();

			$elesPb.push($iptPb);
			// endregion

			// region Manual
			const {propAbilValue} = this.constructor._manual_getProps(ab);
			const $iptManual = ComponentUiUtil.$getIptInt(
				this,
				propAbilValue,
				0,
				{
					fallbackOnNaN: 0,
					html: `<input class="form-control form-control--minimal statgen-shared__ipt text-right" type="number">`,
				},
			);

			$elesManual.push($iptManual);
			// endregion

			return $$`<label class="my-1 statgen-pb__cell">
				${$selRolled}
				${$selArray}
				${$iptPb}
				${$iptManual}
			</label>`;
		});

		const $wrpsUser = this._render_$getWrpsUser();

		const metasTotalAndMod = this._render_getMetasTotalAndMod();

		const {
			$wrpOuter: $wrpRaceOuter,
			$stgSel: $stgRaceSel,
			$dispPreview: $dispPreviewRace,
			$hrPreview: $hrPreviewRaceTashas,
			$dispTashas,
		} = this._renderLevelOneRace.render();

		const {
			$wrpOuter: $wrpBackgroundOuter,
			$stgSel: $stgBackgroundSel,
			$dispPreview: $dispPreviewBackground,
			$hrPreview: $hrPreviewBackground,
		} = this._renderLevelOneBackground.render();

		const $wrpAsi = this._render_$getWrpAsi();

		$stgNone = $$`<div class="ve-flex-col w-100 h-100">
			<div class="ve-flex-v-center"><i>Please select a mode.</i></div>
		</div>`;

		$stgMain = $$`<div class="ve-flex-col w-100 h-100">
			${$stgRolledHeader}
			${$stgArrayHeader}
			${$stgManualHeader}

			<div class="ve-flex mobile-ish__ve-flex-col w-100 px-3">
				<div class="ve-flex-col">
					${$stgPbHeader}

					<div class="ve-flex">
						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>
							<div class="my-1 statgen-pb__header ve-flex-h-right">${$btnResetRolledOrArrayOrManual}</div>

							${Parser.ABIL_ABVS.map(it => `<div class="my-1 bold statgen-pb__cell ve-flex-v-center ve-flex-h-right" title="${Parser.attAbvToFull(it)}">${it.toUpperCase()}</div>`)}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>
							<div class="my-1 bold statgen-pb__header ve-flex-vh-center">Base</div>
							${$wrpsBase}
						</div>

						${$wrpRaceOuter}

						${$wrpBackgroundOuter}

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>
							<div class="my-1 statgen-pb__header ve-flex-vh-center help text-muted" title="Input any additional/custom bonuses here">User</div>
							${$wrpsUser}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>
							<div class="my-1 statgen-pb__header ve-flex-vh-center">Total</div>
							${metasTotalAndMod.map(it => it.$wrpIptTotal)}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>
							<div class="my-1 statgen-pb__header ve-flex-vh-center" title="Modifier">Mod.</div>
							${metasTotalAndMod.map(it => it.$wrpIptMod)}
						</div>
					</div>

					${$stgRaceSel}
					${$stgBackgroundSel}
				</div>

				${$vrPbCustom}
				${$hrPbCustom}

				${$stgPbCustom}
			</div>

			<hr class="hr-3">

			${$dispPreviewRace}
			${$hrPreviewRaceTashas}
			${$dispTashas}

			${$dispPreviewBackground}
			${$hrPreviewBackground}

			${$wrpAsi}
		</div>`;

		hkElesMode();

		$wrpTab
			.append($stgMain)
			.append($stgNone);
	}

	static _RenderLevelOneEntity = class {
		_title;
		_titleShort;
		_propIxEntity;
		_propIxAbilityScoreSet;
		_propData;
		_propModalFilter;
		_propIsPreview;
		_propEntity;
		_page;
		_propChoiceMetasFrom;
		_propChoiceWeighted;

		constructor ({parent}) {
			this._parent = parent;

			this._pbHookMetas = [];
		}

		render () {
			const $wrp = $(`<div class="ve-flex"></div>`);
			const $wrpOuter = $$`<div class="ve-flex-col">
				<div class="my-1 statgen-pb__header statgen-pb__header--group mr-3 text-center italic ve-small help-subtle" title="Ability Score Changes from ${this._title}">${this._titleShort}</div>

				${$wrp}
			</div>`;

			// Ensure this is run first, and doesn't trigger further state changes
			this._parent._addHookBase(this._propIxEntity, () => this._parent.__state[this._propIxAbilityScoreSet] = 0);

			const hkIxEntity = (prop) => {
				this._pb_unhookRender();
				const isInitialLoad = prop == null;
				if (!isInitialLoad) this._parent._state[this._propChoiceMetasFrom] = [];
				if (!isInitialLoad) this._parent._state[this._propChoiceWeighted] = [];
				const isAnyFromEntity = this._render_pointBuy($wrp);
				$wrpOuter.toggleVe(isAnyFromEntity);
			};
			this._parent._addHookBase(this._propIxEntity, hkIxEntity);
			this._bindAdditionalHooks_hkIxEntity(hkIxEntity);
			this._parent._addHookBase(this._propIxAbilityScoreSet, hkIxEntity);
			hkIxEntity();

			const {$wrp: $selEntity, fnUpdateHidden: fnUpdateSelEntityHidden} = ComponentUiUtil.$getSelSearchable(
				this._parent,
				this._propIxEntity,
				{
					values: this._parent[this._propData].map((_, i) => i),
					isAllowNull: true,
					fnDisplay: ix => {
						const r = this._parent[this._propData][ix];
						if (!r) return "(Unknown)";
						return `${r.name} ${r.source !== Parser.SRC_PHB ? `[${Parser.sourceJsonToAbv(r.source)}]` : ""}`;
					},
					asMeta: true,
				},
			);

			const doApplyFilterToSelEntity = () => {
				const f = this._parent[this._propModalFilter].pageFilter.filterBox.getValues();
				const isHiddenPerEntity = this._parent[this._propData].map(it => !this._parent[this._propModalFilter].pageFilter.toDisplay(f, it));
				fnUpdateSelEntityHidden(isHiddenPerEntity, false);
			};

			this._parent[this._propModalFilter].pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, () => doApplyFilterToSelEntity());
			doApplyFilterToSelEntity();

			const $btnFilterForEntity = $(`<button class="btn btn-xs btn-default br-0 pr-2" title="Filter for ${this._title}"><span class="glyphicon glyphicon-filter"></span> Filter</button>`)
				.click(async () => {
					const selected = await this._parent[this._propModalFilter].pGetUserSelection();
					if (selected == null || !selected.length) return;

					const selectedEntity = selected[0];
					const ixEntity = this._parent[this._propData].findIndex(it => it.name === selectedEntity.name && it.source === selectedEntity.values.sourceJson);
					if (!~ixEntity) throw new Error(`Could not find selected ${this._title.toLowerCase()}: ${JSON.stringify(selectedEntity)}`); // Should never occur
					this._parent._state[this._propIxEntity] = ixEntity;
				});

			const $btnPreview = ComponentUiUtil.$getBtnBool(
				this._parent,
				this._propIsPreview,
				{
					html: `<button class="btn btn-xs btn-default" title="Toggle ${this._title} Preview"><span class="glyphicon glyphicon-eye-open"></span></button>`,
				},
			);
			const hkBtnPreviewEntity = () => $btnPreview.toggleVe(this._parent._state[this._propIxEntity] != null && ~this._parent._state[this._propIxEntity]);
			this._parent._addHookBase(this._propIxEntity, hkBtnPreviewEntity);
			hkBtnPreviewEntity();

			// region Ability score set selection
			const {$sel: $selAbilitySet, setValues: setValuesSelAbilitySet} = ComponentUiUtil.$getSelEnum(
				this._parent,
				this._propIxAbilityScoreSet,
				{
					values: [],
					asMeta: true,
					fnDisplay: ixAbSet => {
						const lst = this._pb_getAbilityList();
						if (!lst?.[ixAbSet]) return "(Unknown)";
						return Renderer.getAbilityData([lst[ixAbSet]]).asText;
					},
				},
			);

			const $stgAbilityScoreSet = $$`<div class="ve-flex-v-center mb-2">
				<div class="mr-2">Ability Score Increase</div>
				<div>${$selAbilitySet}</div>
			</div>`;

			const hkSetValuesSelAbilitySet = () => {
				const entity = this._parent[this._propEntity];
				$stgAbilityScoreSet.toggleVe(!!entity && entity.ability?.length > 1);
				setValuesSelAbilitySet(
					[...new Array(entity?.ability?.length || 0)].map((_, ix) => ix),
					{isForce: true},
				);
			};
			this._parent._addHookBase(this._propIxEntity, hkSetValuesSelAbilitySet);
			this._bindAdditionalHooks_hkSetValuesSelAbilitySet(hkSetValuesSelAbilitySet);
			hkSetValuesSelAbilitySet();
			// endregion

			const $dispPreview = $(`<div class="ve-flex-col mb-2"></div>`);
			const hkPreviewEntity = () => {
				if (!this._parent._state[this._propIsPreview]) return $dispPreview.hideVe();

				const entity = this._parent._state[this._propIxEntity] != null ? this._parent[this._propData][this._parent._state[this._propIxEntity]] : null;
				if (!entity) return $dispPreview.hideVe();

				$dispPreview.empty().showVe().append(Renderer.hover.$getHoverContent_stats(this._page, entity));
			};
			this._parent._addHookBase(this._propIxEntity, hkPreviewEntity);
			this._parent._addHookBase(this._propIsPreview, hkPreviewEntity);
			hkPreviewEntity();

			const {$hrPreview} = this._getHrPreviewMeta();

			const $stgSel = $$`<div class="ve-flex-col mt-3">
				<div class="mb-1">Select a ${this._title}</div>
				<div class="ve-flex-v-center mb-2">
					<div class="ve-flex-v-center btn-group w-100 mr-2">${$btnFilterForEntity}${$selEntity}</div>
					<div>${$btnPreview}</div>
				</div>
				${$stgAbilityScoreSet}
			</div>`;

			return {
				$wrpOuter,

				$stgSel,

				$dispPreview,
				$hrPreview,
			};
		}

		_pb_unhookRender () {
			this._pbHookMetas.forEach(it => it.unhook());
			this._pbHookMetas = [];
		}

		_render_pointBuy ($wrp) {
			$wrp.empty();

			const fromEntity = this._pb_getAbility();
			if (fromEntity == null) return false;

			let $ptBase = null;
			if (Parser.ABIL_ABVS.some(it => fromEntity[it])) {
				const $wrpsEntity = Parser.ABIL_ABVS.map(ab => {
					return $$`<div class="my-1 statgen-pb__cell">
						<input class="form-control form-control--minimal statgen-shared__ipt text-right" type="number" readonly value="${fromEntity[ab] || 0}">
					</div>`;
				});

				$ptBase = $$`<div class="ve-flex-col mr-3">
					<div class="my-1 statgen-pb__header ve-flex-vh-center">Static</div>
					${$wrpsEntity}
				</div>`;
			}

			let $ptChooseFrom = null;
			if (fromEntity.choose && fromEntity.choose.from) {
				const amount = fromEntity.choose.amount || 1;
				const count = fromEntity.choose.count || 1;

				const $wrpsChoose = Parser.ABIL_ABVS.map(ab => {
					if (!fromEntity.choose.from.includes(ab)) return `<div class="my-1 statgen-pb__cell"></div>`;

					const $cb = $(`<input type="checkbox">`)
						.change(() => {
							const existing = this._parent._state[this._propChoiceMetasFrom].find(it => it.ability === ab);
							if (existing) {
								this._parent._state[this._propChoiceMetasFrom] = this._parent._state[this._propChoiceMetasFrom].filter(it => it !== existing);
								return;
							}

							// If we're already at the max number of choices, remove the oldest one
							if (this._parent._state[this._propChoiceMetasFrom].length >= count) {
								while (this._parent._state[this._propChoiceMetasFrom].length >= count) this._parent._state[this._propChoiceMetasFrom].shift();
								this._parent._state[this._propChoiceMetasFrom] = [...this._parent._state[this._propChoiceMetasFrom]];
							}

							this._parent._state[this._propChoiceMetasFrom] = [
								...this._parent._state[this._propChoiceMetasFrom],
								{ability: ab, amount},
							];
						});

					const hk = () => $cb.prop("checked", this._parent._state[this._propChoiceMetasFrom].some(it => it.ability === ab));
					this._parent._addHookBase(this._propChoiceMetasFrom, hk);
					this._pbHookMetas.push({unhook: () => this._parent._removeHookBase(this._propChoiceMetasFrom, hk)});
					hk();

					return $$`<label class="my-1 statgen-pb__cell ve-flex-vh-center">${$cb}</label>`;
				});

				$ptChooseFrom = $$`<div class="ve-flex-col mr-3">
					<div class="my-1 statgen-pb__header statgen-pb__header--choose-from ve-flex-vh-center">
						<div class="${count !== 1 ? `mr-1` : ""}">${UiUtil.intToBonus(amount, {isPretty: true})}</div>${count !== 1 ? `<div class="ve-small ve-muted">(x${count})</div>` : ""}
					</div>
					${$wrpsChoose}
				</div>`;
			}

			let $ptsChooseWeighted = null;
			if (fromEntity.choose && fromEntity.choose.weighted && fromEntity.choose.weighted.weights) {
				$ptsChooseWeighted = fromEntity.choose.weighted.weights.map((weight, ixWeight) => {
					const $wrpsChoose = Parser.ABIL_ABVS.map(ab => {
						if (!fromEntity.choose.weighted.from.includes(ab)) return `<div class="my-1 statgen-pb__cell"></div>`;

						const $cb = $(`<input type="checkbox">`)
							.change(() => {
								const existing = this._parent._state[this._propChoiceWeighted].find(it => it.ability === ab && it.ix === ixWeight);
								if (existing) {
									this._parent._state[this._propChoiceWeighted] = this._parent._state[this._propChoiceWeighted].filter(it => it !== existing);
									return;
								}

								// Remove other selections for the same ability score, or selections for the same weight
								const withSameAbil = this._parent._state[this._propChoiceWeighted].filter(it => it.ability === ab || it.ix === ixWeight);
								if (withSameAbil.length) {
									this._parent._state[this._propChoiceWeighted] = this._parent._state[this._propChoiceWeighted].filter(it => it.ability !== ab && it.ix !== ixWeight);
								}

								this._parent._state[this._propChoiceWeighted] = [
									...this._parent._state[this._propChoiceWeighted],
									{ability: ab, amount: weight, ix: ixWeight},
								];
							});

						const hk = () => {
							$cb.prop("checked", this._parent._state[this._propChoiceWeighted].some(it => it.ability === ab && it.ix === ixWeight));
						};
						this._parent._addHookBase(this._propChoiceWeighted, hk);
						this._pbHookMetas.push({unhook: () => this._parent._removeHookBase(this._propChoiceWeighted, hk)});
						hk();

						return $$`<label class="my-1 statgen-pb__cell ve-flex-vh-center">${$cb}</label>`;
					});

					return $$`<div class="ve-flex-col mr-3">
						<div class="my-1 statgen-pb__header statgen-pb__header--choose-from ve-flex-vh-center">${UiUtil.intToBonus(weight, {isPretty: true})}</div>
						${$wrpsChoose}
					</div>`;
				});
			}

			$$($wrp)`
				${$ptBase}
				${$ptChooseFrom}
				${$ptsChooseWeighted}
			`;

			return $ptBase || $ptChooseFrom || $ptsChooseWeighted;
		}

		/** @abstract */
		_pb_getAbilityList () { throw new Error("Unimplemented!"); }

		/** @abstract */
		_pb_getAbility () { throw new Error("Unimplemented!"); }

		_bindAdditionalHooks_hkIxEntity (hkIxEntity) { /* Implement as required */ }
		_bindAdditionalHooks_hkSetValuesSelAbilitySet (hkSetValuesSelAbilitySet) { /* Implement as required */ }

		_getHrPreviewMeta () {
			const $hrPreview = $(`<hr class="hr-3">`);
			const hkPreview = this._getHkPreview({$hrPreview});
			this._parent._addHookBase(this._propIsPreview, hkPreview);
			hkPreview();

			return {
				$hrPreview,
				hkPreview,
			};
		}

		_getHkPreview ({$hrPreview}) {
			return () => $hrPreview.toggleVe(this._parent._state[this._propIsPreview]);
		}
	};

	static _RenderLevelOneRace = class extends this._RenderLevelOneEntity {
		_title = "Race";
		_titleShort = "Race";
		_propIxEntity = "common_ixRace";
		_propIxAbilityScoreSet = "common_ixAbilityScoreSetRace";
		_propData = "_races";
		_propModalFilter = "_modalFilterRaces";
		_propIsPreview = "common_isPreviewRace";
		_propEntity = "race";
		_page = UrlUtil.PG_RACES;
		_propChoiceMetasFrom = "common_raceChoiceMetasFrom";
		_propChoiceWeighted = "common_raceChoiceMetasWeighted";

		render () {
			const out = super.render();

			const {$btnToggleTashasPin, $dispTashas} = this._$getPtsTashas();

			out.$stgSel.append($$`<label class="ve-flex-v-center mb-1">
				<div class="mr-2">Allow Origin Customization</div>
				${ComponentUiUtil.$getCbBool(this._parent, "common_isTashas")}
			</label>`);

			out.$stgSel.append($$`<div class="ve-flex">
				<div class="ve-small ve-muted italic mr-1">${Renderer.get().render(`An {@variantrule Customizing Your Origin|TCE|optional rule}`)}</div>
				${$btnToggleTashasPin}
				<div class="ve-small ve-muted italic ml-1">${Renderer.get().render(`from Tasha's Cauldron of Everything, page 8.`)}</div>
			</div>`);

			out.$dispTashas = $dispTashas;

			return out;
		}

		_pb_getAbilityList () {
			return this._parent._pb_getRaceAbilityList();
		}

		_pb_getAbility () {
			return this._parent._pb_getRaceAbility();
		}

		_bindAdditionalHooks_hkIxEntity (hkIxEntity) {
			this._parent._addHookBase("common_isTashas", hkIxEntity);
		}

		_bindAdditionalHooks_hkSetValuesSelAbilitySet (hkSetValuesSelAbilitySet) {
			this._parent._addHookBase("common_isTashas", hkSetValuesSelAbilitySet);
		}

		_getHrPreviewMeta () {
			const out = super._getHrPreviewMeta();
			const {hkPreview} = out;
			this._parent._addHookBase("common_isShowTashasRules", hkPreview);
			return out;
		}

		_getHkPreview ({$hrPreview}) {
			return () => $hrPreview.toggleVe(this._parent._state[this._propIsPreview] && this._parent._state.common_isShowTashasRules);
		}

		_$getPtsTashas () {
			const $btnToggleTashasPin = ComponentUiUtil.$getBtnBool(
				this._parent,
				"common_isShowTashasRules",
				{
					html: `<button class="btn btn-xxs btn-default ve-small p-0 statgen-shared__btn-toggle-tashas-rules ve-flex-vh-center" title="Toggle &quot;Customizing Your Origin&quot; Section"><span class="glyphicon glyphicon-eye-open"></span></button>`,
				},
			);

			const $dispTashas = $(`<div class="ve-flex-col"><div class="italic ve-muted">Loading...</div></div>`);
			DataLoader.pCacheAndGet(UrlUtil.PG_VARIANTRULES, Parser.SRC_TCE, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_VARIANTRULES]({name: "Customizing Your Origin", source: Parser.SRC_TCE}))
				.then(rule => {
					$$($dispTashas.empty())`${Renderer.hover.$getHoverContent_stats(UrlUtil.PG_VARIANTRULES, rule)}<hr class="hr-3">`;
				});
			const hkIsShowTashas = () => {
				$dispTashas.toggleVe(this._parent._state.common_isShowTashasRules);
			};
			this._parent._addHookBase("common_isShowTashasRules", hkIsShowTashas);
			hkIsShowTashas();

			return {
				$btnToggleTashasPin,
				$dispTashas,
			};
		}
	};

	_renderLevelOneRace = new this.constructor._RenderLevelOneRace({parent: this});

	static _RenderLevelOneBackground = class extends this._RenderLevelOneEntity {
		_title = "Background";
		_titleShort = "Backg.";
		_propIxEntity = "common_ixBackground";
		_propIxAbilityScoreSet = "common_ixAbilityScoreSetBackground";
		_propData = "_backgrounds";
		_propModalFilter = "_modalFilterBackgrounds";
		_propIsPreview = "common_isPreviewBackground";
		_propEntity = "background";
		_page = UrlUtil.PG_BACKGROUNDS;
		_propChoiceMetasFrom = "common_backgroundChoiceMetasFrom";
		_propChoiceWeighted = "common_backgroundChoiceMetasWeighted";

		_pb_getAbilityList () {
			return this._parent._pb_getBackgroundAbilityList();
		}

		_pb_getAbility () {
			return this._parent._pb_getBackgroundAbility();
		}
	};

	_renderLevelOneBackground = new this.constructor._RenderLevelOneBackground({parent: this});

	_render_isLevelUp ($wrpTab) {
		const $wrpsExisting = Parser.ABIL_ABVS.map(ab => {
			const $iptExisting = $(`<input class="form-control form-control--minimal statgen-shared__ipt text-right" type="number" readonly>`)
				.val(this._existingScores[ab]);

			return $$`<label class="my-1 statgen-pb__cell">
				${$iptExisting}
			</label>`;
		});

		const $wrpsUser = this._render_$getWrpsUser();

		const metasTotalAndMod = this._render_getMetasTotalAndMod();

		const $wrpAsi = this._render_$getWrpAsi();

		$$($wrpTab)`
			<div class="ve-flex mobile-ish__ve-flex-col w-100 px-3">
				<div class="ve-flex-col">
					<div class="ve-flex">
						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header"></div>

							${Parser.ABIL_ABVS.map(it => `<div class="my-1 bold statgen-pb__cell ve-flex-v-center ve-flex-h-right" title="${Parser.attAbvToFull(it)}">${it.toUpperCase()}</div>`)}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 bold statgen-pb__header ve-flex-vh-center" title="Current">Curr.</div>
							${$wrpsExisting}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header ve-flex-vh-center help text-muted" title="Input any additional/custom bonuses here">User</div>
							${$wrpsUser}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header ve-flex-vh-center">Total</div>
							${metasTotalAndMod.map(it => it.$wrpIptTotal)}
						</div>

						<div class="ve-flex-col mr-3">
							<div class="my-1 statgen-pb__header ve-flex-vh-center" title="Modifier">Mod.</div>
							${metasTotalAndMod.map(it => it.$wrpIptMod)}
						</div>
					</div>
				</div>
			</div>

			<hr class="hr-3">

			${$wrpAsi}
		`;
	}

	_render_$getWrpsUser () {
		return Parser.ABIL_ABVS.map(ab => {
			const {propUserBonus} = this.constructor._common_getProps(ab);
			const $ipt = ComponentUiUtil.$getIptInt(
				this,
				propUserBonus,
				0,
				{
					fallbackOnNaN: 0,
					html: `<input class="form-control form-control--minimal statgen-shared__ipt text-right" type="number">`,
				},
			);
			return $$`<label class="my-1 statgen-pb__cell">${$ipt}</label>`;
		});
	}

	_render_getMetasTotalAndMod () {
		return Parser.ABIL_ABVS.map(ab => {
			const $iptTotal = $(`<input class="form-control form-control--minimal statgen-shared__ipt text-center" type="text" readonly>`);
			const $iptMod = $(`<input class="form-control form-control--minimal statgen-shared__ipt text-center" type="text" readonly>`);

			const $wrpIptTotal = $$`<label class="my-1 statgen-pb__cell">${$iptTotal}</label>`;
			const $wrpIptMod = $$`<label class="my-1 statgen-pb__cell">${$iptMod}</label>`;

			const exportedStateProp = `common_export_${ab}`;

			const getTotalScore = () => {
				if (this._isLevelUp) return this._levelUp_getTotalScore(ab);
				switch (this.ixActiveTab) {
					case this._IX_TAB_ROLLED: return this._rolled_getTotalScore(ab);
					case this._IX_TAB_ARRAY: return this._array_getTotalScore(ab);
					case this._IX_TAB_PB: return this._pb_getTotalScore(ab);
					case this._IX_TAB_MANUAL: return this._manual_getTotalScore(ab);
					default: return 0;
				}
			};

			const hk = () => {
				const totalScore = getTotalScore();

				const isOverLimit = totalScore > 20;
				$iptTotal
					.val(totalScore)
					.toggleClass("form-control--error", isOverLimit)
					.title(isOverLimit ? `In general, you can't increase an ability score above 20.` : "");
				$iptMod.val(Parser.getAbilityModifier(totalScore));

				this._state[exportedStateProp] = totalScore;
			};
			this._addHookAll("state", hk);
			this._addHookActiveTab(hk);
			hk();

			return {
				$wrpIptTotal,
				$wrpIptMod,
			};
		});
	}

	_render_$getWrpAsi () {
		const $wrpAsi = $(`<div class="ve-flex-col w-100"></div>`);
		this._compAsi.render($wrpAsi);
		return $wrpAsi;
	}

	static _common_getProps (ab) {
		return {
			propUserBonus: `${StatGenUi._PROP_PREFIX_COMMON}${ab}_user`,
		};
	}

	static _rolled_getProps (ab) {
		return {
			propAbilSelectedRollIx: `${StatGenUi._PROP_PREFIX_ROLLED}${ab}_abilSelectedRollIx`,
		};
	}

	static _array_getProps (ab) {
		return {
			propAbilSelectedScoreIx: `${StatGenUi._PROP_PREFIX_ARRAY}${ab}_abilSelectedScoreIx`,
		};
	}

	static _manual_getProps (ab) {
		return {
			propAbilValue: `${StatGenUi._PROP_PREFIX_MANUAL}${ab}_abilValue`,
		};
	}

	_pb_getRaceAbilityList () {
		const race = this.race;
		if (!race?.ability?.length) return null;

		return race.ability
			.map(fromRace => {
				if (this._state.common_isTashas) {
					const weights = [];

					if (fromRace.choose && fromRace.choose.weighted && fromRace.choose.weighted.weights) {
						weights.push(...fromRace.choose.weighted.weights);
					}

					Parser.ABIL_ABVS.forEach(it => {
						if (fromRace[it]) weights.push(fromRace[it]);
					});

					if (fromRace.choose && fromRace.choose.from) {
						const count = fromRace.choose.count || 1;
						const amount = fromRace.choose.amount || 1;
						for (let i = 0; i < count; ++i) weights.push(amount);
					}

					weights.sort((a, b) => SortUtil.ascSort(b, a));

					fromRace = {
						choose: {
							weighted: {
								from: [...Parser.ABIL_ABVS],
								weights,
							},
						},
					};
				}

				return fromRace;
			});
	}

	_pb_getBackgroundAbilityList () {
		const background = this.background;
		if (!background?.ability?.length) return null;
		return background.ability;
	}

	_pb_getRaceAbility () {
		return this._pb_getRaceAbilityList()?.[this._state.common_ixAbilityScoreSetRace || 0];
	}

	_pb_getBackgroundAbility () {
		return this._pb_getBackgroundAbilityList()?.[this._state.common_ixAbilityScoreSetBackground || 0];
	}

	_pb_getPointsRemaining (baseState) {
		const spent = Parser.ABIL_ABVS.map(it => {
			const prop = `pb_${it}`;
			const score = baseState[prop];
			const rule = this._state.pb_rules.find(it => it.entity.score === score);
			if (!rule) return 0;
			return rule.entity.cost;
		}).reduce((a, b) => a + b, 0);

		return this._state.pb_budget - spent;
	}

	_rolled_getTotalScore (ab) {
		const {propAbilSelectedRollIx} = this.constructor._rolled_getProps(ab);
		const {propUserBonus} = this.constructor._common_getProps(ab);
		return (this._state.rolled_rolls[this._state[propAbilSelectedRollIx]] || {total: 0}).total + this._state[propUserBonus] + this._getTotalScore_getBonuses(ab);
	}

	_array_getTotalScore (ab) {
		const {propAbilSelectedScoreIx} = this.constructor._array_getProps(ab);
		const {propUserBonus} = this.constructor._common_getProps(ab);
		return (StatGenUi._STANDARD_ARRAY[this._state[propAbilSelectedScoreIx]] || 0) + this._state[propUserBonus] + this._getTotalScore_getBonuses(ab);
	}

	_pb_getTotalScore (ab) {
		const prop = `pb_${ab}`;
		const {propUserBonus} = this.constructor._common_getProps(ab);
		return this._state[prop] + this._state[propUserBonus] + this._getTotalScore_getBonuses(ab);
	}

	_manual_getTotalScore (ab) {
		const {propAbilValue} = this.constructor._manual_getProps(ab);
		const {propUserBonus} = this.constructor._common_getProps(ab);
		return (this._state[propAbilValue] || 0) + this._state[propUserBonus] + this._getTotalScore_getBonuses(ab);
	}

	_levelUp_getTotalScore (ab) {
		const {propUserBonus} = this.constructor._common_getProps(ab);
		return (this._existingScores[ab] || 0) + this._state[propUserBonus] + this._getTotalScore_getBonuses(ab);
	}

	_getTotalScore_getBonuses (ab) {
		let total = 0;

		if (!this._isLevelUp) {
			const handleEntityAbility = ({fromEntity, propChoiceMetasFrom, propChoiceWeighted}) => {
				if (fromEntity) {
					if (fromEntity[ab]) total += fromEntity[ab];

					if (fromEntity.choose && fromEntity.choose.from) {
						total += this._state[propChoiceMetasFrom]
							.filter(it => it.ability === ab)
							.map(it => it.amount)
							.reduce((a, b) => a + b, 0);
					}

					if (fromEntity.choose && fromEntity.choose.weighted && fromEntity.choose.weighted.weights) {
						total += this._state[propChoiceWeighted]
							.filter(it => it.ability === ab)
							.map(it => it.amount)
							.reduce((a, b) => a + b, 0);
					}
				}
			};

			handleEntityAbility({
				fromEntity: this._pb_getRaceAbility(),
				propChoiceMetasFrom: "common_raceChoiceMetasFrom",
				propChoiceWeighted: "common_raceChoiceMetasWeighted",
			});

			handleEntityAbility({
				fromEntity: this._pb_getBackgroundAbility(),
				propChoiceMetasFrom: "common_backgroundChoiceMetasFrom",
				propChoiceWeighted: "common_backgroundChoiceMetasWeighted",
			});
		}

		const formDataAsi = this._compAsi.getFormData();
		if (formDataAsi) total += formDataAsi.data[ab] || 0;

		return total;
	}

	getSaveableState () {
		const out = super.getSaveableState();

		const handleEntity = ({propIxEntity, page, propData, propHash}) => {
			if (out[propIxEntity] != null && !~this._state[propIxEntity]) {
				out[propHash] = UrlUtil.URL_TO_HASH_BUILDER[page](this[propData][out[propIxEntity]]);
				delete out[propIxEntity];
			}
		};

		handleEntity({
			propIxEntity: "common_ixRace",
			page: UrlUtil.PG_RACES,
			propData: "_races",
			propHash: "_pb_raceHash",
		});

		handleEntity({
			propIxEntity: "common_ixBackground",
			page: UrlUtil.PG_BACKGROUNDS,
			propData: "_backgrounds",
			propHash: "_pb_backgroundHash",
		});

		return out;
	}

	// region External use
	getSaveableStatePointBuyCustom () {
		const base = this.getSaveableState();
		return {
			state: this.constructor._PROPS_POINT_BUY_CUSTOM.mergeMap(k => ({[k]: base.state[k]})),
		};
	}
	// endregion

	setStateFrom (saved, isOverwrite = false) {
		saved = MiscUtil.copy(saved);

		MiscUtil.getOrSet(saved, "state", {});

		const handleEntityHash = ({propHash, page, propData, propIxEntity}) => {
			if (!saved[propHash]) return;

			const ixEntity = this[propData].findIndex(it => {
				const hash = UrlUtil.URL_TO_HASH_BUILDER[page](it);
				return hash === saved[propHash];
			});
			if (~ixEntity) saved[propIxEntity] = ixEntity;
		};

		handleEntityHash({
			propHash: "_pb_raceHash",
			page: UrlUtil.PG_RACES,
			propData: "_races",
			propIxEntity: "common_ixRace",
		});

		handleEntityHash({
			propHash: "_pb_backgroundHash",
			page: UrlUtil.PG_BACKGROUNDS,
			propData: "_backgrounds",
			propIxEntity: "common_ixBackground",
		});

		const validKeys = new Set(Object.keys(this._getDefaultState()));
		const validKeyPrefixes = [
			StatGenUi._PROP_PREFIX_COMMON,
			StatGenUi._PROP_PREFIX_ROLLED,
			StatGenUi._PROP_PREFIX_ARRAY,
			StatGenUi._PROP_PREFIX_MANUAL,
		];

		Object.keys(saved.state).filter(k => !validKeys.has(k) && !validKeyPrefixes.some(it => k.startsWith(it))).forEach(k => delete saved.state[k]);

		// region Trim the ASI/feat state to the max count of ASIs/feats
		for (let i = saved.state.common_cntAsi || 0; i < 1000; ++i) {
			const {propMode, prefix} = this.getPropsAsi(i, "ability");
			if (saved.state[propMode]) Object.keys(saved.state).filter(k => k.startsWith(prefix)).forEach(k => delete saved.state[k]);
		}

		for (let i = saved.state.common_cntFeatsCustom || 0; i < 1000; ++i) {
			const {propMode, prefix} = this.getPropsAsi(i, "custom");
			if (saved.state[propMode]) Object.keys(saved.state).filter(k => k.startsWith(prefix)).forEach(k => delete saved.state[k]);
		}
		// endregion

		super.setStateFrom(saved, isOverwrite);
	}

	_pb_getMinMaxScores () {
		return {
			min: Math.min(...this._state.pb_rules.map(it => it.entity.score)),
			max: Math.max(...this._state.pb_rules.map(it => it.entity.score)),
		};
	}

	_getDefaultStateCommonResettable () {
		return {
			...Parser.ABIL_ABVS.mergeMap(ab => ({[this.constructor._common_getProps(ab).propUserBonus]: 0})),

			common_raceChoiceMetasFrom: [],
			common_raceChoiceMetasWeighted: [],

			common_backgroundChoiceMetasFrom: [],
			common_backgroundChoiceMetasWeighted: [],
		};
	}

	_getDefaultStateNoneResettable () { return {}; }

	_getDefaultStateRolledResettable () {
		return {
			...Parser.ABIL_ABVS.mergeMap(ab => ({[this.constructor._rolled_getProps(ab).propAbilSelectedRollIx]: null})),
		};
	}

	_getDefaultStateArrayResettable () {
		return {
			...Parser.ABIL_ABVS.mergeMap(ab => ({[this.constructor._array_getProps(ab).propAbilSelectedScoreIx]: null})),
		};
	}

	_getDefaultStatePointBuyResettable () {
		return {
			pb_str: 8,
			pb_dex: 8,
			pb_con: 8,
			pb_int: 8,
			pb_wis: 8,
			pb_cha: 8,
		};
	}

	_getDefaultStatePointBuyCosts () {
		return {
			pb_rules: [
				{score: 8, cost: 0},
				{score: 9, cost: 1},
				{score: 10, cost: 2},
				{score: 11, cost: 3},
				{score: 12, cost: 4},
				{score: 13, cost: 5},
				{score: 14, cost: 7},
				{score: 15, cost: 9},
			].map(({score, cost}) => this._getDefaultState_pb_rule(score, cost)),
		};
	}

	_getDefaultState_pb_rule (score, cost) {
		return {
			id: CryptUtil.uid(),
			entity: {
				score,
				cost,
			},
		};
	}

	_getDefaultStateManualResettable () {
		return {
			...Parser.ABIL_ABVS.mergeMap(ab => ({[this.constructor._manual_getProps(ab).propAbilValue]: null})),
		};
	}

	_getDefaultState () {
		return {
			// region Common
			common_isPreviewRace: false,
			common_isTashas: false,
			common_isShowTashasRules: false,
			common_ixRace: null,
			common_ixAbilityScoreSet: 0,

			common_isPreviewBackground: false,
			common_ixBackground: null,
			common_ixAbilityScoreSetBackground: 0,

			common_pulseAsi: false, // Used as a general pulse for all changes in form data
			common_cntAsi: 0,
			common_cntFeatsCustom: 0,

			// region Used to allow external components to hook onto score changes
			common_export_str: null,
			common_export_dex: null,
			common_export_con: null,
			common_export_int: null,
			common_export_wis: null,
			common_export_cha: null,
			// endregion

			...this._getDefaultStateCommonResettable(),
			// endregion

			// region Rolled stats
			rolled_formula: "4d6dl1",
			rolled_rollCount: 6,
			rolled_rolls: [],
			...this._getDefaultStateRolledResettable(),
			// endregion

			// region Standard array
			...this._getDefaultStateArrayResettable(),
			// endregion

			// region Point buy
			...this._getDefaultStatePointBuyResettable(),
			...this._getDefaultStatePointBuyCosts(),

			pb_points: 27,
			pb_budget: 27,

			pb_isCustom: false,
			// endregion

			// region Manual
			...this._getDefaultStateManualResettable(),
			// endregion
		};
	}
}

StatGenUi._STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
StatGenUi._PROP_PREFIX_COMMON = "common_";
StatGenUi._PROP_PREFIX_ROLLED = "rolled_";
StatGenUi._PROP_PREFIX_ARRAY = "array_";
StatGenUi._PROP_PREFIX_MANUAL = "manual_";
StatGenUi.MODE_NONE = "none";
StatGenUi.MODES = [
	"rolled",
	"array",
	"pointbuy",
	"manual",
];
StatGenUi.MODES_FVTT = [
	StatGenUi.MODE_NONE,
	...StatGenUi.MODES,
];
StatGenUi._MAX_CUSTOM_FEATS = 20;

globalThis.StatGenUi = StatGenUi;

class UtilAdditionalFeats {
	static isNoChoice (available) {
		if (!available?.length) return true;
		if (available.length > 1) return false;
		return !available[0].any;
	}

	static getUidsStatic (availableSet) {
		return Object.entries(availableSet || {})
			.filter(([k, v]) => k !== "any" && v)
			.sort(([kA], [kB]) => SortUtil.ascSortLower(kA, kB))
			.map(([k]) => k);
	}

	static getSelIxSetMeta ({comp, prop, available}) {
		return ComponentUiUtil.$getSelEnum(
			comp,
			prop,
			{
				values: available.map((_, i) => i),
				fnDisplay: ix => {
					const featSet = available[ix];

					const out = [];

					if (featSet.any) {
						out.push(`Choose any${featSet.any > 1 ? ` ${Parser.numberToText(featSet.any)}` : ""}`);
					}

					this.getUidsStatic(featSet)
						.forEach(uid => {
							const {name} = DataUtil.proxy.unpackUid("feat", uid, "feat", {isLower: true});
							out.push(name.toTitleCase());
						});

					return out.filter(Boolean).join("; ");
				},
				asMeta: true,
			},
		);
	}
}

globalThis.UtilAdditionalFeats = UtilAdditionalFeats;

StatGenUi.CompAsi = class extends BaseComponent {
	constructor ({parent}) {
		super();
		this._parent = parent;

		this._metasAsi = {ability: [], race: [], background: [], custom: []};

		this._doPulseThrottled = MiscUtil.throttle(this._doPulse_.bind(this), 50);
	}

	/**
	 * Add this to UI interactions rather than state hooks, as there is a copy of this component per tab.
	 */
	_doPulse_ () { this._parent.state.common_pulseAsi = !this._parent.state.common_pulseAsi; }

	_render_renderAsiFeatSection (propCnt, namespace, $wrpRows) {
		const hk = () => {
			let ix = 0;

			for (; ix < this._parent.state[propCnt]; ++ix) {
				const ix_ = ix;
				const {propMode, propIxFeat, propIxAsiPointOne, propIxAsiPointTwo, propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAsi(ix_, namespace);

				if (!this._metasAsi[namespace][ix_]) {
					this._parent.state[propMode] = this._parent.state[propMode] || (namespace === "ability" ? "asi" : "feat");

					const $btnAsi = namespace !== "ability" ? null : $(`<button class="btn btn-xs btn-default w-50p">ASI</button>`)
						.click(() => {
							this._parent.state[propMode] = "asi";
							this._doPulseThrottled();
						});

					const $btnFeat = namespace !== "ability" ? $(`<div class="w-100p text-center">Feat</div>`) : $(`<button class="btn btn-xs btn-default w-50p">Feat</button>`)
						.click(() => {
							this._parent.state[propMode] = "feat";
							this._doPulseThrottled();
						});

					// region ASI
					let $stgAsi;
					if (namespace === "ability") {
						const $colsAsi = Parser.ABIL_ABVS.map((it, ixAsi) => {
							const updateDisplay = () => $ipt.val(Number(this._parent.state[propIxAsiPointOne] === ixAsi) + Number(this._parent.state[propIxAsiPointTwo] === ixAsi));

							const $ipt = $(`<input class="form-control form-control--minimal text-right input-xs statgen-shared__ipt" type="number" style="width: 42px;">`)
								.disableSpellcheck()
								.keydown(evt => { if (evt.key === "Escape") $ipt.blur(); })
								.change(() => {
									const raw = $ipt.val().trim();
									const asNum = Number(raw);

									const activeProps = [propIxAsiPointOne, propIxAsiPointTwo].filter(prop => this._parent.state[prop] === ixAsi);

									if (isNaN(asNum) || asNum <= 0) {
										this._parent.proxyAssignSimple(
											"state",
											{
												...activeProps.mergeMap(prop => ({[prop]: null})),
											},
										);
										updateDisplay();
										return this._doPulseThrottled();
									}

									if (asNum >= 2) {
										this._parent.proxyAssignSimple(
											"state",
											{
												[propIxAsiPointOne]: ixAsi,
												[propIxAsiPointTwo]: ixAsi,
											},
										);
										updateDisplay();
										return this._doPulseThrottled();
									}

									if (activeProps.length === 2) {
										this._parent.state[propIxAsiPointTwo] = null;
										updateDisplay();
										return this._doPulseThrottled();
									}

									if (this._parent.state[propIxAsiPointOne] == null) {
										this._parent.state[propIxAsiPointOne] = ixAsi;
										updateDisplay();
										return this._doPulseThrottled();
									}

									this._parent.state[propIxAsiPointTwo] = ixAsi;
									updateDisplay();
									this._doPulseThrottled();
								});

							const hkSelected = () => updateDisplay();
							this._parent.addHookBase(propIxAsiPointOne, hkSelected);
							this._parent.addHookBase(propIxAsiPointTwo, hkSelected);
							hkSelected();

							return $$`<div class="ve-flex-col h-100 mr-2">
							<div class="statgen-asi__cell text-center pb-1" title="${Parser.attAbvToFull(it)}">${it.toUpperCase()}</div>
							<div class="ve-flex-vh-center statgen-asi__cell relative">
								<div class="absolute no-events statgen-asi__disp-plus">+</div>
								${$ipt}
							</div>
						</div>`;
						});

						$stgAsi = $$`<div class="ve-flex-v-center">
							${$colsAsi}
						</div>`;
					}
					// endregion

					// region Feat
					const {$stgFeat, $btnChooseFeat, hkIxFeat} = this._render_getMetaFeat({propIxFeat, propIxFeatAbility, propFeatAbilityChooseFrom});
					// endregion

					const hkMode = () => {
						if (namespace === "ability") {
							$btnAsi.toggleClass("active", this._parent.state[propMode] === "asi");
							$btnFeat.toggleClass("active", this._parent.state[propMode] === "feat");
						}

						$btnChooseFeat.toggleVe(this._parent.state[propMode] === "feat");

						if (namespace === "ability") $stgAsi.toggleVe(this._parent.state[propMode] === "asi");
						$stgFeat.toggleVe(this._parent.state[propMode] === "feat");

						hkIxFeat();
					};
					this._parent.addHookBase(propMode, hkMode);
					hkMode();

					const $row = $$`<div class="ve-flex-v-end py-3 px-1">
						<div class="btn-group">${$btnAsi}${$btnFeat}</div>
						<div class="vr-4"></div>
						${$stgAsi}
						${$stgFeat}
					</div>`.appendTo($wrpRows);

					this._metasAsi[namespace][ix_] = {
						$row,
					};
				}

				this._metasAsi[namespace][ix_].$row.showVe().addClass("statgen-asi__row");
			}

			// Remove border styling from the last visible row
			if (this._metasAsi[namespace][ix - 1]) this._metasAsi[namespace][ix - 1].$row.removeClass("statgen-asi__row");

			for (; ix < this._metasAsi[namespace].length; ++ix) {
				if (!this._metasAsi[namespace][ix]) continue;
				this._metasAsi[namespace][ix].$row.hideVe().removeClass("statgen-asi__row");
			}
		};
		this._parent.addHookBase(propCnt, hk);
		hk();
	}

	_render_renderAdditionalFeatSection ({namespace, $wrpRows, propEntity}) {
		const fnsCleanupEnt = [];
		const fnsCleanupGroup = [];

		const {propIxSel, propPrefix} = this._parent.getPropsAdditionalFeats_(namespace);

		const resetGroupState = () => {
			const nxtState = Object.keys(this._parent.state)
				.filter(k => k.startsWith(propPrefix) && k !== propIxSel)
				.mergeMap(k => ({[k]: null}));
			this._parent.proxyAssignSimple("state", nxtState);
		};

		const hkEnt = (isNotFirstRun) => {
			fnsCleanupEnt.splice(0, fnsCleanupEnt.length).forEach(fn => fn());
			fnsCleanupGroup.splice(0, fnsCleanupGroup.length).forEach(fn => fn());
			$wrpRows.empty();

			if (isNotFirstRun) resetGroupState();

			const ent = this._parent[namespace]; // e.g. `this._parent.race`

			if ((ent?.feats?.length || 0) > 1) {
				const {$sel: $selGroup, unhook: unhookIxGroup} = UtilAdditionalFeats.getSelIxSetMeta({comp: this._parent, prop: propIxSel, available: ent.feats});
				fnsCleanupEnt.push(unhookIxGroup);
				$$`<div class="ve-flex-col mb-2">
					<div class="ve-flex-v-center mb-2">
						<div class="mr-2">Feat Set:</div>
						${$selGroup.addClass("max-w-200p")}
					</div>
				</div>`.appendTo($wrpRows);
			} else {
				this._parent.state[propIxSel] = 0;
			}

			const $wrpRowsInner = $(`<div class="w-100 ve-flex-col min-h-0"></div>`).appendTo($wrpRows);

			const hkIxSel = (isNotFirstRun) => {
				fnsCleanupGroup.splice(0, fnsCleanupGroup.length).forEach(fn => fn());
				$wrpRowsInner.empty();

				if (isNotFirstRun) resetGroupState();

				const featSet = ent?.feats?.[this._parent.state[propIxSel]];

				const uidsStatic = UtilAdditionalFeats.getUidsStatic(featSet);

				const $rows = [];

				uidsStatic.map((uid, ix) => {
					const {propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAdditionalFeatsFeatSet_(namespace, "static", ix);
					const {name, source} = DataUtil.proxy.unpackUid("feat", uid, "feat", {isLower: true});
					const feat = this._parent.feats.find(it => it.name.toLowerCase() === name && it.source.toLowerCase() === source);
					const {$stgFeat, hkIxFeat, cleanup} = this._render_getMetaFeat({featStatic: feat, propIxFeatAbility, propFeatAbilityChooseFrom});
					fnsCleanupGroup.push(cleanup);
					hkIxFeat();

					const $row = $$`<div class="ve-flex-v-end py-3 px-1 statgen-asi__row">
						<div class="btn-group"><div class="w-100p text-center">Feat</div></div>
						<div class="vr-4"></div>
						${$stgFeat}
					</div>`.appendTo($wrpRowsInner);
					$rows.push($row);
				});

				[...new Array(featSet?.any || 0)].map((_, ix) => {
					const {propIxFeat, propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAdditionalFeatsFeatSet_(namespace, "fromFilter", ix);
					const {$stgFeat, hkIxFeat, cleanup} = this._render_getMetaFeat({propIxFeat, propIxFeatAbility, propFeatAbilityChooseFrom});
					fnsCleanupGroup.push(cleanup);
					hkIxFeat();

					const $row = $$`<div class="ve-flex-v-end py-3 px-1 statgen-asi__row">
						<div class="btn-group"><div class="w-100p text-center">Feat</div></div>
						<div class="vr-4"></div>
						${$stgFeat}
					</div>`.appendTo($wrpRowsInner);
					$rows.push($row);
				});

				// Remove border styling from the last row
				if ($rows.last()) $rows.last().removeClass("statgen-asi__row");

				this._doPulseThrottled();
			};
			this._parent.addHookBase(propIxSel, hkIxSel);
			fnsCleanupEnt.push(() => this._parent.removeHookBase(propIxSel, hkIxSel));
			hkIxSel();
			this._doPulseThrottled();
		};
		this._parent.addHookBase(propEntity, hkEnt);
		hkEnt();
	}

	_render_getMetaFeat ({featStatic = null, propIxFeat = null, propIxFeatAbility, propFeatAbilityChooseFrom}) {
		if (featStatic && propIxFeat) throw new Error(`Cannot combine static feat and feat property!`);
		if (featStatic == null && propIxFeat == null) throw new Error(`Either a static feat or a feat property must be specified!`);

		const $btnChooseFeat = featStatic ? null : $(`<button class="btn btn-xxs btn-default mr-2" title="Choose a Feat"><span class="glyphicon glyphicon-search"></span></button>`)
			.click(async () => {
				const selecteds = await this._parent.modalFilterFeats.pGetUserSelection();
				if (selecteds == null || !selecteds.length) return;

				const selected = selecteds[0];
				const ix = this._parent.feats.findIndex(it => it.name === selected.name && it.source === selected.values.sourceJson);
				if (!~ix) throw new Error(`Could not find selected entity: ${JSON.stringify(selected)}`); // Should never occur
				this._parent.state[propIxFeat] = ix;

				this._doPulseThrottled();
			});

		// region Feat
		const $dispFeat = $(`<div class="ve-flex-v-center mr-2"></div>`);
		const $stgSelectAbilitySet = $$`<div class="ve-flex-v-center mr-2"></div>`;
		const $stgFeatNoChoice = $$`<div class="ve-flex-v-center mr-2"></div>`;
		const $stgFeatChooseAsiFrom = $$`<div class="ve-flex-v-end"></div>`;
		const $stgFeatChooseAsiWeighted = $$`<div class="ve-flex-v-center"></div>`;

		const $stgFeat = $$`<div class="ve-flex-v-center">
			${$btnChooseFeat}
			${$dispFeat}
			${$stgSelectAbilitySet}
			${$stgFeatNoChoice}
			${$stgFeatChooseAsiFrom}
			${$stgFeatChooseAsiWeighted}
		</div>`;

		const fnsCleanup = [];
		const fnsCleanupFeat = [];
		const fnsCleanupFeatAbility = [];

		const hkIxFeat = (isNotFirstRun) => {
			fnsCleanupFeat.splice(0, fnsCleanupFeat.length).forEach(fn => fn());
			fnsCleanupFeatAbility.splice(0, fnsCleanupFeatAbility.length).forEach(fn => fn());

			if (isNotFirstRun) {
				const nxtState = Object.keys(this._parent.state).filter(it => it.startsWith(propFeatAbilityChooseFrom)).mergeMap(it => ({[it]: null}));
				this._parent.proxyAssignSimple("state", nxtState);
			}

			const feat = featStatic || this._parent.feats[this._parent.state[propIxFeat]];

			$stgFeat.removeClass("ve-flex-v-end").addClass("ve-flex-v-center");
			$dispFeat.toggleClass("italic ve-muted", !feat);
			$dispFeat.html(feat ? Renderer.get().render(`{@feat ${feat.name.toLowerCase()}|${feat.source}}`) : `(Choose a feat)`);

			this._parent.state[propIxFeatAbility] = 0;

			$stgSelectAbilitySet.hideVe();
			if (feat) {
				if (feat.ability && feat.ability.length > 1) {
					const metaChooseAbilitySet = ComponentUiUtil.$getSelEnum(
						this._parent,
						propIxFeatAbility,
						{
							values: feat.ability.map((_, i) => i),
							fnDisplay: ix => Renderer.getAbilityData([feat.ability[ix]]).asText,
							asMeta: true,
						},
					);

					$stgSelectAbilitySet.showVe().append(metaChooseAbilitySet.$sel);
					metaChooseAbilitySet.$sel.change(() => this._doPulseThrottled());
					fnsCleanupFeat.push(() => metaChooseAbilitySet.unhook());
				}

				const hkAbilitySet = () => {
					fnsCleanupFeatAbility.splice(0, fnsCleanupFeatAbility.length).forEach(fn => fn());

					if (!feat.ability) {
						$stgFeatNoChoice.empty().hideVe();
						$stgFeatChooseAsiFrom.empty().hideVe();
						return;
					}

					const abilitySet = feat.ability[this._parent.state[propIxFeatAbility]];

					// region Static/no choices
					const ptsNoChoose = Parser.ABIL_ABVS.filter(ab => abilitySet[ab]).map(ab => `${Parser.attAbvToFull(ab)} ${UiUtil.intToBonus(abilitySet[ab], {isPretty: true})}`);
					$stgFeatNoChoice.empty().toggleVe(ptsNoChoose.length).html(`<div><span class="mr-2">\u2014</span>${ptsNoChoose.join(", ")}</div>`);
					// endregion

					// region Choices
					if (abilitySet.choose && abilitySet.choose.from) {
						$stgFeat.removeClass("ve-flex-v-center").addClass("ve-flex-v-end");
						$stgFeatChooseAsiFrom.showVe().empty();
						$stgFeatChooseAsiWeighted.empty().hideVe();

						const count = abilitySet.choose.count || 1;
						const amount = abilitySet.choose.amount || 1;

						const {rowMetas, cleanup: cleanupAsiPicker} = ComponentUiUtil.getMetaWrpMultipleChoice(
							this._parent,
							propFeatAbilityChooseFrom,
							{
								values: abilitySet.choose.from,
								fnDisplay: v => `${Parser.attAbvToFull(v)} ${UiUtil.intToBonus(amount, {isPretty: true})}`,
								count,
							},
						);
						fnsCleanupFeatAbility.push(() => cleanupAsiPicker());

						$stgFeatChooseAsiFrom.append(`<div><span class="mr-2">\u2014</span>choose ${count > 1 ? `${count} ` : ""}${UiUtil.intToBonus(amount, {isPretty: true})}</div>`);

						rowMetas.forEach(meta => {
							meta.$cb.change(() => this._doPulseThrottled());

							$$`<label class="ve-flex-col no-select">
								<div class="ve-flex-vh-center statgen-asi__cell-feat" title="${Parser.attAbvToFull(meta.value)}">${meta.value.toUpperCase()}</div>
								<div class="ve-flex-vh-center statgen-asi__cell-feat">${meta.$cb}</div>
							</label>`.appendTo($stgFeatChooseAsiFrom);
						});
					} else if (abilitySet.choose && abilitySet.choose.weighted) {
						// TODO(Future) unsupported, for now
						$stgFeatChooseAsiFrom.empty().hideVe();
						$stgFeatChooseAsiWeighted.showVe().html(`<i class="ve-muted">The selected ability score format is currently unsupported. Please check back later!</i>`);
					} else {
						$stgFeatChooseAsiFrom.empty().hideVe();
						$stgFeatChooseAsiWeighted.empty().hideVe();
					}
					// endregion

					this._doPulseThrottled();
				};
				this._parent.addHookBase(propIxFeatAbility, hkAbilitySet);
				fnsCleanupFeat.push(() => this._parent.removeHookBase(propIxFeatAbility, hkAbilitySet));
				hkAbilitySet();
			} else {
				$stgFeatNoChoice.empty().hideVe();
				$stgFeatChooseAsiFrom.empty().hideVe();
				$stgFeatChooseAsiWeighted.empty().hideVe();
			}

			this._doPulseThrottled();
		};

		if (!featStatic) {
			this._parent.addHookBase(propIxFeat, hkIxFeat);
			fnsCleanup.push(() => this._parent.removeHookBase(propIxFeat, hkIxFeat));
		}

		const cleanup = () => {
			fnsCleanup.splice(0, fnsCleanup.length).forEach(fn => fn());
			fnsCleanupFeat.splice(0, fnsCleanupFeat.length).forEach(fn => fn());
			fnsCleanupFeatAbility.splice(0, fnsCleanupFeatAbility.length).forEach(fn => fn());
		};

		return {$btnChooseFeat, $stgFeat, hkIxFeat, cleanup};
	}

	render ($wrpAsi) {
		const $wrpRowsAsi = $(`<div class="ve-flex-col w-100 overflow-y-auto"></div>`);
		const $wrpRowsRace = $(`<div class="ve-flex-col w-100 overflow-y-auto"></div>`);
		const $wrpRowsBackground = $(`<div class="ve-flex-col w-100 overflow-y-auto"></div>`);
		const $wrpRowsCustom = $(`<div class="ve-flex-col w-100 overflow-y-auto"></div>`);

		this._render_renderAsiFeatSection("common_cntAsi", "ability", $wrpRowsAsi);
		this._render_renderAsiFeatSection("common_cntFeatsCustom", "custom", $wrpRowsCustom);
		this._render_renderAdditionalFeatSection({propEntity: "common_ixRace", namespace: "race", $wrpRows: $wrpRowsRace});
		this._render_renderAdditionalFeatSection({propEntity: "common_ixBackground", namespace: "background", $wrpRows: $wrpRowsBackground});

		const $getStgEntity = ({title, $wrpRows, propEntity, propIxEntity}) => {
			const $stg = $$`<div class="ve-flex-col">
				<hr class="hr-3 hr--dotted">
				<h4 class="my-2 bold">${title} Feats</h4>
				${$wrpRows}
			</div>`;

			const hkIxEntity = () => {
				const entity = this._parent[propEntity];
				$stg.toggleVe(!this._parent.isLevelUp && !!entity?.feats);
			};
			this._parent.addHookBase(propIxEntity, hkIxEntity);
			hkIxEntity();

			return $stg;
		};

		const $stgRace = $getStgEntity({title: "Race", $wrpRows: $wrpRowsRace, propEntity: "race", propIxEntity: "common_ixRace"});

		const $stgBackground = $getStgEntity({title: "Background", $wrpRows: $wrpRowsBackground, propEntity: "background", propIxEntity: "common_ixBackground"});

		const $iptCountFeatsCustom = ComponentUiUtil.$getIptInt(this._parent, "common_cntFeatsCustom", 0, {min: 0, max: StatGenUi._MAX_CUSTOM_FEATS})
			.addClass("w-100p text-center");

		$$($wrpAsi)`
			<h4 class="my-2 bold">Ability Score Increases</h4>
			${this._render_$getStageCntAsi()}
			${$wrpRowsAsi}

			${$stgRace}

			${$stgBackground}

			<hr class="hr-3 hr--dotted">
			<h4 class="my-2 bold">Additional Feats</h4>
			<label class="w-100 ve-flex-v-center mb-2">
				<div class="mr-2 no-shrink">Number of additional feats:</div>${$iptCountFeatsCustom}
			</label>
			${$wrpRowsCustom}
		`;
	}

	_render_$getStageCntAsi () {
		if (!this._parent.isCharacterMode) {
			const $iptCountAsi = ComponentUiUtil.$getIptInt(this._parent, "common_cntAsi", 0, {min: 0, max: 20})
				.addClass("w-100p text-center");
			return $$`<label class="w-100 ve-flex-v-center mb-2"><div class="mr-2 no-shrink">Number of Ability Score Increases to apply:</div>${$iptCountAsi}</label>`;
		}

		const $out = $$`<div class="w-100 ve-flex-v-center mb-2 italic ve-muted">No ability score increases available.</div>`;
		const hkCntAsis = () => $out.toggleVe(this._parent.state.common_cntAsi === 0);
		this._parent.addHookBase("common_cntAsi", hkCntAsis);
		hkCntAsis();
		return $out;
	}

	_getFormData_getForNamespace_basic (outs, outIsFormCompletes, outFeats, propCnt, namespace) {
		for (let i = 0; i < this._parent.state[propCnt]; ++i) {
			const {propMode, propIxFeat, propIxAsiPointOne, propIxAsiPointTwo, propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAsi(i, namespace);

			if (this._parent.state[propMode] === "asi") {
				const out = {};

				let ttlChosen = 0;

				Parser.ABIL_ABVS.forEach((ab, abI) => {
					const increase = [this._parent.state[propIxAsiPointOne] === abI, this._parent.state[propIxAsiPointTwo] === abI].filter(Boolean).length;
					if (increase) out[ab] = increase;
					ttlChosen += increase;
				});

				const isFormComplete = ttlChosen === 2;

				outFeats[namespace].push(null); // Pad the array

				outs.push(out);
				outIsFormCompletes.push(isFormComplete);
			} else if (this._parent.state[propMode] === "feat") {
				const {isFormComplete, out} = this._getFormData_doAddFeatMeta({
					namespace,
					outFeats,
					propIxFeat,
					propIxFeatAbility,
					propFeatAbilityChooseFrom,
					type: "choose",
				});
				outs.push(out);
				outIsFormCompletes.push(isFormComplete);
			}
		}
	}

	_getFormData_getForNamespace_additional (outs, outIsFormCompletes, outFeats, namespace) {
		const ent = this._parent[namespace]; // e.g. `this._parent.race`
		if (!ent?.feats?.length) return;

		const {propIxSel} = this._parent.getPropsAdditionalFeats_(namespace);

		const featSet = ent.feats[this._parent.state[propIxSel]];
		if (!featSet) {
			outIsFormCompletes.push(false);
			return;
		}

		const uidsStatic = UtilAdditionalFeats.getUidsStatic(featSet);

		uidsStatic.map((uid, ix) => {
			const {propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAdditionalFeatsFeatSet_(namespace, "static", ix);
			const {name, source} = DataUtil.proxy.unpackUid("feat", uid, "feat", {isLower: true});
			const feat = this._parent.feats.find(it => it.name.toLowerCase() === name && it.source.toLowerCase() === source);

			const {isFormComplete, out} = this._getFormData_doAddFeatMeta({
				namespace,
				outFeats,
				featStatic: feat,
				propIxFeatAbility,
				propFeatAbilityChooseFrom,
				type: "static",
			});

			outs.push(out);
			outIsFormCompletes.push(isFormComplete);
		});

		[...new Array(featSet.any || 0)].map((_, ix) => {
			const {propIxFeat, propIxFeatAbility, propFeatAbilityChooseFrom} = this._parent.getPropsAdditionalFeatsFeatSet_(namespace, "fromFilter", ix);

			const {isFormComplete, out} = this._getFormData_doAddFeatMeta({
				namespace,
				outFeats,
				propIxFeat,
				propIxFeatAbility,
				propFeatAbilityChooseFrom,
				type: "choose",
			});

			outs.push(out);
			outIsFormCompletes.push(isFormComplete);
		});
	}

	_getFormData_doAddFeatMeta ({namespace, outFeats, propIxFeat = null, featStatic = null, propIxFeatAbility, propFeatAbilityChooseFrom, type}) {
		if (featStatic && propIxFeat) throw new Error(`Cannot combine static feat and feat property!`);
		if (featStatic == null && propIxFeat == null) throw new Error(`Either a static feat or a feat property must be specified!`);

		const out = {};

		const feat = featStatic || this._parent.feats[this._parent.state[propIxFeat]];

		const featMeta = feat
			? {ix: this._parent.state[propIxFeat], uid: `${feat.name}|${feat.source}`, type}
			: {ix: -1, uid: null, type};
		outFeats[namespace].push(featMeta);

		if (!~featMeta.ix) return {isFormComplete: false, out};
		if (!feat.ability) return {isFormComplete: true, out};

		const abilitySet = feat.ability[this._parent.state[propIxFeatAbility] || 0];

		// Add static values
		Parser.ABIL_ABVS.forEach(ab => { if (abilitySet[ab]) out[ab] = abilitySet[ab]; });

		if (!abilitySet.choose) return {isFormComplete: true, out};

		let isFormComplete = true;

		// Track any bonuses chosen, so we can use `"inherit"` when handling a feats "additionalSpells" elsewhere
		featMeta.abilityChosen = {};

		if (abilitySet.choose.from) {
			if (isFormComplete) isFormComplete = !!this._parent.state[ComponentUiUtil.getMetaWrpMultipleChoice_getPropIsAcceptable(propFeatAbilityChooseFrom)];

			const ixs = ComponentUiUtil.getMetaWrpMultipleChoice_getSelectedIxs(this._parent, propFeatAbilityChooseFrom);
			ixs.map(it => abilitySet.choose.from[it]).forEach(ab => {
				const amount = abilitySet.choose.amount || 1;
				out[ab] = (out[ab] || 0) + amount;
				featMeta.abilityChosen[ab] = amount;
			});
		}

		return {isFormComplete, out};
	}

	getFormData () {
		const outs = [];
		const isFormCompletes = [];
		const feats = {ability: [], race: [], background: [], custom: []};

		this._getFormData_getForNamespace_basic(outs, isFormCompletes, feats, "common_cntAsi", "ability");
		this._getFormData_getForNamespace_basic(outs, isFormCompletes, feats, "common_cntFeatsCustom", "custom");
		this._getFormData_getForNamespace_additional(outs, isFormCompletes, feats, "race");
		this._getFormData_getForNamespace_additional(outs, isFormCompletes, feats, "background");

		const data = {};
		outs.filter(Boolean).forEach(abilBonuses => Object.entries(abilBonuses).forEach(([ab, bonus]) => data[ab] = (data[ab] || 0) + bonus));

		return {
			isFormComplete: isFormCompletes.every(Boolean),
			dataPerAsi: outs,
			data,
			feats,
		};
	}
};

StatGenUi.RenderableCollectionPbRules = class extends RenderableCollectionBase {
	constructor (statGenUi, $wrp) {
		super(statGenUi, "pb_rules");

		this._$wrp = $wrp;
	}

	getNewRender (rule) {
		const parentComp = this._comp;

		const comp = BaseComponent.fromObject(rule.entity);
		comp._addHookAll("state", () => {
			rule.entity = comp.toObject();
			parentComp._triggerCollectionUpdate("pb_rules");
		});

		const $dispCost = $(`<div class="ve-flex-vh-center"></div>`);
		const hkCost = () => $dispCost.text(comp._state.cost);
		comp._addHookBase("cost", hkCost);
		hkCost();

		const $iptCost = ComponentUiUtil.$getIptInt(comp, "cost", 0, {html: `<input class="form-control input-xs form-control--minimal text-center">`, fallbackOnNaN: 0});

		const hkIsCustom = () => {
			$dispCost.toggleVe(!parentComp.state.pb_isCustom);
			$iptCost.toggleVe(parentComp.state.pb_isCustom);
		};
		parentComp._addHookBase("pb_isCustom", hkIsCustom);
		hkIsCustom();

		const $btnDelete = $(`<button class="btn btn-xxs btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`)
			.click(() => {
				if (parentComp.state.pb_rules.length === 1) return; // Never delete the final item
				parentComp.state.pb_rules = parentComp.state.pb_rules.filter(it => it !== rule);
			});

		const $wrpRow = $$`<div class="ve-flex py-1 stripe-even statgen-pb__row-cost">
			<div class="statgen-pb__col-cost ve-flex-vh-center">${comp._state.score}</div>
			<div class="statgen-pb__col-cost ve-flex-vh-center">${Parser.getAbilityModifier(comp._state.score)}</div>
			<div class="statgen-pb__col-cost ve-flex-vh-center px-3">
				${$dispCost}
				${$iptCost}
			</div>
			<div class="statgen-pb__col-cost-delete">${$btnDelete}</div>
		</div>`.appendTo(this._$wrp);

		const hkRules = () => {
			$btnDelete.toggleVe((parentComp.state.pb_rules[0] === rule || parentComp.state.pb_rules.last() === rule) && parentComp.state.pb_isCustom);
		};
		parentComp._addHookBase("pb_rules", hkRules);
		parentComp._addHookBase("pb_isCustom", hkRules);
		hkRules();

		return {
			comp,
			$wrpRow,
			fnCleanup: () => {
				parentComp._removeHookBase("pb_isCustom", hkIsCustom);
				parentComp._removeHookBase("pb_isCustom", hkRules);
				parentComp._removeHookBase("pb_rules", hkRules);
			},
		};
	}

	doUpdateExistingRender (renderedMeta, rule) {
		renderedMeta.comp._proxyAssignSimple("state", rule.entity, true);
	}

	doDeleteExistingRender (renderedMeta) {
		renderedMeta.fnCleanup();
	}

	doReorderExistingComponent (renderedMeta, rule) {
		const parent = this._comp;

		const ix = parent.state.pb_rules.map(it => it.id).indexOf(rule.id);
		const curIx = this._$wrp.find(`.statgen-pb__row-cost`).index(renderedMeta.$wrpRow);

		const isMove = !this._$wrp.length || curIx !== ix;
		if (isMove) renderedMeta.$wrpRow.detach().appendTo(this._$wrp);
	}
};

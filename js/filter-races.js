"use strict";

class AbilityScoreFilter extends FilterBase {
	constructor (opts) {
		super(opts);

		this._items = [];
		this._isItemsDirty = false;
		this._itemsLookup = {}; // Cache items for fast lookup
		this._seenUids = {};

		this.__$wrpFilter = null;
		this.__wrpPills = null;
		this.__wrpPillsRows = {};
		this.__wrpMiniPills = null;

		this._maxMod = 2;
		this._minMod = 0;

		// region Init state
		Parser.ABIL_ABVS.forEach(ab => {
			const itemAnyIncrease = new AbilityScoreFilter.FilterItem({isAnyIncrease: true, ability: ab});
			const itemAnyDecrease = new AbilityScoreFilter.FilterItem({isAnyDecrease: true, ability: ab});
			this._items.push(itemAnyIncrease, itemAnyDecrease);
			this._itemsLookup[itemAnyIncrease.uid] = itemAnyIncrease;
			this._itemsLookup[itemAnyDecrease.uid] = itemAnyDecrease;
			if (this.__state[itemAnyIncrease.uid] == null) this.__state[itemAnyIncrease.uid] = 0;
			if (this.__state[itemAnyDecrease.uid] == null) this.__state[itemAnyDecrease.uid] = 0;
		});

		for (let i = this._minMod; i <= this._maxMod; ++i) {
			if (i === 0) continue;
			Parser.ABIL_ABVS.forEach(ab => {
				const item = new AbilityScoreFilter.FilterItem({modifier: i, ability: ab});
				this._items.push(item);
				this._itemsLookup[item.uid] = item;
				if (this.__state[item.uid] == null) this.__state[item.uid] = 0;
			});
		}
		// endregion
	}

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$render (opts) {
		this._filterBox = opts.filterBox;
		this.__wrpMiniPills = e_({ele: opts.$wrpMini[0]});

		const wrpControls = this._getHeaderControls(opts);

		this.__wrpPills = e_({tag: "div", clazz: `fltr__wrp-pills overflow-x-auto ve-flex-col w-100`});
		const hook = () => this.__wrpPills.toggleVe(!this._meta.isHidden);
		this._addHook("meta", "isHidden", hook);
		hook();

		this._doRenderPills();

		// FIXME refactor this so we're not stealing the private method
		const btnMobToggleControls = Filter.prototype._getBtnMobToggleControls.bind(this)(wrpControls);

		this.__$wrpFilter = $$`<div>
			${opts.isFirst ? "" : `<div class="fltr__dropdown-divider ${opts.isMulti ? "fltr__dropdown-divider--indented" : ""} mb-1"></div>`}
			<div class="split fltr__h mb-1">
				<div class="ml-2 fltr__h-text ve-flex-h-center">${opts.isMulti ? `<span class="mr-2">\u2012</span>` : ""}${this._getRenderedHeader()}${btnMobToggleControls}</div>
				${wrpControls}
			</div>
			${this.__wrpPills}
		</div>`;

		this.update(); // Force an update, to properly mute/unmute our pills

		return this.__$wrpFilter;
	}

	_getHeaderControls (opts) {
		const btnClear = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} fltr__h-btn--clear w-100`,
			click: () => this._doSetPillsClear(),
			html: "Clear",
		});

		const wrpStateBtnsOuter = e_({
			tag: "div",
			clazz: "ve-flex-v-center fltr__h-wrp-state-btns-outer",
			children: [
				e_({
					tag: "div",
					clazz: "btn-group ve-flex-v-center w-100",
					children: [
						btnClear,
					],
				}),
			],
		});

		const wrpSummary = e_({tag: "div", clazz: "ve-flex-vh-center ve-hidden"});

		const btnShowHide = e_({
			tag: "button",
			clazz: `btn btn-default ${opts.isMulti ? "btn-xxs" : "btn-xs"} ml-2`,
			click: () => this._meta.isHidden = !this._meta.isHidden,
			html: "Hide",
		});
		const hookShowHide = () => {
			e_({ele: btnShowHide}).toggleClass("active", this._meta.isHidden);
			wrpStateBtnsOuter.toggleVe(!this._meta.isHidden);

			// TODO
			// region Render summary
			const cur = this.getValues()[this.header];

			const htmlSummary = [
				cur._totals?.yes
					? `<span class="fltr__summary_item fltr__summary_item--include" title="${cur._totals.yes} hidden &quot;required&quot; tags">${cur._totals.yes}</span>`
					: null,
			].filter(Boolean).join("");
			e_({ele: wrpSummary, html: htmlSummary}).toggleVe(this._meta.isHidden);
			// endregion
		};
		this._addHook("meta", "isHidden", hookShowHide);
		hookShowHide();

		return e_({
			tag: "div",
			clazz: `ve-flex-v-center fltr__h-wrp-btns-outer`,
			children: [
				wrpSummary,
				wrpStateBtnsOuter,
				btnShowHide,
			],
		});
	}

	_doRenderPills () {
		this._items.sort(this.constructor._ascSortItems.bind(this.constructor));

		if (!this.__wrpPills) return;
		this._items.forEach(it => {
			if (!it.rendered) it.rendered = this._getPill(it);
			if (!it.isAnyIncrease && !it.isAnyDecrease) it.rendered.toggleClass("fltr__pill--muted", !this._seenUids[it.uid]);

			if (!this.__wrpPillsRows[it.ability]) {
				this.__wrpPillsRows[it.ability] = {
					row: e_({
						tag: "div",
						clazz: "ve-flex-v-center w-100 my-1",
						children: [
							e_({
								tag: "div",
								clazz: "mr-3 text-right fltr__label-ability-score no-shrink no-grow",
								text: Parser.attAbvToFull(it.ability),
							}),
						],
					}).appendTo(this.__wrpPills),
					searchText: Parser.attAbvToFull(it.ability).toLowerCase(),
				};
			}

			it.rendered.appendTo(this.__wrpPillsRows[it.ability].row);
		});
	}

	_getPill (item) {
		const unsetRow = () => {
			const nxtState = {};
			for (let i = this._minMod; i <= this._maxMod; ++i) {
				if (!i || i === item.modifier) continue;
				const siblingUid = AbilityScoreFilter.FilterItem.getUid_({ability: item.ability, modifier: i});
				nxtState[siblingUid] = 0;
			}

			if (!item.isAnyIncrease) nxtState[AbilityScoreFilter.FilterItem.getUid_({ability: item.ability, isAnyIncrease: true})] = 0;
			if (!item.isAnyDecrease) nxtState[AbilityScoreFilter.FilterItem.getUid_({ability: item.ability, isAnyDecrease: true})] = 0;

			this._proxyAssignSimple("state", nxtState);
		};

		const btnPill = e_({
			tag: "div",
			clazz: `fltr__pill fltr__pill--ability-bonus px-2`,
			html: item.getPillDisplayHtml(),
			click: evt => {
				if (evt.shiftKey) {
					const nxtState = {};
					Object.keys(this._state).forEach(k => nxtState[k] = 0);
					this._proxyAssign("state", "_state", "__state", nxtState, true);
				}

				this._state[item.uid] = this._state[item.uid] ? 0 : 1;
				if (this._state[item.uid]) unsetRow();
			},
			contextmenu: (evt) => {
				evt.preventDefault();

				this._state[item.uid] = this._state[item.uid] ? 0 : 1;
				if (this._state[item.uid]) unsetRow();
			},
		});

		const hook = () => {
			const val = FilterBox._PILL_STATES[this._state[item.uid] || 0];
			btnPill.attr("state", val);
		};
		this._addHook("state", item.uid, hook);
		hook();

		return btnPill;
	}

	_doRenderMiniPills () {
		// create a list view so we can freely sort
		this._items.slice(0)
			.sort(this.constructor._ascSortMiniPills.bind(this.constructor))
			.forEach(it => {
				// re-append existing elements to sort them
				(it.btnMini = it.btnMini || this._getBtnMini(it)).appendTo(this.__wrpMiniPills);
			});
	}

	_getBtnMini (item) {
		const btnMini = e_({
			tag: "div",
			clazz: `fltr__mini-pill ${this._filterBox.isMinisHidden(this.header) ? "ve-hidden" : ""}`,
			text: item.getMiniPillDisplayText(),
			title: `Filter: ${this.header}`,
			click: () => {
				this._state[item.uid] = 0;
				this._filterBox.fireChangeEvent();
			},
		}).attr("state", FilterBox._PILL_STATES[this._state[item.uid] || 0]);

		const hook = () => btnMini.attr("state", FilterBox._PILL_STATES[this._state[item.uid] || 0]);
		this._addHook("state", item.uid, hook);

		const hideHook = () => btnMini.toggleClass("ve-hidden", this._filterBox.isMinisHidden(this.header));
		this._filterBox.registerMinisHiddenHook(this.header, hideHook);

		return btnMini;
	}

	static _ascSortItems (a, b) {
		return SortUtil.ascSort(Number(b.isAnyIncrease), Number(a.isAnyIncrease))
			|| SortUtil.ascSortAtts(a.ability, b.ability)
			// Offset ability scores to ensure they're all in positive space. This forces the "any decrease" section to
			//   appear last.
			|| SortUtil.ascSort(b.modifier ? b.modifier + AbilityScoreFilter._MODIFIER_SORT_OFFSET : b.modifier, a.modifier ? a.modifier + AbilityScoreFilter._MODIFIER_SORT_OFFSET : a.modifier)
			|| SortUtil.ascSort(Number(b.isAnyDecrease), Number(a.isAnyDecrease));
	}

	static _ascSortMiniPills (a, b) {
		return SortUtil.ascSort(Number(b.isAnyIncrease), Number(a.isAnyIncrease))
			|| SortUtil.ascSort(Number(b.isAnyDecrease), Number(a.isAnyDecrease))
			// Offset ability scores to ensure they're all in positive space. This forces the "any decrease" section to
			//   appear last.
			|| SortUtil.ascSort(b.modifier ? b.modifier + AbilityScoreFilter._MODIFIER_SORT_OFFSET : b.modifier, a.modifier ? a.modifier + AbilityScoreFilter._MODIFIER_SORT_OFFSET : a.modifier)
			|| SortUtil.ascSortAtts(a.ability, b.ability);
	}

	/**
	 * @param opts Options.
	 * @param opts.filterBox The FilterBox to which this filter is attached.
	 * @param opts.isFirst True if this is visually the first filter in the box.
	 * @param opts.$wrpMini The form mini-view element.
	 * @param opts.isMulti The name of the MultiFilter this filter belongs to, if any.
	 */
	$renderMinis (opts) {
		this._filterBox = opts.filterBox;
		this.__wrpMiniPills = e_({ele: opts.$wrpMini[0]});

		this._doRenderMiniPills();
	}

	getValues ({nxtState = null} = {}) {
		const out = {
			_totals: {yes: 0},
		};

		const state = nxtState?.[this.header]?.state || this.__state;

		Object.entries(state)
			.filter(([, value]) => value)
			.forEach(([uid]) => {
				out._totals.yes++;
				out[uid] = true;
			});

		return {[this.header]: out};
	}

	_mutNextState_reset (nxtState, {isResetAll = false} = {}) {
		Object.keys(nxtState[this.header].state).forEach(k => delete nxtState[this.header].state[k]);
	}

	update () {
		if (this._isItemsDirty) {
			this._isItemsDirty = false;

			this._doRenderPills();
		}

		// always render the mini-pills, to ensure the overall order in the grid stays correct (shared between multiple filters)
		this._doRenderMiniPills();
	}

	_doSetPillsClear () {
		Object.keys(this._state).forEach(k => {
			if (this._state[k] !== 0) this._state[k] = 0;
		});
	}

	toDisplay (boxState, entryVal) {
		const filterState = boxState[this.header];
		if (!filterState) return true;

		const activeItems = Object.keys(filterState)
			.filter(it => !it.startsWith("_"))
			.map(it => this._itemsLookup[it])
			.filter(Boolean);

		if (!activeItems.length) return true;
		if ((!entryVal || !entryVal.length) && activeItems.length) return false;

		return entryVal.some(abilObject => {
			const cpyAbilObject = MiscUtil.copy(abilObject);
			const vewActiveItems = [...activeItems];

			// region Stage 1. Exact ability score match.
			Parser.ABIL_ABVS.forEach(ab => {
				if (!cpyAbilObject[ab] || !vewActiveItems.length) return;

				const ixExact = vewActiveItems.findIndex(it => it.ability === ab && it.modifier === cpyAbilObject[ab]);
				if (~ixExact) return vewActiveItems.splice(ixExact, 1);
			});
			if (!vewActiveItems.length) return true;
			// endregion

			// region Stage 2. "Choice" ability score match
			if (cpyAbilObject.choose?.from) {
				const amount = cpyAbilObject.choose.amount || 1;
				const count = cpyAbilObject.choose.count || 1;

				for (let i = 0; i < count; ++i) {
					if (!vewActiveItems.length) break;

					const ix = vewActiveItems.findIndex(it => cpyAbilObject.choose.from.includes(it.ability) && amount === it.modifier);
					if (~ix) {
						const [cpyActiveItem] = vewActiveItems.splice(ix, 1);
						cpyAbilObject.choose.from = cpyAbilObject.choose.from.filter(it => it !== cpyActiveItem.ability);
					}
				}
			} else if (cpyAbilObject.choose?.weighted?.weights && cpyAbilObject.choose?.weighted?.from) {
				cpyAbilObject.choose.weighted.weights.forEach(weight => {
					const ix = vewActiveItems.findIndex(it => cpyAbilObject.choose.weighted.from.includes(it.ability) && weight === it.modifier);
					if (~ix) {
						const [cpyActiveItem] = vewActiveItems.splice(ix, 1);
						cpyAbilObject.choose.weighted.from = cpyAbilObject.choose.weighted.from.filter(it => it !== cpyActiveItem.ability);
					}
				});
			}
			if (!vewActiveItems.length) return true;
			// endregion

			// region Stage 3. "Any" ability score match
			Parser.ABIL_ABVS.forEach(ab => {
				if (!cpyAbilObject[ab] || !vewActiveItems.length) return;

				const ix = vewActiveItems.findIndex(it => it.ability === ab && ((cpyAbilObject[ab] > 0 && it.isAnyIncrease) || (cpyAbilObject[ab] < 0 && it.isAnyDecrease)));
				if (~ix) return vewActiveItems.splice(ix, 1);
			});
			if (!vewActiveItems.length) return true;

			if (cpyAbilObject.choose?.from) {
				const amount = cpyAbilObject.choose.amount || 1;
				const count = cpyAbilObject.choose.count || 1;

				for (let i = 0; i < count; ++i) {
					if (!vewActiveItems.length) return true;

					const ix = vewActiveItems.findIndex(it => cpyAbilObject.choose.from.includes(it.ability) && ((amount > 0 && it.isAnyIncrease) || (amount < 0 && it.isAnyDecrease)));
					if (~ix) {
						const [cpyActiveItem] = vewActiveItems.splice(ix, 1);
						cpyAbilObject.choose.from = cpyAbilObject.choose.from.filter(it => it !== cpyActiveItem.ability);
					}
				}
			} else if (cpyAbilObject.choose?.weighted?.weights && cpyAbilObject.choose?.weighted?.from) {
				cpyAbilObject.choose.weighted.weights.forEach(weight => {
					if (!vewActiveItems.length) return;

					const ix = vewActiveItems.findIndex(it => cpyAbilObject.choose.weighted.from.includes(it.ability) && ((weight > 0 && it.isAnyIncrease) || (weight < 0 && it.isAnyDecrease)));
					if (~ix) {
						const [cpyActiveItem] = vewActiveItems.splice(ix, 1);
						cpyAbilObject.choose.weighted.from = cpyAbilObject.choose.weighted.from.filter(it => it !== cpyActiveItem.ability);
					}
				});
			}
			return !vewActiveItems.length;
			// endregion
		});
	}

	addItem (abilArr) {
		if (!abilArr?.length) return;

		// region Update our min/max scores
		let nxtMaxMod = this._maxMod;
		let nxtMinMod = this._minMod;

		abilArr.forEach(abilObject => {
			Parser.ABIL_ABVS.forEach(ab => {
				if (abilObject[ab] != null) {
					nxtMaxMod = Math.max(nxtMaxMod, abilObject[ab]);
					nxtMinMod = Math.min(nxtMinMod, abilObject[ab]);

					const uid = AbilityScoreFilter.FilterItem.getUid_({ability: ab, modifier: abilObject[ab]});
					if (!this._seenUids[uid]) this._isItemsDirty = true;
					this._seenUids[uid] = true;
				}
			});

			if (abilObject.choose?.from) {
				const amount = abilObject.choose.amount || 1;
				nxtMaxMod = Math.max(nxtMaxMod, amount);
				nxtMinMod = Math.min(nxtMinMod, amount);

				abilObject.choose.from.forEach(ab => {
					const uid = AbilityScoreFilter.FilterItem.getUid_({ability: ab, modifier: amount});
					if (!this._seenUids[uid]) this._isItemsDirty = true;
					this._seenUids[uid] = true;
				});
			}

			if (abilObject.choose?.weighted?.weights) {
				nxtMaxMod = Math.max(nxtMaxMod, ...abilObject.choose.weighted.weights);
				nxtMinMod = Math.min(nxtMinMod, ...abilObject.choose.weighted.weights);

				abilObject.choose.weighted.from.forEach(ab => {
					abilObject.choose.weighted.weights.forEach(weight => {
						const uid = AbilityScoreFilter.FilterItem.getUid_({ability: ab, modifier: weight});
						if (!this._seenUids[uid]) this._isItemsDirty = true;
						this._seenUids[uid] = true;
					});
				});
			}
		});
		// endregion

		// region If we have a new max score, populate items
		if (nxtMaxMod > this._maxMod) {
			for (let i = this._maxMod + 1; i <= nxtMaxMod; ++i) {
				if (i === 0) continue;
				Parser.ABIL_ABVS.forEach(ab => {
					const item = new AbilityScoreFilter.FilterItem({modifier: i, ability: ab});
					this._items.push(item);
					this._itemsLookup[item.uid] = item;
					if (this.__state[item.uid] == null) this.__state[item.uid] = 0;
				});
			}

			this._isItemsDirty = true;
			this._maxMod = nxtMaxMod;
		}
		// endregion

		// region If we have a new min score, populate items
		if (nxtMinMod < this._minMod) {
			for (let i = nxtMinMod; i < this._minMod; ++i) {
				if (i === 0) continue;
				Parser.ABIL_ABVS.forEach(ab => {
					const item = new AbilityScoreFilter.FilterItem({modifier: i, ability: ab});
					this._items.push(item);
					this._itemsLookup[item.uid] = item;
					if (this.__state[item.uid] == null) this.__state[item.uid] = 0;
				});
			}

			this._isItemsDirty = true;
			this._minMod = nxtMinMod;
		}
		// endregion
	}

	getSaveableState () {
		return {
			[this.header]: {
				...this.getBaseSaveableState(),
				state: {...this.__state},
			},
		};
	}

	setStateFromLoaded (filterState) {
		if (!filterState || !filterState[this.header]) return;
		const toLoad = filterState[this.header];
		this.setBaseStateFromLoaded(toLoad);
		Object.assign(this._state, toLoad.state);
	}

	getSubHashes () {
		const out = [];

		const baseMeta = this.getMetaSubHashes();
		if (baseMeta) out.push(...baseMeta);

		const areNotDefaultState = Object.entries(this._state).filter(([k, v]) => {
			if (k.startsWith("_")) return false;
			return !!v;
		});
		if (areNotDefaultState.length) {
			// serialize state as `key=value` pairs
			const serPillStates = areNotDefaultState.map(([k, v]) => `${k.toUrlified()}=${v}`);
			out.push(UrlUtil.packSubHash(this.getSubHashPrefix("state", this.header), serPillStates));
		}

		if (!out.length) return null;

		return out;
	}

	getNextStateFromSubhashState (state) {
		const nxtState = this._getNextState_base();

		if (state == null) {
			this._mutNextState_reset(nxtState);
			return nxtState;
		}

		let hasState = false;

		Object.entries(state).forEach(([k, vals]) => {
			const prop = FilterBase.getProp(k);
			switch (prop) {
				case "state": {
					hasState = true;
					Object.keys(nxtState[this.header].state).forEach(k => nxtState[this.header].state[k] = 0);

					vals.forEach(v => {
						const [statePropLower, state] = v.split("=");
						const stateProp = Object.keys(nxtState[this.header].state).find(k => k.toLowerCase() === statePropLower);
						if (stateProp) nxtState[this.header].state[stateProp] = Number(state) ? 1 : 0;
					});
					break;
				}
			}
		});

		if (!hasState) this._mutNextState_reset(nxtState);

		return nxtState;
	}

	setFromValues (values) {
		if (!values[this.header]) return;
		const nxtState = {};
		Object.keys(this._state).forEach(k => nxtState[k] = 0);
		Object.assign(nxtState, values[this.header]);
	}

	handleSearch (searchTerm) {
		const isHeaderMatch = this.header.toLowerCase().includes(searchTerm);

		if (isHeaderMatch) {
			Object.values(this.__wrpPillsRows).forEach(meta => meta.row.removeClass("fltr__hidden--search"));

			if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__hidden--search", false);

			return true;
		}

		// Simply display all if the user searched a "+x" or "-x" value; we don't care if this produces false positives.
		const isModNumber = /^[-+]\d*$/.test(searchTerm);

		let visibleCount = 0;
		Object.values(this.__wrpPillsRows).forEach(({row, searchText}) => {
			const isVisible = isModNumber || searchText.includes(searchTerm);
			row.toggleClass("fltr__hidden--search", !isVisible);
			if (isVisible) visibleCount++;
		});

		if (this.__$wrpFilter) this.__$wrpFilter.toggleClass("fltr__hidden--search", visibleCount === 0);

		return visibleCount !== 0;
	}

	_doTeardown () {
		this._items.forEach(it => {
			if (it.rendered) it.rendered.detach();
			if (it.btnMini) it.btnMini.detach();
		});

		Object.values(this.__wrpPillsRows).forEach(meta => meta.row.detach());
	}

	_getStateNotDefault () {
		return Object.entries(this._state)
			.filter(([, v]) => !!v);
	}

	getFilterTagPart () {
		const areNotDefaultState = this._getStateNotDefault();
		const compressedMeta = this._getCompressedMeta({isStripUiKeys: true});

		// If _any_ value is non-default, we need to include _all_ values in the tag
		// The same goes for meta values
		if (!areNotDefaultState.length && !compressedMeta) return null;

		const pt = Object.entries(this._state)
			.filter(([, v]) => !!v)
			.map(([k, v]) => `${v === 2 ? "!" : ""}${k}`)
			.join(";")
			.toLowerCase();

		return [
			this.header.toLowerCase(),
			pt,
			compressedMeta ? compressedMeta.join(HASH_SUB_LIST_SEP) : null,
		]
			.filter(it => it != null)
			.join("=");
	}

	getDisplayStatePart ({nxtState = null} = {}) {
		const state = nxtState?.[this.header]?.state || this.__state;

		const areNotDefaultState = this._getStateNotDefault({nxtState});

		// If _any_ value is non-default, we need to include _all_ values in the tag
		// The same goes for meta values
		if (!areNotDefaultState.length) return null;

		const ptState = Object.entries(state)
			.filter(([, v]) => !!v)
			.map(([k, v]) => {
				const item = this._items.find(item => item.uid === k);
				if (!item) return null; // Should never occur
				return `${v === 2 ? "not " : ""}${item.getMiniPillDisplayText()}`;
			})
			.join(", ");

		return `${this.header}: ${ptState}`;
	}
}
AbilityScoreFilter._MODIFIER_SORT_OFFSET = 10000; // Arbitrarily large value

AbilityScoreFilter.FilterItem = class {
	static getUid_ ({ability = null, isAnyIncrease = false, isAnyDecrease = false, modifier = null}) {
		return `${Parser.attAbvToFull(ability)} ${modifier != null ? UiUtil.intToBonus(modifier) : (isAnyIncrease ? `+any` : isAnyDecrease ? `-any` : "?")}`;
	}

	constructor ({isAnyIncrease = false, isAnyDecrease = false, modifier = null, ability = null}) {
		if (isAnyIncrease && isAnyDecrease) throw new Error(`Invalid arguments!`);
		if ((isAnyIncrease || isAnyDecrease) && modifier != null) throw new Error(`Invalid arguments!`);

		this._ability = ability;
		this._modifier = modifier;
		this._isAnyIncrease = isAnyIncrease;
		this._isAnyDecrease = isAnyDecrease;
		this._uid = AbilityScoreFilter.FilterItem.getUid_({
			isAnyIncrease: this._isAnyIncrease,
			isAnyDecrease: this._isAnyDecrease,
			modifier: this._modifier,
			ability: this._ability,
		});
	}

	get ability () { return this._ability; }
	get modifier () { return this._modifier; }
	get isAnyIncrease () { return this._isAnyIncrease; }
	get isAnyDecrease () { return this._isAnyDecrease; }
	get uid () { return this._uid; }

	getMiniPillDisplayText () {
		if (this._isAnyIncrease) return `+Any ${Parser.attAbvToFull(this._ability)}`;
		if (this._isAnyDecrease) return `\u2012Any ${Parser.attAbvToFull(this._ability)}`;
		return `${UiUtil.intToBonus(this._modifier, {isPretty: true})} ${Parser.attAbvToFull(this._ability)}`;
	}

	getPillDisplayHtml () {
		if (this._isAnyIncrease) return `+Any`;
		if (this._isAnyDecrease) return `\u2012Any`;
		return UiUtil.intToBonus(this._modifier, {isPretty: true});
	}
};

class PageFilterRaces extends PageFilter {
	// region static
	static getLanguageProficiencyTags (lProfs) {
		if (!lProfs) return [];

		const outSet = new Set();
		lProfs.forEach(lProfGroup => {
			Object.keys(lProfGroup)
				.forEach(k => {
					if (k !== "choose" && k !== "any" && k !== "anyStandard") outSet.add(k.toTitleCase());
					else outSet.add("Choose");
				});
		});

		return [...outSet];
	}

	static getAbilityObjs (abils) {
		function makeAbilObj (asi, amount) {
			return {
				asi: asi,
				amount: amount,
				_toIdString: () => {
					return `${asi}${amount}`;
				},
			};
		}

		const out = new CollectionUtil.ObjectSet();

		(abils || []).forEach(abil => {
			if (abil.choose) {
				const ch = abil.choose;

				if (ch.weighted) {
					// add every ability + weight combo
					ch.weighted.from.forEach(f => {
						ch.weighted.weights.forEach(w => {
							out.add(makeAbilObj(f, w));
						});
					});
				} else {
					const by = ch.amount || 1;
					ch.from.forEach(asi => out.add(makeAbilObj(asi, by)));
				}
			}
			Object.keys(abil).filter(prop => prop !== "choose").forEach(prop => out.add(makeAbilObj(prop, abil[prop])));
		});

		return Array.from(out.values());
	}

	static mapAbilityObjToFull (abilObj) { return `${Parser.attAbvToFull(abilObj.asi)} ${abilObj.amount < 0 ? "" : "+"}${abilObj.amount}`; }

	static getSpeedRating (speed) { return speed > 30 ? "Walk (Fast)" : speed < 30 ? "Walk (Slow)" : "Walk"; }

	static filterAscSortSize (a, b) {
		a = a.item;
		b = b.item;

		return SortUtil.ascSort(toNum(a), toNum(b));

		function toNum (size) {
			switch (size) {
				case "M": return 0;
				case "S": return -1;
				case "V": return 1;
			}
		}
	}

	static filterAscSortAsi (a, b) {
		a = a.item;
		b = b.item;

		if (a === "Player Choice") return -1;
		else if (a.startsWith("Any") && b.startsWith("Any")) {
			const aAbil = a.replace("Any", "").replace("Increase", "").trim();
			const bAbil = b.replace("Any", "").replace("Increase", "").trim();
			return PageFilterRaces.ASI_SORT_POS[aAbil] - PageFilterRaces.ASI_SORT_POS[bAbil];
		} else if (a.startsWith("Any")) {
			return -1;
		} else if (b.startsWith("Any")) {
			return 1;
		} else {
			const [aAbil, aScore] = a.split(" ");
			const [bAbil, bScore] = b.split(" ");
			return (PageFilterRaces.ASI_SORT_POS[aAbil] - PageFilterRaces.ASI_SORT_POS[bAbil]) || (Number(bScore) - Number(aScore));
		}
	}
	// endregion

	constructor () {
		super();

		this._sizeFilter = new Filter({header: "Size", displayFn: Parser.sizeAbvToFull, itemSortFn: PageFilterRaces.filterAscSortSize});
		this._asiFilter = new AbilityScoreFilter({
			header: "Ability Bonus (Including Subrace)",
		});
		this._asiFilterLegacy = new Filter({
			header: "Ability Bonus (Including Subrace) (Legacy)",
			items: [
				"Player Choice",
				"Any Strength Increase",
				"Any Dexterity Increase",
				"Any Constitution Increase",
				"Any Intelligence Increase",
				"Any Wisdom Increase",
				"Any Charisma Increase",
				"Strength +2",
				"Strength +1",
				"Dexterity +2",
				"Dexterity +1",
				"Constitution +2",
				"Constitution +1",
				"Intelligence +2",
				"Intelligence +1",
				"Wisdom +2",
				"Wisdom +1",
				"Charisma +2",
				"Charisma +1",
			],
			itemSortFn: PageFilterRaces.filterAscSortAsi,
		});
		this._baseRaceFilter = new Filter({header: "Base Race"});
		this._speedFilter = new Filter({header: "Speed", items: ["Climb", "Fly", "Swim", "Walk (Fast)", "Walk", "Walk (Slow)"]});
		this._traitFilter = new Filter({
			header: "Traits",
			items: [
				"Amphibious",
				"Armor Proficiency",
				"Blindsight",
				"Darkvision", "Superior Darkvision",
				"Dragonmark",
				"Feat",
				"Improved Resting",
				"Monstrous Race",
				"Natural Armor",
				"Natural Weapon",
				"NPC Race",
				"Powerful Build",
				"Skill Proficiency",
				"Spellcasting",
				"Sunlight Sensitivity",
				"Tool Proficiency",
				"Uncommon Race",
				"Weapon Proficiency",
			],
			deselFn: (it) => {
				return it === "NPC Race";
			},
		});
		this._vulnerableFilter = FilterCommon.getDamageVulnerableFilter();
		this._resistFilter = FilterCommon.getDamageResistFilter();
		this._immuneFilter = FilterCommon.getDamageImmuneFilter();
		this._defenceFilter = new MultiFilter({header: "Damage", filters: [this._vulnerableFilter, this._resistFilter, this._immuneFilter]});
		this._conditionImmuneFilter = FilterCommon.getConditionImmuneFilter();
		this._languageFilter = new Filter({
			header: "Languages",
			items: [
				"Abyssal",
				"Celestial",
				"Choose",
				"Common",
				"Draconic",
				"Dwarvish",
				"Elvish",
				"Giant",
				"Gnomish",
				"Goblin",
				"Halfling",
				"Infernal",
				"Orc",
				"Other",
				"Primordial",
				"Sylvan",
				"Undercommon",
			],
			umbrellaItems: ["Choose"],
		});
		this._creatureTypeFilter = new Filter({
			header: "Creature Type",
			items: Parser.MON_TYPES,
			displayFn: StrUtil.toTitleCase,
			itemSortFn: SortUtil.ascSortLower,
		});
		this._ageFilter = new RangeFilter({
			header: "Adult Age",
			isRequireFullRangeMatch: true,
			isSparse: true,
			displayFn: it => `${it} y.o.`,
			displayFnTooltip: it => `${it} year${it === 1 ? "" : "s"} old`,
		});
		this._miscFilter = new Filter({
			header: "Miscellaneous",
			items: ["Base Race", "Key Race", "Lineage", "Modified Copy", "Reprinted", "SRD", "Basic Rules", "Has Images", "Has Info"],
			isMiscFilter: true,
		});
	}

	static mutateForFilters (r) {
		r._fSize = r.size ? [...r.size] : [];
		if (r._fSize.length > 1) r._fSize.push("V");
		r._fSpeed = r.speed ? r.speed.walk ? [r.speed.climb ? "Climb" : null, r.speed.fly ? "Fly" : null, r.speed.swim ? "Swim" : null, PageFilterRaces.getSpeedRating(r.speed.walk)].filter(it => it) : [PageFilterRaces.getSpeedRating(r.speed)] : [];
		r._fTraits = [
			r.darkvision === 120 ? "Superior Darkvision" : r.darkvision ? "Darkvision" : null,
			r.blindsight ? "Blindsight" : null,
			r.skillProficiencies ? "Skill Proficiency" : null,
			r.toolProficiencies ? "Tool Proficiency" : null,
			r.feats ? "Feat" : null,
			r.additionalSpells ? "Spellcasting" : null,
			r.armorProficiencies ? "Armor Proficiency" : null,
			r.weaponProficiencies ? "Weapon Proficiency" : null,
		].filter(it => it);
		r._fTraits.push(...(r.traitTags || []));
		r._fSources = SourceFilter.getCompleteFilterSources(r);
		r._fLangs = PageFilterRaces.getLanguageProficiencyTags(r.languageProficiencies);
		r._fCreatureTypes = r.creatureTypes ? r.creatureTypes.map(it => it.choose || it).flat() : ["humanoid"];
		r._fMisc = [];
		if (r._isBaseRace) r._fMisc.push("Base Race");
		if (r._isBaseRace || !r._isSubRace) r._fMisc.push("Key Race");
		if (r._isCopy) r._fMisc.push("Modified Copy");
		if (r.srd) r._fMisc.push("SRD");
		if (r.basicRules) r._fMisc.push("Basic Rules");
		if (r.hasFluff) r._fMisc.push("Has Info");
		if (r.hasFluffImages) r._fMisc.push("Has Images");
		if (r.lineage) r._fMisc.push("Lineage");
		if (this._isReprinted({reprintedAs: r.reprintedAs, tag: "race", prop: "race", page: UrlUtil.PG_RACES})) r._fMisc.push("Reprinted");

		if (r.ability) {
			const abils = PageFilterRaces.getAbilityObjs(r.ability);
			r._fAbility = abils.map(a => PageFilterRaces.mapAbilityObjToFull(a));
			const increases = {};
			abils.filter(it => it.amount > 0).forEach(it => increases[it.asi] = true);
			Object.keys(increases).forEach(it => r._fAbility.push(`Any ${Parser.attAbvToFull(it)} Increase`));
			if (r.ability.some(it => it.choose)) r._fAbility.push("Player Choice");
		} else r._fAbility = [];

		const ability = r.ability ? Renderer.getAbilityData(r.ability, {isOnlyShort: true, isCurrentLineage: r.lineage === "VRGR"}) : {asTextShort: "None"};
		r._slAbility = ability.asTextShort;

		if (r.age?.mature != null && r.age?.max != null) r._fAge = [r.age.mature, r.age.max];
		else if (r.age?.mature != null) r._fAge = r.age.mature;
		else if (r.age?.max != null) r._fAge = r.age.max;

		FilterCommon.mutateForFilters_damageVulnResImmune_player(r);
		FilterCommon.mutateForFilters_conditionImmune_player(r);
	}

	addToFilters (r, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(r._fSources);
		this._sizeFilter.addItem(r._fSize);
		this._asiFilter.addItem(r.ability);
		this._baseRaceFilter.addItem(r._baseName);
		this._creatureTypeFilter.addItem(r._fCreatureTypes);
		this._traitFilter.addItem(r._fTraits);
		this._vulnerableFilter.addItem(r._fVuln);
		this._resistFilter.addItem(r._fRes);
		this._immuneFilter.addItem(r._fImm);
		this._conditionImmuneFilter.addItem(r._fCondImm);
		this._asiFilterLegacy.addItem(r._fAbility);
		this._ageFilter.addItem(r._fAge);
		this._languageFilter.addItem(r._fLangs);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._asiFilter,
			this._sizeFilter,
			this._speedFilter,
			this._traitFilter,
			this._defenceFilter,
			this._conditionImmuneFilter,
			this._languageFilter,
			this._baseRaceFilter,
			this._creatureTypeFilter,
			this._miscFilter,
			this._ageFilter,

			this._asiFilterLegacy,
		];
	}

	toDisplay (values, r) {
		return this._filterBox.toDisplay(
			values,
			r._fSources,
			r.ability,
			r._fSize,
			r._fSpeed,
			r._fTraits,
			[
				r._fVuln,
				r._fRes,
				r._fImm,
			],
			r._fCondImm,
			r._fLangs,
			r._baseName,
			r._fCreatureTypes,
			r._fMisc,
			r._fAge,

			r._fAbility,
		);
	}

	static getListAliases (race) {
		return (race.alias || [])
			.map(it => {
				const invertedName = PageFilterRaces.getInvertedName(it);
				return [`"${it}"`, invertedName ? `"${invertedName}"` : false].filter(Boolean);
			})
			.flat()
			.join(",");
	}

	static getInvertedName (name) {
		// convert e.g. "Elf (High)" to "High Elf" for use as a searchable field
		const bracketMatch = /^(.*?) \((.*?)\)$/.exec(name);
		return bracketMatch ? `${bracketMatch[2]} ${bracketMatch[1]}` : null;
	}
}
PageFilterRaces.ASI_SORT_POS = {
	Strength: 0,
	Dexterity: 1,
	Constitution: 2,
	Intelligence: 3,
	Wisdom: 4,
	Charisma: 5,
};

class ModalFilterRaces extends ModalFilter {
	/**
	 * @param opts
	 * @param opts.namespace
	 * @param [opts.isRadio]
	 * @param [opts.allData]
	 */
	constructor (opts) {
		opts = opts || {};
		super({
			...opts,
			modalTitle: `Race${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterRaces(),
		});
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "4"},
			{sort: "ability", text: "Ability", width: "4"},
			{sort: "size", text: "Size", width: "2"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pLoadAllData () {
		const fromData = await DataUtil.race.loadJSON();
		const fromBrew = await DataUtil.race.loadBrew({isAddBaseRaces: false});
		return [...fromData.race, ...fromBrew.race];
	}

	_getListItem (pageFilter, race, rI) {
		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 ve-flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES](race);
		const ability = race.ability ? Renderer.getAbilityData(race.ability) : {asTextShort: "None"};
		const size = (race.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/");
		const source = Parser.sourceJsonToAbv(race.source);

		eleRow.innerHTML = `<div class="w-100 ve-flex-vh-center lst--border veapp__list-row no-select lst__wrp-cells ${race._versionBase_isVersion ? "ve-muted" : ""}">
			<div class="col-0-5 pl-0 ve-flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 ve-flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-4 ${this._getNameStyle()}">${race.name}</div>
			<div class="col-4">${ability.asTextShort}</div>
			<div class="col-2 text-center">${size}</div>
			<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(race.source)}" title="${Parser.sourceJsonToFull(race.source)}" ${BrewUtil2.sourceJsonToStyle(race.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			rI,
			eleRow,
			race.name,
			{
				hash,
				source,
				sourceJson: race.source,
				ability: ability.asTextShort,
				size,
				cleanName: PageFilterRaces.getInvertedName(race.name) || "",
				alias: PageFilterRaces.getListAliases(race),
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_RACES, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}

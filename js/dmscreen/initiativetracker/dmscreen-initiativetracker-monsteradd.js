class _MonstersToLoad {
	constructor (
		{
			count,
			name,
			source,
			isRollHp,
			displayName,
			customName,
			scaledCr,
			scaledSummonSpellLevel,
			scaledSummonClassLevel,
		},
	) {
		this.count = count;
		this.name = name;
		this.source = source;
		this.isRollHp = isRollHp;
		this.displayName = displayName;
		this.customName = customName;
		this.scaledCr = scaledCr;
		this.scaledSummonSpellLevel = scaledSummonSpellLevel;
		this.scaledSummonClassLevel = scaledSummonClassLevel;
	}
}

class _InitiativeTrackerMonsterAddCustomizer extends BaseComponent {
	static _RenderState = class {
		constructor () {
			this.cbDoClose = null;
		}
	};

	constructor ({mon}) {
		super();
		this._mon = mon;
	}

	async pGetShowModalResults () {
		const rdState = new this.constructor._RenderState();

		const {$modalInner, $modalFooter, doClose, pGetResolved} = UiUtil.getShowModal({
			title: `Customize Creature \u2014 ${this._mon.name}`,
			isHeaderBorder: true,
			hasFooter: true,
			isMinHeight0: true,
		});
		rdState.cbDoClose = doClose;

		const $iptCustomName = ComponentUiUtil.$getIptStr(this, "customName");

		$$($modalInner)`
			<div class="ve-flex-col py-2 w-100 h-100 overflow-y-auto">
				<label class="split-v-center mb-2">
					<span class="w-200p text-right no-shrink mr-2 bold">Custom Name:</span>
					${$iptCustomName}
				</label>
				${this._render_$getRowScaler()}
			</div>
		`;

		$$($modalFooter)`
			${this._render_$getFooter({rdState})}
		`;

		return pGetResolved();
	}

	_render_$getRowScaler () {
		const isShowCrScaler = Parser.crToNumber(this._mon.cr) !== VeCt.CR_UNKNOWN;
		const isShowSpellLevelScaler = !isShowCrScaler && this._mon.summonedBySpellLevel != null;
		const isShowClassLevelScaler = !isShowSpellLevelScaler && this._mon.summonedByClass != null;

		if (!isShowCrScaler && !isShowSpellLevelScaler && !isShowClassLevelScaler) return null;

		if (isShowSpellLevelScaler) {
			const sel = Renderer.monster.getSelSummonSpellLevel(this._mon)
				.on("change", async () => {
					const val = Number(sel.val());
					this._state.scaledSummonSpellLevel = !~val ? null : val;
					if (this._state.scaledSummonSpellLevel == null) return delete this._state.displayName;
					this._state.displayName = (await ScaleSpellSummonedCreature.scale(this._mon, this._state.scaledSummonSpellLevel))._displayName;
				});

			return $$`<label class="split-v-center mb-2">
				<span class="w-200p text-right no-shrink mr-2 bold">Spell Level:</span>
				${sel}
			</label>`;
		}

		if (isShowClassLevelScaler) {
			const sel = Renderer.monster.getSelSummonClassLevel(this._mon)
				.on("change", async () => {
					const val = Number(sel.val());
					this._state.scaledSummonClassLevel = !~val ? null : val;
					if (this._state.scaledSummonClassLevel == null) return delete this._state.displayName;
					this._state.displayName = (await ScaleClassSummonedCreature.scale(this._mon, this._state.scaledSummonClassLevel))._displayName;
				});

			return $$`<label class="split-v-center mb-2">
				<span class="w-200p text-right no-shrink mr-2 bold">Class Level:</span>
				${sel}
			</label>`;
		}

		const $dispScaledCr = $(`<span class="inline-block"></span>`);
		this._addHookBase("scaledCr", () => $dispScaledCr.text(this._state.scaledCr ? Parser.numberToCr(this._state.scaledCr) : `${(this._mon.cr.cr || this._mon.cr)} (default)`))();

		const $btnScaleCr = $(`<button class="btn btn-default btn-xs mr-2"><span class="glyphicon glyphicon-signal"></span></button>`)
			.on("click", async () => {
				const crBase = this._mon.cr.cr || this._mon.cr;
				const ixDefault = Parser.CRS.indexOf(this._state.scaledCr ? Parser.numberToCr(this._state.scaledCr) : crBase);

				const cr = await InputUiUtil.pGetUserEnum({values: Parser.CRS, title: "Select Challenge Rating", default: ixDefault, isResolveItem: true});
				if (cr == null) return;

				if (crBase === cr) {
					delete this._state.scaledCr;
					delete this._state.displayName;
					return;
				}
				this._state.scaledCr = Parser.crToNumber(cr);
				this._state.displayName = (await ScaleCreature.scale(this._mon, this._state.scaledCr))._displayName;
			});

		return $$`<label class="split-v-center mb-2">
			<span class="w-200p text-right no-shrink mr-2 bold">CR:</span>
			<span class="ve-flex-v-center mr-auto">
				${$btnScaleCr}
				${$dispScaledCr}
			</span>
		</label>`;
	}

	_render_$getFooter ({rdState}) {
		const $btnSave = $(`<button class="btn btn-primary btn-sm w-100">Save</button>`)
			.click(() => {
				rdState.cbDoClose(
					true,
					MiscUtil.copyFast(this.__state),
				);
			});

		return $$`<div class="w-100 py-3 no-shrink">
			${$btnSave}
		</div>`;
	}

	_getDefaultState () {
		return {
			customName: null,
			displayName: null,
			scaledCr: null,
			scaledSummonSpellLevel: null,
			scaledSummonClassLevel: null,
		};
	}
}

export class InitiativeTrackerMonsterAdd extends BaseComponent {
	static _RESULTS_MAX_DISPLAY = 75; // hard cap at 75 results

	static _RenderState = class {
		constructor () {
			this.cbDoClose = null;
		}
	};

	constructor ({board, isRollHp}) {
		super();
		this._board = board;

		this._state.isRollHp = isRollHp;
	}

	_getDefaultState () {
		return {
			isRollHp: false,
			cntToAdd: 1,
			cntToAddCustom: 13,
		};
	}

	_getCntToAdd () {
		return this._state.cntToAdd === -1
			? Math.max(1, this._state.cntToAddCustom)
			: this._state.cntToAdd;
	}

	/* -------------------------------------------- */

	_$getCbCntToAdd ({cnt}) {
		const $cb = $(`<input type="radio" class="ui-search__ipt-search-sub-ipt">`);
		$cb.on("change", () => {
			this._state.cntToAdd = cnt;
		});
		this._addHookBase("cntToAdd", () => $cb.prop("checked", this._state.cntToAdd === cnt))();
		return $cb;
	}

	_$getIptCntToAddCustom () {
		const $iptCntToAddCustom = ComponentUiUtil.$getIptInt(
			this,
			"cntToAddCustom",
			1,
			{
				html: `<input type="number" class="form-control ui-search__ipt-search-sub-ipt-custom">`,
				min: 1,
			},
		);

		this._addHookBase("cntToAdd", () => {
			if (this._state.cntToAdd !== -1) return;
			$iptCntToAddCustom.select();
		})();

		$iptCntToAddCustom.click(() => {
			this._state.cntToAdd = -1;
		});

		return $iptCntToAddCustom;
	}

	/**
	 * @return {Promise<[boolean, _MonstersToLoad]>}
	 */
	async pGetShowModalResults () {
		const rdState = new this.constructor._RenderState();

		const flags = {
			doClickFirst: false,
			isWait: false,
		};

		const {$modalInner, doClose, pGetResolved} = UiUtil.getShowModal();
		rdState.cbDoClose = doClose;

		const $iptSearch = $(`<input class="ui-search__ipt-search search form-control" autocomplete="off" placeholder="Search...">`)
			.blurOnEsc();

		$$`<div class="split no-shrink">
			${$iptSearch}

			<div class="ui-search__ipt-search-sub-wrp ve-flex-v-center pr-0">
				<div class="mr-1">Add</div>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 1})} 1</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 2})} 2</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 3})} 3</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 5})} 5</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: 8})} 8</label>
				<label class="ui-search__ipt-search-sub-lbl">${this._$getCbCntToAdd({cnt: -1})} ${this._$getIptCntToAddCustom()}</label>
			</div>

			<label class="ui-search__ipt-search-sub-wrp ve-flex-vh-center">${ComponentUiUtil.$getCbBool(this, "isRollHp").addClass("mr-1")} <span>Roll HP</span></label>
		</div>`.appendTo($modalInner);

		const $results = $(`<div class="ui-search__wrp-results"></div>`).appendTo($modalInner);

		const showMsgIpt = () => {
			flags.isWait = true;
			$results.empty().append(SearchWidget.getSearchEnter());
		};

		const showMsgDots = () => $results.empty().append(SearchWidget.getSearchLoading());

		const showNoResults = () => {
			flags.isWait = true;
			$results.empty().append(SearchWidget.getSearchNoResults());
		};

		const $ptrRows = {_: []};

		const doSearch = () => {
			const searchTerm = $iptSearch.val().trim();

			const index = this._board.availContent["Creature"];
			const results = index.search(searchTerm, {
				fields: {
					n: {boost: 5, expand: true},
					s: {expand: true},
				},
				bool: "AND",
				expand: true,
			});
			const resultCount = results.length ? results.length : index.documentStore.length;
			const toProcess = results.length ? results : Object.values(index.documentStore.docs).slice(0, 75).map(it => ({doc: it}));

			$results.empty();
			$ptrRows._ = [];
			if (toProcess.length) {
				if (flags.doClickFirst) {
					this._render_pHandleClickRow({rdState}, toProcess[0]);
					flags.doClickFirst = false;
					return;
				}

				const results = toProcess.slice(0, this.constructor._RESULTS_MAX_DISPLAY);

				results.forEach(res => {
					const $row = this._render_$getSearchRow({rdState, res}).appendTo($results);
					SearchWidget.bindRowHandlers({result: res, $row, $ptrRows, fnHandleClick: this._render_pHandleClickRow.bind(this, {rdState}), $iptSearch});
					$ptrRows._.push($row);
				});

				if (resultCount > this.constructor._RESULTS_MAX_DISPLAY) {
					const diff = resultCount - this.constructor._RESULTS_MAX_DISPLAY;
					$results.append(`<div class="ui-search__row ui-search__row--readonly">...${diff} more result${diff === 1 ? " was" : "s were"} hidden. Refine your search!</div>`);
				}
			} else {
				if (!searchTerm.trim()) showMsgIpt();
				else showNoResults();
			}
		};

		SearchWidget.bindAutoSearch($iptSearch, {
			flags,
			fnSearch: doSearch,
			fnShowWait: showMsgDots,
			$ptrRows,
		});

		$iptSearch.focus();
		doSearch();

		return pGetResolved();
	}

	async _render_pHandleClickRow ({rdState}, res) {
		await rdState.cbDoClose(
			true,
			new _MonstersToLoad({
				count: this._getCntToAdd(),
				name: res.doc.n,
				source: res.doc.s,
				isRollHp: this._state.isRollHp,
			}),
		);
	}

	_render_$getSearchRow ({rdState, res}) {
		const $btnCustomize = $(`<button class="btn btn-default btn-xxs" title="Customize"><span class="glyphicon glyphicon-stats"></span></button>`)
			.on("click", async evt => {
				evt.stopPropagation();
				await this._render_pHandleClickCustomize({rdState, res});
			});

		return $$`
			<div class="ui-search__row ve-flex-v-center" tabindex="0">
				<span>${res.doc.n}</span>
				<div class="ve-flex-vh-center">
					<span class="mr-2">${res.doc.s ? `<i title="${Parser.sourceJsonToFull(res.doc.s)}">${Parser.sourceJsonToAbv(res.doc.s)}${res.doc.p ? ` p${res.doc.p}` : ""}</i>` : ""}</span>
					${$btnCustomize}
				</div>
			</div>
		`;
	}

	async _render_pHandleClickCustomize ({rdState, res}) {
		const mon = await DataLoader.pCacheAndGet(UrlUtil.PG_BESTIARY, res.doc.s, res.doc.u);
		if (!mon) return;

		const comp = new _InitiativeTrackerMonsterAddCustomizer({mon});

		const resModal = await comp.pGetShowModalResults();
		if (resModal == null) return;

		const [isDataEntered, data] = resModal;
		if (!isDataEntered) return;

		await rdState.cbDoClose(
			true,
			new _MonstersToLoad({
				count: this._getCntToAdd(),
				name: res.doc.n,
				source: res.doc.s,
				isRollHp: this._state.isRollHp,
				...data,
			}),
		);
	}
}

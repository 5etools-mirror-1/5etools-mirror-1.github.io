"use strict";

class SpellBuilder extends Builder {
	constructor () {
		super({
			titleSidebarLoadExisting: "Load Existing Spell",
			titleSidebarDownloadJson: "Download Spells as JSON",
			prop: "spell",
			titleSelectDefaultSource: "(Same as Spell)",
			typeRenderData: "dataSpell",
		});

		this._subclassLookup = {};

		this._renderOutputDebounced = MiscUtil.debounce(() => this._renderOutput(), 50);
	}

	static _getAsMarkdown (sp) {
		return RendererMarkdown.get().render({entries: [{type: "dataSpell", dataSpell: sp}]});
	}

	async pHandleSidebarLoadExistingClick () {
		const result = await SearchWidget.pGetUserSpellSearch();
		if (result) {
			const spell = MiscUtil.copy(await Renderer.hover.pCacheAndGet(result.page, result.source, result.hash));
			return this.pHandleSidebarLoadExistingData(spell);
		}
	}

	/**
	 * @param spell
	 * @param [opts]
	 * @param [opts.meta]
	 */
	async pHandleSidebarLoadExistingData (spell, opts) {
		opts = opts || {};

		spell.source = this._ui.source;

		delete spell.srd;
		delete spell.uniqueId;

		const meta = {...(opts.meta || {}), ...this.getInitialMetaState()};

		this.setStateFromLoaded({s: spell, m: meta});

		this.renderInput();
		this.renderOutput();
	}

	async pInit () {
		this._subclassLookup = await DataUtil.class.pGetSubclassLookup();
	}

	_getInitialState () {
		return {
			name: "New Spell",
			level: 1,
			school: "A",
			time: [
				{
					number: 1,
					unit: "action",
				},
			],
			range: {
				type: "point",
				distance: {
					type: "self",
				},
			},
			duration: [
				{
					type: "instant",
				},
			],
			classes: {
				fromClassList: [
					{
						name: "Wizard",
						source: SRC_PHB,
					},
				],
			},
			entries: [],
			source: this._ui ? this._ui.source : "",
		};
	}

	setStateFromLoaded (state) {
		if (state && state.s && state.m) {
			this.__state = state.s;
			this.__meta = state.m;
		}
	}

	doHandleSourcesAdd () {
		this._doHandleSourcesAdd_handleSelProp("$selClassSources");
		this._doHandleSourcesAdd_handleSelProp("$selSubclassSources");
	}

	_doHandleSourcesAdd_handleSelProp (prop) {
		(this._$eles[prop] || []).map($sel => {
			const currSrcJson = $sel.val();
			$sel.empty();
			[...Object.keys(Parser.SOURCE_JSON_TO_FULL), ...this._ui.allSources]
				.forEach(srcJson => $sel.append(`<option value="${srcJson.escapeQuotes()}">${Parser.sourceJsonToFull(srcJson).escapeQuotes()}</option>`));

			if (this._ui.allSources.indexOf(currSrcJson)) $sel.val(currSrcJson);
			else $sel.val(SRC_PHB);

			return $sel;
		}).forEach($sel => $sel.change());
	}

	_renderInputImpl () {
		this.renderInputControls();
		this._renderInputMain();
	}

	_renderInputMain () {
		this._sourcesCache = MiscUtil.copy(this._ui.allSources);
		const $wrp = this._ui.$wrpInput.empty();
		this.doCreateProxies();

		const _cb = () => {
			// Prefer numerical pages if possible
			if (!isNaN(this._state.page)) this._state.page = Number(this._state.page);

			// do post-processing
			TagCondition.tryTagConditions(this._state, {isTagInflicted: true});

			this.renderOutput();
			this.doUiSave();
			this.isEntrySaved = false;
			this.mutSavedButtonText();
		};
		const cb = MiscUtil.debounce(_cb, 33);
		this._cbCache = cb; // cache for use when updating sources

		// initialise tabs
		this._resetTabs({tabGroup: "input"});
		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Info", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Details", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Sources", hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Flavor/Misc", hasBorder: true}),
			],
			{
				tabGroup: "input",
				cbTabChange: this.doUiSave.bind(this),
			},
		);
		const [infoTab, detailsTab, sourcesTab, miscTab] = tabs;
		$$`<div class="flex-v-center w-100 no-shrink ui-tab__wrp-tab-heads--border">${tabs.map(it => it.$btnTab)}</div>`.appendTo($wrp);
		tabs.forEach(it => it.$wrpTab.appendTo($wrp));

		// INFO
		BuilderUi.$getStateIptString("Name", cb, this._state, {nullable: false, callback: () => this.renderSideMenu()}, "name").appendTo(infoTab.$wrpTab);
		this._$selSource = this.$getSourceInput(cb).appendTo(infoTab.$wrpTab);
		this.__$getOtherSourcesInput(cb).appendTo(infoTab.$wrpTab);
		BuilderUi.$getStateIptString("Page", cb, this._state, {}, "page").appendTo(infoTab.$wrpTab);
		BuilderUi.$getStateIptEnum("Level", cb, this._state, {nullable: false, fnDisplay: (it) => Parser.spLevelToFull(it), vals: [...new Array(21)].map((_, i) => i)}, "level").appendTo(infoTab.$wrpTab);
		BuilderUi.$getStateIptEnum("School", cb, this._state, {nullable: false, fnDisplay: (it) => Parser.spSchoolAbvToFull(it), vals: [...Parser.SKL_ABVS]}, "school").appendTo(infoTab.$wrpTab);
		BuilderUi.$getStateIptStringArray(
			"Subschools",
			cb,
			this._state,
			{
				shortName: "Subschool",
				title: "Found in some homebrew, for example the 'Clockwork' sub-school.",
			},
			"subschools",
		).appendTo(infoTab.$wrpTab);

		// TEXT
		this.__$getTimeInput(cb).appendTo(detailsTab.$wrpTab);
		this.__$getRangeInput(cb).appendTo(detailsTab.$wrpTab);
		this.__$getComponentInput(cb).appendTo(detailsTab.$wrpTab);
		this.__$getMetaInput(cb).appendTo(detailsTab.$wrpTab);
		this.__$getDurationInput(cb).appendTo(detailsTab.$wrpTab);
		BuilderUi.$getStateIptEntries("Text", cb, this._state, {fnPostProcess: BuilderUi.fnPostProcessDice}, "entries").appendTo(detailsTab.$wrpTab);
		BuilderUi.$getStateIptEntries("&quot;At Higher Levels&quot; Text", cb, this._state, {nullable: true, withHeader: "At Higher Levels", fnPostProcess: BuilderUi.fnPostProcessDice}, "entriesHigherLevel").appendTo(detailsTab.$wrpTab);

		// SOURCES
		this.__$getClassesInputs(cb).forEach($e => $e.appendTo(sourcesTab.$wrpTab));
		this.__$getRaces(cb).appendTo(sourcesTab.$wrpTab);
		this.__$getBackgrounds(cb).appendTo(sourcesTab.$wrpTab);

		// FLAVOR/MISC
		this.$getFluffInput(cb).appendTo(miscTab.$wrpTab);
		$(`<div class="flex-vh-center w-100 mb-2"><i>Note: the following data is used by filters on the Spells page.</i></div>`).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Damage Inflicted",
			cb,
			this._state,
			{
				vals: MiscUtil.copy(Parser.DMG_TYPES),
				nullable: true,
				fnDisplay: StrUtil.uppercaseFirst,
			},
			"damageInflict",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Conditions Inflicted",
			cb,
			this._state,
			{
				vals: MiscUtil.copy(Parser.CONDITIONS),
				nullable: true,
				fnDisplay: StrUtil.uppercaseFirst,
			},
			"conditionInflict",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Spell Attack Type",
			cb,
			this._state,
			{
				vals: ["M", "R", "O"],
				nullable: true,
				fnDisplay: Parser.spAttackTypeToFull,
			},
			"spellAttack",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Saving Throw",
			cb,
			this._state,
			{
				vals: Object.values(Parser.ATB_ABV_TO_FULL).map(it => it.toLowerCase()),
				nullable: true,
				fnDisplay: StrUtil.uppercaseFirst,
			},
			"savingThrow",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Ability Check",
			cb,
			this._state,
			{
				vals: Object.values(Parser.ATB_ABV_TO_FULL).map(it => it.toLowerCase()),
				nullable: true,
				fnDisplay: StrUtil.uppercaseFirst,
			},
			"abilityCheck",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Area Type",
			cb,
			this._state,
			{
				vals: Object.keys(Parser.SPELL_AREA_TYPE_TO_FULL),
				nullable: true,
				fnDisplay: Parser.spAreaTypeToFull,
			},
			"areaTags",
		).appendTo(miscTab.$wrpTab);
		BuilderUi.$getStateIptBooleanArray(
			"Misc Tags",
			cb,
			this._state,
			{
				vals: Object.keys(Parser.SP_MISC_TAG_TO_FULL),
				nullable: true,
				fnDisplay: Parser.spMiscTagToFull,
			},
			"miscTags",
		).appendTo(miscTab.$wrpTab);

		// The following aren't included, as they are not used in the site:
		/*
		damageResist
		damageImmune
		damageVulnerable
		 */
	}

	__$getOtherSourcesInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Other Sources", {isMarked: true, title: "For example, various spells in Xanathar's Guide to Everything can also be found in the Elemental Evil Player's Companion."});

		const doUpdateState = () => {
			const out = otherSourceRows.map(row => row.getOtherSource()).filter(Boolean);
			if (out.length) this._state.otherSources = out;
			else delete this._state.otherSources;
			cb();
		};

		const otherSourceRows = [];

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		(this._state.otherSources || []).forEach(it => this.__$getOtherSourcesInput__getOtherSourceRow(doUpdateState, otherSourceRows, it).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add Other Source</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				this.__$getOtherSourcesInput__getOtherSourceRow(doUpdateState, otherSourceRows, null).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	__$getOtherSourcesInput__getOtherSourceRow (doUpdateState, otherSourceRows, os) {
		const getOtherSource = () => {
			const out = {source: $selSource.val()};
			const pageRaw = $iptPage.val();
			if (pageRaw) {
				const page = !isNaN(pageRaw) ? UiUtil.strToInt(pageRaw) : pageRaw;
				if (page) {
					out.page = page;
					$iptPage.val(page);
				}
			}
			return out;
		};

		const $iptPage = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(os && os.page ? os.page : null);

		const $selSource = this._$getSelSource("$selOtherSourceSources", doUpdateState, os ? os.source.escapeQuotes() : SRC_PHB);

		const out = {getOtherSource};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows mkbru__wrp-rows--removable">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Source</span>${$selSource}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Page</span>${$iptPage}</div>
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, otherSourceRows, out, $wrp, "Other Source").appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		otherSourceRows.push(out);
		return out;
	}

	__$getTimeInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Casting Time", {isMarked: true});

		const doUpdateState = () => {
			this._state.time = timeRows.map(row => row.getTime());
			cb();
		};

		const timeRows = [];

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		this._state.time.forEach(time => SpellBuilder.__$getTimeInput__getTimeRow(doUpdateState, timeRows, time).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add Casting Time</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				SpellBuilder.__$getTimeInput__getTimeRow(doUpdateState, timeRows, {number: 1, unit: Parser.SP_TM_ACTION}).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	static __$getTimeInput__getTimeRow (doUpdateState, timeRows, time) {
		const keys = Object.keys(Parser.SP_TIME_TO_FULL);

		const getTime = () => {
			const out = {number: UiUtil.strToInt($iptNum.val()), unit: keys[$selUnit.val()]};
			const condition = $iptCond.val().trim();
			if (condition && keys[$selUnit.val()] === Parser.SP_TM_REACTION) out.condition = condition;

			$iptNum.val(out.number);

			return out;
		};

		const $iptNum = $(`<input class="form-control form-control--minimal input-xs mr-2">`)
			.change(() => doUpdateState())
			.val(time.number);

		const ixInitial = keys.indexOf(time.unit);
		const $selUnit = $(`<select class="form-control input-xs">
			${keys.map((it, i) => `<option value="${i}">${Parser.spTimeUnitToFull(it)}</option>`).join("")}
		</select>`)
			.val(~ixInitial ? `${ixInitial}` : "0")
			.change(() => {
				const isReaction = keys[$selUnit.val()] === Parser.SP_TM_REACTION;
				$stageCond.toggleVe(isReaction);
				doUpdateState();
			});

		const $iptCond = $(`<input class="form-control form-control--minimal input-xs" placeholder="which you take when...">`)
			.change(() => doUpdateState())
			.val(time.condition);

		const out = {getTime};

		const $stageCond = $$`<div class="flex-v-center mb-2">
			<span class="mr-2 mkbru__sub-name--33">Condition</span>${$iptCond}
		</div>`.toggleVe(ixInitial === 2);

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows mkbru__wrp-rows--removable">
			<div class="flex-v-center mb-2">${$iptNum}${$selUnit}</div>
			${$stageCond}
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, timeRows, out, $wrp, "Time", {isProtectLast: true}).appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		timeRows.push(out);
		return out;
	}

	__$getRangeInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Range", {isMarked: true});

		const isInitialDistance = !!this._state.range.distance;
		const isInitialAmount = this._state.range.distance && this._state.range.distance.amount != null;

		const RANGE_TYPES = Parser.RANGE_TYPES;
		const DIST_TYPES = Parser.DIST_TYPES;

		const doUpdateState = () => {
			const rangeMeta = RANGE_TYPES[$selRange.val()];
			const out = {type: rangeMeta.type};
			if (rangeMeta.hasDistance) {
				const distMeta = DIST_TYPES[$selDistance.val()];
				out.distance = {type: distMeta.type};
				if (distMeta.hasAmount) {
					out.distance.amount = UiUtil.strToInt($iptAmount.val());
					$iptAmount.val(out.distance.amount);
				}
			}
			this._state.range = out;
			cb();
		};

		const ixInitialRange = RANGE_TYPES.findIndex(it => it.type === this._state.range.type);
		const $selRange = $(`<select class="form-control input-xs">
			${RANGE_TYPES.map((it, i) => `<option value="${i}">${Parser.spRangeTypeToFull(it.type)}</option>`).join("")}
		</select>`).val(~ixInitialRange ? `${ixInitialRange}` : "0").change(() => {
			const meta = RANGE_TYPES[$selRange.val()];
			$stageDistance.toggleVe(meta.hasDistance);

			if (meta.isRequireAmount && !DIST_TYPES[$selDistance.val()].hasAmount) {
				$selDistance.val(`${DIST_TYPES.findIndex(it => it.hasAmount)}`).change();
			} else doUpdateState();
		});
		$$`<div class="flex-v-center">
			<span class="mr-2 mkbru__sub-name--33">Range Type</span>
			${$selRange}
		</div>`.appendTo($rowInner);

		// DISTANCE TYPE
		const ixInitialDist = this._state.range.distance ? DIST_TYPES.findIndex(it => it.type === this._state.range.distance.type) : -1;
		const $selDistance = $(`<select class="form-control input-xs">
			${DIST_TYPES.map((it, i) => `<option value="${i}">${Parser.spDistanceTypeToFull(it.type)}</option>`).join("")}
		</select>`).val(~ixInitialDist ? `${ixInitialDist}` : "0").change(() => {
			const meta = DIST_TYPES[$selDistance.val()];
			$stageAmount.toggleVe(meta.hasAmount);

			if (!meta.hasAmount && RANGE_TYPES[$selRange.val()].isRequireAmount) {
				$selDistance.val(`${DIST_TYPES.findIndex(it => it.hasAmount)}`).change();
			} else doUpdateState();
		});
		const $stageDistance = $$`<div class="flex-v-center mt-2">
			<span class="mr-2 mkbru__sub-name--33">Distance Type</span>
			${$selDistance}
		</div>`.appendTo($rowInner).toggleVe(isInitialDistance);

		// AMOUNT
		const initialAmount = MiscUtil.get(this._state, "range", "distance", "amount");
		const $iptAmount = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(initialAmount);
		const $stageAmount = $$`<div class="flex-v-center mt-2">
			<span class="mr-2 mkbru__sub-name--33">Distance Amount</span>
			${$iptAmount}
		</div>`.appendTo($rowInner).toggleVe(isInitialAmount);

		return $row;
	}

	__$getComponentInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Components", {isMarked: true});

		const initialMaterialMode = (!this._state.components || this._state.components.m == null)
			? "0"
			: (this._state.components.m.consume != null || this._state.components.m.cost != null || this._state.components.m.text != null)
				? "2"
				: typeof this._state.components.m === "string" ? "1" : "3";

		const doUpdateState = () => {
			const out = {};
			if ($cbVerbal.prop("checked")) out.v = true;
			if ($cbSomatic.prop("checked")) out.s = true;
			if ($cbRoyalty.prop("checked")) out.r = true;

			const materialMode = $selMaterial.val();
			// Use spaces
			switch (materialMode) {
				case "1": out.m = $iptMaterial.val().trim() || true; break;
				case "2": {
					out.m = {
						text: $iptMaterial.val().trim() || true,
					};
					// TODO add support for "optional" consume type
					if ($cbConsumed.prop("checked")) out.m.consume = true;
					if ($iptCost.val().trim()) {
						out.m.cost = UiUtil.strToInt($iptCost.val());
						$iptCost.val(out.m.cost);
					}
					break;
				}
				case "3": out.m = true; break;
			}

			if (Object.keys(out).length) this._state.components = out;
			else delete this._state.components;
			cb();
		};

		const $cbVerbal = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.components && this._state.components.v)
			.change(() => doUpdateState());
		const $cbSomatic = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.components && this._state.components.s)
			.change(() => doUpdateState());
		const $cbRoyalty = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.components && this._state.components.r)
			.change(() => doUpdateState());
		const $iptMaterial = $(`<input class="form-control form-control--minimal input-xs">`)
			.val(initialMaterialMode === "1" ? this._state.components.m : initialMaterialMode === "2" ? this._state.components.m.text : null)
			.change(() => doUpdateState());

		const $selMaterial = $(`<select class="form-control input-xs">
			<option value="0">(None)</option>
			<option value="1">Has Material Component</option>
			<option value="2">Has Consumable/Costed Material Component</option>
			<option value="3">Has Generic Material Component</option>
		</select>`).val(initialMaterialMode).change(() => {
			switch ($selMaterial.val()) {
				case "0": $stageMaterial.hideVe(); $stageMaterialConsumable.hideVe(); break;
				case "1": $stageMaterial.showVe(); $stageMaterialConsumable.hideVe(); break;
				case "2": $stageMaterial.showVe(); $stageMaterialConsumable.showVe(); break;
				case "3": $stageMaterial.hideVe(); $stageMaterialConsumable.hideVe(); break;
			}

			doUpdateState();
		});
		$$``.appendTo($rowInner);

		$$`<div>
			<div class="flex-v-center mb-2"><div class="mr-2 mkbru__sub-name--33">Verbal</div>${$cbVerbal}</div>
			<div class="flex-v-center mb-2"><div class="mr-2 mkbru__sub-name--33">Somatic</div>${$cbSomatic}</div>
			<div class="flex-v-center mt-2"><div class="mr-2 mkbru__sub-name--33">Royalty</div>${$cbRoyalty}</div>
			<div class="flex-v-center"><div class="mr-2 mkbru__sub-name--33">Material Type</div>${$selMaterial}</div>
		</div>`.appendTo($rowInner);

		// BASIC MATERIAL
		const $stageMaterial = $$`<div class="flex-v-center mt-2"><div class="mr-2 mkbru__sub-name--33">Materials</div>${$iptMaterial}</div>`.appendTo($rowInner).toggleVe(initialMaterialMode === "1" || initialMaterialMode === "2");

		// CONSUMABLE MATERIAL
		const $cbConsumed = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.components && this._state.components.m && this._state.components.m.consume)
			.change(() => doUpdateState());
		const $iptCost = $(`<input class="form-control form-control--minimal input-xs mr-1">`)
			.val(this._state.components && this._state.components.m && this._state.components.m.cost ? this._state.components.m.cost : null)
			.change(() => doUpdateState());
		const TITLE_FILTERS_EXTERNAL = "Used in filtering/external applications. The full text of the material component should be entered in the &quot;Materials&quot; field, above.";
		const $stageMaterialConsumable = $$`<div class="mt-2">
			<div class="flex-v-center mb-2"><div class="mr-2 mkbru__sub-name--33 help" title="${TITLE_FILTERS_EXTERNAL}">Is Consumed</div>${$cbConsumed}</div>
			<div class="flex-v-center"><div class="mr-2 mkbru__sub-name--33 help" title="${TITLE_FILTERS_EXTERNAL} Specified in copper pieces (1gp = 100cp).">Component Cost</div>${$iptCost}<div>cp</div></div>
		</div>`.appendTo($rowInner).toggleVe(initialMaterialMode === "2");

		return $row;
	}

	__$getMetaInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Tags", {isMarked: true});

		const doUpdateState = () => {
			const out = {};
			if ($cbRitual.prop("checked")) out.ritual = true;
			if ($cbTechnomagic.prop("checked")) out.technomagic = true;

			if (Object.keys(out).length) this._state.meta = out;
			else delete this._state.meta;
			cb();
		};

		const $cbRitual = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.meta && this._state.meta.ritual)
			.change(() => doUpdateState());
		const $cbTechnomagic = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", this._state.meta && this._state.meta.technomagic)
			.change(() => doUpdateState());

		$$`<div>
			<div class="flex-v-center mb-2"><div class="mr-2 mkbru__sub-name--33">Ritual</div>${$cbRitual}</div>
			<div class="flex-v-center"><div class="mr-2 mkbru__sub-name--33">Technomagic</div>${$cbTechnomagic}</div>
		</div>`.appendTo($rowInner);

		return $row;
	}

	__$getDurationInput (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Duration", {isMarked: true});

		const doUpdateState = () => {
			this._state.duration = durationRows.map(row => row.getDuration());
			cb();
		};

		const durationRows = [];

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		this._state.duration.forEach(duration => SpellBuilder.__$getDurationInput__getDurationRow(doUpdateState, durationRows, duration).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add Duration</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				SpellBuilder.__$getDurationInput__getDurationRow(doUpdateState, durationRows, {type: "instant"}).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	static __$getDurationInput__getDurationRow (doUpdateState, durationRows, duration) {
		const DURATION_TYPES = Parser.DURATION_TYPES;
		const AMOUNT_TYPES = Parser.DURATION_AMOUNT_TYPES;

		const typeInitial = DURATION_TYPES.find(it => it.type === duration.type);

		const getDuration = () => {
			const ixType = $selDurationType.val();
			const out = {type: DURATION_TYPES[ixType].type};

			switch (ixType) {
				case "1": {
					out.duration = {
						type: AMOUNT_TYPES[$selAmountType.val()],
						amount: UiUtil.strToInt($iptAmount.val()),
					};
					$iptAmount.val(out.duration.amount);
					if ($cbConc.prop("checked")) out.concentration = true;
					if ($cbUpTo.prop("checked")) out.duration.upTo = true;
					break;
				}
				case "2": {
					if (endRows.length) out.ends = endRows.map(it => it.getEnd());
				}
			}

			return out;
		};

		const ixInitialDuration = DURATION_TYPES.findIndex(it => it.type === duration.type);
		const $selDurationType = $(`<select class="form-control input-xs">
			${DURATION_TYPES.map((it, i) => `<option value="${i}">${it.full || it.type.toTitleCase()}</option>`).join("")}
		</select>`).val(~ixInitialDuration ? `${ixInitialDuration}` : "0").change(() => {
			const meta = DURATION_TYPES[$selDurationType.val()];
			$stageAmount.toggleVe(!!meta.hasAmount);
			$stageEnds.toggleVe(!!meta.hasEnds);
			doUpdateState();
		});

		// AMOUNT
		const ixInitialAmount = duration.duration ? AMOUNT_TYPES.indexOf(duration.duration.type) : "0";
		const $selAmountType = $(`<select class="form-control input-xs">
			${AMOUNT_TYPES.map((it, i) => `<option value="${i}">${it.toTitleCase()}s</option>`).join("")}
		</select>`).val(ixInitialAmount).change(() => doUpdateState());
		const $iptAmount = $(`<input class="form-control form-control--minimal input-xs mr-2">`)
			.val(duration.duration ? duration.duration.amount : null)
			.change(() => doUpdateState());
		const $cbConc = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", !!duration.concentration)
			.change(() => doUpdateState());
		const $cbUpTo = $(`<input type="checkbox" class="mkbru__ipt-cb--plain">`)
			.prop("checked", duration.duration ? duration.duration.upTo : false)
			.change(() => doUpdateState());
		const $stageAmount = $$`<div class="flex-col mb-2">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Concentration</span>${$cbConc}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33 help" title="For a spell with Concentration, this has no effect, as it is assumed that the spell can be ended at any time by ending concentration.">Up To...</span>${$cbUpTo}</div>
			<div class="flex-v-center">${$iptAmount}${$selAmountType}</div>
		</div>`.toggleVe(!!typeInitial.hasAmount);

		// ENDS
		const endRows = [];
		const $wrpEndRows = $(`<div class="flex-col"/>`);
		const $btnAddEnd = $(`<button class="btn btn-xs btn-default">Add &quot;Until&quot; Clause</button>`)
			.click(() => {
				SpellBuilder.__$getDurationInput__getDurationRow__getEndRow(doUpdateState, endRows, "dispel").$wrp.appendTo($wrpEndRows);
				doUpdateState();
			});
		const $stageEnds = $$`<div class="mb-2">
			${$wrpEndRows}
			<div class="text-right">${$btnAddEnd}</div>
		</div>`.toggleVe(!!typeInitial.hasEnds);
		if (duration.ends) duration.ends.forEach(end => SpellBuilder.__$getDurationInput__getDurationRow__getEndRow(doUpdateState, endRows, end).$wrp.appendTo($wrpEndRows));

		const out = {getDuration};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows mkbru__wrp-rows--removable">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Duration Type</span>${$selDurationType}</div>
			${$stageAmount}
			${$stageEnds}
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, durationRows, out, $wrp, "Duration", {isProtectLast: true}).appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		durationRows.push(out);
		return out;
	}

	static __$getDurationInput__getDurationRow__getEndRow (doUpdateState, endRows, end) {
		const keys = Object.keys(Parser.SP_END_TYPE_TO_FULL);

		const getEnd = () => keys[$selEndType.val()];

		const ixInitialEnd = end ? keys.indexOf(end) : "0";
		const $selEndType = $(`<select class="form-control input-xs mr-2">
			${keys.map((it, i) => `<option value="${i}">Until ${Parser.spEndTypeToFull(it)}</option>`).join("")}
		</select>`).val(ixInitialEnd).change(() => doUpdateState());

		const out = {getEnd};

		const $wrpBtnRemove = $(`<div/>`);
		const $wrp = $$`<div class="flex">
			<div class="mkbru__sub-name--33 mr-2"></div>
			<div class="mb-2 flex-v-center w-100">${$selEndType}${$wrpBtnRemove}</div>
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, endRows, out, $wrp, "Until Clause", {isExtraSmall: true}).appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		endRows.push(out);
		return out;
	}

	__$getClassesInputs (cb) {
		const DEFAULT_CLASS = {name: "Wizard", source: SRC_PHB};
		const DEFAULT_SUBCLASS = {name: "Evocation", source: SRC_PHB};

		const [$rowCls, $rowInnerCls] = BuilderUi.getLabelledRowTuple("Classes", {isMarked: true});
		const [$rowSc, $rowInnerSc] = BuilderUi.getLabelledRowTuple("Subclasses", {isMarked: true});

		const classRows = [];
		const subclassRows = [];

		const doUpdateState = () => {
			const out = {fromClassList: classRows.map(it => it.getClass())};
			const subclasses = subclassRows.map(it => it.getSubclass()).filter(Boolean);
			if (subclasses.length) out.fromSubclass = subclasses;
			this._state.classes = out;
			cb();
		};

		// CLASSES
		const $wrpRowsCls = $(`<div/>`).appendTo($rowInnerCls);
		((this._state.classes || {}).fromClassList || []).forEach(cls => this.__$getClassesInputs__getClassRow(doUpdateState, classRows, cls).$wrp.appendTo($wrpRowsCls));

		const $wrpBtnAddCls = $(`<div/>`).appendTo($rowInnerCls);
		$(`<button class="btn btn-xs btn-default">Add Class</button>`)
			.appendTo($wrpBtnAddCls)
			.click(() => {
				this.__$getClassesInputs__getClassRow(doUpdateState, classRows, MiscUtil.copy(DEFAULT_CLASS)).$wrp.appendTo($wrpRowsCls);
				doUpdateState();
			});

		// SUBCLASSES
		const $wrpRowsSc = $(`<div/>`).appendTo($rowInnerSc);
		((this._state.classes || {}).fromSubclass || []).forEach(sc => this.__$getClassesInputs__getSubclassRow(doUpdateState, subclassRows, sc).$wrp.appendTo($wrpRowsSc));

		const $wrpBtnAddSc = $(`<div/>`).appendTo($rowInnerSc);
		$(`<button class="btn btn-xs btn-default">Add Subclass</button>`)
			.appendTo($wrpBtnAddSc)
			.click(() => {
				this.__$getClassesInputs__getSubclassRow(doUpdateState, subclassRows, {class: MiscUtil.copy(DEFAULT_CLASS), subclass: MiscUtil.copy(DEFAULT_SUBCLASS)}).$wrp.appendTo($wrpRowsSc);
				doUpdateState();
			});

		return [$rowCls, $rowSc];
	}

	__$getClassesInputs__getClassRow (doUpdateState, classRows, cls) {
		const getClass = () => {
			return {
				name: $iptClass.val().trim(),
				source: $selClassSource.val().unescapeQuotes(),
			};
		};

		const $iptClass = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(cls.name);
		const $selClassSource = this._$getSelSource("$selClassSources", doUpdateState, cls.source.escapeQuotes());

		const out = {getClass};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows mkbru__wrp-rows--removable">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Class Name</span>${$iptClass}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Class Source</span>${$selClassSource}</div>
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, classRows, out, $wrp, "Class", {isProtectLast: true}).appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		classRows.push(out);
		return out;
	}

	__$getClassesInputs__getSubclassRow (doUpdateState, subclassRows, subclass) {
		const getSubclass = () => {
			const className = $iptClass.val().trim();
			const subclassName = $iptSubclass.val().trim();
			if (!className || !subclassName) return null;
			const out = {
				class: {
					name: className,
					source: $selClassSource.val().unescapeQuotes(),
				},
				subclass: {
					name: $iptSubclass.val(),
					source: $selSubclassSource.val().unescapeQuotes(),
				},
			};
			const subSubclassName = $iptSubSubclass.val().trim();
			if (subSubclassName) out.subclass.subSubclass = subSubclassName;
			return out;
		};

		const $iptClass = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(subclass.class.name);
		const $selClassSource = this._$getSelSource("$selClassSources", doUpdateState, subclass.class.source.escapeQuotes());

		const $iptSubclass = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(subclass.subclass.name);
		const $selSubclassSource = this._$getSelSource("$selSubclassSources", doUpdateState, subclass.subclass.source.escapeQuotes());

		const $iptSubSubclass = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(subclass.subclass.subSubclass ? subclass.subclass.subSubclass : null);

		const out = {getSubclass};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Class Name</span>${$iptClass}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Class Source</span>${$selClassSource}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Subclass Name</span>${$iptSubclass}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Subclass Source</span>${$selSubclassSource}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33 help" title="For example, for a Circle of the Coast Land Druid, enter &quot;Coast&quot;">Sub-Subclass Name</span>${$iptSubSubclass}</div>
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, subclassRows, out, $wrp, "Subclass").appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		subclassRows.push(out);
		return out;
	}

	__$getRaces (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Races", {isMarked: true});

		const doUpdateState = () => {
			const races = raceRows.map(row => row.getRace()).filter(Boolean);
			if (races.length) this._state.races = races;
			else delete this._state.races;
			cb();
		};

		const raceRows = [];

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		(this._state.races || []).forEach(race => this.__$getRaces__getRaceRow(doUpdateState, raceRows, race).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add Race</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				this.__$getRaces__getRaceRow(doUpdateState, raceRows, null).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}

	__$getRaces__getRaceRow (doUpdateState, raceRows, race) {
		const getRace = () => {
			const raceName = $iptRace.val().trim();
			if (raceName) {
				const out = {
					name: raceName,
					source: $selSource.val().unescapeQuotes(),
				};
				const baseRaceName = $iptBaseRace.val().trim();
				if (baseRaceName) {
					out.baseName = baseRaceName;
					out.baseSource = $selBaseSource.val().unescapeQuotes();
				}
				return out;
			} else return null;
		};

		const $iptRace = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(race ? race.name : null);
		const $iptBaseRace = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(race ? race.baseName : null);

		const $selSource = this._$getSelSource("$selRaceSources", doUpdateState, race ? race.source.escapeQuotes() : SRC_PHB);
		const $selBaseSource = this._$getSelSource("$selBaseRaceSources", doUpdateState, race && race.baseSource ? race.baseSource.escapeQuotes() : SRC_PHB);

		const out = {getRace};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Name</span>${$iptRace}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Source</span>${$selSource}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33 help" title="The name of the base race, e.g. &quot;Elf&quot;. This is used in filtering.">Base Name</span>${$iptBaseRace}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33 help" title="For example, the &quot;Elf&quot; base race has a source of &quot;${SRC_PHB}&quot;">Base Source</span>${$selBaseSource}</div>
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, raceRows, out, $wrp, "Race").appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		raceRows.push(out);
		return out;
	}

	__$getBackgrounds (cb) {
		const [$row, $rowInner] = BuilderUi.getLabelledRowTuple("Backgrounds", {isMarked: true});

		const doUpdateState = () => {
			const bgs = bgRows.map(row => row.getBackground()).filter(Boolean);
			if (bgs.length) this._state.backgrounds = bgs;
			else delete this._state.backgrounds;
			cb();
		};

		const bgRows = [];

		const $wrpRows = $(`<div/>`).appendTo($rowInner);
		(this._state.backgrounds || []).forEach(bg => this.__$getBackgrounds__getBackgroundRow(doUpdateState, bgRows, bg).$wrp.appendTo($wrpRows));

		const $wrpBtnAdd = $(`<div/>`).appendTo($rowInner);
		$(`<button class="btn btn-xs btn-default">Add Background</button>`)
			.appendTo($wrpBtnAdd)
			.click(() => {
				this.__$getBackgrounds__getBackgroundRow(doUpdateState, bgRows, null).$wrp.appendTo($wrpRows);
				doUpdateState();
			});

		return $row;
	}
	__$getBackgrounds__getBackgroundRow (doUpdateState, bgRows, bg) {
		const getBackground = () => {
			const bgName = $iptName.val().trim();
			if (bgName) {
				return {
					name: bgName,
					source: $selSource.val().unescapeQuotes(),
				};
			} else return null;
		};

		const $iptName = $(`<input class="form-control form-control--minimal input-xs">`)
			.change(() => doUpdateState())
			.val(bg ? bg.name : null);

		const $selSource = this._$getSelSource("$selBackgroundSources", doUpdateState, bg ? bg.source.escapeQuotes() : SRC_PHB);

		const out = {getBackground};

		const $wrpBtnRemove = $(`<div class="text-right mb-2"/>`);
		const $wrp = $$`<div class="flex-col mkbru__wrp-rows">
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Name</span>${$iptName}</div>
			<div class="flex-v-center mb-2"><span class="mr-2 mkbru__sub-name--33">Source</span>${$selSource}</div>
			${$wrpBtnRemove}
		</div>`;
		Builder.$getBtnRemoveRow(doUpdateState, bgRows, out, $wrp, "Background").appendTo($wrpBtnRemove);

		out.$wrp = $wrp;
		bgRows.push(out);
		return out;
	}

	// TODO use this in creature builder (_$eles)
	_$getSelSource (elesProp, doUpdateState, initialVal) {
		const $selSource = $(`<select class="form-control input-xs"/>`)
			.change(() => doUpdateState());
		[...Object.keys(Parser.SOURCE_JSON_TO_FULL), ...this._ui.allSources]
			.forEach(srcJson => $selSource.append(`<option value="${srcJson.escapeQuotes()}">${Parser.sourceJsonToFull(srcJson).escapeQuotes()}</option>`));
		if (initialVal != null) $selSource.val(initialVal);
		(this._$eles[elesProp] = this._$eles[elesProp] || []).push($selSource);
		return $selSource;
	}

	renderOutput () {
		this._renderOutputDebounced();
		this.mutSavedButtonText();
	}

	_renderOutput () {
		const $wrp = this._ui.$wrpOutput.empty();

		// initialise tabs
		this._resetTabs({tabGroup: "output"});

		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Spell"}),
				new TabUiUtil.TabMeta({name: "Info"}),
				new TabUiUtil.TabMeta({name: "Images"}),
				new TabUiUtil.TabMeta({name: "Data"}),
				new TabUiUtil.TabMeta({name: "Markdown"}),
			],
			{
				tabGroup: "output",
				cbTabChange: this.doUiSave.bind(this),
			},
		);
		const [spellTab, infoTab, imageTab, dataTab, markdownTab] = tabs;
		$$`<div class="flex-v-center w-100 no-shrink">${tabs.map(it => it.$btnTab)}</div>`.appendTo($wrp);
		tabs.forEach(it => it.$wrpTab.appendTo($wrp));

		// Spell
		const $tblSpell = $(`<table class="stats"/>`).appendTo(spellTab.$wrpTab);
		// Make a copy of the spell, and add the data that would be displayed in the spells page
		const procSpell = MiscUtil.copy(this._state);
		Renderer.spell.initClasses(procSpell);
		RenderSpells.$getRenderedSpell(procSpell, this._subclassLookup).appendTo($tblSpell);

		// Info
		const $tblInfo = $(`<table class="stats"/>`).appendTo(infoTab.$wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: false,
			$content: $tblInfo,
			entity: this._state,
			pFnGetFluff: Renderer.spell.pGetFluff,
		});

		// Images
		const $tblImages = $(`<table class="stats"/>`).appendTo(imageTab.$wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: true,
			$content: $tblImages,
			entity: this._state,
			pFnGetFluff: Renderer.spell.pGetFluff,
		});

		// Data
		const $tblData = $(`<table class="stats stats--book mkbru__wrp-output-tab-data"/>`).appendTo(dataTab.$wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [
				{
					type: "code",
					name: `Data`,
					preformatted: JSON.stringify(DataUtil.cleanJson(MiscUtil.copy(this._state)), null, "\t"),
				},
			],
		});
		$tblData.append(Renderer.utils.getBorderTr());
		$tblData.append(`<tr><td colspan="6">${asCode}</td></tr>`);
		$tblData.append(Renderer.utils.getBorderTr());

		// Markdown
		const $tblMarkdown = $(`<table class="stats stats--book mkbru__wrp-output-tab-data"/>`).appendTo(markdownTab.$wrpTab);
		$tblMarkdown.append(Renderer.utils.getBorderTr());
		$tblMarkdown.append(`<tr><td colspan="6">${this._getRenderedMarkdownCode()}</td></tr>`);
		$tblMarkdown.append(Renderer.utils.getBorderTr());
	}
}

const spellBuilder = new SpellBuilder();

ui.spellBuilder = spellBuilder;
spellBuilder.ui = ui;

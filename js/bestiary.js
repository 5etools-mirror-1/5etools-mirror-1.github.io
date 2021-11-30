"use strict";

const ECGEN_BASE_PLAYERS = 4; // assume a party size of four

window.PROF_MODE_BONUS = "bonus";
window.PROF_MODE_DICE = "dice";

class BestiaryPage extends ListPageMultiSource {
	constructor () {
		super({
			pageFilter: new PageFilterBestiary(),

			listClass: "monsters",
			listOptions: {
				fnSort: PageFilterBestiary.sortMonsters,
			},

			sublistClass: "submonsters",
			sublistOptions: {
				fnSort: PageFilterBestiary.sortMonsters,
				onUpdate: (...args) => this._onSublistChange(...args),
				pCustomHashHandler: (mon, customHashId) => {
					const {_scaledCr, _scaledSpellSummonLevel, _scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(customHashId);
					if (_scaledCr != null) return ScaleCreature.scale(mon, _scaledCr);
					if (_scaledSpellSummonLevel != null) return ScaleSpellSummonedCreature.scale(mon, _scaledSpellSummonLevel);
					if (_scaledClassSummonLevel != null) return ScaleClassSummonedCreature.scale(mon, _scaledClassSummonLevel);
					return mon;
				},
				fnSerializePinnedItemData: data => ({l: data.isLocked ? data.isLocked : undefined}),
				fnDeserializePinnedItemData: serialData => ({isLocked: !!serialData.l}),
			},
			sublistOptionsBindAddButton: {
				fnGetCustomHashId: (...args) => this._getCurrentPinListCustomHashId(...args),
				shiftCount: 5,
			},
			sublistOptionsBindSubtractButton: {
				fnGetCustomHashId: (...args) => this._getCurrentPinListCustomHashId(...args),
				shiftCount: 5,
			},
			isSublistItemsCountable: true,

			dataProps: ["monster"],

			hasAudio: true,

			bookViewOptions: {
				$btnOpen: $(`#btn-printbook`),
				$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple creatures, please first make a list</span>`),
				pageTitle: "Bestiary Printer View",
				popTblGetNumShown: (opts) => this._bookView_popTblGetNumShown(opts),
			},

			bindPopoutButtonOptions: {
				handlerGenerator: BestiaryPage.popoutHandlerGenerator.bind(BestiaryPage),
				title: "Popout Window (SHIFT for Source Data; CTRL for Markdown Render)",
			},
			bindOtherButtonsOptions: {
				upload: {
					pFnPreLoad: (...args) => this.pPreloadSublistSources(...args),
				},
				sendToBrew: {
					mode: "creatureBuilder",
					fnGetMeta: () => ({
						page: UrlUtil.getCurrentPage(),
						source: Hist.getHashSource(),
						hash: `${UrlUtil.autoEncodeHash(this._lastRendered.mon)}${BestiaryPage._getUrlSubhashes(this._lastRendered.mon)}`,
					}),
				},
			},

			jsonDir: "data/bestiary/",
		});

		this._seenHashes = new Set();

		this._$btnProf = null;
		this._$dispCrTotal = null;

		this._lastRendered = {mon: null, isScaledCr: false, isScaledSpellSummon: false, isScaledClassSummon: false};

		this._profDicMode = PROF_MODE_BONUS;

		this._encounterBuilder = null;
	}

	// region Expose for encounter builder
	get list_ () { return this._list; }
	get dataList_ () { return this._dataList; }
	// endregion

	async _bookView_popTblGetNumShown ({$wrpContent, $dispName, $wrpControls}) {
		const toShow = await ListUtil.pGetPinnedEntities();

		toShow.sort((a, b) => SortUtil.ascSort(a._displayName || a.name, b._displayName || b.name));

		let numShown = 0;

		const stack = [];

		const renderCreature = (mon) => {
			stack.push(`<div class="bkmv__wrp-item"><table class="stats stats--book stats--bkmv"><tbody>`);
			stack.push(Renderer.monster.getCompactRenderedString(mon, Renderer.get()));
			stack.push(`</tbody></table></div>`);
		};

		stack.push(`<div class="w-100 h-100">`);
		toShow.forEach(mon => renderCreature(mon));
		if (!toShow.length && Hist.lastLoadedId != null) {
			renderCreature(this._dataList[Hist.lastLoadedId]);
		}
		stack.push(`</div>`);

		numShown += toShow.length;
		$wrpContent.append(stack.join(""));

		// region Markdown
		// TODO refactor this and spell markdown section
		const pGetAsMarkdown = async () => {
			const toRender = toShow.length ? toShow : [this._dataList[Hist.lastLoadedId]];
			return RendererMarkdown.monster.pGetMarkdownDoc(toRender);
		};

		const $btnDownloadMarkdown = $(`<button class="btn btn-default btn-sm">Download as Markdown</button>`)
			.click(async () => DataUtil.userDownloadText("bestiary.md", await pGetAsMarkdown()));

		const $btnCopyMarkdown = $(`<button class="btn btn-default btn-sm px-2" title="Copy Markdown to Clipboard"><span class="glyphicon glyphicon-copy"/></button>`)
			.click(async () => {
				await MiscUtil.pCopyTextToClipboard(await pGetAsMarkdown());
				JqueryUtil.showCopiedEffect($btnCopyMarkdown);
			});

		const $btnDownloadMarkdownSettings = $(`<button class="btn btn-default btn-sm px-2" title="Markdown Settings"><span class="glyphicon glyphicon-cog"/></button>`)
			.click(async () => RendererMarkdown.pShowSettingsModal());

		$$`<div class="flex-v-center btn-group ml-2">
			${$btnDownloadMarkdown}
			${$btnCopyMarkdown}
			${$btnDownloadMarkdownSettings}
		</div>`.appendTo($wrpControls);
		// endregion

		return numShown;
	}

	getListItem (mon, mI) {
		const hash = UrlUtil.autoEncodeHash(mon);
		if (!mon.uniqueId && this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		Renderer.monster.updateParsed(mon);
		const isExcluded = ExcludeUtil.isExcluded(hash, "monster", mon.source);

		this._pageFilter.mutateAndAddToFilters(mon, isExcluded);

		const source = Parser.sourceJsonToAbv(mon.source);
		const type = mon._pTypes.asText.uppercaseFirst();
		const cr = mon._pCr;

		const eleLi = e_({
			tag: "div",
			clazz: `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`,
			click: (evt) => this._handleBestiaryLiClick(evt, listItem),
			contextmenu: (evt) => this._handleBestiaryLiContext(evt, listItem),
			children: [
				e_({
					tag: "a",
					href: `#${hash}`,
					clazz: "lst--border lst__row-inner",
					click: evt => this._handleBestiaryLinkClick(evt),
					children: [
						this._encounterBuilder.getButtons(mI),
						e_({tag: "span", clazz: `ecgen__name bold col-4-2 pl-0`, text: mon.name}),
						e_({tag: "span", clazz: `col-4-1`, text: type}),
						e_({tag: "span", clazz: `col-1-7 text-center`, text: cr}),
						e_({
							tag: "span",
							clazz: `col-2 text-center ${Parser.sourceJsonToColor(mon.source)} pr-0`,
							style: BrewUtil.sourceJsonToStylePart(mon.source),
							title: `${Parser.sourceJsonToFull(mon.source)}${Renderer.utils.getSourceSubText(mon)}`,
							text: source,
						}),
					],
				}),
			],
		});

		const listItem = new ListItem(
			mI,
			eleLi,
			mon.name,
			{
				hash,
				source,
				type,
				cr,
				group: mon.group || "",
				alias: (mon.alias || []).map(it => `"${it}"`).join(","),
			},
			{
				uniqueId: mon.uniqueId ? mon.uniqueId : mI,
				isExcluded,
			},
		);

		return listItem;
	}

	handleFilterChange () {
		if (Hist.initialLoad) return;

		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(li => {
			const m = this._dataList[li.ix];
			return this._pageFilter.toDisplay(f, m);
		});
		this._onFilterChangeMulti(this._dataList, f);
		this._encounterBuilder.resetCache();
	}

	static _getUrlSubhashes (mon, {isAddLeadingSep = true} = {}) {
		const subhashesRaw = [
			mon._isScaledCr ? `${UrlUtil.HASH_START_CREATURE_SCALED}${mon._scaledCr}` : null,
			mon._summonedBySpell_level ? `${UrlUtil.HASH_START_CREATURE_SCALED_SPELL_SUMMON}${mon._summonedBySpell_level}` : null,
			mon._summonedByClass_level ? `${UrlUtil.HASH_START_CREATURE_SCALED_CLASS_SUMMON}${mon._summonedByClass_level}` : null,
		].filter(Boolean);

		if (!subhashesRaw.length) return "";
		return `${isAddLeadingSep ? HASH_PART_SEP : ""}${subhashesRaw.join(HASH_PART_SEP)}`;
	}

	async pGetSublistItem (monRaw, ix, {count = 1, customHashId = null, initialData} = {}) {
		const mon = await Renderer.monster.pGetModifiedCreature(monRaw, customHashId);
		Renderer.monster.updateParsed(mon);
		const subHash = this.constructor._getUrlSubhashes(mon);

		const name = mon._displayName || mon.name;
		const hash = `${UrlUtil.autoEncodeHash(mon)}${subHash}`;
		const type = mon._pTypes.asText.uppercaseFirst();
		const cr = mon._pCr;
		const isLocked = !!initialData?.isLocked; // If e.g. reloading from a save

		const $hovStatblock = $(`<span class="col-1-4 help help--hover ecgen__visible">Statblock</span>`)
			.mouseover(evt => this._encounterBuilder.doStatblockMouseOver(evt, $hovStatblock[0], ix, customHashId))
			.mousemove(evt => Renderer.hover.handleLinkMouseMove(evt, $hovStatblock[0]))
			.mouseleave(evt => Renderer.hover.handleLinkMouseLeave(evt, $hovStatblock[0]));

		const hovTokenMeta = EncounterBuilder.getTokenHoverMeta(mon);
		const $hovToken = !hovTokenMeta ? $(`<span class="col-1-2 ecgen__visible"></span>`) : $(`<span class="col-1-2 ecgen__visible help help--hover">Token</span>`)
			.mouseover(evt => hovTokenMeta.mouseOver(evt, $hovToken[0]))
			.mousemove(evt => hovTokenMeta.mouseMove(evt, $hovToken[0]))
			.mouseleave(evt => hovTokenMeta.mouseLeave(evt, $hovToken[0]));

		const $hovImage = $(`<span class="col-1-2 ecgen__visible help help--hover">Image</span>`)
			.mouseover(evt => this._encounterBuilder.handleImageMouseOver(evt, $hovImage, ix));

		const $ptCr = (() => {
			if (!ScaleCreature.isCrInScaleRange(mon)) return $(`<span class="col-1-2 text-center">${cr}</span>`);

			const $iptCr = $(`<input value="${cr}" class="ecgen__cr_input form-control form-control--minimal input-xs">`)
				.click(() => $iptCr.select())
				.change(() => this._encounterBuilder.pDoCrChange($iptCr, ix, mon._scaledCr));

			return $$`<span class="col-1-2 text-center">${$iptCr}</span>`;
		})();

		const $eleCount1 = $(`<span class="col-2 text-center">${count}</span>`);
		const $eleCount2 = $(`<span class="col-2 pr-0 text-center">${count}</span>`);

		const listItem = new ListItem(
			ix,
			null,
			name,
			{
				hash,
				source: Parser.sourceJsonToAbv(mon.source),
				type,
				cr,
			},
			{
				count,
				customHashId,
				approxHp: this._getApproxHp(mon),
				approxAc: this._getApproxAc(mon),
				isLocked,
				$elesCount: [$eleCount1, $eleCount2],
				fnsUpdate: [],
			},
		);

		const sublistButtonsMeta = this._encounterBuilder.getSublistButtonsMeta(listItem);
		listItem.data.fnsUpdate.push(sublistButtonsMeta.fnUpdate);

		listItem.ele = $$`<div class="lst__row lst__row--sublist flex-col lst__row--bestiary-sublist">
			<a href="#${hash}" draggable="false" class="ecgen__hidden lst--border lst__row-inner">
				<span class="bold col-5 pl-0">${name}</span>
				<span class="col-3-8">${type}</span>
				<span class="col-1-2 text-center">${cr}</span>
				${$eleCount1}
			</a>

			<div class="lst__wrp-cells ecgen__visible--flex lst--border lst__row-inner">
				${sublistButtonsMeta.$wrp}
				<span class="ecgen__name--sub col-3-5">${name}</span>
				${$hovStatblock}
				${$hovToken}
				${$hovImage}
				${$ptCr}
				${$eleCount2}
			</div>
		</div>`
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => this._handleBestiaryLinkClickSub(evt, listItem));

		return listItem;
	}

	_getApproxHp (mon) {
		if (mon.hp && mon.hp.average && !isNaN(mon.hp.average)) return Number(mon.hp.average);
		return null;
	}

	_getApproxAc (mon) {
		// Use the first AC listed, as this is usually the "primary"
		if (mon.ac && mon.ac[0] != null) {
			if (mon.ac[0].ac) return mon.ac[0].ac;
			if (typeof mon.ac[0] === "number") return mon.ac[0];
		}
		return null;
	}

	doLoadHash (id) {
		const mon = this._dataList[id];

		this._renderStatblock(mon);

		this.pDoLoadSubHash([]);
		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._pageFilter.filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub, this.pPreloadSublistSources.bind(this));

		await this._bookView.pHandleSub(sub);

		const scaledHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED));
		const scaledSpellSummonHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED_SPELL_SUMMON));
		const scaledClassSummonHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED_CLASS_SUMMON));
		const mon = this._dataList[Hist.lastLoadedId];

		if (scaledHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledHash)[VeCt.HASH_SCALED][0]);
			const scaleToStr = Parser.numberToCr(scaleTo);
			if (Parser.isValidCr(scaleToStr) && scaleTo !== Parser.crToNumber(this._lastRendered.mon.cr)) {
				ScaleCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledCr: true}));
			}
		} else if (scaledSpellSummonHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledSpellSummonHash)[VeCt.HASH_SCALED_SPELL_SUMMON][0]);
			if (mon._summonedBySpell_levelBase != null && scaleTo >= mon._summonedBySpell_levelBase && scaleTo !== this._lastRendered.mon._summonedBySpell_level) {
				ScaleSpellSummonedCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledSpellSummon: true}));
			}
		} else if (scaledClassSummonHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledClassSummonHash)[VeCt.HASH_SCALED_CLASS_SUMMON][0]);
			if (mon.summonedByClass != null && scaleTo >= 1 && scaleTo !== this._lastRendered.mon._summonedByClass_level) {
				ScaleClassSummonedCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledClassSummon: true}));
			}
		}

		this._encounterBuilder.handleSubhash(sub);
	}

	async _pOnLoad_pPreDataLoad () {
		this._encounterBuilder = new EncounterBuilder(this);
		this._encounterBuilder.initUi();
		await DataUtil.monster.pPreloadMeta();
		this._bindProfDiceHandlers();
	}

	// TODO refactor this and spell markdown section
	static popoutHandlerGenerator (toList) {
		return (evt) => {
			const mon = toList[Hist.lastLoadedId];
			const toRender = bestiaryPage._lastRendered.mon || mon;

			if (evt.shiftKey) {
				const $content = Renderer.hover.$getHoverContent_statsCode(toRender);
				Renderer.hover.getShowWindow(
					$content,
					Renderer.hover.getWindowPositionFromEvent(evt),
					{
						title: `${toRender._displayName || toRender.name} \u2014 Source Data`,
						isPermanent: true,
						isBookContent: true,
					},
				);
			} else if (evt.ctrlKey || evt.metaKey) {
				const name = `${toRender._displayName || toRender.name} \u2014 Markdown`;
				const mdText = RendererMarkdown.get().render({entries: [{type: "dataCreature", dataCreature: toRender, legendaryGroup: DataUtil.monster.getMetaGroup(toRender)}]});
				const $content = Renderer.hover.$getHoverContent_miscCode(name, mdText);

				Renderer.hover.getShowWindow(
					$content,
					Renderer.hover.getWindowPositionFromEvent(evt),
					{
						title: name,
						isPermanent: true,
						isBookContent: true,
					},
				);
			} else {
				const pageUrl = `#${UrlUtil.autoEncodeHash(toRender)}${this._getUrlSubhashes(toRender)}`;

				const renderFn = Renderer.hover.getFnRenderCompact(UrlUtil.getCurrentPage());
				const $content = $$`<table class="stats">${renderFn(toRender)}</table>`;
				const windowMeta = Renderer.hover.getShowWindow(
					$content,
					Renderer.hover.getWindowPositionFromEvent(evt),
					{
						pageUrl,
						title: toRender._displayName || toRender.name,
						isPermanent: true,
					},
				);

				// region Hacky post-process step to match the hover window rendering pipeline
				const page = UrlUtil.PG_BESTIARY;
				const source = toRender.source;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](mon);
				Renderer.monster.doBindCompactContentHandlers({
					$content,
					sourceData: {
						type: "stats",
						page,
						source,
						hash,
					},
					toRender,
					fnRender: Renderer.hover.getFnRenderCompact(page),
					page,
					source,
					hash,
					meta: {windowMeta},
				});
				// endregion
			}
		};
	}

	async _pOnLoad_pPreDataAdd () {
		this._pPageInit_profBonusDiceToggle();
	}

	_pPageInit_profBonusDiceToggle () {
		const $btnProfBonusDice = $("button#profbonusdice");

		$btnProfBonusDice.click(() => {
			if (this._profDicMode === PROF_MODE_DICE) {
				this._profDicMode = PROF_MODE_BONUS;
				$btnProfBonusDice.html("Use Proficiency Dice");
				this._$pgContent.attr("data-proficiency-dice-mode", this._profDicMode);
			} else {
				this._profDicMode = PROF_MODE_DICE;
				$btnProfBonusDice.html("Use Proficiency Bonus");
				this._$pgContent.attr("data-proficiency-dice-mode", this._profDicMode);
			}
		});
	}

	async _pOnLoad_pPreHashInit () {
		this._encounterBuilder.initState();
	}

	_pHandleBrew (homebrew) {
		try {
			DataUtil.monster.populateMetaReference(homebrew);
			this._addData(homebrew);
		} catch (e) {
			BrewUtil.pPurgeBrew(e);
		}
	}

	_handleBestiaryLiClick (evt, listItem) {
		if (this._encounterBuilder.isActive()) Renderer.hover.doPopoutCurPage(evt, this._dataList[listItem.ix]);
		else this._list.doSelect(listItem, evt);
	}

	_handleBestiaryLiContext (evt, listItem) {
		ListUtil.openContextMenu(evt, this._list, listItem);
	}

	_handleBestiaryLinkClick (evt) {
		if (this._encounterBuilder.isActive()) evt.preventDefault();
	}

	_handleBestiaryLinkClickSub (evt, listItem) {
		if (this._encounterBuilder.isActive()) evt.preventDefault();
		else this._listSub.doSelect(listItem, evt);
	}

	_bindProfDiceHandlers () {
		this._$pgContent.attr("data-proficiency-dice-mode", this._profDicMode);

		this._$pgContent
			.on(`mousedown`, `[data-roll-prof-type]`, evt => {
				if (this._profDicMode !== PROF_MODE_BONUS) evt.preventDefault();
			})
			.on(`click`, `[data-roll-prof-type]`, evt => {
				const parent = evt.currentTarget.closest(`[data-roll-prof-type]`);

				const type = parent?.dataset?.rollProfType;
				if (!type) return;

				switch (type) {
					case "d20": {
						if (this._profDicMode === PROF_MODE_BONUS) return;

						evt.stopPropagation();
						evt.preventDefault();

						const cpyOriginalEntry = JSON.parse(parent.dataset.packedDice);
						cpyOriginalEntry.toRoll = `d20${parent.dataset.rollProfDice}`;
						cpyOriginalEntry.d20mod = parent.dataset.rollProfDice;

						Renderer.dice.pRollerClick(evt, parent, JSON.stringify(cpyOriginalEntry));
						break;
					}

					case "dc": {
						if (this._profDicMode === PROF_MODE_BONUS) {
							evt.stopPropagation();
							evt.preventDefault();
							return;
						}

						const fauxEntry = Renderer.utils.getTagEntry(`@d20`, parent.dataset.rollProfDice);
						Renderer.dice.pRollerClick(evt, parent, JSON.stringify(fauxEntry));
						break;
					}

					default: throw new Error(`Unhandled roller type "${type}"`);
				}
			});
	}

	_renderStatblock (mon, {isScaledCr = false, isScaledSpellSummon = false, isScaledClassSummon = false} = {}) {
		this._lastRendered.mon = mon;
		this._lastRendered.isScaledCr = isScaledCr;
		this._lastRendered.isScaledSpellSummon = isScaledSpellSummon;
		this._lastRendered.isScaledClassSummon = isScaledClassSummon;

		Renderer.get().setFirstSection(true);

		this._$pgContent.empty();
		const $wrpBtnProf = $(`#wrp-profbonusdice`);

		if (this._$btnProf != null) {
			$wrpBtnProf.append(this._$btnProf);
			this._$btnProf = null;
		}

		// reset tabs
		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Statblock",
				fnChange: () => {
					$wrpBtnProf.append(this._$btnProf);
					$(`#float-token`).show();
				},
				fnPopulate: () => this._renderStatblock_doBuildStatsTab({mon, isScaledCr, isScaledSpellSummon, isScaledClassSummon}),
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnChange: () => {
					this._$btnProf = $wrpBtnProf.children().length ? $wrpBtnProf.children().detach() : this._$btnProf;
					$(`#float-token`).hide();
				},
				fnPopulate: () => this._renderStatblock_doBuildFluffTab(),
				isVisible: Renderer.utils.hasFluffText(mon, "monsterFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnChange: () => {
					this._$btnProf = $wrpBtnProf.children().length ? $wrpBtnProf.children().detach() : this._$btnProf;
					$(`#float-token`).hide();
				},
				fnPopulate: () => this._renderStatblock_doBuildFluffTab({isImageTab: true}),
				isVisible: Renderer.utils.hasFluffImages(mon, "monsterFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});
	}

	_renderStatblock_doBuildStatsTab (
		{
			mon,
			isScaledCr,
			isScaledSpellSummon,
			isScaledClassSummon,
		},
	) {
		const $btnScaleCr = !ScaleCreature.isCrInScaleRange(mon) ? null : $(`<button id="btn-scale-cr" title="Scale Creature By CR (Highly Experimental)" class="mon__btn-scale-cr btn btn-xs btn-default"><span class="glyphicon glyphicon-signal"></span></button>`)
			.click((evt) => {
				evt.stopPropagation();
				const win = (evt.view || {}).window;
				const mon = this._dataList[Hist.lastLoadedId];
				const lastCr = this._lastRendered.mon ? this._lastRendered.mon.cr.cr || this._lastRendered.mon.cr : mon.cr.cr || mon.cr;
				Renderer.monster.getCrScaleTarget({
					win,
					$btnScale: $btnScaleCr,
					initialCr: lastCr,
					cbRender: (targetCr) => {
						if (targetCr === Parser.crToNumber(mon.cr)) this._renderStatblock(mon);
						else Hist.setSubhash(VeCt.HASH_SCALED, targetCr);
					},
				});
			});

		const $btnResetScaleCr = !ScaleCreature.isCrInScaleRange(mon) ? null : $(`<button id="btn-reset-cr" title="Reset CR Scaling" class="mon__btn-reset-cr btn btn-xs btn-default"><span class="glyphicon glyphicon-refresh"></span></button>`)
			.click(() => Hist.setSubhash(VeCt.HASH_SCALED, null))
			.toggle(isScaledCr);

		const selSummonSpellLevel = Renderer.monster.getSelSummonSpellLevel(mon);
		if (selSummonSpellLevel) {
			selSummonSpellLevel
				.onChange(evt => {
					evt.stopPropagation();
					const scaleTo = Number(selSummonSpellLevel.val());
					if (!~scaleTo) Hist.setSubhash(VeCt.HASH_SCALED_SPELL_SUMMON, null);
					else Hist.setSubhash(VeCt.HASH_SCALED_SPELL_SUMMON, scaleTo);
				});
		}
		if (isScaledSpellSummon) selSummonSpellLevel.val(`${mon._summonedBySpell_level}`);

		const selSummonClassLevel = Renderer.monster.getSelSummonClassLevel(mon);
		if (selSummonClassLevel) {
			selSummonClassLevel
				.onChange(evt => {
					evt.stopPropagation();
					const scaleTo = Number(selSummonClassLevel.val());
					if (!~scaleTo) Hist.setSubhash(VeCt.HASH_SCALED_CLASS_SUMMON, null);
					else Hist.setSubhash(VeCt.HASH_SCALED_CLASS_SUMMON, scaleTo);
				});
		}
		if (isScaledClassSummon) selSummonClassLevel.val(`${mon._summonedByClass_level}`);

		// region dice rollers
		const expectedPB = Parser.crToPb(mon.cr);

		const pluginDc = (tag, text) => {
			if (isNaN(text) || expectedPB <= 0) return null;

			const withoutPB = Number(text) - expectedPB;
			const profDiceString = BestiaryPage._addSpacesToDiceExp(`+1d${(expectedPB * 2)}${withoutPB >= 0 ? "+" : ""}${withoutPB}`);

			return `DC <span class="rd__dc rd__dc--rollable" data-roll-prof-type="dc" data-roll-prof-dice="${profDiceString.qq()}"><span class="rd__dc--rollable-text">${text}</span><span class="rd__dc--rollable-dice">${profDiceString}</span></span>`;
		};

		const pluginDice = (entry, textStack, meta, options) => {
			if (expectedPB <= 0 || entry.subType !== "d20" || entry.context?.type == null) return null;

			const text = Renderer.getEntryDiceDisplayText(entry);
			let profDiceString;

			let expert = 1;
			let pB = expectedPB;

			const bonus = Number(entry.d20mod);

			switch (entry.context?.type) {
				case "savingThrow": {
					const ability = entry.context.ability;
					const fromAbility = Parser.getAbilityModNumber(mon[ability]);
					pB = bonus - fromAbility;
					expert = (pB === expectedPB * 2) ? 2 : 1;
					break;
				}
				case "skillCheck": {
					const ability = Parser.skillToAbilityAbv(entry.context.skill.toLowerCase().trim());
					const fromAbility = Parser.getAbilityModNumber(mon[ability]);
					pB = bonus - fromAbility;
					expert = (pB === expectedPB * 2) ? 2 : 1;
					break;
				}

				// add proficiency dice stuff for attack rolls, since those _generally_ have proficiency
				// this is not 100% accurate; for example, ghouls don't get their prof bonus on bite attacks
				// fixing it would probably involve machine learning though; we need an AI to figure it out on-the-fly
				// (Siri integration forthcoming)
				case "hit": break;

				case "abilityCheck": return null;

				default: throw new Error(`Unhandled roll context "${entry.context.type}"`);
			}

			const withoutPB = bonus - pB;
			profDiceString = BestiaryPage._addSpacesToDiceExp(`+${expert}d${pB * (3 - expert)}${withoutPB >= 0 ? "+" : ""}${withoutPB}`);

			return {
				toDisplay: `<span class="rd__roller--roll-prof-bonus">${text}</span><span class="rd__roller--roll-prof-dice">${profDiceString}</span>`,
				additionalData: {
					"data-roll-prof-type": "d20",
					"data-roll-prof-dice": profDiceString,
				},
			};
		};

		try {
			Renderer.get().addPlugin("string_@dc", pluginDc);
			Renderer.get().addPlugin("dice", pluginDice);

			this._$pgContent.append(RenderBestiary.$getRenderedCreature(mon, {$btnScaleCr, $btnResetScaleCr, selSummonSpellLevel, selSummonClassLevel}));
		} finally {
			Renderer.get().removePlugin("dice", pluginDice);
			Renderer.get().removePlugin("string_@dc", pluginDc);
		}
		// endregion

		// tokens
		this._renderStatblock_doBuildStatsTab_token(mon);
	}

	_renderStatblock_doBuildStatsTab_token (mon) {
		const $tokenImages = [];

		// statblock scrolling handler
		$(`#wrp-pagecontent`).off("scroll").on("scroll", function () {
			$tokenImages.forEach($img => {
				$img
					.toggle(this.scrollTop < 32)
					.css({
						opacity: (32 - this.scrollTop) / 32,
						top: -this.scrollTop,
					});
			});
		});

		const $floatToken = $(`#float-token`).empty();

		const hasToken = mon.tokenUrl || mon.hasToken;
		if (!hasToken) return;

		const imgLink = Renderer.monster.getTokenUrl(mon);
		const $img = $(`<img src="${imgLink}" class="mon__token" alt="Token Image: ${(mon.name || "").qq()}" loading="lazy">`);
		$tokenImages.push($img);
		const $lnkToken = $$`<a href="${imgLink}" class="mon__wrp-token" target="_blank" rel="noopener noreferrer">${$img}</a>`
			.appendTo($floatToken);

		const altArtMeta = [];

		if (mon.altArt) altArtMeta.push(...MiscUtil.copy(mon.altArt));
		if (mon.variant) {
			const variantTokens = mon.variant.filter(it => it.token).map(it => it.token);
			if (variantTokens.length) altArtMeta.push(...MiscUtil.copy(variantTokens).map(it => ({...it, displayName: `Variant; ${it.name}`})));
		}

		if (altArtMeta.length) {
			// make a fake entry for the original token
			altArtMeta.unshift({$ele: $lnkToken});

			const buildEle = (meta) => {
				if (!meta.$ele) {
					const imgLink = Renderer.monster.getTokenUrl({name: meta.name, source: meta.source, tokenUrl: meta.tokenUrl});
					const $img = $(`<img src="${imgLink}" class="mon__token" alt="Token Image: ${(meta.displayName || meta.name || "").qq()}" loading="lazy">`)
						.on("error", () => {
							$img.attr(
								"src",
								`data:image/svg+xml,${encodeURIComponent(`
										<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
											<circle cx="200" cy="200" r="175" fill="#b00"/>
											<rect x="190" y="40" height="320" width="20" fill="#ddd" transform="rotate(45 200 200)"/>
											<rect x="190" y="40" height="320" width="20" fill="#ddd" transform="rotate(135 200 200)"/>
										</svg>`,
								)}`,
							);
						});
					$tokenImages.push($img);
					meta.$ele = $$`<a href="${imgLink}" class="mon__wrp-token" target="_blank" rel="noopener noreferrer">${$img}</a>`
						.hide()
						.css("max-width", "100%") // hack to ensure the token gets shown at max width on first look
						.appendTo($floatToken);
				}
			};
			altArtMeta.forEach(buildEle);

			let ix = 0;
			const handleClick = (evt, direction) => {
				evt.stopPropagation();
				evt.preventDefault();

				// avoid going off the edge of the list
				if (ix === 0 && !~direction) return;
				if (ix === altArtMeta.length - 1 && ~direction) return;

				ix += direction;

				if (!~direction) { // left
					if (ix === 0) {
						$btnLeft.hide();
						$wrpFooter.hide();
					}
					$btnRight.show();
				} else {
					$btnLeft.show();
					$wrpFooter.show();
					if (ix === altArtMeta.length - 1) {
						$btnRight.hide();
					}
				}
				altArtMeta.filter(it => it.$ele).forEach(it => it.$ele.hide());

				const meta = altArtMeta[ix];
				meta.$ele.show();
				setTimeout(() => meta.$ele.css("max-width", ""), 10); // hack to clear the earlier 100% width

				if (meta.name && meta.source) $footer.html(`<div>${meta.displayName || meta.name}; <span title="${Parser.sourceJsonToFull(meta.source)}">${Parser.sourceJsonToAbv(meta.source)}${Renderer.utils.isDisplayPage(meta.page) ? ` p${meta.page}` : ""}</span></div>`);
				else $footer.html("");

				$wrpFooter.detach().appendTo(meta.$ele);
				$btnLeft.detach().appendTo(meta.$ele);
				$btnRight.detach().appendTo(meta.$ele);
			};

			// append footer first to be behind buttons
			const $footer = $(`<div class="mon__token-footer"/>`);
			const $wrpFooter = $$`<div class="mon__wrp-token-footer">${$footer}</div>`.hide().appendTo($lnkToken);

			const $btnLeft = $$`<div class="mon__btn-token-cycle mon__btn-token-cycle--left"><span class="glyphicon glyphicon-chevron-left"/></div>`
				.click(evt => handleClick(evt, -1)).appendTo($lnkToken)
				.hide();

			const $btnRight = $$`<div class="mon__btn-token-cycle mon__btn-token-cycle--right"><span class="glyphicon glyphicon-chevron-right"/></div>`
				.click(evt => handleClick(evt, 1)).appendTo($lnkToken);
		}
	}

	static _addSpacesToDiceExp (exp) {
		return exp.replace(/([^0-9d])/gi, " $1 ").replace(/\s+/g, " ").trim().replace(/^([-+])\s*/, "$1");
	}

	_renderStatblock_doBuildFluffTab (
		{
			isImageTab = false,
		} = {},
	) {
		const pGetFluffEntries = async () => {
			const mon = this._dataList[Hist.lastLoadedId];
			const fluff = await Renderer.monster.pGetFluff(mon);
			return fluff.entries || [];
		};

		const $headerControls = isImageTab ? null : (() => {
			const actions = [
				new ContextUtil.Action(
					"Copy as JSON",
					async () => {
						const fluffEntries = await pGetFluffEntries();
						MiscUtil.pCopyTextToClipboard(JSON.stringify(fluffEntries, null, "\t"));
						JqueryUtil.showCopiedEffect($btnOptions);
					},
				),
				new ContextUtil.Action(
					"Copy as Markdown",
					async () => {
						const fluffEntries = await pGetFluffEntries();
						const rendererMd = RendererMarkdown.get().setFirstSection(true);
						MiscUtil.pCopyTextToClipboard(fluffEntries.map(f => rendererMd.render(f)).join("\n"));
						JqueryUtil.showCopiedEffect($btnOptions);
					},
				),
			];
			const menu = ContextUtil.getMenu(actions);

			const $btnOptions = $(`<button class="btn btn-default btn-xs btn-stats-name"><span class="glyphicon glyphicon-option-vertical"/></button>`)
				.click(evt => ContextUtil.pOpenMenu(evt, menu));

			return $$`<div class="flex-v-center btn-group ml-2">${$btnOptions}</div>`;
		})();

		return Renderer.utils.pBuildFluffTab({
			isImageTab,
			$content: this._$pgContent,
			entity: this._dataList[Hist.lastLoadedId],
			pFnGetFluff: Renderer.monster.pGetFluff,
			$headerControls,
		});
	}

	_getSearchCache (entity) {
		const legGroup = DataUtil.monster.getMetaGroup(entity);
		if (!legGroup && this.constructor._INDEXABLE_PROPS.every(it => !entity[it])) return "";
		const ptrOut = {_: ""};
		this.constructor._INDEXABLE_PROPS.forEach(it => this._getSearchCache_handleEntryProp(entity, it, ptrOut));
		if (legGroup) BestiaryPage._INDEXABLE_PROPS_LEG_GROUP.forEach(it => this._getSearchCache_handleEntryProp(legGroup, it, ptrOut));
		return ptrOut._;
	}

	_getCurrentPinListCustomHashId () {
		return Renderer.monster.getCustomHashId(this._lastRendered.mon);
	}

	_onSublistChange () {
		this._$dispCrTotal = this._$dispCrTotal || $(`#totalcr`);
		const xp = EncounterBuilderUtils.calculateListEncounterXp(this._encounterBuilder.lastPartyMeta);
		const monCount = ListUtil.sublist.items.map(it => it.data.count).reduce((a, b) => a + b, 0);
		this._$dispCrTotal.html(`${monCount} creature${monCount === 1 ? "" : "s"}; ${xp.baseXp.toLocaleString()} XP (<span class="help" title="Adjusted Encounter XP">Enc</span>: ${(xp.adjustedXp).toLocaleString()} XP)`);
		if (this._encounterBuilder.isActive()) this._encounterBuilder.updateDifficulty();
		else this._encounterBuilder.doSaveState();
	}

	async pPreloadSublistSources (json) {
		if (json.l && json.l.items && json.l.sources) { // if it's an encounter file
			json.items = json.l.items;
			json.sources = json.l.sources;
		}
		const loaded = Object.keys(this._loadedSources)
			.filter(it => this._loadedSources[it].loaded);
		const lowerSources = json.sources.map(it => it.toLowerCase());
		const toLoad = Object.keys(this._loadedSources)
			.filter(it => !loaded.includes(it))
			.filter(it => lowerSources.includes(it.toLowerCase()));
		const loadTotal = toLoad.length;
		if (loadTotal) {
			await Promise.all(toLoad.map(src => this._pLoadSource(src, "yes")));
		}
	}

	async pHandleUnknownHash (link, sub) {
		const src = Object.keys(this._loadedSources)
			.find(src => src.toLowerCase() === (UrlUtil.decodeHash(link)[1] || "").toLowerCase());
		if (src) {
			await this._pLoadSource(src, "yes");
			Hist.hashChange();
		}
	}
}
BestiaryPage._INDEXABLE_PROPS = [
	"trait",
	"spellcasting",
	"action",
	"bonus",
	"reaction",
	"legendary",
	"mythic",
	"variant",
];
BestiaryPage._INDEXABLE_PROPS_LEG_GROUP = [
	"lairActions",
	"regionalEffects",
	"mythicEncounter",
];

class EncounterBuilderUtils {
	static getSublistedEncounter () {
		return ListUtil.sublist.items
			.map(it => {
				const mon = bestiaryPage.dataList_[it.ix];
				if (!mon.cr) return null;

				// (N.b.: we don't handle scaled summon creatures here, as they *shouldn't* have CRs.)
				const crScaled = it.data.customHashId
					? Number(Renderer.monster.getUnpackedCustomHashId(it.data.customHashId)._scaledCr)
					: null;
				return {
					cr: it.values.cr,
					crNumber: Parser.crToNumber(it.values.cr),
					count: Number(it.data.count),

					approxHp: it.data.approxHp,
					approxAc: it.data.approxAc,

					isLocked: it.data.isLocked,

					// used for encounter adjuster
					crScaled: crScaled,
					customHashId: it.data.customHashId,
					hash: UrlUtil.autoEncodeHash(mon),
					baseCreature: mon,
				};
			})
			.filter(it => it && it.crNumber < VeCt.CR_CUSTOM)
			.sort((a, b) => SortUtil.ascSort(b.crNumber, a.crNumber));
	}

	static calculateListEncounterXp (partyMeta) {
		return EncounterBuilderUtils.calculateEncounterXp(EncounterBuilderUtils.getSublistedEncounter(), partyMeta);
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
			// "Statistically significant" method--note that even with custom butchering of the terminology, this produces
			//   very passive filtering; the threshold is 0 in the vast majority of cases.
			case "statisticallySignificant": {
				let cutoff = 0;
				const cpy = MiscUtil.copy(crValues)
					.sort(SortUtil.ascSort);
				while (cpy.length > 1) {
					const avgRest = cpy.slice(1).mean();
					const deviationRest = cpy.slice(1).meanAbsoluteDeviation();

					// This should really be `(deviationRest * 2)`, as two deviations = "statistically significant", however
					//   using real maths produces awkward results for our tiny sample size.
					cutoff = avgRest - deviationRest;

					if (cpy[0] < cutoff) {
						cpy.shift();
					} else {
						break;
					}
				}

				return cutoff;
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
		// Make a default, generic-sized party of level 1 players
		if (partyMeta == null) partyMeta = new EncounterPartyMeta([{level: 1, count: ECGEN_BASE_PLAYERS}]);

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

const bestiaryPage = new BestiaryPage();
window.addEventListener("load", () => bestiaryPage.pOnLoad());

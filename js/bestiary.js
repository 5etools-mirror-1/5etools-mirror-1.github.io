"use strict";

window.PROF_MODE_BONUS = "bonus";
window.PROF_MODE_DICE = "dice";

class _BestiaryUtil {
	static getUrlSubhashes (mon, {isAddLeadingSep = true} = {}) {
		const subhashesRaw = [
			mon._isScaledCr ? `${UrlUtil.HASH_START_CREATURE_SCALED}${mon._scaledCr}` : null,
			mon._summonedBySpell_level ? `${UrlUtil.HASH_START_CREATURE_SCALED_SPELL_SUMMON}${mon._summonedBySpell_level}` : null,
			mon._summonedByClass_level ? `${UrlUtil.HASH_START_CREATURE_SCALED_CLASS_SUMMON}${mon._summonedByClass_level}` : null,
		].filter(Boolean);

		if (!subhashesRaw.length) return "";
		return `${isAddLeadingSep ? HASH_PART_SEP : ""}${subhashesRaw.join(HASH_PART_SEP)}`;
	}

	static getListDisplayType (mon) {
		let type = mon._pTypes.asTextShort.uppercaseFirst();
		if (mon._pTypes.asTextSidekick) type += `, ${mon._pTypes.asTextSidekick}`;
		return type;
	}
}

class BestiarySublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "submonsters",
			sublistListOptions: {
				fnSort: PageFilterBestiary.sortMonsters,
			},
			shiftCountAddSubtract: 5,
			isSublistItemsCountable: true,
		});

		this._$dispCrTotal = null;
		this._encounterBuilder = null;
	}

	set encounterBuilder (val) { this._encounterBuilder = val; }

	_getCustomHashId ({entity}) {
		return Renderer.monster.getCustomHashId(entity);
	}

	_getSerializedPinnedItemData (listItem) {
		return {l: listItem.data.isLocked ? listItem.data.isLocked : undefined};
	}

	_getDeserializedPinnedItemData (serialData) {
		return {isLocked: !!serialData.l};
	}

	_onSublistChange () {
		this._$dispCrTotal = this._$dispCrTotal || $(`#totalcr`);

		const xp = this._encounterBuilder.calculateListEncounterXp();
		const monCount = this.sublistItems.map(it => it.data.count).reduce((a, b) => a + b, 0);
		this._$dispCrTotal.html(`${monCount} creature${monCount === 1 ? "" : "s"}; ${xp.baseXp.toLocaleString()} XP (<span class="help" title="Adjusted Encounter XP">Enc</span>: ${(xp.adjustedXp).toLocaleString()} XP)`);
		if (this._encounterBuilder.isActive()) this._encounterBuilder.updateDifficulty();
	}

	_getSublistFullHash ({entity}) {
		return `${super._getSublistFullHash({entity})}${_BestiaryUtil.getUrlSubhashes(entity)}`;
	}

	async pGetSublistItem (mon, hash, {count = 1, customHashId = null, initialData} = {}) {
		const name = mon._displayName || mon.name;
		const type = _BestiaryUtil.getListDisplayType(mon);
		const cr = mon._pCr;
		const hashBase = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](mon);
		const isLocked = !!initialData?.isLocked; // If e.g. reloading from a save

		const $hovStatblock = $(`<span class="col-1-4 help help--hover ecgen__visible">Stat Block</span>`)
			.mouseover(evt => this._encounterBuilder.doStatblockMouseOver({
				evt,
				ele: $hovStatblock[0],
				source: mon.source,
				hash: hashBase,
				customHashId: this._getCustomHashId({entity: mon}),
			}))
			.mousemove(evt => Renderer.hover.handleLinkMouseMove(evt, $hovStatblock[0]))
			.mouseleave(evt => Renderer.hover.handleLinkMouseLeave(evt, $hovStatblock[0]));

		const hovTokenMeta = EncounterBuilder.getTokenHoverMeta(mon);
		const $hovToken = !hovTokenMeta ? $(`<span class="col-1-2 ecgen__visible"></span>`) : $(`<span class="col-1-2 ecgen__visible help help--hover">Token</span>`)
			.mouseover(evt => hovTokenMeta.mouseOver(evt, $hovToken[0]))
			.mousemove(evt => hovTokenMeta.mouseMove(evt, $hovToken[0]))
			.mouseleave(evt => hovTokenMeta.mouseLeave(evt, $hovToken[0]));

		const $hovImage = $(`<span class="col-1-2 ecgen__visible help help--hover">Image</span>`)
			.mouseover(evt => this._encounterBuilder.handleImageMouseOver(evt, $hovImage, mon));

		const $ptCr = (() => {
			if (!ScaleCreature.isCrInScaleRange(mon)) return $(`<span class="col-1-2 text-center">${cr}</span>`);

			const $iptCr = $(`<input value="${cr}" class="w-100 text-center form-control form-control--minimal input-xs">`)
				.click(() => $iptCr.select())
				.change(() => this._encounterBuilder.pDoCrChange($iptCr, mon, mon._scaledCr));

			return $$`<span class="col-1-2 text-center">${$iptCr}</span>`;
		})();

		const $eleCount1 = $(`<span class="col-2 text-center">${count}</span>`);
		const $eleCount2 = $(`<span class="col-2 pr-0 text-center">${count}</span>`);

		const listItem = new ListItem(
			hash,
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
				entity: mon,
				entityBase: await DataLoader.pCacheAndGetHash(
					UrlUtil.PG_BESTIARY,
					hashBase,
				),
			},
		);

		const sublistButtonsMeta = this._encounterBuilder.getSublistButtonsMeta(listItem);
		listItem.data.fnsUpdate.push(sublistButtonsMeta.fnUpdate);

		listItem.ele = $$`<div class="lst__row lst__row--sublist ve-flex-col lst__row--bestiary-sublist">
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
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
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

	_handleBestiaryLinkClickSub (evt, listItem) {
		if (this._encounterBuilder.isActive()) evt.preventDefault();
		else this._listSub.doSelect(listItem, evt);
	}
}

class BestiaryPage extends ListPageMultiSource {
	static async _prereleaseBrewDataSource ({brewUtil}) {
		const brew = await brewUtil.pGetBrewProcessed();
		DataUtil.monster.populateMetaReference(brew);
		return brew;
	}

	constructor () {
		const pFnGetFluff = Renderer.monster.pGetFluff.bind(Renderer.monster);

		super({
			pageFilter: new PageFilterBestiary(),

			listClass: "monsters",
			listOptions: {
				fnSort: PageFilterBestiary.sortMonsters,
			},

			dataProps: ["monster"],
			prereleaseDataSource: () => BestiaryPage._prereleaseBrewDataSource({brewUtil: PrereleaseUtil}),
			brewDataSource: () => BestiaryPage._prereleaseBrewDataSource({brewUtil: BrewUtil2}),

			pFnGetFluff,

			hasAudio: true,

			bookViewOptions: {
				$btnOpen: $(`#btn-printbook`),
				$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple creatures, please first make a list</span>`),
				pageTitle: "Bestiary Printer View",
			},

			tableViewOptions: {
				title: "Bestiary",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					size: {name: "Size", transform: size => Renderer.utils.getRenderedSize(size)},
					type: {name: "Type", transform: type => Parser.monTypeToFullObj(type).asText},
					alignment: {name: "Alignment", transform: align => Parser.alignmentListToFull(align)},
					ac: {name: "AC", transform: ac => Parser.acToFull(ac)},
					hp: {name: "HP", transform: hp => Renderer.monster.getRenderedHp(hp)},
					_speed: {name: "Speed", transform: mon => Parser.getSpeedString(mon)},
					...Parser.ABIL_ABVS.mergeMap(ab => ({[ab]: {name: Parser.attAbvToFull(ab)}})),
					_save: {name: "Saving Throws", transform: mon => Renderer.monster.getSavesPart(mon)},
					_skill: {name: "Skills", transform: mon => Renderer.monster.getSkillsString(Renderer.get(), mon)},
					vulnerable: {name: "Damage Vulnerabilities", transform: it => Parser.getFullImmRes(it)},
					resist: {name: "Damage Resistances", transform: it => Parser.getFullImmRes(it)},
					immune: {name: "Damage Immunities", transform: it => Parser.getFullImmRes(it)},
					conditionImmune: {name: "Condition Immunities", transform: it => Parser.getFullCondImm(it)},
					_senses: {name: "Senses", transform: mon => Renderer.monster.getSensesPart(mon)},
					languages: {name: "Languages", transform: it => Renderer.monster.getRenderedLanguages(it)},
					_cr: {name: "CR", transform: mon => Parser.monCrToFull(mon.cr, {isMythic: !!mon.mythic})},
					_trait: {
						name: "Traits",
						transform: mon => {
							const fnGetSpellTraits = Renderer.monster.getSpellcastingRenderedTraits.bind(Renderer.monster, Renderer.get());
							const allTraits = Renderer.monster.getOrderedTraits(mon, {fnGetSpellTraits});
							return (allTraits || []).map(it => it.rendered || Renderer.get().render(it, 2)).join("");
						},
						flex: 3,
					},
					_action: {
						name: "Actions",
						transform: mon => {
							const fnGetSpellTraits = Renderer.monster.getSpellcastingRenderedTraits.bind(Renderer.monster, Renderer.get());
							const allActions = Renderer.monster.getOrderedActions(mon, {fnGetSpellTraits});
							return (allActions || []).map(it => it.rendered || Renderer.get().render(it, 2)).join("");
						},
						flex: 3,
					},
					bonus: {name: "Bonus Actions", transform: it => (it || []).map(x => Renderer.get().render(x, 2)).join(""), flex: 3},
					reaction: {name: "Reactions", transform: it => (it || []).map(x => Renderer.get().render(x, 2)).join(""), flex: 3},
					legendary: {name: "Legendary Actions", transform: it => (it || []).map(x => Renderer.get().render(x, 2)).join(""), flex: 3},
					mythic: {name: "Mythic Actions", transform: it => (it || []).map(x => Renderer.get().render(x, 2)).join(""), flex: 3},
					_lairActions: {
						name: "Lair Actions",
						transform: mon => {
							const legGroup = DataUtil.monster.getMetaGroup(mon);
							if (!legGroup?.lairActions?.length) return "";
							return Renderer.get().render({entries: legGroup.lairActions});
						},
						flex: 3,
					},
					_regionalEffects: {
						name: "Regional Effects",
						transform: mon => {
							const legGroup = DataUtil.monster.getMetaGroup(mon);
							if (!legGroup?.regionalEffects?.length) return "";
							return Renderer.get().render({entries: legGroup.regionalEffects});
						},
						flex: 3,
					},
					environment: {name: "Environment", transform: it => Renderer.monster.getRenderedEnvironment(it)},
				},
			},

			isMarkdownPopout: true,
			propEntryData: "monster",

			propLoader: "monster",

			listSyntax: new ListSyntaxBestiary({fnGetDataList: () => this._dataList, pFnGetFluff}),
		});

		this._$wrpBtnProf = null;
		this._$btnProf = null;

		this._profDicMode = PROF_MODE_BONUS;

		this._encounterBuilder = null;

		this._$dispToken = null;
	}

	get _bindOtherButtonsOptions () {
		return {
			upload: {
				pFnPreLoad: (...args) => this.pPreloadSublistSources(...args),
			},
			sendToBrew: {
				mode: "creatureBuilder",
				fnGetMeta: () => ({
					page: UrlUtil.getCurrentPage(),
					source: Hist.getHashSource(),
					hash: `${UrlUtil.autoEncodeHash(this._lastRender.entity)}${_BestiaryUtil.getUrlSubhashes(this._lastRender.entity)}`,
				}),
			},
			other: [
				this._bindOtherButtonsOptions_openAsSinglePage({slugPage: "bestiary", fnGetHash: () => UrlUtil.autoEncodeHash(this._lastRender.entity)}),
			].filter(Boolean),
		};
	}

	set encounterBuilder (val) { this._encounterBuilder = val; }

	get list_ () { return this._list; }

	async _bookView_popTblGetNumShown ({$wrpContent, $dispName, $wrpControls}) {
		this._bookViewToShow = await this._sublistManager.getPinnedEntities();

		this._bookViewToShow.sort((a, b) => SortUtil.ascSort(a._displayName || a.name, b._displayName || b.name));

		let numShown = 0;

		const stack = [];

		const renderCreature = (mon) => {
			stack.push(`<div class="bkmv__wrp-item"><table class="w-100 stats stats--book stats--bkmv"><tbody>`);
			stack.push(Renderer.monster.getCompactRenderedString(mon));
			stack.push(`</tbody></table></div>`);
		};

		stack.push(`<div class="w-100 h-100">`);
		this._bookViewToShow.forEach(mon => renderCreature(mon));
		if (!this._bookViewToShow.length && Hist.lastLoadedId != null) {
			renderCreature(this._dataList[Hist.lastLoadedId]);
		}
		stack.push(`</div>`);

		numShown += this._bookViewToShow.length;
		$wrpContent.append(stack.join(""));

		// region Markdown
		// TODO refactor this and spell markdown section
		const pGetAsMarkdown = async () => {
			const toRender = this._bookViewToShow.length ? this._bookViewToShow : [this._dataList[Hist.lastLoadedId]];
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

		$$`<div class="ve-flex-v-center btn-group ml-2">
			${$btnDownloadMarkdown}
			${$btnCopyMarkdown}
			${$btnDownloadMarkdownSettings}
		</div>`.appendTo($wrpControls);
		// endregion

		return numShown;
	}

	getListItem (mon, mI) {
		const hash = UrlUtil.autoEncodeHash(mon);
		if (this._seenHashes.has(hash)) return null;
		this._seenHashes.add(hash);

		Renderer.monster.updateParsed(mon);
		const isExcluded = ExcludeUtil.isExcluded(hash, "monster", mon.source);

		this._pageFilter.mutateAndAddToFilters(mon, isExcluded);

		const source = Parser.sourceJsonToAbv(mon.source);
		const type = _BestiaryUtil.getListDisplayType(mon);
		const cr = mon._pCr;

		const eleLi = e_({
			tag: "div",
			clazz: `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`,
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
							style: Parser.sourceJsonToStylePart(mon.source),
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
				group: mon.group ? [mon.group].flat().join(",") : "",
				alias: (mon.alias || []).map(it => `"${it}"`).join(","),
				page: mon.page,
			},
			{
				isExcluded,
			},
		);

		return listItem;
	}

	handleFilterChange () {
		super.handleFilterChange();
		this._encounterBuilder.resetCache();
	}

	pDoLoadHash (id) {
		const mon = this._dataList[id];

		this._renderStatblock(mon);

		this.pDoLoadSubHash([]);
		this._updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._pageFilter.filterBox.setFromSubHashes(sub);
		await this._sublistManager.pSetFromSubHashes(sub, this.pPreloadSublistSources.bind(this));

		await this._bookView.pHandleSub(sub);

		const scaledHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED));
		const scaledSpellSummonHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED_SPELL_SUMMON));
		const scaledClassSummonHash = sub.find(it => it.startsWith(UrlUtil.HASH_START_CREATURE_SCALED_CLASS_SUMMON));
		const mon = this._dataList[Hist.lastLoadedId];

		if (scaledHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledHash)[VeCt.HASH_SCALED][0]);
			const scaleToStr = Parser.numberToCr(scaleTo);
			if (Parser.isValidCr(scaleToStr) && scaleTo !== Parser.crToNumber(this._lastRender.entity.cr)) {
				ScaleCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledCr: true}));
			}
		} else if (scaledSpellSummonHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledSpellSummonHash)[VeCt.HASH_SCALED_SPELL_SUMMON][0]);
			if (mon.summonedBySpellLevel != null && scaleTo >= mon.summonedBySpellLevel && scaleTo !== this._lastRender.entity._summonedBySpell_level) {
				ScaleSpellSummonedCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledSpellSummon: true}));
			}
		} else if (scaledClassSummonHash) {
			const scaleTo = Number(UrlUtil.unpackSubHash(scaledClassSummonHash)[VeCt.HASH_SCALED_CLASS_SUMMON][0]);
			if (mon.summonedByClass != null && scaleTo > 0 && scaleTo !== this._lastRender.entity._summonedByClass_level) {
				ScaleClassSummonedCreature.scale(mon, scaleTo)
					.then(monScaled => this._renderStatblock(monScaled, {isScaledClassSummon: true}));
			}
		}

		this._encounterBuilder.handleSubhash(sub);
	}

	async _pOnLoad_pPreDataLoad () {
		this._encounterBuilder.initUi();
		await DataUtil.monster.pPreloadMeta();
		this._bindProfDiceHandlers();
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

	_handleBestiaryLiClick (evt, listItem) {
		if (this._encounterBuilder.isActive()) Renderer.hover.doPopoutCurPage(evt, this._dataList[listItem.ix]);
		else this._list.doSelect(listItem, evt);
	}

	_handleBestiaryLiContext (evt, listItem) {
		this._openContextMenu(evt, this._list, listItem);
	}

	_handleBestiaryLinkClick (evt) {
		if (this._encounterBuilder.isActive()) evt.preventDefault();
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
		this._lastRender.entity = mon;
		this._lastRender.isScaledCr = isScaledCr;
		this._lastRender.isScaledSpellSummon = isScaledSpellSummon;
		this._lastRender.isScaledClassSummon = isScaledClassSummon;

		this._$wrpBtnProf = this._$wrpBtnProf || $(`#wrp-profbonusdice`);
		this._$dispToken = this._$dispToken || $(`#float-token`);

		this._$pgContent.empty();

		if (this._$btnProf != null) {
			this._$wrpBtnProf.append(this._$btnProf);
			this._$btnProf = null;
		}

		const tabMetaStats = new Renderer.utils.TabButton({
			label: "Stat Block",
			fnChange: () => {
				this._$wrpBtnProf.append(this._$btnProf);
				this._$dispToken.showVe();
			},
			fnPopulate: () => this._renderStatblock_doBuildStatsTab({mon, isScaledCr, isScaledSpellSummon, isScaledClassSummon}),
			isVisible: true,
		});

		Renderer.utils.bindTabButtons({
			tabButtons: [tabMetaStats],
			tabLabelReference: [tabMetaStats].map(it => it.label),
			$wrpTabs: this._$wrpTabs,
			$pgContent: this._$pgContent,
		});

		Promise.all([
			Renderer.utils.pHasFluffText(mon, "monsterFluff"),
			Renderer.utils.pHasFluffImages(mon, "monsterFluff"),
		])
			.then(([hasFluffText, hasFluffImages]) => {
				if (!hasFluffText && !hasFluffImages) return;

				if (this._lastRender.entity !== mon) return;

				const tabMetas = [
					tabMetaStats,
					new Renderer.utils.TabButton({
						label: "Info",
						fnChange: () => {
							this._$btnProf = this._$wrpBtnProf.children().length ? this._$wrpBtnProf.children().detach() : this._$btnProf;
							this._$dispToken.hideVe();
						},
						fnPopulate: () => this._renderStats_doBuildFluffTab({ent: mon}),
						isVisible: hasFluffText,
					}),
					new Renderer.utils.TabButton({
						label: "Images",
						fnChange: () => {
							this._$btnProf = this._$wrpBtnProf.children().length ? this._$wrpBtnProf.children().detach() : this._$btnProf;
							this._$dispToken.hideVe();
						},
						fnPopulate: () => this._renderStats_doBuildFluffTab({ent: mon, isImageTab: true}),
						isVisible: hasFluffImages,
					}),
				];

				Renderer.utils.bindTabButtons({
					tabButtons: tabMetas.filter(it => it.isVisible),
					tabLabelReference: tabMetas.map(it => it.label),
					$wrpTabs: this._$wrpTabs,
					$pgContent: this._$pgContent,
				});
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
		Renderer.get().setFirstSection(true);

		const $btnScaleCr = !ScaleCreature.isCrInScaleRange(mon) ? null : $(`<button id="btn-scale-cr" title="Scale Creature By CR (Highly Experimental)" class="mon__btn-scale-cr btn btn-xs btn-default ve-popwindow__hidden"><span class="glyphicon glyphicon-signal"></span></button>`)
			.click((evt) => {
				evt.stopPropagation();
				const win = (evt.view || {}).window;
				const mon = this._dataList[Hist.lastLoadedId];
				const lastCr = this._lastRender.entity ? this._lastRender.entity.cr.cr || this._lastRender.entity.cr : mon.cr.cr || mon.cr;
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

		const $btnResetScaleCr = !ScaleCreature.isCrInScaleRange(mon) ? null : $(`<button id="btn-reset-cr" title="Reset CR Scaling" class="mon__btn-reset-cr btn btn-xs btn-default ve-popwindow__hidden"><span class="glyphicon glyphicon-refresh"></span></button>`)
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

			this._$pgContent.empty().append(RenderBestiary.$getRenderedCreature(mon, {$btnScaleCr, $btnResetScaleCr, selSummonSpellLevel, selSummonClassLevel}));
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

		const $floatToken = this._$dispToken.empty();

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

				if (meta.name && meta.source) $footer.html(Renderer.monster.getRenderedAltArtEntry(meta));
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

	_pOnLoad_initVisibleItemsDisplay (...args) {
		super._pOnLoad_initVisibleItemsDisplay(...arguments);

		this._list.on("updated", () => {
			this._encounterBuilder.resetCache();
		});
	}
}

const bestiaryPage = new BestiaryPage();
const encounterBuilder = new EncounterBuilder();
const sublistManager = new BestiarySublistManager();

bestiaryPage.encounterBuilder = encounterBuilder;
bestiaryPage.sublistManager = sublistManager;
encounterBuilder.bestiaryPage = bestiaryPage;
encounterBuilder.sublistManager = sublistManager;
sublistManager.encounterBuilder = encounterBuilder;

window.addEventListener("load", () => bestiaryPage.pOnLoad());

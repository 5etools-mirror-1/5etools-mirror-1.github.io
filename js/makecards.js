"use strict";

class MakeCards extends BaseComponent {
	static async pInit () {
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		await ExcludeUtil.pInitialise();

		MakeCards._ = new MakeCards();
		await MakeCards.utils.pLoadReducedData();
		await MakeCards._.pInit();

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	constructor () {
		super();

		this._list = null;

		this._modalFilterItems = new ModalFilterItems({namespace: "makecards.items"});
		this._modalFilterBestiary = new ModalFilterBestiary({namespace: "makecards.bestiary"});
		this._modalFilterSpells = new ModalFilterSpells({namespace: "makecards.spells"});
		this._modalFilterRaces = new ModalFilterRaces({namespace: "makecards.race"});
		this._modalFilterBackgrounds = new ModalFilterBackgrounds({namespace: "makecards.background"});
		this._modalFilterFeats = new ModalFilterFeats({namespace: "makecards.feat"});
		this._modalFilterOptionalFeatures = new ModalFilterOptionalFeatures({namespace: "makecards.optionalfeatures"});

		this._doSaveStateDebounced = MiscUtil.debounce(() => this._pDoSaveState(), 50);
	}

	async pInit () {
		await SearchUiUtil.pDoGlobalInit();
		// Do this asynchronously, to avoid blocking the load
		SearchWidget.pDoGlobalInit();
		await this._pDoLoadState();
		this.render();
	}

	render () {
		this._addHookAll("state", () => this._doSaveStateDebounced());

		this._render_configSection();
		this._render_cardList();
	}

	_render_configSection () {
		const $wrpConfig = $(`#wrp_config`).empty();

		const $btnResetDefaults = $(`<button class="btn btn-default btn-xs">Reset</button>`)
			.click(() => {
				Object.entries(MakeCards._AVAILABLE_TYPES)
					.forEach(([entityType, typeMeta]) => {
						const kColor = `color_${entityType}`;
						const kIcon = `icon_${entityType}`;

						this._state[kColor] = typeMeta.colorDefault;
						this._state[kIcon] = typeMeta.iconDefault;
					});
			});

		$$($wrpConfig)`<h5 class="split-v-center"><div>New Card Defaults</div>${$btnResetDefaults}</h5>
		<div class="ve-flex-v-center bold">
			<div class="col-4 text-center pr-2">Type</div>
			<div class="col-4 text-center p-2">Color</div>
			<div class="col-4 text-center pl-2">Icon</div>
		</div>`;

		const $getColorIconConfigRow = (entityType) => {
			const entityMeta = MakeCards._AVAILABLE_TYPES[entityType];

			const kColor = `color_${entityType}`;
			const kIcon = `icon_${entityType}`;
			const $iptColor = ComponentUiUtil.$getIptColor(this, kColor).addClass("cards-cfg__ipt-color");
			const $dispIcon = $(`<div class="cards__disp-btn-icon"/>`);
			const $btnChooseIcon = $$`<button class="btn btn-xs btn-default cards__btn-choose-icon">${$dispIcon}</button>`
				.click(async () => {
					const icon = await MakeCards._pGetUserIcon(this._state[kIcon]);
					if (icon) this._state[kIcon] = icon;
				});
			const hkIcon = () => $dispIcon.css("background-image", `url('${MakeCards._getIconPath(this._state[kIcon])}')`);
			this._addHookBase(kIcon, hkIcon);
			hkIcon();

			return $$`<div class="ve-flex-v-center stripe-even m-1">
				<div class="col-4 ve-flex-vh-center pr-2">${entityMeta.searchTitle}</div>
				<div class="col-4 ve-flex-vh-center p-2">${$iptColor}</div>
				<div class="col-4 ve-flex-vh-center pl-2">${$btnChooseIcon}</div>
			</div>`;
		};

		Object.keys(MakeCards._AVAILABLE_TYPES).forEach(it => $getColorIconConfigRow(it).appendTo($wrpConfig));
	}

	_render_cardList () {
		const $wrpContainer = $(`#wrp_main`).empty();

		// region Search bar/add button
		const menuSearch = ContextUtil.getMenu(this._render_getContextMenuOptions());

		const $iptSearch = $(`<input type="search" class="form-control mr-2" placeholder="Search cards...">`);
		const $btnAdd = $(`<button class="btn btn-primary mr-2"><span class="glyphicon glyphicon-plus"/> Add</button>`)
			.click(evt => ContextUtil.pOpenMenu(evt, menuSearch));
		const $btnReset = $(`<button class="btn btn-danger mr-2"><span class="glyphicon glyphicon-trash"/> Reset</button>`)
			.click(() => {
				if (!confirm("Are you sure?")) return;
				this._list.removeAllItems();
				this._list.update();
				this._doSaveStateDebounced();
			});
		const $btnExport = $(`<button class="btn btn-default"><span class="glyphicon glyphicon-download"/> Export JSON</button>`)
			.click(() => {
				const toDownload = this._list.items.map(it => {
					const entityMeta = MakeCards._AVAILABLE_TYPES[it.values.entityType];
					return {
						count: it.values.count,
						color: it.values.color,
						title: it.name,
						icon: it.values.icon,
						icon_back: it.values.icon,
						contents: entityMeta.fnGetContents(it.values.entity),
						tags: entityMeta.fnGetTags(it.values.entity),
					};
				});
				DataUtil.userDownload("rpg-cards", toDownload, {isSkipAdditionalMetadata: true});
			});
		$$`<div class="w-100 no-shrink ve-flex-v-center mb-3">${$iptSearch}${$btnAdd}${$btnReset}${$btnExport}</div>`.appendTo($wrpContainer);
		// endregion

		// region Mass operations bar
		const getSelCards = () => {
			const out = this._list.visibleItems.filter(it => it.data.$cbSel.prop("checked"));
			if (!out.length) {
				JqueryUtil.doToast({content: "Please select some cards first!", type: "warning"});
				return null;
			}
			return out;
		};

		const menuMass = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Set Color",
				async () => {
					const sel = getSelCards();
					if (!sel) return;
					const rgb = await InputUiUtil.pGetUserColor({default: MiscUtil.randomColor()});
					if (rgb) sel.forEach(it => it.data.setColor(rgb));
				},
			),
			new ContextUtil.Action(
				"Set Icon",
				async () => {
					const sel = getSelCards();
					if (!sel) return;
					const icon = await MakeCards._pGetUserIcon();
					if (icon) sel.forEach(it => it.data.setIcon(icon));
				},
			),
			new ContextUtil.Action(
				"Remove",
				async () => {
					const sel = getSelCards();
					if (!sel) return;
					sel.forEach(it => this._list.removeItemByIndex(it.ix));
					this._list.update();
					this._doSaveStateDebounced();
				},
			),
		]);

		const $btnMass = $(`<button class="btn btn-xs btn-default" title="Carry out actions on selected cards">Mass...</button>`)
			.click(evt => ContextUtil.pOpenMenu(evt, menuMass));
		$$`<div class="w-100 no-shrink ve-flex-v-center mb-2">${$btnMass}</div>`.appendTo($wrpContainer);
		// endregion

		// region Main content
		// Headers
		const $cbSelAll = $(`<input type="checkbox" title="Select All">`)
			.click(() => {
				const isSel = $cbSelAll.prop("checked");
				this._list.visibleItems.forEach(it => it.data.$cbSel.prop("checked", isSel));
			});
		$$`<div class="w-100 no-shrink ve-flex-v-center bold">
			<div class="col-1 mr-2 ve-flex-vh-center">${$cbSelAll}</div>
			<div class="col-3 mr-2 ve-flex-vh-center">Name</div>
			<div class="col-1-5 mr-2 ve-flex-vh-center">Source</div>
			<div class="col-1-5 mr-2 ve-flex-vh-center">Type</div>
			<div class="col-1-1 mr-2 ve-flex-vh-center">Color</div>
			<div class="col-1-1 mr-2 ve-flex-vh-center">Icon</div>
			<div class="col-1 mr-2 ve-flex-vh-center">Count</div>
			<div class="col-1-1 ve-flex-v-center ve-flex-h-right"/>
		</div>`.appendTo($wrpContainer);

		const $wrpList = $(`<div class="w-100 h-100"/>`);
		$$`<div class="ve-flex-col h-100 w-100 overflow-y-auto mt-2 overflow-x-hidden">${$wrpList}</div>`.appendTo($wrpContainer);

		this._list = new List({$iptSearch, $wrpList, isUseJquery: true});
		this._list.init();
		// endregion
	}

	_render_getContextMenuOptions () {
		return [
			...this._render_getContextMenuOptionsSearch(),
			null,
			...this._render_getContextMenuOptionsFilter(),
			null,
			...this._render_getContextMenuOptionsSublist(),
		];
	}

	_render_getContextMenuOptionsSearch () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, it]) => new ContextUtil.Action(
			`Search for ${it.searchTitle}`,
			async () => {
				const fromSearch = await it.pFnSearch();
				if (!fromSearch) return;

				const existing = this._list.items.find(it => it.values.page === fromSearch.page && it.values.source === fromSearch.source && it.values.hash === fromSearch.hash);
				if (existing) {
					existing.values.count++;
					existing.data.$iptCount.val(existing.values.count);
					return this._doSaveStateDebounced();
				}

				const listItem = await this._pGetListItem({page: fromSearch.page, source: fromSearch.source, hash: fromSearch.hash, entityType}, true);
				this._list.addItem(listItem);
				this._list.update();
				this._doSaveStateDebounced();
			},
		));
	}

	_render_getContextMenuOptionsFilter () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, type]) => new ContextUtil.Action(
			`Filter for ${type.searchTitle}`,
			async () => {
				const modalFilter = (() => {
					switch (entityType) {
						case "creature": return this._modalFilterBestiary;
						case "item": return this._modalFilterItems;
						case "spell": return this._modalFilterSpells;
						case "race": return this._modalFilterRaces;
						case "background": return this._modalFilterBackgrounds;
						case "feat": return this._modalFilterFeats;
						case "optionalfeature": return this._modalFilterOptionalFeatures;
						default: throw new Error(`Unhandled branch!`);
					}
				})();
				const selected = await modalFilter.pGetUserSelection();
				if (selected == null || !selected.length) return;

				// do this in serial to avoid bombarding the hover cache
				const len = selected.length;
				for (let i = 0; i < len; ++i) {
					const filterListItem = selected[i];
					const listItem = await this._pGetListItem({page: type.page, source: filterListItem.values.sourceJson, hash: filterListItem.values.hash, entityType}, true);
					this._list.addItem(listItem);
				}
				this._list.update();
				this._doSaveStateDebounced();
			},
		));
	}

	_render_getContextMenuOptionsSublist () {
		return Object.entries(MakeCards._AVAILABLE_TYPES).map(([entityType, type]) => new ContextUtil.Action(
			`Load from ${type.pageTitle}${type.isPageTitleSkipSuffix ? "" : " Page"} Pinned List`,
			async () => {
				const storageKey = StorageUtil.getPageKey("sublist", type.page);
				const pinnedList = await StorageUtil.pGet(storageKey);

				if (!(pinnedList && pinnedList.items && pinnedList.items.length)) {
					return JqueryUtil.doToast({content: "Nothing to add! Please visit the page and add/pin some data first.", type: "warning"});
				}

				const listItems = await Promise.all(pinnedList.items.map(it => {
					const [_, source] = it.h.split(HASH_PART_SEP)[0].split(HASH_LIST_SEP);
					return this._pGetListItem({page: type.page, source, hash: it.h, entityType}, true);
				}));

				listItems.forEach(it => this._list.addItem(it));
				this._list.update();
				this._doSaveStateDebounced();
			},
		));
	}

	_getStateForType (entityType) {
		const kColor = `color_${entityType}`;
		const kIcon = `icon_${entityType}`;
		const color = this._state[kColor];
		const icon = this._state[kIcon];
		return {color, icon};
	}

	async _pGetListItem (cardMeta, isNewCard) {
		const uid = CryptUtil.uid();

		if (isNewCard) {
			const {color, icon} = this._getStateForType(cardMeta.entityType);
			cardMeta.color = cardMeta.color || color;
			cardMeta.icon = cardMeta.icon || icon;
		}
		cardMeta.count = cardMeta.count || 1;

		const loaded = await DataLoader.pCacheAndGet(cardMeta.page, cardMeta.source, cardMeta.hash);

		const $cbSel = $(`<input type="checkbox">`);

		const $iptRgb = $(`<input type="color" class="form-control input-xs form-control--minimal">`)
			.val(cardMeta.color)
			.change(() => setColor($iptRgb.val()));
		const setColor = (rgb) => {
			$iptRgb.val(rgb);
			listItem.values.color = rgb;
			this._doSaveStateDebounced();
		};

		const $dispIcon = $(`<div class="cards__disp-btn-icon"/>`)
			.css("background-image", `url('${MakeCards._getIconPath(cardMeta.icon)}')`);
		const $btnIcon = $$`<button class="btn btn-default btn-xs cards__btn-choose-icon">${$dispIcon}</button>`
			.click(async () => {
				const icon = await MakeCards._pGetUserIcon();
				if (icon) setIcon(icon);
			});
		const setIcon = (icon) => {
			listItem.values.icon = icon;
			$dispIcon.css("background-image", `url('${MakeCards._getIconPath(icon)}')`);
			this._doSaveStateDebounced();
		};

		const $iptCount = $(`<input class="form-control form-control--minimal input-xs text-center">`)
			.change(() => {
				const asNum = UiUtil.strToInt($iptCount.val(), 1, {min: 1, fallbackOnNaN: 1});
				listItem.values.count = asNum;
				$iptCount.val(asNum);
				this._doSaveStateDebounced();
			})
			.val(cardMeta.count);

		const $btnCopy = $(`<button class="btn btn-default btn-xs mr-2" title="Copy JSON (SHIFT to view JSON)"><span class="glyphicon glyphicon-copy"/></button>`)
			.click(async evt => {
				const entityMeta = MakeCards._AVAILABLE_TYPES[listItem.values.entityType];
				const toCopy = {
					count: listItem.values.count,
					color: listItem.values.color,
					title: listItem.name,
					icon: listItem.values.icon,
					icon_back: listItem.values.icon,
					contents: entityMeta.fnGetContents(listItem.values.entity),
					tags: entityMeta.fnGetTags(listItem.values.entity),
				};

				if (evt.shiftKey) {
					const $content = Renderer.hover.$getHoverContent_statsCode(toCopy);

					Renderer.hover.getShowWindow(
						$content,
						Renderer.hover.getWindowPositionFromEvent(evt),
						{
							title: `Card Data \u2014 ${listItem.name}`,
							isPermanent: true,
							isBookContent: true,
						},
					);
				} else {
					await MiscUtil.pCopyTextToClipboard(JSON.stringify(toCopy, null, 2));
					JqueryUtil.showCopiedEffect($btnCopy, "Copied JSON!");
				}
			});
		const $btnDelete = $(`<button class="btn btn-danger btn-xs" title="Remove"><span class="glyphicon glyphicon-trash"/></button>`)
			.click(() => {
				this._list.removeItemByIndex(uid);
				this._list.update();
				this._doSaveStateDebounced();
			});

		const $ele = $$`<label class="ve-flex-v-center my-1 w-100 lst__row lst--border lst__row-inner">
			<div class="col-1 mr-2 ve-flex-vh-center">${$cbSel}</div>
			<div class="col-3 mr-2 ve-flex-v-center">${loaded.name}</div>
			<div class="col-1-5 mr-2 ve-flex-vh-center ${Parser.sourceJsonToColor(loaded.source)}" title="${Parser.sourceJsonToFull(loaded.source)}" ${Parser.sourceJsonToStyle(loaded.source)}>${Parser.sourceJsonToAbv(loaded.source)}</div>
			<div class="col-1-5 mr-2 ve-flex-vh-center">${Parser.getPropDisplayName(cardMeta.entityType)}</div>
			<div class="col-1-1 mr-2 ve-flex-vh-center">${$iptRgb}</div>
			<div class="col-1-1 mr-2 ve-flex-vh-center">${$btnIcon}</div>
			<div class="col-1 mr-2 ve-flex-vh-center">${$iptCount}</div>
			<div class="col-1-1 ve-flex-v-center ve-flex-h-right">${$btnCopy}${$btnDelete}</div>
		</label>`;

		const listItem = new ListItem(
			uid,
			$ele,
			loaded.name,
			{
				page: cardMeta.page,
				hash: cardMeta.hash,
				source: cardMeta.source,
				color: cardMeta.color,
				icon: cardMeta.icon,
				count: cardMeta.count,
				entityType: cardMeta.entityType,

				entity: loaded,
			},
			{
				$cbSel,
				$iptCount,
				setColor,
				setIcon,
			},
		);
		return listItem;
	}

	// region contents
	static _ct_subtitle (val) { return `subtitle | ${val}`; }
	static _ct_rule () { return `rule`; }
	static _ct_property (title, val) { return `property | ${title} | ${val}`; }
	static _ct_fill (size) { return `fill ${size}`; }
	static _ct_text (val) { return `text | ${val}`; }
	static _ct_section (val) { return `section | ${val}`; }
	static _ct_description (title, val) { return `description | ${title} | ${val}`; }
	static _ct_bullet (val) { return `bullet | ${val}`; }
	static _ct_boxes (count, size = 1.2) { return `boxes | ${count} | ${size}`; }
	static _ct_dndstats (...attrs) { return `dndstats | ${attrs.join(" | ")}`; }

	static _ct_htmlToText (html) {
		return $(`<div>${html}</div>`).text().trim();
	}
	static _ct_renderEntries (entries, depth = 0) {
		if (!entries || !entries.length) return [];

		return entries.map(ent => {
			const rendSub = ent.rendered || RendererCard.get().render(ent, depth);
			return rendSub.split("\n").filter(Boolean);
		}).flat();
	}

	static _getCardContents_creature (mon) {
		const renderer = RendererCard.get();
		const fnGetSpellTraits = Renderer.monster.getSpellcastingRenderedTraits.bind(Renderer.monster, renderer);
		const allTraits = Renderer.monster.getOrderedTraits(mon, {fnGetSpellTraits});
		const allActions = Renderer.monster.getOrderedActions(mon, {fnGetSpellTraits});

		return [
			this._ct_subtitle(Renderer.monster.getTypeAlignmentPart(mon)),
			this._ct_rule(),
			this._ct_property("Armor class", this._ct_htmlToText(Parser.acToFull(mon.ac))),
			this._ct_property("Hit points", this._ct_htmlToText(Renderer.monster.getRenderedHp(mon.hp))),
			...(mon.resource || []).map(res => this._ct_property(res.name, this._ct_htmlToText(Renderer.monster.getRenderedResource(res)))),
			this._ct_property("Speed", this._ct_htmlToText(Parser.getSpeedString(mon))),
			this._ct_rule(),
			this._ct_dndstats(...Parser.ABIL_ABVS.map(it => mon[it])),
			this._ct_rule(),
			mon.save ? this._ct_property("Saving Throws", this._ct_htmlToText(Renderer.monster.getSavesPart(mon))) : null,
			mon.skill ? this._ct_property("Skills", this._ct_htmlToText(Renderer.monster.getSkillsString(Renderer.get(), mon))) : null,
			mon.vulnerable ? this._ct_property("Damage Vulnerabilities", this._ct_htmlToText(Parser.getFullImmRes(mon.vulnerable))) : null,
			mon.resist ? this._ct_property("Damage Resistances", this._ct_htmlToText(Parser.getFullImmRes(mon.resist))) : null,
			mon.immune ? this._ct_property("Damage Immunities", this._ct_htmlToText(Parser.getFullImmRes(mon.immune))) : null,
			mon.conditionImmune ? this._ct_property("Condition Immunities", this._ct_htmlToText(Parser.getFullCondImm(mon.conditionImmune))) : null,
			this._ct_property("Senses", this._ct_htmlToText(Renderer.monster.getSensesPart(mon))),
			this._ct_property("Languages", this._ct_htmlToText(Renderer.monster.getRenderedLanguages(mon.languages))),
			this._ct_property("Challenge", this._ct_htmlToText(Parser.monCrToFull(mon.cr, {isMythic: !!mon.mythic}))),
			this._ct_rule(),
			...(allTraits ? this._ct_renderEntries(allTraits, 2) : []),
			allActions ? this._ct_section("Actions") : null,
			...(allActions ? this._ct_renderEntries(allActions, 2) : []),
			mon.bonus ? this._ct_section("Bonus Actions") : null,
			...(mon.bonus ? this._ct_renderEntries(mon.bonus, 2) : []),
			mon.reaction ? this._ct_section("Reactions") : null,
			...(mon.reaction ? this._ct_renderEntries(mon.reaction, 2) : []),
			mon.legendary ? this._ct_section("Legendary Actions") : null,
			mon.legendary ? this._ct_text(this._ct_htmlToText(Renderer.monster.getLegendaryActionIntro(mon, {renderer}))) : null,
			...(mon.legendary ? this._ct_renderEntries(mon.legendary, 2) : []),
			mon.mythic ? this._ct_section("Mythic Actions") : null,
			mon.mythic ? this._ct_text(this._ct_htmlToText(Renderer.monster.getSectionIntro(mon, {renderer, prop: "mythic"}))) : null,
			...(mon.mythic ? this._ct_renderEntries(mon.mythic, 2) : []),
		].filter(Boolean);
	}

	static _getCardContents_spell (sp) {
		const higherLevel = sp.entriesHigherLevel ? (() => {
			const ents = sp.entriesHigherLevel.length === 1 && sp.entriesHigherLevel[0].name && sp.entriesHigherLevel[0].name.toLowerCase() === "at higher levels"
				? sp.entriesHigherLevel[0].entries
				: sp.entriesHigherLevel;

			return [
				this._ct_section("At higher levels"),
				...this._ct_renderEntries(ents, 2),
			];
		})() : null;

		return [
			this._ct_subtitle(Parser.spLevelSchoolMetaToFull(sp.level, sp.school, sp.meta, sp.subschools)),
			this._ct_rule(),
			this._ct_property("Casting Time", Parser.spTimeListToFull(sp.time)),
			this._ct_property("Range", Parser.spRangeToFull(sp.range)),
			this._ct_property("Components", Parser.spComponentsToFull(sp.components, sp.level, {isPlainText: true})),
			this._ct_property("Duration", Parser.spDurationToFull(sp.duration)),
			this._ct_rule(),
			...this._ct_renderEntries(sp.entries, 2),
			...(higherLevel || []),
		].filter(Boolean);
	}

	static _getCardContents_item (item) {
		MakeCards.utils.enhanceItemAlt(item);

		const [typeRarityText, subTypeText, tierText] = Renderer.item.getTypeRarityAndAttunementText(item);
		const [damage, damageType, propertiesTxt] = Renderer.item.getDamageAndPropertiesText(item);
		const ptWeight = Parser.itemWeightToFull(item);
		const ptValue = Parser.itemValueToFullMultiCurrency(item);
		const ptDamage = this._ct_htmlToText([damage, damageType].filter(Boolean).join(" "));
		const ptProperties = this._ct_htmlToText([propertiesTxt].filter(Boolean)).substring(2);

		const itemEntries = [];
		if (item._fullEntries || (item.entries && item.entries.length)) {
			itemEntries.push(...(item._fullEntries || item.entries));
		}

		if (item._fullAdditionalEntries || item.additionalEntries) {
			itemEntries.push(...(item._fullAdditionalEntries || item.additionalEntries));
		}

		return [
			typeRarityText ? this._ct_htmlToText(this._ct_subtitle(typeRarityText.uppercaseFirst())) : null,
			ptDamage ? this._ct_property(ptDamage.startsWith("AC") ? "Armor Class" : "Damage", ptDamage) : null,
			ptProperties ? this._ct_property("Properties", ptProperties.uppercaseFirst()) : null,
			subTypeText ? this._ct_property("Type", subTypeText.uppercaseFirst()) : null,
			tierText ? this._ct_property("Tier", tierText.uppercaseFirst()) : null,
			ptWeight ? this._ct_property("Weight", ptWeight) : null,
			ptValue ? this._ct_property("Value", ptValue) : null,
			itemEntries.length ? this._ct_rule() : null,
			...this._ct_renderEntries(itemEntries, 2),
			item.charges ? this._ct_boxes(item.charges) : null,
		].filter(Boolean);
	}

	static _getCardContents_race (race) {
		return [
			this._ct_property("Ability Scores", Renderer.getAbilityData(race.ability).asText),
			this._ct_property("Size", (race.size || [Parser.SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")),
			this._ct_property("Speed", Parser.getSpeedString(race)),
			this._ct_rule(),
			...this._ct_renderEntries(race.entries, 2),
		].filter(Boolean);
	}

	static _getCardContents_background (bg) {
		return [
			...this._ct_renderEntries(bg.entries, 2),
		].filter(Boolean);
	}

	static _getCardContents_feat (feat) {
		const prerequisite = Renderer.utils.prerequisite.getHtml(feat.prerequisite, {isListMode: true});
		const ptRepeatable = Renderer.utils.getRepeatableHtml(feat, {isListMode: true});
		Renderer.feat.initFullEntries(feat);
		return [
			(prerequisite && prerequisite !== "\u2014") ? this._ct_property("Prerequisites", prerequisite) : null,
			(ptRepeatable && ptRepeatable !== "\u2014") ? this._ct_property("Repeatable", ptRepeatable) : null,
			(prerequisite || ptRepeatable) ? this._ct_rule() : null,
			...this._ct_renderEntries(feat._fullEntries || feat.entries, 2),
		].filter(Boolean);
	}

	static _getCardContents_optionalfeature (optfeat) {
		const prerequisite = Renderer.utils.prerequisite.getHtml(optfeat.prerequisite, {isListMode: true});
		Renderer.feat.initFullEntries(optfeat);
		return [
			prerequisite ? this._ct_property("Prerequisites", prerequisite) : null,
			prerequisite ? this._ct_rule() : null,
			...this._ct_renderEntries(optfeat._fullEntries || optfeat.entries, 2),
		].filter(Boolean);
	}
	// endregion

	static _getIconPath (iconName) {
		const classIconNames = [
			"class-barbarian",
			"class-bard",
			"class-cleric",
			"class-druid",
			"class-fighter",
			"class-monk",
			"class-paladin",
			"class-ranger",
			"class-rogue",
			"class-sorcerer",
			"class-warlock",
			"class-wizard",
			"class-barbarian",
			"class-bard",
			"class-cleric",
			"class-druid",
			"class-fighter",
			"class-monk",
			"class-paladin",
			"class-ranger",
			"class-rogue",
			"class-sorcerer",
			"class-warlock",
			"class-wizard",
		];

		if (classIconNames.includes(iconName)) {
			return `https://rpg-cards.vercel.app/icons/${iconName}.png`;
		}
		return `https://rpg-cards.vercel.app/icons/${iconName}.svg`;
	}

	static _pGetUserIcon (initialVal) {
		return new Promise(resolve => {
			const $iptStr = $(`<input class="form-control mb-2">`)
				.keydown(async evt => {
					// prevent double-binding the return key if we have autocomplete enabled
					await MiscUtil.pDelay(17); // arbitrary delay to allow dropdown to render (~1000/60, i.e. 1 60 FPS frame)
					if ($modalInner.find(`.typeahead.dropdown-menu`).is(":visible")) return;
					// return key
					if (evt.which === 13) doClose(true);
					evt.stopPropagation();
				});

			if (initialVal) $iptStr.val(initialVal);

			$iptStr.typeahead({
				source: icon_names,
				items: "16",
				fnGetItemPrefix: (iconName) => {
					return `<span class="cards__disp-typeahead-icon mr-2" style="background-image: url('${MakeCards._getIconPath(iconName)}')"/> `;
				},
			});

			const $btnOk = $(`<button class="btn btn-default">Confirm</button>`)
				.click(() => doClose(true));
			const {$modalInner, doClose} = UiUtil.getShowModal({
				title: "Enter Icon",
				isMinHeight0: true,
				cbClose: (isDataEntered) => {
					if (!isDataEntered) return resolve(null);
					const raw = $iptStr.val();
					if (!raw.trim()) return resolve(null);
					else return resolve(raw);
				},
			});
			$iptStr.appendTo($modalInner);
			$$`<div class="ve-flex-vh-center">${$btnOk}</div>`.appendTo($modalInner);
			$iptStr.focus();
			$iptStr.select();
		});
	}

	// region persistence
	async _pDoSaveState () {
		const toSave = this.getSaveableState();
		await StorageUtil.pSetForPage(MakeCards._STORAGE_KEY, toSave);
	}

	async _pDoLoadState () {
		const toLoad = await StorageUtil.pGetForPage(MakeCards._STORAGE_KEY);
		if (toLoad != null) this.setStateFrom(toLoad);
	}

	getSaveableState () {
		return {
			state: this.getBaseSaveableState(),
			listItems: this._list.items.map(it => ({
				page: it.values.page,
				source: it.values.source,
				hash: it.values.hash,
				color: it.values.color,
				icon: it.values.icon,
				count: it.values.count,
				entityType: it.values.entityType,
			})),
		};
	}

	setStateFrom (toLoad) {
		this.setBaseSaveableStateFrom(toLoad.state);
		Promise.all(toLoad.listItems.map(async toLoad => this._pGetListItem(toLoad)))
			.then(initialListItems => {
				if (initialListItems.length) {
					initialListItems.sort((a, b) => SortUtil.ascSortLower(a.name, b.name)).forEach(it => this._list.addItem(it));
					this._list.update();
				}
			});
	}
	// endregion

	_getDefaultState () {
		const cpy = MiscUtil.copy(MakeCards._DEFAULT_STATE);
		Object.entries(MakeCards._AVAILABLE_TYPES).forEach(([k, v]) => {
			const kColor = `color_${k}`;
			const kIcon = `icon_${k}`;
			cpy[kColor] = v.colorDefault || MakeCards._DEFAULT_STATE;
			cpy[kIcon] = v.iconDefault || MakeCards._ICON_DEFAULT;
		});
		return cpy;
	}
}
MakeCards._DEFAULT_STATE = {

};
MakeCards._COLOR_DEFAULT = "#333333";
MakeCards._ICON_DEFAULT = "perspective-dice-six-faces-random";
MakeCards._STORAGE_KEY = "cardState";
MakeCards._AVAILABLE_TYPES = {
	creature: {
		searchTitle: "Creature",
		pageTitle: "Bestiary",
		isPageTitleSkipSuffix: true,
		page: UrlUtil.PG_BESTIARY,
		colorDefault: "#008000",
		iconDefault: "imp-laugh",
		pFnSearch: SearchWidget.pGetUserCreatureSearch,
		fnGetContents: MakeCards._getCardContents_creature.bind(MakeCards),
		fnGetTags: (mon) => {
			const types = Parser.monTypeToFullObj(mon.type);
			const cr = mon.cr == null ? "unknown CR" : `CR ${(mon.cr.cr || mon.cr)}`;
			return ["creature", Parser.sourceJsonToAbv(mon.source), ...types.types, cr, Renderer.utils.getRenderedSize(mon.size)];
		},
	},
	item: {
		searchTitle: "Item",
		pageTitle: "Items",
		page: UrlUtil.PG_ITEMS,
		colorDefault: "#696969",
		iconDefault: "crossed-swords",
		pFnSearch: SearchWidget.pGetUserItemSearch,
		fnGetContents: MakeCards._getCardContents_item.bind(MakeCards),
		fnGetTags: (item) => {
			const [typeListText] = Renderer.item.getHtmlAndTextTypes(item);
			return ["item", Parser.sourceJsonToAbv(item.source), ...typeListText];
		},
	},
	spell: {
		searchTitle: "Spell",
		pageTitle: "Spells",
		page: UrlUtil.PG_SPELLS,
		colorDefault: "#4a6898",
		iconDefault: "magic-swirl",
		pFnSearch: SearchWidget.pGetUserSpellSearch,
		fnGetContents: MakeCards._getCardContents_spell.bind(MakeCards),
		fnGetTags: (spell) => {
			const out = [
				"spell",
				Parser.sourceJsonToAbv(spell.source),
				Parser.spLevelToFullLevelText(spell.level),
				Parser.spSchoolAbvToFull(spell.school),
			];
			const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
			const fromOptionalClassList = Renderer.spell.getCombinedClasses(spell, "fromClassListVariant");
			if (fromClassList.length) {
				const [current] = Parser.spClassesToCurrentAndLegacy(fromClassList);
				current.forEach(it => out.push(it.name));
			}
			if (fromOptionalClassList.length) {
				const [currentOptional] = Parser.spVariantClassesToCurrentAndLegacy(fromOptionalClassList);
				currentOptional.forEach(it => out.push(it.name));
			}
			if (spell.duration.filter(d => d.concentration).length) out.push("concentration");
			if (spell.meta?.ritual) out.push("ritual");
			return out;
		},
	},
	race: {
		searchTitle: "Race",
		pageTitle: "Races",
		page: UrlUtil.PG_RACES,
		colorDefault: "#a7894b",
		iconDefault: "family-tree",
		pFnSearch: SearchWidget.pGetUserRaceSearch,
		fnGetContents: MakeCards._getCardContents_race.bind(MakeCards),
		fnGetTags: (race) => {
			return ["race", Parser.sourceJsonToAbv(race.source)];
		},
	},
	background: {
		searchTitle: "Background",
		pageTitle: "Backgrounds",
		page: UrlUtil.PG_BACKGROUNDS,
		colorDefault: "#a74b8d",
		iconDefault: "farmer",
		pFnSearch: SearchWidget.pGetUserBackgroundSearch,
		fnGetContents: MakeCards._getCardContents_background.bind(MakeCards),
		fnGetTags: (bg) => {
			return ["background", Parser.sourceJsonToAbv(bg.source)];
		},
	},
	feat: {
		searchTitle: "Feat",
		pageTitle: "Feats",
		page: UrlUtil.PG_FEATS,
		colorDefault: "#aca300",
		iconDefault: "mighty-force",
		pFnSearch: SearchWidget.pGetUserFeatSearch,
		fnGetContents: MakeCards._getCardContents_feat.bind(MakeCards),
		fnGetTags: (feat) => {
			return ["feat", Parser.sourceJsonToAbv(feat.source)];
		},
	},
	optionalfeature: {
		searchTitle: "Option/Feature",
		pageTitle: "Options/Features",
		page: UrlUtil.PG_OPT_FEATURES,
		colorDefault: "#8c6a00",
		iconDefault: "checkbox-tree",
		pFnSearch: SearchWidget.pGetUserOptionalFeatureSearch,
		fnGetContents: MakeCards._getCardContents_optionalfeature.bind(MakeCards),
		fnGetTags: (optfeat) => {
			return ["optional feature", Parser.sourceJsonToAbv(optfeat.source)];
		},
	},
	// TODO add more entities
};
MakeCards._ = null;
window.addEventListener("load", () => MakeCards.pInit());

MakeCards.utils = class {
	static async pLoadReducedData () {
		const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/makecards.json`);
		data.reducedItemProperty.forEach(p => MakeCards.utils._addItemProperty(p));
		data.reducedItemType.forEach(t => {
			if (t.abbreviation === "SHP") {
				const cpy = MiscUtil.copy(t);
				cpy.abbreviation = "AIR";
				MakeCards.utils._addItemType(cpy);
			}
			MakeCards.utils._addItemType(t);
		});
	}

	// region items
	static _addItemProperty (p) {
		if (MakeCards.utils.itemPropertyMap[p.abbreviation]) return;
		if (p.entries || p.entriesTemplate) {
			const cpy = MiscUtil.copy(p);
			MakeCards.utils.itemPropertyMap[p.abbreviation] = p.name ? cpy : {
				...cpy,
				name: p.entries[0].name.toLowerCase(),
			};
			return;
		}
		MakeCards.utils.itemPropertyMap[p.abbreviation] = {};
	}

	static _addItemType (t) {
		if (MakeCards.utils.itemTypeMap[t.abbreviation]?.entries || MakeCards.utils.itemTypeMap[t.abbreviation]?.entriesTemplate) return;
		const cpy = MiscUtil.copy(t);
		MakeCards.utils.itemTypeMap[t.abbreviation] = t.name ? cpy : {
			...cpy,
			name: t.entries[0].name.toLowerCase(),
		};
	}

	static enhanceItemAlt (item) {
		delete item._fullEntries;

		if (item.type && (MakeCards.utils.itemPropertyMap[item.type] || Renderer.item.typeMap[item.type])) {
			Renderer.item._initFullEntries(item);
			(((MakeCards.utils.itemTypeMap[item.type] || Renderer.item.typeMap[item.type]) || {}).entries || []).forEach(e => item._fullEntries.push(e));
		}

		if (item.property) {
			item.property.forEach(p => {
				if (MakeCards.utils.itemPropertyMap[p]) {
					if (MakeCards.utils.itemPropertyMap[p].entries) {
						Renderer.item._initFullEntries(item);
						MakeCards.utils.itemPropertyMap[p].entries.forEach(e => item._fullEntries.push(e));
					}
				} else if (Renderer.item.propertyMap[p].entries) {
					Renderer.item._initFullEntries(item);
					Renderer.item.propertyMap[p].entries.forEach(e => item._fullEntries.push(e));
				}
			});
		}

		if (item.type === "LA" || item.type === "MA" || item.type === "HA") {
			if (item.resist) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage.`);
			}
			if (item.stealth) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("Disadvantage on Stealth (Dexterity) checks.");
			}
			if (item.type === "HA" && item.strength) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Speed reduced by 10 feet if Strength score less than ${item.strength}.`);
			}
		} else if (item.resist) {
			if (item.type === "P") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage for 1 hour.`);
			}
			if (item.type === "RG") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push(`Resistance to ${item.resist} damage.`);
			}
		}
		if (item.type === "SCF") {
			if (item.scfType === "arcane") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A sorcerer, warlock, or wizard can use this item as a spellcasting focus.");
			}
			if (item.scfType === "druid") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A druid can use this item as a spellcasting focus.");
			}
			if (item.scfType === "holy") {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push("A cleric or paladin can use this item as a spellcasting focus.");
			}
		}
	}
	// endregion
};
MakeCards.utils.itemTypeMap = {};
MakeCards.utils.itemPropertyMap = {};

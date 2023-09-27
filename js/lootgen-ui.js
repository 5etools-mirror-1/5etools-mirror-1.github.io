"use strict";

class LootGenUi extends BaseComponent {
	static _CHALLENGE_RATING_RANGES = {
		0: "0\u20134",
		5: "5\u201310",
		11: "11\u201316",
		17: "17+",
	};
	static _PARTY_LOOT_LEVEL_RANGES = {
		4: "1\u20134",
		10: "5\u201310",
		16: "11\u201316",
		20: "17+",
	};
	static _PARTY_LOOT_ITEMS_PER_LEVEL = {
		1: {
			"major": {
				"uncommon": 0,
				"rare": 0,
				"very rare": 0,
				"legendary": 0,
			},
			"minor": {
				"common": 0,
				"uncommon": 0,
				"rare": 0,
				"very rare": 0,
				"legendary": 0,
			},
		},
		4: {
			"major": {
				"uncommon": 2,
				"rare": 0,
				"very rare": 0,
				"legendary": 0,
			},
			"minor": {
				"common": 6,
				"uncommon": 2,
				"rare": 1,
				"very rare": 0,
				"legendary": 0,
			},
		},
		10: {
			"major": {
				"uncommon": 5,
				"rare": 1,
				"very rare": 0,
				"legendary": 0,
			},
			"minor": {
				"common": 10,
				"uncommon": 12,
				"rare": 5,
				"very rare": 1,
				"legendary": 0,
			},
		},
		16: {
			"major": {
				"uncommon": 1,
				"rare": 2,
				"very rare": 2,
				"legendary": 1,
			},
			"minor": {
				"common": 3,
				"uncommon": 6,
				"rare": 9,
				"very rare": 5,
				"legendary": 1,
			},
		},
		20: {
			"major": {
				"uncommon": 0,
				"rare": 1,
				"very rare": 2,
				"legendary": 3,
			},
			"minor": {
				"common": 0,
				"uncommon": 0,
				"rare": 4,
				"very rare": 9,
				"legendary": 6,
			},
		},
	};
	static _DRAGON_AGES = [
		"Wyrmling",
		"Young",
		"Adult",
		"Ancient",
	];

	constructor ({spells, items, ClsLootGenOutput}) {
		super();

		TabUiUtil.decorate(this, {isInitMeta: true});

		this._ClsLootGenOutput = ClsLootGenOutput || LootGenOutput;

		this._modalFilterSpells = new ModalFilterSpells({namespace: "LootGenUi.spells", allData: spells});
		this._modalFilterItems = new ModalFilterItems({
			namespace: "LootGenUi.items",
			allData: items,
		});

		this._data = null;
		this._dataSpells = spells;
		this._dataItems = items;

		this._dataSpellsFiltered = [...spells];
		this._dataItemsFiltered = [...items];

		this._lt_tableMetas = null;

		this._pl_xgeTableLookup = null;

		this._$wrpOutputRows = null;
		this._lootOutputs = [];
	}

	static _er (...args) { return Renderer.get().setFirstSection(true).render(...args); }

	getSaveableState () {
		return {
			...super.getSaveableState(),
			meta: this.__meta,
		};
	}

	setStateFrom (toLoad, isOverwrite = false) {
		super.setStateFrom(toLoad, isOverwrite);
		toLoad.meta && this._proxyAssignSimple("meta", toLoad.meta, isOverwrite);
	}

	addHookAll (hookProp, hook) { return this._addHookAll(hookProp, hook); }

	async pInit () {
		await this._modalFilterSpells.pPreloadHidden();
		await this._modalFilterItems.pPreloadHidden();

		await this._modalFilterSpells.pPopulateHiddenWrapper();
		await this._modalFilterItems.pPopulateHiddenWrapper();

		this._data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/loot.json`);

		await this._pInit_pBindFilterHooks();
	}

	async _pInit_pBindFilterHooks () {
		const tablesMagicItems = await ["A", "B", "C", "D", "E", "F", "G", "H", "I"]
			.pMap(async letter => {
				return {
					letter,
					tableEntry: await DataLoader.pCacheAndGet(UrlUtil.PG_TABLES, Parser.SRC_DMG, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_TABLES]({name: `Magic Item Table ${letter}`, source: Parser.SRC_DMG})),
				};
			});

		const hkFilterChangeSpells = () => this._handleFilterChangeSpells();
		this._modalFilterSpells.pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, hkFilterChangeSpells);
		hkFilterChangeSpells();

		const hkFilterChangeItems = () => this._handleFilterChangeItems({tablesMagicItems});
		this._modalFilterItems.pageFilter.filterBox.on(FilterBox.EVNT_VALCHANGE, hkFilterChangeItems);
		hkFilterChangeItems();
	}

	_handleFilterChangeSpells () {
		const f = this._modalFilterSpells.pageFilter.filterBox.getValues();
		this._dataSpellsFiltered = this._dataSpells.filter(it => this._modalFilterSpells.pageFilter.toDisplay(f, it));

		this._state.pulseSpellsFiltered = !this._state.pulseSpellsFiltered;
	}

	_handleFilterChangeItems ({tablesMagicItems}) {
		const f = this._modalFilterItems.pageFilter.filterBox.getValues();
		this._dataItemsFiltered = this._dataItems.filter(it => this._modalFilterItems.pageFilter.toDisplay(f, it));

		const xgeTables = this._getXgeFauxTables();

		this._lt_tableMetas = [
			null,
			...tablesMagicItems.map(({letter, tableEntry}) => {
				tableEntry = MiscUtil.copy(tableEntry);
				tableEntry.type = "table";
				delete tableEntry.chapter;
				return {
					type: "DMG",
					dmgTableType: letter,
					tableEntry,
					table: this._data.magicItems.find(it => it.type === letter),
				};
			}),
			...xgeTables,
		];

		this._pl_xgeTableLookup = {};
		xgeTables.forEach(({tier, rarity, table}) => MiscUtil.set(this._pl_xgeTableLookup, tier, rarity, table));

		this._state.pulseItemsFiltered = !this._state.pulseItemsFiltered;
	}

	/** Create fake tables for the XGE rules */
	_getXgeFauxTables () {
		const byTier = {};

		this._dataItemsFiltered
			.forEach(item => {
				const tier = item.tier || "other";
				const rarity = item.rarity || (Renderer.item.isMundane(item) ? "unknown" : "unknown (magic)");
				const tgt = MiscUtil.getOrSet(byTier, tier, rarity, []);
				tgt.push(item);
			});

		return Object.entries(byTier)
			.map(([tier, byRarity]) => {
				return Object.entries(byRarity)
					.sort(([rarityA], [rarityB]) => SortUtil.ascSortItemRarity(rarityA, rarityB))
					.map(([rarity, items]) => {
						const isMundane = Renderer.item.isMundane({rarity});

						const caption = tier === "other"
							? `Other ${isMundane ? "mundane" : "magic"} items of ${rarity} rarity`
							: `${tier.toTitleCase()}-tier ${isMundane ? "mundane" : "magic"} items of ${rarity} rarity`;

						return {
							type: "XGE",
							tier,
							rarity,

							tableEntry: {
								type: "table",
								caption,
								colLabels: [
									`d${items.length}`,
									"Item",
								],
								colStyles: [
									"col-2 ve-text-center",
									"col-10",
								],
								rows: items.map((it, i) => ([i + 1, `{@item ${it.name}|${it.source}}`])),
							},

							table: {
								name: caption,
								source: Parser.SRC_XGE,
								page: 135,
								diceType: items.length,
								table: items.map((it, i) => ({min: i + 1, max: i + 1, item: `{@item ${it.name}|${it.source}}`})),
							},
						};
					});
			})
			.flat();
	}

	render ({$stg, $stgLhs, $stgRhs}) {
		if ($stg && ($stgLhs || $stgRhs)) throw new Error(`Only one of "parent stage" and "LHS/RHS stages" may be specified!`);

		const {$stgLhs: $stgLhs_, $stgRhs: $stgRhs_} = this._render_$getStages({$stg, $stgLhs, $stgRhs});

		const iptTabMetas = [
			new TabUiUtil.TabMeta({name: "Random Treasure by CR", hasBorder: true, hasBackground: true}),
			new TabUiUtil.TabMeta({name: "Loot Tables", hasBorder: true, hasBackground: true}),
			new TabUiUtil.TabMeta({name: "Party Loot", hasBorder: true, hasBackground: true}),
			new TabUiUtil.TabMeta({name: "Dragon Hoard", hasBorder: true, hasBackground: true}),
			new TabUiUtil.TabMeta({name: "Gems/Art Objects Generator", isHeadHidden: true, hasBackground: true}),
			new TabUiUtil.TabMeta({
				type: "buttons",
				buttons: [
					{
						html: `<span class="glyphicon glyphicon-option-vertical"></span>`,
						title: "Other Generators",
						type: "default",
						pFnClick: null, // This is assigned later
					},
				],
			}),
		];

		const tabMetas = this._renderTabs(iptTabMetas, {$parent: $stgLhs_});
		const [tabMetaFindTreasure, tabMetaLootTables, tabMetaPartyLoot, tabMetaDragonHoard, tabMetaGemsArtObjects, tabMetaOptions] = tabMetas;

		this._render_tabFindTreasure({tabMeta: tabMetaFindTreasure});
		this._render_tabLootTables({tabMeta: tabMetaLootTables});
		this._render_tabPartyLoot({tabMeta: tabMetaPartyLoot});
		this._render_tabDragonHoard({tabMeta: tabMetaDragonHoard});
		this._render_tabGemsArtObjects({tabMeta: tabMetaGemsArtObjects});
		this._render_tabOptions({tabMeta: tabMetaOptions, tabMetaGemsArtObjects});

		this._render_output({$wrp: $stgRhs_});
	}

	/**
	 * If we have been provided an existing pair of left-/right-hand stages, use them.
	 * Otherwise, render a two-column UI, and return each column as a stage.
	 * This allows us to cater for both the pre-baked layout of the Lootgen page, and other, more general,
	 *   components.
	 */
	_render_$getStages ({$stg, $stgLhs, $stgRhs}) {
		if (!$stg) return {$stgLhs, $stgRhs};

		$stgLhs = $(`<div class="ve-flex w-50 h-100"></div>`);
		$stgRhs = $(`<div class="ve-flex-col w-50 h-100"></div>`);

		$$`<div class="ve-flex w-100 h-100">
			${$stgLhs}
			<div class="vr-2 h-100"></div>
			${$stgRhs}
		</div>`.appendTo($stg.empty());

		return {$stgLhs, $stgRhs};
	}

	_render_tabFindTreasure ({tabMeta}) {
		const $selChallenge = ComponentUiUtil.$getSelEnum(
			this,
			"ft_challenge",
			{
				values: Object.keys(LootGenUi._CHALLENGE_RATING_RANGES).map(it => Number(it)),
				fnDisplay: it => LootGenUi._CHALLENGE_RATING_RANGES[it],
			},
		);

		const $cbIsHoard = ComponentUiUtil.$getCbBool(this, "ft_isHoard");

		const $btnRoll = $(`<button class="btn btn-default btn-xs mr-2">Roll Loot</button>`)
			.click(() => this._ft_pDoHandleClickRollLoot());

		const $btnClear = $(`<button class="btn btn-danger btn-xs">Clear Output</button>`)
			.click(() => this._doClearOutput());

		$$`<div class="ve-flex-col py-2 px-3">
			<label class="split-v-center mb-2">
				<div class="mr-2 w-66 no-shrink">Challenge Rating</div>
				${$selChallenge}
			</label>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Is Treasure Hoard?</div>
				${$cbIsHoard}
			</label>

			<div class="ve-flex-v-center mb-2">
				${$btnRoll}
				${$btnClear}
			</div>

			<hr class="hr-3">

			<div class="ve-small italic">${this.constructor._er(`Based on the tables and rules in the {@book Dungeon Master's Guide|DMG|7|Treasure Tables}`)}, pages 133-149.</div>
		</div>`.appendTo(tabMeta.$wrpTab);
	}

	_ft_pDoHandleClickRollLoot () {
		if (this._state.ft_isHoard) return this._ft_doHandleClickRollLoot_pHoard();
		return this._ft_doHandleClickRollLoot_single();
	}

	_ft_doHandleClickRollLoot_single () {
		const tableMeta = this._data.individual.find(it => it.crMin === this._state.ft_challenge);

		const rowRoll = RollerUtil.randomise(100);
		const row = tableMeta.table.find(it => rowRoll >= it.min && rowRoll <= it.max);

		const coins = this._getConvertedCoins(
			Object.entries(row.coins)
				.mergeMap(([type, formula]) => ({[type]: Renderer.dice.parseRandomise2(formula)})),
		);

		const lootOutput = new this._ClsLootGenOutput({
			type: `Individual Treasure: ${LootGenUi._CHALLENGE_RATING_RANGES[this._state.ft_challenge]}`,
			name: `{@b Individual Treasure} for challenge rating {@b ${LootGenUi._CHALLENGE_RATING_RANGES[this._state.ft_challenge]}}`,
			coins,
		});
		this._doAddOutput({lootOutput});
	}

	async _ft_doHandleClickRollLoot_pHoard () {
		const tableMeta = this._data.hoard.find(it => it.crMin === this._state.ft_challenge);

		const rowRoll = RollerUtil.randomise(100);
		const row = tableMeta.table.find(it => rowRoll >= it.min && rowRoll <= it.max);

		const coins = this._getConvertedCoins(
			Object.entries(tableMeta.coins || {})
				.mergeMap(([type, formula]) => ({[type]: Renderer.dice.parseRandomise2(formula)})),
		);

		const gems = this._doHandleClickRollLoot_hoard_gemsArtObjects({row, prop: "gems"});
		const artObjects = this._doHandleClickRollLoot_hoard_gemsArtObjects({row, prop: "artObjects"});
		const magicItemsByTable = await this._doHandleClickRollLoot_hoard_pMagicItems({row});

		const lootOutput = new this._ClsLootGenOutput({
			type: `Treasure Hoard: ${LootGenUi._CHALLENGE_RATING_RANGES[this._state.ft_challenge]}`,
			name: `{@b Hoard} for challenge rating {@b ${LootGenUi._CHALLENGE_RATING_RANGES[this._state.ft_challenge]}}`,
			coins,
			gems,
			artObjects,
			magicItemsByTable,
		});
		this._doAddOutput({lootOutput});
	}

	_doHandleClickRollLoot_hoard_gemsArtObjects ({row, prop}) {
		if (!row[prop]) return null;

		const lootMeta = row[prop];

		const {type, typeRoll} = this._doHandleClickRollLoot_hoard_gemsArtObjects_getTypeInfo({lootMeta});

		const specificTable = this._data[prop].find(it => it.type === type);
		const count = Renderer.dice.parseRandomise2(lootMeta.amount);

		const breakdown = {};
		[...new Array(count)]
			.forEach(() => {
				const type = RollerUtil.rollOnArray(specificTable.table);
				breakdown[type] = (breakdown[type] || 0) + 1;
			});

		return [
			new LootGenOutputGemsArtObjects({
				type,
				typeRoll,
				typeTable: lootMeta.typeTable,
				count,
				breakdown,
			}),
		];
	}

	/** Alternate version, which rolls for type for each item. */
	_doHandleClickRollLoot_hoard_gemsArtObjectsMulti ({row, prop}) {
		if (!row[prop]) return null;

		const lootMeta = row[prop];

		const count = Renderer.dice.parseRandomise2(lootMeta.amount);

		const byType = {};

		[...new Array(count)]
			.forEach(() => {
				const {type} = this._doHandleClickRollLoot_hoard_gemsArtObjects_getTypeInfo({lootMeta});

				if (!byType[type]) {
					byType[type] = {
						breakdown: {},
						count: 0,
					};
				}

				const meta = byType[type];

				meta.count++;

				const specificTable = this._data[prop].find(it => it.type === type);

				const type2 = RollerUtil.rollOnArray(specificTable.table);
				meta.breakdown[type2] = (meta.breakdown[type2] || 0) + 1;
			});

		return Object.entries(byType)
			.map(([type, meta]) => {
				return new LootGenOutputGemsArtObjects({
					type,
					typeRoll: null,
					typeTable: lootMeta.typeTable,
					count: meta.count,
					breakdown: meta.breakdown,
				});
			});
	}

	_doHandleClickRollLoot_hoard_gemsArtObjects_getTypeInfo ({lootMeta}) {
		if (lootMeta.type) return {type: lootMeta.type};

		const typeRoll = RollerUtil.randomise(100);
		const typeMeta = lootMeta.typeTable.find(it => typeRoll >= it.min && typeRoll <= it.max);
		return {type: typeMeta.type, typeRoll};
	}

	async _doHandleClickRollLoot_hoard_pMagicItems ({row, fnGetIsPreferAltChoose = null}) {
		if (!row.magicItems) return null;

		return row.magicItems.pMap(async magicItemsObj => {
			const {type, typeRoll, typeAltChoose} = this._doHandleClickRollLoot_hoard_pMagicItems_getTypeInfo({magicItemsObj});

			const magicItemTable = this._data.magicItems.find(it => it.type === type);
			const count = Renderer.dice.parseRandomise2(magicItemsObj.amount);
			const itemsAltChoose = this._doHandleClickRollLoot_hoard_getAltChooseList({typeAltChoose});
			const itemsAltChooseDisplayText = this._doHandleClickRollLoot_hoard_getAltChooseDisplayText({typeAltChoose});

			const breakdown = [];

			await ([...new Array(count)].pSerialAwaitMap(async () => {
				const lootItem = await LootGenMagicItem.pGetMagicItemRoll({
					lootGenMagicItems: breakdown,
					spells: this._dataSpellsFiltered,
					magicItemTable,
					itemsAltChoose,
					itemsAltChooseDisplayText,
					isItemsAltChooseRoll: fnGetIsPreferAltChoose ? fnGetIsPreferAltChoose() : false,
					fnGetIsPreferAltChoose,
				});
				breakdown.push(lootItem);
			}));

			return new LootGenOutputMagicItems({
				type,
				count,
				typeRoll,
				typeTable: magicItemsObj.typeTable,
				breakdown,
			});
		});
	}

	async _doHandleClickRollLoot_hoard_pMagicItemsMulti ({row, fnGetIsPreferAltChoose = null}) {
		if (!row.magicItems) return null;

		const byType = {};

		await row.magicItems.pMap(async magicItemsObj => {
			const count = Renderer.dice.parseRandomise2(magicItemsObj.amount);

			await [...new Array(count)]
				.pSerialAwaitMap(async () => {
					const {type, typeAltChoose} = this._doHandleClickRollLoot_hoard_pMagicItems_getTypeInfo({magicItemsObj});

					if (!byType[type]) {
						byType[type] = {
							breakdown: [],
							count: 0,
							typeTable: magicItemsObj.typeTable,
						};
					}

					const meta = byType[type];

					const magicItemTable = this._data.magicItems.find(it => it.type === type);
					const itemsAltChoose = this._doHandleClickRollLoot_hoard_getAltChooseList({typeAltChoose});
					const itemsAltChooseDisplayText = this._doHandleClickRollLoot_hoard_getAltChooseDisplayText({typeAltChoose});

					const lootItem = await LootGenMagicItem.pGetMagicItemRoll({
						lootGenMagicItems: meta.breakdown,
						spells: this._dataSpellsFiltered,
						magicItemTable,
						itemsAltChoose,
						itemsAltChooseDisplayText,
						isItemsAltChooseRoll: fnGetIsPreferAltChoose ? fnGetIsPreferAltChoose() : false,
						fnGetIsPreferAltChoose,
					});
					meta.breakdown.push(lootItem);
				});
		});

		return Object.entries(byType)
			.map(([type, meta]) => {
				return new LootGenOutputMagicItems({
					type,
					count: meta.count,
					typeRoll: null,
					typeTable: meta.typeTable,
					breakdown: meta.breakdown,
				});
			});
	}

	_doHandleClickRollLoot_hoard_pMagicItems_getTypeInfo ({magicItemsObj}) {
		if (magicItemsObj.type) return {type: magicItemsObj.type, typeAltChoose: magicItemsObj.typeAltChoose};

		const typeRoll = RollerUtil.randomise(100);
		const typeMeta = magicItemsObj.typeTable.find(it => typeRoll >= it.min && typeRoll <= it.max);
		return {type: typeMeta.type, typeRoll, typeAltChoose: typeMeta.typeAltChoose};
	}

	_doHandleClickRollLoot_hoard_getAltChooseList ({typeAltChoose}) {
		if (!typeAltChoose) return null;
		return this._dataItemsFiltered.filter(it => it.type !== "GV" && Object.entries(typeAltChoose).every(([k, v]) => it[k] === v));
	}

	_doHandleClickRollLoot_hoard_getAltChooseDisplayText ({typeAltChoose}) {
		if (!typeAltChoose) return null;
		return [
			typeAltChoose.rarity,
			typeAltChoose.tier,
		].filter(Boolean).join(" ");
	}

	_render_tabLootTables ({tabMeta}) {
		let cacheTableMetas = [...this._lt_tableMetas];

		const getSelTableValues = () => this._lt_tableMetas.map((_, i) => i);

		const {$sel: $selTable, setValues: setSelTableValues} = ComponentUiUtil.$getSelEnum(
			this,
			"lt_ixTable",
			{
				asMeta: true,
				values: getSelTableValues(),
				fnDisplay: ix => this._lt_tableMetas[ix] == null
					? `\u2014`
					: this._lt_tableMetas[ix].tier
						? `Tier: ${this._lt_tableMetas[ix].tier}; Rarity: ${this._lt_tableMetas[ix].rarity}`
						: this._lt_tableMetas[ix].tableEntry.caption,
			},
		);

		const hkPulseItem = () => {
			const curVal = cacheTableMetas[this._state.lt_ixTable];
			cacheTableMetas = [...this._lt_tableMetas];

			const values = getSelTableValues();
			setSelTableValues(values);

			if (
				!values.includes(this._state.lt_ixTable)
				|| !curVal
				|| !curVal.tier || !curVal.rarity
			) return this._state.lt_ixTable = 0;

			// Try to restore the previous selection (as it may have moved due to the array resizing)
			const ix = this._lt_tableMetas.findIndex(it => it && it.tier === curVal.tier && it.rarity === curVal.rarity);
			if (~ix) this._state.lt_ixTable = ix;
			else this._state.lt_ixTable = 0;
		};
		this._addHookBase("pulseItemsFiltered", hkPulseItem);

		const $btnRoll = $(`<button class="btn btn-default btn-xs mr-2">Roll Loot</button>`)
			.click(() => this._lt_pDoHandleClickRollLoot());

		const $btnClear = $(`<button class="btn btn-danger btn-xs">Clear Output</button>`)
			.click(() => this._doClearOutput());

		const $hrHelp = $(`<hr class="hr-3">`);
		const $dispHelp = $(`<div class="ve-small italic"></div>`);
		const $hrTable = $(`<hr class="hr-3">`);
		const $dispTable = $(`<div class="ve-flex-col w-100"></div>`);

		const hkTable = () => {
			const tableMeta = this._lt_tableMetas[this._state.lt_ixTable];

			$dispHelp.toggleVe(tableMeta != null);
			$dispTable.toggleVe(tableMeta != null);
			$hrHelp.toggleVe(tableMeta != null);
			$hrTable.toggleVe(tableMeta != null);

			if (tableMeta == null) return;

			$dispHelp
				.html(tableMeta.type === "DMG" ? this.constructor._er(`Based on the tables and rules in the {@book Dungeon Master's Guide|DMG|7|Treasure Tables}, pages 133-149.`) : this.constructor._er(`Tables auto-generated based on the rules in {@book Xanathar's Guide to Everything (Choosing Items Piecemeal)|XGE|2|choosing items piecemeal}, pages 135-136.`));

			$dispTable.html(this.constructor._er(tableMeta.tableEntry));
		};
		this._addHookBase("lt_ixTable", hkTable);
		hkTable();

		$$`<div class="ve-flex-col py-2 px-3">
			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Table</div>
				${$selTable}
			</label>

			<div class="ve-flex-v-center mb-2">
				${$btnRoll}
				${$btnClear}
			</div>

			${$hrHelp}
			${$dispHelp}
			${$hrTable}
			${$dispTable}
		</div>`.appendTo(tabMeta.$wrpTab);
	}

	async _lt_pDoHandleClickRollLoot () {
		const tableMeta = this._lt_tableMetas[this._state.lt_ixTable];
		if (!tableMeta) return JqueryUtil.doToast({type: "warning", content: `Please select a table first!`});

		const lootOutput = new this._ClsLootGenOutput({
			type: `Treasure Table Roll: ${tableMeta.type === "DMG" ? tableMeta.tableEntry.caption : `${tableMeta.tier} ${tableMeta.rarity}`}`,
			name: tableMeta.type === "DMG"
				? `Rolled against {@b {@table ${tableMeta.tableEntry.caption}|${Parser.SRC_DMG}}}`
				: `Rolled on the table for {@b ${tableMeta.tier} ${tableMeta.rarity}} items`,
			magicItemsByTable: await this._lt_pDoHandleClickRollLoot_pGetMagicItemMetas({tableMeta}),
		});
		this._doAddOutput({lootOutput});
	}

	async _lt_pDoHandleClickRollLoot_pGetMagicItemMetas ({tableMeta}) {
		const breakdown = [];
		const lootItem = await LootGenMagicItem.pGetMagicItemRoll({
			lootGenMagicItems: breakdown,
			spells: this._dataSpellsFiltered,
			magicItemTable: tableMeta.table,
		});
		breakdown.push(lootItem);

		return [
			new LootGenOutputMagicItems({
				type: tableMeta.dmgTableType,
				count: 1,
				breakdown,
			}),
		];
	}

	_render_tabPartyLoot ({tabMeta}) {
		const $cbIsExactLevel = ComponentUiUtil.$getCbBool(this, "pl_isExactLevel");

		const $cbIsCumulative = ComponentUiUtil.$getCbBool(this, "pl_isCumulative");

		// region Default
		const $selCharLevel = ComponentUiUtil.$getSelEnum(
			this,
			"pl_charLevel",
			{
				values: Object.keys(LootGenUi._PARTY_LOOT_LEVEL_RANGES).map(it => Number(it)),
				fnDisplay: it => LootGenUi._PARTY_LOOT_LEVEL_RANGES[it],
			},
		);

		const $stgDefault = $$`<div class="ve-flex-col w-100">
			<label class="split-v-center mb-2">
				<div class="mr-2 w-66 no-shrink">Character Level</div>
				${$selCharLevel}
			</label>
		</div>`;
		// endregion

		// region Exact level
		const $sliderLevel = ComponentUiUtil.$getSliderRange(
			this,
			{
				propMin: "pl_exactLevelMin",
				propMax: "pl_exactLevelMax",
				propCurMin: "pl_exactLevel",
			},
		);

		const $stgExactLevel = $$`<div class="ve-flex-col w-100">
			<div class="ve-flex-col mb-2">
				<div class="mb-2">Character Level</div>
				${$sliderLevel}
			</div>
		</div>`;
		// endregion

		// region Buttons
		const $btnRoll = $(`<button class="btn btn-default btn-xs mr-2">Roll Loot</button>`)
			.click(() => this._pl_pDoHandleClickRollLoot());

		const $btnClear = $(`<button class="btn btn-danger btn-xs">Clear Output</button>`)
			.click(() => this._doClearOutput());
		// endregion

		const hkIsExactLevel = () => {
			$stgDefault.toggleVe(!this._state.pl_isExactLevel);
			$stgExactLevel.toggleVe(this._state.pl_isExactLevel);
		};
		this._addHookBase("pl_isExactLevel", hkIsExactLevel);
		hkIsExactLevel();

		$$`<div class="ve-flex-col py-2 px-3">
			<p>
				Generates a set of magical items for a party, based on the tables and rules in ${this.constructor._er(`{@book Xanathar's Guide to Everything|XGE|2|awarding magic items}`)}, pages 135-136.
			</p>
			<p><i>If &quot;Exact Level&quot; is selected, the output will include a proportional number of items for any partially-completed tier.</i></p>

			<hr class="hr-3">

			${$stgDefault}
			${$stgExactLevel}

			<label class="split-v-center mb-2">
				<div class="mr-2 w-66 no-shrink">Cumulative with Previous Tiers</div>
				${$cbIsCumulative}
			</label>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Is Exact Level</div>
				${$cbIsExactLevel}
			</label>

			<div class="ve-flex-v-center mb-2">
				${$btnRoll}
				${$btnClear}
			</div>
		</div>`.appendTo(tabMeta.$wrpTab);
	}

	async _pl_pDoHandleClickRollLoot () {
		const template = this._pl_getLootTemplate();
		const magicItemsByTable = [];

		for (const [tier, byRarity] of Object.entries(template)) {
			const breakdown = [];
			for (const [rarity, cntItems] of Object.entries(byRarity)) {
				const tableMeta = this._pl_xgeTableLookup[tier]?.[rarity];

				for (let i = 0; i < cntItems; ++i) {
					const lootItem = await LootGenMagicItem.pGetMagicItemRoll({
						lootGenMagicItems: breakdown,
						spells: this._dataSpellsFiltered,
						magicItemTable: tableMeta,
					});
					breakdown.push(lootItem);
				}
			}

			magicItemsByTable.push(
				new LootGenOutputMagicItems({
					count: breakdown.length,
					breakdown,
					tier,
				}),
			);
		}

		const ptLevel = this._state.pl_isExactLevel
			? this._state.pl_exactLevel
			: LootGenUi._PARTY_LOOT_LEVEL_RANGES[this._state.pl_charLevel];
		const lootOutput = new this._ClsLootGenOutput({
			type: `Party Loot: Level ${ptLevel}`,
			name: `Magic items for a {@b Level ${ptLevel}} Party`,
			magicItemsByTable,
		});
		this._doAddOutput({lootOutput});
	}

	_pl_getLootTemplate () {
		const {template, levelLow} = this._state.pl_isExactLevel
			? this._pl_getLootTemplate_exactLevel()
			: {template: MiscUtil.copy(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[this._state.pl_charLevel]), levelLow: this._state.pl_charLevel};

		if (this._state.pl_isCumulative) this._pl_mutAccumulateLootTemplate({template, levelLow});

		return template;
	}

	_pl_getLootTemplate_exactLevel () {
		if (LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[this._state.pl_exactLevel]) {
			return {
				template: MiscUtil.copy(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[this._state.pl_exactLevel]),
				levelLow: this._state.pl_exactLevel,
			};
		}

		let levelLow = 1;
		let levelHigh = 20;

		Object.keys(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL)
			.forEach(level => {
				level = Number(level);

				if (level < this._state.pl_exactLevel && (this._state.pl_exactLevel - level) < (this._state.pl_exactLevel - levelLow)) {
					levelLow = level;
				}

				if (level > this._state.pl_exactLevel && (level - this._state.pl_exactLevel) < (levelHigh - this._state.pl_exactLevel)) {
					levelHigh = level;
				}
			});

		const templateLow = MiscUtil.copy(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[levelLow]);
		const templateHigh = MiscUtil.copy(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[levelHigh]);

		const ratio = (this._state.pl_exactLevel - levelLow) / (levelHigh - levelLow);

		const out = {major: {}, minor: {}};
		Object.entries(out)
			.forEach(([tier, byTier]) => {
				Object.keys(templateLow[tier])
					.forEach(rarity => {
						byTier[rarity] = Math.floor(
							((templateLow[tier]?.[rarity] || 0) * (1 - ratio))
							+ ((templateHigh[tier]?.[rarity] || 0) * ratio),
						);
					});
			});
		return {template: out, levelLow};
	}

	_pl_mutAccumulateLootTemplate ({template, levelLow}) {
		const toAccumulate = Object.keys(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL)
			.filter(it => Number(it) < levelLow);
		if (!toAccumulate.length) return;

		toAccumulate.forEach(level => {
			Object.entries(LootGenUi._PARTY_LOOT_ITEMS_PER_LEVEL[level])
				.forEach(([tier, byRarity]) => {
					Object.entries(byRarity)
						.forEach(([rarity, cntItems]) => {
							const existing = MiscUtil.get(template, tier, rarity) || 0;
							MiscUtil.set(template, tier, rarity, existing + (cntItems || 0));
						});
				});
		});
	}

	_render_tabDragonHoard ({tabMeta}) {
		const $selDragonAge = ComponentUiUtil.$getSelEnum(
			this,
			"dh_dragonAge",
			{
				values: LootGenUi._DRAGON_AGES,
			},
		);

		const $cbIsPreferRandomMagicItems = ComponentUiUtil.$getCbBool(this, "dh_isPreferRandomMagicItems");

		const $btnRoll = $(`<button class="btn btn-default btn-xs mr-2">Roll Loot</button>`)
			.click(() => this._dh_pDoHandleClickRollLoot());

		const $btnClear = $(`<button class="btn btn-danger btn-xs">Clear Output</button>`)
			.click(() => this._doClearOutput());

		$$`<div class="ve-flex-col py-2 px-3">
			<label class="split-v-center mb-2">
				<div class="mr-2 w-66 no-shrink">Dragon Age</div>
				${$selDragonAge}
			</label>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink" title="If selected, random magic items will be preferred over rolling on the standard DMG &quot;Magic Items Table [A-I]&quot; when generating magic items.">Prefer Random Magic Items</div>
				${$cbIsPreferRandomMagicItems}
			</label>

			<div class="ve-flex-v-center mb-2">
				${$btnRoll}
				${$btnClear}
			</div>

			<hr class="hr-3">

			<div class="ve-small italic">${this.constructor._er(`Based on the tables and rules in {@book Fizban's Treasury of Dragons|FTD|4|Creating a Hoard}`)}, pages 72.</div>
		</div>`.appendTo(tabMeta.$wrpTab);
	}

	async _dh_pDoHandleClickRollLoot () {
		const tableMeta = this._data.dragon.find(it => it.name === this._state.dh_dragonAge);

		const coins = this._getConvertedCoins(
			Object.entries(tableMeta.coins || {})
				.mergeMap(([type, formula]) => ({[type]: Renderer.dice.parseRandomise2(formula)})),
		);

		const dragonMundaneItems = this._dh_doHandleClickRollLoot_mundaneItems({dragonMundaneItems: tableMeta.dragonMundaneItems});

		const gems = this._doHandleClickRollLoot_hoard_gemsArtObjectsMulti({row: tableMeta, prop: "gems"});
		const artObjects = this._doHandleClickRollLoot_hoard_gemsArtObjectsMulti({row: tableMeta, prop: "artObjects"});

		const magicItemsByTable = await this._doHandleClickRollLoot_hoard_pMagicItemsMulti({
			row: tableMeta,
			fnGetIsPreferAltChoose: () => !!this._state.dh_isPreferRandomMagicItems,
		});

		const lootOutput = new this._ClsLootGenOutput({
			type: `Dragon Hoard: ${LootGenUi._CHALLENGE_RATING_RANGES[this._state.ft_challenge]}`,
			name: `${this._state.dh_dragonAge} Dragon's Hoard`,
			coins,
			gems,
			artObjects,
			dragonMundaneItems,
			magicItemsByTable,
		});
		this._doAddOutput({lootOutput});
	}

	_dh_doHandleClickRollLoot_mundaneItems ({dragonMundaneItems}) {
		if (!dragonMundaneItems) return null;

		const count = Renderer.dice.parseRandomise2(dragonMundaneItems.amount);

		const breakdown = [];
		[...new Array(count)]
			.forEach(() => {
				const roll = RollerUtil.randomise(100);
				const result = this._data.dragonMundaneItems.find(it => roll >= it.min && roll <= it.max);
				breakdown.push(result.item);
			});

		return new LootGenOutputDragonMundaneItems({
			count: count,
			breakdown,
		});
	}

	_render_tabGemsArtObjects ({tabMeta}) {
		const $cbIsUseGems = ComponentUiUtil.$getCbBool(this, "gao_isUseGems");
		const $cbIsUseArtObjects = ComponentUiUtil.$getCbBool(this, "gao_isUseArtObjects");

		const $iptTargetGoldAmount = ComponentUiUtil.$getIptInt(this, "gao_targetGoldAmount", 0, {min: 0})
			.keydown(evt => {
				if (evt.key !== "Enter") return;
				$iptTargetGoldAmount.change();
				$btnRoll.click();
			});

		const $btnRoll = $(`<button class="btn btn-default btn-xs mr-2">Roll Loot</button>`)
			.click(() => this._goa_pDoHandleClickRollLoot());

		const $btnClear = $(`<button class="btn btn-danger btn-xs">Clear Output</button>`)
			.click(() => this._doClearOutput());

		$$`<div class="ve-flex-col py-2 px-3">
			<h4 class="mt-1 mb-3">Gem/Art Object Generator</h4>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Include Gems</div>
				${$cbIsUseGems}
			</label>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Include Art Objects</div>
				${$cbIsUseArtObjects}
			</label>

			<label class="split-v-center mb-3">
				<div class="mr-2 w-66 no-shrink">Target Gold Amount</div>
				${$iptTargetGoldAmount}
			</label>

			<div class="ve-flex-v-center mb-2">
				${$btnRoll}
				${$btnClear}
			</div>

			<hr class="hr-3">

			<div class="ve-small italic">${this.constructor._er(`This custom generator randomly selects gems/art objects up to the target gold amount.`)}</div>
		</div>`.appendTo(tabMeta.$wrpTab);
	}

	async _goa_pDoHandleClickRollLoot () {
		if (this._state.gao_targetGoldAmount <= 0) return JqueryUtil.doToast({content: "Please enter a target gold amount!", type: "warning"});

		if (!this._state.gao_isUseGems && !this._state.gao_isUseArtObjects) return JqueryUtil.doToast({content: `Please select at least one of "Include Gems" and/or "Include Art Objects"`, type: "warning"});

		const typeMap = {};
		[{prop: "gems", stateProp: "gao_isUseGems"}, {prop: "artObjects", stateProp: "gao_isUseArtObjects"}]
			.forEach(({prop, stateProp}) => {
				if (!this._state[stateProp]) return;
				this._data[prop]
					.forEach(({type, table}) => {
						(typeMap[type] = typeMap[type] || []).push({prop, table});
					});
			});

		const types = Object.keys(typeMap).map(it => Number(it)).sort(SortUtil.ascSort).reverse();
		if (this._state.gao_targetGoldAmount < types.last()) return JqueryUtil.doToast({content: `Could not generate any gems/art objects for a gold amount of ${this._state.gao_targetGoldAmount}! Please increase the target gold amount.`, type: "warning"});

		// Map of <prop> -> <type> -> {<count>, <breakdown>}
		const generated = {};

		let budget = this._state.gao_targetGoldAmount;
		while (budget >= types.last()) {
			const validTypes = types.filter(it => it <= budget);
			const type = RollerUtil.rollOnArray(validTypes);
			const typeMetas = typeMap[type];
			const {prop, table} = RollerUtil.rollOnArray(typeMetas);
			const rolled = RollerUtil.rollOnArray(table);

			const genMeta = MiscUtil.getOrSet(generated, prop, type, {});
			genMeta.count = (genMeta.count || 0) + 1;
			genMeta.breakdown = genMeta.breakdown || {};
			genMeta.breakdown[rolled] = (genMeta.breakdown[rolled] || 0) + 1;

			budget -= type;
		}

		const [gems, artObjects] = ["gems", "artObjects"]
			.map(prop => {
				return generated[prop]
					? Object.entries(generated[prop])
						.sort(([typeA], [typeB]) => SortUtil.ascSort(Number(typeB), Number(typeA)))
						.map(([type, {count, breakdown}]) => {
							type = Number(type);

							return new LootGenOutputGemsArtObjects({
								type,
								count,
								breakdown,
							});
						})
					: null;
			});

		const lootOutput = new this._ClsLootGenOutput({
			type: `Gems/Art Objects`,
			name: `Gems/Art Objects: Roughly ${this._state.gao_targetGoldAmount.toLocaleString()} gp`,
			gems,
			artObjects,
		});
		this._doAddOutput({lootOutput});
	}

	_render_tabOptions ({tabMeta, tabMetaGemsArtObjects}) {
		const menuOthers = ContextUtil.getMenu([
			new ContextUtil.Action(
				"Gems/Art Objects Generator",
				() => {
					this._setActiveTab({tab: tabMetaGemsArtObjects});
				},
			),
			null,
			new ContextUtil.Action(
				"Set Random Item Filters",
				() => {
					this._modalFilterItems.handleHiddenOpenButtonClick();
				},
				{
					title: `Set the filtering parameters used to determine which items can be randomly rolled for some results. Note that this does not, for example, remove these items from standard loot tables.`,
					fnActionAlt: async (evt) => {
						this._modalFilterItems.handleHiddenResetButtonClick(evt);
						JqueryUtil.doToast(`Reset${evt.shiftKey ? " all" : ""}!`);
					},
					textAlt: `<span class="glyphicon glyphicon-refresh"></span>`,
					titleAlt: FilterBox.TITLE_BTN_RESET,
				},
			),
			new ContextUtil.Action(
				"Set Random Spell Filters",
				() => {
					this._modalFilterSpells.handleHiddenOpenButtonClick();
				},
				{
					title: `Set the filtering parameters used to determine which spells can be randomly rolled for some results.`,
					fnActionAlt: async (evt) => {
						this._modalFilterSpells.handleHiddenResetButtonClick(evt);
						JqueryUtil.doToast(`Reset${evt.shiftKey ? " all" : ""}!`);
					},
					textAlt: `<span class="glyphicon glyphicon-refresh"></span>`,
					titleAlt: FilterBox.TITLE_BTN_RESET,
				},
			),
			null,
			new ContextUtil.Action(
				"Settings",
				() => {
					this._opts_pDoOpenSettings();
				},
			),
		]);

		// Update the tab button on-click
		tabMeta.buttons[0].pFnClick = evt => ContextUtil.pOpenMenu(evt, menuOthers);

		const hkIsActive = () => {
			const tab = this._getActiveTab();
			tabMeta.$btns[0].toggleClass("active", !!tab.isHeadHidden);
		};
		this._addHookActiveTab(hkIsActive);
		hkIsActive();
	}

	async _opts_pDoOpenSettings () {
		const {$modalInner} = await UiUtil.pGetShowModal({title: "Settings"});

		const $rowsCurrency = Parser.COIN_ABVS
			.map(it => {
				const {propIsAllowed} = this._getPropsCoins(it);

				const $cb = ComponentUiUtil.$getCbBool(this, propIsAllowed);

				return $$`<label class="split-v-center stripe-odd--faint">
					<div class="no-wrap mr-2">${Parser.coinAbvToFull(it).toTitleCase()}</div>
					${$cb}
				</label>`;
			});

		$$($modalInner)`
			<div class="mb-1" title="Disabled currencies will be converted to equivalent amounts of another currency.">Allowed Currencies:</div>
			<div class="pl-4 ve-flex-col">
				${$rowsCurrency}
			</div>
		`;
	}

	_render_output ({$wrp}) {
		this._$wrpOutputRows = $(`<div class="w-100 h-100 ve-flex-col overflow-y-auto smooth-scroll"></div>`);

		$$`<div class="ve-flex-col w-100 h-100">
			<h4 class="my-0"><i>Output</i></h4>
			${this._$wrpOutputRows}
		</div>`
			.appendTo($wrp);
	}

	_getPropsCoins (coin) {
		return {
			propIsAllowed: `isAllowCurrency${coin.uppercaseFirst()}`,
		};
	}

	_getConvertedCoins (coins) {
		if (!coins) return coins;

		if (Parser.COIN_ABVS.every(it => this._state[this._getPropsCoins(it).propIsAllowed])) return coins;

		if (Parser.COIN_ABVS.every(it => !this._state[this._getPropsCoins(it).propIsAllowed])) {
			JqueryUtil.doToast({content: "All currencies are disabled! Generated currency has been discarded.", type: "warning"});
			return {};
		}

		coins = MiscUtil.copy(coins);
		let coinsRemoved = {};

		Parser.COIN_ABVS
			.forEach(it => {
				const {propIsAllowed} = this._getPropsCoins(it);
				if (this._state[propIsAllowed]) return;
				if (!coins[it]) return;

				coinsRemoved[it] = coins[it];
				delete coins[it];
			});

		if (!Object.keys(coinsRemoved).length) return coins;

		coinsRemoved = {cp: CurrencyUtil.getAsCopper(coinsRemoved)};

		const conversionTableFiltered = MiscUtil.copy(Parser.FULL_CURRENCY_CONVERSION_TABLE)
			.filter(({coin}) => this._state[this._getPropsCoins(coin).propIsAllowed]);
		if (!conversionTableFiltered.some(it => it.isFallback)) conversionTableFiltered[0].isFallback = true;

		// If we have filtered out copper, upgrade our copper amount to the nearest currency
		if (!conversionTableFiltered.some(it => it.coin === "cp")) {
			const conv = conversionTableFiltered[0];
			coinsRemoved = {[conv.coin]: coinsRemoved.cp * conv.mult};
		}

		const coinsRemovedSimplified = CurrencyUtil.doSimplifyCoins(coinsRemoved, {currencyConversionTable: conversionTableFiltered});

		Object.entries(coinsRemovedSimplified).forEach(([coin, count]) => {
			if (!count) return;
			coins[coin] = (coins[coin] || 0) + count;
		});

		return coins;
	}

	_doAddOutput ({lootOutput}) {
		this._lootOutputs.push(lootOutput);
		lootOutput.render(this._$wrpOutputRows);
	}

	_doClearOutput () {
		this._lootOutputs.forEach(it => it.doRemove());
		this._lootOutputs = [];
	}

	_getDefaultState () {
		return {
			...super._getDefaultState(),

			// region Shared
			pulseSpellsFiltered: false,
			pulseItemsFiltered: false,

			isAllowCurrencyCp: true,
			isAllowCurrencySp: true,
			isAllowCurrencyEp: true,
			isAllowCurrencyGp: true,
			isAllowCurrencyPp: true,
			// endregion

			// region Find Treasure
			ft_challenge: 0,
			ft_isHoard: false,
			// endregion

			// region Loot Tables
			lt_ixTable: null,
			// endregion

			// region Party Loot
			pl_isExactLevel: false,
			pl_isCumulative: false,

			pl_charLevel: 4,

			pl_exactLevelMin: 1,
			pl_exactLevelMax: 20,
			pl_exactLevel: 1,
			// endregion

			// region Dragon hoard
			dh_dragonAge: "Wyrmling",
			dh_isPreferRandomMagicItems: false,
			// endregion

			// region Gems/Art Objects
			gao_isUseGems: true,
			gao_isUseArtObjects: true,
			gao_targetGoldAmount: 100,
			// endregion
		};
	}
}

globalThis.LootGenUi = LootGenUi;

class LootGenOutput {
	static _TIERS = ["other", "minor", "major"];

	constructor (
		{
			type,
			name,
			coins,
			gems,
			artObjects,
			magicItemsByTable,
			dragonMundaneItems,
		},
	) {
		this._type = type;
		this._name = name;
		this._coins = coins;
		this._gems = gems;
		this._artObjects = artObjects;
		this._magicItemsByTable = magicItemsByTable;
		this._dragonMundaneItems = dragonMundaneItems;

		this._datetimeGenerated = Date.now();
	}

	_$getEleTitleSplit () {
		const $btnRivet = !IS_VTT && ExtensionUtil.ACTIVE
			? $(`<button title="Send to Foundry (SHIFT for Temporary Import)" class="btn btn-xs btn-default"><span class="glyphicon glyphicon-send"></span></button>`)
				.click(evt => this._pDoSendToFoundry({isTemp: !!evt.shiftKey}))
			: null;

		const $btnDownload = $(`<button title="Download JSON" class="btn btn-xs btn-default"><span class="glyphicon glyphicon-download glyphicon--top-2p"></span></button>`)
			.click(() => this._pDoSaveAsJson());

		return $$`<div class="btn-group">
			${$btnRivet}
			${$btnDownload}
		</div>`;
	}

	render ($parent) {
		const $eleTitleSplit = this._$getEleTitleSplit();

		const $dispTitle = $$`<h4 class="mt-1 mb-2 split-v-center ve-draggable">
			<div>${Renderer.get().render(this._name)}</div>
			${$eleTitleSplit}
		</h4>`;

		const $parts = [
			this._render_$getPtValueSummary(),
			this._render_$getPtCoins(),
			...this._render_$getPtGemsArtObjects({loot: this._gems, name: "gemstones"}),
			...this._render_$getPtGemsArtObjects({loot: this._artObjects, name: "art objects"}),
			this._render_$getPtDragonMundaneItems(),
			...this._render_$getPtMagicItems(),
		].filter(Boolean);

		this._$wrp = $$`<div class="ve-flex-col lootg__wrp-output py-3 px-2 my-2 mr-1">
			${$dispTitle}
			${$parts.length ? $$`<ul>${$parts}</ul>` : null}
			${!$parts.length ? `<div class="ve-muted help-subtle italic" title="${LootGenMagicItemNull.TOOLTIP_NOTHING.qq()}">(No loot!)</div>` : null}
		</div>`
			.prependTo($parent);

		(IS_VTT ? this._$wrp : $dispTitle)
			.attr("draggable", true)
			.on("dragstart", evt => {
				const meta = {
					type: VeCt.DRAG_TYPE_LOOT,
					data: dropData,
				};
				evt.originalEvent.dataTransfer.setData("application/json", JSON.stringify(meta));
			});

		// Preload the drop data in the background, to lessen the chance that the user drops the card before it has time
		//   to load.
		let dropData;
		this._pGetFoundryForm().then(it => dropData = it);
	}

	async _pDoSendToFoundry ({isTemp} = {}) {
		const toSend = await this._pGetFoundryForm();
		if (isTemp) toSend.isTemp = isTemp;
		if (toSend.currency || toSend.entityInfos) return ExtensionUtil.pDoSend({type: "5etools.lootgen.loot", data: toSend});
		JqueryUtil.doToast({content: `Nothing to send!`, type: "warning"});
	}

	async _pDoSaveAsJson () {
		const serialized = await this._pGetFoundryForm();
		await DataUtil.userDownload("loot", serialized);
	}

	async _pGetFoundryForm () {
		const toSend = {name: this._name, type: this._type, dateTimeGenerated: this._datetimeGenerated};

		if (this._coins) toSend.currency = this._coins;

		const entityInfos = [];
		if (this._gems?.length) entityInfos.push(...await this._pDoSendToFoundry_getGemsArtObjectsMetas({loot: this._gems}));
		if (this._artObjects?.length) entityInfos.push(...await this._pDoSendToFoundry_getGemsArtObjectsMetas({loot: this._artObjects}));

		if (this._magicItemsByTable?.length) {
			for (const magicItemsByTable of this._magicItemsByTable) {
				for (const lootItem of magicItemsByTable.breakdown) {
					const exportMeta = lootItem.getExtensionExportMeta();
					if (!exportMeta) continue;
					const {page, entity, options} = exportMeta;
					entityInfos.push({
						page,
						entity,
						options,
					});
				}
			}
		}

		if (this._dragonMundaneItems?.breakdown?.length) {
			for (const str of this._dragonMundaneItems.breakdown) {
				entityInfos.push({
					page: UrlUtil.PG_ITEMS,
					entity: {
						name: Renderer.stripTags(str).uppercaseFirst(),
						source: Parser.SRC_FTD,
						type: "OTH",
						rarity: "unknown",
					},
				});
			}
		}

		if (entityInfos.length) toSend.entityInfos = entityInfos;

		return toSend;
	}

	async _pDoSendToFoundry_getGemsArtObjectsMetas ({loot}) {
		const uidToCount = {};
		const specialItemMetas = {}; // For any rows which don't actually map to an item

		loot.forEach(lt => {
			Object.entries(lt.breakdown)
				.forEach(([entry, count]) => {
					let cntFound = 0;
					entry.replace(/{@item ([^}]+)}/g, (...m) => {
						cntFound++;
						const [name, source] = m[1].toLowerCase().split("|").map(it => it.trim()).filter(Boolean);
						const uid = `${name}|${source || Parser.SRC_DMG}`.toLowerCase();
						uidToCount[uid] = (uidToCount[uid] || 0) + count;
						return "";
					});

					if (cntFound) return;

					// If we couldn't find any real items in this row, prepare a dummy item
					const uidFaux = entry.toLowerCase().trim();

					specialItemMetas[uidFaux] = specialItemMetas[uidFaux] || {
						count: 0,
						item: {
							name: Renderer.stripTags(entry).uppercaseFirst(),
							source: Parser.SRC_DMG,
							type: "OTH",
							rarity: "unknown",
						},
					};

					specialItemMetas[uidFaux].count += count;
				});
		});

		const out = [];
		for (const [uid, count] of Object.entries(uidToCount)) {
			const [name, source] = uid.split("|");
			const item = await DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, source, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source}));
			out.push({
				page: UrlUtil.PG_ITEMS,
				entity: item,
				options: {
					quantity: count,
				},
			});
		}

		for (const {count, item} of Object.values(specialItemMetas)) {
			out.push({
				page: UrlUtil.PG_ITEMS,
				entity: item,
				options: {
					quantity: count,
				},
			});
		}

		return out;
	}

	_render_$getPtValueSummary () {
		if ([this._coins, this._gems, this._artObjects].filter(Boolean).length <= 1) return null;

		const totalValue = [
			this._coins ? CurrencyUtil.getAsCopper(this._coins) : 0,
			this._gems?.length ? this._gems.map(it => it.type * it.count * 100).sum() : 0,
			this._artObjects?.length ? this._artObjects.map(it => it.type * it.count * 100).sum() : 0,
		].sum();

		return $(`<li class="italic ve-muted">A total of ${(totalValue / 100).toLocaleString()} gp worth of coins, art objects, and/or gems, as follows:</li>`);
	}

	_render_$getPtCoins () {
		if (!this._coins) return null;

		const total = CurrencyUtil.getAsCopper(this._coins);
		const breakdown = [...Parser.COIN_ABVS]
			.reverse()
			.filter(it => this._coins[it])
			.map(it => `${this._coins[it].toLocaleString()} ${it}`);

		return $$`
			<li>${(total / 100).toLocaleString()} gp in coinage:</li>
			<ul>
				${breakdown.map(it => `<li>${it}</li>`).join("")}
			</ul>
		`;
	}

	_render_$getPtDragonMundaneItems () {
		if (!this._dragonMundaneItems) return null;

		return $$`
			<li>${this._dragonMundaneItems.count} mundane item${this._dragonMundaneItems.count !== 1 ? "s" : ""}:</li>
			<ul>
				${this._dragonMundaneItems.breakdown.map(it => `<li>${it}</li>`).join("")}
			</ul>
		`;
	}

	_render_$getPtGemsArtObjects ({loot, name}) {
		if (!loot?.length) return [];

		return loot.map(lt => {
			return $$`
			<li>${(lt.type).toLocaleString()} gp ${name} (×${lt.count}; worth ${((lt.type * lt.count)).toLocaleString()} gp total):</li>
			<ul>
				${Object.entries(lt.breakdown).map(([result, count]) => `<li>${Renderer.get().render(result)}${count > 1 ? `, ×${count}` : ""}</li>`).join("")}
			</ul>
		`;
		});
	}

	_render_$getPtMagicItems () {
		if (!this._magicItemsByTable?.length) return [];

		return [...this._magicItemsByTable]
			.sort(({tier: tierA, type: typeA}, {tier: tierB, type: typeB}) => this.constructor._ascSortTier(tierB, tierA) || SortUtil.ascSortLower(typeA || "", typeB || ""))
			.map(magicItems => {
				// If we're in "tier" mode, sort the items into groups by rarity
				if (magicItems.tier) {
					const byRarity = {};

					magicItems.breakdown
						.forEach(lootItem => {
							if (!lootItem.item) return;

							const tgt = MiscUtil.getOrSet(byRarity, lootItem.item.rarity, []);
							tgt.push(lootItem);
						});

					const $ulsByRarity = Object.entries(byRarity)
						.sort(([rarityA], [rarityB]) => SortUtil.ascSortItemRarity(rarityB, rarityA))
						.map(([rarity, lootItems]) => {
							return $$`
								<li>${rarity.toTitleCase()} items (×${lootItems.length}):</li>
								<ul>${lootItems.map(it => it.$getRender())}</ul>
							`;
						});

					if (!$ulsByRarity.length) return null;

					return $$`
						<li>${magicItems.tier.toTitleCase()} items:</li>
						<ul>
							${$ulsByRarity}
						</ul>
					`;
				}

				return $$`
					<li>Magic Items${magicItems.type ? ` (${Renderer.get().render(`{@table Magic Item Table ${magicItems.type}||Table ${magicItems.type}}`)})` : ""}${(magicItems.count || 0) > 1 ? ` (×${magicItems.count})` : ""}</li>
					<ul>${magicItems.breakdown.map(it => it.$getRender())}</ul>
				`;
			});
	}

	doRemove () {
		if (this._$wrp) this._$wrp.remove();
	}

	static _ascSortTier (a, b) { return LootGenOutput._TIERS.indexOf(a) - LootGenOutput._TIERS.indexOf(b); }
}

globalThis.LootGenOutput = LootGenOutput;

class LootGenOutputGemsArtObjects {
	constructor (
		{
			type,
			typeRoll,
			typeTable,
			count,
			breakdown,
		},
	) {
		this.type = type;
		this.count = count;
		// region Unused--potential for wiring up rerolls from `LootGenOutput` UI, if required
		this.typeRoll = typeRoll;
		this.typeTable = typeTable;
		// endregion
		this.breakdown = breakdown;
	}
}

class LootGenOutputDragonMundaneItems {
	constructor (
		{
			count,
			breakdown,
		},
	) {
		this.count = count;
		this.breakdown = breakdown;
	}
}

class LootGenOutputMagicItems {
	constructor (
		{
			type,
			count,
			typeRoll,
			typeTable,
			breakdown,
			tier,
		},
	) {
		this.type = type;
		this.count = count;
		// region Unused--potential for wiring up rerolls from `LootGenOutput` UI, if required
		this.typeRoll = typeRoll;
		this.typeTable = typeTable;
		// endregion
		this.breakdown = breakdown;
		this.tier = tier;
	}
}

class LootGenMagicItem extends BaseComponent {
	static async pGetMagicItemRoll (
		{
			lootGenMagicItems,
			spells,
			magicItemTable,
			itemsAltChoose,
			itemsAltChooseDisplayText,
			isItemsAltChooseRoll = false,
			fnGetIsPreferAltChoose = null,
		},
	) {
		isItemsAltChooseRoll = isItemsAltChooseRoll && !!itemsAltChoose;
		if (isItemsAltChooseRoll) {
			const item = RollerUtil.rollOnArray(itemsAltChoose);

			return this._pGetMagicItemRoll_singleItem({
				item,
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
			});
		}

		if (!magicItemTable?.table) {
			return new LootGenMagicItemNull({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
			});
		}

		const rowRoll = RollerUtil.randomise(magicItemTable.diceType ?? 100);
		const row = magicItemTable.table.find(it => rowRoll >= it.min && rowRoll <= (it.max ?? it.min));

		if (row.spellLevel != null) {
			return new LootGenMagicItemSpellScroll({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: row.item,
				item: await this._pGetMagicItemRoll_pGetItem({nameOrUid: row.item}),
				roll: rowRoll,
				spellLevel: row.spellLevel,
				spell: RollerUtil.rollOnArray(spells.filter(it => it.level === row.spellLevel)),
			});
		}

		if (row.choose?.fromGeneric) {
			const subItems = (await row.choose.fromGeneric.pMap(nameOrUid => this._pGetMagicItemRoll_pGetItem({nameOrUid})))
				.map(it => it.variants.map(({specificVariant}) => specificVariant))
				.flat();

			return new LootGenMagicItemSubItems({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: row.item ?? `{@item ${row.choose.fromGeneric[0]}}`,
				item: RollerUtil.rollOnArray(subItems),
				roll: rowRoll,
				subItems,
			});
		}

		if (row.choose?.fromGroup) {
			const subItems = (await ((await row.choose.fromGroup.pMap(nameOrUid => this._pGetMagicItemRoll_pGetItem({nameOrUid})))
				.pMap(it => it.items.pMap(x => this._pGetMagicItemRoll_pGetItem({nameOrUid: x})))))
				.flat();

			return new LootGenMagicItemSubItems({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: row.item ?? `{@item ${row.choose.fromGroup[0]}}`,
				item: RollerUtil.rollOnArray(subItems),
				roll: rowRoll,
				subItems,
			});
		}

		if (row.choose?.fromItems) {
			const subItems = await row.choose?.fromItems.pMap(nameOrUid => this._pGetMagicItemRoll_pGetItem({nameOrUid}));

			return new LootGenMagicItemSubItems({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: row.item,
				item: RollerUtil.rollOnArray(subItems),
				roll: rowRoll,
				subItems,
			});
		}

		if (row.table) {
			const min = Math.min(...row.table.map(it => it.min));
			const max = Math.max(...row.table.map(it => it.max ?? min));

			const {subRowRoll, subRow, subItem} = await LootGenMagicItemTable.pGetSubRollMeta({
				min,
				max,
				subTable: row.table,
			});

			return new LootGenMagicItemTable({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: row.item,
				item: subItem,
				roll: rowRoll,
				table: row.table,
				tableMinRoll: min,
				tableMaxRoll: max,
				tableEntry: subRow.item,
				tableRoll: subRowRoll,
			});
		}

		return this._pGetMagicItemRoll_singleItem({
			item: await this._pGetMagicItemRoll_pGetItem({nameOrUid: row.item}),
			lootGenMagicItems,
			spells,
			magicItemTable,
			itemsAltChoose,
			itemsAltChooseDisplayText,
			isItemsAltChooseRoll,
			fnGetIsPreferAltChoose,
			baseEntry: row.item,
			roll: rowRoll,
		});
	}

	static async _pGetMagicItemRoll_singleItem (
		{
			item,
			lootGenMagicItems,
			spells,
			magicItemTable,
			itemsAltChoose,
			itemsAltChooseDisplayText,
			isItemsAltChooseRoll = false,
			fnGetIsPreferAltChoose = null,
			baseEntry,
			roll,
		},
	) {
		baseEntry = baseEntry || item
			? `{@item ${item.name}|${item.source}}`
			: `<span class="help-subtle" title="${LootGenMagicItemNull.TOOLTIP_NOTHING.qq()}">(no item)</span>`;

		if (item?.spellScrollLevel != null) {
			return new LootGenMagicItemSpellScroll({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry,
				item,
				spellLevel: item.spellScrollLevel,
				spell: RollerUtil.rollOnArray(spells.filter(it => it.level === item.spellScrollLevel)),
				roll,
			});
		}

		if (item?.variants?.length) {
			const subItems = item.variants.map(({specificVariant}) => specificVariant);

			return new LootGenMagicItemSubItems({
				lootGenMagicItems,
				spells,
				magicItemTable,
				itemsAltChoose,
				itemsAltChooseDisplayText,
				isItemsAltChooseRoll,
				fnGetIsPreferAltChoose,
				baseEntry: baseEntry,
				item: RollerUtil.rollOnArray(subItems),
				roll,
				subItems,
			});
		}

		return new LootGenMagicItem({
			lootGenMagicItems,
			spells,
			magicItemTable,
			itemsAltChoose,
			itemsAltChooseDisplayText,
			isItemsAltChooseRoll,
			fnGetIsPreferAltChoose,
			baseEntry,
			item,
			roll,
		});
	}

	static async _pGetMagicItemRoll_pGetItem ({nameOrUid}) {
		nameOrUid = nameOrUid.replace(/{@item ([^}]+)}/g, (...m) => m[1]);
		const uid = (nameOrUid.includes("|") ? nameOrUid : `${nameOrUid}|${Parser.SRC_DMG}`).toLowerCase();
		const [name, source] = uid.split("|");
		return DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, source, UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source}));
	}

	/**
	 * @param lootGenMagicItems The parent array in which this item is stored.
	 * @param spells Spell data list.
	 * @param magicItemTable The table this result was rolled form.
	 * @param itemsAltChoose Item list from which alternate rolls can be made.
	 * @param itemsAltChooseDisplayText Summary display text for the alternate roll options.
	 * @param isItemsAltChooseRoll If this item was rolled by an alt-choose roll.
	 * @param fnGetIsPreferAltChoose Function to call when checking if this should default to the "alt choose" item set.
	 * @param baseEntry The text, which may be an item itself, supplied by the `"item"` property in the row.
	 * @param item The rolled item.
	 * @param roll The roll result used to get this row.
	 */
	constructor (
		{
			lootGenMagicItems,
			spells,
			magicItemTable,
			itemsAltChoose,
			itemsAltChooseDisplayText,
			isItemsAltChooseRoll,
			fnGetIsPreferAltChoose,
			baseEntry,
			item,
			roll,
		},
	) {
		super();
		this._lootGenMagicItems = lootGenMagicItems;
		this._spells = spells;
		this._magicItemTable = magicItemTable;
		this._itemsAltChoose = itemsAltChoose;
		this._itemsAltChooseDisplayText = itemsAltChooseDisplayText;
		this._fnGetIsPreferAltChoose = fnGetIsPreferAltChoose;

		this._state.baseEntry = baseEntry;
		this._state.item = item;
		this._state.roll = roll;
		this._state.isItemsAltChooseRoll = isItemsAltChooseRoll;

		this._$render = null;
	}

	get item () { return this._state.item; }

	getExtensionExportMeta () {
		return {
			page: UrlUtil.PG_ITEMS,
			entity: this._state.item,
		};
	}

	async _pDoReroll ({isAltRoll = false} = {}) {
		const nxt = await this.constructor.pGetMagicItemRoll({
			lootGenMagicItems: this._lootGenMagicItems,
			spells: this._spells,
			magicItemTable: this._magicItemTable,
			itemsAltChoose: this._itemsAltChoose,
			itemsAltChooseDisplayText: this._itemsAltChooseDisplayText,
			isItemsAltChooseRoll: isAltRoll,
			fnGetIsPreferAltChoose: this._fnGetIsPreferAltChoose,
		});

		this._lootGenMagicItems.splice(this._lootGenMagicItems.indexOf(this), 1, nxt);

		if (!this._$render) return;
		this._$render.replaceWith(nxt.$getRender());
	}

	_$getBtnReroll () {
		if (!this._magicItemTable && !this._itemsAltChoose) return null;

		const isAltModeDefault = this._fnGetIsPreferAltChoose && this._fnGetIsPreferAltChoose();
		const title = this._itemsAltChoose
			? isAltModeDefault ? `SHIFT to roll on Magic Item Table ${this._magicItemTable.type}` : `SHIFT to roll ${Parser.getArticle(this._itemsAltChooseDisplayText)} ${this._itemsAltChooseDisplayText} item`
			: null;
		return $(`<span class="roller render-roller" ${title ? `title="${title}"` : ""}>[reroll]</span>`)
			.mousedown(evt => evt.preventDefault())
			.click(evt => this._pDoReroll({isAltRoll: isAltModeDefault ? !evt.shiftKey : evt.shiftKey}));
	}

	$getRender () {
		if (this._$render) return this._$render;
		return this._$render = this._$getRender();
	}

	_$getRender () {
		const $dispBaseEntry = this._$getRender_$getDispBaseEntry();
		const $dispRoll = this._$getRender_$getDispRoll();

		const $btnReroll = this._$getBtnReroll();

		return $$`<li class="split-v-center">
			<div class="ve-flex-v-center ve-flex-wrap pr-3">
				${$dispBaseEntry}
				${$dispRoll}
			</div>
			${$btnReroll}
		</li>`;
	}

	_$getRender_$getDispBaseEntry ({prop = "baseEntry"} = {}) {
		const $dispBaseEntry = $(`<div class="mr-2"></div>`);
		const hkBaseEntry = () => $dispBaseEntry.html(Renderer.get().render(this._state.isItemsAltChooseRoll ? `{@i ${this._state[prop]}}` : this._state[prop]));
		this._addHookBase(prop, hkBaseEntry);
		hkBaseEntry();
		return $dispBaseEntry;
	}

	_$getRender_$getDispRoll ({prop = "roll"} = {}) {
		const $dispRoll = $(`<div class="ve-muted"></div>`);
		const hkRoll = () => $dispRoll.text(this._state.isItemsAltChooseRoll ? `(${this._itemsAltChooseDisplayText} item)` : `(Rolled ${this._state[prop]})`);
		this._addHookBase(prop, hkRoll);
		hkRoll();
		return $dispRoll;
	}

	_getDefaultState () {
		return {
			...super._getDefaultState(),
			baseEntry: null,
			item: null,
			roll: null,
			isItemsAltChooseRoll: false,
		};
	}
}

class LootGenMagicItemNull extends LootGenMagicItem {
	static TOOLTIP_NOTHING = `Failed to generate a result! This is normally due to all potential matches being filtered out. You may want to adjust your filters to be more permissive.`;

	getExtensionExportMeta () { return null; }

	_$getRender () {
		return $$`<li class="split-v-center">
			<div class="ve-flex-v-center ve-flex-wrap ve-muted help-subtle" title="${this.constructor.TOOLTIP_NOTHING.qq()}">&mdash;</div>
		</li>`;
	}
}

class LootGenMagicItemSpellScroll extends LootGenMagicItem {
	constructor (
		{
			spellLevel,
			spell,
			...others
		},
	) {
		super(others);

		this._state.spellLevel = spellLevel;
		this._state.spell = spell;
	}

	getExtensionExportMeta () {
		if (this._state.spell == null) return null;

		return {
			page: UrlUtil.PG_SPELLS,
			entity: this._state.spell,
			options: {
				isSpellScroll: true,
			},
		};
	}

	_$getRender () {
		const $dispBaseEntry = this._$getRender_$getDispBaseEntry();
		const $dispRoll = this._$getRender_$getDispRoll();

		const $btnRerollSpell = $(`<span class="roller render-roller mr-2">[reroll]</span>`)
			.mousedown(evt => evt.preventDefault())
			.click(() => {
				this._state.spell = RollerUtil.rollOnArray(this._spells.filter(it => it.level === this._state.spellLevel));
			});

		const $dispSpell = $(`<div class="no-wrap"></div>`);
		const hkSpell = () => {
			if (!this._state.spell) return $dispSpell.html(`<span class="help-subtle" title="${LootGenMagicItemNull.TOOLTIP_NOTHING.qq()}">(no spell)</span>`);
			$dispSpell.html(Renderer.get().render(`{@spell ${this._state.spell.name}|${this._state.spell.source}}`));
		};
		this._addHookBase("spell", hkSpell);
		hkSpell();

		const $btnReroll = this._$getBtnReroll();

		return $$`<li class="split-v-center">
			<div class="ve-flex-v-center ve-flex-wrap pr-3">
				${$dispBaseEntry}
				<div class="ve-flex-v-center italic mr-2">
					<span>(</span>
					${$btnRerollSpell}
					${$dispSpell}
					<span class="ve-muted mx-2 no-wrap">-or-</span>
					<div class="no-wrap">${Renderer.get().render(`{@filter see all ${Parser.spLevelToFullLevelText(this._state.spellLevel, {isDash: true})} spells|spells|level=${this._state.spellLevel}}`)}</div>
					<span>)</span>
				</div>
				${$dispRoll}
			</div>
			${$btnReroll}
		</li>`;
	}

	_getDefaultState () {
		return {
			...super._getDefaultState(),
			spellLevel: null,
			spell: null,
		};
	}
}

class LootGenMagicItemSubItems extends LootGenMagicItem {
	constructor (
		{
			subItems,
			...others
		},
	) {
		super(others);
		this._subItems = subItems;
	}

	_$getRender () {
		const $dispBaseEntry = this._$getRender_$getDispBaseEntry();
		const $dispRoll = this._$getRender_$getDispRoll();

		const $btnRerollSubItem = $(`<span class="roller render-roller mr-2">[reroll]</span>`)
			.mousedown(evt => evt.preventDefault())
			.click(() => {
				this._state.item = RollerUtil.rollOnArray(this._subItems);
			});

		const $dispSubItem = $(`<div></div>`);
		const hkItem = () => $dispSubItem.html(Renderer.get().render(`{@item ${this._state.item.name}|${this._state.item.source}}`));
		this._addHookBase("item", hkItem);
		hkItem();

		const $btnReroll = this._$getBtnReroll();

		return $$`<li class="split-v-center">
			<div class="ve-flex-v-center ve-flex-wrap pr-3">
				${$dispBaseEntry}
				<div class="ve-flex-v-center italic mr-2">
					<span>(</span>
					${$btnRerollSubItem}
					${$dispSubItem}
					<span>)</span>
				</div>
				${$dispRoll}
			</div>
			${$btnReroll}
		</li>`;
	}
}

class LootGenMagicItemTable extends LootGenMagicItem {
	static async pGetSubRollMeta ({min, max, subTable}) {
		const subRowRoll = RollerUtil.randomise(max, min);
		const subRow = subTable.find(it => subRowRoll >= it.min && subRowRoll <= (it.max ?? it.min));

		return {
			subRowRoll,
			subRow,
			subItem: await this._pGetMagicItemRoll_pGetItem({nameOrUid: subRow.item}),
		};
	}

	constructor (
		{
			table,
			tableMinRoll,
			tableMaxRoll,
			tableEntry,
			tableRoll,
			...others
		},
	) {
		super(others);
		this._table = table;
		this._tableMinRoll = tableMinRoll;
		this._tableMaxRoll = tableMaxRoll;
		this._state.tableEntry = tableEntry;
		this._state.tableRoll = tableRoll;
	}

	_$getRender () {
		const $dispBaseEntry = this._$getRender_$getDispBaseEntry();
		const $dispRoll = this._$getRender_$getDispRoll();

		const $dispTableEntry = this._$getRender_$getDispBaseEntry({prop: "tableEntry"});
		const $dispTableRoll = this._$getRender_$getDispRoll({prop: "tableRoll"});

		const $btnReroll = this._$getBtnReroll();

		const $btnRerollSub = $(`<span class="roller render-roller ve-small ve-self-flex-end">[reroll]</span>`)
			.mousedown(evt => evt.preventDefault())
			.click(async () => {
				const {subRowRoll, subRow, subItem} = await LootGenMagicItemTable.pGetSubRollMeta({
					min: this._tableMinRoll,
					max: this._tableMaxRoll,
					subTable: this._table,
				});

				this._state.item = subItem;
				this._state.tableEntry = subRow.item;
				this._state.tableRoll = subRowRoll;
			});

		return $$`<li class="ve-flex-col">
			<div class="split-v-center">
				<div class="ve-flex-v-center ve-flex-wrap pr-3">
					${$dispBaseEntry}
					${$dispRoll}
				</div>
				${$btnReroll}
			</div>
			<div class="split-v-center pl-2">
				<div class="ve-flex-v-center ve-flex-wrap pr-3">
					<span class="ml-1 mr-2">&rarr;</span>
					${$dispTableEntry}
					${$dispTableRoll}
				</div>
				${$btnRerollSub}
			</div>
		</li>`;
	}
}

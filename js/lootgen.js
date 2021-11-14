"use strict";

class LootGenPage {
	constructor () {
		this._lootGenUi = null;
	}

	async pInit () {
		await ExcludeUtil.pInitialise();

		const $stgLhs = $(`#lootgen-lhs`);
		const $stgRhs = $(`#lootgen-rhs`);

		this._lootGenUi = new LootGenUi({
			spells: await this._pLoadSpells(),
			items: await this._pLoadItems(),
		});
		await this._lootGenUi.pInit();
		this._lootGenUi.render({$stgLhs, $stgRhs});

		const savedState = await StorageUtil.pGetForPage(LootGenPage._STORAGE_KEY_STATE);
		if (savedState != null) this._lootGenUi.setStateFrom(savedState);

		const savedStateDebounced = MiscUtil.throttle(this._pDoSaveState.bind(this), 100);
		this._lootGenUi.addHookAll("state", () => savedStateDebounced());
		this._lootGenUi.addHookAll("meta", () => savedStateDebounced());

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	async _pLoadSpells () {
		const [stockSpells, brew] = await Promise.all([
			DataUtil.spell.pLoadAll(),
			BrewUtil.pAddBrewData(),
		]);
		return stockSpells.concat(brew?.spell || [])
			.filter(sp => {
				return !ExcludeUtil.isExcluded(
					UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_SPELLS](sp),
					"spell",
					sp.source,
					{isNoCount: true},
				);
			});
	}

	async _pLoadItems () {
		const stockItems = await Renderer.item.pBuildList();
		const homebrew = await BrewUtil.pAddBrewData();
		const brewItems = await Renderer.item.pGetItemsFromHomebrew(homebrew);
		return stockItems.concat(brewItems)
			.filter(it => {
				return !ExcludeUtil.isExcluded(
					UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](it),
					"item",
					it.source,
					{isNoCount: true},
				);
			});
	}

	async _pDoSaveState () {
		const statGenState = this._lootGenUi.getSaveableState();
		await StorageUtil.pSetForPage(LootGenPage._STORAGE_KEY_STATE, statGenState);
	}
}
LootGenPage._STORAGE_KEY_STATE = "state";

const lootGenPage = new LootGenPage();

window.addEventListener("load", () => void lootGenPage.pInit());

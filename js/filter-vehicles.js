"use strict";

class PageFilterVehicles extends PageFilter {
	constructor () {
		super();

		this._vehicleTypeFilter = new Filter({
			header: "Vehicle Type",
			items: [],
			displayFn: Parser.vehicleTypeToFull,
			isSortByDisplayItems: true,
		});
		this._upgradeTypeFilter = new Filter({
			header: "Upgrade Type",
			items: [],
			displayFn: Parser.vehicleTypeToFull,
			isSortByDisplayItems: true,
		});
		this._terrainFilter = new Filter({header: "Terrain", items: ["land", "sea", "air"], displayFn: StrUtil.uppercaseFirst});
		this._speedFilter = new RangeFilter({header: "Speed"});
		this._acFilter = new RangeFilter({header: "Armor Class"});
		this._hpFilter = new RangeFilter({header: "Hit Points"});
		this._hpFilter = new RangeFilter({header: "Hit Points"});
		this._creatureCapacityFilter = new RangeFilter({header: "Creature Capacity"});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD", "Has Images", "Has Info", "Has Token"], isMiscFilter: true});
	}

	static mutateForFilters (it) {
		it._fSpeed = 0;
		if (typeof it.speed === "number" && it.speed > 0) {
			it._fSpeed = it.speed;
		} else if (it.speed) {
			const maxSpeed = Math.max(...Object.values(it.speed));
			if (maxSpeed > 0) it._fSpeed = maxSpeed;
		} else if (it.pace && typeof it.pace === "number") {
			it._fSpeed = it.pace * 10; // Based on "Special Travel Pace," DMG p242
		}

		it._fHp = 0;
		if (it.hp && it.hp.hp != null) {
			it._fHp = it.hp.hp;
		} else if (it.hull && it.hull.hp != null) {
			it._fHp = it.hull.hp;
		} else if (it.hp && it.hp.average != null) {
			it._fHp = it.hp.average;
		}

		it._fAc = 0;
		if (it.hull && it.hull.ac != null) {
			it._fAc = it.hull.ac;
		} else if (it.vehicleType === "INFWAR") {
			it._fAc = 19 + Parser.getAbilityModNumber(it.dex == null ? 10 : it.dex);
		} else if (it.ac instanceof Array) {
			it._fAc = it.ac.map(it => it.special ? null : (it.ac || it)).filter(it => it !== null);
		} else if (it.ac) {
			it._fAc = it.ac;
		}

		it._fCreatureCapacity = (it.capCrew || 0) + (it.capPassenger || 0) + (it.capCreature || 0);

		it._fMisc = it.srd ? ["SRD"] : [];
		if (it.tokenUrl || it.hasToken) it._fMisc.push("Has Token");
		if (it.hasFluff || it.fluff?.entries) it._fMisc.push("Has Info");
		if (it.hasFluffImages || it.fluff?.images) it._fMisc.push("Has Images");
	}

	addToFilters (it, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(it.source);
		this._vehicleTypeFilter.addItem(it.vehicleType);
		this._upgradeTypeFilter.addItem(it.upgradeType);
		this._speedFilter.addItem(it._fSpeed);
		this._terrainFilter.addItem(it.terrain);
		this._acFilter.addItem(it._fAc);
		this._hpFilter.addItem(it._fHp);
		this._creatureCapacityFilter.addItem(it._fCreatureCapacity);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._vehicleTypeFilter,
			this._upgradeTypeFilter,
			this._terrainFilter,
			this._speedFilter,
			this._acFilter,
			this._hpFilter,
			this._creatureCapacityFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, it) {
		return this._filterBox.toDisplay(
			values,
			it.source,
			it.vehicleType,
			it.upgradeType,
			it.terrain,
			it._fSpeed,
			it._fAc,
			it._fHp,
			it._fCreatureCapacity,
			it._fMisc,
		);
	}
}

globalThis.PageFilterVehicles = PageFilterVehicles;

class ListSyntaxVehicles extends ListUiUtil.ListSyntax {
	static _INDEXABLE_PROPS_ENTRIES = [
		"control",
		"movement",
		"weapon",
		"other",
		"entries",

		"actionStation",

		"action",
		"trait",
		"reaction",
	];
}

globalThis.ListSyntaxVehicles = ListSyntaxVehicles;

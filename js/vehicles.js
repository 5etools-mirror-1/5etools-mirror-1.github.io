"use strict";

class VehiclesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subvehicles",
		});
	}

	pGetSublistItem (it, hash) {
		const displayType = it.vehicleType ? Parser.vehicleTypeToFull(it.vehicleType) : it.upgradeType.map(t => Parser.vehicleTypeToFull(t));

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col"><a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-8 pl-0 text-center">${displayType}</span>
			<span class="bold col-4 pr-0">${it.name}</span>
		</a></div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			it.name,
			{
				hash,
				vehicleType: it.vehicleType,
				upgradeType: it.upgradeType,
				type: displayType,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class VehiclesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterVehicles();
		super({
			dataSource: "data/vehicles.json",
			dataSourceFluff: "data/fluff-vehicles.json",

			pageFilter,

			listClass: "vehicles",

			dataProps: ["vehicle", "vehicleUpgrade"],
		});
	}

	getListItem (it, vhI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);
		const displayType = it.vehicleType ? Parser.vehicleTypeToFull(it.vehicleType) : it.upgradeType.map(t => Parser.vehicleTypeToFull(t));

		eleLi.innerHTML = `<a href="#${UrlUtil.autoEncodeHash(it)}" class="lst--border lst__row-inner">
			<span class="col-6 pl-0 text-center">${displayType}</span>
			<span class="bold col-4">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${BrewUtil2.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			vhI,
			eleLi,
			it.name,
			{
				hash,
				source,
				vehicleType: it.vehicleType,
				upgradeType: it.upgradeType,
				type: displayType,
			},
			{
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	handleFilterChange () {
		const f = this._filterBox.getValues();
		this._list.filter(item => this._pageFilter.toDisplay(f, this._dataList[item.ix]));
		FilterBox.selectFirstVisible(this._dataList);
	}

	_doLoadHash (id) {
		Renderer.get().setFirstSection(true);
		const veh = this._dataList[id];
		this._$pgContent.empty();
		(this._$dispToken = this._$dispToken || $(`#float-token`)).empty();

		const buildStatsTab = () => {
			if (veh.vehicleType) {
				const hasToken = veh.tokenUrl || veh.hasToken;
				if (hasToken) {
					const imgLink = Renderer.vehicle.getTokenUrl(veh);
					this._$dispToken.append(`<a href="${imgLink}" target="_blank" rel="noopener noreferrer"><img src="${imgLink}" id="token_image" class="token" alt="Token Image: ${(veh.name || "").qq()}"></a>`);
				}

				this._$pgContent.append(RenderVehicles.$getRenderedVehicle(veh));
			} else {
				this._$pgContent.append(RenderVehicles.$getRenderedVehicle(veh));
			}
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				entity: veh,
				pFnGetFluff: Renderer.vehicle.pGetFluff,
			});
		};

		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Item",
				fnChange: () => this._$dispToken.show(),
				fnPopulate: buildStatsTab,
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnChange: () => this._$dispToken.hide(),
				fnPopulate: buildFluffTab,
				isVisible: Renderer.utils.hasFluffText(veh, "vehicleFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnChange: () => this._$dispToken.hide(),
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(veh, "vehicleFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		this._updateSelected();
	}

	_getSearchCache (entity) {
		if (this.constructor._INDEXABLE_PROPS.every(it => !entity[it])) return "";
		const ptrOut = {_: ""};
		this.constructor._INDEXABLE_PROPS.forEach(it => this._getSearchCache_handleEntryProp(entity, it, ptrOut));
		return ptrOut._;
	}
}
VehiclesPage._INDEXABLE_PROPS = [
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

const vehiclesPage = new VehiclesPage();
vehiclesPage.sublistManager = new VehiclesSublistManager();
window.addEventListener("load", () => vehiclesPage.pOnLoad());

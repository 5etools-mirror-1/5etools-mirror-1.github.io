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
			<span class="col-8 pl-0 ve-text-center">${displayType}</span>
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
		const pFnGetFluff = Renderer.vehicle.pGetFluff.bind(Renderer.vehicle);

		super({
			dataSource: "data/vehicles.json",
			dataSourceFluff: "data/fluff-vehicles.json",

			pFnGetFluff,

			pageFilter,

			listClass: "vehicles",

			dataProps: ["vehicle", "vehicleUpgrade"],

			listSyntax: new ListSyntaxVehicles({fnGetDataList: () => this._dataList, pFnGetFluff}),
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
			<span class="col-6 pl-0 ve-text-center">${displayType}</span>
			<span class="bold col-4">${it.name}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
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

	_renderStats_doBuildStatsTab ({ent}) {
		(this._$dispToken = this._$dispToken || $(`#float-token`)).empty();

		if (ent.vehicleType) {
			const hasToken = ent.tokenUrl || ent.hasToken;
			if (hasToken) {
				const imgLink = Renderer.vehicle.getTokenUrl(ent);
				this._$dispToken.append(`<a href="${imgLink}" target="_blank" rel="noopener noreferrer"><img src="${imgLink}" id="token_image" class="token" alt="Token Image: ${(ent.name || "").qq()}"></a>`);
			}

			this._$pgContent.empty().append(RenderVehicles.$getRenderedVehicle(ent));
		} else {
			this._$pgContent.empty().append(RenderVehicles.$getRenderedVehicle(ent));
		}
	}

	_renderStats_onTabChangeStats () {
		this._$dispToken.showVe();
	}

	_renderStats_onTabChangeFluff () {
		this._$dispToken.hideVe();
	}
}

const vehiclesPage = new VehiclesPage();
vehiclesPage.sublistManager = new VehiclesSublistManager();
window.addEventListener("load", () => vehiclesPage.pOnLoad());

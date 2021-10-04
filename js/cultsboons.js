"use strict";

class CultsBoonsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterCultsBoons();
		super({
			dataSource: "data/cultsboons.json",

			pageFilter,

			listClass: "cultsboons",

			sublistClass: "subcultsboons",

			dataProps: ["cult", "boon"],
		});
	}

	getListItem (it, bcI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		it._lType = it.__prop === "cult" ? "Cult" : "Boon";
		it._lSubType = it.type || "\u2014";

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-2 text-center pl-0">${it._lType}</span>
			<span class="col-2 text-center">${it._lSubType}</span>
			<span class="bold col-6">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			bcI,
			eleLi,
			it.name,
			{
				hash,
				source,
				type: it._lType,
				subType: it._lSubType,
			},
			{
				uniqueId: it.uniqueId ? it.uniqueId : bcI,
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => ListUtil.openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	handleFilterChange () {
		const f = this._filterBox.getValues();
		this._list.filter(item => this._pageFilter.toDisplay(f, this._dataList[item.ix]));
		FilterBox.selectFirstVisible(this._dataList);
	}

	getSublistItem (it, ix) {
		const hash = UrlUtil.autoEncodeHash(it);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-2 text-center pl-0">${it._lType}</span>
				<span class="col-2 text-center">${it._lSubType}</span>
				<span class="bold col-8 pr-0">${it.name}</span>
			</a>
		</div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			it.name,
			{
				hash,
				type: it._lType,
				subType: it._lSubType,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const it = this._dataList[id];

		this._$pgContent.empty().append(RenderCultsBoons.$getRenderedCultBoon(it));

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub);
	}
}

const cultsBoonsPage = new CultsBoonsPage();
window.addEventListener("load", () => cultsBoonsPage.pOnLoad());

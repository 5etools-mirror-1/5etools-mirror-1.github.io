"use strict";

class DeitiesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterDeities();
		super({
			dataSource: DataUtil.deity.loadJSON,

			pageFilter,

			listClass: "deities",

			sublistClass: "subdeities",

			dataProps: ["deity"],
		});
	}

	getListItem (g, dtI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(g, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(g.source);
		const hash = UrlUtil.autoEncodeHash(g);
		const alignment = g.alignment ? g.alignment.join("") : "\u2014";
		const domains = g.domains.join(", ");

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-3 pl-0">${g.name}</span>
			<span class="col-2 text-center">${g.pantheon}</span>
			<span class="col-2 text-center">${alignment}</span>
			<span class="col-3 ${g.domains[0] === VeCt.STR_NONE ? `list-entry-none` : ""}">${domains}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(g.source)} pr-0" title="${Parser.sourceJsonToFull(g.source)}" ${BrewUtil.sourceJsonToStyle(g.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			dtI,
			eleLi,
			g.name,
			{
				hash,
				source,
				title: g.title || "",
				pantheon: g.pantheon,
				alignment,
				domains,
			},
			{
				uniqueId: g.uniqueId ? g.uniqueId : dtI,
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

	getSublistItem (g, ix) {
		const hash = UrlUtil.autoEncodeHash(g);

		const alignment = g.alignment ? g.alignment.join("") : "\u2014";
		const domains = g.domains.join(", ");

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${g.name}</span>
				<span class="col-2">${g.pantheon}</span>
				<span class="col-2">${alignment}</span>
				<span class="col-4 ${g.domains[0] === VeCt.STR_NONE ? `list-entry-none` : ""} pr-0">${domains}</span>
			</a>
		</div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			g.name,
			{
				hash,
				pantheon: g.pantheon,
				alignment,
				domains,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const deity = this._dataList[id];

		this._$pgContent.empty().append(RenderDeities.$getRenderedDeity(deity));

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub);
	}
}

const deitiesPage = new DeitiesPage();
window.addEventListener("load", () => deitiesPage.pOnLoad());

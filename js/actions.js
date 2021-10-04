"use strict";

class ActionsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterActions();
		super({
			dataSource: "data/actions.json",

			pageFilter,

			listClass: "actions",

			sublistClass: "subactions",

			dataProps: ["action"],

			isPreviewable: true,
		});
	}

	getListItem (it, anI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);
		const time = it.time ? it.time.map(tm => PageFilterActions.getTimeText(tm)).join("/") : "\u2014";

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 flex-vh-center lst__btn-toggle-expand self-flex-stretch">[+]</span>
			<span class="col-5-7 px-1 bold">${it.name}</span>
			<span class="col-4 text-center">${time}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${source}</span>
		</a>
		<div class="flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
		</div>`;

		const listItem = new ListItem(
			anI,
			eleLi,
			it.name,
			{
				hash,
				source,
				time,
			},
			{
				uniqueId: it.uniqueId ? it.uniqueId : anI,
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

		const time = it.time ? it.time.map(tm => PageFilterActions.getTimeText(tm)).join("/") : "\u2014";

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-8 pl-0">${it.name}</span>
				<span class="text-center col-4 pr-0">${time}</span>
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
				time,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const it = this._dataList[id];
		this._$pgContent.empty().append(RenderActions.$getRenderedAction(it));
		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub);
	}
}

const actionsPage = new ActionsPage();
window.addEventListener("load", () => actionsPage.pOnLoad());

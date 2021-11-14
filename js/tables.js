"use strict";

class TablesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterTables();
		super({
			dataSource: DataUtil.table.loadJSON,

			pageFilter,

			listClass: "tablesdata",
			listOptions: {
				sortByInitial: "sortName",
			},

			sublistClass: "subtablesdata",
			sublistOptions: {
				sortByInitial: "sortName",
			},

			dataProps: ["table", "tableGroup"],
		});
	}

	getListItem (it, tbI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const sortName = it.name.replace(/^\s*([\d,.]+)\s*gp/, (...m) => m[1].replace(Parser._numberCleanRegexp, "").padStart(9, "0"));

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-10 pl-0">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			tbI,
			eleLi,
			it.name,
			{
				hash,
				sortName,
				source,
			},
			{
				uniqueId: it.uniqueId ? it.uniqueId : tbI,
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

	pGetSublistItem (it, ix) {
		const hash = UrlUtil.autoEncodeHash(it);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col"><a href="#${hash}" class="lst--border lst__row-inner" title="${it.name}"><span class="bold col-12 px-0">${it.name}</span></a></div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			it.name,
			{
				hash,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		Renderer.get().setFirstSection(true);
		const it = this._dataList[id];

		this._$pgContent.empty().append(RenderTables.$getRenderedTable(it));

		ListUtil.updateSelected();
	}

	_getSearchCache (entity) {
		if (!entity.rows && !entity.tables) return "";
		const ptrOut = {_: ""};
		this._getSearchCache_handleEntryProp(entity, "rows", ptrOut);
		this._getSearchCache_handleEntryProp(entity, "tables", ptrOut);
		return ptrOut._;
	}
}

const tablesPage = new TablesPage();
window.addEventListener("load", () => tablesPage.pOnLoad());

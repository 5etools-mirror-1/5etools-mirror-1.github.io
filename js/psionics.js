"use strict";

class PsionicsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subpsionics",
		});
	}

	pGetSublistItem (it, hash) {
		const typeMeta = Parser.psiTypeToMeta(it.type);

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-6 pl-0">${it.name}</span>
				<span class="col-3">${typeMeta.short}</span>
				<span class="col-3 ${it._fOrder === VeCt.STR_NONE ? "list-entry-none" : ""} pr-0">${it._fOrder}</span>
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			it.name,
			{
				hash,
				type: typeMeta.full,
				order: it._fOrder,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class PsionicsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterPsionics();
		super({
			dataSource: "data/psionics.json",

			pageFilter,

			listClass: "psionics",

			sublistClass: "subpsionics",

			dataProps: ["psionic"],

			bookViewOptions: {
				$btnOpen: $(`#btn-psibook`),
				$eleNoneVisible: $(`<span class="initial-message">If you wish to view multiple psionics, please first make a list</span>`),
				pageTitle: "Psionics Book View",
				fnPartition: it => it.type === "T" ? 0 : 1,
			},

			tableViewOptions: {
				title: "Psionics",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					_text: {name: "Text", transform: (it) => Renderer.psionic.getBodyText(it, Renderer.get()), flex: 3},
				},
			},
		});
	}

	static _getHiddenModeList (psionic) {
		return (psionic.modes || [])
			.map(mode => {
				return [
					`"${mode.name}"`,
					...(mode.submodes || [])
						.map(subMode => `"${subMode.name}"`),
				];
			})
			.flat()
			.join(",");
	}

	getListItem (p, psI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(p, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(p.source);
		const hash = UrlUtil.autoEncodeHash(p);
		const typeMeta = Parser.psiTypeToMeta(p.type);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-6 pl-0">${p.name}</span>
			<span class="col-2 text-center">${typeMeta.short}</span>
			<span class="col-2 text-center ${p._fOrder === VeCt.STR_NONE ? "list-entry-none" : ""}">${p._fOrder}</span>
			<span class="col-2 text-center pr-0" title="${Parser.sourceJsonToFull(p.source)}" ${BrewUtil2.sourceJsonToStyle(p.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			psI,
			eleLi,
			p.name,
			{
				hash,
				source,
				type: typeMeta.full,
				order: p._fOrder,
				searchModeList: this.constructor._getHiddenModeList(p),
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
		const psi = this._dataList[id];

		this._$pgContent.empty().append(RenderPsionics.$getRenderedPsionic(psi));

		this._updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = await super.pDoLoadSubHash(sub);
		await this._bookView.pHandleSub(sub);
	}

	_getSearchCache (entity) {
		if (!entity.entries && !entity.modes && !entity.focus) return "";
		const ptrOut = {_: ""};
		this._getSearchCache_handleEntryProp(entity, "entries", ptrOut);
		this._getSearchCache_handleEntryProp(entity, "modes", ptrOut);
		this._getSearchCache_handleEntryProp(entity, "focus", ptrOut);
		return ptrOut._;
	}
}

const psionicsPage = new PsionicsPage();
psionicsPage.sublistManager = new PsionicsSublistManager();
window.addEventListener("load", () => psionicsPage.pOnLoad());

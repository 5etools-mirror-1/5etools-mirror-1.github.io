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
				namePlural: "psionics",
				pageTitle: "Psionics Book View",
				fnPartition: ent => ent.type === "T" ? 0 : 1,
			},

			tableViewOptions: {
				title: "Psionics",
				colTransforms: {
					name: UtilsTableview.COL_TRANSFORM_NAME,
					source: UtilsTableview.COL_TRANSFORM_SOURCE,
					_text: {name: "Text", transform: (it) => Renderer.psionic.getBodyText(it, Renderer.get()), flex: 3},
				},
			},

			listSyntax: new ListSyntaxPsionics({fnGetDataList: () => this._dataList}),
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
			<span class="col-2 ve-text-center">${typeMeta.short}</span>
			<span class="col-2 ve-text-center ${p._fOrder === VeCt.STR_NONE ? "list-entry-none" : ""}">${p._fOrder}</span>
			<span class="col-2 ve-text-center pr-0" title="${Parser.sourceJsonToFull(p.source)}" ${Parser.sourceJsonToStyle(p.source)}>${source}</span>
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

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderPsionics.$getRenderedPsionic(ent));
	}
}

const psionicsPage = new PsionicsPage();
psionicsPage.sublistManager = new PsionicsSublistManager();
window.addEventListener("load", () => psionicsPage.pOnLoad());

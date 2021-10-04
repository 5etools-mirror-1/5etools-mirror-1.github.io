"use strict";

function getHiddenModeList (psionic) {
	const modeList = psionic.modes;
	if (modeList === undefined) return "";
	const outArray = [];
	for (let i = 0; i < modeList.length; ++i) {
		outArray.push(`"${modeList[i].name}"`);
		if (modeList[i].submodes != null) {
			const subModes = modeList[i].submodes;
			for (let j = 0; j < subModes.length; ++j) {
				outArray.push(`"${subModes[j].name}"`)
			}
		}
	}
	return outArray.join(",");
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
				popTblGetNumShown: $wrpContent => {
					const toShow = ListUtil.getSublistedIds().map(id => this._dataList[id]);

					const stack = [];
					const renderPsionic = (p) => {
						stack.push(`<div class="bkmv__wrp-item"><table class="stats stats--book stats--bkmv"><tbody>`);
						stack.push(Renderer.psionic.getCompactRenderedString(p));
						stack.push(`</tbody></table></div>`);
					};

					const renderType = (type) => {
						const toRender = toShow.filter(p => p.type === type);
						if (toRender.length) {
							toRender.forEach(p => renderPsionic(p));
						}
					};

					renderType("T");
					renderType("D");

					if (!toShow.length && Hist.lastLoadedId != null) {
						renderPsionic(this._dataList[Hist.lastLoadedId]);
					}

					if (!toShow.length && Hist.lastLoadedId != null) {
						stack.push(`<tr class="spellbook-level"><td>`);
						renderPsionic(this._dataList[Hist.lastLoadedId]);
						stack.push(`</td></tr>`);
					}

					$wrpContent.append(stack.join(""));
					return toShow.length;
				},
			},

			tableViewOptions: {
				title: "Psionics",
				colTransforms: {
					name: {name: "Name", transform: true},
					source: {name: "Source", transform: (it) => `<span class="${Parser.sourceJsonToColor(it)}" title="${Parser.sourceJsonToFull(it)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${Parser.sourceJsonToAbv(it)}</span>`},
					_text: {name: "Text", transform: (it) => Renderer.psionic.getBodyText(it, Renderer.get()), flex: 3},
				},
				filter: {generator: ListUtil.basicFilterGenerator},
				sorter: (a, b) => SortUtil.ascSort(a.name, b.name) || SortUtil.ascSort(a.source, b.source),
			},
		});
	}

	getListItem (p, psI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(p, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(p.source);
		const hash = UrlUtil.autoEncodeHash(p);
		const typeMeta = Parser.psiTypeToMeta(p.type);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-6 pl-0">${p.name}</span>
			<span class="col-2 text-center">${typeMeta.short}</span>
			<span class="col-2 text-center ${p._fOrder === VeCt.STR_NONE ? "list-entry-none" : ""}">${p._fOrder}</span>
			<span class="col-2 text-center pr-0" title="${Parser.sourceJsonToFull(p.source)}" ${BrewUtil.sourceJsonToStyle(p.source)}>${source}</span>
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
				searchModeList: getHiddenModeList(p),
			},
			{
				uniqueId: p.uniqueId ? p.uniqueId : psI,
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

	getSublistItem (p, ix) {
		const hash = UrlUtil.autoEncodeHash(p);
		const typeMeta = Parser.psiTypeToMeta(p.type);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-6 pl-0">${p.name}</span>
				<span class="col-3">${typeMeta.short}</span>
				<span class="col-3 ${p._fOrder === VeCt.STR_NONE ? "list-entry-none" : ""} pr-0">${p._fOrder}</span>
			</a>
		</div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			p.name,
			{
				hash,
				type: typeMeta.full,
				order: p._fOrder,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const psi = this._dataList[id];

		this._$pgContent.empty().append(RenderPsionics.$getRenderedPsionic(psi));

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub);

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
window.addEventListener("load", () => psionicsPage.pOnLoad());

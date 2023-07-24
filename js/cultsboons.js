"use strict";

class CultsBoonsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subcultsboons",
		});
	}

	pGetSublistItem (it, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-2 ve-text-center pl-0">${it._lType}</span>
				<span class="col-2 ve-text-center">${it._lSubType}</span>
				<span class="bold col-8 pr-0">${it.name}</span>
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
				type: it._lType,
				subType: it._lSubType,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class CultsBoonsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterCultsBoons();
		super({
			dataSource: "data/cultsboons.json",

			pageFilter,

			listClass: "cultsboons",

			dataProps: ["cult", "boon"],
		});
	}

	getListItem (it, bcI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		it._lType = it.__prop === "cult" ? "Cult" : "Boon";
		it._lSubType = it.type || "\u2014";

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-2 ve-text-center pl-0">${it._lType}</span>
			<span class="col-2 ve-text-center">${it._lSubType}</span>
			<span class="bold col-6">${it.name}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
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
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderCultsBoons.$getRenderedCultBoon(ent));
	}
}

const cultsBoonsPage = new CultsBoonsPage();
cultsBoonsPage.sublistManager = new CultsBoonsSublistManager();
window.addEventListener("load", () => cultsBoonsPage.pOnLoad());

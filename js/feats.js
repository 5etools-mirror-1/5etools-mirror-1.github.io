"use strict";

class FeatsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterFeats();
		super({
			dataSource: "data/feats.json",

			pageFilter,

			listClass: "feats",

			sublistClass: "subfeats",

			dataProps: ["feat"],

			isPreviewable: true,
		});
	}

	getListItem (feat, ftI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(feat, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(feat.source);
		const hash = UrlUtil.autoEncodeHash(feat);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 flex-vh-center lst__btn-toggle-expand self-flex-stretch">[+]</span>
			<span class="bold col-3-5 px-1">${feat.name}</span>
			<span class="col-3-5 ${feat._slAbility === VeCt.STR_NONE ? "list-entry-none " : ""}">${feat._slAbility}</span>
			<span class="col-3 ${feat._slPrereq === VeCt.STR_NONE ? "list-entry-none " : ""}">${feat._slPrereq}</span>
			<span class="source col-1-7 text-center ${Parser.sourceJsonToColor(feat.source)} pr-0" title="${Parser.sourceJsonToFull(feat.source)}" ${BrewUtil.sourceJsonToStyle(feat.source)}>${source}</span>
		</a>
		<div class="flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
		</div>`;

		const listItem = new ListItem(
			ftI,
			eleLi,
			feat.name,
			{
				hash,
				source,
				ability: feat._slAbility,
				prerequisite: feat._slPrereq,
			},
			{
				uniqueId: feat.uniqueId ? feat.uniqueId : ftI,
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

	pGetSublistItem (feat, ix) {
		const hash = UrlUtil.autoEncodeHash(feat);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${feat.name}</span>
				<span class="col-4 ${feat._slAbility === VeCt.STR_NONE ? "list-entry-none" : ""}">${feat._slAbility}</span>
				<span class="col-4 ${feat._slPrereq === VeCt.STR_NONE ? "list-entry-none" : ""} pr-0">${feat._slPrereq}</span>
			</a>
		</div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			feat.name,
			{
				hash,
				ability: feat._slAbility,
				prerequisite: feat._slPrereq,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const feat = this._dataList[id];

		this._$pgContent.empty().append(RenderFeats.$getRenderedFeat(feat));

		ListUtil.updateSelected();
	}
}

const featsPage = new FeatsPage();
window.addEventListener("load", () => featsPage.pOnLoad());

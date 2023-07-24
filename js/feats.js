"use strict";

class FeatsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subfeats",
		});
	}

	pGetSublistItem (it, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${it.name}</span>
				<span class="col-4 ${it._slAbility === VeCt.STR_NONE ? "list-entry-none" : ""}">${it._slAbility}</span>
				<span class="col-4 ${it._slPrereq === VeCt.STR_NONE ? "list-entry-none" : ""} pr-0">${it._slPrereq}</span>
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
				ability: it._slAbility,
				prerequisite: it._slPrereq,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class FeatsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterFeats();
		super({
			dataSource: DataUtil.feat.loadJSON.bind(DataUtil.feat),
			dataSourceFluff: DataUtil.featFluff.loadJSON.bind(DataUtil.featFluff),

			pFnGetFluff: Renderer.feat.pGetFluff.bind(Renderer.feat),

			pageFilter,

			listClass: "feats",

			dataProps: ["feat"],

			bookViewOptions: {
				namePlural: "feats",
				pageTitle: "Feats Book View",
			},

			isPreviewable: true,
		});
	}

	getListItem (feat, ftI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(feat, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(feat.source);
		const hash = UrlUtil.autoEncodeHash(feat);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 ve-flex-vh-center lst__btn-toggle-expand ve-self-flex-stretch">[+]</span>
			<span class="bold col-3-5 px-1">${feat.name}</span>
			<span class="col-3-5 ${feat._slAbility === VeCt.STR_NONE ? "list-entry-none " : ""}">${feat._slAbility}</span>
			<span class="col-3 ${feat._slPrereq === VeCt.STR_NONE ? "list-entry-none " : ""}">${feat._slPrereq}</span>
			<span class="source col-1-7 ve-text-center ${Parser.sourceJsonToColor(feat.source)} pr-0" title="${Parser.sourceJsonToFull(feat.source)}" ${Parser.sourceJsonToStyle(feat.source)}>${source}</span>
		</a>
		<div class="ve-flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="ve-flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
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
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderFeats.$getRenderedFeat(ent));
	}
}

const featsPage = new FeatsPage();
featsPage.sublistManager = new FeatsSublistManager();
window.addEventListener("load", () => featsPage.pOnLoad());

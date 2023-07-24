"use strict";

class ConditionsDiseasesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subconditions",
		});
	}

	pGetSublistItem (it, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-2 pl-0 ve-text-center">${PageFilterConditionsDiseases.getDisplayProp(it.__prop)}</span>
				<span class="bold col-10 pr-0">${it.name}</span>
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
				type: it.__prop,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class ConditionsDiseasesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterConditionsDiseases();

		super({
			dataSource: "data/conditionsdiseases.json",

			pFnGetFluff: Renderer.condition.pGetFluff.bind(Renderer.condition),

			pageFilter,

			listClass: "conditions",

			dataProps: ["condition", "disease", "status"],

			isPreviewable: true,
		});
	}

	getListItem (it, cdI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 ve-flex-vh-center lst__btn-toggle-expand ve-self-flex-stretch">[+]</span>
			<span class="col-3 ve-text-center">${PageFilterConditionsDiseases.getDisplayProp(it.__prop)}</span>
			<span class="bold col-6-7 px-1">${it.name}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
		</a>
		<div class="ve-flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="ve-flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
		</div>`;

		const listItem = new ListItem(
			cdI,
			eleLi,
			it.name,
			{
				hash,
				source,
				type: it.__prop,
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
		this._$pgContent.empty().append(RenderConditionDiseases.$getRenderedConditionDisease(ent));
	}
}

const conditionsDiseasesPage = new ConditionsDiseasesPage();
conditionsDiseasesPage.sublistManager = new ConditionsDiseasesSublistManager();
window.addEventListener("load", () => conditionsDiseasesPage.pOnLoad());

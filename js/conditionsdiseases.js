"use strict";

class ConditionsDiseasesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterConditionsDiseases();

		super({
			dataSource: "data/conditionsdiseases.json",

			pageFilter,

			listClass: "conditions",

			sublistClass: "subconditions",

			dataProps: ["condition", "disease", "status"],

			isPreviewable: true,
		});
	}

	getListItem (it, cdI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 flex-vh-center lst__btn-toggle-expand self-flex-stretch">[+]</span>
			<span class="col-3 text-center">${PageFilterConditionsDiseases.getDisplayProp(it.__prop)}</span>
			<span class="bold col-6-7 px-1">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${source}</span>
		</a>
		<div class="flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
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
				uniqueId: it.uniqueId ? it.uniqueId : cdI,
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

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-2 pl-0 text-center">${PageFilterConditionsDiseases.getDisplayProp(it.__prop)}</span>
				<span class="bold col-10 pr-0">${it.name}</span>
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
				type: it.__prop,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		this._$pgContent.empty();
		const it = this._dataList[id];

		const buildStatsTab = () => {
			this._$pgContent.append(RenderConditionDiseases.$getRenderedConditionDisease(it));
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				entity: it,
				pFnGetFluff: Renderer.condition.pGetFluff,
			});
		};

		const fluffProp = it.__prop === "condition" ? "conditionFluff" : "diseaseFluff";

		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Traits",
				fnPopulate: buildStatsTab,
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnPopulate: buildFluffTab,
				isVisible: Renderer.utils.hasFluffText(it, fluffProp),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(it, fluffProp),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = this._filterBox.setFromSubHashes(sub);
		await ListUtil.pSetFromSubHashes(sub);
	}
}

const conditionsDiseasesPage = new ConditionsDiseasesPage();
window.addEventListener("load", () => conditionsDiseasesPage.pOnLoad());

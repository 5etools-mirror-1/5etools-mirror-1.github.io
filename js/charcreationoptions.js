"use strict";

class CharCreationOptionsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterCharCreationOptions();
		super({
			dataSource: "data/charcreationoptions.json",
			dataSourceFluff: "data/fluff-charcreationoptions.json",

			pageFilter,

			listClass: "charcreationoptions",

			sublistClass: "subcharcreationoptions",

			dataProps: ["charoption"],
		});
	}

	getListItem (it, itI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const hash = UrlUtil.autoEncodeHash(it);
		const source = Parser.sourceJsonToAbv(it.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-5 text-center pl-0">${it._fOptionType}</span>
			<span class="bold col-5">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)}" title="${Parser.sourceJsonToFull(it.source)} pr-0" ${BrewUtil.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			itI,
			eleLi,
			it.name,
			{
				hash,
				source,
				type: it._fOptionType,
			},
			{
				uniqueId: it.uniqueId || itI,
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

		const $ele = $$`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-5 text-center pl-0">${it._fOptionType}</span>
				<span class="bold col-7 pr-0">${it.name}</span>
			</a>
		</div>`
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			it.name,
			{
				hash,
				source: Parser.sourceJsonToAbv(it.source),
				type: it._fOptionType,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		this._$pgContent.empty();
		const it = this._dataList[id];

		const buildStatsTab = () => {
			this._$pgContent.append(RenderCharCreationOptions.$getRenderedCharCreationOption(it));
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				entity: it,
				pFnGetFluff: Renderer.charoption.pGetFluff,
			});
		};

		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Traits",
				fnPopulate: buildStatsTab,
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnPopulate: buildFluffTab.bind,
				isVisible: Renderer.utils.hasFluffText(it, "charoptionFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(it, "charoptionFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		ListUtil.updateSelected();
	}
}

const charCreationOptionsPage = new CharCreationOptionsPage();
window.addEventListener("load", () => charCreationOptionsPage.pOnLoad());

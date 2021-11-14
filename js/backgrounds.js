"use strict";

class BackgroundPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterBackgrounds();
		super({
			dataSource: "data/backgrounds.json",
			dataSourceFluff: "data/fluff-backgrounds.json",

			pageFilter,

			listClass: "backgrounds",

			sublistClass: "subbackgrounds",

			dataProps: ["background"],
		});
	}

	getListItem (bg, bgI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(bg, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const name = bg.name.replace("Variant ", "");
		const hash = UrlUtil.autoEncodeHash(bg);
		const source = Parser.sourceJsonToAbv(bg.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-4 pl-0">${name}</span>
			<span class="col-6">${bg._skillDisplay}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(bg.source)} pr-0" title="${Parser.sourceJsonToFull(bg.source)}" ${BrewUtil.sourceJsonToStyle(bg.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			bgI,
			eleLi,
			name,
			{
				hash,
				source,
				skills: bg._skillDisplay,
			},
			{
				uniqueId: bg.uniqueId || bgI,
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

	pGetSublistItem (bg, ix) {
		const name = bg.name.replace("Variant ", "");
		const hash = UrlUtil.autoEncodeHash(bg);
		const skills = Renderer.background.getSkillSummary(bg.skillProficiencies || [], true);

		const $ele = $$`<div class="lst__row lst__row--sublist flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${name}</span>
				<span class="col-8 pr-0">${skills}</span>
			</a>
		</div>`
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			name,
			{
				hash,
				source: Parser.sourceJsonToAbv(bg.source),
				skills,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		this._$pgContent.empty();

		this._renderer.setFirstSection(true);
		const bg = this._dataList[id];

		const buildStatsTab = () => {
			this._$pgContent.append(RenderBackgrounds.$getRenderedBackground(bg));
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				pFnGetFluff: Renderer.background.pGetFluff,
				entity: bg,
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
				fnPopulate: buildFluffTab,
				isVisible: Renderer.utils.hasFluffText(bg, "backgroundFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(bg, "backgroundFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		ListUtil.updateSelected();
	}
}

const backgroundsPage = new BackgroundPage();
window.addEventListener("load", () => backgroundsPage.pOnLoad());

"use strict";

class BackgroundSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subbackgrounds",
		});
	}

	pGetSublistItem (it, hash) {
		const name = it.name.replace("Variant ", "");
		const skills = Renderer.background.getSkillSummary(it.skillProficiencies || [], true);

		const $ele = $$`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${name}</span>
				<span class="col-8 pr-0">${skills}</span>
			</a>
		</div>`
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			name,
			{
				hash,
				source: Parser.sourceJsonToAbv(it.source),
				skills,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class BackgroundPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterBackgrounds();
		super({
			dataSource: DataUtil.background.loadJSON.bind(DataUtil.background),
			dataSourceFluff: DataUtil.backgroundFluff.loadJSON.bind(DataUtil.backgroundFluff),

			pageFilter,

			listClass: "backgrounds",

			dataProps: ["background"],
		});
	}

	getListItem (bg, bgI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(bg, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const name = bg.name.replace("Variant ", "");
		const hash = UrlUtil.autoEncodeHash(bg);
		const source = Parser.sourceJsonToAbv(bg.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-4 pl-0">${name}</span>
			<span class="col-6">${bg._skillDisplay}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(bg.source)} pr-0" title="${Parser.sourceJsonToFull(bg.source)}" ${BrewUtil2.sourceJsonToStyle(bg.source)}>${source}</span>
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

		this._updateSelected();
	}
}

const backgroundsPage = new BackgroundPage();
backgroundsPage.sublistManager = new BackgroundSublistManager();
window.addEventListener("load", () => backgroundsPage.pOnLoad());

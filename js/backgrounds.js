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

			pFnGetFluff: Renderer.background.pGetFluff.bind(Renderer.background),

			pageFilter,

			listClass: "backgrounds",

			bookViewOptions: {
				namePlural: "backgrounds",
				pageTitle: "Backgrounds Book View",
			},

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
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(bg.source)} pr-0" title="${Parser.sourceJsonToFull(bg.source)}" ${Parser.sourceJsonToStyle(bg.source)}>${source}</span>
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

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderBackgrounds.$getRenderedBackground(ent));
	}
}

const backgroundsPage = new BackgroundPage();
backgroundsPage.sublistManager = new BackgroundSublistManager();
window.addEventListener("load", () => backgroundsPage.pOnLoad());

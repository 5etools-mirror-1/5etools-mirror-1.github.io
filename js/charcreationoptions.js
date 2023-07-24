"use strict";

class CharCreationOptionsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subcharcreationoptions",
		});
	}

	pGetSublistItem (it, hash) {
		const $ele = $$`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="col-5 ve-text-center pl-0">${it._fOptionType}</span>
				<span class="bold col-7 pr-0">${it.name}</span>
			</a>
		</div>`
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			it.name,
			{
				hash,
				source: Parser.sourceJsonToAbv(it.source),
				type: it._fOptionType,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class CharCreationOptionsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterCharCreationOptions();
		super({
			dataSource: DataUtil.charoption.loadJSON.bind(DataUtil.charoption),
			dataSourceFluff: DataUtil.charoptionFluff.loadJSON.bind(DataUtil.charoptionFluff),

			pFnGetFluff: Renderer.charoption.pGetFluff.bind(Renderer.charoption),

			pageFilter,

			listClass: "charcreationoptions",

			dataProps: ["charoption"],
		});
	}

	getListItem (it, itI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const hash = UrlUtil.autoEncodeHash(it);
		const source = Parser.sourceJsonToAbv(it.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-5 ve-text-center pl-0">${it._fOptionType}</span>
			<span class="bold col-5">${it.name}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(it.source)}" title="${Parser.sourceJsonToFull(it.source)} pr-0" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
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
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$pgContent.empty().append(RenderCharCreationOptions.$getRenderedCharCreationOption(ent));
	}
}

const charCreationOptionsPage = new CharCreationOptionsPage();
charCreationOptionsPage.sublistManager = new CharCreationOptionsSublistManager();
window.addEventListener("load", () => charCreationOptionsPage.pOnLoad());

"use strict";

class ObjectsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subobjects",
		});
	}

	pGetSublistItem (it, hash) {
		const size = Parser.sizeAbvToFull(it.size);

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-9 pl-0">${it.name}</span>
				<span class="col-3 pr-0 ve-text-center">${size}</span>
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
				size,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class ObjectsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterObjects();
		const pFnGetFluff = Renderer.object.pGetFluff.bind(Renderer.object);

		super({
			dataSource: DataUtil.object.loadJSON.bind(DataUtil.object),
			dataSourceFluff: DataUtil.objectFluff.loadJSON.bind(DataUtil.objectFluff),

			pFnGetFluff,

			pageFilter,

			listClass: "objects",

			dataProps: ["object"],

			listSyntax: new ListSyntaxObjects({fnGetDataList: () => this._dataList, pFnGetFluff}),
		});

		this._$dispToken = null;
	}

	getListItem (obj, obI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(obj, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(obj.source);
		const hash = UrlUtil.autoEncodeHash(obj);
		const size = Parser.sizeAbvToFull(obj.size);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-8 pl-0">${obj.name}</span>
			<span class="col-2 ve-text-center">${size}</span>
			<span class="col-2 ve-text-center ${Parser.sourceJsonToColor(obj.source)} pr-0" title="${Parser.sourceJsonToFull(obj.source)}" ${Parser.sourceJsonToStyle(obj.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			obI,
			eleLi,
			obj.name,
			{
				hash,
				source,
				size,
			},
			{
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_tabTitleStats = "Stats";

	async _pDoLoadHash (id) {
		const ent = this._dataList[id];

		const tabMetaStats = new Renderer.utils.TabButton({
			label: this._tabTitleStats,
			fnChange: () => {
				this._$dispToken.showVe();
			},
			fnPopulate: () => this._renderStatblock_doBuildStatsTab(ent),
			isVisible: true,
		});

		const tabMetasAdditional = this._renderStats_getTabMetasAdditional({ent});

		Renderer.utils.bindTabButtons({
			tabButtons: [tabMetaStats, ...tabMetasAdditional],
			tabLabelReference: [tabMetaStats, ...tabMetasAdditional].map(it => it.label),
			$wrpTabs: this._$wrpTabs,
			$pgContent: this._$pgContent,
		});

		this._updateSelected();

		await this._renderStats_pBuildFluffTabs({
			ent,
			tabMetaStats,
			tabMetasAdditional,
		});
	}

	_renderStatblock_doBuildStatsTab (obj) {
		const renderStack = [];

		if (obj.entries) this._renderer.recursiveRender({entries: obj.entries}, renderStack, {depth: 2});
		if (obj.actionEntries) this._renderer.recursiveRender({entries: obj.actionEntries}, renderStack, {depth: 2});

		this._$pgContent.empty().append(RenderObjects.$getRenderedObject(obj));

		(this._$dispToken = this._$dispToken || $(`#float-token`)).empty();

		const hasToken = obj.tokenUrl || obj.hasToken;
		if (hasToken) {
			const imgLink = Renderer.object.getTokenUrl(obj);
			this._$dispToken.append(`<a href="${imgLink}" target="_blank" rel="noopener noreferrer"><img src="${imgLink}" id="token_image" class="token" alt="Token Image: ${(obj.name || "").qq()}" loading="lazy"></a>`);
		}
	}

	_renderStats_onTabChangeStats () {
		this._$dispToken.showVe();
	}

	_renderStats_onTabChangeFluff () {
		this._$dispToken.hideVe();
	}
}

const objectsPage = new ObjectsPage();
objectsPage.sublistManager = new ObjectsSublistManager();
window.addEventListener("load", () => objectsPage.pOnLoad());

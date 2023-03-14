"use strict";

class RecipesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subrecipes",
		});
	}

	_getCustomHashId ({entity}) {
		return Renderer.recipe.getCustomHashId(entity);
	}

	async pGetSublistItem (itRaw, hash, {customHashId = null} = {}) {
		const it = await Renderer.hover.pApplyCustomHashId(UrlUtil.getCurrentPage(), itRaw, customHashId);
		const name = it._displayName || it.name;

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-9 pl-0">${name}</span>
				<span class="col-3 text-center pr-0">${it.type || "\u2014"}</span>
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			name,
			{
				hash,
				type: it.type,
			},
			{
				entity: it,
				customHashId,
			},
		);
		return listItem;
	}
}

class RecipesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterRecipes();
		const pFnGetFluff = Renderer.recipe.pGetFluff.bind(Renderer.recipe);

		super({
			dataSource: DataUtil.recipe.loadJSON.bind(DataUtil.recipe),
			prereleaseDataSource: DataUtil.recipe.loadPrerelease.bind(DataUtil.recipe),
			brewDataSource: DataUtil.recipe.loadBrew.bind(DataUtil.recipe),

			pFnGetFluff,

			pageFilter,

			listClass: "recipes",

			dataProps: ["recipe"],

			listSyntax: new ListSyntaxRecipes({fnGetDataList: () => this._dataList, pFnGetFluff}),
		});
	}

	getListItem (it, rpI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-6 bold pl-0">${it.name}</span>
			<span class="col-4 text-center">${it.type || "\u2014"}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			rpI,
			eleLi,
			it.name,
			{
				hash,
				source,
				type: it.type,
			},
			{
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_tabTitleStats = "Recipe";

	_renderStats_doBuildStatsTab ({ent, scaleFactor = null}) {
		if (scaleFactor != null) ent = Renderer.recipe.getScaledRecipe(ent, scaleFactor);

		const $selScaleFactor = $(`
			<select title="Scale Recipe" class="form-control input-xs form-control--minimal ve-popwindow__hidden">
				${[0.5, 1, 2, 3, 4].map(it => `<option value="${it}">×${it}</option>`)}
			</select>`)
			.change(() => {
				const scaleFactor = Number($selScaleFactor.val());

				if (scaleFactor !== this._lastRender?._scaleFactor) {
					if (scaleFactor === 1) Hist.setSubhash(VeCt.HASH_SCALED, null);
					else Hist.setSubhash(VeCt.HASH_SCALED, scaleFactor);
				}
			});
		$selScaleFactor.val(`${scaleFactor || 1}`);

		this._$pgContent.empty().append(RenderRecipes.$getRenderedRecipe(ent, {$selScaleFactor}));
		this._lastRender = {entity: ent};
	}

	async pDoLoadSubHash (sub) {
		sub = await super.pDoLoadSubHash(sub);

		const scaledHash = sub.find(it => it.startsWith(RecipesPage._HASH_START_SCALED));
		if (scaledHash) {
			const scaleFactor = Number(UrlUtil.unpackSubHash(scaledHash)[VeCt.HASH_SCALED][0]);
			const r = this._dataList[Hist.lastLoadedId];
			this._renderStats_doBuildStatsTab({ent: r, scaleFactor});
		}
	}
}
RecipesPage._HASH_START_SCALED = `${VeCt.HASH_SCALED}${HASH_SUB_KV_SEP}`;

const recipesPage = new RecipesPage();
recipesPage.sublistManager = new RecipesSublistManager();

window.addEventListener("load", () => recipesPage.pOnLoad());

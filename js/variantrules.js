"use strict";

class VariantRulesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterVariantRules();
		super({
			dataSource: DataUtil.variantrule.loadJSON,

			pageFilter,

			listClass: "variantrules",

			sublistClass: "subvariantrules",

			dataProps: ["variantrule"],
		});
	}

	getListItem (rule, rlI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(rule, isExcluded);

		const searchStack = [];
		for (const e1 of rule.entries) {
			Renderer.getNames(searchStack, e1);
		}

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(rule.source);
		const hash = UrlUtil.autoEncodeHash(rule);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-7 pl-0">${rule.name}</span>
			<span class="col-3 text-center">${rule.ruleType ? Parser.ruleTypeToFull(rule.ruleType) : "\u2014"}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(rule.source)} pr-0" title="${Parser.sourceJsonToFull(rule.source)}" ${BrewUtil.sourceJsonToStyle(rule.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			rlI,
			eleLi,
			rule.name,
			{
				hash,
				search: searchStack.join(","),
				source,
				ruleType: rule.ruleType || "",
			},
			{
				uniqueId: rule.uniqueId ? rule.uniqueId : rlI,
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

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col"><a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-10 pl-0">${it.name}</span>
				<span class="col-3 text-center pr-0">${it.ruleType ? Parser.ruleTypeToFull(it.ruleType) : "\u2014"}</span>
			</a></div>`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			it.name,
			{
				hash,
				ruleType: it.ruleType || "",
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const rule = this._dataList[id];

		this._$pgContent.empty().append(RenderVariantRules.$getRenderedVariantRule(rule));

		ListUtil.updateSelected();
	}

	async pDoLoadSubHash (sub) {
		sub = await super.pDoLoadSubHash(sub);

		if (!sub.length) return;
		const $title = $(`.rd__h[data-title-index="${sub[0]}"]`);
		if ($title.length) $title[0].scrollIntoView();
	}
}

const variantRulesPage = new VariantRulesPage();
window.addEventListener("load", () => variantRulesPage.pOnLoad());

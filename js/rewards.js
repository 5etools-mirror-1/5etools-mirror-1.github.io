"use strict";

class RewardsSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subrewards",
		});
	}

	pGetSublistItem (reward, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="name col-2 pl-0 text-center">${reward.type}</span>
				<span class="name col-10 pr-0">${reward.name}</span>
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			reward.name,
			{
				hash,
				type: reward.type,
			},
			{
				entity: reward,
			},
		);
		return listItem;
	}
}

class RewardsPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterRewards();
		super({
			dataSource: "data/rewards.json",

			pageFilter,

			listClass: "rewards",

			dataProps: ["reward"],
		});
	}

	getListItem (reward, rwI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(reward, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(reward.source);
		const hash = UrlUtil.autoEncodeHash(reward);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-2 text-center pl-0">${reward.type}</span>
			<span class="bold col-8">${reward.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(reward.source)} pr-0" title="${Parser.sourceJsonToFull(reward.source)}" ${BrewUtil2.sourceJsonToStyle(reward.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			rwI,
			eleLi,
			reward.name,
			{
				hash,
				source,
				type: reward.type,
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
		Renderer.get().setFirstSection(true);
		const reward = this._dataList[id];

		this._$pgContent.empty().append(RenderRewards.$getRenderedReward(reward));

		this._updateSelected();
	}
}

const rewardsPage = new RewardsPage();
rewardsPage.sublistManager = new RewardsSublistManager();
window.addEventListener("load", () => rewardsPage.pOnLoad());

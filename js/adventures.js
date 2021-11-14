"use strict";

class Adventures {
	static sortAdventures (dataList, a, b, o) {
		a = dataList[a.ix];
		b = dataList[b.ix];

		if (o.sortBy === "name") return byName();
		if (o.sortBy === "storyline") return orFallback(SortUtil.ascSort, "storyline");
		if (o.sortBy === "level") return orFallback(SortUtil.ascSort, "_startLevel");
		if (o.sortBy === "published") return SortUtil.ascSortDate(a._pubDate, b._pubDate) || SortUtil.ascSort(b.publishedOrder || 0, a.publishedOrder || 0) || byName();

		function byName () {
			return SortUtil.ascSort(a.name, b.name);
		}

		function orFallback (func, prop) {
			const initial = func(a[prop] || "", b[prop] || "");
			return initial || byName();
		}
	}

	static getLevelsStr (adv) {
		if (adv.level.custom) return adv.level.custom;
		return `Level ${adv.level.start}\u2013${adv.level.end}`;
	}
}
const adventuresList = new BooksList({
	contentsUrl: "data/adventures.json",
	fnSort: Adventures.sortAdventures,
	sortByInitial: "published",
	sortDirInitial: "desc",
	dataProp: "adventure",
	enhanceRowDataFn: (adv) => {
		adv._startLevel = adv.level.start || 20;
		adv._pubDate = new Date(adv.published);
	},
	rootPage: "adventure.html",
	rowBuilderFn: (adv) => {
		return `<span class="col-6-2 bold">${adv.name}</span>
		<span class="col-2-5">${adv.storyline || "\u2014"}</span>
		<span class="col-1-3">${Adventures.getLevelsStr(adv)}</span>
		<span class="col-2">${BooksList.getDateStr(adv)}</span>`;
	},
});

window.addEventListener("load", () => adventuresList.pOnPageLoad());

function handleBrew (homebrew) {
	adventuresList.addData(homebrew);
	return Promise.resolve();
}

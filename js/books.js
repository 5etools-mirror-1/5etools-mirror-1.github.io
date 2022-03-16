"use strict";

class Books {
	static sortBooks (dataList, a, b, o) {
		a = dataList[a.ix];
		b = dataList[b.ix];
		if (o.sortBy === "group") return SortUtil.ascSortSourceGroup(a, b) || SortUtil.ascSortDate(b._pubDate, a._pubDate) || SortUtil.ascSort(a.name, b.name)
		if (o.sortBy === "published") return SortUtil.ascSortDate(b._pubDate, a._pubDate) || SortUtil.ascSort(a.name, b.name);
		return SortUtil.ascSort(a.name, b.name);
	}
}

const booksList = new BooksList({
	contentsUrl: "data/books.json",
	fnSort: Books.sortBooks,
	sortByInitial: "group",
	sortDirInitial: "asc",
	dataProp: "book",
	rootPage: "book.html",
	enhanceRowDataFn: (bk) => {
		bk._pubDate = new Date(bk.published || "1970-01-01");
	},
	rowBuilderFn: (bk) => {
		return `<span class="col-9 bold">${bk.name}</span>
		<span class="col-1-3">${BooksList.getGroupStr(bk)}</span>
		<span class="col-2">${BooksList.getDateStr(bk)}</span>`;
	},
});

window.addEventListener("load", () => booksList.pOnPageLoad());

function handleBrew (homebrew) {
	booksList.addData(homebrew);
	return Promise.resolve();
}

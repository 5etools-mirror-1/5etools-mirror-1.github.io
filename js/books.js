"use strict";

class BooksList extends AdventuresBooksList {
	constructor () {
		super({
			contentsUrl: "data/books.json",
			fnSort: AdventuresBooksList._sortAdventuresBooks.bind(AdventuresBooksList),
			sortByInitial: "group",
			sortDirInitial: "asc",
			dataProp: "book",
			rootPage: "book.html",
			enhanceRowDataFn: (bk) => {
				bk._pubDate = new Date(bk.published || "1970-01-01");
			},
			rowBuilderFn: (bk) => {
				return `
					<span class="col-1-3 ve-text-center">${AdventuresBooksList._getGroupStr(bk)}</span>
					<span class="col-8-5 bold">${bk.name}</span>
					<span class="ve-grow ve-text-center code">${AdventuresBooksList._getDateStr(bk)}</span>
				`;
			},
		});
	}
}

const booksList = new BooksList();

window.addEventListener("load", () => booksList.pOnPageLoad());

function handleBrew (homebrew) {
	booksList.addData(homebrew);
	return Promise.resolve();
}

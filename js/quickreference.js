"use strict";

// NOTE: This file is generated with the Node script `generate-quick-reference.js`
const JSON_URL = "data/generated/bookref-quick.json";

let reference;

window.addEventListener("load", async () => {
	BookUtil.$dispBook = $(`#pagecontent`);

	if (!window.location.hash.length) {
		BookUtil.$dispBook
			.empty()
			.append(Renderer.utils.getBorderTr())
			.append(`<tr><td colspan="6" class="initial-message">Select a section to begin</td></tr>`)
			.append(Renderer.utils.getBorderTr());
	}

	await ExcludeUtil.pInitialise();
	DataUtil.loadJSON(JSON_URL).then(onJsonLoad);
});

function onJsonLoad (data) {
	reference = [data.reference["bookref-quick"]];
	BookUtil.contentType = "document";

	BookUtil.isDefaultExpandedContents = true;
	BookUtil.baseDataUrl = "data/generated/";
	BookUtil.bookIndex = reference;
	BookUtil.referenceId = "bookref-quick";
	BookUtil.initLinkGrabbers();
	BookUtil.initScrollTopFloat();

	window.onhashchange = BookUtil.booksHashChange.bind(BookUtil);
	if (window.location.hash.length) {
		BookUtil.booksHashChange();
	} else {
		window.location.hash = "#bookref-quick";
	}

	window.dispatchEvent(new Event("toolsLoaded"));
}

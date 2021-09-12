"use strict";

class BooksList {
	static getDateStr (it) {
		if (!it.published) return "\u2014";
		const date = new Date(it.published);
		return MiscUtil.dateToStr(date);
	}

	constructor (options) {
		this._contentsUrl = options.contentsUrl;
		this._fnSort = options.fnSort;
		this._sortByInitial = options.sortByInitial;
		this._sortDirInitial = options.sortDirInitial;
		this._dataProp = options.dataProp;
		this._enhanceRowDataFn = options.enhanceRowDataFn;
		this._rootPage = options.rootPage;
		this._rowBuilderFn = options.rowBuilderFn;

		this._list = null;
		this._listAlt = null;
		this._dataIx = 0;
		this._dataList = [];
	}

	async pOnPageLoad () {
		const [data] = await Promise.all([
			await DataUtil.loadJSON(`${Renderer.get().baseUrl}${this._contentsUrl}`),
			await ExcludeUtil.pInitialise(),
		]);

		const $iptSearch = $(`#search`);

		const fnSort = (a, b, o) => this._fnSort(this._dataList, a, b, o);
		this._list = new List({
			$wrpList: $(".books"),
			$iptSearch,
			fnSort,
			sortByInitial: this._sortByInitial,
			sortDirInitial: this._sortDirInitial,
			isUseJquery: true,
		});
		SortUtil.initBtnSortHandlers($(`#filtertools`), this._list);

		const $wrpBookshelf = $(".books--alt");
		this._listAlt = new List({
			$wrpList: $wrpBookshelf,
			$iptSearch,
			fnSort,
			sortByInitial: this._sortByInitial,
			sortDirInitial: this._sortDirInitial,
		});

		$("#reset").click(() => {
			this._list.reset();
			this._listAlt.reset();

			this._list.items.forEach(li => {
				if (li.data.$btnToggleExpand.text() === "[\u2012]") li.data.$btnToggleExpand.click();
			});
		});

		this.addData(data);
		const brewData = await BrewUtil.pAddBrewData();
		await handleBrew(brewData);
		BrewUtil.bind({lists: [this._list, this._listAlt]});
		BrewUtil.makeBrewButton("manage-brew");
		this._list.init();
		this._listAlt.init();

		if (ExcludeUtil.isAllContentExcluded(this._list)) $wrpBookshelf.append(ExcludeUtil.getAllContentBlacklistedHtml());

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	addData (data) {
		if (!data[this._dataProp] || !data[this._dataProp].length) return;

		this._dataList.push(...data[this._dataProp]);

		for (; this._dataIx < this._dataList.length; this._dataIx++) {
			const it = this._dataList[this._dataIx];
			if (this._enhanceRowDataFn) this._enhanceRowDataFn(it);

			const isExcluded = ExcludeUtil.isExcluded(UrlUtil.URL_TO_HASH_BUILDER[this._rootPage](it), this._dataProp, it.source);

			const $elesContents = [];
			it.contents.map((chapter, ixChapter) => {
				const $lnkChapter = $$`<a href="${this._rootPage}#${UrlUtil.encodeForHash(it.id)},${ixChapter}" class="flex w-100 bklist__row-chapter lst--border lst__row-inner lst__row lst__wrp-cells bold">
					${Parser.bookOrdinalToAbv(chapter.ordinal)}${chapter.name}
				</a>`;
				$elesContents.push($lnkChapter);

				if (!chapter.headers) return;

				const headerCounts = {};

				chapter.headers.forEach(header => {
					const headerText = BookUtil.getHeaderText(header);

					const headerTextClean = headerText.toLowerCase().trim();
					const headerPos = headerCounts[headerTextClean] || 0;
					headerCounts[headerTextClean] = (headerCounts[headerTextClean] || 0) + 1;
					const $lnk = $$`<a href="${this._rootPage}#${UrlUtil.encodeForHash(it.id)},${ixChapter},${UrlUtil.encodeForHash(headerText)}${header.index ? `,${header.index}` : ""}${headerPos > 0 ? `,${headerPos}` : ""}" class="lst__row lst--border lst__row-inner lst__wrp-cells bklist__row-section flex w-100">
						${BookUtil.getContentsSectionHeader(header)}
					</a>`;
					$elesContents.push($lnk);
				});
			});

			const $wrpContents = $$`<div class="flex w-100 relative">
				<div class="vr-0 absolute bklist__vr-contents"></div>
				<div class="flex-col w-100 bklist__wrp-rows-inner">${$elesContents}</div>
			</div>`.hideVe();

			const $btnToggleExpand = $(`<span class="px-2 py-1p bold">[+]</span>`)
				.click(evt => {
					evt.stopPropagation();
					evt.preventDefault();
					$btnToggleExpand.text($btnToggleExpand.text() === "[+]" ? "[\u2012]" : "[+]");
					$wrpContents.toggleVe();
				});

			const $eleLi = $$`<div class="flex-col w-100">
				<a href="${this._rootPage}#${UrlUtil.encodeForHash(it.id)}" class="split-v-center lst--border lst__row-inner lst__row ${isExcluded ? `lst__row--blacklisted` : ""}">
					<span class="w-100 flex">${this._rowBuilderFn(it)}</span>
					${$btnToggleExpand}
				</a>
				${$wrpContents}
			</div>`;

			const listItem = new ListItem(
				this._dataIx,
				$eleLi,
				it.name,
				{source: it.id},
				{uniqueId: it.uniqueId, $btnToggleExpand},
			);

			this._list.addItem(listItem);

			// region Alt list (covers/thumbnails)
			const eleLiAlt = $(`<a href="${this._rootPage}#${UrlUtil.encodeForHash(it.id)}" class="flex-col flex-v-center m-3 bks__wrp-bookshelf-item ${isExcluded ? `bks__wrp-bookshelf-item--blacklisted` : ""} py-3 px-2 ${Parser.sourceJsonToColor(it.source)}" ${BrewUtil.sourceJsonToStyle(it.source)}>
				<img src="${it.coverUrl || `${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/covers/blank.png`}" class="mb-2 bks__bookshelf-image" loading="lazy" alt="Cover Image: ${(it.name || "").qq()}">
				<div class="bks__bookshelf-item-name flex-vh-center text-center">${it.name}</div>
			</a>`)[0];
			const listItemAlt = new ListItem(
				this._dataIx,
				eleLiAlt,
				it.name,
				{source: it.id},
				{uniqueId: it.uniqueId},
			);
			this._listAlt.addItem(listItemAlt);
			// endregion
		}

		this._list.update();
		this._listAlt.update();
	}
}

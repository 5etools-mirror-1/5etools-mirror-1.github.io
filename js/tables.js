"use strict";

class TablesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "subtablesdata",
			sublistListOptions: {
				sortByInitial: "sortName",
			},
		});
	}

	pGetSublistItem (it, hash) {
		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col"><a href="#${hash}" class="lst--border lst__row-inner" title="${it.name}"><span class="bold col-12 px-0">${it.name}</span></a></div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			it.name,
			{
				hash,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class TablesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterTables();
		super({
			dataSource: DataUtil.table.loadJSON.bind(DataUtil.table),

			pageFilter,

			listClass: "tablesdata",
			listOptions: {
				sortByInitial: "sortName",
			},

			dataProps: ["table", "tableGroup"],

			listSyntax: new ListSyntaxTables({fnGetDataList: () => this._dataList}),
		});
	}

	get _bindOtherButtonsOptions () {
		return {
			other: [
				{
					name: "Copy as CSV",
					pFn: () => this._pCopyRenderedAsCsv(),
				},
			],
		};
	}

	async _pCopyRenderedAsCsv () {
		const ent = this._dataList[Hist.lastLoadedId];

		const tbls = ent.tables || [ent];
		const txt = tbls
			.map(tbl => {
				const parser = new DOMParser();
				const rows = tbl.rows.map(row => row.map(cell => parser.parseFromString(`<div>${Renderer.get().render(cell)}</div>`, "text/html").documentElement.textContent));

				const headerRowMetas = Renderer.table.getHeaderRowMetas(tbl) || [];
				const [headerRowMetasAsHeaders, ...headerRowMetasAsRows] = headerRowMetas
					.map(headerRowMeta => headerRowMeta.map(it => Renderer.stripTags(it)));

				return DataUtil.getCsv(
					headerRowMetasAsHeaders,
					[
						// If there are extra headers, treat them as rows
						...headerRowMetasAsRows,
						...rows,
					],
				);
			})
			.join("\n\n");

		await MiscUtil.pCopyTextToClipboard(txt);
		JqueryUtil.doToast("Copied!");
	}

	getListItem (it, tbI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const sortName = it.name.replace(/^\s*([\d,.]+)\s*gp/, (...m) => m[1].replace(Parser._numberCleanRegexp, "").padStart(9, "0"));

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-10 pl-0">${it.name}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(it.source)} pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			tbI,
			eleLi,
			it.name,
			{
				hash,
				sortName,
				source,
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
		this._$pgContent.empty().append(RenderTables.$getRenderedTable(ent));
	}
}

const tablesPage = new TablesPage();
tablesPage.sublistManager = new TablesSublistManager();
window.addEventListener("load", () => tablesPage.pOnLoad());

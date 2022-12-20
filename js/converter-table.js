"use strict";

if (typeof module !== "undefined") {
	const cv = require("./converterutils.js");
	Object.assign(global, cv);
	require("./utils-proporder.js");
}

class TableParser extends BaseParser {
	/**
	 * Parses tables from HTML.
	 * @param inText Input text.
	 * @param options Options object.
	 * @param options.cbWarning Warning callback.
	 * @param options.cbOutput Output callback.
	 * @param options.isAppend Default output append mode.
	 * @param options.source Entity source.
	 * @param options.page Entity page.
	 * @param options.titleCaseFields Array of fields to be title-cased in this entity (if enabled).
	 * @param options.isTitleCase Whether title-case fields should be title-cased in this entity.
	 */
	static doParseHtml (inText, options) {
		options = this._getValidOptions(options);

		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		inText = this._getCleanInput(inText, options);

		const handleTable = ($table, caption) => {
			const tbl = {
				type: "table",
				caption,
				colLabels: [],
				colStyles: [],
				rows: [],
			};

			const getCleanHeaderText = ($ele) => {
				let txt = $ele.text().trim();

				// if it's all-uppercase, title-case it
				if (txt.toUpperCase() === txt) txt = txt.toTitleCase();

				return txt;
			};

			// Caption
			if ($table.find(`caption`)) {
				tbl.caption = $table.find(`caption`).text().trim();
			}

			// Columns
			if ($table.find(`thead`)) {
				const $headerRows = $table.find(`thead tr`);
				if ($headerRows.length !== 1) options.cbWarning(`Table header had ${$headerRows.length} rows!`);
				$headerRows.each((i, r) => {
					const $r = $(r);
					if (i === 0) { // use first tr as column headers
						$r.find(`th, td`).each((i, h) => tbl.colLabels.push(getCleanHeaderText($(h))));
					} else { // use others as rows
						const row = [];
						$r.find(`th, td`).each((i, h) => row.push(getCleanHeaderText($(h))));
						if (row.length) tbl.rows.push(row);
					}
				});
				$table.find(`thead`).remove();
			} else if ($table.find(`th`)) {
				$table.find(`th`).each((i, h) => tbl.colLabels.push(getCleanHeaderText($(h))));
				$table.find(`th`).parent().remove();
			}

			// Rows
			const handleTableRow = (i, r) => {
				const $r = $(r);
				const row = [];
				$r.find(`td`).each((i, cell) => {
					const $cell = $(cell);
					row.push($cell.text().trim());
				});
				tbl.rows.push(row);
			};

			if ($table.find(`tbody`)) {
				$table.find(`tbody tr`).each(handleTableRow);
			} else {
				$table.find(`tr`).each(handleTableRow);
			}

			MarkdownConverter.postProcessTable(tbl);
			options.cbOutput(tbl, options.isAppend);
		};

		const $input = $(inText);
		if ($input.is("table")) {
			handleTable($input);
		} else {
			// TODO pull out any preceding text to use as the caption; pass this in
			const caption = "";
			$input.find("table").each((i, e) => {
				const $table = $(e);
				handleTable($table, caption);
			});
		}
	}

	/**
	 * Parses tables from Markdown.
	 * @param inText Input text.
	 * @param options Options object.
	 * @param options.cbWarning Warning callback.
	 * @param options.cbOutput Output callback.
	 * @param options.isAppend Default output append mode.
	 * @param options.source Entity source.
	 * @param options.page Entity page.
	 * @param options.titleCaseFields Array of fields to be title-cased in this entity (if enabled).
	 * @param options.isTitleCase Whether title-case fields should be title-cased in this entity.
	 */
	static doParseMarkdown (inText, options) {
		if (!inText || !inText.trim()) return options.cbWarning("No input!");
		inText = this._getCleanInput(inText, options);

		const lines = inText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n/g);
		const stack = [];
		let cur = null;
		lines.forEach(l => {
			if (l.trim().startsWith("##### ")) {
				if (cur && cur.lines.length) stack.push(cur);
				cur = {caption: l.trim().replace(/^##### /, ""), lines: []};
			} else {
				cur = cur || {lines: []};
				cur.lines.push(l);
			}
		});
		if (cur && cur.lines.length) stack.push(cur);

		const toOutput = stack.map(tbl => MarkdownConverter.getConvertedTable(tbl.lines, tbl.caption)).reverse();
		toOutput.forEach((out, i) => {
			if (options.isAppend) options.cbOutput(out, true);
			else {
				if (i === 0) options.cbOutput(out, false);
				else options.cbOutput(out, true);
			}
		});
	}
}

if (typeof module !== "undefined") {
	module.exports = {
		TableParser,
	};
}

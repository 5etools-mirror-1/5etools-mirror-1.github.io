class RenderDeities {
	static $getRenderedDeity (deity) {
		return $$`
			${Renderer.utils.getBorderTr()}
			${Renderer.utils.getExcludedTr({entity: deity, dataProp: "deity"})}
			${Renderer.utils.getNameTr(deity, {suffix: deity.title ? `, ${deity.title.toTitleCase()}` : "", page: UrlUtil.PG_DEITIES})}
			${RenderDeities._getDeityBody(deity)}
			${deity.reprinted ? `<tr class="text"><td colspan="6"><i class="text-muted">Note: this deity has been reprinted in a newer publication.</i></td></tr>` : ""}
			${Renderer.utils.getPageTr(deity)}
			${deity.previousVersions ? `
			${Renderer.utils.getDividerTr()}
			${deity.previousVersions.map((d, i) => RenderDeities._getDeityBody(d, i + 1)).join(Renderer.utils.getDividerTr())}
			` : ""}
			${Renderer.utils.getBorderTr()}
		`;
	}

	static _getDeityBody (deity, reprintIndex) {
		const renderer = Renderer.get();

		const renderStack = [];
		if (deity.entries) {
			renderer.recursiveRender(
				{
					entries: [
						...deity.customExtensionOf ? [`{@note This deity is a custom extension of {@deity ${deity.customExtensionOf}} with additional information from <i title="${Parser.sourceJsonToFull(deity.source).escapeQuotes()}">${Parser.sourceJsonToAbv(deity.source)}</i>.}`] : [],
						...deity.entries,
					],
				},
				renderStack,
			);
		}

		if (deity.symbolImg) deity.symbolImg.style = deity.symbolImg.style || "deity-symbol";

		return `
			${reprintIndex ? `
				<tr><td colspan="6">
				<i class="text-muted">
				${reprintIndex === 1 ? `This deity is a reprint.` : ""} The version below was printed in an older publication (${Parser.sourceJsonToFull(deity.source)}${Renderer.utils.isDisplayPage(deity.page) ? `, page ${deity.page}` : ""}).
				</i>
				</td></tr>
			` : ""}

			${Renderer.deity.getOrderedParts(deity, `<tr><td colspan="6">`, `</td></tr>`)}

			${deity.symbolImg ? `<tr><td colspan="6">${renderer.render({entries: [deity.symbolImg]})}<div class="mb-2"/></td></tr>` : ""}
			${renderStack.length ? `<tr class="text"><td class="pt-2" colspan="6">${renderStack.join("")}</td></tr>` : ""}
			`;
	}
}

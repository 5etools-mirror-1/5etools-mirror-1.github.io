class RenderBackgrounds {
	static $getRenderedBackground (bg) {
		const renderStack = [];
		const entryList = {type: "entries", entries: bg.entries};
		Renderer.get().setFirstSection(true).recursiveRender(entryList, renderStack);

		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: bg, dataProp: "background"})}
		${Renderer.utils.getNameTr(bg, {page: UrlUtil.PG_BACKGROUNDS})}
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		<tr class="text"><td colspan="6">${renderStack.join("")}</td></tr>
		${Renderer.utils.getPageTr(bg)}
		${Renderer.utils.getBorderTr()}
		`;
	}
}

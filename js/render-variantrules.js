class RenderVariantRules {
	static $getRenderedVariantRule (rule) {
		const cpy = MiscUtil.copy(rule);
		delete cpy.name;

		Renderer.get().setFirstSection(true);
		const textStack = [];
		Renderer.get().resetHeaderIndex();
		Renderer.get().recursiveRender(cpy, textStack);

		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: rule, dataProp: "variantrule"})}
		${Renderer.utils.getNameTr(rule, {page: UrlUtil.PG_VARIANTRULES})}
		<tr class="text"><td colspan="6">${textStack.join("")}</td></tr>
		${Renderer.utils.getPageTr(rule)}
		${Renderer.utils.getBorderTr()}`;
	}
}

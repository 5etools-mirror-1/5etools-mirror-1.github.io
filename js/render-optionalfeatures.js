class RenderOptionalFeatures {
	static $getRenderedOptionalFeature (it) {
		return $$`${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "optionalfeature"})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_OPT_FEATURES})}
		${it.prerequisite ? `<tr><td colspan="6"><i>${Renderer.utils.getPrerequisiteHtml(it.prerequisite)}</i></td></tr>` : ""}
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		<tr><td colspan="6">${Renderer.get().render({entries: it.entries}, 1)}</td></tr>
		${Renderer.optionalfeature.getPreviouslyPrintedText(it)}
		${Renderer.utils.getPageTr(it)}
		${Renderer.utils.getBorderTr()}`;
	}
}

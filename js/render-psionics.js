class RenderPsionics {
	static $getRenderedPsionic (psi) {
		const renderer = Renderer.get().setFirstSection(true);
		return $$`
			${Renderer.utils.getBorderTr()}
			${Renderer.utils.getExcludedTr({entity: psi, dataProp: "psionic"})}
			${Renderer.utils.getNameTr(psi, {page: UrlUtil.PG_PSIONICS})}
			<tr><td colspan="6"><i>${Renderer.psionic.getTypeOrderString(psi)}</i></td></tr>
			<tr><td class="divider" colspan="6"><div></div></td></tr>
			<tr class="text"><td colspan="6">${Renderer.psionic.getBodyText(psi, renderer)}</td></tr>
			${Renderer.utils.getPageTr(psi)}
			${Renderer.utils.getBorderTr()}
		`;
	}
}

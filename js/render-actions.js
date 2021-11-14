class RenderActions {
	static $getRenderedAction (it) {
		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "action"})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_ACTIONS})}
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		<tr class="text"><td colspan="6">
		${Renderer.get().setFirstSection(true).render({entries: it.entries})}
		${it.fromVariant ? `<div>${Renderer.get().render(`{@note This action is an optional addition to the game, from the optional/variant rule {@variantrule ${it.fromVariant}}.}`)}</div>` : ""}
		${it.seeAlsoAction ? `<div>${Renderer.get().render(`{@note See also: ${it.seeAlsoAction.map(it => `{@action ${it}}`).join(", ")}.}`)}</div>` : ""}
		</td></tr>
		${Renderer.utils.getPageTr(it)}
		${Renderer.utils.getBorderTr()}
		`;
	}
}

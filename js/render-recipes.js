class RenderRecipes {
	/**
	 * @param it
	 * @param [opts]
	 * @param [opts.$selScaleFactor]
	 */
	static $getRenderedRecipe (it, opts) {
		opts = opts || {};

		const ptFluff = this._getFluffHtml(it);
		const {ptMakes, ptServes} = Renderer.recipe._getMakesServesHtml(it);

		const $ptMakes = ptMakes ? $(ptMakes) : null;
		const $ptServes = ptServes ? $(ptServes) : null;

		if (opts.$selScaleFactor) {
			if ($ptMakes) $ptMakes.append($$`<div class="flex-v-center ml-2">(${opts.$selScaleFactor})</div>`);
			else if ($ptServes) $ptServes.append($$`<div class="flex-v-center ml-2">(${opts.$selScaleFactor})</div>`);
		}

		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "recipe"})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_RECIPES})}

		${ptFluff ? `<tr class="mobile__hidden recipes__wrp-fluff"><td colspan="6">${ptFluff}</td></tr>
		<tr class="mobile__hidden"><td class="divider" colspan="6"><div></div></td></tr>` : ""}

		<tr class="text"><td colspan="6">
		<div class="flex w-100 rd-recipes__wrp-recipe">
			<div class="w-33 pl-3 pr-2 flex-col">
				${$ptMakes}
				${$ptServes}
				${!(ptMakes || ptServes) && opts.$selScaleFactor ? $$`<div class="mb-2">Scale: ${opts.$selScaleFactor}</div>` : ""}

				<div class="rd-recipes__wrp-ingredients ${ptMakes || ptServes || opts.$selScaleFactor ? "mt-1" : ""}">${Renderer.get().render({entries: it._fullIngredients}, 0)}</div>

				${it.noteCook ? `<div class="w-100 flex-col mt-4"><div class="flex-vh-center bold mb-1 small-caps">Cook's Notes</div><div class="italic">${Renderer.get().render({entries: it.noteCook})}</div></div>` : ""}
			</div>

			<div class="w-66 pr-3 pl-5 rd-recipes__wrp-instructions">
				${Renderer.get().setFirstSection(true).render({entries: it.instructions}, 2)}
			</div>
		</div>
		</td></tr>

		${Renderer.utils.getPageTr(it)}
		${Renderer.utils.getBorderTr()}
		`;
	}

	static _getFluffHtml (it) {
		if (!it.fluff?.images || !it.fluff?.images?.length) return null;

		return Renderer.utils.getFluffTabContent({entity: it, isImageTab: true, fluff: it.fluff});
	}
}

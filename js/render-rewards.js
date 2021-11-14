class RenderRewards {
	static $getRenderedReward (reward) {
		return $$`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getExcludedTr({entity: reward, dataProp: "reward"})}
		${Renderer.utils.getNameTr(reward, {page: UrlUtil.PG_REWARDS})}
		${Renderer.reward.getRenderedString(reward)}
		${Renderer.utils.getPageTr(reward)}
		${Renderer.utils.getBorderTr()}`;
	}
}

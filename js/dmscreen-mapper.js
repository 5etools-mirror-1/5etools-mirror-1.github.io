"use strict";

class DmMapper {
	static $getMapper (board, state) {
		const $wrpPanel = $(`<div class="w-100 h-100 dm-map__root dm__panel-bg dm__data-anchor"/>`) // root class used to identify for saving
			.data("getState", () => mapper.getSaveableState());
		const mapper = new DmMapperRoot(board, $wrpPanel);
		mapper.setStateFrom(state);
		mapper.render($wrpPanel);
		return $wrpPanel;
	}

	static async pHandleMenuButtonClick (menu) {
		const chosenDoc = await SearchWidget.pGetUserAdventureSearch({
			// TODO(5EB-1) expand this filter as more maps are added
			fnFilterResults: doc => {
				if (Parser.SOURCE_JSON_TO_FULL[doc.s]) {
					return doc.s === SRC_WDMM || doc.s === SRC_CoS || doc.s === SRC_TTP;
				}
				return true; // Allow all homebrew through
			},
		});

		if (!chosenDoc) return;

		menu.doClose();

		const {$modalInner, doClose} = UiUtil.getShowModal({
			title: `Select Map\u2014${chosenDoc.n}`,
			isWidth100: true,
			isHeight100: true,
			isUncappedHeight: true,
		});

		$modalInner.append(`<div class="flex-vh-center w-100 h-100"><i class="dnd-font ve-muted">Loading...</i></div>`);

		const {page, source, hash} = SearchWidget.docToPageSourceHash(chosenDoc);
		const adventurePack = await Renderer.hover.pCacheAndGet(page, source, hash);

		const mapDatas = [];
		const walker = MiscUtil.getWalker();
		adventurePack.adventureData.data.forEach((chap, ixChap) => {
			let cntChapImages = 0;

			const handlers = {
				object (obj) {
					if (obj.mapRegions) {
						const out = {
							...Renderer.get().getMapRegionData(obj),
							page: UrlUtil.PG_ADVENTURE,
							source: adventurePack.adventure.source,
							hash: UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ADVENTURE](adventurePack.adventure),
						};
						mapDatas.push(out);

						if (obj.title) {
							out.name = obj.title;
						} else {
							out.name = `${(adventurePack.adventure.contents[ixChap] || {}).name || "(Unknown)"}, Map ${cntChapImages + 1}`;
						}

						cntChapImages++;
					}

					return obj;
				},
			};

			walker.walk(
				chap,
				handlers,
			);
		});

		if (!mapDatas.length) {
			$modalInner
				.empty()
				.append(`<div class="flex-vh-center w-100 h-100"><span class="dnd-font">Adventure did not contain any valid maps!</span></div>`);
			return;
		}

		$modalInner
			.empty()
			.removeClass("flex-col")
			.addClass("text-center");

		mapDatas.map(mapData => {
			$(`<div class="m-1 p-1 clickable dm-map__picker-wrp-img relative">
							<div class="dm-map__picker-img" style="background-image: url(${mapData.hrefThumbnail || mapData.href})"></div>
							<span class="absolute text-center dm-map__picker-disp-name">${mapData.name.escapeQuotes()}</span>
						</div>`)
				.click(() => {
					doClose();
					menu.pnl.doPopulate_AdventureDynamicMap({state: mapData});
				})
				.appendTo($modalInner);
		});
	}
}

class DmMapperRoot extends BaseComponent {
	/**
	 * @param board DM Screen board.
	 * @param $wrpPanel Panel wrapper element for us to populate.
	 */
	constructor (board, $wrpPanel) {
		super();
		this._board = board;
		this._$wrpPanel = $wrpPanel;
	}

	render ($parent) {
		$parent.empty();

		$parent.append(`<div class="flex-vh-center w-100 h-100"><i class="dnd-font ve-muted">Loading...</i></div>`);

		RenderMap.$pGetRendered(this._state)
			.then($ele => $parent.empty().append($ele));
	}
}

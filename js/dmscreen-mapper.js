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

	static _getProps ({catId}) {
		const prop = catId === Parser.CAT_ID_ADVENTURE ? "adventure" : "book";
		return {prop, propData: `${prop}Data`};
	}

	static async pHandleMenuButtonClick (menu) {
		const chosenDoc = await SearchWidget.pGetUserAdventureBookSearch({
			fnFilterResults: doc => doc.hasMaps,
			contentIndexName: "entity_AdventuresBooks_maps",
			pFnGetDocExtras: async ({doc}) => {
				// Load the adventure/book, and scan it for maps
				const {propData} = this._getProps({catId: doc.c});
				const {page, source, hash} = SearchWidget.docToPageSourceHash(doc);
				const adventureBookPack = await DataLoader.pCacheAndGet(page, source, hash);
				let hasMaps = false;
				const walker = MiscUtil.getWalker({
					isBreakOnReturn: true,
					keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
					isNoModification: true,
				});
				walker.walk(
					adventureBookPack[propData],
					{
						object: (obj) => {
							if (obj.type === "image" && obj.mapRegions?.length) return hasMaps = true;
						},
					},
				);
				return {hasMaps};
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

		$modalInner.append(`<div class="ve-flex-vh-center w-100 h-100"><i class="dnd-font ve-muted">Loading...</i></div>`);

		const {page, source, hash} = SearchWidget.docToPageSourceHash(chosenDoc);
		const adventureBookPack = await DataLoader.pCacheAndGet(page, source, hash);

		const mapDatas = [];
		const walker = MiscUtil.getWalker();

		const {prop, propData} = this._getProps({catId: chosenDoc.c});

		adventureBookPack[propData].data.forEach((chap, ixChap) => {
			let cntChapImages = 0;

			const handlers = {
				object (obj) {
					if (obj.mapRegions) {
						const out = {
							...Renderer.get().getMapRegionData(obj),
							page: chosenDoc.q,
							source: adventureBookPack[prop].source,
							hash: UrlUtil.URL_TO_HASH_BUILDER[chosenDoc.q](adventureBookPack[prop]),
						};
						mapDatas.push(out);

						if (obj.title) {
							out.name = Renderer.stripTags(obj.title);
						} else {
							out.name = `${(adventureBookPack[prop].contents[ixChap] || {}).name || "(Unknown)"}, Map ${cntChapImages + 1}`;
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
				.append(`<div class="ve-flex-vh-center w-100 h-100"><span class="dnd-font">Adventure did not contain any valid maps!</span></div>`);
			return;
		}

		$modalInner
			.empty()
			.removeClass("ve-flex-col")
			.addClass("text-center");

		mapDatas.map(mapData => {
			$(`<div class="m-1 p-1 clickable dm-map__picker-wrp-img relative">
				<div class="dm-map__picker-img" style="background-image: url(${encodeURI(mapData.hrefThumbnail || mapData.href)})"></div>
				<span class="absolute text-center dm-map__picker-disp-name">${mapData.name.escapeQuotes()}</span>
			</div>`)
				.click(() => {
					doClose();
					menu.pnl.doPopulate_AdventureBookDynamicMap({state: mapData});
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

		$parent.append(`<div class="ve-flex-vh-center w-100 h-100"><i class="dnd-font ve-muted">Loading...</i></div>`);

		RenderMap.$pGetRendered(this._state)
			.then($ele => $parent.empty().append($ele));
	}
}

"use strict";

class SearchPage {
	static async pInit () {
		await BrewUtil2.pInit();
		ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search

		SearchPage._isAllExpanded = (await StorageUtil.pGetForPage(SearchPage._STORAGE_KEY_IS_EXPANDED)) || false;
		SearchPage._$wrp = $(`#main_content`).empty();
		this._render();
	}

	static _render_$getBtnToggleFilter (
		{
			propOmnisearch,
			fnAddHookOmnisearch,
			fnDoToggleOmnisearch,
			title,
			text,
		},
	) {
		const $btn = $(`<button class="btn btn-default" title="${title.qq()}">${text.qq()}</button>`)
			.click(() => Omnisearch[fnDoToggleOmnisearch]());
		const hkBrew = (val) => {
			$btn.toggleClass("active", Omnisearch[propOmnisearch]);
			if (val == null) return;
			this._doSearch();
		};
		Omnisearch[fnAddHookOmnisearch](hkBrew);
		hkBrew();

		return $btn;
	}

	static _render () {
		Omnisearch.initState();

		const $iptSearch = $(`<input class="form-control pg-search__ipt" placeholder="Search everywhere..." title="Disclaimer: unlikely to search everywhere. Use with caution.">`)
			.keydown(evt => {
				if (evt.key !== "Enter") return;
				$btnSearch.click();
			})
			.val(decodeURIComponent(location.search.slice(1).replace(/\+/g, " ")));

		const $btnSearch = $(`<button class="btn btn-default"><span class="glyphicon glyphicon-search"></span></button>`)
			.click(() => {
				location.search = encodeURIComponent($iptSearch.val().trim().toLowerCase());
			});

		const $btnHelp = $(`<button class="btn btn-default mr-2 mobile__hidden" title="Help"><span class="glyphicon glyphicon-info-sign"></span></button>`)
			.click(() => Omnisearch.doShowHelp());

		const $btnToggleBrew = this._render_$getBtnToggleFilter({
			propOmnisearch: "isShowBrew",
			fnAddHookOmnisearch: "addHookBrew",
			fnDoToggleOmnisearch: "doToggleBrew",
			title: "Filter Homebrew",
			text: "Include Homebrew",
		});

		const $btnToggleUa = this._render_$getBtnToggleFilter({
			propOmnisearch: "isShowUa",
			fnAddHookOmnisearch: "addHookUa",
			fnDoToggleOmnisearch: "doToggleUa",
			title: "Filter Unearthed Arcana and other unofficial source results",
			text: "Include UA",
		});

		const $btnToggleBlocklisted = this._render_$getBtnToggleFilter({
			propOmnisearch: "isShowBlocklisted",
			fnAddHookOmnisearch: "addHookBlocklisted",
			fnDoToggleOmnisearch: "doToggleBlocklisted",
			title: "Filter blocklisted content results",
			text: "Include Blocklisted",
		});

		const $btnToggleSrd = this._render_$getBtnToggleFilter({
			propOmnisearch: "isSrdOnly",
			fnAddHookOmnisearch: "addHookSrdOnly",
			fnDoToggleOmnisearch: "doToggleSrdOnly",
			title: "Filter non- Systems Reference Document results",
			text: "SRD Only",
		});

		const handleMassExpandCollapse = mode => {
			SearchPage._isAllExpanded = mode;
			StorageUtil.pSetForPage("isExpanded", SearchPage._isAllExpanded);

			if (!SearchPage._rowMetas) return;
			SearchPage._rowMetas
				.filter(meta => meta.setIsExpanded)
				.forEach(meta => meta.setIsExpanded(mode));
		};

		const $btnCollapseAll = $(`<button class="btn btn-default" title="Collapse All Results"><span class="glyphicon glyphicon-minus"></span></button>`)
			.click(() => handleMassExpandCollapse(false));

		const $btnExpandAll = $(`<button class="btn btn-default" title="Expand All Results"><span class="glyphicon glyphicon-plus"></span></button>`)
			.click(() => handleMassExpandCollapse(true));

		SearchPage._$wrpResults = $(`<div class="ve-flex-col w-100">${this._getWrpResult_message("Loading...")}</div>`);

		$$(SearchPage._$wrp)`<div class="ve-flex-col w-100 pg-search__wrp">
			<div class="ve-flex-v-center mb-2 mobile-ish__ve-flex-col">
				<div class="ve-flex-v-center input-group btn-group mr-2 w-100 mobile-ish__mb-2">${$iptSearch}${$btnSearch}</div>

				<div class="ve-flex-v-center mobile__ve-flex-col mobile-ish__ve-flex-ai-start mobile-ish__w-100">
					${$btnHelp}
					<div class="ve-flex-v-center btn-group mr-2 mobile__mb-2 mobile__mr-0">
						${$btnToggleBrew}
						${$btnToggleUa}
						${$btnToggleBlocklisted}
						${$btnToggleSrd}
					</div>
					<div class="btn-group ve-flex-v-center">
						${$btnCollapseAll}
						${$btnExpandAll}
					</div>
				</div>
			</div>
			${SearchPage._$wrpResults}
		</div>`;

		this._doSearch();
	}

	static _doSearch () {
		if (SearchPage._observer) {
			for (const ele of SearchPage._observed.keys()) SearchPage._observer.unobserve(ele);
		} else {
			SearchPage._observer = new IntersectionObserver(
				(obsEntries) => {
					obsEntries.forEach(entry => {
						if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
							SearchPage._observer.unobserve(entry.target);
							const meta = SearchPage._observed.get(entry.target);
							meta.onObserve();
						}
					});
				},
				{rootMargin: "150px 0px", threshold: 0.01},
			);
		}
		SearchPage._rowMetas = [];

		if (!location.search.slice(1)) {
			SearchPage._$wrpResults.empty().append(this._getWrpResult_message("Enter a search to view results"));
			return;
		}

		Omnisearch.pGetResults(decodeURIComponent(location.search.slice(1).replace(/\+/g, " ")))
			.then(results => {
				SearchPage._$wrpResults.empty();

				if (!results.length) {
					SearchPage._$wrpResults.append(this._getWrpResult_message("No results found."));
					return;
				}

				SearchPage._rowMetas = results.map(result => {
					const r = result.doc;

					const $link = Omnisearch.$getResultLink(r);

					const {s: source, p: page, h: isHoverable, c: category, u: hash, r: isSrd} = r;
					const ptPageInner = page ? `page ${page}` : "";
					const adventureBookSourceHref = SourceUtil.getAdventureBookSourceHref(source, page);
					const ptPage = ptPageInner && adventureBookSourceHref
						? `<a href="${adventureBookSourceHref}">${ptPageInner}</a>`
						: ptPageInner;

					const ptSourceInner = source ? `<i>${Parser.sourceJsonToFull(source)}</i> (<span class="${Parser.sourceJsonToColor(source)}" ${BrewUtil2.sourceJsonToStyle(source)}>${Parser.sourceJsonToAbv(source)}</span>)${isSrd ? `<span class="ve-muted relative help-subtle pg-search__disp-srd" title="Available in the Systems Reference Document">[SRD]</span>` : ""}` : `<span></span>`;
					const ptSource = ptPage || !adventureBookSourceHref
						? ptSourceInner
						: `<a href="${adventureBookSourceHref}">${ptSourceInner}</a>`;

					const $dispImage = $(`<div class="ve-flex-col pg-search__disp-token mr-3 no-shrink"></div>`);
					const $dispPreview = $(`<div class="ve-flex-col mobile__w-100"></div>`);
					const $wrpPreviewControls = $(`<div class="ve-flex-col mobile__mb-2 mobile__w-100 h-100"></div>`);

					const out = {};

					const $row = $$`<div class="my-2 py-2 pl-3 pr-2 pg-search__wrp-result ve-flex relative mobile__ve-flex-col">
						<div class="ve-flex-v-center mobile__mb-2 w-100">
							${$dispImage}
							<div class="ve-flex-col ve-flex-h-center mr-auto">
								<div class="mb-2">${$link}</div>
								<div>${ptSource}${ptPage ? `, ${ptPage}` : ""}</div>
							</div>
						</div>
						<div class="ve-flex-v-center mobile__ve-flex-col-reverse mobile__ve-flex-ai-start">
							${$dispPreview}
							${$wrpPreviewControls}
						</div>
					</div>`.appendTo(SearchPage._$wrpResults);

					if (isHoverable) {
						out.isExpanded = !!SearchPage._isAllExpanded;

						const handleIsExpanded = () => {
							$dispPreview.toggleVe(out.isExpanded);
							$btnTogglePreview
								.html(out.isExpanded ? `<span class="glyphicon glyphicon-minus"></span>` : `<span class="glyphicon glyphicon-plus"></span>`)
								.toggleClass("pg-search__btn-toggle-preview--expanded", out.isExpanded);
						};

						out.setIsExpanded = val => {
							out.isExpanded = !!val;
							handleIsExpanded();
						};

						const $btnTogglePreview = $(`<button class="btn btn-default btn-xs h-100" title="Toggle Preview"></button>`)
							.click(() => {
								out.isExpanded = !out.isExpanded;
								handleIsExpanded();
							})
							.appendTo($wrpPreviewControls);

						handleIsExpanded();
					}

					const observationTarget = $row[0];
					SearchPage._observed.set(
						observationTarget,
						{
							onObserve: () => {
								const page = UrlUtil.categoryToHoverPage(category);
								DataLoader.pCacheAndGet(
									page,
									source,
									hash,
								).then(ent => {
									// region Render tokens, where available
									let isImagePopulated = false;

									switch (category) {
										case Parser.CAT_ID_CREATURE:
										case Parser.CAT_ID_VEHICLE:
										case Parser.CAT_ID_OBJECT: {
											const hasToken = ent.tokenUrl || ent.hasToken;
											if (hasToken) {
												const fnGetTokenUrl = category === Parser.CAT_ID_CREATURE ? Renderer.monster.getTokenUrl : category === Parser.CAT_ID_VEHICLE ? Renderer.vehicle.getTokenUrl : Renderer.object.getTokenUrl;

												isImagePopulated = true;
												const tokenUrl = fnGetTokenUrl(ent);
												$dispImage.html(`<img src="${tokenUrl}" class="w-100 h-100" alt="Token Image: ${(ent.name || "").qq()}" loading="lazy">`);
											}
											break;
										}

										case Parser.CAT_ID_BOOK:
										case Parser.CAT_ID_ADVENTURE: {
											const prop = category === Parser.CAT_ID_BOOK ? "book" : "adventure";
											isImagePopulated = true;
											$dispImage.html(`<img src="${Renderer.adventureBook.getCoverUrl(ent[prop])}" class="w-100 h-100" alt="Cover Image: ${(ent[prop].name || "").qq()}" loading="lazy">`);
										}
									}

									if (!isImagePopulated) $dispImage.addClass(`mobile__hidden`);
									// endregion

									if (isHoverable) {
										// region Render preview
										Renderer.hover.$getHoverContent_stats(page, ent)
											.addClass("pg-search__wrp-preview mobile__w-100 br-0")
											.appendTo($dispPreview);
										// endregion
									}
								});
							},
						},
					);
					SearchPage._observer.observe(observationTarget);

					return out;
				});
			});
	}

	static _getWrpResult_message (message) {
		return `<div class="my-2 py-2 px-3 pg-search__wrp-result ve-flex-vh-center"><i>${message.qq()}</i></div>`;
	}
}
SearchPage._STORAGE_KEY_IS_EXPANDED = "isExpanded";
SearchPage._$wrp = null;
SearchPage._$wrpResults = null;
SearchPage._rowMetas = null;
SearchPage._observer = null;
SearchPage._observed = new Map();
SearchPage._isAllExpanded = false;

window.addEventListener("load", () => SearchPage.pInit());

"use strict";

class Omnisearch {
	static _sortResults (a, b) {
		const byScore = SortUtil.ascSort(b.score, a.score);
		if (byScore) return byScore;

		const byName = SortUtil.ascSortLower(a.doc.n || "", b.doc.n || "");
		if (byName) return byName;

		const isNonStandardA = SourceUtil.isNonstandardSource(a.doc.s);
		const isNonStandardB = SourceUtil.isNonstandardSource(b.doc.s);

		return Number(isNonStandardA) - Number(isNonStandardB);
	}

	static init () {
		if (IS_VTT) return;

		const $nav = $(`#navbar`);

		this._$iptSearch = $(`<input class="form-control search omni__input" placeholder="${this._PLACEHOLDER_TEXT}" title="Hotkey: F. Disclaimer: unlikely to search everywhere. Use with caution." type="search">`)
			.disableSpellcheck();
		const $btnClearSearch = $(`<span class="absolute glyphicon glyphicon-remove omni__btn-clear"></span>`)
			.mousedown(evt => {
				evt.stopPropagation();
				evt.preventDefault();
				this._$iptSearch.val("").focus();
			});
		const $searchSubmit = $(`<button class="btn btn-default omni__submit" tabindex="-1"><span class="glyphicon glyphicon-search"></span></button>`);

		this._$searchInputWrapper = $$`
			<div class="input-group omni__wrp-input">
				${this._$iptSearch}
				${$btnClearSearch}
				<div class="input-group-btn">
					${$searchSubmit}
				</div>
			</div>
		`.appendTo($nav);

		this._$searchOutWrapper = $(`<div class="omni__wrp-output ve-flex"/>`).hideVe().insertAfter($nav);
		this._$searchOut = $(`<div class="omni__output"/>`).appendTo(this._$searchOutWrapper);

		$(window).on("click", () => this._$searchOutWrapper.hideVe());

		this._$searchOut.on("click", evt => {
			evt.stopPropagation();
			Renderer.hover.cleanTempWindows();
		});

		this._$iptSearch.on("keydown", (evt) => {
			evt.stopPropagation();
			Renderer.hover.cleanTempWindows();
			switch (evt.key) {
				case "Enter":
					if (evt.ctrlKey) {
						window.location = `${Renderer.get().baseUrl}${UrlUtil.PG_SEARCH}?${this._$iptSearch.val()}`;
						break;
					}

					this._clickFirst = true;
					$searchSubmit.click();
					break;
				case "ArrowUp":
					evt.preventDefault();
					break;
				case "ArrowDown":
					evt.preventDefault();
					this._$searchOut.find(`a.omni__lnk-name`).first().focus();
					break;
				case "Escape":
					this._$iptSearch.val("");
					this._$iptSearch.blur();
			}
		});

		// auto-search after 100ms
		const TYPE_TIMEOUT_MS = 100;

		const handleSubmitClick = (evt) => {
			if (evt) evt.stopPropagation();
			Renderer.hover.cleanTempWindows();
			this._pDoSearch();
		};

		let typeTimer;
		this._$iptSearch.on("keyup", (evt) => {
			this._clickFirst = false;
			if (evt.which >= 37 && evt.which <= 40) return;
			clearTimeout(typeTimer);
			typeTimer = setTimeout(() => handleSubmitClick(), TYPE_TIMEOUT_MS);
		});
		this._$iptSearch.on("keydown", () => clearTimeout(typeTimer));
		this._$iptSearch.on("click", evt => {
			evt.stopPropagation();
			Renderer.hover.cleanTempWindows();
			if (this._$iptSearch.val() && this._$iptSearch.val().trim().length) handleSubmitClick();
		});

		$searchSubmit.on("click", evt => handleSubmitClick(evt));

		this._init_initScrollHandler();

		$(document.body).on("keypress", (evt) => {
			if (!EventUtil.noModifierKeys(evt) || EventUtil.isInInput(evt)) return;
			if (EventUtil.getKeyIgnoreCapsLock(evt) !== "F") return;
			evt.preventDefault();
			this._$iptSearch.select().focus();
		});
	}

	static _init_initScrollHandler () {
		const $window = $(window);
		$window.on("scroll", evt => {
			if (Renderer.hover.isSmallScreen(evt)) {
				this._$iptSearch.attr("placeholder", this._PLACEHOLDER_TEXT);
				this._$searchInputWrapper.removeClass("omni__wrp-input--scrolled");
				this._$searchOut.removeClass("omni__output--scrolled");
			} else {
				if ($window.scrollTop() > 50) {
					this._$iptSearch.attr("placeholder", " ");
					this._$searchInputWrapper.addClass("omni__wrp-input--scrolled");
					this._$searchOut.addClass("omni__output--scrolled");
				} else {
					this._$iptSearch.attr("placeholder", this._PLACEHOLDER_TEXT);
					this._$searchInputWrapper.removeClass("omni__wrp-input--scrolled");
					this._$searchOut.removeClass("omni__output--scrolled");
				}
			}
		});
	}

	static async pGetResults (searchTerm) {
		searchTerm = (searchTerm || "").toAscii();

		await this.pInit();

		const basicTokens = searchTerm.split(/\s+/g);

		const tokenMetas = [];
		// Filter out any special tokens
		const filteredBasicTokens = basicTokens.filter(t => {
			t = t.toLowerCase().trim();

			let category = Object.keys(this._CATEGORY_COUNTS)
				.map(k => k.toLowerCase())
				.find(k => (`in:${k}` === t || `in:${k}s` === t));

			// Alias categories
			if (!category) {
				if (t === "in:creature" || t === "in:creatures" || t === "in:monster" || t === "in:monsters") category = "bestiary";
			}

			const mSource = /^source:(.*)$/.exec(t);
			const mPage = /^page:\s*(\d+)\s*(-\s*(\d+)\s*)?$/.exec(t);

			if (category || mSource || mPage) {
				tokenMetas.push({
					token: t,
					hasCategory: !!category,
					hasSource: !!mSource,
					hasPageRange: !!mPage,
					category,
					source: mSource ? mSource[1].trim() : null,
					pageRange: mPage ? [Number(mPage[1]), mPage[3] ? Number(mPage[3]) : Number(mPage[1])] : null,
				});
				return false;
			}
			return true;
		});

		let results;

		const specialTokenMetasCategory = tokenMetas.filter(it => it.hasCategory);
		const specialTokenMetasSource = tokenMetas.filter(it => it.hasSource);
		const specialTokenMetasPageRange = tokenMetas.filter(it => it.hasPageRange);
		if (
			(specialTokenMetasCategory.length === 1 || specialTokenMetasSource.length >= 1 || specialTokenMetasPageRange.length >= 1)
			&& (specialTokenMetasCategory.length <= 1) // Sanity constraints--on an invalid search, run the default search
		) {
			const categoryTerm = specialTokenMetasCategory.length ? specialTokenMetasCategory[0].category.toLowerCase() : null;
			const sourceTerms = specialTokenMetasSource.map(it => it.source);
			const pageRanges = specialTokenMetasPageRange.map(it => it.pageRange);
			// Glue the remaining tokens back together, and pass them to search lib
			const searchTerm = filteredBasicTokens.join(" ");

			results = searchTerm
				? this._searchIndex
					.search(
						searchTerm,
						{
							fields: {
								n: {boost: 5, expand: true},
								s: {expand: true},
							},
							bool: "AND",
							expand: true,
						},
					)
				: Object.values(this._searchIndex.documentStore.docs).map(it => ({doc: it}));

			results = results
				.filter(r => !categoryTerm || (r.doc.cf.toLowerCase() === categoryTerm))
				.filter(r => !sourceTerms.length || (r.doc.s && sourceTerms.includes(r.doc.s.toLowerCase())))
				.filter(r => !pageRanges.length || (r.doc.p && pageRanges.some(range => r.doc.p >= range[0] && r.doc.p <= range[1])));
		} else {
			results = this._searchIndex.search(
				searchTerm,
				{
					fields: {
						n: {boost: 5, expand: true},
						s: {expand: true},
					},
					bool: "AND",
					expand: true,
				},
			);
		}

		if (this._state.isSrdOnly) {
			results = results.filter(r => r.doc.r);
		}

		if (!this._state.isShowBrew) {
			results = results.filter(r => !r.doc.s || SourceUtil.isSiteSource(r.doc.s));
		}

		if (!this._state.isShowUa) {
			results = results.filter(r => !r.doc.s || !SourceUtil.isNonstandardSourceWotc(r.doc.s));
		}

		if (!this._state.isShowBlocklisted && ExcludeUtil.getList().length) {
			const resultsNxt = [];
			for (const r of results) {
				if (r.doc.c === Parser.CAT_ID_QUICKREF || r.doc.c === Parser.CAT_ID_PAGE) {
					resultsNxt.push(r);
					continue;
				}

				const bCat = Parser.pageCategoryToProp(r.doc.c);
				if (bCat !== "item") {
					if (!ExcludeUtil.isExcluded(r.doc.u, bCat, r.doc.s, {isNoCount: true})) resultsNxt.push(r);
					continue;
				}

				const item = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_ITEMS, r.doc.u);
				if (!Renderer.item.isExcluded(item, {hash: r.doc.u})) resultsNxt.push(r);
			}
			results = resultsNxt;
		}

		results.sort(this._sortResults);

		return results;
	}

	// region Search
	static async _pDoSearch () {
		const results = await this.pGetResults(this._$iptSearch.val());
		this._pDoSearch_renderLinks(results);
	}

	static _renderLink_getHoverString (category, url, src, {isFauxPage = false} = {}) {
		return `onmouseover="Renderer.hover.pHandleLinkMouseOver(event, this)" onmouseleave="Renderer.hover.handleLinkMouseLeave(event, this)" onmousemove="Renderer.hover.handleLinkMouseMove(event, this)" data-vet-page="${UrlUtil.categoryToHoverPage(category).qq()}" data-vet-source="${src.qq()}" data-vet-hash="${url.qq()}" ${isFauxPage ? `data-vet-is-faux-page="true"` : ""} ${Renderer.hover.getPreventTouchString()}`;
	}

	static $getResultLink (r) {
		const isFauxPage = !!r.hx;

		if (isFauxPage) return $(`<span ${r.h ? this._renderLink_getHoverString(r.c, r.u, r.s, {isFauxPage}) : ""} class="omni__lnk-name help-subtle">${r.cf}: ${r.n}</span>`);

		const href = r.c === Parser.CAT_ID_PAGE ? r.u : `${Renderer.get().baseUrl}${UrlUtil.categoryToPage(r.c)}#${r.uh || r.u}`;
		return $(`<a href="${href}" ${r.h ? this._renderLink_getHoverString(r.c, r.u, r.s, {isFauxPage}) : ""} class="omni__lnk-name">${r.cf}: ${r.n}</a>`);
	}

	static _$btnToggleBrew = null;
	static _$btnToggleUa = null;
	static _$btnToggleBlocklisted = null;
	static _$btnToggleSrd = null;

	static _doInitBtnToggleFilter (
		{
			propState,
			propBtn,
			title,
			text,
		},
	) {
		if (this[propBtn]) this[propBtn].detach();
		else {
			this[propBtn] = $(`<button class="btn btn-default btn-xs" title="${title.qq()}" tabindex="-1">${text.qq()}</button>`)
				.on("click", () => this._state[propState] = !this._state[propState]);

			const hk = (val) => {
				this[propBtn].toggleClass("active", this._state[propState]);
				if (val != null) this._pDoSearch().then(null);
			};
			this._state._addHookBase(propState, hk);
			hk();
		}
	}

	static _pDoSearch_renderLinks (results, page = 0) {
		this._doInitBtnToggleFilter({
			propState: "isShowBrew",
			propBtn: "_$btnToggleBrew",
			title: "Include homebrew content results",
			text: "Include Homebrew",
		});

		this._doInitBtnToggleFilter({
			propState: "isShowUa",
			propBtn: "_$btnToggleUa",
			title: "Include Unearthed Arcana and other unofficial source results",
			text: "Include UA/etc.",
		});

		this._doInitBtnToggleFilter({
			propState: "isShowBlocklisted",
			propBtn: "_$btnToggleBlocklisted",
			title: "Include blocklisted content results",
			text: "Include Blocklisted",
		});

		this._doInitBtnToggleFilter({
			propState: "isSrdOnly",
			propBtn: "_$btnToggleSrd",
			title: "Only show Systems Reference Document content results",
			text: "SRD Only",
		});

		this._$searchOut.empty();

		const $btnHelp = $(`<button class="btn btn-default btn-xs ml-2" title="Help"><span class="glyphicon glyphicon-info-sign"></span></button>`)
			.click(() => this.doShowHelp());

		this._$searchOut.append($(`<div class="ve-flex-h-right ve-flex-v-center mb-2"/>`)
			.append([
				$$`<div class="btn-group ve-flex-v-center">${this._$btnToggleBrew}${this._$btnToggleUa}${this._$btnToggleBlocklisted}${this._$btnToggleSrd}</div>`,
				$btnHelp,
			]));
		const base = page * this._MAX_RESULTS;
		for (let i = base; i < Math.max(Math.min(results.length, this._MAX_RESULTS + base), base); ++i) {
			const r = results[i].doc;

			const $link = this.$getResultLink(r)
				.keydown(evt => this.handleLinkKeyDown(evt, $link));

			const {s: source, p: page, r: isSrd} = r;
			const ptPageInner = page ? `p${page}` : "";
			const adventureBookSourceHref = SourceUtil.getAdventureBookSourceHref(source, page);
			const ptPage = ptPageInner && adventureBookSourceHref
				? `<a href="${adventureBookSourceHref}">${ptPageInner}</a>`
				: ptPageInner;

			const ptSourceInner = source ? `<span class="${Parser.sourceJsonToColor(source)}" ${BrewUtil2.sourceJsonToStyle(source)} title="${Parser.sourceJsonToFull(source)}">${Parser.sourceJsonToAbv(source)}</span>` : `<span></span>`;
			const ptSource = ptPage || !adventureBookSourceHref
				? ptSourceInner
				: `<a href="${adventureBookSourceHref}">${ptSourceInner}</a>`;

			$$`<div class="omni__row-result split-v-center stripe-odd">
				${$link}
				<div class="inline-block">
					${ptSource}
					${isSrd ? `<span class="ve-muted omni__disp-srd help-subtle relative" title="Available in the Systems Reference Document">[SRD]</span>` : ""}
					${ptPage}
				</div>
			</div>`.appendTo(this._$searchOut);
		}
		this._$searchOutWrapper.showVe();

		// add pagination if there are many results
		if (results.length > this._MAX_RESULTS) {
			const $pgControls = $(`<div class="omni__wrp-paginate">`);
			if (page > 0) {
				const $prv = $(`<span class="omni__paginate-left has-results-left omni__paginate-ctrl"><span class="glyphicon glyphicon-chevron-left"></span></span>`).on("click", () => {
					page--;
					this._pDoSearch_renderLinks(results, page);
				});
				$pgControls.append($prv);
			} else ($pgControls.append(`<span class="omni__paginate-left">`));
			$pgControls.append(`<span class="paginate-count">Page ${page + 1}/${Math.ceil(results.length / this._MAX_RESULTS)} (${results.length} results)</span>`);
			if (results.length - (page * this._MAX_RESULTS) > this._MAX_RESULTS) {
				const $nxt = $(`<span class="omni__paginate-right has-results-right omni__paginate-ctrl"><span class="glyphicon glyphicon-chevron-right"></span></span>`).on("click", () => {
					page++;
					this._pDoSearch_renderLinks(results, page);
				});
				$pgControls.append($nxt);
			} else ($pgControls.append(`<span class="omni__paginate-right omni__paginate-ctrl">`));
			this._$searchOut.append($pgControls);
		}

		if (this._clickFirst && results.length) {
			this._$searchOut.find(`a.omni__lnk-name`).first()[0].click();
		}

		if (!results.length) {
			this._$searchOut.append(`<div class="ve-muted"><i>No results found.</i></div>`);
		}
	}
	// endregion

	static async pInit () {
		this.initState();
		if (!this._searchIndex) {
			if (this._pLoadSearch) await this._pLoadSearch;
			else {
				this._pLoadSearch = this._pDoSearchLoad();
				await this._pLoadSearch;
				this._pLoadSearch = null;
			}
		}
	}

	static initState () {
		if (this._state) return;

		const saved = StorageUtil.syncGet(this._STORAGE_NAME)
			|| {
				isShowBrew: true,
				isShowUa: true,
				isShowBlocklisted: false,
				isSrdOnly: false,
			};

		class SearchState extends BaseComponent {
			get isShowBrew () { return this._state.isShowBrew; }
			get isShowUa () { return this._state.isShowUa; }
			get isShowBlocklisted () { return this._state.isShowBlocklisted; }
			get isSrdOnly () { return this._state.isSrdOnly; }
			set isShowBrew (val) { this._state.isShowBrew = !!val; }
			set isShowUa (val) { this._state.isShowUa = !!val; }
			set isShowBlocklisted (val) { this._state.isShowBlocklisted = !!val; }
			set isSrdOnly (val) { this._state.isSrdOnly = !!val; }
		}
		this._state = SearchState.fromObject(saved);
		this._state._addHookAll("state", () => {
			StorageUtil.syncSet(this._STORAGE_NAME, this._state.toObject());
		});
	}

	static addHookBrew (hk) { this._state._addHookBase("isShowBrew", hk); }
	static addHookUa (hk) { this._state._addHookBase("isShowUa", hk); }
	static addHookBlocklisted (hk) { this._state._addHookBase("isShowBlocklisted", hk); }
	static addHookSrdOnly (hk) { this._state._addHookBase("isSrdOnly", hk); }
	static doToggleBrew () { this._state.isShowBrew = !this._state.isShowBrew; }
	static doToggleUa () { this._state.isShowUa = !this._state.isShowUa; }
	static doToggleBlocklisted () { this._state.isShowBlocklisted = !this._state.isShowBlocklisted; }
	static doToggleSrdOnly () { this._state.isSrdOnly = !this._state.isSrdOnly; }
	static get isShowBrew () { return this._state.isShowBrew; }
	static get isShowUa () { return this._state.isShowUa; }
	static get isShowBlocklisted () { return this._state.isShowBlocklisted; }
	static get isSrdOnly () { return this._state.isSrdOnly; }

	static async _pDoSearchLoad () {
		const data = Omnidexer.decompressIndex(await DataUtil.loadJSON(`${Renderer.get().baseUrl}search/index.json`));

		elasticlunr.clearStopWords();
		this._searchIndex = elasticlunr(function () {
			this.addField("n");
			this.addField("cf");
			this.addField("s");
			this.setRef("id");
		});
		SearchUtil.removeStemmer(this._searchIndex);

		data.forEach(it => this._addToIndex(it));

		const brewIndex = await BrewUtil2.pGetSearchIndex({id: this._maxId + 1});
		brewIndex.forEach(it => this._addToIndex(it));

		this._adventureBookLookup = {};
		[brewIndex, data].forEach(index => {
			index.forEach(it => {
				if (it.c === Parser.CAT_ID_ADVENTURE || it.c === Parser.CAT_ID_BOOK) this._adventureBookLookup[it.s.toLowerCase()] = it.c;
			});
		});
	}

	static _maxId = null;
	static _addToIndex (d) {
		this._maxId = d.id;
		d.cf = Parser.pageCategoryToFull(d.c);
		if (!this._CATEGORY_COUNTS[d.cf]) this._CATEGORY_COUNTS[d.cf] = 1;
		else this._CATEGORY_COUNTS[d.cf]++;
		this._searchIndex.addDoc(d);
	}

	static handleLinkKeyDown (evt, $ele) {
		Renderer.hover.cleanTempWindows();
		switch (evt.key) {
			case "ArrowLeft": {
				evt.preventDefault();
				if ($(`.has-results-left`).length) {
					const ix = $ele.parent().index() - 1; // offset as the control bar is at position 0
					$(`.omni__paginate-left`).click();
					const $psNext = this._$searchOut.find(`.omni__row-result`);
					$($psNext[ix] || $psNext[$psNext.length - 1]).find(`a.omni__lnk-name`).focus();
				}
				break;
			}
			case "ArrowUp": {
				evt.preventDefault();
				if ($ele.parent().prev().find(`a.omni__lnk-name`).length) {
					$ele.parent().prev().find(`a.omni__lnk-name`).focus();
				} else if ($(`.has-results-left`).length) {
					$(`.omni__paginate-left`).click();
					this._$searchOut.find(`a.omni__lnk-name`).last().focus();
				} else {
					this._$iptSearch.focus();
				}
				break;
			}
			case "ArrowRight": {
				evt.preventDefault();
				if ($(`.has-results-right`).length) {
					const ix = $ele.parent().index() - 1; // offset as the control bar is at position 0
					$(`.omni__paginate-right`).click();
					const $psNext = this._$searchOut.find(`.omni__row-result`);
					$($psNext[ix] || $psNext[$psNext.length - 1]).find(`a.omni__lnk-name`).focus();
				}
				break;
			}
			case "ArrowDown": {
				evt.preventDefault();
				if ($ele.parent().next().find(`a.omni__lnk-name`).length) {
					$ele.parent().next().find(`a.omni__lnk-name`).focus();
				} else if ($(`.has-results-right`).length) {
					$(`.omni__paginate-right`).click();
					this._$searchOut.find(`a.omni__lnk-name`).first().focus();
				}
				break;
			}
		}
	}

	static addScrollTopFloat () {
		// "To top" button
		const $btnToTop = $(`<button class="btn btn-sm btn-default" title="To Top"><span class="glyphicon glyphicon-arrow-up"/></button>`)
			.click(() => MiscUtil.scrollPageTop());

		const $wrpTop = $$`<div class="bk__to-top">
			${$btnToTop}
		</div>`.appendTo(document.body);

		$(window).on("scroll", () => {
			if ($(window).scrollTop() > 50) $wrpTop.addClass("bk__to-top--scrolled");
			else $wrpTop.removeClass("bk__to-top--scrolled");
		});

		return $wrpTop;
	}

	static doShowHelp () {
		const {$modalInner} = UiUtil.getShowModal({
			title: "Help",
			isMinHeight0: true,
		});

		$modalInner.append(`
			<p>The following search syntax is available:</p>
			<ul>
				<li><code>in:&lt;category&gt;</code> where <code>&lt;category&gt;</code> can be &quot;spell&quot;, &quot;item&quot;, &quot;bestiary&quot;, etc.</li>
				<li><code>source:&lt;abbreviation&gt;</code> where <code>&lt;abbreviation&gt;</code> is an abbreviated source/book name (&quot;PHB&quot;, &quot;MM&quot;, etc.)</li>
				<li><code>page:&lt;number&gt;</code> or <code>page:&lt;rangeStart&gt;-&lt;rangeEnd&gt;</code></li>
			</ul>
		`);
	}
}
Omnisearch._PLACEHOLDER_TEXT = "Search everywhere...";
Omnisearch._searchIndex = null;
Omnisearch._adventureBookLookup = null; // A map of `<sourceLower>: (adventureCatId|bookCatId)`
Omnisearch._pLoadSearch = null;
Omnisearch._CATEGORY_COUNTS = {};

Omnisearch._$searchOut = null;
Omnisearch._$searchOutWrapper = null;
Omnisearch._$searchInputWrapper = null;
Omnisearch._$wrpNoResultsFound = null;

Omnisearch._clickFirst = false;
Omnisearch._MAX_RESULTS = 15;
Omnisearch._showUaEtc = false;
Omnisearch._hideBlocklisted = false;

Omnisearch._STORAGE_NAME = "search";

window.addEventListener("load", () => Omnisearch.init());

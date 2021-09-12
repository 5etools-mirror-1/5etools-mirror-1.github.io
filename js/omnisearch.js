"use strict";

class Omnisearch {
	static init () {
		if (IS_VTT) return;

		const $nav = $(`#navbar`);

		this._$iptSearch = $(`<input class="form-control search omni__input" placeholder="${this._PLACEHOLDER_TEXT}" title="Hotkey: F. Disclaimer: unlikely to search everywhere. Use with caution.">`).disableSpellcheck();
		const $searchSubmit = $(`<button class="btn btn-default omni__submit" tabindex="-1"><span class="glyphicon glyphicon-search"></span></button>`);

		this._$searchInputWrapper = $$`
			<div class="input-group omni__wrp-input">
				${this._$iptSearch}
				<div class="input-group-btn">
					${$searchSubmit}
				</div>
			</div>
		`.appendTo($nav);

		this._$searchOutWrapper = $(`<div class="omni__wrp-output"/>`).insertAfter($nav);
		this._$searchOut = $(`<div class="omni__output"/>`).appendTo(this._$searchOutWrapper);

		$(window).on("click", () => this._$searchOutWrapper.hide());

		this._$searchOut.on("click", e => {
			e.stopPropagation();
			Renderer.hover.cleanTempWindows();
		});

		this._$iptSearch.on("keydown", (e) => {
			e.stopPropagation();
			Renderer.hover.cleanTempWindows();
			switch (e.which) {
				case 13: // enter
					this._clickFirst = true;
					$searchSubmit.click();
					break;
				case 38: // up
					e.preventDefault();
					break;
				case 40: // down
					e.preventDefault();
					this._$searchOut.find(`a.omni__lnk-name`).first().focus();
					break;
				case 27: // escape
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
		this._$iptSearch.on("keyup", (e) => {
			this._clickFirst = false;
			if (e.which >= 37 && e.which <= 40) return;
			clearTimeout(typeTimer);
			typeTimer = setTimeout(() => handleSubmitClick(), TYPE_TIMEOUT_MS);
		});
		this._$iptSearch.on("keydown", () => clearTimeout(typeTimer));
		this._$iptSearch.on("click", (e) => {
			e.stopPropagation();
			Renderer.hover.cleanTempWindows();
			if (this._$iptSearch.val() && this._$iptSearch.val().trim().length) handleSubmitClick();
		});

		$searchSubmit.on("click", evt => handleSubmitClick(evt));

		this._init_initScrollHandler();

		$(document.body).on("keypress", (e) => {
			if (!EventUtil.noModifierKeys(e) || EventUtil.isInInput(e)) return;
			if (e.key !== "F") return;
			e.preventDefault();
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
					this._$iptSearch.attr("placeholder", "");
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

		if (!this._state.isShowUa) {
			results = results.filter(r => !r.doc.s || !SourceUtil._isNonstandardSourceWiz(r.doc.s));
		}

		if (!this._state.isShowBlacklisted && ExcludeUtil.getList().length) {
			results = results.filter(r => {
				if (r.doc.c === Parser.CAT_ID_QUICKREF || r.doc.c === Parser.CAT_ID_PAGE) return true;
				const bCat = Parser.pageCategoryToProp(r.doc.c);
				return !ExcludeUtil.isExcluded(r.doc.u, bCat, r.doc.s, {isNoCount: true});
			});
		}

		return results;
	}

	// region Search
	static async _pDoSearch () {
		const results = await this.pGetResults(this._$iptSearch.val());
		this._pDoSearch_renderLinks(results);
	}

	static _renderLink_getHoverString (category, url, src) {
		return `onmouseover="Renderer.hover.pHandleLinkMouseOver(event, this)" onmouseleave="Renderer.hover.handleLinkMouseLeave(event, this)" onmousemove="Renderer.hover.handleLinkMouseMove(event, this)" data-vet-page="${UrlUtil.categoryToHoverPage(category).qq()}" data-vet-source="${src.qq()}" data-vet-hash="${url.qq()}" ${Renderer.hover.getPreventTouchString()}`;
	}

	static $getResultLink (r) {
		const href = r.c === Parser.CAT_ID_PAGE ? r.u : `${Renderer.get().baseUrl}${UrlUtil.categoryToPage(r.c)}#${r.uh || r.u}`;
		return $(`<a href="${href}" ${r.h ? this._renderLink_getHoverString(r.c, r.u, r.s) : ""} class="omni__lnk-name">${r.cf}: ${r.n}</a>`);
	}

	static _pDoSearch_renderLinks (results, page = 0) {
		let isInitialHooks = true;

		if (this._$btnToggleUa) this._$btnToggleUa.detach();
		else {
			this._$btnToggleUa = $(`<button class="btn btn-default btn-xs mr-2" title="Include Unearthed Arcana and other unofficial source results" tabindex="-1">Include UA/etc.</button>`)
				.on("click", () => this._state.isShowUa = !this._state.isShowUa);

			const hkIsUa = () => {
				this._$btnToggleUa.toggleClass("active", this._state.isShowUa);
				this._pDoSearch();
			};
			this._state._addHookBase("isShowUa", hkIsUa);
			hkIsUa();
		}

		if (this._$btnToggleBlacklisted) this._$btnToggleBlacklisted.detach();
		else {
			this._$btnToggleBlacklisted = $(`<button class="btn btn-default btn-xs mr-2" title="Include blacklisted content results" tabindex="-1">Include Blacklisted</button>`)
				.on("click", async () => this._state.isShowBlacklisted = !this._state.isShowBlacklisted);

			const hkIsBlacklisted = () => {
				this._$btnToggleBlacklisted.toggleClass("active", this._state.isShowBlacklisted);
				if (!isInitialHooks) this._pDoSearch();
			};
			this._state._addHookBase("isShowBlacklisted", hkIsBlacklisted);
			hkIsBlacklisted();
		}
		isInitialHooks = false;

		this._$searchOut.empty();

		const $btnHelp = $(`<button class="btn btn-default btn-xs" title="Help"><span class="glyphicon glyphicon-info-sign"></span></button>`)
			.click(() => this.doShowHelp());

		this._$searchOut.append($(`<div class="text-right"/>`).append([this._$btnToggleUa, this._$btnToggleBlacklisted, $btnHelp]));
		const base = page * this._MAX_RESULTS;
		for (let i = base; i < Math.max(Math.min(results.length, this._MAX_RESULTS + base), base); ++i) {
			const r = results[i].doc;

			const $link = this.$getResultLink(r)
				.keydown(evt => this.handleLinkKeyDown(evt, $link));

			const {s: source, p: page} = r;
			const ptPageInner = page ? `p${page}` : "";
			const adventureBookSourceHref = SourceUtil.getAdventureBookSourceHref(source, page);
			const ptPage = ptPageInner && adventureBookSourceHref
				? `<a href="${adventureBookSourceHref}">${ptPageInner}</a>`
				: ptPageInner;

			const ptSourceInner = source ? `<span class="${Parser.sourceJsonToColor(source)}" ${BrewUtil.sourceJsonToStyle(source)} title="${Parser.sourceJsonToFull(source)}">${Parser.sourceJsonToAbv(source)}</span>` : `<span></span>`;
			const ptSource = ptPage || !adventureBookSourceHref
				? ptSourceInner
				: `<a href="${adventureBookSourceHref}">${ptSourceInner}</a>`;

			$$`<div class="omni__row-result split-v-center stripe-odd">
				${$link}
				<div class="inline-block">
					${ptSource}
					${ptPage}
				</div>
			</div>`.appendTo(this._$searchOut);
		}
		this._$searchOutWrapper.css("display", "flex");

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
				$pgControls.append($nxt)
			} else ($pgControls.append(`<span class="omni__paginate-right omni__paginate-ctrl">`));
			this._$searchOut.append($pgControls);
		}

		if (this._clickFirst && results.length) {
			this._$searchOut.find(`a.omni__lnk-name`).first()[0].click();
		}

		if (!results.length) {
			this._$searchOut.append(`<div class="ve-muted"><i>No results found.</i></div>`)
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

		const saved = StorageUtil.syncGet(this._STORAGE_NAME) || {isShowUa: true, isShowBlacklisted: false};
		class SearchState extends BaseComponent {
			get isShowUa () { return this._state.isShowUa; }
			get isShowBlacklisted () { return this._state.isShowBlacklisted; }
			set isShowUa (val) { this._state.isShowUa = val; }
			set isShowBlacklisted (val) { this._state.isShowBlacklisted = val; }
		}
		this._state = SearchState.fromObject(saved);
		this._state._addHookAll("state", () => {
			StorageUtil.syncSet(this._STORAGE_NAME, this._state.toObject());
		});
	}

	static addHookUa (hk) { this._state._addHookBase("isShowUa", hk); }
	static addHookBlacklisted (hk) { this._state._addHookBase("isShowBlacklisted", hk); }
	static doToggleUa () { this._state.isShowUa = !this._state.isShowUa; }
	static doToggleBlacklisted () { this._state.isShowBlacklisted = !this._state.isShowBlacklisted; }
	static get isShowUa () { return this._state.isShowUa; }
	static get isShowBlacklisted () { return this._state.isShowBlacklisted; }

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
		this.highestId = data.last().id;

		// this doesn't update if the 'Brew changes later, but so be it.
		const brewIndex = await BrewUtil.pGetSearchIndex();
		brewIndex.forEach(it => this._addToIndex(it));
		if (brewIndex.length) this.highestId = brewIndex.last().id

		this._adventureBookLookup = {};
		[brewIndex, data].forEach(index => {
			index.forEach(it => {
				if (it.c === Parser.CAT_ID_ADVENTURE || it.c === Parser.CAT_ID_BOOK) this._adventureBookLookup[it.s.toLowerCase()] = it.c;
			});
		});
	}

	static async pAddToIndex (prop, ...entries) {
		if (!entries.length) return;

		await this.pInit();
		const indexer = new Omnidexer(this.highestId + 1);

		const toIndex = {[prop]: entries};

		const toIndexMultiPart = Omnidexer.TO_INDEX__FROM_INDEX_JSON.filter(it => it.listProp === prop);
		for (const it of toIndexMultiPart) {
			await indexer.pAddToIndex(it, toIndex);
		}
		const toIndexSingle = Omnidexer.TO_INDEX.filter(it => it.listProp === prop);
		for (const it of toIndexSingle) {
			await indexer.pAddToIndex(it, toIndex);
		}

		const toAdd = Omnidexer.decompressIndex(indexer.getIndex());
		toAdd.forEach(it => this._addToIndex(it));
		if (toAdd.length) this.highestId = toAdd.last().id
	}

	static _addToIndex (d) {
		d.cf = Parser.pageCategoryToFull(d.c);
		if (!this._CATEGORY_COUNTS[d.cf]) this._CATEGORY_COUNTS[d.cf] = 1;
		else this._CATEGORY_COUNTS[d.cf]++;
		this._searchIndex.addDoc(d);
	}

	static handleLinkKeyDown (e, $ele) {
		Renderer.hover.cleanTempWindows();
		switch (e.which) {
			case 37: { // left
				e.preventDefault();
				if ($(`.has-results-left`).length) {
					const ix = $ele.parent().index() - 1; // offset as the control bar is at position 0
					$(`.omni__paginate-left`).click();
					const $psNext = this._$searchOut.find(`.omni__row-result`);
					$($psNext[ix] || $psNext[$psNext.length - 1]).find(`a.omni__lnk-name`).focus();
				}
				break;
			}
			case 38: { // up
				e.preventDefault();
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
			case 39: { // right
				e.preventDefault();
				if ($(`.has-results-right`).length) {
					const ix = $ele.parent().index() - 1; // offset as the control bar is at position 0
					$(`.omni__paginate-right`).click();
					const $psNext = this._$searchOut.find(`.omni__row-result`);
					$($psNext[ix] || $psNext[$psNext.length - 1]).find(`a.omni__lnk-name`).focus();
				}
				break;
			}
			case 40: { // down
				e.preventDefault();
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
Omnisearch.highestId = -1;

Omnisearch._$btnToggleUa = null;
Omnisearch._$btnToggleBlacklisted = null;
Omnisearch._$searchOut = null;
Omnisearch._$searchOutWrapper = null;
Omnisearch._$searchInputWrapper = null;
Omnisearch._$wrpNoResultsFound = null;

Omnisearch._clickFirst = false;
Omnisearch._MAX_RESULTS = 15;
Omnisearch._showUaEtc = false;
Omnisearch._hideBlacklisted = false;

Omnisearch._STORAGE_NAME = "search";

window.addEventListener("load", () => Omnisearch.init());

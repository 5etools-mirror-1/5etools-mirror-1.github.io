"use strict";

class BookUtil {
	static getHeaderText (header) {
		return header.header || header;
	}

	static scrollClick (ixChapter, headerText, headerNumber) {
		headerText = headerText.toLowerCase().trim();

		// When handling a non-full-book header in full-book mode, map the header to the appropriate position
		if (!~BookUtil.curRender.chapter && ~ixChapter) {
			const minHeaderIx = BookUtil.curRender.allViewFirstTitleIndexes[ixChapter];
			const maxHeaderIx = BookUtil.curRender.allViewFirstTitleIndexes[ixChapter + 1] == null ? Number.MAX_SAFE_INTEGER : BookUtil.curRender.allViewFirstTitleIndexes[ixChapter + 1];

			// Loop through the list of tracked titles, starting at our chapter's first tracked title, until we hit
			const trackedTitles = BookUtil._renderer.getTrackedTitles();
			const trackedTitleIndexes = Object.keys(trackedTitles).map(it => Number(it)).sort(SortUtil.ascSort);

			// Search for a matching header between the current chapter's header start and end
			let curHeaderNumber = 0;
			const ixTitleUpper = Math.min(trackedTitleIndexes.length, maxHeaderIx) + 1; // +1 since it's 1-indexed
			for (let ixTitle = minHeaderIx; ixTitle < ixTitleUpper; ++ixTitle) {
				let titleName = trackedTitles[ixTitle];
				if (!titleName) return; // Should never occur

				titleName = titleName.toLowerCase().trim();
				if (titleName === headerText) {
					if (curHeaderNumber < headerNumber) {
						curHeaderNumber++;
						continue;
					}

					$(`[data-title-index="${ixTitle}"]`)[0].scrollIntoView();
					break;
				}
			}

			return;
		}

		const trackedTitlesInverse = BookUtil._renderer.getTrackedTitlesInverted({isStripTags: true});

		const ixTitle = (trackedTitlesInverse[headerText] || [])[headerNumber || 0];
		if (ixTitle != null) $(`[data-title-index="${ixTitle}"]`)[0].scrollIntoView();
	}

	static scrollPageTop (ixChapter) {
		// In full-book view, find the Xth section
		if (ixChapter != null && !~BookUtil.curRender.chapter) {
			const ixTitle = BookUtil.curRender.allViewFirstTitleIndexes[ixChapter];
			if (ixTitle != null) $(`[data-title-index="${ixTitle}"]`)[0].scrollIntoView();
			return;
		}

		document.getElementById(`pagecontent`).scrollIntoView();
	}

	static sectToggle (evt, $btnToggleExpand, $headersBlock) {
		if (evt) {
			evt.stopPropagation();
			evt.preventDefault();
		}

		$btnToggleExpand.text($btnToggleExpand.text() === `[+]` ? `[\u2012]` : `[+]`);
		$headersBlock.toggleVe();
	}

	static _showBookContent (data, fromIndex, bookId, hashParts) {
		const ixChapterPrev = BookUtil.curRender.chapter;
		const bookIdPrev = BookUtil.curRender.curBookId;

		let ixChapter = 0;
		let scrollToHeaderText;
		let scrollToHeaderNumber;
		let isForceScroll = false;

		if (hashParts && hashParts.length > 0) ixChapter = Number(hashParts[0]);

		const isRenderingNewChapterOrNewBook = BookUtil.curRender.chapter !== ixChapter
			|| UrlUtil.encodeForHash(bookIdPrev.toLowerCase()) !== UrlUtil.encodeForHash(bookId);

		if (hashParts && hashParts.length > 1) {
			scrollToHeaderText = decodeURIComponent(hashParts[1]);

			isForceScroll = true;
			if (hashParts[2]) {
				scrollToHeaderNumber = Number(hashParts[2]);
			}

			if (BookUtil.referenceId && !isRenderingNewChapterOrNewBook) {
				const isHandledScroll = this._showBookContent_handleQuickReferenceShow({sectionHeader: scrollToHeaderText});
				if (isHandledScroll) {
					isForceScroll = false;
					scrollToHeaderText = null;
				}
			}
		} else if (BookUtil.referenceId) {
			this._showBookContent_handleQuickReferenceShowAll();
		}

		BookUtil.curRender.data = data;
		BookUtil.curRender.fromIndex = fromIndex;
		BookUtil.curRender.headerMap = Renderer.adventureBook.getEntryIdLookup(data);

		// If it's a new chapter or a new book
		if (isRenderingNewChapterOrNewBook) {
			BookUtil.curRender.curBookId = bookId;
			BookUtil.curRender.chapter = ixChapter;
			BookUtil.$dispBook.html("");

			const chapterTitle = (fromIndex.contents[ixChapter] || {}).name;
			document.title = `${chapterTitle ? `${chapterTitle} - ` : ""}${fromIndex.name} - 5etools`;

			BookUtil.curRender.controls = {};
			BookUtil.$dispBook.append(Renderer.utils.getBorderTr());
			this._showBookContent_renderNavButtons({isTop: true, ixChapter, bookId, data});
			const textStack = [];
			BookUtil._renderer
				.setFirstSection(true)
				.setLazyImages(true)
				.resetHeaderIndex()
				.setHeaderIndexTableCaptions(true)
				.setHeaderIndexImageTitles(true);
			if (ixChapter === -1) {
				BookUtil.curRender.allViewFirstTitleIndexes = [];
				data.forEach(d => {
					BookUtil.curRender.allViewFirstTitleIndexes.push(BookUtil._renderer.getHeaderIndex());
					BookUtil._renderer.recursiveRender(d, textStack);
				});
			} else BookUtil._renderer.recursiveRender(data[ixChapter], textStack);
			// If there is no source, we're probably in the Quick Reference, so avoid adding the "Excluded" text, as this is a composite source.
			BookUtil.$dispBook.append(`<tr class="text"><td colspan="6" class="py-2 px-y">${fromIndex.source ? Renderer.utils.getExcludedHtml({entity: fromIndex, dataProp: BookUtil.contentType, page: UrlUtil.getCurrentPage()}) : ""}${textStack.join("")}</td></tr>`);
			Renderer.initLazyImageLoaders();
			BookUtil._renderer
				.setLazyImages(false)
				.setHeaderIndexTableCaptions(false)
				.setHeaderIndexImageTitles(false);
			this._showBookContent_renderNavButtons({ixChapter, bookId, data});

			BookUtil.$dispBook.append(Renderer.utils.getBorderTr());

			if (scrollToHeaderText) {
				let handled = false;
				if (BookUtil.referenceId) handled = this._showBookContent_handleQuickReferenceShow({sectionHeader: scrollToHeaderText});
				if (!handled) {
					setTimeout(() => {
						BookUtil.scrollClick(ixChapter, scrollToHeaderText, scrollToHeaderNumber);
					}, BookUtil.isHashReload ? 15 : 75);
					BookUtil.isHashReload = false;
				}
			}
		} else {
			// It's the same chapter/same book
			if (hashParts.length <= 1) {
				if (~ixChapter) {
					if (BookUtil.referenceId) MiscUtil.scrollPageTop();
					else BookUtil.scrollPageTop();
				} else {
					if (hashParts.length === 1 && BookUtil._$LAST_CLICKED_LINK) {
						const $lastLink = $(BookUtil._$LAST_CLICKED_LINK);
						const lastHref = $lastLink.attr("href");
						const mLink = new RegExp(`^${UrlUtil.PG_ADVENTURE}#${BookUtil.curRender.curBookId},(\\d+)$`, "i").exec(lastHref.trim());
						if (mLink) {
							const linkChapterIx = Number(mLink[1]);
							const ele = $(`#pagecontent tr.text td`).children(`.${Renderer.HEAD_NEG_1}`)[linkChapterIx];
							if (ele) ele.scrollIntoView();
							else setTimeout(() => { throw new Error(`Failed to find header scroll target with index "${linkChapterIx}"`); });
							return;
						}
					}
				}
			} else if (isForceScroll) {
				setTimeout(() => {
					BookUtil.scrollClick(ixChapter, scrollToHeaderText, scrollToHeaderNumber);
				}, BookUtil.isHashReload ? 15 : 75);
			} else if (scrollToHeaderText) {
				setTimeout(() => {
					BookUtil.scrollClick(ixChapter, scrollToHeaderText, scrollToHeaderNumber);
				}, BookUtil.isHashReload ? 15 : 75);
				BookUtil.isHashReload = false;
			}
		}

		this._showBookContent_updateSidebar({ixChapter, ixChapterPrev, bookIdPrev, bookId});

		this._showBookContent_updateControls({ixChapter, data});

		$(`.bk__overlay-loading`).remove();

		if (BookUtil._pendingPageFromHash) {
			const pageTerm = BookUtil._pendingPageFromHash;
			BookUtil._pendingPageFromHash = null;
			BookUtil._handlePageFromHash(pageTerm);
		}
	}

	static _showBookContent_handleQuickReferenceShowAll () {
		$(`.${Renderer.HEAD_NEG_1}`).show();
		$(`.rd__hr--section`).show();
	}

	/**
	 * @param sectionHeader Section header to scroll to.
	 * @return {boolean} True if the scroll happened, false otherwise.
	 */
	static _showBookContent_handleQuickReferenceShow ({sectionHeader}) {
		this._showBookContent_handleQuickReferenceShowAll();

		if (sectionHeader && ~BookUtil.curRender.chapter) {
			const $allSects = $(`.${Renderer.HEAD_NEG_1}`);
			const $toShow = $allSects.filter((i, e) => {
				const $e = $(e);
				const cleanSectionHead = sectionHeader.trim().toLowerCase();
				const $match = $e.children(`.rd__h`).find(`.entry-title-inner`).filter(`:textEquals("${cleanSectionHead}")`);
				return $match.length;
			});

			if ($toShow.length) {
				BookUtil.curRender.lastRefHeader = sectionHeader.toLowerCase();
				$allSects.hide();
				$(`hr.rd__hr--section`).hide();
				$toShow.show();
				MiscUtil.scrollPageTop();
			} else BookUtil.curRender.lastRefHeader = null;
			return !!$toShow.length;
		}
	}

	static _showBookContent_goToPage ({mod, isGetHref, bookId, ixChapter}) {
		const getHashPart = () => {
			const newHashParts = [bookId, ixChapter + mod];
			return newHashParts.join(HASH_PART_SEP);
		};

		const changeChapter = () => {
			window.location.hash = getHashPart();
			MiscUtil.scrollPageTop();
		};

		if (isGetHref) return getHashPart();

		if (BookUtil.referenceId && BookUtil.curRender.lastRefHeader) {
			const chap = BookUtil.curRender.fromIndex.contents[ixChapter];
			const ix = chap.headers.findIndex(it => BookUtil.getHeaderText(it).toLowerCase() === BookUtil.curRender.lastRefHeader);
			if (~ix) {
				if (chap.headers[ix + mod]) {
					const newHashParts = [bookId, ixChapter, BookUtil.getHeaderText(chap.headers[ix + mod]).toLowerCase()];
					window.location.hash = newHashParts.join(HASH_PART_SEP);
				} else {
					changeChapter();
					const nxtHeaders = BookUtil.curRender.fromIndex.contents[ixChapter + mod].headers;
					const nxtIx = mod > 0 ? 0 : nxtHeaders.length - 1;
					const newHashParts = [bookId, ixChapter + mod, nxtHeaders[nxtIx].toLowerCase()];
					window.location.hash = newHashParts.join(HASH_PART_SEP);
				}
			} else changeChapter();
		} else changeChapter();
	}

	static _showBookContent_renderNavButtons ({isTop, ixChapter, bookId, data}) {
		const tdStyle = `padding-${isTop ? "top" : "bottom"}: 6px; padding-left: 9px; padding-right: 9px;`;
		const $wrpControls = $(`<div class="split"/>`).appendTo($(`<td colspan="6" style="${tdStyle}"/>`).appendTo($(`<tr/>`).appendTo(BookUtil.$dispBook)));

		const showPrev = ~ixChapter && ixChapter > 0;
		BookUtil.curRender.controls.$btnsPrv = BookUtil.curRender.controls.$btnsPrv || [];
		let $btnPrev;
		if (BookUtil.referenceId) {
			$btnPrev = $(`<button class="btn btn-xs btn-default bk__nav-head-foot-item"><span class="glyphicon glyphicon-chevron-left"/>Previous</button>`)
				.click(() => this._showBookContent_goToPage({mod: -1, bookId, ixChapter}));
		} else {
			$btnPrev = $(`<a href="#${this._showBookContent_goToPage({mod: -1, isGetHref: true, bookId, ixChapter})}" class="btn btn-xs btn-default bk__nav-head-foot-item"><span class="glyphicon glyphicon-chevron-left"/>Previous</a>`)
				.click(() => MiscUtil.scrollPageTop());
		}
		$btnPrev
			.toggle(showPrev)
			.appendTo($wrpControls);
		BookUtil.curRender.controls.$btnsPrv.push($btnPrev);

		(BookUtil.curRender.controls.$divsPrv = BookUtil.curRender.controls.$divsPrv || [])
			.push($(`<div class="bk__nav-head-foot-item"/>`)
				.toggle(!showPrev)
				.appendTo($wrpControls));

		if (isTop) {
			const href = ~BookUtil.curRender.chapter
				? this._getHrefShowAll(bookId)
				: `#${UrlUtil.encodeForHash(bookId)}`;
			const $btnEntireBook = $(`<a href="${href}" class="btn btn-xs btn-default no-print ${~BookUtil.curRender.chapter ? "" : "active"}" title="Warning: Slow">View Entire ${BookUtil.contentType.uppercaseFirst()}</a>`);

			if (BookUtil._isNarrow == null) {
				const saved = StorageUtil.syncGetForPage("narrowMode");
				if (saved != null) BookUtil._isNarrow = saved;
				else BookUtil._isNarrow = false;
			}

			const hdlNarrowUpdate = () => {
				$btnToggleNarrow.toggleClass("active", BookUtil._isNarrow);
				$(`#pagecontent`).toggleClass(`bk__stats--narrow`, BookUtil._isNarrow);
			};
			const $btnToggleNarrow = $(`<button class="btn btn-xs btn-default" title="Toggle Narrow Reading Width"><span class="glyphicon glyphicon-resize-small"/></button>`)
				.click(() => {
					BookUtil._isNarrow = !BookUtil._isNarrow;
					hdlNarrowUpdate();
					StorageUtil.syncSetForPage("narrowMode", BookUtil._isNarrow);
				});
			hdlNarrowUpdate();

			$$`<div class="no-print ve-flex-v-center btn-group">${$btnEntireBook}${$btnToggleNarrow}</div>`.appendTo($wrpControls);
		} else $(`<button class="btn btn-xs btn-default no-print">Back to Top</button>`).click(() => MiscUtil.scrollPageTop()).appendTo($wrpControls);

		const showNxt = ~ixChapter && ixChapter < data.length - 1;
		BookUtil.curRender.controls.$btnsNxt = BookUtil.curRender.controls.$btnsNxt || [];
		let $btnNext;
		if (BookUtil.referenceId) {
			$btnNext = $(`<button class="btn btn-xs btn-default bk__nav-head-foot-item">Next<span class="glyphicon glyphicon-chevron-right"/></button>`)
				.click(() => this._showBookContent_goToPage({mod: 1, bookId, ixChapter}));
		} else {
			$btnNext = $(`<a href="#${this._showBookContent_goToPage({mod: 1, isGetHref: true, bookId, ixChapter})}" class="btn btn-xs btn-default bk__nav-head-foot-item">Next<span class="glyphicon glyphicon-chevron-right"/></a>`)
				.click(() => MiscUtil.scrollPageTop());
		}
		$btnNext
			.toggle(showNxt)
			.appendTo($wrpControls);
		BookUtil.curRender.controls.$btnsNxt.push($btnNext);

		(BookUtil.curRender.controls.$divsNxt = BookUtil.curRender.controls.$divsNxt || [])
			.push($(`<div class="bk__nav-head-foot-item"/>`)
				.toggle(!showNxt)
				.appendTo($wrpControls));

		if (isTop) {
			BookUtil.$wrpFloatControls.empty();

			let $btnPrev;
			if (BookUtil.referenceId) {
				$btnPrev = $(`<button class="btn btn-xxs btn-default"><span class="glyphicon glyphicon-chevron-left"/></button>`)
					.click(() => this._showBookContent_goToPage({mod: -1, bookId, ixChapter}));
			} else {
				$btnPrev = $(`<a href="#${this._showBookContent_goToPage({mod: -1, isGetHref: true, bookId, ixChapter})}" class="btn btn-xxs btn-default"><span class="glyphicon glyphicon-chevron-left"/></a>`)
					.click(() => MiscUtil.scrollPageTop());
			}
			$btnPrev
				.toggle(showPrev)
				.appendTo(BookUtil.$wrpFloatControls)
				.title("Previous Chapter");
			BookUtil.curRender.controls.$btnsPrv.push($btnPrev);

			let $btnNext;
			if (BookUtil.referenceId) {
				$btnNext = $(`<button class="btn btn-xxs btn-default"><span class="glyphicon glyphicon-chevron-right"/></button>`)
					.click(() => this._showBookContent_goToPage({mod: 1, bookId, ixChapter}));
			} else {
				$btnNext = $(`<a href="#${this._showBookContent_goToPage({mod: 1, isGetHref: true, bookId, ixChapter})}" class="btn btn-xxs btn-default"><span class="glyphicon glyphicon-chevron-right"/></a>`)
					.click(() => MiscUtil.scrollPageTop());
			}
			$btnNext
				.toggle(showNxt)
				.appendTo(BookUtil.$wrpFloatControls)
				.title("Next Chapter");
			BookUtil.curRender.controls.$btnsNxt.push($btnNext);

			BookUtil.$wrpFloatControls.toggleClass("btn-group", showPrev && showNxt);
			BookUtil.$wrpFloatControls.toggleClass("hidden", !~ixChapter);
		}
	}

	static _showBookContent_updateSidebar ({ixChapter, ixChapterPrev, bookIdPrev, bookId}) {
		if (ixChapter === ixChapterPrev && bookIdPrev === bookId) return;

		// region Add highlight to current section
		if (!~ixChapter) {
			// In full-book mode, remove all highlights
			BookUtil.curRender.$lnksChapter.forEach($lnk => $lnk.removeClass("bk__head-chapter--active"));
			Object.values(BookUtil.curRender.$lnksHeader).forEach($lnks => {
				$lnks.forEach($lnk => $lnk.removeClass("bk__head-section--active"));
			});
		} else {
			// In regular chapter mode, add highlights to the appropriate section
			if (ixChapterPrev != null && ~ixChapterPrev) {
				if (BookUtil.curRender.$lnksChapter[ixChapterPrev]) {
					BookUtil.curRender.$lnksChapter[ixChapterPrev].removeClass("bk__head-chapter--active");
					(BookUtil.curRender.$lnksHeader[ixChapterPrev] || []).forEach($lnk => $lnk.removeClass("bk__head-section--active"));
				}
			}

			BookUtil.curRender.$lnksChapter[ixChapter].addClass("bk__head-chapter--active");
			(BookUtil.curRender.$lnksHeader[ixChapter] || []).forEach($lnk => $lnk.addClass("bk__head-section--active"));
		}
		// endregion

		// region Toggle section expanded/not expanded
		// In full-book mode, expand all the sections
		if (!~ixChapter) {
			// If we're in "show all mode," collapse all first, then show all. Otherwise, show all.
			if (BookUtil.curRender.$btnToggleExpandAll.text() === "[\u2012]") BookUtil.curRender.$btnToggleExpandAll.click();
			BookUtil.curRender.$btnToggleExpandAll.click();
			return;
		}

		if (BookUtil.curRender.$btnsToggleExpand[ixChapter] && BookUtil.curRender.$btnsToggleExpand[ixChapter].text() === "[+]") BookUtil.curRender.$btnsToggleExpand[ixChapter].click();
		// endregion
	}

	/**
	 * Update the Previous/Next/To Top buttons at the top/bottom of the page
	 */
	static _showBookContent_updateControls ({ixChapter, data}) {
		if (BookUtil.referenceId) {
			const cnt = BookUtil.curRender.controls;

			if (~ixChapter) {
				const chap = BookUtil.curRender.fromIndex.contents[ixChapter];
				const headerIx = chap.headers.findIndex(it => BookUtil.getHeaderText(it).toLowerCase() === BookUtil.curRender.lastRefHeader);
				const renderPrev = ixChapter > 0 || (~headerIx && headerIx > 0);
				const renderNxt = ixChapter < data.length - 1 || (~headerIx && headerIx < chap.headers.length - 1);
				cnt.$btnsPrv.forEach($it => $it.toggle(!!renderPrev));
				cnt.$btnsNxt.forEach($it => $it.toggle(!!renderNxt));
				cnt.$divsPrv.forEach($it => $it.toggle(!renderPrev));
				cnt.$divsNxt.forEach($it => $it.toggle(!renderNxt));
			} else {
				cnt.$btnsPrv.forEach($it => $it.toggle(false));
				cnt.$btnsNxt.forEach($it => $it.toggle(false));
				cnt.$divsPrv.forEach($it => $it.toggle(true));
				cnt.$divsNxt.forEach($it => $it.toggle(true));
			}
		}
	}

	static initLinkGrabbers () {
		const $body = $(`body`);
		$body.on(`mousedown`, `.entry-title-inner`, function (evt) {
			evt.preventDefault();
		});
		$body.on(`click`, `.entry-title-inner`, async function (evt) {
			const $this = $(this);
			const text = $this.text().trim().replace(/\.$/, "");

			if (evt.shiftKey) {
				await MiscUtil.pCopyTextToClipboard(text);
				JqueryUtil.showCopiedEffect($this);
			} else {
				const hashParts = [BookUtil.curRender.chapter, text, $this.parent().data("title-relative-index")].map(it => UrlUtil.encodeForHash(it));
				const toCopy = [`${window.location.href.split("#")[0]}#${BookUtil.curRender.curBookId}`, ...hashParts];
				await MiscUtil.pCopyTextToClipboard(toCopy.join(HASH_PART_SEP));
				JqueryUtil.showCopiedEffect($this, "Copied link!");
			}
		});
	}

	static initScrollTopFloat () {
		const $wrpScrollTop = Omnisearch.addScrollTopFloat();
		BookUtil.$wrpFloatControls = $(`<div class="ve-flex-vh-center w-100 mb-2 btn-group"/>`).prependTo($wrpScrollTop);
	}

	// custom loading to serve multiple sources
	static async booksHashChange () {
		const $contents = $(".contents");

		const [bookIdRaw, ...hashParts] = window.location.hash.slice(1).split(HASH_PART_SEP);
		const bookId = decodeURIComponent(bookIdRaw);

		const isNewBook = BookUtil.curRender.curBookId !== bookId;

		// Handle "page:" parts
		if (hashParts.some(it => it.toLowerCase().startsWith("page:"))) {
			let term = "";

			// Remove the "page" parts, and save the first one found
			for (let i = 0; i < hashParts.length; ++i) {
				const hashPart = hashParts[i];
				if (hashPart.toLowerCase().startsWith("page:")) {
					if (!term) term = hashPart.toLowerCase().split(":")[1];
					hashParts.splice(i, 1);
					i--;
				}
			}

			// Stash the page for later use
			BookUtil._pendingPageFromHash = term;

			// Re-start the hashchange with our clean hash
			Hist.replaceHistoryHash([bookIdRaw, ...hashParts].join(HASH_PART_SEP));
			return BookUtil.booksHashChange();
		}

		// if current chapter is -1 (full book mode), and a chapter is specified, override + stay in full-book mode
		if (
			BookUtil.curRender.chapter === -1
			&& hashParts.length && hashParts[0] !== "-1"
			&& UrlUtil.encodeForHash(BookUtil.curRender.curBookId) === UrlUtil.encodeForHash(bookId)
		) {
			// Offset any unspecified header indices (i.e. those likely originating from sidebar header clicks) to match
			//   their chapter.
			const [headerName, headerIndex] = hashParts.slice(1);
			if (headerName && !headerIndex) {
				const headerNameClean = decodeURIComponent(headerName).trim().toLowerCase();
				const chapterNum = Number(hashParts[0]);
				const headerMetas = Object.values(BookUtil.curRender.headerMap)
					.filter(it => it.chapter === chapterNum && it.nameClean === headerNameClean);
				// Offset by the lowest relative title index in the chapter
				const offset = Math.min(...headerMetas.map(it => it.ixTitleRel));
				if (isFinite(offset)) hashParts[2] = `${offset}`;
			}

			Hist.replaceHistoryHash([bookIdRaw, -1, ...hashParts.slice(1)].join(HASH_PART_SEP));
			return BookUtil.booksHashChange();
		}

		const fromIndex = BookUtil.bookIndex.find(bk => UrlUtil.encodeForHash(bk.id) === UrlUtil.encodeForHash(bookId));
		if (fromIndex) {
			return this._booksHashChange_pHandleFound({fromIndex, bookId, hashParts, $contents, isNewBook});
		}

		// if it's homebrew
		const fromIndexBrew = BookUtil.bookIndexBrew.find(bk => UrlUtil.encodeForHash(bk.id) === UrlUtil.encodeForHash(bookId));
		if (fromIndexBrew) {
			const brew = await BrewUtil2.pGetBrewProcessed();
			if (!brew[BookUtil.propHomebrewData]) return this._booksHashChange_handleNotFound({$contents, bookId});

			const bookData = (brew[BookUtil.propHomebrewData] || []).find(bk => UrlUtil.encodeForHash(bk.id) === UrlUtil.encodeForHash(bookId));

			if (!bookData) return this._booksHashChange_handleNotFound({$contents, bookId});
			return this._booksHashChange_pHandleFound({fromIndex: fromIndexBrew, homebrewData: bookData, bookId, hashParts, $contents, isNewBook});
		}

		return this._booksHashChange_handleNotFound({$contents, bookId});
	}

	static _booksHashChange_getCleanName (fromIndex) {
		if (fromIndex.parentSource) {
			const fullParentSource = Parser.sourceJsonToFull(fromIndex.parentSource);
			return fromIndex.name.replace(new RegExp(`^${fullParentSource.escapeRegexp()}: `, "i"), `<span title="${Parser.sourceJsonToFull(fromIndex.parentSource).qq()}">${Parser.sourceJsonToAbv(fromIndex.parentSource).qq()}</span>: `);
		}
		return fromIndex.name;
	}

	static async _booksHashChange_pHandleFound ({fromIndex, homebrewData, bookId, hashParts, $contents, isNewBook}) {
		document.title = `${fromIndex.name} - 5etools`;
		$(`.book-head-header`).html(this._booksHashChange_getCleanName(fromIndex));
		$(`.book-head-message`).html("Browse content. Press F to find, and G to go to page.");
		await this._pLoadChapter(fromIndex, bookId, hashParts, homebrewData, $contents);
		NavBar.highlightCurrentPage();
		if (isNewBook) MiscUtil.scrollPageTop();
	}

	static _booksHashChange_handleNotFound ({$contents, bookId}) {
		if (!window.location.hash) return window.history.back();

		$contents.empty();
		BookUtil.$dispBook.empty().html(`<tr><th class="border" colspan="6"></th></tr>
			<tr><td colspan="6" class="initial-message book-loading-message">Loading failed\u2014could not find ${Parser.getArticle(BookUtil.contentType)} ${BookUtil.contentType} with ID "${bookId}". You may need to add it as homebrew first.</td></tr><tr><th class="border" colspan="6"></th></tr>`);

		$(`.bk__overlay-loading`).remove();

		throw new Error(`No book with ID: ${bookId}`);
	}

	static _handlePageFromHash (pageTerm) {
		// Find the first result, and jump to it if it exists
		const found = BookUtil.Search.doSearch(pageTerm, true);
		if (found.length) {
			const firstFound = found[0];
			const nxtHash = BookUtil.Search.getResultHash(BookUtil.curRender.curBookId, firstFound);
			Hist.replaceHistoryHash(nxtHash);
			return BookUtil.booksHashChange();
		} else {
			JqueryUtil.doToast({type: "warning", content: `Could not find page ${pageTerm}!`});
		}
	}

	static async _pLoadChapter (fromIndex, bookId, hashParts, homebrewData, $contents) {
		const data = homebrewData || (await DataUtil.loadJSON(`${BookUtil.baseDataUrl}${bookId.toLowerCase()}.json`));

		const isInitialLoad = BookUtil.curRender.curBookId !== bookId;

		if (isInitialLoad) this._doPopulateContents({$contents, book: fromIndex});

		BookUtil._showBookContent(BookUtil.referenceId ? data.data[BookUtil.referenceId] : data.data, fromIndex, bookId, hashParts);

		if (isInitialLoad) BookUtil._addSearch(fromIndex, bookId);
	}

	static _doPopulateContents ({$contents, book}) {
		$contents.html(BookUtil.allPageUrl ? `<div><a href="${BookUtil.allPageUrl}" class="lst--border lst__row-inner"><span class="bold">\u21FD ${this._getAllTitle()}</span></a></div>` : "");

		BookUtil._$getRenderedContents({book}).appendTo($contents);
	}

	static _getAllTitle () {
		switch (BookUtil.contentType) {
			case "adventure": return "All Adventures";
			case "book": return "All Books";
			default: throw new Error(`Unhandled book content type: "${BookUtil.contentType}"`);
		}
	}

	static handleReNav (ele) {
		const hash = window.location.hash.slice(1).toLowerCase();
		const linkHash = ($(ele).attr("href").split("#")[1] || "").toLowerCase();
		if (hash === linkHash) {
			BookUtil.isHashReload = true;
			BookUtil.booksHashChange();
		}
	}

	static _addSearch (indexData, bookId) {
		$(document.body).on("click", () => {
			if (BookUtil._$findAll) BookUtil._$findAll.remove();
		});

		$(document.body)
			.on("keypress", (evt) => {
				const key = EventUtil.getKeyIgnoreCapsLock(evt);
				if ((key !== "f" && key !== "g") || !EventUtil.noModifierKeys(evt)) return;
				if (EventUtil.isInInput(evt)) return;
				evt.preventDefault();
				BookUtil._showSearchBox(indexData, bookId, key === "g");
			});

		// region Mobile only "open find bar" buttons
		const $btnOpenFind = $(`<button class="btn btn-default btn-sm bk__btn-find no-print" title="Find">F</button>`)
			.click(evt => {
				evt.stopPropagation();
				BookUtil._showSearchBox(indexData, bookId, false);
			});

		const $btnOpenGoto = $(`<button class="btn btn-default btn-sm bk__btn-goto no-print" title="Go to Page">G</button>`)
			.click(evt => {
				evt.stopPropagation();
				BookUtil._showSearchBox(indexData, bookId, true);
			});

		$$`<div class="mobile__visible bk__wrp-btns-open-find btn-group">
			${$btnOpenFind}${$btnOpenGoto}
		</div>`.appendTo(document.body);
	}

	static _showSearchBox (indexData, bookId, isPageMode) {
		$(`span.temp`).contents().unwrap();
		BookUtil._lastHighlight = null;
		if (BookUtil._$findAll) BookUtil._$findAll.remove();
		BookUtil._$findAll = $(`<div class="f-all-wrapper"/>`)
			.on("click", (e) => {
				e.stopPropagation();
			});

		const $results = $(`<div class="f-all-out">`);
		const $srch = $(`<input class="form-control" placeholder="${isPageMode ? "Go to page number..." : "Find text..."}">`)
			.on("keydown", (e) => {
				e.stopPropagation();

				if (e.key === "Enter" && EventUtil.noModifierKeys(e)) {
					const term = $srch.val();
					if (isPageMode) {
						if (!/^\d+$/.exec(term.trim())) {
							return JqueryUtil.doToast({
								content: `Please enter a valid page number.`,
								type: "danger",
							});
						}
					}

					$results.html("");

					const found = BookUtil.Search.doSearch(term, isPageMode);

					if (found.length) {
						$results.show();
						found.forEach(f => {
							const $row = $(`<p class="f-result"/>`);
							const $ptLink = $(`<span/>`);
							const isLitTitle = f.headerMatches && !f.page;
							const $link = $(
								`<a href="#${BookUtil.Search.getResultHash(bookId, f)}">
									<i>${Parser.bookOrdinalToAbv(indexData.contents[f.ch].ordinal)} ${indexData.contents[f.ch].name}${f.header ? ` \u2013 ${isLitTitle ? `<span class="highlight">` : ""}${f.header}${isLitTitle ? `</span>` : ""}` : ""}</i>
								</a>`,
							).click(evt => BookUtil._handleCheckReNav(evt));
							$ptLink.append($link);
							$row.append($ptLink);

							if (!isPageMode && f.previews) {
								const $ptPreviews = $(`<a href="#${BookUtil.Search.getResultHash(bookId, f)}"/>`);
								const re = new RegExp(f.term.escapeRegexp(), "gi");

								$ptPreviews.on("click", evt => {
									BookUtil._handleCheckReNav(evt);

									setTimeout(() => {
										if (BookUtil._lastHighlight === null || BookUtil._lastHighlight !== f.term.toLowerCase()) {
											BookUtil._lastHighlight = f.term;
											$(`#pagecontent`)
												.find(`p:containsInsensitive("${f.term}"), li:containsInsensitive("${f.term}"), td:containsInsensitive("${f.term}"), a:containsInsensitive("${f.term}")`)
												.each((i, ele) => {
													$(ele).html($(ele).html().replace(re, "<span class='temp highlight'>$&</span>"));
												});
										}
									}, 15);
								});

								$ptPreviews.append(`<span>${f.previews[0]}</span>`);
								if (f.previews[1]) {
									$ptPreviews.append(" ... ");
									$ptPreviews.append(`<span>${f.previews[1]}</span>`);
								}
								$row.append($ptPreviews);

								$link.on("click", () => $ptPreviews.click());
							} else {
								if (f.page) {
									const $ptPage = $(`<span>Page ${f.page}</span>`);
									$row.append($ptPage);
								}
							}

							$results.append($row);
						});
					} else {
						$results.hide();
					}
				} else if (e.key === "Escape" && EventUtil.noModifierKeys(e)) {
					BookUtil._$findAll.remove();
				}
			});
		BookUtil._$findAll.append($srch).append($results);

		$(document.body).append(BookUtil._$findAll);

		$srch.focus();
	}

	static _$getRenderedContents (options) {
		const book = options.book;

		BookUtil.curRender.$btnsToggleExpand = [];
		BookUtil.curRender.$lnksChapter = [];
		BookUtil.curRender.$lnksHeader = {};

		BookUtil.curRender.$btnToggleExpandAll = $(`<span title="Expand All" class="px-2 bold py-1p no-select clickable">${BookUtil.isDefaultExpandedContents ? `[\u2012]` : `[+]`}</span>`)
			.click(() => {
				const isExpanded = BookUtil.curRender.$btnToggleExpandAll.text() !== `[+]`;
				BookUtil.curRender.$btnToggleExpandAll.text(isExpanded ? `[+]` : `[\u2012]`).title(isExpanded ? `Collapse All` : `Expand All`);

				BookUtil.curRender.$btnsToggleExpand.forEach($btn => {
					if (!$btn) return;
					if ($btn.text() !== BookUtil.curRender.$btnToggleExpandAll.text()) $btn.click();
				});
			});

		const $eles = [];
		options.book.contents.map((chapter, ixChapter) => {
			const $btnToggleExpand = !chapter.headers ? null : $(`<span class="px-2 bold">[\u2012]</span>`)
				.click(evt => {
					BookUtil.sectToggle(evt, $btnToggleExpand, $chapterBlock);
				});
			BookUtil.curRender.$btnsToggleExpand.push($btnToggleExpand);

			const $lnk = $$`<a href="${options.addPrefix || ""}#${UrlUtil.encodeForHash(options.book.id)},${ixChapter}" class="lst--border lst__row-inner lst__row lst__wrp-cells bold">
					<span class="w-100">${Parser.bookOrdinalToAbv(chapter.ordinal)}${chapter.name}</span>
					${$btnToggleExpand}
			</a>`
				.click(() => BookUtil.scrollPageTop(ixChapter));
			BookUtil.curRender.$lnksChapter.push($lnk);

			const $header = $$`<div class="ve-flex-col">${$lnk}</div>`;
			$eles.push($header);

			const $chapterBlock = BookUtil.$getContentsChapterBlock(options.book.id, ixChapter, chapter, options.addPrefix);
			$eles.push($chapterBlock);

			if (!BookUtil.isDefaultExpandedContents && $btnToggleExpand) BookUtil.sectToggle(null, $btnToggleExpand, $chapterBlock);
		});

		return $$`<div class="contents-item" data-bookid="${UrlUtil.encodeForHash(book.id)}">
			<div class="bk__contents-header">
				<a href="#${UrlUtil.encodeForHash(book.id)}" class="bk__contents_header_link lst__wrp-cells lst__row-inner bold" title="${book.name}">
					<span class="name">${book.name}</span>
				</a>
				<div class="ve-flex-v-center">
					<a href="${this._getHrefShowAll(book.id)}" class="bk__contents_show_all px-2 py-1p ve-flex-v-center lst__wrp-cells lst__row-inner" title="View Entire ${BookUtil.contentType.uppercaseFirst()} (Warning: Slow)">
						<span class="glyphicon glyphicon glyphicon-book" style="top: 0;"/>
					</a>
					${BookUtil.curRender.$btnToggleExpandAll}
				</div>
			</div>
			<div class="bk-contents pl-4 ml-2">
				${$eles}
			</div>
		</div>`;
	}

	static getContentsSectionHeader (header) {
		// handle entries with depth
		if (header.depth) return `<span class="bk-contents__sub_spacer--1">\u2013</span>${header.header}`;
		if (header.header) return header.header;
		return header;
	}

	static $getContentsChapterBlock (bookId, ixChapter, chapter, addPrefix) {
		const headerCounts = {};

		const $eles = [];

		chapter.headers && chapter.headers.forEach(h => {
			const headerText = BookUtil.getHeaderText(h);

			const headerTextClean = headerText.toLowerCase().trim();
			const headerPos = headerCounts[headerTextClean] || 0;
			headerCounts[headerTextClean] = (headerCounts[headerTextClean] || 0) + 1;

			// (Prefer the user-specified `h.index` over the auto-calculated headerPos)
			const headerIndex = h.index ?? headerPos;

			const displayText = this.getContentsSectionHeader(h);

			const $lnk = $$`<a href="${addPrefix || ""}#${UrlUtil.encodeForHash(bookId)},${ixChapter},${UrlUtil.encodeForHash(headerText)}${headerIndex > 0 ? `,${headerIndex}` : ""}" data-book="${bookId}" data-chapter="${ixChapter}" data-header="${headerText.escapeQuotes()}" class="lst__row lst--border lst__row-inner lst__wrp-cells">${displayText}</a>`
				.click(() => {
					BookUtil.scrollClick(ixChapter, headerText, headerIndex);
				});

			const $ele = $$`<div class="ve-flex-col">
				${$lnk}
			</div>`;
			$eles.push($ele);

			(this.curRender.$lnksHeader[ixChapter] = this.curRender.$lnksHeader[ixChapter] || []).push($lnk);
		});

		const $out = $$`<div class="ve-flex-col pl-4 ml-2">
			${$eles}
		</div>`;

		MiscUtil.set(BookUtil._$CACHE_HEADER_BLOCKS, bookId, ixChapter, $out);

		return $out;
	}

	static _handleCheckReNav (evt) {
		const lnk = evt.currentTarget;
		let $lnk = $(lnk);
		while ($lnk.length && !$lnk.is("a")) $lnk = $lnk.parent();
		BookUtil._$LAST_CLICKED_LINK = $lnk[0];

		if (`#${$lnk.attr("href").split("#")[1] || ""}` === window.location.hash) BookUtil.handleReNav(lnk);
	}

	static _getHrefShowAll (bookId) { return `#${UrlUtil.encodeForHash(bookId)},-1`; }
}
// region Last render/etc
BookUtil.curRender = {
	curBookId: "NONE",
	chapter: null, // -1 represents "entire book"
	data: {},
	fromIndex: {},
	lastRefHeader: null,
	controls: {},
	headerMap: {},
	allViewFirstTitleIndexes: [], // A list of "data-title-index"s for the first rendered title in each rendered chapter
	$btnToggleExpandAll: null,
	$btnsToggleExpand: [],

	$lnksChapter: [],
	$lnksHeader: {},
};
BookUtil._$LAST_CLICKED_LINK = null;
BookUtil._isNarrow = null;
// endregion

// region Hashchange
BookUtil.baseDataUrl = "";
BookUtil.bookIndex = [];
BookUtil.bookIndexBrew = [];
BookUtil.propHomebrewData = null;
BookUtil.$dispBook = null;
BookUtil.referenceId = false;
BookUtil.isHashReload = false;
BookUtil.contentType = null; // one of "book" "adventure" or "document"
BookUtil.$wrpFloatControls = null;
// endregion

BookUtil._pendingPageFromHash = null;

BookUtil._renderer = new Renderer().setEnumerateTitlesRel(true).setTrackTitles(true);

BookUtil._$findAll = null;
BookUtil._headerCounts = null;
BookUtil._lastHighlight = null;

BookUtil.Search = class {
	static getResultHash (bookId, found) {
		return `${UrlUtil.encodeForHash(bookId)}${HASH_PART_SEP}${~BookUtil.curRender.chapter ? found.ch : -1}${found.header ? `${HASH_PART_SEP}${UrlUtil.encodeForHash(found.header)}${HASH_PART_SEP}${found.headerIndex}` : ""}`;
	}

	static doSearch (term, isPageMode) {
		if (term == null) return;
		term = term.trim();

		if (isPageMode) {
			if (isNaN(term)) return [];
			else term = Number(term);
		} else {
			if (!term) return [];
		}

		const out = [];

		const toSearch = BookUtil.curRender.data;
		toSearch.forEach((section, i) => {
			BookUtil._headerCounts = {};
			BookUtil.Search._searchEntriesFor(i, out, term, section, isPageMode);
		});

		// If we're in page mode, try hard to identify _something_ to display
		if (isPageMode && !out.length) {
			const [closestPrevPage, closestNextPage] = BookUtil.Search._getClosestPages(toSearch, term);

			toSearch.forEach((section, i) => {
				BookUtil.Search._searchEntriesFor(i, out, closestPrevPage, section, true);
				if (closestNextPage !== closestPrevPage) BookUtil.Search._searchEntriesFor(i, out, closestNextPage, section, true);
			});
		}

		return out;
	}

	static _searchEntriesFor (chapterIndex, appendTo, term, obj, isPageMode) {
		BookUtil._headerCounts = {};

		const cleanTerm = isPageMode ? term : term.toLowerCase();

		BookUtil.Search._searchEntriesForRecursive(chapterIndex, "", appendTo, term, cleanTerm, obj, isPageMode);
	}

	static _searchEntriesForRecursive (chapterIndex, prevLastName, appendTo, term, cleanTerm, obj, isPageMode) {
		if (BookUtil.Search._isNamedEntry(obj)) {
			const cleanName = Renderer.stripTags(obj.name);
			if (BookUtil._headerCounts[cleanName] === undefined) BookUtil._headerCounts[cleanName] = 0;
			else BookUtil._headerCounts[cleanName]++;
		}

		let lastName;
		if (BookUtil.Search._isNamedEntry(obj)) {
			lastName = Renderer.stripTags(obj.name);
			const matches = isPageMode ? obj.page === cleanTerm : lastName.toLowerCase().includes(cleanTerm);
			if (matches) {
				appendTo.push({
					ch: chapterIndex,
					header: lastName,
					headerIndex: BookUtil._headerCounts[lastName],
					term,
					headerMatches: true,
					page: obj.page,
				});
			}
		} else {
			lastName = prevLastName;
		}

		if (obj.entries) {
			obj.entries.forEach(e => BookUtil.Search._searchEntriesForRecursive(chapterIndex, lastName, appendTo, term, cleanTerm, e, isPageMode));
		} else if (obj.items) {
			obj.items.forEach(e => BookUtil.Search._searchEntriesForRecursive(chapterIndex, lastName, appendTo, term, cleanTerm, e, isPageMode));
		} else if (obj.rows) {
			obj.rows.forEach(r => {
				const toSearch = r.row ? r.row : r;
				toSearch.forEach(c => BookUtil.Search._searchEntriesForRecursive(chapterIndex, lastName, appendTo, term, cleanTerm, c, isPageMode));
			});
		} else if (obj.tables) {
			obj.tables.forEach(t => BookUtil.Search._searchEntriesForRecursive(chapterIndex, lastName, appendTo, term, cleanTerm, t, isPageMode));
		} else if (obj.entry) {
			BookUtil.Search._searchEntriesForRecursive(chapterIndex, lastName, appendTo, term, cleanTerm, obj.entry, isPageMode);
		} else if (typeof obj === "string" || typeof obj === "number") {
			if (isPageMode) return;

			const renderStack = [];
			BookUtil._renderer.recursiveRender(obj, renderStack);
			const rendered = $(`<p>${renderStack.join("")}</p>`).text();

			const toCheck = typeof obj === "number" ? String(rendered) : rendered.toLowerCase();
			if (toCheck.includes(cleanTerm)) {
				if (!appendTo.length || (!(appendTo[appendTo.length - 1].header === lastName && appendTo[appendTo.length - 1].headerIndex === BookUtil._headerCounts[lastName] && appendTo[appendTo.length - 1].previews))) {
					const first = toCheck.indexOf(cleanTerm);
					const last = toCheck.lastIndexOf(cleanTerm);

					const slices = [];
					if (first === last) {
						slices.push(getSubstring(rendered, first, first));
					} else {
						slices.push(getSubstring(rendered, first, first + `${cleanTerm}`.length));
						slices.push(getSubstring(rendered, last, last + `${cleanTerm}`.length));
					}
					appendTo.push({
						ch: chapterIndex,
						header: lastName,
						headerIndex: BookUtil._headerCounts[lastName],
						previews: slices.map(s => s.preview),
						term: term,
						matches: slices.map(s => s.match),
						headerMatches: lastName.toLowerCase().includes(cleanTerm),
					});
				} else {
					const last = toCheck.lastIndexOf(cleanTerm);
					const slice = getSubstring(rendered, last, last + `${cleanTerm}`.length);
					const lastItem = appendTo[appendTo.length - 1];
					lastItem.previews[1] = slice.preview;
					lastItem.matches[1] = slice.match;
				}
			}
		}

		function getSubstring (rendered, first, last) {
			let spaceCount = 0;
			let braceCount = 0;
			let pre = "";
			let i = first - 1;
			for (; i >= 0; --i) {
				pre = rendered.charAt(i) + pre;
				if (rendered.charAt(i) === " " && braceCount === 0) {
					spaceCount++;
				}
				if (spaceCount > BookUtil.Search._EXTRA_WORDS) {
					break;
				}
			}
			pre = pre.trimStart();
			const preDots = i > 0;

			spaceCount = 0;
			let post = "";
			const start = first === last ? last + `${cleanTerm}`.length : last;
			i = Math.min(start, rendered.length);
			for (; i < rendered.length; ++i) {
				post += rendered.charAt(i);
				if (rendered.charAt(i) === " " && braceCount === 0) {
					spaceCount++;
				}
				if (spaceCount > BookUtil.Search._EXTRA_WORDS) {
					break;
				}
			}
			post = post.trimEnd();
			const postDots = i < rendered.length;

			const originalTerm = rendered.substr(first, `${term}`.length);

			return {
				preview: `${preDots ? "..." : ""}${pre}<span class="highlight">${originalTerm}</span>${post}${postDots ? "..." : ""}`,
				match: `${pre}${term}${post}`,
			};
		}
	}

	static _isNamedEntry (obj) {
		return obj.name && (obj.type === "entries" || obj.type === "inset" || obj.type === "section");
	}

	static _getClosestPages (toSearch, targetPage) {
		let closestBelow = Number.MIN_SAFE_INTEGER;
		let closestAbove = Number.MAX_SAFE_INTEGER;

		const walker = MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST});
		walker.walk(
			toSearch,
			{
				object: (obj) => {
					if (obj.page) {
						if (obj.page <= targetPage) closestBelow = Math.max(closestBelow, obj.page);
						if (obj.page >= targetPage) closestAbove = Math.min(closestAbove, obj.page);
					}
					return obj;
				},
			},
		);

		return [closestBelow, closestAbove];
	}
};
BookUtil.Search._EXTRA_WORDS = 2;

if (typeof window !== "undefined") {
	window.addEventListener("load", () => $("body").on("click", "a", (evt) => {
		BookUtil._handleCheckReNav(evt);
	}));
}

if (typeof module !== "undefined") {
	module.exports = BookUtil;
}

"use strict";

class NavBar {
	static init () {
		this._initInstallPrompt();
		// render the visible elements ASAP
		window.addEventListener("DOMContentLoaded", NavBar._onDomContentLoaded);
		window.addEventListener("load", NavBar._onLoad);
	}

	static _onDomContentLoaded () {
		NavBar._initElements();
		NavBar.highlightCurrentPage();
	}

	static _onLoad () {
		NavBar._dropdowns = [...document.getElementById("navbar").querySelectorAll(`li.dropdown--navbar`)];
		document.addEventListener("click", () => NavBar._dropdowns.forEach(ele => ele.classList.remove("open")));

		NavBar._clearAllTimers();

		NavBar._initAdventureBookElements().then(null);
	}

	static _initInstallPrompt () {
		NavBar._cachedInstallEvent = null;
		window.addEventListener("beforeinstallprompt", e => NavBar._cachedInstallEvent = e);
	}

	static _initElements () {
		const navBar = document.getElementById("navbar");

		// create mobile "Menu" button
		const btnShowHide = document.createElement("button");
		btnShowHide.className = "btn btn-default page__btn-toggle-nav";
		btnShowHide.innerHTML = "Menu";
		btnShowHide.onclick = () => {
			$(btnShowHide).toggleClass("active");
			$(`.page__nav-hidden-mobile`).toggleClass("block", $(btnShowHide).hasClass("active"));
		};
		document.getElementById("navigation").prepend(btnShowHide);

		this._addElement_li(navBar, "index.html", "Home", {isRoot: true});

		const ulRules = this._addElement_dropdown(navBar, "Rules");
		this._addElement_li(ulRules, "quickreference.html", "Quick Reference");
		this._addElement_li(ulRules, "variantrules.html", "Optional, Variant, and Expanded Rules");
		this._addElement_li(ulRules, "tables.html", "Tables");
		this._addElement_divider(ulRules);
		const ulBooks = this._addElement_dropdown(ulRules, "Books", {isSide: true});
		this._addElement_li(ulBooks, "books.html", "View All/Homebrew");
		NavBar._ulBooks = ulBooks;

		const ulPlayers = this._addElement_dropdown(navBar, "Player");
		this._addElement_li(ulPlayers, "classes.html", "Classes");
		this._addElement_li(ulPlayers, "backgrounds.html", "Backgrounds");
		this._addElement_li(ulPlayers, "feats.html", "Feats");
		this._addElement_li(ulPlayers, "races.html", "Races");
		this._addElement_li(ulPlayers, "charcreationoptions.html", "Other Character Creation Options");
		this._addElement_li(ulPlayers, "optionalfeatures.html", "Other Options & Features");
		this._addElement_divider(ulPlayers);
		this._addElement_li(ulPlayers, "statgen.html", "Stat Generator");
		this._addElement_divider(ulPlayers);
		this._addElement_li(ulPlayers, "lifegen.html", "This Is Your Life");
		this._addElement_li(ulPlayers, "names.html", "Names");

		const ulDms = this._addElement_dropdown(navBar, "Dungeon Master");
		this._addElement_li(ulDms, "dmscreen.html", "DM Screen");
		this._addElement_divider(ulDms);
		const ulAdventures = this._addElement_dropdown(ulDms, "Adventures", {isSide: true});
		this._addElement_li(ulAdventures, "adventures.html", "View All/Homebrew");
		NavBar._ulAdventures = ulAdventures;
		this._addElement_li(ulDms, "cultsboons.html", "Cults & Supernatural Boons");
		this._addElement_li(ulDms, "objects.html", "Objects");
		this._addElement_li(ulDms, "trapshazards.html", "Traps & Hazards");
		this._addElement_divider(ulDms);
		this._addElement_li(ulDms, "crcalculator.html", "CR Calculator");
		this._addElement_li(ulDms, "encountergen.html", "Encounter Generator");
		this._addElement_li(ulDms, "lootgen.html", "Loot Generator");

		const ulReferences = this._addElement_dropdown(navBar, "References");
		this._addElement_li(ulReferences, "actions.html", "Actions");
		this._addElement_li(ulReferences, "bestiary.html", "Bestiary");
		this._addElement_li(ulReferences, "conditionsdiseases.html", "Conditions & Diseases");
		this._addElement_li(ulReferences, "deities.html", "Deities");
		this._addElement_li(ulReferences, "items.html", "Items");
		this._addElement_li(ulReferences, "languages.html", "Languages");
		this._addElement_li(ulReferences, "rewards.html", "Supernatural Gifts & Rewards");
		this._addElement_li(ulReferences, "psionics.html", "Psionics");
		this._addElement_li(ulReferences, "spells.html", "Spells");
		this._addElement_li(ulReferences, "vehicles.html", "Vehicles");
		this._addElement_divider(ulReferences);
		this._addElement_li(ulReferences, "recipes.html", "Recipes");

		const ulUtils = this._addElement_dropdown(navBar, "Utilities");
		this._addElement_li(ulUtils, "search.html", "Search");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "blacklist.html", "Content Blacklist");
		this._addElement_li(ulUtils, "makebrew.html", "Homebrew Builder");
		this._addElement_li(ulUtils, "managebrew.html", "Homebrew Manager");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "inittrackerplayerview.html", "Initiative Tracker Player View");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "renderdemo.html", "Renderer Demo");
		this._addElement_li(ulUtils, "makecards.html", "RPG Cards JSON Builder");
		this._addElement_li(ulUtils, "converter.html", "Text Converter");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "plutonium.html", "Plutonium (Foundry Module) Features");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "roll20.html", "Roll20 Script Help");
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "changelog.html", "Changelog");
		this._addElement_li(ulUtils, `https://wiki.5e.tools/index.php/Page:_${NavBar._getCurrentPage().replace(/.html$/i, "")}`, "Help", {isExternal: true});
		this._addElement_divider(ulUtils);
		this._addElement_li(ulUtils, "privacy-policy.html", "Privacy Policy");

		const ulSettings = this._addElement_dropdown(navBar, "Settings");
		this._addElement_button(
			ulSettings,
			{
				html: styleSwitcher.getDayNightButtonText(),
				click: (evt) => NavBar.InteractionManager._onClick_button_dayNight(evt),
				context: (evt) => NavBar.InteractionManager._onContext_button_dayNight(evt),
				className: "nightModeToggle",
			},
		);
		this._addElement_button(
			ulSettings,
			{
				html: styleSwitcher.getActiveWide() === true ? "Disable Wide Mode" : "Enable Wide Mode (Experimental)",
				click: (evt) => NavBar.InteractionManager._onClick_button_wideMode(evt),
				className: "wideModeToggle",
				title: "This feature is unsupported. Expect bugs.",
			},
		);
		this._addElement_divider(ulSettings);
		this._addElement_button(
			ulSettings,
			{
				html: "Save State to File",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_saveStateFile(evt),
				title: "Save any locally-stored data (loaded homebrew, active blacklists, DM Screen configuration,...) to a file.",
			},
		);
		this._addElement_button(
			ulSettings,
			{
				html: "Load State from File",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_loadStateFile(evt),
				title: "Load previously-saved data (loaded homebrew, active blacklists, DM Screen configuration,...) from a file.",
			},
		);
		this._addElement_divider(ulSettings);
		this._addElement_button(
			ulSettings,
			{
				html: "Add as App",
				click: async (evt) => NavBar.InteractionManager._pOnClick_button_addApp(evt),
				title: "Add the site to your home screen. When used in conjunction with the Preload Offline Data option, this can create a functional offline copy of the site.",
			},
		);
		this._addElement_button(
			ulSettings,
			{
				html: "Preload Offline Data",
				click: (evt) => NavBar.InteractionManager._pOnClick_button_preloadOffline(evt),
				title: "Preload the site data for offline use. Warning: slow. If it appears to freeze, cancel it and try again; progress will be saved.",
			},
		);
	}

	/**
	 * Adventure/book elements are added as a second, asynchronous, step, as they require loading of:
	 * - An index JSON file.
	 * - The user's Blacklist.
	 */
	static async _initAdventureBookElements () {
		const [adventureBookIndex] = await Promise.all([
			DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/gendata-nav-adventure-book-index.json`),
			ExcludeUtil.pInitialise(),
		]);

		[
			{
				prop: "book",
				ul: NavBar._ulBooks,
				page: "book.html",
				fnSort: SortUtil.ascSortBook.bind(SortUtil),
			},
			{
				prop: "adventure",
				page: "adventure.html",
				ul: NavBar._ulAdventures,
				fnSort: SortUtil.ascSortAdventure.bind(SortUtil),
			},
		].forEach(({prop, ul, page, fnSort}) => {
			const metas = adventureBookIndex[prop]
				.filter(it => !ExcludeUtil.isExcluded(UrlUtil.encodeForHash(it.id.toLowerCase()), prop, it.source, {isNoCount: true}));

			if (metas.length) {
				NavBar._GROUP_ORDER[prop]
					.forEach(group => {
						const inGroup = metas.filter(it => (it.group || "other") === group);
						if (!inGroup.length) return;

						this._addElement_divider(ul);

						const seenYears = new Set();

						inGroup
							.sort(fnSort)
							.forEach(indexMeta => {
								const year = indexMeta.published ? (new Date(indexMeta.published).getFullYear()) : null;
								const isNewYear = year != null && !seenYears.has(year);
								if (year != null) seenYears.add(year);

								this._addElement_li(
									ul,
									page,
									indexMeta.name,
									{
										aHash: indexMeta.id,
										date: isNewYear ? year : null,
										isAddDateSpacer: !isNewYear,
									},
								);
							});
					});
			}
		});
	}

	/**
	 * Adds a new item to the navigation bar. Can be used either in root, or in a different UL.
	 * @param appendTo - Element to append this link to.
	 * @param aHref - Where does this link to.
	 * @param aText - What text does this link have.
	 * @param [opts] - Options object.
	 * @param [opts.isSide] - True if this item is part of a side menu.
	 * @param [opts.aHash] - Optional hash to be appended to the base href
	 * @param [opts.isRoot] - If the item is a root navbar element.
	 * @param [opts.isExternal] - If the item is an external link.
	 * @param [opts.date] - A date to prefix the list item with.
	 * @param [opts.isAddDateSpacer] - True if this item has no date, but is in a list of items with dates.
	 */
	static _addElement_li (appendTo, aHref, aText, opts) {
		opts = opts || {};
		const hashPart = opts.aHash ? `#${opts.aHash}`.toLowerCase() : "";

		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.setAttribute("data-page", `${aHref}${hashPart}`);
		if (opts.isRoot) {
			li.classList.add("page__nav-hidden-mobile");
			li.classList.add("page__btn-nav-root");
		}
		if (opts.isSide) {
			li.onmouseenter = function () { NavBar._handleSideItemMouseEnter(this) }
		} else {
			li.onmouseenter = function () { NavBar._handleItemMouseEnter(this) };
			li.onclick = function () { NavBar._dropdowns.forEach(ele => ele.classList.remove("open")) }
		}

		const a = document.createElement("a");
		a.href = `${aHref}${hashPart}`;
		a.innerHTML = `${(opts.date != null || opts.isAddDateSpacer) ? `<span class="ve-muted ve-small mr-2 page__nav-date inline-block text-right">${opts.date || ""}</span>` : ""}${aText}`;
		a.classList.add("nav__link");

		if (opts.isExternal) {
			a.setAttribute("target", "_blank");
			a.classList.add("inline-split-v-center");
			a.classList.add("w-100");
			a.innerHTML = `<span>${aText}</span><span class="glyphicon glyphicon-new-window"/>`
		}

		li.appendChild(a);
		appendTo.appendChild(li);
	}

	static _addElement_divider (appendTo) {
		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = "divider";

		appendTo.appendChild(li);
	}

	/**
	 * Adds a new dropdown starting list to the navigation bar
	 * @param {String} appendTo - Element to append this link to.
	 * @param {String} text - Dropdown text.
	 * @param {boolean} [isSide=false] - If this is a sideways dropdown.
	 */
	static _addElement_dropdown (appendTo, text, {isSide = false} = {}) {
		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		li.className = `dropdown dropdown--navbar page__nav-hidden-mobile ${isSide ? "" : "page__btn-nav-root"}`;
		if (isSide) {
			li.onmouseenter = function () { NavBar._handleSideItemMouseEnter(this); };
		} else {
			li.onmouseenter = function () { NavBar._handleItemMouseEnter(this); };
		}

		const a = document.createElement("a");
		a.className = "dropdown-toggle";
		a.href = "#";
		a.setAttribute("role", "button");
		a.onclick = function (event) { NavBar._handleDropdownClick(this, event, isSide); };
		if (isSide) {
			a.onmouseenter = function () { NavBar._handleSideDropdownMouseEnter(this); };
			a.onmouseleave = function () { NavBar._handleSideDropdownMouseLeave(this); };
		}
		a.innerHTML = `${text} <span class="caret ${isSide ? "caret--right" : ""}"></span>`;

		const ul = document.createElement("li");
		ul.className = `dropdown-menu ${isSide ? "dropdown-menu--side" : "dropdown-menu--top"}`;
		ul.onclick = function (event) { event.stopPropagation(); };

		li.appendChild(a);
		li.appendChild(ul);
		appendTo.appendChild(li);
		return ul;
	}

	/**
	 * Special LI for button
	 * @param appendTo The element to append to.
	 * @param options Options.
	 * @param options.html Button text.
	 * @param options.click Button click handler.
	 * @param [options.context] Button context menu handler.
	 * @param options.title Button title.
	 * @param options.className Additional button classes.
	 */
	static _addElement_button (appendTo, options) {
		const li = document.createElement("li");
		li.setAttribute("role", "presentation");

		const a = document.createElement("a");
		a.href = "#";
		if (options.className) a.className = options.className;
		a.onclick = options.click;
		a.innerHTML = options.html;

		if (options.context) a.oncontextmenu = options.context;

		if (options.title) li.setAttribute("title", options.title);

		li.appendChild(a);
		appendTo.appendChild(li);
	}

	static _getCurrentPage () {
		let currentPage = window.location.pathname;
		currentPage = currentPage.substr(currentPage.lastIndexOf("/") + 1);

		if (!currentPage) currentPage = "index.html";
		return currentPage.trim();
	}

	static highlightCurrentPage () {
		let currentPage = NavBar._getCurrentPage();

		let isSecondLevel = false;
		if (currentPage.toLowerCase() === "book.html" || currentPage.toLowerCase() === "adventure.html") {
			const hashPart = window.location.hash.split(",")[0];
			if (currentPage.toLowerCase() === "adventure.html" || currentPage.toLowerCase() === "book.html") isSecondLevel = true;
			currentPage += hashPart.toLowerCase();
		}
		if (currentPage.toLowerCase() === "adventures.html" || currentPage.toLowerCase() === "books.html") isSecondLevel = true;

		if (typeof _SEO_PAGE !== "undefined") currentPage = `${_SEO_PAGE}.html`;

		try {
			let current = document.querySelector(`li[data-page="${currentPage}"]`);
			if (current == null) {
				currentPage = currentPage.split("#")[0];
				if (NavBar._ALT_CHILD_PAGES[currentPage]) currentPage = NavBar._ALT_CHILD_PAGES[currentPage];
				current = document.querySelector(`li[data-page="${currentPage}"]`);
			}
			current.parentNode.childNodes.forEach(n => n.classList && n.classList.remove("active"));
			current.classList.add("active");

			let closestLi = current.parentNode;
			const setNearestParentActive = () => {
				while (closestLi !== null && (closestLi.nodeName !== "LI" || !closestLi.classList.contains("dropdown"))) closestLi = closestLi.parentNode;
				closestLi && closestLi.classList.add("active");
			};
			setNearestParentActive();
			if (isSecondLevel) {
				closestLi = closestLi.parentNode;
				setNearestParentActive();
			}
		} catch (ignored) { setTimeout(() => { throw ignored }); }
	}

	static _handleDropdownClick (ele, event, isSide) {
		event.preventDefault();
		event.stopPropagation();
		if (isSide) return;
		const isOpen = ele.parentNode.classList.contains("open");
		if (isOpen) NavBar._dropdowns.forEach(ele => ele.classList.remove("open"));
		else NavBar._openDropdown(ele);
	}

	static _openDropdown (fromLink) {
		const noRemove = new Set();
		let parent = fromLink.parentNode;
		parent.classList.add("open");
		noRemove.add(parent);

		while (parent.nodeName !== "NAV") {
			parent = parent.parentNode;
			if (parent.nodeName === "LI") {
				parent.classList.add("open");
				noRemove.add(parent);
			}
		}

		NavBar._dropdowns.filter(ele => !noRemove.has(ele)).forEach(ele => ele.classList.remove("open"));
	}

	static _handleItemMouseEnter (ele) {
		const $ele = $(ele);
		const timerIds = $ele.siblings("[data-timer-id]").map((i, e) => ({$ele: $(e), timerId: $(e).data("timer-id")})).get();
		timerIds.forEach(({$ele, timerId}) => {
			if (NavBar._timersOpen[timerId]) {
				clearTimeout(NavBar._timersOpen[timerId]);
				delete NavBar._timersOpen[timerId];
			}

			if (!NavBar._timersClose[timerId] && $ele.hasClass("open")) {
				const getTimeoutFn = () => {
					if (NavBar._timerMousePos[timerId]) {
						const [xStart, yStart] = NavBar._timerMousePos[timerId];
						// for generalised use, this should be made check against the bounding box for the side menu
						// and possibly also check Y pos; e.g.
						// || EventUtil._mouseY > yStart + NavBar._MIN_MOVE_PX
						if (EventUtil._mouseX > xStart + NavBar._MIN_MOVE_PX) {
							NavBar._timerMousePos[timerId] = [EventUtil._mouseX, EventUtil._mouseY];
							NavBar._timersClose[timerId] = setTimeout(() => getTimeoutFn(), NavBar._DROP_TIME / 2);
						} else {
							$ele.removeClass("open");
							delete NavBar._timersClose[timerId];
						}
					} else {
						$ele.removeClass("open");
						delete NavBar._timersClose[timerId];
					}
				};

				NavBar._timersClose[timerId] = setTimeout(() => getTimeoutFn(), NavBar._DROP_TIME);
			}
		});
	}

	static _handleSideItemMouseEnter (ele) {
		const timerId = $(ele).closest(`li.dropdown`).data("timer-id");
		if (NavBar._timersClose[timerId]) {
			clearTimeout(NavBar._timersClose[timerId]);
			delete NavBar._timersClose[timerId];
			delete NavBar._timerMousePos[timerId];
		}
	}

	static _handleSideDropdownMouseEnter (ele) {
		const $ele = $(ele);
		const timerId = $ele.parent().data("timer-id") || NavBar._timerId++;
		$ele.parent().attr("data-timer-id", timerId);

		if (NavBar._timersClose[timerId]) {
			clearTimeout(NavBar._timersClose[timerId]);
			delete NavBar._timersClose[timerId];
		}

		if (!NavBar._timersOpen[timerId]) {
			NavBar._timersOpen[timerId] = setTimeout(() => {
				NavBar._openDropdown(ele);
				delete NavBar._timersOpen[timerId];
				NavBar._timerMousePos[timerId] = [EventUtil._mouseX, EventUtil._mouseY];
			}, NavBar._DROP_TIME);
		}
	}

	static _handleSideDropdownMouseLeave (ele) {
		const $ele = $(ele);
		if (!$ele.parent().data("timer-id")) return;
		const timerId = $ele.parent().data("timer-id");
		clearTimeout(NavBar._timersOpen[timerId]);
		delete NavBar._timersOpen[timerId];
	}

	static _clearAllTimers () {
		Object.entries(NavBar._timersOpen).forEach(([k, v]) => {
			clearTimeout(v);
			delete NavBar._timersOpen[k];
		});
	}
}
NavBar._DROP_TIME = 250;
NavBar._MIN_MOVE_PX = 3;
NavBar._ALT_CHILD_PAGES = {
	"book.html": "books.html",
	"adventure.html": "adventures.html",
};
NavBar._GROUP_ORDER = {
	"book": [
		"core",
		"supplement",
		"homebrew",
		"screen",
		"other",
	],
	"adventure": [
		"other",
	],
}

NavBar._ulBooks = null;
NavBar._ulAdventures = null;

NavBar._timerId = 1;
NavBar._timersOpen = {};
NavBar._timersClose = {};
NavBar._timerMousePos = {};
NavBar._cachedInstallEvent = null;
NavBar._downloadBarMeta = null;

NavBar.InteractionManager = class {
	static _onClick_button_dayNight (evt) {
		evt.preventDefault();
		styleSwitcher.cycleDayNightMode();
	}

	static _onContext_button_dayNight (evt) {
		evt.preventDefault();
		styleSwitcher.cycleDayNightMode(-1);
	}

	static _onClick_button_wideMode (evt) {
		evt.preventDefault();
		styleSwitcher.toggleWide();
	}

	static async _pOnClick_button_saveStateFile (evt) {
		evt.preventDefault();
		const sync = StorageUtil.syncGetDump();
		const async = await StorageUtil.pGetDump();
		const dump = {sync, async};
		DataUtil.userDownload("5etools", dump, {fileType: "5etools"});
	}

	static async _pOnClick_button_loadStateFile (evt) {
		evt.preventDefault();
		const jsons = await DataUtil.pUserUpload({expectedFileType: "5etools"});
		if (!jsons?.length) return;
		const dump = jsons[0];

		try {
			StorageUtil.syncSetFromDump(dump.sync);
			await StorageUtil.pSetFromDump(dump.async);
			location.reload();
		} catch (e) {
			JqueryUtil.doToast({type: "danger", content: `Failed to load state! ${VeCt.STR_SEE_CONSOLE}`});
			throw e;
		}
	}

	static async _pOnClick_button_addApp (evt) {
		evt.preventDefault();
		try {
			NavBar._cachedInstallEvent.prompt();
		} catch (e) {
			// Ignore errors
		}
	}

	static async _pOnClick_button_preloadOffline (evt) {
		evt.preventDefault();

		if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
			JqueryUtil.doToast(`The loader was not yet available! Reload the page and try again. If this problem persists, your browser may not support preloading.`);
			return;
		}

		// a pipe with has "port1" and "port2" props; we'll send "port2" to the service worker so it can
		//   send messages back down the pipe to us
		const messageChannel = new MessageChannel();
		let hasSentPort = false;
		const sendMessage = (data) => {
			try {
				// Only send the MessageChannel port once, as the first send will transfer ownership of the
				//   port over to the service worker (and we can no longer access it to even send it)
				if (!hasSentPort) {
					hasSentPort = true;
					navigator.serviceWorker.controller.postMessage(data, [messageChannel.port2]);
				} else {
					navigator.serviceWorker.controller.postMessage(data);
				}
			} catch (e) {
				// Ignore errors
				setTimeout(() => { throw e; })
			}
		};

		if (NavBar._downloadBarMeta) {
			if (NavBar._downloadBarMeta) {
				NavBar._downloadBarMeta.$wrpOuter.remove();
				NavBar._downloadBarMeta = null;
			}
			sendMessage({"type": "cache-cancel"});
		}

		const $dispProgress = $(`<div class="page__disp-download-progress-bar"/>`);
		const $dispPct = $(`<div class="page__disp-download-progress-text flex-vh-center bold">0%</div>`);

		const $btnCancel = $(`<button class="btn btn-default"><span class="glyphicon glyphicon-remove"></span></button>`)
			.click(() => {
				if (NavBar._downloadBarMeta) {
					NavBar._downloadBarMeta.$wrpOuter.remove();
					NavBar._downloadBarMeta = null;
				}
				sendMessage({"type": "cache-cancel"});
			});

		const $wrpBar = $$`<div class="page__wrp-download-bar w-100 relative mr-2">${$dispProgress}${$dispPct}</div>`;
		const $wrpOuter = $$`<div class="page__wrp-download">
			${$wrpBar}
			${$btnCancel}
		</div>`.appendTo(document.body);

		NavBar._downloadBarMeta = {$wrpOuter, $wrpBar, $dispProgress, $dispPct};

		// Trigger the service worker to cache everything
		messageChannel.port1.onmessage = e => {
			const msg = e.data;
			switch (msg.type) {
				case "download-progress": {
					if (NavBar._downloadBarMeta) {
						NavBar._downloadBarMeta.$dispProgress.css("width", msg.data.pct);
						NavBar._downloadBarMeta.$dispPct.text(msg.data.pct);
					}
					break;
				}
				case "download-cancelled": {
					if (NavBar._downloadBarMeta) {
						NavBar._downloadBarMeta.$wrpOuter.remove();
						NavBar._downloadBarMeta = null;
					}
					break;
				}
				case "download-error": {
					if (NavBar._downloadBarMeta) {
						NavBar._downloadBarMeta.$wrpBar.addClass("page__wrp-download-bar--error");
						NavBar._downloadBarMeta.$dispProgress.addClass("page__disp-download-progress-bar--error");
						NavBar._downloadBarMeta.$dispPct.text("Error!");

						JqueryUtil.doToast(`An error occurred. ${VeCt.STR_SEE_CONSOLE}`);
					}
					setTimeout(() => { throw new Error(msg.message); })
					break;
				}
			}
		};

		sendMessage({"type": "cache-start"});
	}
}

NavBar.init();

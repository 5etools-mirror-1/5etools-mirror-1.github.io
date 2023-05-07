"use strict";

// ENTRY RENDERING =====================================================================================================
/*
 * // EXAMPLE USAGE //
 *
 * const entryRenderer = new Renderer();
 *
 * const topLevelEntry = mydata[0];
 * // prepare an array to hold the string we collect while recursing
 * const textStack = [];
 *
 * // recurse through the entry tree
 * entryRenderer.renderEntries(topLevelEntry, textStack);
 *
 * // render the final product by joining together all the collected strings
 * $("#myElement").html(toDisplay.join(""));
 */
globalThis.Renderer = function () {
	this.wrapperTag = "div";
	this.baseUrl = "";
	this.baseMediaUrls = {};

	if (globalThis.DEPLOYED_IMG_ROOT) {
		this.baseMediaUrls["img"] = globalThis.DEPLOYED_IMG_ROOT;
	}

	this._lazyImages = false;
	this._subVariant = false;
	this._firstSection = true;
	this._isAddHandlers = true;
	this._headerIndex = 1;
	this._tagExportDict = null;
	this._roll20Ids = null;
	this._trackTitles = {enabled: false, titles: {}};
	this._enumerateTitlesRel = {enabled: false, titles: {}};
	this._isHeaderIndexIncludeTableCaptions = false;
	this._isHeaderIndexIncludeImageTitles = false;
	this._plugins = {};
	this._fnPostProcess = null;
	this._extraSourceClasses = null;
	this._depthTracker = null;
	this._depthTrackerAdditionalProps = [];
	this._depthTrackerAdditionalPropsInherited = [];
	this._lastDepthTrackerInheritedProps = {};
	this._isInternalLinksDisabled = false;
	this._isPartPageExpandCollapseDisabled = false;
	this._fnsGetStyleClasses = {};

	/**
	 * Enables/disables lazy-load image rendering.
	 * @param bool true to enable, false to disable.
	 */
	this.setLazyImages = function (bool) {
		// hard-disable lazy loading if the Intersection API is unavailable (e.g. under iOS 12)
		if (typeof IntersectionObserver === "undefined") this._lazyImages = false;
		else this._lazyImages = !!bool;
		return this;
	};

	/**
	 * Set the tag used to group rendered elements
	 * @param tag to use
	 */
	this.setWrapperTag = function (tag) { this.wrapperTag = tag; return this; };

	/**
	 * Set the base url for rendered links.
	 * Usage: `renderer.setBaseUrl("https://www.example.com/")` (note the "http" prefix and "/" suffix)
	 * @param url to use
	 */
	this.setBaseUrl = function (url) { this.baseUrl = url; return this; };

	this.setBaseMediaUrl = function (mediaDir, url) { this.baseMediaUrls[mediaDir] = url; return this; };

	/**
	 * Other sections should be prefixed with a vertical divider
	 * @param bool
	 */
	this.setFirstSection = function (bool) { this._firstSection = bool; return this; };

	/**
	 * Disable adding JS event handlers on elements.
	 * @param bool
	 */
	this.setAddHandlers = function (bool) { this._isAddHandlers = bool; return this; };

	/**
	 * Add a post-processing function which acts on the final rendered strings from a root call.
	 * @param fn
	 */
	this.setFnPostProcess = function (fn) { this._fnPostProcess = fn; return this; };

	/**
	 * Specify a list of extra classes to be added to those rendered on entries with sources.
	 * @param arr
	 */
	this.setExtraSourceClasses = function (arr) { this._extraSourceClasses = arr; return this; };

	// region Header index
	/**
	 * Headers are ID'd using the attribute `data-title-index` using an incrementing int. This resets it to 1.
	 */
	this.resetHeaderIndex = function () {
		this._headerIndex = 1;
		this._trackTitles.titles = {};
		this._enumerateTitlesRel.titles = {};
		return this;
	};

	this.getHeaderIndex = function () { return this._headerIndex; };

	this.setHeaderIndexTableCaptions = function (bool) { this._isHeaderIndexIncludeTableCaptions = bool; return this; };
	this.setHeaderIndexImageTitles = function (bool) { this._isHeaderIndexIncludeImageTitles = bool; return this; };
	// endregion

	/**
	 * Pass an object to have the renderer export lists of found @-tagged content during renders
	 *
	 * @param toObj the object to fill with exported data. Example results:
	 * 			{
	 *				commoner_mm: {page: "bestiary.html", source: "MM", hash: "commoner_mm"},
	 *				storm%20giant_mm: {page: "bestiary.html", source: "MM", hash: "storm%20giant_mm"},
	 *				detect%20magic_phb: {page: "spells.html", source: "PHB", hash: "detect%20magic_phb"}
	 *			}
	 * 			These results intentionally match those used for hover windows, so can use the same cache/loading paths
	 */
	this.doExportTags = function (toObj) {
		this._tagExportDict = toObj;
		return this;
	};

	/**
	 * Reset/disable tag export
	 */
	this.resetExportTags = function () {
		this._tagExportDict = null;
		return this;
	};

	this.setRoll20Ids = function (roll20Ids) {
		this._roll20Ids = roll20Ids;
		return this;
	};

	this.resetRoll20Ids = function () {
		this._roll20Ids = null;
		return this;
	};

	/** Used by Foundry config. */
	this.setInternalLinksDisabled = function (val) { this._isInternalLinksDisabled = !!val; return this; };
	this.isInternalLinksDisabled = function () { return !!this._isInternalLinksDisabled; };

	this.setPartPageExpandCollapseDisabled = function (val) { this._isPartPageExpandCollapseDisabled = !!val; return this; };

	/** Bind function which apply exta CSS classes to entry/list renders.  */
	this.setFnGetStyleClasses = function (identifier, fn) {
		if (fn == null) {
			delete this._fnsGetStyleClasses[identifier];
			return this;
		}

		this._fnsGetStyleClasses[identifier] = fn;
		return this;
	};

	/**
	 * If enabled, titles with the same name will be given numerical identifiers.
	 * This identifier is stored in `data-title-relative-index`
	 */
	this.setEnumerateTitlesRel = function (bool) {
		this._enumerateTitlesRel.enabled = bool;
		return this;
	};

	this._getEnumeratedTitleRel = function (name) {
		if (this._enumerateTitlesRel.enabled && name) {
			const clean = name.toLowerCase();
			this._enumerateTitlesRel.titles[clean] = this._enumerateTitlesRel.titles[clean] || 0;
			return `data-title-relative-index="${this._enumerateTitlesRel.titles[clean]++}"`;
		} else return "";
	};

	this.setTrackTitles = function (bool) {
		this._trackTitles.enabled = bool;
		return this;
	};

	this.getTrackedTitles = function () {
		return MiscUtil.copyFast(this._trackTitles.titles);
	};

	this.getTrackedTitlesInverted = function ({isStripTags = false} = {}) {
		// `this._trackTitles.titles` is a map of `{[data-title-index]: "<name>"}`
		// Invert it such that we have a map of `{"<name>": ["data-title-index-0", ..., "data-title-index-n"]}`
		const trackedTitlesInverse = {};
		Object.entries(this._trackTitles.titles || {}).forEach(([titleIx, titleName]) => {
			if (isStripTags) titleName = Renderer.stripTags(titleName);
			titleName = titleName.toLowerCase().trim();
			(trackedTitlesInverse[titleName] = trackedTitlesInverse[titleName] || []).push(titleIx);
		});
		return trackedTitlesInverse;
	};

	this._handleTrackTitles = function (name, {isTable = false, isImage = false} = {}) {
		if (!this._trackTitles.enabled) return;
		if (isTable && !this._isHeaderIndexIncludeTableCaptions) return;
		if (isImage && !this._isHeaderIndexIncludeImageTitles) return;
		this._trackTitles.titles[this._headerIndex] = name;
	};

	this._handleTrackDepth = function (entry, depth) {
		if (!entry.name || !this._depthTracker) return;

		this._lastDepthTrackerInheritedProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		if (entry.source) this._lastDepthTrackerInheritedProps.source = entry.source;
		if (this._depthTrackerAdditionalPropsInherited?.length) {
			this._depthTrackerAdditionalPropsInherited.forEach(prop => this._lastDepthTrackerInheritedProps[prop] = entry[prop] || this._lastDepthTrackerInheritedProps[prop]);
		}

		const additionalData = this._depthTrackerAdditionalProps.length
			? this._depthTrackerAdditionalProps.mergeMap(it => ({[it]: entry[it]}))
			: {};

		this._depthTracker.push({
			...this._lastDepthTrackerInheritedProps,
			...additionalData,
			depth,
			name: entry.name,
			type: entry.type,
			ixHeader: this._headerIndex,
			source: this._lastDepthTrackerInheritedProps.source,
			data: entry.data,
			page: entry.page,
			alias: entry.alias,
			entry,
		});
	};

	// region Plugins
	this.addPlugin = function (pluginType, fnPlugin) {
		MiscUtil.getOrSet(this._plugins, pluginType, []).push(fnPlugin);
	};

	this.removePlugin = function (pluginType, fnPlugin) {
		if (!fnPlugin) return;
		const ix = (MiscUtil.get(this._plugins, pluginType) || []).indexOf(fnPlugin);
		if (~ix) this._plugins[pluginType].splice(ix, 1);
	};

	this.removePlugins = function (pluginType) {
		MiscUtil.delete(this._plugins, pluginType);
	};

	this._getPlugins = function (pluginType) { return this._plugins[pluginType] || []; };

	/** Run a function with the given plugin active. */
	this.withPlugin = function ({pluginTypes, fnPlugin, fn}) {
		for (const pt of pluginTypes) this.addPlugin(pt, fnPlugin);
		try {
			return fn(this);
		} finally {
			for (const pt of pluginTypes) this.removePlugin(pt, fnPlugin);
		}
	};

	/** Run an async function with the given plugin active. */
	this.pWithPlugin = async function ({pluginTypes, fnPlugin, pFn}) {
		for (const pt of pluginTypes) this.addPlugin(pt, fnPlugin);
		try {
			const out = await pFn(this);
			return out;
		} finally {
			for (const pt of pluginTypes) this.removePlugin(pt, fnPlugin);
		}
	};
	// endregion

	/**
	 * Specify an array where the renderer will record rendered header depths.
	 * Items added to the array are of the form: `{name: "Header Name", depth: 1, type: "entries", source: "PHB"}`
	 * @param arr
	 * @param additionalProps Additional data props which should be tracked per-entry.
	 * @param additionalPropsInherited As per additionalProps, but if a parent entry has the prop, it should be passed
	 * to its children.
	 */
	this.setDepthTracker = function (arr, {additionalProps, additionalPropsInherited} = {}) {
		this._depthTracker = arr;
		this._depthTrackerAdditionalProps = additionalProps || [];
		this._depthTrackerAdditionalPropsInherited = additionalPropsInherited || [];
		return this;
	};

	this.getLineBreak = function () { return "<br>"; };

	/**
	 * Recursively walk down a tree of "entry" JSON items, adding to a stack of strings to be finally rendered to the
	 * page. Note that this function does _not_ actually do the rendering, see the example code above for how to display
	 * the result.
	 *
	 * @param entry An "entry" usually defined in JSON. A schema is available in tests/schema
	 * @param textStack A reference to an array, which will hold all our strings as we recurse
	 * @param [meta] Meta state.
	 * @param [meta.depth] The current recursion depth. Optional; default 0, or -1 for type "section" entries.
	 * @param [options] Render options.
	 * @param [options.prefix] String to prefix rendered lines with.
	 * @param [options.suffix] String to suffix rendered lines with.
	 */
	this.recursiveRender = function (entry, textStack, meta, options) {
		if (entry instanceof Array) {
			entry.forEach(nxt => this.recursiveRender(nxt, textStack, meta, options));
			setTimeout(() => { throw new Error(`Array passed to renderer! The renderer only guarantees support for primitives and basic objects.`); });
			return this;
		}

		// respect the API of the original, but set up for using string concatenations
		if (textStack.length === 0) textStack[0] = "";
		else textStack.reverse();

		// initialise meta
		meta = meta || {};
		meta._typeStack = [];
		meta.depth = meta.depth == null ? 0 : meta.depth;

		this._recursiveRender(entry, textStack, meta, options);
		if (this._fnPostProcess) textStack[0] = this._fnPostProcess(textStack[0]);
		textStack.reverse();

		return this;
	};

	/**
	 * Inner rendering code. Uses string concatenation instead of an array stack, for ~2x the speed.
	 * @param entry As above.
	 * @param textStack As above.
	 * @param meta As above, with the addition of...
	 * @param options
	 *          .prefix The (optional) prefix to be added to the textStack before whatever is added by the current call
	 *          .suffix The (optional) suffix to be added to the textStack after whatever is added by the current call
	 * @private
	 */
	this._recursiveRender = function (entry, textStack, meta, options) {
		if (entry == null) return; // Avoid dying on nully entries
		if (!textStack) throw new Error("Missing stack!");
		if (!meta) throw new Error("Missing metadata!");
		if (entry.type === "section") meta.depth = -1;

		options = options || {};

		meta._didRenderPrefix = false;
		meta._didRenderSuffix = false;

		if (typeof entry === "object") {
			// the root entry (e.g. "Rage" in barbarian "classFeatures") is assumed to be of type "entries"
			const type = entry.type == null || entry.type === "section" ? "entries" : entry.type;

			// For wrapped entries, simply recurse
			if (type === "wrapper") return this._recursiveRender(entry.wrapped, textStack, meta, options);

			meta._typeStack.push(type);

			switch (type) {
				// recursive
				case "entries": this._renderEntries(entry, textStack, meta, options); break;
				case "options": this._renderOptions(entry, textStack, meta, options); break;
				case "list": this._renderList(entry, textStack, meta, options); break;
				case "table": this._renderTable(entry, textStack, meta, options); break;
				case "tableGroup": this._renderTableGroup(entry, textStack, meta, options); break;
				case "inset": this._renderInset(entry, textStack, meta, options); break;
				case "insetReadaloud": this._renderInsetReadaloud(entry, textStack, meta, options); break;
				case "variant": this._renderVariant(entry, textStack, meta, options); break;
				case "variantInner": this._renderVariantInner(entry, textStack, meta, options); break;
				case "variantSub": this._renderVariantSub(entry, textStack, meta, options); break;
				case "spellcasting": this._renderSpellcasting(entry, textStack, meta, options); break;
				case "quote": this._renderQuote(entry, textStack, meta, options); break;
				case "optfeature": this._renderOptfeature(entry, textStack, meta, options); break;
				case "patron": this._renderPatron(entry, textStack, meta, options); break;

				// block
				case "abilityDc": this._renderAbilityDc(entry, textStack, meta, options); break;
				case "abilityAttackMod": this._renderAbilityAttackMod(entry, textStack, meta, options); break;
				case "abilityGeneric": this._renderAbilityGeneric(entry, textStack, meta, options); break;

				// inline
				case "inline": this._renderInline(entry, textStack, meta, options); break;
				case "inlineBlock": this._renderInlineBlock(entry, textStack, meta, options); break;
				case "bonus": this._renderBonus(entry, textStack, meta, options); break;
				case "bonusSpeed": this._renderBonusSpeed(entry, textStack, meta, options); break;
				case "dice": this._renderDice(entry, textStack, meta, options); break;
				case "link": this._renderLink(entry, textStack, meta, options); break;
				case "actions": this._renderActions(entry, textStack, meta, options); break;
				case "attack": this._renderAttack(entry, textStack, meta, options); break;
				case "ingredient": this._renderIngredient(entry, textStack, meta, options); break;

				// list items
				case "item": this._renderItem(entry, textStack, meta, options); break;
				case "itemSub": this._renderItemSub(entry, textStack, meta, options); break;
				case "itemSpell": this._renderItemSpell(entry, textStack, meta, options); break;

				// embedded entities
				case "statblockInline": this._renderStatblockInline(entry, textStack, meta, options); break;
				case "statblock": this._renderStatblock(entry, textStack, meta, options); break;

				// images
				case "image": this._renderImage(entry, textStack, meta, options); break;
				case "gallery": this._renderGallery(entry, textStack, meta, options); break;

				// flowchart
				case "flowchart": this._renderFlowchart(entry, textStack, meta, options); break;
				case "flowBlock": this._renderFlowBlock(entry, textStack, meta, options); break;

				// homebrew changes
				case "homebrew": this._renderHomebrew(entry, textStack, meta, options); break;

				// misc
				case "code": this._renderCode(entry, textStack, meta, options); break;
				case "hr": this._renderHr(entry, textStack, meta, options); break;
			}

			meta._typeStack.pop();
		} else if (typeof entry === "string") { // block
			this._renderPrefix(entry, textStack, meta, options);
			this._renderString(entry, textStack, meta, options);
			this._renderSuffix(entry, textStack, meta, options);
		} else { // block
			// for ints or any other types which do not require specific rendering
			this._renderPrefix(entry, textStack, meta, options);
			this._renderPrimitive(entry, textStack, meta, options);
			this._renderSuffix(entry, textStack, meta, options);
		}
	};

	this._adjustDepth = function (meta, dDepth) {
		const cachedDepth = meta.depth;
		meta.depth += dDepth;
		meta.depth = Math.min(Math.max(-1, meta.depth), 2); // cap depth between -1 and 2 for general use
		return cachedDepth;
	};

	this._renderPrefix = function (entry, textStack, meta, options) {
		if (meta._didRenderPrefix) return;
		if (options.prefix != null) {
			textStack[0] += options.prefix;
			meta._didRenderPrefix = true;
		}
	};

	this._renderSuffix = function (entry, textStack, meta, options) {
		if (meta._didRenderSuffix) return;
		if (options.suffix != null) {
			textStack[0] += options.suffix;
			meta._didRenderSuffix = true;
		}
	};

	this._renderImage = function (entry, textStack, meta, options) {
		if (entry.title) this._handleTrackTitles(entry.title, {isImage: true});

		if (entry.imageType === "map" || entry.imageType === "mapPlayer") textStack[0] += `<div class="rd__wrp-map">`;
		textStack[0] += `<div class="float-clear"></div>`;
		textStack[0] += `<div class="${meta._typeStack.includes("gallery") ? "rd__wrp-gallery-image" : ""}">`;

		const href = this._renderImage_getUrl(entry);
		const svg = this._lazyImages && entry.width != null && entry.height != null
			? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}"><rect width="100%" height="100%" fill="#ccc3"></rect></svg>`)}`
			: null;
		const ptTitleCreditTooltip = this._renderImage_getTitleCreditTooltipText(entry);
		textStack[0] += `<div class="${this._renderImage_getWrapperClasses(entry, meta)}" ${entry.title && this._isHeaderIndexIncludeImageTitles ? `data-title-index="${this._headerIndex++}"` : ""}>
			<a href="${href}" target="_blank" rel="noopener noreferrer" ${ptTitleCreditTooltip ? `title="${ptTitleCreditTooltip}"` : ""}>
				<img class="${this._renderImage_getImageClasses(entry, meta)}" src="${svg || href}" ${entry.altText || entry.title ? `alt="${Renderer.stripTags((entry.altText || entry.title)).qq()}"` : ""} ${svg ? `data-src="${href}"` : `loading="lazy"`} ${this._renderImage_getStylePart(entry)}>
			</a>
		</div>`;

		if (entry.title || entry.credit || entry.mapRegions) {
			const ptAdventureBookMeta = entry.mapRegions && meta.adventureBookPage && meta.adventureBookSource && meta.adventureBookHash
				? `data-rd-adventure-book-map-page="${meta.adventureBookPage.qq()}" data-rd-adventure-book-map-source="${meta.adventureBookSource.qq()}" data-rd-adventure-book-map-hash="${meta.adventureBookHash.qq()}"`
				: "";

			textStack[0] += `<div class="rd__image-title">`;

			if (entry.title && !entry.mapRegions) textStack[0] += `<div class="rd__image-title-inner">${this.render(entry.title)}</div>`;

			if (entry.mapRegions && !IS_VTT) {
				textStack[0] += `<button class="btn btn-xs btn-default rd__image-btn-viewer" onclick="RenderMap.pShowViewer(event, this)" data-rd-packed-map="${this._renderImage_getMapRegionData(entry)}" ${ptAdventureBookMeta} title="Open Dynamic Viewer (SHIFT to Open in New Window)"><span class="glyphicon glyphicon-picture"></span> ${Renderer.stripTags(entry.title) || "Dynamic Viewer"}</button>`;
			}

			if (entry.credit) textStack[0] += `<div class="rd__image-credit ve-muted"><span class="glyphicon glyphicon-pencil" title="Art Credit"></span> ${this.render(entry.credit)}</div>`;

			textStack[0] += `</div>`;
		}

		if (entry._galleryTitlePad) textStack[0] += `<div class="rd__image-title">&nbsp;</div>`;
		if (entry._galleryCreditPad) textStack[0] += `<div class="rd__image-credit">&nbsp;</div>`;

		textStack[0] += `</div>`;
		if (entry.imageType === "map" || entry.imageType === "mapPlayer") textStack[0] += `</div>`;
	};

	this._renderImage_getTitleCreditTooltipText = function (entry) {
		if (!entry.title && !entry.credit) return null;
		return Renderer.stripTags(
			[entry.title, entry.credit ? `Art credit: ${entry.credit}` : null]
				.filter(Boolean)
				.join(". "),
		).qq();
	};

	this._renderImage_getStylePart = function (entry) {
		const styles = [
			// N.b. this width/height should be reflected in the renderer image CSS
			// Clamp the max width at 100%, as per the renderer styling
			entry.maxWidth ? `max-width: min(100%, ${entry.maxWidth}${entry.maxWidthUnits || "px"})` : "",
			// Clamp the max height at 60vh, as per the renderer styling
			entry.maxHeight ? `max-height: min(60vh, ${entry.maxHeight}${entry.maxHeightUnits || "px"})` : "",
		].filter(Boolean).join("; ");
		return styles ? `style="${styles}"` : "";
	};

	this._renderImage_getMapRegionData = function (entry) {
		return JSON.stringify(this.getMapRegionData(entry)).escapeQuotes();
	};

	this.getMapRegionData = function (entry) {
		return {
			regions: entry.mapRegions,
			width: entry.width,
			height: entry.height,
			href: this._renderImage_getUrl(entry),
			hrefThumbnail: this._renderImage_getUrlThumbnail(entry),
			page: entry.page,
			source: entry.source,
			hash: entry.hash,
		};
	};

	this._renderImage_getWrapperClasses = function (entry) {
		const out = ["rd__wrp-image", "relative"];
		if (entry.style) {
			switch (entry.style) {
				case "comic-speaker-left": out.push("rd__comic-img-speaker", "rd__comic-img-speaker--left"); break;
				case "comic-speaker-right": out.push("rd__comic-img-speaker", "rd__comic-img-speaker--right"); break;
			}
		}
		return out.join(" ");
	};

	this._renderImage_getImageClasses = function (entry) {
		const out = ["rd__image"];
		if (entry.style) {
			switch (entry.style) {
				case "deity-symbol": out.push("rd__img-small"); break;
			}
		}
		return out.join(" ");
	};

	this._renderImage_getUrl = function (entry) {
		let url = Renderer.utils.getMediaUrl(entry, "href", "img");
		for (const plugin of this._getPlugins(`image_urlPostProcess`)) {
			url = plugin(entry, url) || plugin(entry, url);
		}
		return url;
	};

	this._renderImage_getUrlThumbnail = function (entry) {
		let url = Renderer.utils.getMediaUrl(entry, "hrefThumbnail", "img");
		for (const plugin of this._getPlugins(`image_urlThumbnailPostProcess`)) {
			url = plugin(entry, url) || plugin(entry, url);
		}
		return url;
	};

	this._renderList_getListCssClasses = function (entry, textStack, meta, options) {
		const out = [`rd__list`];
		if (entry.style || entry.columns) {
			if (entry.style) out.push(...entry.style.split(" ").map(it => `rd__${it}`));
			if (entry.columns) out.push(`columns-${entry.columns}`);
		}
		return out.join(" ");
	};

	this._renderTableGroup = function (entry, textStack, meta, options) {
		const len = entry.tables.length;
		for (let i = 0; i < len; ++i) this._recursiveRender(entry.tables[i], textStack, meta);
	};

	this._renderTable = function (entry, textStack, meta, options) {
		// TODO add handling for rowLabel property
		if (entry.intro) {
			const len = entry.intro.length;
			for (let i = 0; i < len; ++i) {
				this._recursiveRender(entry.intro[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
			}
		}

		textStack[0] += `<table class="w-100 rd__table ${entry.style || ""} ${entry.isStriped === false ? "" : "stripe-odd-table"}">`;

		const headerRowMetas = Renderer.table.getHeaderRowMetas(entry);
		const autoRollMode = Renderer.table.getAutoConvertedRollMode(entry, {headerRowMetas});
		const toRenderLabel = autoRollMode ? RollerUtil.getFullRollCol(entry.colLabels[0]) : null;
		const isInfiniteResults = autoRollMode === RollerUtil.ROLL_COL_VARIABLE;

		// caption
		if (entry.caption != null) {
			this._handleTrackTitles(entry.caption, {isTable: true});
			textStack[0] += `<caption ${this._isHeaderIndexIncludeTableCaptions ? `data-title-index="${this._headerIndex++}"` : ""}>${entry.caption}</caption>`;
		}

		// body -- temporarily build this to own string; append after headers
		const rollCols = [];
		let bodyStack = [""];
		bodyStack[0] += "<tbody>";
		const lenRows = entry.rows.length;
		for (let ixRow = 0; ixRow < lenRows; ++ixRow) {
			bodyStack[0] += "<tr>";
			const r = entry.rows[ixRow];
			let roRender = r.type === "row" ? r.row : r;

			const len = roRender.length;
			for (let ixCell = 0; ixCell < len; ++ixCell) {
				rollCols[ixCell] = rollCols[ixCell] || false;

				// pre-convert rollables
				if (autoRollMode && ixCell === 0) {
					roRender = Renderer.getRollableRow(
						roRender,
						{
							isForceInfiniteResults: isInfiniteResults,
							isFirstRow: ixRow === 0,
							isLastRow: ixRow === lenRows - 1,
						},
					);
					rollCols[ixCell] = true;
				}

				let toRenderCell;
				if (roRender[ixCell].type === "cell") {
					if (roRender[ixCell].roll) {
						rollCols[ixCell] = true;
						if (roRender[ixCell].entry) {
							toRenderCell = roRender[ixCell].entry;
						} else if (roRender[ixCell].roll.exact != null) {
							toRenderCell = roRender[ixCell].roll.pad ? StrUtil.padNumber(roRender[ixCell].roll.exact, 2, "0") : roRender[ixCell].roll.exact;
						} else {
							// TODO(Future) render "negative infinite" minimum nicely (or based on an example from a book, if one ever occurs)
							//   "Selling a Magic Item" from DMG p129 almost meets this, but it has its own display

							const dispMin = roRender[ixCell].roll.displayMin != null ? roRender[ixCell].roll.displayMin : roRender[ixCell].roll.min;
							const dispMax = roRender[ixCell].roll.displayMax != null ? roRender[ixCell].roll.displayMax : roRender[ixCell].roll.max;

							if (dispMax === Renderer.dice.POS_INFINITE) {
								toRenderCell = roRender[ixCell].roll.pad
									? `${StrUtil.padNumber(dispMin, 2, "0")}+`
									: `${dispMin}+`;
							} else {
								toRenderCell = roRender[ixCell].roll.pad
									? `${StrUtil.padNumber(dispMin, 2, "0")}-${StrUtil.padNumber(dispMax, 2, "0")}`
									: `${dispMin}-${dispMax}`;
							}
						}
					} else if (roRender[ixCell].entry) {
						toRenderCell = roRender[ixCell].entry;
					}
				} else {
					toRenderCell = roRender[ixCell];
				}
				bodyStack[0] += `<td ${this._renderTable_makeTableTdClassText(entry, ixCell)} ${this._renderTable_getCellDataStr(roRender[ixCell])} ${roRender[ixCell].type === "cell" && roRender[ixCell].width ? `colspan="${roRender[ixCell].width}"` : ""}>`;
				if (r.style === "row-indent-first" && ixCell === 0) bodyStack[0] += `<div class="rd__tab-indent"></div>`;
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(toRenderCell, bodyStack, meta);
				meta.depth = cacheDepth;
				bodyStack[0] += "</td>";
			}
			bodyStack[0] += "</tr>";
		}
		bodyStack[0] += "</tbody>";

		// header
		if (headerRowMetas) {
			textStack[0] += "<thead>";

			for (let ixRow = 0, lenRows = headerRowMetas.length; ixRow < lenRows; ++ixRow) {
				textStack[0] += "<tr>";

				const headerRowMeta = headerRowMetas[ixRow];
				for (let ixCell = 0, lenCells = headerRowMeta.length; ixCell < lenCells; ++ixCell) {
					const lbl = headerRowMeta[ixCell];
					textStack[0] += `<th ${this._renderTable_getTableThClassText(entry, ixCell)} data-rd-isroller="${rollCols[ixCell]}" ${entry.isNameGenerator ? `data-rd-namegeneratorrolls="${headerRowMeta.length - 1}"` : ""}>`;
					this._recursiveRender(autoRollMode && ixCell === 0 ? RollerUtil.getFullRollCol(lbl) : lbl, textStack, meta);
					textStack[0] += `</th>`;
				}

				textStack[0] += "</tr>";
			}

			textStack[0] += "</thead>";
		}

		textStack[0] += bodyStack[0];

		// footer
		if (entry.footnotes != null) {
			textStack[0] += "<tfoot>";
			const len = entry.footnotes.length;
			for (let i = 0; i < len; ++i) {
				textStack[0] += `<tr><td colspan="99">`;
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(entry.footnotes[i], textStack, meta);
				meta.depth = cacheDepth;
				textStack[0] += "</td></tr>";
			}
			textStack[0] += "</tfoot>";
		}
		textStack[0] += "</table>";

		if (entry.outro) {
			const len = entry.outro.length;
			for (let i = 0; i < len; ++i) {
				this._recursiveRender(entry.outro[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
			}
		}
	};

	this._renderTable_getCellDataStr = function (ent) {
		function convertZeros (num) {
			if (num === 0) return 100;
			return num;
		}

		if (ent.roll) {
			return `data-roll-min="${convertZeros(ent.roll.exact != null ? ent.roll.exact : ent.roll.min)}" data-roll-max="${convertZeros(ent.roll.exact != null ? ent.roll.exact : ent.roll.max)}"`;
		}

		return "";
	};

	this._renderTable_getTableThClassText = function (entry, i) {
		return entry.colStyles == null || i >= entry.colStyles.length ? "" : `class="${entry.colStyles[i]}"`;
	};

	this._renderTable_makeTableTdClassText = function (entry, i) {
		if (entry.rowStyles != null) return i >= entry.rowStyles.length ? "" : `class="${entry.rowStyles[i]}"`;
		else return this._renderTable_getTableThClassText(entry, i);
	};

	this._renderEntries = function (entry, textStack, meta, options) {
		this._renderEntriesSubtypes(entry, textStack, meta, options, true);
	};

	this._getPagePart = function (entry, isInset) {
		if (!Renderer.utils.isDisplayPage(entry.page)) return "";
		return ` <span class="rd__title-link ${isInset ? `rd__title-link--inset` : ""}">${entry.source ? `<span class="help-subtle" title="${Parser.sourceJsonToFull(entry.source)}">${Parser.sourceJsonToAbv(entry.source)}</span> ` : ""}p${entry.page}</span>`;
	};

	this._renderEntriesSubtypes = function (entry, textStack, meta, options, incDepth) {
		const type = entry.type || "entries";
		const isInlineTitle = meta.depth >= 2;
		const isAddPeriod = isInlineTitle && entry.name && !Renderer._INLINE_HEADER_TERMINATORS.has(entry.name[entry.name.length - 1]);
		const pagePart = !this._isPartPageExpandCollapseDisabled && !isInlineTitle
			? this._getPagePart(entry)
			: "";
		const partExpandCollapse = !this._isPartPageExpandCollapseDisabled && !isInlineTitle
			? `<span class="rd__h-toggle ml-2 clickable" data-rd-h-toggle-button="true">[\u2013]</span>`
			: "";
		const partPageExpandCollapse = !this._isPartPageExpandCollapseDisabled && (pagePart || partExpandCollapse)
			? `<span class="ve-flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`
			: "";
		const nextDepth = incDepth && meta.depth < 2 ? meta.depth + 1 : meta.depth;
		const styleString = this._renderEntriesSubtypes_getStyleString(entry, meta, isInlineTitle);
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		if (entry.name != null && Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);

		const headerTag = isInlineTitle ? "span" : `h${Math.min(Math.max(meta.depth + 2, 1), 6)}`;
		const headerClass = `rd__h--${meta.depth + 1}`; // adjust as the CSS is 0..4 rather than -1..3

		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, meta.depth);

		const pluginDataNamePrefix = this._getPlugins(`${type}_namePrefix`).map(plugin => plugin(entry, textStack, meta, options)).filter(Boolean);

		const headerSpan = entry.name ? `<${headerTag} class="rd__h ${headerClass}" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}> <span class="entry-title-inner${!pagePart && entry.source ? ` help-subtle` : ""}"${!pagePart && entry.source ? ` title="Source: ${Parser.sourceJsonToFull(entry.source)}${entry.page ? `, p${entry.page}` : ""}"` : ""}>${pluginDataNamePrefix.join("")}${this.render({type: "inline", entries: [entry.name]})}${isAddPeriod ? "." : ""}</span>${partPageExpandCollapse}</${headerTag}> ` : "";

		if (meta.depth === -1) {
			if (!this._firstSection) textStack[0] += `<hr class="rd__hr rd__hr--section">`;
			this._firstSection = false;
		}

		if (entry.entries || entry.name) {
			textStack[0] += `<${this.wrapperTag} ${dataString} ${styleString}>${headerSpan}`;
			this._renderEntriesSubtypes_renderPreReqText(entry, textStack, meta);
			if (entry.entries) {
				const cacheDepth = meta.depth;
				const len = entry.entries.length;
				for (let i = 0; i < len; ++i) {
					meta.depth = nextDepth;
					this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
					// Add a spacer for style sets that have vertical whitespace instead of indents
					if (i === 0 && cacheDepth >= 2) textStack[0] += `<div class="rd__spc-inline-post"></div>`;
				}
				meta.depth = cacheDepth;
			}
			textStack[0] += `</${this.wrapperTag}>`;
		}

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderEntriesSubtypes_getDataString = function (entry) {
		let dataString = "";
		if (entry.source) dataString += `data-source="${entry.source}"`;
		if (entry.data) {
			for (const k in entry.data) {
				if (!k.startsWith("rd-")) continue;
				dataString += ` data-${k}="${`${entry.data[k]}`.escapeQuotes()}"`;
			}
		}
		return dataString;
	};

	this._renderEntriesSubtypes_renderPreReqText = function (entry, textStack, meta) {
		if (entry.prerequisite) {
			textStack[0] += `<span class="rd__prerequisite">Prerequisite: `;
			this._recursiveRender({type: "inline", entries: [entry.prerequisite]}, textStack, meta);
			textStack[0] += `</span>`;
		}
	};

	this._renderEntriesSubtypes_getStyleString = function (entry, meta, isInlineTitle) {
		const styleClasses = ["rd__b"];
		styleClasses.push(this._getStyleClass(entry.type || "entries", entry));
		if (isInlineTitle) {
			if (this._subVariant) styleClasses.push(Renderer.HEAD_2_SUB_VARIANT);
			else styleClasses.push(Renderer.HEAD_2);
		} else styleClasses.push(meta.depth === -1 ? Renderer.HEAD_NEG_1 : meta.depth === 0 ? Renderer.HEAD_0 : Renderer.HEAD_1);
		return styleClasses.length > 0 ? `class="${styleClasses.join(" ")}"` : "";
	};

	this._renderOptions = function (entry, textStack, meta, options) {
		if (!entry.entries) return;
		entry.entries = entry.entries.sort((a, b) => a.name && b.name ? SortUtil.ascSort(a.name, b.name) : a.name ? -1 : b.name ? 1 : 0);

		if (entry.style && entry.style === "list-hang-notitle") {
			const fauxEntry = {
				type: "list",
				style: "list-hang-notitle",
				items: entry.entries.map(ent => {
					if (typeof ent === "string") return ent;
					if (ent.type === "item") return ent;

					const out = {...ent, type: "item"};
					if (ent.name) out.name = Renderer._INLINE_HEADER_TERMINATORS.has(ent.name[ent.name.length - 1]) ? out.name : `${out.name}.`;
					return out;
				}),
			};
			this._renderList(fauxEntry, textStack, meta, options);
		} else this._renderEntriesSubtypes(entry, textStack, meta, options, false);
	};

	this._renderList = function (entry, textStack, meta, options) {
		if (entry.items) {
			const tag = entry.start ? "ol" : "ul";
			const cssClasses = this._renderList_getListCssClasses(entry, textStack, meta, options);
			textStack[0] += `<${tag} ${cssClasses ? `class="${cssClasses}"` : ""} ${entry.start ? `start="${entry.start}"` : ""}>`;
			if (entry.name) textStack[0] += `<li class="rd__list-name">${entry.name}</li>`;
			const isListHang = entry.style && entry.style.split(" ").includes("list-hang");
			const len = entry.items.length;
			for (let i = 0; i < len; ++i) {
				const item = entry.items[i];
				// Special case for child lists -- avoid wrapping in LI tags to avoid double-bullet
				if (item.type !== "list") {
					const className = `${this._getStyleClass(entry.type, item)}${item.type === "itemSpell" ? " rd__li-spell" : ""}`;
					textStack[0] += `<li class="rd__li ${className}">`;
				}
				// If it's a raw string in a hanging list, wrap it in a div to allow for the correct styling
				if (isListHang && typeof item === "string") textStack[0] += "<div>";
				this._recursiveRender(item, textStack, meta);
				if (isListHang && typeof item === "string") textStack[0] += "</div>";
				if (item.type !== "list") textStack[0] += "</li>";
			}
			textStack[0] += `</${tag}>`;
		}
	};

	this._renderInset = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-inset ${entry.style || ""}" ${dataString}>`;

		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="ve-flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><h4 class="entry-title-inner">${entry.name}</h4>${partPageExpandCollapse}</span>`;
		} else {
			textStack[0] += `<span class="rd__h rd__h--2-inset rd__h--2-inset-no-name">${partPageExpandCollapse}</span>`;
		}

		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `<div class="float-clear"></div>`;
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderInsetReadaloud = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-inset rd__b-inset--readaloud ${entry.style || ""}" ${dataString}>`;

		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="ve-flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><h4 class="entry-title-inner">${entry.name}</h4>${this._getPagePart(entry, true)}</span>`;
		} else {
			textStack[0] += `<span class="rd__h rd__h--2-inset rd__h--2-inset-no-name">${partPageExpandCollapse}</span>`;
		}

		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			const cacheDepth = meta.depth;
			meta.depth = 2;
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
			meta.depth = cacheDepth;
		}
		textStack[0] += `<div class="float-clear"></div>`;
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderVariant = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);

		if (entry.name != null && Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="ve-flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-inset" ${dataString}>`;
		textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><h4 class="entry-title-inner">Variant: ${entry.name}</h4>${partPageExpandCollapse}</span>`;
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			const cacheDepth = meta.depth;
			meta.depth = 2;
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
			meta.depth = cacheDepth;
		}
		if (entry.source) textStack[0] += Renderer.utils.getSourceAndPageTrHtml({source: entry.source, page: entry.page});
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderVariantInner = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);

		if (entry.name != null && Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		textStack[0] += `<${this.wrapperTag} class="rd__b-inset-inner" ${dataString}>`;
		textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><h4 class="entry-title-inner">${entry.name}</h4></span>`;
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			const cacheDepth = meta.depth;
			meta.depth = 2;
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
			meta.depth = cacheDepth;
		}
		if (entry.source) textStack[0] += Renderer.utils.getSourceAndPageTrHtml({source: entry.source, page: entry.page});
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderVariantSub = function (entry, textStack, meta, options) {
		// pretend this is an inline-header'd entry, but set a flag so we know not to add bold
		this._subVariant = true;
		const fauxEntry = entry;
		fauxEntry.type = "entries";
		const cacheDepth = meta.depth;
		meta.depth = 3;
		this._recursiveRender(fauxEntry, textStack, meta, {prefix: "<p>", suffix: "</p>"});
		meta.depth = cacheDepth;
		this._subVariant = false;
	};

	this._renderSpellcasting_getEntries = function (entry) {
		const hidden = new Set(entry.hidden || []);
		const toRender = [{type: "entries", name: entry.name, entries: entry.headerEntries ? MiscUtil.copyFast(entry.headerEntries) : []}];

		if (entry.constant || entry.will || entry.rest || entry.daily || entry.weekly || entry.yearly || entry.ritual) {
			const tempList = {type: "list", style: "list-hang-notitle", items: [], data: {isSpellList: true}};
			if (entry.constant && !hidden.has("constant")) tempList.items.push({type: "itemSpell", name: `Constant:`, entry: this._renderSpellcasting_getRenderableList(entry.constant).join(", ")});
			if (entry.will && !hidden.has("will")) tempList.items.push({type: "itemSpell", name: `At will:`, entry: this._renderSpellcasting_getRenderableList(entry.will).join(", ")});

			this._renderSpellcasting_getEntries_procPerDuration({entry, tempList, hidden, prop: "charges", fnGetDurationText: num => ` charge${num === 1 ? "" : "s"}`});
			this._renderSpellcasting_getEntries_procPerDuration({entry, tempList, hidden, prop: "rest", durationText: "/rest"});
			this._renderSpellcasting_getEntries_procPerDuration({entry, tempList, hidden, prop: "daily", durationText: "/day"});
			this._renderSpellcasting_getEntries_procPerDuration({entry, tempList, hidden, prop: "weekly", durationText: "/week"});
			this._renderSpellcasting_getEntries_procPerDuration({entry, tempList, hidden, prop: "yearly", durationText: "/year"});

			if (entry.ritual && !hidden.has("ritual")) tempList.items.push({type: "itemSpell", name: `Rituals:`, entry: this._renderSpellcasting_getRenderableList(entry.ritual).join(", ")});
			tempList.items = tempList.items.filter(it => it.entry !== "");
			if (tempList.items.length) toRender[0].entries.push(tempList);
		}

		if (entry.spells && !hidden.has("spells")) {
			const tempList = {type: "list", style: "list-hang-notitle", items: [], data: {isSpellList: true}};
			for (let lvl = 0; lvl < 10; ++lvl) {
				const spells = entry.spells[lvl];
				if (spells) {
					let levelCantrip = `${Parser.spLevelToFull(lvl)}${(lvl === 0 ? "s" : " level")}`;
					let slotsAtWill = ` (at will)`;
					const slots = spells.slots;
					if (slots >= 0) slotsAtWill = slots > 0 ? ` (${slots} slot${slots > 1 ? "s" : ""})` : ``;
					if (spells.lower && spells.lower !== lvl) {
						levelCantrip = `${Parser.spLevelToFull(spells.lower)}-${levelCantrip}`;
						if (slots >= 0) slotsAtWill = slots > 0 ? ` (${slots} ${Parser.spLevelToFull(lvl)}-level slot${slots > 1 ? "s" : ""})` : ``;
					}
					tempList.items.push({type: "itemSpell", name: `${levelCantrip}${slotsAtWill}:`, entry: this._renderSpellcasting_getRenderableList(spells.spells).join(", ") || "\u2014"});
				}
			}
			toRender[0].entries.push(tempList);
		}

		if (entry.footerEntries) toRender.push({type: "entries", entries: entry.footerEntries});
		return toRender;
	};

	this._renderSpellcasting_getEntries_procPerDuration = function ({entry, hidden, tempList, prop, durationText, fnGetDurationText}) {
		if (!entry[prop] || hidden.has(prop)) return;

		for (let lvl = 9; lvl > 0; lvl--) {
			const perDur = entry[prop];
			if (perDur[lvl]) tempList.items.push({type: "itemSpell", name: `${lvl}${fnGetDurationText ? fnGetDurationText(lvl) : durationText}:`, entry: this._renderSpellcasting_getRenderableList(perDur[lvl]).join(", ")});
			const lvlEach = `${lvl}e`;
			if (perDur[lvlEach]) {
				const isHideEach = !perDur[lvl] && perDur[lvlEach].length === 1;
				tempList.items.push({type: "itemSpell", name: `${lvl}${fnGetDurationText ? fnGetDurationText(lvl) : durationText}${isHideEach ? "" : ` each`}:`, entry: this._renderSpellcasting_getRenderableList(perDur[lvlEach]).join(", ")});
			}
		}
	};

	this._renderSpellcasting_getRenderableList = function (spellList) {
		return spellList.filter(it => !it.hidden).map(it => it.entry || it);
	};

	this._renderSpellcasting = function (entry, textStack, meta, options) {
		const toRender = this._renderSpellcasting_getEntries(entry);
		this._recursiveRender({type: "entries", entries: toRender}, textStack, meta);
	};

	this._renderQuote = function (entry, textStack, meta, options) {
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			textStack[0] += `<p class="rd__quote-line ${i === len - 1 && entry.by ? `rd__quote-line--last` : ""}">${i === 0 && !entry.skipMarks ? "&ldquo;" : ""}`;
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: entry.skipItalics ? "" : "<i>", suffix: entry.skipItalics ? "" : "</i>"});
			textStack[0] += `${i === len - 1 && !entry.skipMarks ? "&rdquo;" : ""}</p>`;
		}

		if (entry.by || entry.from) {
			textStack[0] += `<p>`;
			const tempStack = [""];
			const byArr = this._renderQuote_getBy(entry);
			if (byArr) {
				for (let i = 0, len = byArr.length; i < len; ++i) {
					const by = byArr[i];
					this._recursiveRender(by, tempStack, meta);
					if (i < len - 1) tempStack[0] += "<br>";
				}
			}
			textStack[0] += `<span class="rd__quote-by">\u2014 ${byArr ? tempStack.join("") : ""}${byArr && entry.from ? `, ` : ""}${entry.from ? `<i>${entry.from}</i>` : ""}</span>`;
			textStack[0] += `</p>`;
		}
	};

	this._renderQuote_getBy = function (entry) {
		if (!entry.by?.length) return null;
		return entry.by instanceof Array ? entry.by : [entry.by];
	};

	this._renderOptfeature = function (entry, textStack, meta, options) {
		this._renderEntriesSubtypes(entry, textStack, meta, options, true);
	};

	this._renderPatron = function (entry, textStack, meta, options) {
		this._renderEntriesSubtypes(entry, textStack, meta, options, false);
	};

	this._renderAbilityDc = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<div class="text-center"><b>`;
		this._recursiveRender(entry.name, textStack, meta);
		textStack[0] += ` save DC</b> = 8 + your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}</div>`;
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderAbilityAttackMod = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<div class="text-center"><b>`;
		this._recursiveRender(entry.name, textStack, meta);
		textStack[0] += ` attack modifier</b> = your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}</div>`;
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderAbilityGeneric = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<div class="text-center">`;
		if (entry.name) this._recursiveRender(entry.name, textStack, meta, {prefix: "<b>", suffix: "</b> = "});
		textStack[0] += `${entry.text}${entry.attributes ? ` ${Parser.attrChooseToFull(entry.attributes)}` : ""}</div>`;
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderInline = function (entry, textStack, meta, options) {
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta);
		}
	};

	this._renderInlineBlock = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta);
		}
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderBonus = function (entry, textStack, meta, options) {
		textStack[0] += (entry.value < 0 ? "" : "+") + entry.value;
	};

	this._renderBonusSpeed = function (entry, textStack, meta, options) {
		textStack[0] += entry.value === 0 ? "\u2014" : `${entry.value < 0 ? "" : "+"}${entry.value} ft.`;
	};

	this._renderDice = function (entry, textStack, meta, options) {
		const pluginResults = this._getPlugins("dice").map(plugin => plugin(entry, textStack, meta, options)).filter(Boolean);

		textStack[0] += Renderer.getEntryDice(entry, entry.name, {isAddHandlers: this._isAddHandlers, pluginResults});
	};

	this._renderActions = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);

		if (entry.name != null && Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 2);

		textStack[0] += `<${this.wrapperTag} class="${Renderer.HEAD_2}" ${dataString}><span class="rd__h rd__h--3" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">${entry.name}.</span></span> `;
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderAttack = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<i>${Parser.attackTypeToFull(entry.attackType)}:</i> `;
		const len = entry.attackEntries.length;
		for (let i = 0; i < len; ++i) this._recursiveRender(entry.attackEntries[i], textStack, meta);
		textStack[0] += ` <i>Hit:</i> `;
		const len2 = entry.hitEntries.length;
		for (let i = 0; i < len2; ++i) this._recursiveRender(entry.hitEntries[i], textStack, meta);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderIngredient = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderItem = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		const isAddPeriod = entry.name && entry.nameDot !== false && !Renderer._INLINE_HEADER_TERMINATORS.has(entry.name[entry.name.length - 1]);
		textStack[0] += `<p class="rd__p-list-item"><span class="${entry.style || "bold"} rd__list-item-name">${this.render(entry.name)}${isAddPeriod ? "." : ""}</span> `;
		if (entry.entry) this._recursiveRender(entry.entry, textStack, meta);
		else if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta, {prefix: i > 0 ? `<span class="rd__p-cont-indent">` : "", suffix: i > 0 ? "</span>" : ""});
		}
		textStack[0] += "</p>";
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderItemSub = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		const isAddPeriod = entry.name && entry.nameDot !== false && !Renderer._INLINE_HEADER_TERMINATORS.has(entry.name[entry.name.length - 1]);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `<p class="rd__p-list-item"><span class="italic rd__list-item-name">${entry.name}${isAddPeriod ? "." : ""}</span> `, suffix: "</p>"});
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderItemSpell = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `<p>${entry.name} `, suffix: "</p>"});
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._InlineStatblockStrategy = function (
		{
			pFnPreProcess,
		},
	) {
		this.pFnPreProcess = pFnPreProcess;
	};

	this._INLINE_STATBLOCK_STRATEGIES = {
		"item": new this._InlineStatblockStrategy({
			pFnPreProcess: async (ent) => {
				await Renderer.item.pPopulatePropertyAndTypeReference();
				Renderer.item.enhanceItem(ent);
				return ent;
			},
		}),
	};

	this._renderStatblockInline = function (entry, textStack, meta, options) {
		const fnGetRenderCompact = Renderer.hover.getFnRenderCompact(entry.dataType);

		const headerName = entry.data?.name;
		const headerStyle = entry.style;

		if (!fnGetRenderCompact) {
			this._renderPrefix(entry, textStack, meta, options);
			this._renderDataHeader(textStack, headerName, headerStyle);
			textStack[0] += `<tr>
				<td colspan="6">
					<i class="text-danger">Cannot render &quot;${entry.type}&quot;&mdash;unknown data type &quot;${entry.dataType}&quot;!</i>
				</td>
			</tr>`;
			this._renderDataFooter(textStack);
			this._renderSuffix(entry, textStack, meta, options);
			return;
		}

		const strategy = this._INLINE_STATBLOCK_STRATEGIES[entry.dataType];

		if (!strategy?.pFnPreProcess) {
			this._renderPrefix(entry, textStack, meta, options);
			this._renderDataHeader(textStack, headerName, headerStyle, {isCollapsed: entry.collapsed});
			textStack[0] += fnGetRenderCompact(entry.data, {isEmbeddedEntity: true});
			this._renderDataFooter(textStack);
			this._renderSuffix(entry, textStack, meta, options);
			return;
		}

		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, headerName, headerStyle, {isCollapsed: entry.collapsed});

		const id = CryptUtil.uid();
		Renderer._cache.inlineStatblock[id] = {
			pFn: async (ele) => {
				const ent = await strategy.pFnPreProcess(entry.data);

				const tbl = ele.closest("table");
				const nxt = e_({
					outer: Renderer.utils.getEmbeddedDataHeader(headerName, headerStyle, {isCollapsed: entry.collapsed})
						+ fnGetRenderCompact(ent, {isEmbeddedEntity: true})
						+ Renderer.utils.getEmbeddedDataFooter(),
				});
				tbl.parentNode.replaceChild(
					nxt,
					tbl,
				);
			},
		};

		textStack[0] += `<tr><td colspan="6"><style data-rd-cache-id="${id}" data-rd-cache="inlineStatblock" onload="Renderer._cache.pRunFromEle(this)"></style></td></tr>`;
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataHeader = function (textStack, name, style, {isCollapsed = false} = {}) {
		textStack[0] += Renderer.utils.getEmbeddedDataHeader(name, style, {isCollapsed});
	};

	this._renderDataFooter = function (textStack) {
		textStack[0] += Renderer.utils.getEmbeddedDataFooter();
	};

	this._renderStatblock = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);

		const page = entry.prop || Renderer.tag.getPage(entry.tag);
		const source = Parser.getTagSource(entry.tag, entry.source);
		const hash = entry.hash || (UrlUtil.URL_TO_HASH_BUILDER[page] ? UrlUtil.URL_TO_HASH_BUILDER[page]({...entry, name: entry.name, source}) : null);

		const asTag = `{@${entry.tag} ${entry.name}|${source}${entry.displayName ? `|${entry.displayName}` : ""}}`;

		if (!page || !source || !hash) {
			this._renderDataHeader(textStack, entry.name, entry.style);
			textStack[0] += `<tr>
				<td colspan="6">
					<i class="text-danger">Cannot load ${entry.tag ? `&quot;${asTag}&quot;` : entry.displayName || entry.name}! An unknown tag/prop, source, or hash was provided.</i>
				</td>
			</tr>`;
			this._renderDataFooter(textStack);
			this._renderSuffix(entry, textStack, meta, options);

			return;
		}

		this._renderDataHeader(textStack, entry.name, entry.style, {isCollapsed: entry.collapsed});
		textStack[0] += `<tr>
			<td colspan="6" data-rd-tag="${(entry.tag || "").qq()}" data-rd-page="${(page || "").qq()}" data-rd-source="${(source || "").qq()}" data-rd-hash="${(hash || "").qq()}" data-rd-name="${(entry.name || "").qq()}" data-rd-display-name="${(entry.displayName || "").qq()}" data-rd-style="${(entry.style || "").qq()}">
				<i>Loading ${entry.tag ? `${Renderer.get().render(asTag)}` : entry.displayName || entry.name}...</i>
				<style onload="Renderer.events.handleLoad_inlineStatblock(this)"></style>
			</td>
		</tr>`;
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderGallery = function (entry, textStack, meta, options) {
		textStack[0] += `<div class="rd__wrp-gallery">`;
		const len = entry.images.length;
		const anyNamed = entry.images.some(it => it.title);
		const isAnyCredited = entry.images.some(it => it.credit);
		for (let i = 0; i < len; ++i) {
			const img = MiscUtil.copyFast(entry.images[i]);

			// force untitled/uncredited images to pad to match their siblings
			if (anyNamed && !img.title) img._galleryTitlePad = true;
			if (isAnyCredited && !img.credit) img._galleryCreditPad = true;

			delete img.imageType;
			this._recursiveRender(img, textStack, meta, options);
		}
		textStack[0] += `</div>`;
	};

	this._renderFlowchart = function (entry, textStack, meta, options) {
		textStack[0] += `<div class="rd__wrp-flowchart">`;
		const len = entry.blocks.length;
		for (let i = 0; i < len; ++i) {
			this._recursiveRender(entry.blocks[i], textStack, meta, options);
			if (i !== len - 1) {
				textStack[0] += `<div class="rd__s-v-flow"></div>`;
			}
		}
		textStack[0] += `</div>`;
	};

	this._renderFlowBlock = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-flow text-center" ${dataString}>`;

		const cachedLastDepthTrackerProps = MiscUtil.copyFast(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-flow-block" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><h4 class="entry-title-inner">${this.render({type: "inline", entries: [entry.name]})}</h4></span>`;
		}
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `<div class="float-clear"></div>`;
		textStack[0] += `</${this.wrapperTag}>`;

		this._lastDepthTrackerInheritedProps = cachedLastDepthTrackerProps;
	};

	this._renderHomebrew = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<div class="homebrew-section"><div class="homebrew-float"><span class="homebrew-notice"></span>`;

		if (entry.oldEntries) {
			const hoverMeta = Renderer.hover.getMakePredefinedHover({type: "entries", name: "Homebrew", entries: entry.oldEntries});
			let markerText;
			if (entry.movedTo) {
				markerText = "(See moved content)";
			} else if (entry.entries) {
				markerText = "(See replaced content)";
			} else {
				markerText = "(See removed content)";
			}
			textStack[0] += `<span class="homebrew-old-content" href="#${window.location.hash}" ${hoverMeta.html}>${markerText}</span>`;
		}

		textStack[0] += `</div>`;

		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "<p>", suffix: "</p>"});
		} else if (entry.movedTo) {
			textStack[0] += `<i>This content has been moved to ${entry.movedTo}.</i>`;
		} else {
			textStack[0] += "<i>This content has been deleted.</i>";
		}

		textStack[0] += `</div>`;
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderCode = function (entry, textStack, meta, options) {
		const isWrapped = !!StorageUtil.syncGet("rendererCodeWrap");
		textStack[0] += `
			<div class="ve-flex-col h-100">
				<div class="ve-flex no-shrink pt-1">
					<button class="btn btn-default btn-xs mb-1 mr-2" onclick="Renderer.events.handleClick_copyCode(event, this)">Copy Code</button>
					<button class="btn btn-default btn-xs mb-1 ${isWrapped ? "active" : ""}" onclick="Renderer.events.handleClick_toggleCodeWrap(event, this)">Word Wrap</button>
				</div>
				<pre class="h-100 w-100 mb-1 ${isWrapped ? "rd__pre-wrap" : ""}">${entry.preformatted}</pre>
			</div>
		`;
	};

	this._renderHr = function (entry, textStack, meta, options) {
		textStack[0] += `<hr class="rd__hr">`;
	};

	this._getStyleClass = function (entryType, entry) {
		const outList = [];

		const pluginResults = this._getPlugins(`${entryType}_styleClass_fromSource`)
			.map(plugin => plugin(entryType, entry)).filter(Boolean);

		if (!pluginResults.some(it => it.isSkip)) {
			if (
				SourceUtil.isNonstandardSource(entry.source)
				|| (typeof PrereleaseUtil !== "undefined" && PrereleaseUtil.hasSourceJson(entry.source))
			) outList.push("spicy-sauce");
			if (typeof BrewUtil2 !== "undefined" && BrewUtil2.hasSourceJson(entry.source)) outList.push("refreshing-brew");
		}

		if (this._extraSourceClasses) outList.push(...this._extraSourceClasses);
		for (const k in this._fnsGetStyleClasses) {
			const fromFn = this._fnsGetStyleClasses[k](entry);
			if (fromFn) outList.push(...fromFn);
		}
		if (entry.style) outList.push(entry.style);
		return outList.join(" ");
	};

	this._renderString = function (entry, textStack, meta, options) {
		const tagSplit = Renderer.splitByTags(entry);
		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;
			if (s.startsWith("{@")) {
				const [tag, text] = Renderer.splitFirstSpace(s.slice(1, -1));
				this._renderString_renderTag(textStack, meta, options, tag, text);
			} else textStack[0] += s;
		}
	};

	this._renderString_renderTag = function (textStack, meta, options, tag, text) {
		// region Plugins
		// Generic
		for (const plugin of this._getPlugins("string_tag")) {
			const out = plugin(tag, text, textStack, meta, options);
			if (out) return void (textStack[0] += out);
		}

		// Tag-specific
		for (const plugin of this._getPlugins(`string_${tag}`)) {
			const out = plugin(tag, text, textStack, meta, options);
			if (out) return void (textStack[0] += out);
		}
		// endregion

		switch (tag) {
			// BASIC STYLES/TEXT ///////////////////////////////////////////////////////////////////////////////
			case "@b":
			case "@bold":
				textStack[0] += `<b>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</b>`;
				break;
			case "@i":
			case "@italic":
				textStack[0] += `<i>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</i>`;
				break;
			case "@s":
			case "@strike":
				textStack[0] += `<s>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</s>`;
				break;
			case "@u":
			case "@underline":
				textStack[0] += `<u>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</u>`;
				break;
			case "@sup":
				textStack[0] += `<sup>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</sup>`;
				break;
			case "@sub":
				textStack[0] += `<sub>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</sub>`;
				break;
			case "@kbd":
				textStack[0] += `<kbd>`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</kbd>`;
				break;
			case "@code":
				textStack[0] += `<span class="code">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@style": {
				const [displayText, styles] = Renderer.splitTagByPipe(text);
				const classNames = (styles || "").split(";").map(it => Renderer._STYLE_TAG_ID_TO_STYLE[it.trim()]).filter(Boolean).join(" ");
				textStack[0] += `<span class="${classNames}">`;
				this._recursiveRender(displayText, textStack, meta);
				textStack[0] += `</span>`;
				break;
			}
			case "@note":
				textStack[0] += `<i class="ve-muted">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</i>`;
				break;
			case "@atk":
				textStack[0] += `<i>${Renderer.attackTagToFull(text)}</i>`;
				break;
			case "@h": textStack[0] += `<i>Hit:</i> `; break;
			case "@m": textStack[0] += `<i>Miss:</i> `; break;
			case "@color": {
				const [toDisplay, color] = Renderer.splitTagByPipe(text);
				const ptColor = this._renderString_renderTag_getBrewColorPart(color);

				textStack[0] += `<span class="rd__color" style="color: ${ptColor}">`;
				this._recursiveRender(toDisplay, textStack, meta);
				textStack[0] += `</span>`;
				break;
			}
			case "@highlight": {
				const [toDisplay, color] = Renderer.splitTagByPipe(text);
				const ptColor = this._renderString_renderTag_getBrewColorPart(color);

				textStack[0] += ptColor ? `<span style="background-color: ${ptColor}">` : `<span class="rd__highlight">`;
				textStack[0] += toDisplay;
				textStack[0] += `</span>`;
				break;
			}
			case "@help": {
				const [toDisplay, title = ""] = Renderer.splitTagByPipe(text);
				textStack[0] += `<span class="help" title="${title.qq()}">`;
				this._recursiveRender(toDisplay, textStack, meta);
				textStack[0] += `</span>`;
				break;
			}

			// Misc utilities //////////////////////////////////////////////////////////////////////////////////
			case "@unit": {
				const [amount, unitSingle, unitPlural] = Renderer.splitTagByPipe(text);
				textStack[0] += isNaN(amount) ? unitSingle : Number(amount) > 1 ? unitPlural : unitSingle;
				break;
			}

			// Comic styles ////////////////////////////////////////////////////////////////////////////////////
			case "@comic":
				textStack[0] += `<span class="rd__comic">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@comicH1":
				textStack[0] += `<span class="rd__comic rd__comic--h1">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@comicH2":
				textStack[0] += `<span class="rd__comic rd__comic--h2">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@comicH3":
				textStack[0] += `<span class="rd__comic rd__comic--h3">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@comicH4":
				textStack[0] += `<span class="rd__comic rd__comic--h4">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;
			case "@comicNote":
				textStack[0] += `<span class="rd__comic rd__comic--note">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</span>`;
				break;

			// DCs /////////////////////////////////////////////////////////////////////////////////////////////
			case "@dc": {
				const [dcText, displayText] = Renderer.splitTagByPipe(text);
				textStack[0] += `DC <span class="rd__dc">${displayText || dcText}</span>`;
				break;
			}

			// DICE ////////////////////////////////////////////////////////////////////////////////////////////
			case "@dice":
			case "@autodice":
			case "@damage":
			case "@hit":
			case "@d20":
			case "@chance":
			case "@coinflip":
			case "@recharge":
			case "@ability":
			case "@savingThrow":
			case "@skillCheck": {
				const fauxEntry = Renderer.utils.getTagEntry(tag, text);

				if (tag === "@recharge") {
					const [, flagsRaw] = Renderer.splitTagByPipe(text);
					const flags = flagsRaw ? flagsRaw.split("") : null;
					textStack[0] += `${flags && flags.includes("m") ? "" : "("}Recharge `;
					this._recursiveRender(fauxEntry, textStack, meta);
					textStack[0] += `${flags && flags.includes("m") ? "" : ")"}`;
				} else {
					this._recursiveRender(fauxEntry, textStack, meta);
				}

				break;
			}

			case "@hitYourSpellAttack": this._renderString_renderTag_hitYourSpellAttack(textStack, meta, options, tag, text); break;

			// SCALE DICE //////////////////////////////////////////////////////////////////////////////////////
			case "@scaledice":
			case "@scaledamage": {
				const fauxEntry = Renderer.parseScaleDice(tag, text);
				this._recursiveRender(fauxEntry, textStack, meta);
				break;
			}

			// LINKS ///////////////////////////////////////////////////////////////////////////////////////////
			case "@filter": {
				// format: {@filter Warlock Spells|spells|level=1;2|class=Warlock}
				const [displayText, page, ...filters] = Renderer.splitTagByPipe(text);

				const filterSubhashMeta = Renderer.getFilterSubhashes(filters);

				const fauxEntry = {
					type: "link",
					text: displayText,
					href: {
						type: "internal",
						path: `${page}.html`,
						hash: HASH_BLANK,
						hashPreEncoded: true,
						subhashes: filterSubhashMeta.subhashes,
					},
				};

				if (filterSubhashMeta.customHash) fauxEntry.href.hash = filterSubhashMeta.customHash;

				this._recursiveRender(fauxEntry, textStack, meta);

				break;
			}
			case "@link": {
				const [displayText, url] = Renderer.splitTagByPipe(text);
				let outUrl = url == null ? displayText : url;
				if (!outUrl.startsWith("http")) outUrl = `http://${outUrl}`; // avoid HTTPS, as the D&D homepage doesn't support it
				const fauxEntry = {
					type: "link",
					href: {
						type: "external",
						url: outUrl,
					},
					text: displayText,
				};
				this._recursiveRender(fauxEntry, textStack, meta);

				break;
			}
			case "@5etools": {
				const [displayText, page, hash] = Renderer.splitTagByPipe(text);
				const fauxEntry = {
					type: "link",
					href: {
						type: "internal",
						path: page,
					},
					text: displayText,
				};
				if (hash) {
					fauxEntry.hash = hash;
					fauxEntry.hashPreEncoded = true;
				}
				this._recursiveRender(fauxEntry, textStack, meta);

				break;
			}

			// OTHER HOVERABLES ////////////////////////////////////////////////////////////////////////////////
			case "@footnote": {
				const [displayText, footnoteText, optTitle] = Renderer.splitTagByPipe(text);
				const hoverMeta = Renderer.hover.getMakePredefinedHover({
					type: "entries",
					name: optTitle ? optTitle.toTitleCase() : "Footnote",
					entries: [footnoteText, optTitle ? `{@note ${optTitle}}` : ""].filter(Boolean),
				});
				textStack[0] += `<span class="help" ${hoverMeta.html}>`;
				this._recursiveRender(displayText, textStack, meta);
				textStack[0] += `</span>`;

				break;
			}
			case "@homebrew": {
				const [newText, oldText] = Renderer.splitTagByPipe(text);
				const tooltipEntries = [];
				if (newText && oldText) {
					tooltipEntries.push("{@b This is a homebrew addition, replacing the following:}");
				} else if (newText) {
					tooltipEntries.push("{@b This is a homebrew addition.}");
				} else if (oldText) {
					tooltipEntries.push("{@b The following text has been removed with this homebrew:}");
				}
				if (oldText) {
					tooltipEntries.push(oldText);
				}
				const hoverMeta = Renderer.hover.getMakePredefinedHover({
					type: "entries",
					name: "Homebrew Modifications",
					entries: tooltipEntries,
				});
				textStack[0] += `<span class="homebrew-inline" ${hoverMeta.html}>`;
				this._recursiveRender(newText || "[...]", textStack, meta);
				textStack[0] += `</span>`;

				break;
			}
			case "@area": {
				const [compactText, areaId, flags, ...others] = Renderer.splitTagByPipe(text);

				const renderText = flags && flags.includes("x")
					? compactText
					: `${flags && flags.includes("u") ? "A" : "a"}rea ${compactText}`;

				if (typeof BookUtil === "undefined") { // for the roll20 script
					textStack[0] += renderText;
				} else {
					const area = BookUtil.curRender.headerMap[areaId] || {entry: {name: ""}}; // default to prevent rendering crash on bad tag
					const hoverMeta = Renderer.hover.getMakePredefinedHover(area.entry, {isLargeBookContent: true, depth: area.depth});
					textStack[0] += `<a href="#${BookUtil.curRender.curBookId},${area.chapter},${UrlUtil.encodeForHash(area.entry.name)},0" ${hoverMeta.html}>${renderText}</a>`;
				}

				break;
			}

			// HOMEBREW LOADING ////////////////////////////////////////////////////////////////////////////////
			case "@loader": {
				const {name, path, mode} = this._renderString_getLoaderTagMeta(text);

				const brewUtilName = mode === "homebrew" ? "BrewUtil2" : mode === "prerelease" ? "PrereleaseUtil" : null;
				const brewUtil = globalThis[brewUtilName];

				if (!brewUtil) {
					textStack[0] += `<span class="text-danger" title="Unknown loader mode &quot;${mode.qq()}&quot;!">${name}<span class="glyphicon glyphicon-alert rd__loadbrew-icon rd__loadbrew-icon"></span></span>`;

					break;
				}

				textStack[0] += `<span onclick="${brewUtilName}.pAddBrewFromLoaderTag(this)" data-rd-loader-path="${path.escapeQuotes()}" data-rd-loader-name="${name.escapeQuotes()}" class="rd__wrp-loadbrew--ready" title="Click to install ${brewUtil.DISPLAY_NAME}">${name}<span class="glyphicon glyphicon-download-alt rd__loadbrew-icon rd__loadbrew-icon"></span></span>`;
				break;
			}

			// CONTENT TAGS ////////////////////////////////////////////////////////////////////////////////////
			case "@book":
			case "@adventure": {
				// format: {@tag Display Text|DMG< |chapter< |section >< |number > >}
				const page = tag === "@book" ? "book.html" : "adventure.html";
				const [displayText, book, chapter, section, rawNumber] = Renderer.splitTagByPipe(text);
				const number = rawNumber || 0;
				const hash = `${book}${chapter ? `${HASH_PART_SEP}${chapter}${section ? `${HASH_PART_SEP}${UrlUtil.encodeForHash(section)}${number != null ? `${HASH_PART_SEP}${UrlUtil.encodeForHash(number)}` : ""}` : ""}` : ""}`;
				const fauxEntry = {
					type: "link",
					href: {
						type: "internal",
						path: page,
						hash,
						hashPreEncoded: true,
					},
					text: displayText,
				};
				this._recursiveRender(fauxEntry, textStack, meta);

				break;
			}

			default: {
				const {name, source, displayText, others, page, hash, hashPreEncoded, pageHover, hashHover, hashPreEncodedHover, preloadId, linkText, subhashes, subhashesHover, isFauxPage} = Renderer.utils.getTagMeta(tag, text);

				const fauxEntry = {
					type: "link",
					href: {
						type: "internal",
						path: page,
						hash,
						hover: {
							page,
							isFauxPage,
							source,
						},
					},
					text: (displayText || name),
				};

				if (hashPreEncoded != null) fauxEntry.href.hashPreEncoded = hashPreEncoded;
				if (pageHover != null) fauxEntry.href.hover.page = pageHover;
				if (hashHover != null) fauxEntry.href.hover.hash = hashHover;
				if (hashPreEncodedHover != null) fauxEntry.href.hover.hashPreEncoded = hashPreEncodedHover;
				if (preloadId != null) fauxEntry.href.hover.preloadId = preloadId;
				if (linkText) fauxEntry.text = linkText;
				if (subhashes) fauxEntry.href.subhashes = subhashes;
				if (subhashesHover) fauxEntry.href.hover.subhashes = subhashesHover;

				this._recursiveRender(fauxEntry, textStack, meta);

				break;
			}
		}
	};

	this._renderString_renderTag_getBrewColorPart = function (color) {
		if (!color) return "";
		const scrubbedColor = BrewUtilShared.getValidColor(color, {isExtended: true});
		return scrubbedColor.startsWith("--") ? `var(${scrubbedColor})` : `#${scrubbedColor}`;
	};

	this._renderString_renderTag_hitYourSpellAttack = function (textStack, meta, options, tag, text) {
		const fauxEntry = {
			type: "dice",
			rollable: true,
			subType: "d20",
			displayText: "your spell attack modifier",
			toRoll: `1d20 + #$prompt_number:title=Enter your Spell Attack Modifier$#`,
		};
		return this._recursiveRender(fauxEntry, textStack, meta);
	};

	this._renderString_getLoaderTagMeta = function (text, {isDefaultUrl = false} = {}) {
		const [name, file, mode = "homebrew"] = Renderer.splitTagByPipe(text);

		if (!isDefaultUrl) return {name, path: file, mode};

		const path = /^.*?:\/\//.test(file) ? file : `${VeCt.URL_ROOT_BREW}${file}`;
		return {name, path, mode};
	};

	this._renderPrimitive = function (entry, textStack, meta, options) { textStack[0] += entry; };

	this._renderLink = function (entry, textStack, meta, options) {
		let href = this._renderLink_getHref(entry);

		// overwrite href if there's an available Roll20 handout/character
		if (entry.href.hover && this._roll20Ids) {
			const procHash = UrlUtil.encodeForHash(entry.href.hash);
			const id = this._roll20Ids[procHash];
			if (id) {
				href = `http://journal.roll20.net/${id.type}/${id.roll20Id}`;
			}
		}

		const pluginData = this._getPlugins("link").map(plugin => plugin(entry, textStack, meta, options)).filter(Boolean);
		const isDisableEvents = pluginData.some(it => it.isDisableEvents);
		const additionalAttributes = pluginData.map(it => it.attributes).filter(Boolean);

		if (this._isInternalLinksDisabled && entry.href.type === "internal") {
			textStack[0] += `<span class="bold" ${isDisableEvents ? "" : this._renderLink_getHoverString(entry)} ${additionalAttributes.join(" ")}>${this.render(entry.text)}</span>`;
		} else if (entry.href.hover?.isFauxPage) {
			textStack[0] += `<span class="help help--hover" ${isDisableEvents ? "" : this._renderLink_getHoverString(entry)} ${additionalAttributes.join(" ")}>${this.render(entry.text)}</span>`;
		} else {
			textStack[0] += `<a href="${href.qq()}" ${entry.href.type === "internal" ? "" : `target="_blank" rel="noopener noreferrer"`} ${isDisableEvents ? "" : this._renderLink_getHoverString(entry)} ${additionalAttributes.join(" ")}>${this.render(entry.text)}</a>`;
		}
	};

	this._renderLink_getHref = function (entry) {
		let href;
		if (entry.href.type === "internal") {
			// baseURL is blank by default
			href = `${this.baseUrl}${entry.href.path}#`;
			if (entry.href.hash != null) {
				href += entry.href.hashPreEncoded ? entry.href.hash : UrlUtil.encodeForHash(entry.href.hash);
			}
			if (entry.href.subhashes != null) {
				href += Renderer.utils.getLinkSubhashString(entry.href.subhashes);
			}
		} else if (entry.href.type === "external") {
			href = entry.href.url;
		}
		return href;
	};

	this._renderLink_getHoverString = function (entry) {
		if (!entry.href.hover || !this._isAddHandlers) return "";

		let procHash = entry.href.hover.hash
			? entry.href.hover.hashPreEncoded ? entry.href.hover.hash : UrlUtil.encodeForHash(entry.href.hover.hash)
			: entry.href.hashPreEncoded ? entry.href.hash : UrlUtil.encodeForHash(entry.href.hash);

		if (this._tagExportDict) {
			this._tagExportDict[procHash] = {
				page: entry.href.hover.page,
				source: entry.href.hover.source,
				hash: procHash,
			};
		}

		if (entry.href.hover.subhashes) {
			procHash += Renderer.utils.getLinkSubhashString(entry.href.hover.subhashes);
		}

		const pluginData = this._getPlugins("link_attributesHover")
			.map(plugin => plugin(entry, procHash))
			.filter(Boolean);
		const replacementAttributes = pluginData.map(it => it.attributesHoverReplace).filter(Boolean);
		if (replacementAttributes.length) return replacementAttributes.join(" ");

		return `onmouseover="Renderer.hover.pHandleLinkMouseOver(event, this)" onmouseleave="Renderer.hover.handleLinkMouseLeave(event, this)" onmousemove="Renderer.hover.handleLinkMouseMove(event, this)" data-vet-page="${entry.href.hover.page.qq()}" data-vet-source="${entry.href.hover.source.qq()}" data-vet-hash="${procHash.qq()}" ${entry.href.hover.preloadId != null ? `data-vet-preload-id="${`${entry.href.hover.preloadId}`.qq()}"` : ""} ${entry.href.hover.isFauxPage ? `data-vet-is-faux-page="true"` : ""} ${Renderer.hover.getPreventTouchString()}`;
	};

	/**
	 * Helper function to render an entity using this renderer
	 * @param entry
	 * @param depth
	 * @returns {string}
	 */
	this.render = function (entry, depth = 0) {
		const tempStack = [];
		this.recursiveRender(entry, tempStack, {depth});
		return tempStack.join("");
	};
};

// Unless otherwise specified, these use `"name"` as their name title prop
Renderer.ENTRIES_WITH_ENUMERATED_TITLES = [
	{type: "section", key: "entries", depth: -1},
	{type: "entries", key: "entries", depthIncrement: 1},
	{type: "options", key: "entries"},
	{type: "inset", key: "entries", depth: 2},
	{type: "insetReadaloud", key: "entries", depth: 2},
	{type: "variant", key: "entries", depth: 2},
	{type: "variantInner", key: "entries", depth: 2},
	{type: "actions", key: "entries", depth: 2},
	{type: "flowBlock", key: "entries", depth: 2},
	{type: "optfeature", key: "entries", depthIncrement: 1},
	{type: "patron", key: "entries"},
];

Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP = Renderer.ENTRIES_WITH_ENUMERATED_TITLES.mergeMap(it => ({[it.type]: it}));

Renderer.ENTRIES_WITH_CHILDREN = [
	...Renderer.ENTRIES_WITH_ENUMERATED_TITLES,
	{type: "list", key: "items"},
	{type: "table", key: "rows"},
];

Renderer._INLINE_HEADER_TERMINATORS = new Set([".", ",", "!", "?", ";", ":", `"`]);

Renderer._STYLE_TAG_ID_TO_STYLE = {
	"small-caps": "small-caps",
	"small": "ve-small",
	"capitalize": "capitalize",
	"dnd-font": "dnd-font",
};

Renderer.get = () => {
	if (!Renderer.defaultRenderer) Renderer.defaultRenderer = new Renderer();
	return Renderer.defaultRenderer;
};

Renderer.applyProperties = function (entry, object) {
	const propSplit = Renderer.splitByPropertyInjectors(entry);
	const len = propSplit.length;
	if (len === 1) return entry;

	let textStack = "";

	for (let i = 0; i < len; ++i) {
		const s = propSplit[i];
		if (!s) continue;
		if (s.startsWith("{=")) {
			const [path, modifiers] = s.slice(2, -1).split("/");
			let fromProp = object[path];

			if (modifiers) {
				for (const modifier of modifiers) {
					switch (modifier) {
						case "a": // render "a"/"an" depending on prop value
							fromProp = Renderer.applyProperties._leadingAn.has(fromProp[0].toLowerCase()) ? "an" : "a";
							break;

						case "l": fromProp = fromProp.toLowerCase(); break; // convert text to lower case
						case "t": fromProp = fromProp.toTitleCase(); break; // title-case text
						case "u": fromProp = fromProp.toUpperCase(); break; // uppercase text
						case "v": fromProp = Parser.numberToVulgar(fromProp); break; // vulgarize number
						case "r": fromProp = Math.round(fromProp); break; // round number
						case "f": fromProp = Math.floor(fromProp); break; // floor number
						case "c": fromProp = Math.ceil(fromProp); break; // ceiling number
					}
				}
			}
			textStack += fromProp;
		} else textStack += s;
	}

	return textStack;
};
Renderer.applyProperties._leadingAn = new Set(["a", "e", "i", "o", "u"]);

Renderer.applyAllProperties = function (entries, object = null) {
	let lastObj = null;
	const handlers = {
		object: (obj) => {
			lastObj = obj;
			return obj;
		},
		string: (str) => Renderer.applyProperties(str, object || lastObj),
	};
	return MiscUtil.getWalker().walk(entries, handlers);
};

Renderer.attackTagToFull = function (tagStr) {
	function renderTag (tags) {
		return `${tags.includes("m") ? "Melee " : tags.includes("r") ? "Ranged " : tags.includes("g") ? "Magical " : tags.includes("a") ? "Area " : ""}${tags.includes("w") ? "Weapon " : tags.includes("s") ? "Spell " : ""}`;
	}

	const tagGroups = tagStr.toLowerCase().split(",").map(it => it.trim()).filter(it => it).map(it => it.split(""));
	if (tagGroups.length > 1) {
		const seen = new Set(tagGroups.last());
		for (let i = tagGroups.length - 2; i >= 0; --i) {
			tagGroups[i] = tagGroups[i].filter(it => {
				const out = !seen.has(it);
				seen.add(it);
				return out;
			});
		}
	}
	return `${tagGroups.map(it => renderTag(it)).join(" or ")}Attack:`;
};

Renderer.splitFirstSpace = function (string) {
	const firstIndex = string.indexOf(" ");
	return firstIndex === -1 ? [string, ""] : [string.substr(0, firstIndex), string.substr(firstIndex + 1)];
};

Renderer._splitByTagsBase = function (leadingCharacter) {
	return function (string) {
		let tagDepth = 0;
		let char, char2;
		const out = [];
		let curStr = "";
		let isLastOpen = false;

		const len = string.length;
		for (let i = 0; i < len; ++i) {
			char = string[i];
			char2 = string[i + 1];

			switch (char) {
				case "{":
					isLastOpen = true;
					if (char2 === leadingCharacter) {
						if (tagDepth++ > 0) {
							curStr += "{";
						} else {
							out.push(curStr.replace(/<VE_LEAD>/g, leadingCharacter));
							curStr = `{${leadingCharacter}`;
							++i;
						}
					} else curStr += "{";
					break;

				case "}":
					isLastOpen = false;
					curStr += "}";
					if (tagDepth !== 0 && --tagDepth === 0) {
						out.push(curStr.replace(/<VE_LEAD>/g, leadingCharacter));
						curStr = "";
					}
					break;

				case leadingCharacter: {
					if (!isLastOpen) curStr += "<VE_LEAD>";
					else curStr += leadingCharacter;
					break;
				}

				default: isLastOpen = false; curStr += char; break;
			}
		}

		if (curStr) out.push(curStr.replace(/<VE_LEAD>/g, leadingCharacter));

		return out;
	};
};

Renderer.splitByTags = Renderer._splitByTagsBase("@");
Renderer.splitByPropertyInjectors = Renderer._splitByTagsBase("=");

Renderer._splitByPipeBase = function (leadingCharacter) {
	return function (string) {
		let tagDepth = 0;
		let char, char2;
		const out = [];
		let curStr = "";

		const len = string.length;
		for (let i = 0; i < len; ++i) {
			char = string[i];
			char2 = string[i + 1];

			switch (char) {
				case "{":
					if (char2 === leadingCharacter) tagDepth++;
					curStr += "{";

					break;

				case "}":
					if (tagDepth) tagDepth--;
					curStr += "}";

					break;

				case "|": {
					if (tagDepth) curStr += "|";
					else {
						out.push(curStr);
						curStr = "";
					}
					break;
				}

				default: {
					curStr += char;
					break;
				}
			}
		}

		if (curStr) out.push(curStr);
		return out;
	};
};

Renderer.splitTagByPipe = Renderer._splitByPipeBase("@");

Renderer.getEntryDice = function (entry, name, opts = {}) {
	const toDisplay = Renderer.getEntryDiceDisplayText(entry);

	if (entry.rollable === true) return Renderer.getRollableEntryDice(entry, name, toDisplay, opts);
	else return toDisplay;
};

Renderer.getRollableEntryDice = function (
	entry,
	name,
	toDisplay,
	{
		isAddHandlers = true,
		pluginResults = null,
	} = {},
) {
	const toPack = MiscUtil.copyFast(entry);
	if (typeof toPack.toRoll !== "string") {
		// handle legacy format
		toPack.toRoll = Renderer.legacyDiceToString(toPack.toRoll);
	}

	const handlerPart = isAddHandlers ? `onmousedown="event.preventDefault()" data-packed-dice='${JSON.stringify(toPack).qq()}'` : "";

	const rollableTitlePart = isAddHandlers ? Renderer.getEntryDiceTitle(toPack.subType) : null;
	const titlePart = isAddHandlers
		? `title="${[name, rollableTitlePart].filter(Boolean).join(". ").qq()}" ${name ? `data-roll-name="${name}"` : ""}`
		: name ? `title="${name.qq()}" data-roll-name="${name.qq()}"` : "";

	const additionalDataPart = (pluginResults || [])
		.filter(it => it.additionalData)
		.map(it => {
			return Object.entries(it.additionalData)
				.map(([dataKey, val]) => `${dataKey}='${typeof val === "object" ? JSON.stringify(val).qq() : `${val}`.qq()}'`)
				.join(" ");
		})
		.join(" ");

	toDisplay = (pluginResults || []).filter(it => it.toDisplay)[0]?.toDisplay ?? toDisplay;

	const ptRoll = Renderer.getRollableEntryDice._getPtRoll(toPack);

	return `<span class="roller render-roller" ${titlePart} ${handlerPart} ${additionalDataPart}>${toDisplay}</span>${ptRoll}`;
};

Renderer.getRollableEntryDice._getPtRoll = (toPack) => {
	if (!toPack.autoRoll) return "";

	const r = Renderer.dice.parseRandomise2(toPack.toRoll);
	return ` (<span data-rd-is-autodice-result="true">${r}</span>)`;
};

Renderer.getEntryDiceTitle = function (subType) {
	return `Click to roll. ${subType === "damage" ? "SHIFT to roll a critical hit, CTRL to half damage (rounding down)." : subType === "d20" ? "SHIFT to roll with advantage, CTRL to roll with disadvantage." : "SHIFT/CTRL to roll twice."}`;
};

Renderer.legacyDiceToString = function (array) {
	let stack = "";
	array.forEach(r => {
		stack += `${r.neg ? "-" : stack === "" ? "" : "+"}${r.number || 1}d${r.faces}${r.mod ? r.mod > 0 ? `+${r.mod}` : r.mod : ""}`;
	});
	return stack;
};

Renderer.getEntryDiceDisplayText = function (entry) {
	if (entry.displayText) return entry.displayText;
	return Renderer._getEntryDiceDisplayText_getDiceAsStr(entry);
};

Renderer._getEntryDiceDisplayText_getDiceAsStr = function (entry) {
	if (entry.successThresh != null) return `${entry.successThresh} percent`;
	if (typeof entry.toRoll === "string") return entry.toRoll;
	// handle legacy format
	return Renderer.legacyDiceToString(entry.toRoll);
};

Renderer.parseScaleDice = function (tag, text) {
	// format: {@scaledice 2d6;3d6|2-8,9|1d6|psi} (or @scaledamage)
	const [baseRoll, progression, addPerProgress, renderMode] = Renderer.splitTagByPipe(text);
	const progressionParse = MiscUtil.parseNumberRange(progression, 1, 9);
	const baseLevel = Math.min(...progressionParse);
	const options = {};
	const isMultableDice = /^(\d+)d(\d+)$/i.exec(addPerProgress);

	const getSpacing = () => {
		let diff = null;
		const sorted = [...progressionParse].sort(SortUtil.ascSort);
		for (let i = 1; i < sorted.length; ++i) {
			const prev = sorted[i - 1];
			const curr = sorted[i];
			if (diff == null) diff = curr - prev;
			else if (curr - prev !== diff) return null;
		}
		return diff;
	};

	const spacing = getSpacing();
	progressionParse.forEach(k => {
		const offset = k - baseLevel;
		if (isMultableDice && spacing != null) {
			options[k] = offset ? `${Number(isMultableDice[1]) * (offset / spacing)}d${isMultableDice[2]}` : "";
		} else {
			options[k] = offset ? [...new Array(Math.floor(offset / spacing))].map(_ => addPerProgress).join("+") : "";
		}
	});

	const out = {
		type: "dice",
		rollable: true,
		toRoll: baseRoll,
		displayText: addPerProgress,
		prompt: {
			entry: renderMode === "psi" ? "Spend Psi Points..." : "Cast at...",
			mode: renderMode,
			options,
		},
	};
	if (tag === "@scaledamage") out.subType = "damage";

	return out;
};

Renderer.getAbilityData = function (abArr, {isOnlyShort, isCurrentLineage} = {}) {
	if (isOnlyShort && isCurrentLineage) return new Renderer._AbilityData({asTextShort: "Lineage (choose)"});

	const outerStack = (abArr || [null]).map(it => Renderer.getAbilityData._doRenderOuter(it));
	if (outerStack.length <= 1) return outerStack[0];
	return new Renderer._AbilityData({
		asText: `Choose one of: ${outerStack.map((it, i) => `(${Parser.ALPHABET[i].toLowerCase()}) ${it.asText}`).join(" ")}`,
		asTextShort: `${outerStack.map((it, i) => `(${Parser.ALPHABET[i].toLowerCase()}) ${it.asTextShort}`).join(" ")}`,
		asCollection: [...new Set(outerStack.map(it => it.asCollection).flat())],
		areNegative: [...new Set(outerStack.map(it => it.areNegative).flat())],
	});
};

Renderer.getAbilityData._doRenderOuter = function (abObj) {
	const mainAbs = [];
	const asCollection = [];
	const areNegative = [];
	const toConvertToText = [];
	const toConvertToShortText = [];

	if (abObj != null) {
		handleAllAbilities(abObj);
		handleAbilitiesChoose();
		return new Renderer._AbilityData({
			asText: toConvertToText.join("; "),
			asTextShort: toConvertToShortText.join("; "),
			asCollection: asCollection,
			areNegative: areNegative,
		});
	}

	return new Renderer._AbilityData();

	function handleAllAbilities (abObj, targetList) {
		MiscUtil.copyFast(Parser.ABIL_ABVS)
			.sort((a, b) => SortUtil.ascSort(abObj[b] || 0, abObj[a] || 0))
			.forEach(shortLabel => handleAbility(abObj, shortLabel, targetList));
	}

	function handleAbility (abObj, shortLabel, optToConvertToTextStorage) {
		if (abObj[shortLabel] != null) {
			const isNegMod = abObj[shortLabel] < 0;
			const toAdd = `${shortLabel.uppercaseFirst()} ${(isNegMod ? "" : "+")}${abObj[shortLabel]}`;

			if (optToConvertToTextStorage) {
				optToConvertToTextStorage.push(toAdd);
			} else {
				toConvertToText.push(toAdd);
				toConvertToShortText.push(toAdd);
			}

			mainAbs.push(shortLabel.uppercaseFirst());
			asCollection.push(shortLabel);
			if (isNegMod) areNegative.push(shortLabel);
		}
	}

	function handleAbilitiesChoose () {
		if (abObj.choose != null) {
			const ch = abObj.choose;
			let outStack = "";
			if (ch.weighted) {
				const w = ch.weighted;
				const froms = w.from.map(it => it.uppercaseFirst());
				const isAny = froms.length === 6;
				const isAllEqual = w.weights.unique().length === 1;
				let cntProcessed = 0;

				const weightsIncrease = w.weights.filter(it => it >= 0).sort(SortUtil.ascSort).reverse();
				const weightsReduce = w.weights.filter(it => it < 0).map(it => -it).sort(SortUtil.ascSort);

				const areIncreaseShort = [];
				const areIncrease = isAny && isAllEqual && w.weights.length > 1 && w.weights[0] >= 0
					? (() => {
						weightsIncrease.forEach(it => areIncreaseShort.push(`+${it}`));
						return [`${cntProcessed ? "choose " : ""}${Parser.numberToText(w.weights.length)} different +${weightsIncrease[0]}`];
					})()
					: weightsIncrease.map(it => {
						areIncreaseShort.push(`+${it}`);
						if (isAny) return `${cntProcessed ? "choose " : ""}any ${cntProcessed++ ? `other ` : ""}+${it}`;
						return `one ${cntProcessed++ ? `other ` : ""}ability to increase by ${it}`;
					});

				const areReduceShort = [];
				const areReduce = isAny && isAllEqual && w.weights.length > 1 && w.weights[0] < 0
					? (() => {
						weightsReduce.forEach(it => areReduceShort.push(`-${it}`));
						return [`${cntProcessed ? "choose " : ""}${Parser.numberToText(w.weights.length)} different -${weightsReduce[0]}`];
					})()
					: weightsReduce.map(it => {
						areReduceShort.push(`-${it}`);
						if (isAny) return `${cntProcessed ? "choose " : ""}any ${cntProcessed++ ? `other ` : ""}-${it}`;
						return `one ${cntProcessed++ ? `other ` : ""}ability to decrease by ${it}`;
					});

				const startText = isAny
					? `Choose `
					: `From ${froms.joinConjunct(", ", " and ")} choose `;

				const ptAreaIncrease = isAny
					? areIncrease.concat(areReduce).join("; ")
					: areIncrease.concat(areReduce).joinConjunct(", ", isAny ? "; " : " and ");
				toConvertToText.push(`${startText}${ptAreaIncrease}`);
				toConvertToShortText.push(`${isAny ? "Any combination " : ""}${areIncreaseShort.concat(areReduceShort).join("/")}${isAny ? "" : ` from ${froms.join("/")}`}`);
			} else {
				const allAbilities = ch.from.length === 6;
				const allAbilitiesWithParent = isAllAbilitiesWithParent(ch);
				let amount = ch.amount === undefined ? 1 : ch.amount;
				amount = (amount < 0 ? "" : "+") + amount;
				if (allAbilities) {
					outStack += "any ";
				} else if (allAbilitiesWithParent) {
					outStack += "any other ";
				}
				if (ch.count != null && ch.count > 1) {
					outStack += `${Parser.numberToText(ch.count)} `;
				}
				if (allAbilities || allAbilitiesWithParent) {
					outStack += `${ch.count > 1 ? "unique " : ""}${amount}`;
				} else {
					for (let j = 0; j < ch.from.length; ++j) {
						let suffix = "";
						if (ch.from.length > 1) {
							if (j === ch.from.length - 2) {
								suffix = " or ";
							} else if (j < ch.from.length - 2) {
								suffix = ", ";
							}
						}
						let thsAmount = ` ${amount}`;
						if (ch.from.length > 1) {
							if (j !== ch.from.length - 1) {
								thsAmount = "";
							}
						}
						outStack += ch.from[j].uppercaseFirst() + thsAmount + suffix;
					}
				}
			}

			if (outStack.trim()) {
				toConvertToText.push(`Choose ${outStack}`);
				toConvertToShortText.push(outStack.uppercaseFirst());
			}
		}
	}

	function isAllAbilitiesWithParent (chooseAbs) {
		const tempAbilities = [];
		for (let i = 0; i < mainAbs.length; ++i) {
			tempAbilities.push(mainAbs[i].toLowerCase());
		}
		for (let i = 0; i < chooseAbs.from.length; ++i) {
			const ab = chooseAbs.from[i].toLowerCase();
			if (!tempAbilities.includes(ab)) tempAbilities.push(ab);
			if (!asCollection.includes(ab.toLowerCase)) asCollection.push(ab.toLowerCase());
		}
		return tempAbilities.length === 6;
	}
};

Renderer._AbilityData = function ({asText, asTextShort, asCollection, areNegative} = {}) {
	this.asText = asText || "";
	this.asTextShort = asTextShort || "";
	this.asCollection = asCollection || [];
	this.areNegative = areNegative || [];
};

/**
 * @param filters String of the form `"level=1;2|class=Warlock"`
 * @param namespace Filter namespace to use
 */
Renderer.getFilterSubhashes = function (filters, namespace = null) {
	let customHash = null;

	const subhashes = filters.map(f => {
		const [fName, fVals, fMeta, fOpts] = f.split("=").map(s => s.trim());
		const isBoxData = fName.startsWith("fb");
		const key = isBoxData ? `${fName}${namespace ? `.${namespace}` : ""}` : `flst${namespace ? `.${namespace}` : ""}${UrlUtil.encodeForHash(fName)}`;

		let value;
		// special cases for "search" and "hash" keywords
		if (isBoxData) {
			return {
				key,
				value: fVals,
				preEncoded: true,
			};
		} else if (fName === "search") {
			// "search" as a filter name is hackily converted to a box meta option
			return {
				key: VeCt.FILTER_BOX_SUB_HASH_SEARCH_PREFIX,
				value: UrlUtil.encodeForHash(fVals),
				preEncoded: true,
			};
		} else if (fName === "hash") {
			customHash = fVals;
			return null;
		} else if (fVals.startsWith("[") && fVals.endsWith("]")) { // range
			const [min, max] = fVals.substring(1, fVals.length - 1).split(";").map(it => it.trim());
			if (max == null) { // shorthand version, with only one value, becomes min _and_ max
				value = [
					`min=${min}`,
					`max=${min}`,
				].join(HASH_SUB_LIST_SEP);
			} else {
				value = [
					min ? `min=${min}` : "",
					max ? `max=${max}` : "",
				].filter(Boolean).join(HASH_SUB_LIST_SEP);
			}
		} else if (fVals.startsWith("::") && fVals.endsWith("::")) { // options
			value = fVals.substring(2, fVals.length - 2).split(";")
				.map(it => it.trim())
				.map(it => {
					if (it.startsWith("!")) return `${UrlUtil.encodeForHash(it.slice(1))}=${UrlUtil.mini.compress(false)}`;
					return `${UrlUtil.encodeForHash(it)}=${UrlUtil.mini.compress(true)}`;
				})
				.join(HASH_SUB_LIST_SEP);
		} else {
			value = fVals.split(";")
				.map(s => s.trim())
				.filter(Boolean)
				.map(s => {
					if (s.startsWith("!")) return `${UrlUtil.encodeForHash(s.slice(1))}=2`;
					return `${UrlUtil.encodeForHash(s)}=1`;
				})
				.join(HASH_SUB_LIST_SEP);
		}

		const out = [{
			key,
			value,
			preEncoded: true,
		}];

		if (fMeta) {
			out.push({
				key: `flmt${UrlUtil.encodeForHash(fName)}`,
				value: fMeta,
				preEncoded: true,
			});
		}

		if (fOpts) {
			out.push({
				key: `flop${UrlUtil.encodeForHash(fName)}`,
				value: fOpts,
				preEncoded: true,
			});
		}

		return out;
	}).flat().filter(Boolean);

	return {
		customHash,
		subhashes,
	};
};

Renderer._cache = {
	inlineStatblock: {},

	async pRunFromEle (ele) {
		const cached = Renderer._cache[ele.dataset.rdCache][ele.dataset.rdCacheId];
		await cached.pFn(ele);
	},
};

Renderer.utils = {
	getBorderTr: (optText = null) => {
		return `<tr><th class="border" colspan="6">${optText || ""}</th></tr>`;
	},

	getDividerTr: () => {
		return `<tr><td class="divider" colspan="6"><div></div></td></tr>`;
	},

	getSourceSubText (it) {
		return it.sourceSub ? ` \u2014 ${it.sourceSub}` : "";
	},

	/**
	 * @param it Entity to render the name row for.
	 * @param [opts] Options object.
	 * @param [opts.prefix] Prefix to display before the name.
	 * @param [opts.suffix] Suffix to display after the name.
	 * @param [opts.controlRhs] Additional control(s) to display after the name.
	 * @param [opts.extraThClasses] Additional TH classes to include.
	 * @param [opts.page] The hover page for this entity.
	 * @param [opts.asJquery] If the element should be returned as a jQuery object.
	 * @param [opts.extensionData] Additional data to pass to listening extensions when the send button is clicked.
	 * @param [opts.isEmbeddedEntity] True if this is an embedded entity, i.e. one from a `"dataX"` entry.
	 */
	getNameTr: (it, opts) => {
		opts = opts || {};

		let dataPart = "";
		let pageLinkPart;
		if (opts.page) {
			const hash = UrlUtil.URL_TO_HASH_BUILDER[opts.page](it);
			dataPart = `data-page="${opts.page}" data-source="${it.source.escapeQuotes()}" data-hash="${hash.escapeQuotes()}" ${opts.extensionData != null ? `data-extension='${JSON.stringify(opts.extensionData).escapeQuotes()}` : ""}'`;
			pageLinkPart = SourceUtil.getAdventureBookSourceHref(it.source, it.page);

			// Enable Rivet import for entities embedded in entries
			if (opts.isEmbeddedEntity) ExtensionUtil.addEmbeddedToCache(opts.page, it.source, hash, it);
		}

		const tagPartSourceStart = `<${pageLinkPart ? `a href="${Renderer.get().baseUrl}${pageLinkPart}"` : "span"}`;
		const tagPartSourceEnd = `</${pageLinkPart ? "a" : "span"}>`;

		const ptBrewSourceLink = Renderer.utils._getNameTr_getPtBrewPrereleaseSourceLink({ent: it, brewUtil: PrereleaseUtil})
			|| Renderer.utils._getNameTr_getPtBrewPrereleaseSourceLink({ent: it, brewUtil: BrewUtil2});

		// Add data-page/source/hash attributes for external script use (e.g. Rivet)
		const $ele = $$`<tr>
			<th class="rnd-name ${opts.extraThClasses ? opts.extraThClasses.join(" ") : ""}" colspan="6" ${dataPart}>
				<div class="name-inner">
					<div class="ve-flex-v-center">
						<h1 class="stats-name copyable m-0" onmousedown="event.preventDefault()" onclick="Renderer.utils._pHandleNameClick(this)">${opts.prefix || ""}${it._displayName || it.name}${opts.suffix || ""}</h1>
						${opts.controlRhs || ""}
						${!IS_VTT && ExtensionUtil.ACTIVE && opts.page ? Renderer.utils.getBtnSendToFoundryHtml() : ""}
					</div>
					<div class="stats-source ve-flex-v-baseline">
						${tagPartSourceStart} class="help-subtle stats-source-abbreviation ${it.source ? `${Parser.sourceJsonToColor(it.source)}" title="${Parser.sourceJsonToFull(it.source)}${Renderer.utils.getSourceSubText(it)}` : ""}" ${Parser.sourceJsonToStyle(it.source)}>${it.source ? Parser.sourceJsonToAbv(it.source) : ""}${tagPartSourceEnd}

						${Renderer.utils.isDisplayPage(it.page) ? ` ${tagPartSourceStart} class="rd__stats-name-page ml-1" title="Page ${it.page}">p${it.page}${tagPartSourceEnd}` : ""}

						${ptBrewSourceLink}
					</div>
				</div>
			</th>
		</tr>`;

		if (opts.asJquery) return $ele;
		else return $ele[0].outerHTML;
	},

	_getNameTr_getPtBrewPrereleaseSourceLink ({ent, brewUtil}) {
		if (!brewUtil.hasSourceJson(ent.source) || !brewUtil.sourceJsonToSource(ent.source)?.url) return "";

		return `<a href="${brewUtil.sourceJsonToSource(ent.source).url}" title="View ${brewUtil.DISPLAY_NAME.toTitleCase()} Source" class="ve-self-flex-center ml-2 ve-muted rd__stats-name-brew-link" target="_blank" rel="noopener noreferrer"><span class="	glyphicon glyphicon-share"></span></a>`;
	},

	getBtnSendToFoundryHtml ({isMb = true} = {}) {
		return `<button title="Send to Foundry (SHIFT for Temporary Import)" class="btn btn-xs btn-default btn-stats-name mx-2 ${isMb ? "mb-2" : ""} ve-self-flex-end" onclick="ExtensionUtil.pDoSendStats(event, this)" draggable="true" ondragstart="ExtensionUtil.doDragStart(event, this)"><span class="glyphicon glyphicon-send"></span></button>`;
	},

	isDisplayPage (page) { return page != null && ((!isNaN(page) && page > 0) || isNaN(page)); },

	getExcludedTr ({entity, dataProp, page, isExcluded}) {
		const excludedHtml = Renderer.utils.getExcludedHtml({entity, dataProp, page, isExcluded});
		if (!excludedHtml) return "";
		return `<tr><td colspan="6" class="pt-3">${excludedHtml}</td></tr>`;
	},

	getExcludedHtml ({entity, dataProp, page, isExcluded}) {
		if (isExcluded != null && !isExcluded) return "";
		if (isExcluded == null) {
			if (!ExcludeUtil.isInitialised) return "";
			if (page && !UrlUtil.URL_TO_HASH_BUILDER[page]) return "";
			const hash = page ? UrlUtil.URL_TO_HASH_BUILDER[page](entity) : UrlUtil.autoEncodeHash(entity);
			isExcluded = isExcluded
				|| dataProp === "item" ? Renderer.item.isExcluded(entity, {hash}) : ExcludeUtil.isExcluded(hash, dataProp, entity.source);
		}
		return isExcluded ? `<div class="text-center text-danger"><b><i>Warning: This content has been <a href="blocklist.html">blocklisted</a>.</i></b></div>` : "";
	},

	getSourceAndPageTrHtml (it, {tag, fnUnpackUid} = {}) {
		const html = Renderer.utils.getSourceAndPageHtml(it, {tag, fnUnpackUid});
		return html ? `<b>Source:</b> ${html}` : "";
	},

	_getAltSourceHtmlOrText (it, prop, introText, isText) {
		if (!it[prop] || !it[prop].length) return "";

		return `${introText} ${it[prop].map(as => {
			if (as.entry) return (isText ? Renderer.stripTags : Renderer.get().render)(as.entry);
			return `${isText ? "" : `<i class="help-subtle" title="${Parser.sourceJsonToFull(as.source).qq()}">`}${Parser.sourceJsonToAbv(as.source)}${isText ? "" : `</i>`}${Renderer.utils.isDisplayPage(as.page) ? `, page ${as.page}` : ""}`;
		}).join("; ")}`;
	},

	_getReprintedAsHtmlOrText (ent, {isText, tag, fnUnpackUid} = {}) {
		if (!ent.reprintedAs) return "";
		if (!tag || !fnUnpackUid) return "";

		const ptReprinted = ent.reprintedAs
			.map(it => {
				const uid = it.uid ?? it;
				const tag_ = it.tag ?? tag;

				const {name, source, displayText} = fnUnpackUid(uid);

				if (isText) {
					return `${Renderer.stripTags(displayText || name)} in ${Parser.sourceJsonToAbv(source)}`;
				}

				const asTag = `{@${tag_} ${name}|${source}${displayText ? `|${displayText}` : ""}}`;

				return `${Renderer.get().render(asTag)} in <i class="help-subtle" title="${Parser.sourceJsonToFull(source).qq()}">${Parser.sourceJsonToAbv(source)}</i>`;
			})
			.join("; ");

		return `Reprinted as ${ptReprinted}`;
	},

	getSourceAndPageHtml (it, {tag, fnUnpackUid} = {}) { return this._getSourceAndPageHtmlOrText(it, {tag, fnUnpackUid}); },
	getSourceAndPageText (it, {tag, fnUnpackUid} = {}) { return this._getSourceAndPageHtmlOrText(it, {isText: true, tag, fnUnpackUid}); },

	_getSourceAndPageHtmlOrText (it, {isText, tag, fnUnpackUid} = {}) {
		const sourceSub = Renderer.utils.getSourceSubText(it);
		const baseText = `${isText ? `` : `<i title="${Parser.sourceJsonToFull(it.source)}${sourceSub}">`}${Parser.sourceJsonToAbv(it.source)}${sourceSub}${isText ? "" : `</i>`}${Renderer.utils.isDisplayPage(it.page) ? `, page ${it.page}` : ""}`;
		const reprintedAsText = Renderer.utils._getReprintedAsHtmlOrText(it, {isText, tag, fnUnpackUid});
		const addSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "additionalSources", "Additional information from", isText);
		const otherSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "otherSources", "Also found in", isText);
		const externalSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "externalSources", "External sources:", isText);

		const srdText = it.srd ? `${isText ? "" : `the <span title="Systems Reference Document">`}SRD${isText ? "" : `</span>`}${typeof it.srd === "string" ? ` (as &quot;${it.srd}&quot;)` : ""}` : "";
		const basicRulesText = it.basicRules ? `the Basic Rules${typeof it.basicRules === "string" ? ` (as &quot;${it.basicRules}&quot;)` : ""}` : "";
		const srdAndBasicRulesText = (srdText || basicRulesText) ? `Available in ${[srdText, basicRulesText].filter(it => it).join(" and ")}` : "";

		return `${[baseText, addSourceText, reprintedAsText, otherSourceText, srdAndBasicRulesText, externalSourceText].filter(it => it).join(". ")}${baseText && (addSourceText || otherSourceText || srdAndBasicRulesText || externalSourceText) ? "." : ""}`;
	},

	async _pHandleNameClick (ele) {
		await MiscUtil.pCopyTextToClipboard($(ele).text());
		JqueryUtil.showCopiedEffect($(ele));
	},

	getPageTr (it, {tag, fnUnpackUid} = {}) {
		return `<tr><td colspan=6>${Renderer.utils.getSourceAndPageTrHtml(it, {tag, fnUnpackUid})}</td></tr>`;
	},

	getAbilityRoller (statblock, ability) {
		if (statblock[ability] == null) return "\u2014";
		return Renderer.get().render(`{@ability ${ability} ${statblock[ability]}}`);
	},

	getEmbeddedDataHeader (name, style, {isCollapsed = false} = {}) {
		return `<table class="rd__b-special rd__b-data ${style ? `rd__b-data--${style}` : ""}">
		<thead><tr><th class="rd__data-embed-header" colspan="6" data-rd-data-embed-header="true"><span class="rd__data-embed-name ${isCollapsed ? "" : `ve-hidden`}">${name}</span><span class="rd__data-embed-toggle">[${isCollapsed ? "+" : "\u2013"}]</span></th></tr></thead><tbody class="${isCollapsed ? `ve-hidden` : ""}" data-rd-embedded-data-render-target="true">`;
	},

	getEmbeddedDataFooter () {
		return `</tbody></table>`;
	},

	TabButton: function ({label, fnChange, fnPopulate, isVisible}) {
		this.label = label;
		this.fnChange = fnChange;
		this.fnPopulate = fnPopulate;
		this.isVisible = isVisible;
	},

	_tabs: {},
	_curTab: null,
	_tabsPreferredLabel: null,
	bindTabButtons ({tabButtons, tabLabelReference, $wrpTabs, $pgContent}) {
		Renderer.utils._tabs = {};
		Renderer.utils._curTab = null;

		$wrpTabs.find(`.stat-tab-gen`).remove();

		tabButtons.forEach((tb, i) => {
			tb.ix = i;

			tb.$t = $(`<button class="ui-tab__btn-tab-head btn btn-default stat-tab-gen">${tb.label}</button>`)
				.click(() => tb.fnActivateTab({isUserInput: true}));

			tb.fnActivateTab = ({isUserInput = false} = {}) => {
				const curTab = Renderer.utils._curTab;
				const tabs = Renderer.utils._tabs;

				if (!curTab || curTab.label !== tb.label) {
					if (curTab) curTab.$t.removeClass(`ui-tab__btn-tab-head--active`);
					Renderer.utils._curTab = tb;
					tb.$t.addClass(`ui-tab__btn-tab-head--active`);
					if (curTab) tabs[curTab.label].$content = $pgContent.children().detach();

					tabs[tb.label] = tb;
					if (!tabs[tb.label].$content && tb.fnPopulate) tb.fnPopulate();
					else $pgContent.append(tabs[tb.label].$content);
					if (tb.fnChange) tb.fnChange();
				}

				// If the user clicked a tab, save it as their chosen tab
				if (isUserInput) Renderer.utils._tabsPreferredLabel = tb.label;
			};
		});

		// Avoid displaying a tab button for single tabs
		if (tabButtons.length !== 1) tabButtons.slice().reverse().forEach(tb => $wrpTabs.prepend(tb.$t));

		// If there was no previous selection, select the first tab
		if (!Renderer.utils._tabsPreferredLabel) return tabButtons[0].fnActivateTab();

		// If the exact tab exist, select it
		const tabButton = tabButtons.find(tb => tb.label === Renderer.utils._tabsPreferredLabel);
		if (tabButton) return tabButton.fnActivateTab();

		// If the user's preferred tab is not present, find the closest tab, and activate it instead.
		// Always prefer later tabs.
		const ixDesired = tabLabelReference.indexOf(Renderer.utils._tabsPreferredLabel);
		if (!~ixDesired) return tabButtons[0].fnActivateTab(); // Should never occur

		const ixsAvailableMetas = tabButtons
			.map(tb => {
				const ixMapped = tabLabelReference.indexOf(tb.label);
				if (!~ixMapped) return null;
				return {
					ixMapped,
					label: tb.label,
				};
			})
			.filter(Boolean);
		if (!ixsAvailableMetas.length) return tabButtons[0].fnActivateTab(); // Should never occur

		// Find a later tab and activate it, if possible
		const ixMetaHigher = ixsAvailableMetas.find(({ixMapped}) => ixMapped > ixDesired);
		if (ixMetaHigher != null) return (tabButtons.find(it => it.label === ixMetaHigher.label) || tabButtons[0]).fnActivateTab();

		// Otherwise, click the highest tab
		const ixMetaMax = ixsAvailableMetas.last();
		(tabButtons.find(it => it.label === ixMetaMax.label) || tabButtons[0]).fnActivateTab();
	},

	_pronounceButtonsBound: false,
	bindPronounceButtons () {
		if (Renderer.utils._pronounceButtonsBound) return;
		Renderer.utils._pronounceButtonsBound = true;
		$(`body`).on("click", ".btn-name-pronounce", function () {
			const audio = $(this).find(`.name-pronounce`)[0];
			audio.currentTime = 0;
			audio.play();
		});
	},

	async pHasFluffText (entity, prop) {
		return entity.hasFluff || ((await Renderer.utils.pGetPredefinedFluff(entity, prop))?.entries?.length || 0) > 0;
	},

	async pHasFluffImages (entity, prop) {
		return entity.hasFluffImages || (((await Renderer.utils.pGetPredefinedFluff(entity, prop))?.images?.length || 0) > 0);
	},

	/**
	 * @param entry Data entry to search for fluff on, e.g. a monster
	 * @param prop The fluff index reference prop, e.g. `"monsterFluff"`
	 */
	async pGetPredefinedFluff (entry, prop) {
		if (!entry.fluff) return null;

		const mappedProp = `_${prop}`;
		const mappedPropAppend = `_append${prop.uppercaseFirst()}`;
		const fluff = {};

		const assignPropsIfExist = (fromObj, ...props) => {
			props.forEach(prop => {
				if (fromObj[prop]) fluff[prop] = fromObj[prop];
			});
		};

		assignPropsIfExist(entry.fluff, "name", "type", "entries", "images");

		if (entry.fluff[mappedProp]) {
			const fromList = [
				...((await PrereleaseUtil.pGetBrewProcessed())[prop] || []),
				...((await BrewUtil2.pGetBrewProcessed())[prop] || []),
			]
				.find(it =>
					it.name === entry.fluff[mappedProp].name
					&& it.source === entry.fluff[mappedProp].source,
				);
			if (fromList) {
				assignPropsIfExist(fromList, "name", "type", "entries", "images");
			}
		}

		if (entry.fluff[mappedPropAppend]) {
			const fromList = [
				...((await PrereleaseUtil.pGetBrewProcessed())[prop] || []),
				...((await BrewUtil2.pGetBrewProcessed())[prop] || []),
			]
				.find(it =>
					it.name === entry.fluff[mappedPropAppend].name
					&& it.source === entry.fluff[mappedPropAppend].source,
				);
			if (fromList) {
				if (fromList.entries) {
					fluff.entries = MiscUtil.copyFast(fluff.entries || []);
					fluff.entries.push(...MiscUtil.copyFast(fromList.entries));
				}
				if (fromList.images) {
					fluff.images = MiscUtil.copyFast(fluff.images || []);
					fluff.images.push(...MiscUtil.copyFast(fromList.images));
				}
			}
		}

		return fluff;
	},

	async pGetFluff ({entity, pFnPostProcess, fnGetFluffData, fluffUrl, fluffBaseUrl, fluffProp} = {}) {
		let predefinedFluff = await Renderer.utils.pGetPredefinedFluff(entity, fluffProp);
		if (predefinedFluff) {
			if (pFnPostProcess) predefinedFluff = await pFnPostProcess(predefinedFluff);
			return predefinedFluff;
		}
		if (!fnGetFluffData && !fluffBaseUrl && !fluffUrl) return null;

		const fluffIndex = fluffBaseUrl ? await DataUtil.loadJSON(`${Renderer.get().baseUrl}${fluffBaseUrl}fluff-index.json`) : null;
		if (fluffIndex && !fluffIndex[entity.source]) return null;

		const data = fnGetFluffData ? await fnGetFluffData() : fluffIndex && fluffIndex[entity.source]
			? await DataUtil.loadJSON(`${Renderer.get().baseUrl}${fluffBaseUrl}${fluffIndex[entity.source]}`)
			: await DataUtil.loadJSON(`${Renderer.get().baseUrl}${fluffUrl}`);
		if (!data) return null;

		let fluff = (data[fluffProp] || []).find(it => it.name === entity.name && it.source === entity.source);
		if (!fluff && entity._versionBase_name && entity._versionBase_source) fluff = (data[fluffProp] || []).find(it => it.name === entity._versionBase_name && it.source === entity._versionBase_source);
		if (!fluff) return null;

		// Avoid modifying the original object
		if (pFnPostProcess) fluff = await pFnPostProcess(fluff);
		return fluff;
	},

	_TITLE_SKIP_TYPES: new Set(["entries", "section"]),
	/**
	 * @param isImageTab True if this is the "Images" tab, false otherwise
	 * @param $content The statblock wrapper
	 * @param entity Entity to build tab for (e.g. a monster; an item)
	 * @param pFnGetFluff Function which gets the entity's fluff.
	 * @param $headerControls
	 */
	async pBuildFluffTab ({isImageTab, $content, entity, $headerControls, pFnGetFluff} = {}) {
		$content.append(Renderer.utils.getBorderTr());
		$content.append(Renderer.utils.getNameTr(entity, {controlRhs: $headerControls, asJquery: true}));
		const $td = $(`<td colspan="6" class="text"></td>`);
		$$`<tr class="text">${$td}</tr>`.appendTo($content);
		$content.append(Renderer.utils.getBorderTr());

		const fluff = MiscUtil.copyFast((await pFnGetFluff(entity)) || {});
		fluff.entries = fluff.entries || [Renderer.utils.HTML_NO_INFO];
		fluff.images = fluff.images || [Renderer.utils.HTML_NO_IMAGES];

		$td.fastSetHtml(Renderer.utils.getFluffTabContent({entity, fluff, isImageTab}));
	},

	getFluffTabContent ({entity, fluff, isImageTab = false}) {
		Renderer.get().setFirstSection(true);
		return (fluff[isImageTab ? "images" : "entries"] || []).map((ent, i) => {
			if (isImageTab) return Renderer.get().render(ent);

			// If the first entry has a name, and it matches the name of the statblock, remove it to avoid having two
			//   of the same title stacked on top of each other.
			if (i === 0 && ent.name && entity.name && (Renderer.utils._TITLE_SKIP_TYPES).has(ent.type)) {
				const entryLowName = ent.name.toLowerCase().trim();
				const entityLowName = entity.name.toLowerCase().trim();

				if (entryLowName.includes(entityLowName) || entityLowName.includes(entryLowName)) {
					const cpy = MiscUtil.copyFast(ent);
					delete cpy.name;
					return Renderer.get().render(cpy);
				} else return Renderer.get().render(ent);
			} else {
				if (typeof ent === "string") return `<p>${Renderer.get().render(ent)}</p>`;
				else return Renderer.get().render(ent);
			}
		}).join("");
	},

	HTML_NO_INFO: "<i>No information available.</i>",
	HTML_NO_IMAGES: "<i>No images available.</i>",

	prerequisite: class {
		static _WEIGHTS = [
			"level",
			"pact",
			"patron",
			"spell",
			"race",
			"alignment",
			"ability",
			"proficiency",
			"spellcasting",
			"spellcasting2020",
			"psionics",
			"feature",
			"feat",
			"background",
			"item",
			"itemType",
			"itemProperty",
			"campaign",
			"group",
			"other",
			"otherSummary",
			undefined,
		]
			.mergeMap((k, i) => ({[k]: i}));

		static _getShortClassName (className) {
			// remove all the vowels except the first
			const ixFirstVowel = /[aeiou]/.exec(className).index;
			const start = className.slice(0, ixFirstVowel + 1);
			let end = className.slice(ixFirstVowel + 1);
			end = end.replace(/[aeiou]/g, "");
			return `${start}${end}`.toTitleCase();
		}

		static getHtml (prerequisites, {isListMode = false, blocklistKeys = new Set(), isTextOnly = false, isSkipPrefix = false} = {}) {
			if (!prerequisites?.length) return isListMode ? "\u2014" : "";

			const prereqsShared = prerequisites.length === 1
				? {}
				: Object.entries(
					prerequisites
						.slice(1)
						.reduce((a, b) => CollectionUtil.objectIntersect(a, b), prerequisites[0]),
				)
					.filter(([k, v]) => prerequisites.every(pre => CollectionUtil.deepEquals(pre[k], v)))
					.mergeMap(([k, v]) => ({[k]: v}));

			const shared = Object.keys(prereqsShared).length
				? this.getHtml([prereqsShared], {isListMode, blocklistKeys, isTextOnly, isSkipPrefix: true})
				: null;

			let cntPrerequisites = 0;
			let hasNote = false;
			const listOfChoices = prerequisites
				.map(pr => {
					// Never include notes in list mode
					const ptNote = !isListMode && pr.note ? Renderer.get().render(pr.note) : null;
					if (ptNote) {
						hasNote = true;
					}

					const prereqsToJoin = Object.entries(pr)
						.filter(([k]) => !prereqsShared[k])
						.sort(([kA], [kB]) => this._WEIGHTS[kA] - this._WEIGHTS[kB])
						.map(([k, v]) => {
							if (k === "note" || blocklistKeys.has(k)) return false;

							cntPrerequisites += 1;

							switch (k) {
								case "level": return this._getHtml_level({v, isListMode, isTextOnly});
								case "pact": return this._getHtml_pact({v, isListMode, isTextOnly});
								case "patron": return this._getHtml_patron({v, isListMode, isTextOnly});
								case "spell": return this._getHtml_spell({v, isListMode, isTextOnly});
								case "feat": return this._getHtml_feat({v, isListMode, isTextOnly});
								case "feature": return this._getHtml_feature({v, isListMode, isTextOnly});
								case "item": return this._getHtml_item({v, isListMode, isTextOnly});
								case "itemType": return this._getHtml_itemType({v, isListMode, isTextOnly});
								case "itemProperty": return this._getHtml_itemProperty({v, isListMode, isTextOnly});
								case "otherSummary": return this._getHtml_otherSummary({v, isListMode, isTextOnly});
								case "other": return this._getHtml_other({v, isListMode, isTextOnly});
								case "race": return this._getHtml_race({v, isListMode, isTextOnly});
								case "background": return this._getHtml_background({v, isListMode, isTextOnly});
								case "ability": return this._getHtml_ability({v, isListMode, isTextOnly});
								case "proficiency": return this._getHtml_proficiency({v, isListMode, isTextOnly});
								case "spellcasting": return this._getHtml_spellcasting({v, isListMode, isTextOnly});
								case "spellcasting2020": return this._getHtml_spellcasting2020({v, isListMode, isTextOnly});
								case "psionics": return this._getHtml_psionics({v, isListMode, isTextOnly});
								case "alignment": return this._getHtml_alignment({v, isListMode, isTextOnly});
								case "campaign": return this._getHtml_campaign({v, isListMode, isTextOnly});
								case "group": return this._getHtml_group({v, isListMode, isTextOnly});
								default: throw new Error(`Unhandled key: ${k}`);
							}
						})
						.filter(Boolean);

					const ptPrereqs = prereqsToJoin
						.join(prereqsToJoin.some(it => / or /.test(it)) ? "; " : ", ");

					return [ptPrereqs, ptNote]
						.filter(Boolean)
						.join(". ");
				})
				.filter(Boolean);

			if (!listOfChoices.length && !shared) return isListMode ? "\u2014" : "";
			if (isListMode) return [shared, listOfChoices.join("/")].filter(Boolean).join(" + ");

			const sharedSuffix = MiscUtil.findCommonSuffix(listOfChoices, {isRespectWordBoundaries: true});
			const listOfChoicesTrimmed = sharedSuffix
				? listOfChoices.map(it => it.slice(0, -sharedSuffix.length))
				: listOfChoices;

			const joinedChoices = (
				hasNote
					? listOfChoicesTrimmed.join(" Or, ")
					: listOfChoicesTrimmed.joinConjunct(listOfChoicesTrimmed.some(it => / or /.test(it)) ? "; " : ", ", " or ")
			) + sharedSuffix;
			return `${isSkipPrefix ? "" : `<b>Prerequisite${cntPrerequisites === 1 ? "" : "s"}:</b> `}${[shared, joinedChoices].filter(Boolean).join(", plus ")}`;
		}

		static _getHtml_level ({v, isListMode}) {
			// a generic level requirement
			if (typeof v === "number") {
				if (isListMode) return `Lvl ${v}`;
				else return `${Parser.getOrdinalForm(v)} level`;
			} else if (!v.class && !v.subclass) {
				if (isListMode) return `Lvl ${v.level}`;
				else return `${Parser.getOrdinalForm(v.level)} level`;
			}

			const isLevelVisible = v.level !== 1; // Hide the "implicit" 1st level.
			const isSubclassVisible = v.subclass && v.subclass.visible;
			const isClassVisible = v.class && (v.class.visible || isSubclassVisible); // force the class name to be displayed if there's a subclass being displayed
			if (isListMode) {
				const shortNameRaw = isClassVisible ? this._getShortClassName(v.class.name) : null;
				return `${isClassVisible ? `${shortNameRaw.slice(0, 4)}${isSubclassVisible ? "*" : "."}` : ""}${isLevelVisible ? ` Lvl ${v.level}` : ""}`;
			} else {
				let classPart = "";
				if (isClassVisible && isSubclassVisible) classPart = ` ${v.class.name} (${v.subclass.name})`;
				else if (isClassVisible) classPart = ` ${v.class.name}`;
				else if (isSubclassVisible) classPart = ` &lt;remember to insert class name here&gt; (${v.subclass.name})`; // :^)
				return `${isLevelVisible ? `${Parser.getOrdinalForm(v.level)} level` : ""}${isClassVisible ? ` ${classPart}` : ""}`;
			}
		}

		static _getHtml_pact ({v, isListMode}) {
			return Parser.prereqPactToFull(v);
		}

		static _getHtml_patron ({v, isListMode}) {
			return isListMode ? `${Parser.prereqPatronToShort(v)} patron` : `${v} patron`;
		}

		static _getHtml_spell ({v, isListMode, isTextOnly}) {
			return isListMode
				? v.map(x => x.split("#")[0].split("|")[0].toTitleCase()).join("/")
				: v.map(sp => Parser.prereqSpellToFull(sp, {isTextOnly})).joinConjunct(", ", " or ");
		}

		static _getHtml_feat ({v, isListMode, isTextOnly}) {
			return isListMode
				? v.map(x => x.split("|")[0].toTitleCase()).join("/")
				: v.map(it => (isTextOnly ? Renderer.stripTags.bind(Renderer) : Renderer.get().render.bind(Renderer.get()))(`{@feat ${it}} feat`)).joinConjunct(", ", " or ");
		}

		static _getHtml_feature ({v, isListMode, isTextOnly}) {
			return isListMode
				? v.map(x => Renderer.stripTags(x).toTitleCase()).join("/")
				: v.map(it => isTextOnly ? Renderer.stripTags(it) : Renderer.get().render(it)).joinConjunct(", ", " or ");
		}

		static _getHtml_item ({v, isListMode}) {
			return isListMode ? v.map(x => x.toTitleCase()).join("/") : v.joinConjunct(", ", " or ");
		}

		static _getHtml_itemType ({v, isListMode}) {
			return isListMode
				? v
					.map(it => Renderer.item.getType(it))
					.map(it => it?.abbreviation)
					.join("+")
				: v
					.map(it => Renderer.item.getType(it))
					.map(it => it?.name?.toTitleCase())
					.joinConjunct(", ", " and ");
		}

		static _getHtml_itemProperty ({v, isListMode}) {
			if (v == null) return isListMode ? "No Prop." : "No Other Properties";

			return isListMode
				? v
					.map(it => Renderer.item.getProperty(it))
					.map(it => it?.abbreviation)
					.join("+")
				: (
					`${v
						.map(it => Renderer.item.getProperty(it))
						.map(it => it?.name?.toTitleCase())
						.joinConjunct(", ", " and ")
					} Property`
				);
		}

		static _getHtml_otherSummary ({v, isListMode, isTextOnly}) {
			return isListMode
				? (v.entrySummary || Renderer.stripTags(v.entry))
				: (isTextOnly ? Renderer.stripTags(v.entry) : Renderer.get().render(v.entry));
		}

		static _getHtml_other ({v, isListMode, isTextOnly}) {
			return isListMode ? "Special" : (isTextOnly ? Renderer.stripTags(v) : Renderer.get().render(v));
		}

		static _getHtml_race ({v, isListMode, isTextOnly}) {
			const parts = v.map((it, i) => {
				if (isListMode) {
					return `${it.name.toTitleCase()}${it.subrace != null ? ` (${it.subrace})` : ""}`;
				} else {
					const raceName = it.displayEntry ? (isTextOnly ? Renderer.stripTags(it.displayEntry) : Renderer.get().render(it.displayEntry)) : i === 0 ? it.name.toTitleCase() : it.name;
					return `${raceName}${it.subrace != null ? ` (${it.subrace})` : ""}`;
				}
			});
			return isListMode ? parts.join("/") : parts.joinConjunct(", ", " or ");
		}

		static _getHtml_background ({v, isListMode, isTextOnly}) {
			const parts = v.map((it, i) => {
				if (isListMode) {
					return `${it.name.toTitleCase()}`;
				} else {
					return it.displayEntry ? (isTextOnly ? Renderer.stripTags(it.displayEntry) : Renderer.get().render(it.displayEntry)) : i === 0 ? it.name.toTitleCase() : it.name;
				}
			});
			return isListMode ? parts.join("/") : parts.joinConjunct(", ", " or ");
		}

		static _getHtml_ability ({v, isListMode, isTextOnly}) {
			// `v` is an array or objects with str/dex/... properties; array is "OR"'d togther, object is "AND"'d together

			let hadMultipleInner = false;
			let hadMultiMultipleInner = false;
			let allValuesEqual = null;

			outer: for (const abMeta of v) {
				for (const req of Object.values(abMeta)) {
					if (allValuesEqual == null) allValuesEqual = req;
					else {
						if (req !== allValuesEqual) {
							allValuesEqual = null;
							break outer;
						}
					}
				}
			}

			const abilityOptions = v.map(abMeta => {
				if (allValuesEqual) {
					const abList = Object.keys(abMeta);
					hadMultipleInner = hadMultipleInner || abList.length > 1;
					return isListMode ? abList.map(ab => ab.uppercaseFirst()).join(", ") : abList.map(ab => Parser.attAbvToFull(ab)).joinConjunct(", ", " and ");
				} else {
					const groups = {};

					Object.entries(abMeta).forEach(([ab, req]) => {
						(groups[req] = groups[req] || []).push(ab);
					});

					let isMulti = false;
					const byScore = Object.entries(groups)
						.sort(([reqA], [reqB]) => SortUtil.ascSort(Number(reqB), Number(reqA)))
						.map(([req, abs]) => {
							hadMultipleInner = hadMultipleInner || abs.length > 1;
							if (abs.length > 1) hadMultiMultipleInner = isMulti = true;

							abs = abs.sort(SortUtil.ascSortAtts);
							return isListMode
								? `${abs.map(ab => ab.uppercaseFirst()).join(", ")} ${req}+`
								: `${abs.map(ab => Parser.attAbvToFull(ab)).joinConjunct(", ", " and ")} ${req} or higher`;
						});

					return isListMode
						? `${isMulti || byScore.length > 1 ? "(" : ""}${byScore.join(" & ")}${isMulti || byScore.length > 1 ? ")" : ""}`
						: isMulti ? byScore.joinConjunct("; ", " and ") : byScore.joinConjunct(", ", " and ");
				}
			});

			// if all values were equal, add the "X+" text at the end, as the options render doesn't include it
			if (isListMode) {
				return `${abilityOptions.join("/")}${allValuesEqual != null ? ` ${allValuesEqual}+` : ""}`;
			} else {
				const isComplex = hadMultiMultipleInner || hadMultipleInner || allValuesEqual == null;
				const joined = abilityOptions.joinConjunct(
					hadMultiMultipleInner ? " - " : hadMultipleInner ? "; " : ", ",
					isComplex ? (isTextOnly ? ` /or/ ` : ` <i>or</i> `) : " or ",
				);
				return `${joined}${allValuesEqual != null ? ` ${allValuesEqual} or higher` : ""}`;
			}
		}

		static _getHtml_proficiency ({v, isListMode}) {
			const parts = v.map(obj => {
				return Object.entries(obj).map(([profType, prof]) => {
					switch (profType) {
						case "armor": {
							return isListMode ? `Prof ${Parser.armorFullToAbv(prof)} armor` : `Proficiency with ${prof} armor`;
						}
						case "weapon": {
							return isListMode ? `Prof ${Parser.weaponFullToAbv(prof)} weapon` : `Proficiency with a ${prof} weapon`;
						}
						default: throw new Error(`Unhandled proficiency type: "${profType}"`);
					}
				});
			});
			return isListMode ? parts.join("/") : parts.joinConjunct(", ", " or ");
		}

		static _getHtml_spellcasting ({v, isListMode}) {
			return isListMode ? "Spellcasting" : "The ability to cast at least one spell";
		}

		static _getHtml_spellcasting2020 ({v, isListMode}) {
			return isListMode ? "Spellcasting" : "Spellcasting or Pact Magic feature";
		}

		static _getHtml_psionics ({v, isListMode, isTextOnly}) {
			return isListMode
				? "Psionics"
				: (isTextOnly ? Renderer.stripTags : Renderer.get().render.bind(Renderer.get()))("Psionic Talent feature or {@feat Wild Talent|UA2020PsionicOptionsRevisited} feat");
		}

		static _getHtml_alignment ({v, isListMode}) {
			return isListMode
				? Parser.alignmentListToFull(v)
					.replace(/\bany\b/gi, "").trim()
					.replace(/\balignment\b/gi, "align").trim()
					.toTitleCase()
				: Parser.alignmentListToFull(v);
		}

		static _getHtml_campaign ({v, isListMode}) {
			return isListMode
				? v.join("/")
				: `${v.joinConjunct(", ", " or ")} Campaign`;
		}

		static _getHtml_group ({v, isListMode}) {
			return isListMode
				? v.map(it => it.toTitleCase()).join("/")
				: `${v.map(it => it.toTitleCase()).joinConjunct(", ", " or ")} Group`;
		}
	},

	getRepeatableHtml (ent, {isListMode = false} = {}) {
		if (ent.repeatable == null) return isListMode ? "\u2014" : "";
		return `${isListMode ? "" : "<b>"}Repeatable:${isListMode ? "" : "</b>"} ${ent.repeatableNote || (ent.repeatable ? "Yes" : "No")}`;
	},

	getRenderedSize (size) {
		return [...(size ? [size].flat() : [])]
			.sort(SortUtil.ascSortSize)
			.map(sz => Parser.sizeAbvToFull(sz))
			.joinConjunct(", ", " or ");
	},

	getMediaUrl (entry, prop, mediaDir) {
		if (!entry[prop]) return "";

		let href = "";
		if (entry[prop].type === "internal") {
			const baseUrl = Renderer.get().baseMediaUrls[mediaDir] || Renderer.get().baseUrl;
			const mediaPart = `${mediaDir}/${entry[prop].path}`;
			href = baseUrl !== "" ? `${baseUrl}${mediaPart}` : UrlUtil.link(mediaPart);
		} else if (entry[prop].type === "external") {
			href = entry[prop].url;
		}
		return href;
	},

	getTagEntry (tag, text) {
		switch (tag) {
			case "@dice":
			case "@autodice":
			case "@damage":
			case "@hit":
			case "@d20":
			case "@chance":
			case "@recharge": {
				const fauxEntry = {
					type: "dice",
					rollable: true,
				};
				const [rollText, displayText, name, ...others] = Renderer.splitTagByPipe(text);
				if (displayText) fauxEntry.displayText = displayText;

				if ((!fauxEntry.displayText && (rollText || "").includes("summonSpellLevel")) || (fauxEntry.displayText && fauxEntry.displayText.includes("summonSpellLevel"))) fauxEntry.displayText = (fauxEntry.displayText || rollText || "").replace(/summonSpellLevel/g, "the spell's level");

				if ((!fauxEntry.displayText && (rollText || "").includes("summonClassLevel")) || (fauxEntry.displayText && fauxEntry.displayText.includes("summonClassLevel"))) fauxEntry.displayText = (fauxEntry.displayText || rollText || "").replace(/summonClassLevel/g, "your class level");

				if (name) fauxEntry.name = name;

				switch (tag) {
					case "@dice":
					case "@autodice":
					case "@damage": {
						// format: {@dice 1d2 + 3 + 4d5 - 6}
						fauxEntry.toRoll = rollText;

						if (!fauxEntry.displayText && (rollText || "").includes(";")) fauxEntry.displayText = rollText.replace(/;/g, "/");
						if ((!fauxEntry.displayText && (rollText || "").includes("#$")) || (fauxEntry.displayText && fauxEntry.displayText.includes("#$"))) fauxEntry.displayText = (fauxEntry.displayText || rollText).replace(/#\$prompt_number[^$]*\$#/g, "(n)");
						fauxEntry.displayText = fauxEntry.displayText || fauxEntry.toRoll;

						if (tag === "@damage") fauxEntry.subType = "damage";
						if (tag === "@autodice") fauxEntry.autoRoll = true;

						return fauxEntry;
					}
					case "@d20":
					case "@hit": {
						// format: {@hit +1} or {@hit -2}
						let mod;
						if (!isNaN(rollText)) {
							const n = Number(rollText);
							mod = `${n >= 0 ? "+" : ""}${n}`;
						} else mod = /^\s+[-+]/.test(rollText) ? rollText : `+${rollText}`;
						fauxEntry.displayText = fauxEntry.displayText || mod;
						fauxEntry.toRoll = `1d20${mod}`;
						fauxEntry.subType = "d20";
						fauxEntry.d20mod = mod;
						if (tag === "@hit") fauxEntry.context = {type: "hit"};
						return fauxEntry;
					}
					case "@chance": {
						// format: {@chance 25|display text|rollbox rollee name|success text|failure text}
						const [textSuccess, textFailure] = others;
						fauxEntry.toRoll = `1d100`;
						fauxEntry.successThresh = Number(rollText);
						fauxEntry.chanceSuccessText = textSuccess;
						fauxEntry.chanceFailureText = textFailure;
						return fauxEntry;
					}
					case "@recharge": {
						// format: {@recharge 4|flags}
						const flags = displayText ? displayText.split("") : null; // "m" for "minimal" = no brackets
						fauxEntry.toRoll = "1d6";
						const asNum = Number(rollText || 6);
						fauxEntry.successThresh = 7 - asNum;
						fauxEntry.successMax = 6;
						fauxEntry.displayText = `${asNum}${asNum < 6 ? `\u20136` : ""}`;
						fauxEntry.chanceSuccessText = "Recharged!";
						fauxEntry.chanceFailureText = "Did not recharge";
						fauxEntry.isColorSuccessFail = true;
						return fauxEntry;
					}
				}

				return fauxEntry;
			}

			case "@ability": // format: {@ability str 20} or {@ability str 20|Display Text} or {@ability str 20|Display Text|Roll Name Text}
			case "@savingThrow": { // format: {@savingThrow str 5} or {@savingThrow str 5|Display Text} or {@savingThrow str 5|Display Text|Roll Name Text}
				const fauxEntry = {
					type: "dice",
					rollable: true,
					subType: "d20",
					context: {type: tag === "@ability" ? "abilityCheck" : "savingThrow"},
				};

				const [abilAndScoreOrScore, displayText, name, ...others] = Renderer.splitTagByPipe(text);

				let [abil, ...rawScoreOrModParts] = abilAndScoreOrScore.split(" ").map(it => it.trim()).filter(Boolean);
				abil = abil.toLowerCase();

				fauxEntry.context.ability = abil;

				if (name) fauxEntry.name = name;
				else {
					if (tag === "@ability") fauxEntry.name = Parser.attAbvToFull(abil);
					else if (tag === "@savingThrow") fauxEntry.name = `${Parser.attAbvToFull(abil)} save`;
				}

				const rawScoreOrMod = rawScoreOrModParts.join(" ");
				// Saving throws can have e.g. `+ PB`
				if (isNaN(rawScoreOrMod) && tag === "@savingThrow") {
					if (displayText) fauxEntry.displayText = displayText;
					else fauxEntry.displayText = rawScoreOrMod;

					fauxEntry.toRoll = `1d20${rawScoreOrMod}`;
					fauxEntry.d20mod = rawScoreOrMod;
				} else {
					const scoreOrMod = Number(rawScoreOrMod) || 0;
					const mod = (tag === "@ability" ? Parser.getAbilityModifier : UiUtil.intToBonus)(scoreOrMod);

					if (displayText) fauxEntry.displayText = displayText;
					else {
						if (tag === "@ability") fauxEntry.displayText = `${scoreOrMod} (${mod})`;
						else fauxEntry.displayText = mod;
					}

					fauxEntry.toRoll = `1d20${mod}`;
					fauxEntry.d20mod = mod;
				}

				return fauxEntry;
			}

			// format: {@skillCheck animal_handling 5} or {@skillCheck animal_handling 5|Display Text}
			//   or {@skillCheck animal_handling 5|Display Text|Roll Name Text}
			case "@skillCheck": {
				const fauxEntry = {
					type: "dice",
					rollable: true,
					subType: "d20",
					context: {type: "skillCheck"},
				};

				const [skillAndMod, displayText, name, ...others] = Renderer.splitTagByPipe(text);

				const parts = skillAndMod.split(" ").map(it => it.trim()).filter(Boolean);
				const namePart = parts.shift();
				const bonusPart = parts.join(" ");
				const skill = namePart.replace(/_/g, " ");

				let mod = bonusPart;
				if (!isNaN(bonusPart)) mod = UiUtil.intToBonus(Number(bonusPart) || 0);
				else if (bonusPart.startsWith("#$")) mod = `+${bonusPart}`;

				fauxEntry.context.skill = skill;
				fauxEntry.displayText = displayText || mod;

				if (name) fauxEntry.name = name;
				else fauxEntry.name = skill.toTitleCase();

				fauxEntry.toRoll = `1d20${mod}`;
				fauxEntry.d20mod = mod;

				return fauxEntry;
			}

			// format: {@coinflip} or {@coinflip display text|rollbox rollee name|success text|failure text}
			case "@coinflip": {
				const [displayText, name, textSuccess, textFailure] = Renderer.splitTagByPipe(text);

				const fauxEntry = {
					type: "dice",
					toRoll: "1d2",
					successThresh: 1,
					successMax: 2,
					displayText: displayText || "flip a coin",
					chanceSuccessText: textSuccess || `Heads`,
					chanceFailureText: textFailure || `Tails`,
					isColorSuccessFail: !textSuccess && !textFailure,
					rollable: true,
				};

				return fauxEntry;
			}

			default: throw new Error(`Unhandled tag "${tag}"`);
		}
	},

	getTagMeta (tag, text) {
		switch (tag) {
			case "@deity": {
				let [name, pantheon, source, displayText, ...others] = Renderer.splitTagByPipe(text);
				pantheon = pantheon || "forgotten realms";
				source = source || Parser.getTagSource(tag, source);
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_DEITIES]({name, pantheon, source});

				return {
					name,
					displayText,
					others,

					page: UrlUtil.PG_DEITIES,
					source,
					hash,

					hashPreEncoded: true,
				};
			}

			case "@card": {
				const unpacked = DataUtil.deck.unpackUidCard(text);
				const {name, set, source, displayText} = unpacked;
				const hash = UrlUtil.URL_TO_HASH_BUILDER["card"]({name, set, source});

				return {
					name,
					displayText,

					isFauxPage: true,
					page: "card",
					source,
					hash,
					hashPreEncoded: true,
				};
			}

			case "@classFeature": {
				const unpacked = DataUtil.class.unpackUidClassFeature(text);

				const classPageHash = `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: unpacked.className, source: unpacked.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({feature: {ixLevel: unpacked.level - 1, ixFeature: 0}})}`;

				return {
					name: unpacked.name,
					displayText: unpacked.displayText,

					page: UrlUtil.PG_CLASSES,
					source: unpacked.source,
					hash: classPageHash,
					hashPreEncoded: true,

					pageHover: "classfeature",
					hashHover: UrlUtil.URL_TO_HASH_BUILDER["classFeature"](unpacked),
					hashPreEncodedHover: true,
				};
			}

			case "@subclassFeature": {
				const unpacked = DataUtil.class.unpackUidSubclassFeature(text);

				const classPageHash = `${UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: unpacked.className, source: unpacked.classSource})}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({feature: {ixLevel: unpacked.level - 1, ixFeature: 0}})}`;

				return {
					name: unpacked.name,
					displayText: unpacked.displayText,

					page: UrlUtil.PG_CLASSES,
					source: unpacked.source,
					hash: classPageHash,
					hashPreEncoded: true,

					pageHover: "subclassfeature",
					hashHover: UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"](unpacked),
					hashPreEncodedHover: true,
				};
			}

			case "@quickref": {
				const unpacked = DataUtil.quickreference.unpackUid(text);

				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_QUICKREF](unpacked);

				return {
					name: unpacked.name,
					displayText: unpacked.displayText,

					page: UrlUtil.PG_QUICKREF,
					source: unpacked.source,
					hash,
					hashPreEncoded: true,
				};
			}

			default: return Renderer.utils._getTagMeta_generic(tag, text);
		}
	},

	_getTagMeta_generic (tag, text) {
		const {name, source, displayText, others} = DataUtil.generic.unpackUid(text, tag);
		const hash = UrlUtil.encodeForHash([name, source]);

		const out = {
			name,
			displayText,
			others,

			page: null,
			source,
			hash,

			preloadId: null,
			subhashes: null,
			linkText: null,

			hashPreEncoded: true,
		};

		switch (tag) {
			case "@spell": out.page = UrlUtil.PG_SPELLS; break;
			case "@item": out.page = UrlUtil.PG_ITEMS; break;
			case "@condition":
			case "@disease":
			case "@status": out.page = UrlUtil.PG_CONDITIONS_DISEASES; break;
			case "@background": out.page = UrlUtil.PG_BACKGROUNDS; break;
			case "@race": out.page = UrlUtil.PG_RACES; break;
			case "@optfeature": out.page = UrlUtil.PG_OPT_FEATURES; break;
			case "@reward": out.page = UrlUtil.PG_REWARDS; break;
			case "@feat": out.page = UrlUtil.PG_FEATS; break;
			case "@psionic": out.page = UrlUtil.PG_PSIONICS; break;
			case "@object": out.page = UrlUtil.PG_OBJECTS; break;
			case "@boon":
			case "@cult": out.page = UrlUtil.PG_CULTS_BOONS; break;
			case "@trap":
			case "@hazard": out.page = UrlUtil.PG_TRAPS_HAZARDS; break;
			case "@variantrule": out.page = UrlUtil.PG_VARIANTRULES; break;
			case "@table": out.page = UrlUtil.PG_TABLES; break;
			case "@vehicle":
			case "@vehupgrade": out.page = UrlUtil.PG_VEHICLES; break;
			case "@action": out.page = UrlUtil.PG_ACTIONS; break;
			case "@language": out.page = UrlUtil.PG_LANGUAGES; break;
			case "@charoption": out.page = UrlUtil.PG_CHAR_CREATION_OPTIONS; break;
			case "@recipe": out.page = UrlUtil.PG_RECIPES; break;
			case "@deck": out.page = UrlUtil.PG_DECKS; break;

			case "@legroup": {
				out.page = "legendaryGroup";
				out.isFauxPage = true;
				break;
			}

			case "@creature": {
				out.page = UrlUtil.PG_BESTIARY;

				// "...|scaled=scaledCr}" or "...|scaledsummon=scaledSummonLevel}"
				if (others.length) {
					const [type, value] = others[0].split("=").map(it => it.trim().toLowerCase()).filter(Boolean);
					if (type && value) {
						switch (type) {
							case VeCt.HASH_SCALED: {
								const targetCrNum = Parser.crToNumber(value);
								out.preloadId = Renderer.monster.getCustomHashId({name, source, _isScaledCr: true, _scaledCr: targetCrNum});
								out.subhashes = [
									{key: VeCt.HASH_SCALED, value: targetCrNum},
								];
								out.linkText = displayText || `${name} (CR ${value})`;
								break;
							}

							case VeCt.HASH_SCALED_SPELL_SUMMON: {
								const scaledSpellNum = Number(value);
								out.preloadId = Renderer.monster.getCustomHashId({name, source, _isScaledSpellSummon: true, _scaledSpellSummonLevel: scaledSpellNum});
								out.subhashes = [
									{key: VeCt.HASH_SCALED_SPELL_SUMMON, value: scaledSpellNum},
								];
								out.linkText = displayText || `${name} (Spell Level ${value})`;
								break;
							}

							case VeCt.HASH_SCALED_CLASS_SUMMON: {
								const scaledClassNum = Number(value);
								out.preloadId = Renderer.monster.getCustomHashId({name, source, _isScaledClassSummon: true, _scaledClassSummonLevel: scaledClassNum});
								out.subhashes = [
									{key: VeCt.HASH_SCALED_CLASS_SUMMON, value: scaledClassNum},
								];
								out.linkText = displayText || `${name} (Class Level ${value})`;
								break;
							}
						}
					}
				}

				break;
			}

			case "@class": {
				out.page = UrlUtil.PG_CLASSES;

				if (others.length) {
					const [subclassShortName, subclassSource, featurePart] = others;

					if (subclassSource) out.source = subclassSource;

					const classStateOpts = {
						subclass: {
							shortName: subclassShortName.trim(),
							source: subclassSource
								? subclassSource.trim()
								: Parser.SRC_PHB,
						},
					};

					// Don't include the feature part for hovers, as it is unsupported
					const hoverSubhashObj = UrlUtil.unpackSubHash(UrlUtil.getClassesPageStatePart(classStateOpts));
					out.subhashesHover = [{key: "state", value: hoverSubhashObj.state, preEncoded: true}];

					if (featurePart) {
						const featureParts = featurePart.trim().split("-");
						classStateOpts.feature = {
							ixLevel: featureParts[0] || "0",
							ixFeature: featureParts[1] || "0",
						};
					}

					const subhashObj = UrlUtil.unpackSubHash(UrlUtil.getClassesPageStatePart(classStateOpts));

					out.subhashes = [
						{key: "state", value: subhashObj.state.join(HASH_SUB_LIST_SEP), preEncoded: true},
						{key: "fltsource", value: "clear"},
						{key: "flstmiscellaneous", value: "clear"},
					];
				}

				break;
			}

			case "@skill": { out.isFauxPage = true; out.page = "skill"; break; }
			case "@sense": { out.isFauxPage = true; out.page = "sense"; break; }
			case "@itemMastery": { out.isFauxPage = true; out.page = "itemMastery"; break; }

			default: throw new Error(`Unhandled tag "${tag}"`);
		}

		return out;
	},

	// region Templating
	applyTemplate (ent, templateString, {fnPreApply, mapCustom} = {}) {
		return templateString.replace(/{{([^}]+)}}/g, (fullMatch, strArgs) => {
			if (fnPreApply) fnPreApply(fullMatch, strArgs);

			// Special case for damage dice -- need to add @damage tags
			if (strArgs === "item.dmg1") {
				return Renderer.item._getTaggedDamage(ent.dmg1);
			} else if (strArgs === "item.dmg2") {
				return Renderer.item._getTaggedDamage(ent.dmg2);
			}

			if (mapCustom && mapCustom[strArgs]) return mapCustom[strArgs];

			const args = strArgs.split(" ").map(arg => arg.trim()).filter(Boolean);

			// Args can either be a static property, or a function and a static property

			if (args.length === 1) {
				return Renderer.utils._applyTemplate_getValue(ent, args[0]);
			} else if (args.length === 2) {
				const val = Renderer.utils._applyTemplate_getValue(ent, args[1]);
				switch (args[0]) {
					case "getFullImmRes": return Parser.getFullImmRes(val);
					default: throw new Error(`Unknown template function "${args[0]}"`);
				}
			} else throw new Error(`Unhandled number of arguments ${args.length}`);
		});
	},

	_applyTemplate_getValue (ent, prop) {
		const spl = prop.split(".");
		switch (spl[0]) {
			case "item": {
				const path = spl.slice(1);
				if (!path.length) return `{@i missing key path}`;
				return MiscUtil.get(ent, ...path);
			}
			default: return `{@i unknown template root: "${spl[0]}"}`;
		}
	},
	// endregion

	/**
	 * Convert a nested entry structure into a flat list of entry metadata with depth info.
	 **/
	getFlatEntries (entry) {
		const out = [];
		const depthStack = [];

		const recurse = ({obj}) => {
			let isPopDepth = false;

			Renderer.ENTRIES_WITH_ENUMERATED_TITLES
				.forEach(meta => {
					if (obj.type !== meta.type) return;

					const kName = "name"; // Note: allow this to be specified on the `meta` if needed in future
					if (obj[kName] == null) return;

					isPopDepth = true;

					const curDepth = depthStack.length ? depthStack.last() : 0;
					const nxtDepth = meta.depth ? meta.depth : meta.depthIncrement ? curDepth + meta.depthIncrement : curDepth;

					depthStack.push(
						Math.min(
							nxtDepth,
							2,
						),
					);

					const cpyObj = MiscUtil.copyFast(obj);

					out.push({
						depth: curDepth,
						entry: cpyObj,
						key: meta.key,
						ix: out.length,
						name: cpyObj.name,
					});

					cpyObj[meta.key] = cpyObj[meta.key].map(child => {
						if (!child.type) return child;
						const childMeta = Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[child.type];
						if (!childMeta) return child;

						const kNameChild = "name"; // Note: allow this to be specified on the `meta` if needed in future
						if (child[kName] == null) return child;

						// Predict what index the child will have in the output array
						const ixNextRef = out.length;

						// Allow the child to add its entries to the output array
						recurse({obj: child});

						// Return a reference pointing forwards to the child's flat data
						return {IX_FLAT_REF: ixNextRef};
					});
				});

			if (isPopDepth) depthStack.pop();
		};

		recurse({obj: entry});

		return out;
	},

	getLinkSubhashString (subhashes) {
		let out = "";
		const len = subhashes.length;
		for (let i = 0; i < len; ++i) {
			const subHash = subhashes[i];
			if (subHash.preEncoded) out += `${HASH_PART_SEP}${subHash.key}${HASH_SUB_KV_SEP}`;
			else out += `${HASH_PART_SEP}${UrlUtil.encodeForHash(subHash.key)}${HASH_SUB_KV_SEP}`;
			if (subHash.value != null) {
				if (subHash.preEncoded) out += subHash.value;
				else out += UrlUtil.encodeForHash(subHash.value);
			} else {
				// TODO allow list of values
				out += subHash.values.map(v => UrlUtil.encodeForHash(v)).join(HASH_SUB_LIST_SEP);
			}
		}
		return out;
	},

	initFullEntries_ (ent, {propEntries = "entries", propFullEntries = "_fullEntries"} = {}) {
		ent[propFullEntries] = ent[propFullEntries] || (ent[propEntries] ? MiscUtil.copyFast(ent[propEntries]) : []);
	},

	lazy: {
		_getIntersectionConfig () {
			return {
				rootMargin: "150px 0px", // if the element gets within 150px of the viewport
				threshold: 0.01,
			};
		},

		_OBSERVERS: {},
		getCreateObserver ({observerId, fnOnObserve}) {
			if (!Renderer.utils.lazy._OBSERVERS[observerId]) {
				const observer = Renderer.utils.lazy._OBSERVERS[observerId] = new IntersectionObserver(
					Renderer.utils.lazy.getFnOnIntersect({
						observerId,
						fnOnObserve,
					}),
					Renderer.utils.lazy._getIntersectionConfig(),
				);

				observer._TRACKED = new Set();

				observer.track = it => {
					observer._TRACKED.add(it);
					return observer.observe(it);
				};

				observer.untrack = it => {
					observer._TRACKED.delete(it);
					return observer.unobserve(it);
				};

				// If we try to print a page with e.g. un-loaded images, attempt to load them all first
				observer._printListener = evt => {
					if (!observer._TRACKED.size) return;

					// region Sadly we cannot cancel or delay the print event, so, show a blocking alert
					[...observer._TRACKED].forEach(it => {
						observer.untrack(it);
						fnOnObserve({
							observer,
							entry: {
								target: it,
							},
						});
					});

					alert(`All content must be loaded prior to printing. Please cancel the print and wait a few moments for loading to complete!`);
					// endregion
				};
				window.addEventListener("beforeprint", observer._printListener);
			}
			return Renderer.utils.lazy._OBSERVERS[observerId];
		},

		destroyObserver ({observerId}) {
			const observer = Renderer.utils.lazy._OBSERVERS[observerId];
			if (!observer) return;

			observer.disconnect();
			window.removeEventListener("beforeprint", observer._printListener);
		},

		getFnOnIntersect ({observerId, fnOnObserve}) {
			return obsEntries => {
				const observer = Renderer.utils.lazy._OBSERVERS[observerId];

				obsEntries.forEach(entry => {
					// filter observed entries for those that intersect
					if (entry.intersectionRatio <= 0) return;

					observer.untrack(entry.target);
					fnOnObserve({
						observer,
						entry,
					});
				});
			};
		},
	},
};

Renderer.tag = class {
	static _TagBase = class {
		tagName;
		defaultSource = null;
		page = null;

		get tag () { return `@${this.tagName}`; }

		getStripped (tag, text) {
			text = text.replace(/<\$([^$]+)\$>/gi, ""); // remove any variable tags
			return this._getStripped(tag, text);
		}

		/** @abstract */
		_getStripped (tag, text) { throw new Error("Unimplemented!"); }
	};

	static _TagBaseAt = class extends this._TagBase {
		get tag () { return `@${this.tagName}`; }
	};

	static _TagBaseHash = class extends this._TagBase {
		get tag () { return `#${this.tagName}`; }
	};

	static _TagTextStyle = class extends this._TagBaseAt {
		_getStripped (tag, text) { return text; }
	};

	static TagBoldShort = class extends this._TagTextStyle {
		tagName = "b";
	};

	static TagBoldLong = class extends this._TagTextStyle {
		tagName = "bold";
	};

	static TagItalicShort = class extends this._TagTextStyle {
		tagName = "i";
	};

	static TagItalicLong = class extends this._TagTextStyle {
		tagName = "italic";
	};

	static TagStrikethroughShort = class extends this._TagTextStyle {
		tagName = "s";
	};

	static TagStrikethroughLong = class extends this._TagTextStyle {
		tagName = "strike";
	};

	static TagUnderlineShort = class extends this._TagTextStyle {
		tagName = "u";
	};

	static TagUnderlineLong = class extends this._TagTextStyle {
		tagName = "underline";
	};

	static TagSup = class extends this._TagTextStyle {
		tagName = "sup";
	};

	static TagSub = class extends this._TagTextStyle {
		tagName = "sub";
	};

	static TagKbd = class extends this._TagTextStyle {
		tagName = "kbd";
	};

	static TagCode = class extends this._TagTextStyle {
		tagName = "code";
	};

	static TagStyle = class extends this._TagTextStyle {
		tagName = "style";
	};

	static TagComic = class extends this._TagTextStyle {
		tagName = "comic";
	};

	static TagComicH1 = class extends this._TagTextStyle {
		tagName = "comicH1";
	};

	static TagComicH2 = class extends this._TagTextStyle {
		tagName = "comicH2";
	};

	static TagComicH3 = class extends this._TagTextStyle {
		tagName = "comicH3";
	};

	static TagComicH4 = class extends this._TagTextStyle {
		tagName = "comicH4";
	};

	static TagComicNote = class extends this._TagTextStyle {
		tagName = "comicNote";
	};

	static TagNote = class extends this._TagTextStyle {
		tagName = "note";
	};

	static TagUnit = class extends this._TagBaseAt {
		tagName = "unit";

		_getStripped (tag, text) {
			const [amount, unitSingle, unitPlural] = Renderer.splitTagByPipe(text);
			return isNaN(amount) ? unitSingle : Number(amount) > 1 ? unitPlural : unitSingle;
		}
	};

	static TagHit = class extends this._TagBaseAt {
		tagName = "h";

		_getStripped (tag, text) { return "Hit: "; }
	};

	static TagMiss = class extends this._TagBaseAt {
		tagName = "m";

		_getStripped (tag, text) { return "Miss: "; }
	};

	static TagAtk = class extends this._TagBaseAt {
		tagName = "atk";

		_getStripped (tag, text) { return Renderer.attackTagToFull(text); }
	};

	static TagHitYourSpellAttack = class extends this._TagBaseAt {
		tagName = "hitYourSpellAttack";

		_getStripped (tag, text) { return "your spell attack modifier"; }
	};

	static TagDc = class extends this._TagBaseAt {
		tagName = "dc";

		_getStripped (tag, text) {
			const [dcText, displayText] = Renderer.splitTagByPipe(text);
			return `DC ${displayText || dcText}`;
		}
	};

	static _TagDiceFlavor = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const [rollText, displayText] = Renderer.splitTagByPipe(text);
			switch (tag) {
				case "@damage":
				case "@dice":
				case "@autodice": {
					return displayText || rollText.replace(/;/g, "/");
				}
				case "@d20":
				case "@hit": {
					return displayText || (() => {
						const n = Number(rollText);
						if (!isNaN(n)) return `${n >= 0 ? "+" : ""}${n}`;
						return rollText;
					})();
				}
				case "@recharge": {
					const asNum = Number(rollText || 6);
					if (isNaN(asNum)) {
						throw new Error(`Could not parse "${rollText}" as a number!`);
					}
					return `(Recharge ${asNum}${asNum < 6 ? `\u20136` : ""})`;
				}
				case "@chance": {
					return displayText || `${rollText} percent`;
				}
				case "@ability": {
					const [, rawScore] = rollText.split(" ").map(it => it.trim().toLowerCase()).filter(Boolean);
					const score = Number(rawScore) || 0;
					return displayText || `${score} (${Parser.getAbilityModifier(score)})`;
				}
				case "@savingThrow":
				case "@skillCheck": {
					return displayText || rollText;
				}
			}
			throw new Error(`Unhandled tag: ${tag}`);
		}
	};

	static TaChance = class extends this._TagDiceFlavor {
		tagName = "chance";
	};

	static TaD20 = class extends this._TagDiceFlavor {
		tagName = "d20";
	};

	static TaDamage = class extends this._TagDiceFlavor {
		tagName = "damage";
	};

	static TaDice = class extends this._TagDiceFlavor {
		tagName = "dice";
	};

	static TaAutodice = class extends this._TagDiceFlavor {
		tagName = "autodice";
	};

	static TaHit = class extends this._TagDiceFlavor {
		tagName = "hit";
	};

	static TaRecharge = class extends this._TagDiceFlavor {
		tagName = "recharge";
	};

	static TaAbility = class extends this._TagDiceFlavor {
		tagName = "ability";
	};

	static TaSavingThrow = class extends this._TagDiceFlavor {
		tagName = "savingThrow";
	};

	static TaSkillCheck = class extends this._TagDiceFlavor {
		tagName = "skillCheck";
	};

	static _TagDiceFlavorScaling = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const [, , addPerProgress ] = Renderer.splitTagByPipe(text);
			return addPerProgress;
		}
	};

	static TagScaledice = class extends this._TagDiceFlavorScaling {
		tagName = "scaledice";
	};

	static TagScaledamage = class extends this._TagDiceFlavorScaling {
		tagName = "scaledamage";
	};

	static TagCoinflip = class extends this._TagBaseAt {
		tagName = "coinflip";

		_getStripped (tag, text) {
			const [displayText] = Renderer.splitTagByPipe(text);
			return displayText || "flip a coin";
		}
	};

	static _TagPipedNoDisplayText = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const parts = Renderer.splitTagByPipe(text);
			return parts[0];
		}
	};

	static Tag5etools = class extends this._TagPipedNoDisplayText {
		tagName = "5etools";
	};

	static TagAdventure = class extends this._TagPipedNoDisplayText {
		tagName = "adventure";
	};

	static TagBook = class extends this._TagPipedNoDisplayText {
		tagName = "book";
	};

	static TagFilter = class extends this._TagPipedNoDisplayText {
		tagName = "filter";
	};

	static TagFootnote = class extends this._TagPipedNoDisplayText {
		tagName = "footnote";
	};

	static TagLink = class extends this._TagPipedNoDisplayText {
		tagName = "link";
	};

	static TagLoader = class extends this._TagPipedNoDisplayText {
		tagName = "loader";
	};

	static TagColor = class extends this._TagPipedNoDisplayText {
		tagName = "color";
	};

	static TagHighlight = class extends this._TagPipedNoDisplayText {
		tagName = "highlight";
	};

	static TagHelp = class extends this._TagPipedNoDisplayText {
		tagName = "help";
	};

	static _TagPipedDisplayTextThird = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const parts = Renderer.splitTagByPipe(text);
			return parts.length >= 3 ? parts[2] : parts[0];
		}
	};

	static TagAction = class extends this._TagPipedDisplayTextThird {
		tagName = "action";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_ACTIONS;
	};

	static TagBackground = class extends this._TagPipedDisplayTextThird {
		tagName = "background";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_BACKGROUNDS;
	};

	static TagBoon = class extends this._TagPipedDisplayTextThird {
		tagName = "boon";
		defaultSource = Parser.SRC_MTF;
		page = UrlUtil.PG_CULTS_BOONS;
	};

	static TagCharoption = class extends this._TagPipedDisplayTextThird {
		tagName = "charoption";
		defaultSource = Parser.SRC_MOT;
		page = UrlUtil.PG_CHAR_CREATION_OPTIONS;
	};

	static TagClass = class extends this._TagPipedDisplayTextThird {
		tagName = "class";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_CLASSES;
	};

	static TagCondition = class extends this._TagPipedDisplayTextThird {
		tagName = "condition";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_CONDITIONS_DISEASES;
	};

	static TagCreature = class extends this._TagPipedDisplayTextThird {
		tagName = "creature";
		defaultSource = Parser.SRC_MM;
		page = UrlUtil.PG_BESTIARY;
	};

	static TagCult = class extends this._TagPipedDisplayTextThird {
		tagName = "cult";
		defaultSource = Parser.SRC_MTF;
		page = UrlUtil.PG_CULTS_BOONS;
	};

	static TagDeck = class extends this._TagPipedDisplayTextThird {
		tagName = "deck";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_DECKS;
	};

	static TagDisease = class extends this._TagPipedDisplayTextThird {
		tagName = "disease";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_CONDITIONS_DISEASES;
	};

	static TagFeat = class extends this._TagPipedDisplayTextThird {
		tagName = "feat";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_FEATS;
	};

	static TagHazard = class extends this._TagPipedDisplayTextThird {
		tagName = "hazard";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_TRAPS_HAZARDS;
	};

	static TagItem = class extends this._TagPipedDisplayTextThird {
		tagName = "item";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_ITEMS;
	};

	static TagItemMastery = class extends this._TagPipedDisplayTextThird {
		tagName = "itemMastery";
		defaultSource = VeCt.STR_GENERIC; // TODO(Future) adjust as/when these are published
		page = "itemMastery";
	};

	static TagLanguage = class extends this._TagPipedDisplayTextThird {
		tagName = "language";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_LANGUAGES;
	};

	static TagLegroup = class extends this._TagPipedDisplayTextThird {
		tagName = "legroup";
		defaultSource = Parser.SRC_MM;
		page = "legendaryGroup";
	};

	static TagObject = class extends this._TagPipedDisplayTextThird {
		tagName = "object";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_OBJECTS;
	};

	static TagOptfeature = class extends this._TagPipedDisplayTextThird {
		tagName = "optfeature";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_OPT_FEATURES;
	};

	static TagPsionic = class extends this._TagPipedDisplayTextThird {
		tagName = "psionic";
		defaultSource = Parser.SRC_UATMC;
		page = UrlUtil.PG_PSIONICS;
	};

	static TagRace = class extends this._TagPipedDisplayTextThird {
		tagName = "race";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_RACES;
	};

	static TagRecipe = class extends this._TagPipedDisplayTextThird {
		tagName = "recipe";
		defaultSource = Parser.SRC_HEROES_FEAST;
		page = UrlUtil.PG_RECIPES;
	};

	static TagReward = class extends this._TagPipedDisplayTextThird {
		tagName = "reward";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_REWARDS;
	};

	static TagVehicle = class extends this._TagPipedDisplayTextThird {
		tagName = "vehicle";
		defaultSource = Parser.SRC_GoS;
		page = UrlUtil.PG_VEHICLES;
	};

	static TagVehupgrade = class extends this._TagPipedDisplayTextThird {
		tagName = "vehupgrade";
		defaultSource = Parser.SRC_GoS;
		page = UrlUtil.PG_VEHICLES;
	};

	static TagSense = class extends this._TagPipedDisplayTextThird {
		tagName = "sense";
		defaultSource = Parser.SRC_PHB;
		page = "sense";
	};

	static TagSkill = class extends this._TagPipedDisplayTextThird {
		tagName = "skill";
		defaultSource = Parser.SRC_PHB;
		page = "skill";
	};

	static TagSpell = class extends this._TagPipedDisplayTextThird {
		tagName = "spell";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_SPELLS;
	};

	static TagStatus = class extends this._TagPipedDisplayTextThird {
		tagName = "status";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_CONDITIONS_DISEASES;
	};

	static TagTable = class extends this._TagPipedDisplayTextThird {
		tagName = "table";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_TABLES;
	};

	static TagTrap = class extends this._TagPipedDisplayTextThird {
		tagName = "trap";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_TRAPS_HAZARDS;
	};

	static TagVariantrule = class extends this._TagPipedDisplayTextThird {
		tagName = "variantrule";
		defaultSource = Parser.SRC_DMG;
		page = UrlUtil.PG_VARIANTRULES;
	};

	static _TagPipedDisplayTextFourth = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const parts = Renderer.splitTagByPipe(text);
			return parts.length >= 4 ? parts[3] : parts[0];
		}
	};

	static TagCard = class extends this._TagPipedDisplayTextFourth {
		tagName = "card";
		defaultSource = Parser.SRC_DMG;
		page = "card";
	};

	static TagDeity = class extends this._TagPipedDisplayTextFourth {
		tagName = "deity";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_DEITIES;
	};

	static _TagPipedDisplayTextSixth = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const parts = Renderer.splitTagByPipe(text);
			return parts.length >= 6 ? parts[5] : parts[0];
		}
	};

	static TagClassFeature = class extends this._TagPipedDisplayTextSixth {
		tagName = "classFeature";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_CLASSES;
	};

	static _TagPipedDisplayTextEight = class extends this._TagBaseAt {
		_getStripped (tag, text) {
			const parts = Renderer.splitTagByPipe(text);
			return parts.length >= 8 ? parts[7] : parts[0];
		}
	};

	static TagSubclassFeature = class extends this._TagPipedDisplayTextEight {
		tagName = "subclassFeature";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_CLASSES;
	};

	static TagQuickref = class extends this._TagBaseAt {
		tagName = "quickref";
		defaultSource = Parser.SRC_PHB;
		page = UrlUtil.PG_QUICKREF;

		_getStripped (tag, text) {
			const {name, displayText} = DataUtil.quickreference.unpackUid(text);
			return displayText || name;
		}
	};

	static TagArea = class extends this._TagBaseAt {
		tagName = "area";

		_getStripped (tag, text) {
			const [compactText, , flags] = Renderer.splitTagByPipe(text);

			return flags && flags.includes("x")
				? compactText
				: `${flags && flags.includes("u") ? "A" : "a"}rea ${compactText}`;
		}
	};

	static TagHomebrew = class extends this._TagBaseAt {
		tagName = "homebrew";

		_getStripped (tag, text) {
			const [newText, oldText] = Renderer.splitTagByPipe(text);
			if (newText && oldText) {
				return `${newText} [this is a homebrew addition, replacing the following: "${oldText}"]`;
			} else if (newText) {
				return `${newText} [this is a homebrew addition]`;
			} else if (oldText) {
				return `[the following text has been removed due to homebrew: ${oldText}]`;
			} else throw new Error(`Homebrew tag had neither old nor new text!`);
		}
	};

	static TagItemEntry = class extends this._TagBaseHash {
		tagName = "itemEntry";
		defaultSource = Parser.SRC_DMG;
	};

	/* -------------------------------------------- */

	static TAGS = [
		new this.TagBoldShort(),
		new this.TagBoldLong(),
		new this.TagItalicShort(),
		new this.TagItalicLong(),
		new this.TagStrikethroughShort(),
		new this.TagStrikethroughLong(),
		new this.TagUnderlineShort(),
		new this.TagUnderlineLong(),
		new this.TagSup(),
		new this.TagSub(),
		new this.TagKbd(),
		new this.TagCode(),
		new this.TagStyle(),

		new this.TagComic(),
		new this.TagComicH1(),
		new this.TagComicH2(),
		new this.TagComicH3(),
		new this.TagComicH4(),
		new this.TagComicNote(),

		new this.TagNote(),

		new this.TagUnit(),

		new this.TagHit(),
		new this.TagMiss(),

		new this.TagAtk(),

		new this.TagHitYourSpellAttack(),

		new this.TagDc(),

		new this.TaChance(),
		new this.TaD20(),
		new this.TaDamage(),
		new this.TaDice(),
		new this.TaAutodice(),
		new this.TaHit(),
		new this.TaRecharge(),
		new this.TaAbility(),
		new this.TaSavingThrow(),
		new this.TaSkillCheck(),

		new this.TagScaledice(),
		new this.TagScaledamage(),

		new this.TagCoinflip(),

		new this.Tag5etools(),
		new this.TagAdventure(),
		new this.TagBook(),
		new this.TagFilter(),
		new this.TagFootnote(),
		new this.TagLink(),
		new this.TagLoader(),
		new this.TagColor(),
		new this.TagHighlight(),
		new this.TagHelp(),

		new this.TagQuickref(),

		new this.TagArea(),

		new this.TagAction(),
		new this.TagBackground(),
		new this.TagBoon(),
		new this.TagCharoption(),
		new this.TagClass(),
		new this.TagCondition(),
		new this.TagCreature(),
		new this.TagCult(),
		new this.TagDeck(),
		new this.TagDisease(),
		new this.TagFeat(),
		new this.TagHazard(),
		new this.TagItem(),
		new this.TagItemMastery(),
		new this.TagLanguage(),
		new this.TagLegroup(),
		new this.TagObject(),
		new this.TagOptfeature(),
		new this.TagPsionic(),
		new this.TagRace(),
		new this.TagRecipe(),
		new this.TagReward(),
		new this.TagVehicle(),
		new this.TagVehupgrade(),
		new this.TagSense(),
		new this.TagSkill(),
		new this.TagSpell(),
		new this.TagStatus(),
		new this.TagTable(),
		new this.TagTrap(),
		new this.TagVariantrule(),

		new this.TagCard(),
		new this.TagDeity(),

		new this.TagClassFeature({tagName: "classFeature"}),

		new this.TagSubclassFeature({tagName: "subclassFeature"}),

		new this.TagHomebrew(),

		/* ----------------------------------------- */

		new this.TagItemEntry(),
	];

	static TAG_LOOKUP = {};

	static _init () {
		this.TAGS.forEach(tag => {
			this.TAG_LOOKUP[tag.tag] = tag;
			this.TAG_LOOKUP[tag.tagName] = tag;
		});

		return null;
	}

	static _ = this._init();

	/* ----------------------------------------- */

	static getPage (tag) {
		const tagInfo = this.TAG_LOOKUP[tag];
		return tagInfo?.page;
	}
};

Renderer.events = {
	handleClick_copyCode (evt, ele) {
		const $e = $(ele).parent().next("pre");
		MiscUtil.pCopyTextToClipboard($e.text());
		JqueryUtil.showCopiedEffect($e);
	},

	handleClick_toggleCodeWrap (evt, ele) {
		const nxt = !StorageUtil.syncGet("rendererCodeWrap");
		StorageUtil.syncSet("rendererCodeWrap", nxt);
		const $btn = $(ele).toggleClass("active", nxt);
		const $e = $btn.parent().next("pre");
		$e.toggleClass("rd__pre-wrap", nxt);
	},

	bindGeneric ({element = document.body} = {}) {
		$(element)
			.on("click", `[data-rd-data-embed-header]`, evt => {
				Renderer.events.handleClick_dataEmbedHeader(evt, evt.currentTarget);
			})
			.on("click", `[data-rd-h-toggle-button]`, evt => {
				Renderer.events.handleClick_headerToggleButton(evt, evt.currentTarget);
			})
			.on("click", `[data-rd-h-special-toggle-button]`, evt => {
				Renderer.events.handleClick_headerToggleButton(evt, evt.currentTarget, {isSpecial: true});
			})
		;
	},

	handleClick_dataEmbedHeader (evt, ele) {
		evt.stopPropagation();
		evt.preventDefault();

		const $ele = $(ele);
		$ele.find(".rd__data-embed-name").toggleVe();
		$ele.find(".rd__data-embed-toggle").text($ele.text().includes("+") ? "[\u2013]" : "[+]");
		$ele.closest("table").find("tbody").toggleVe();
	},

	handleClick_headerToggleButton (evt, ele, {isSpecial = false} = {}) {
		evt.stopPropagation();
		evt.preventDefault();

		const isShow = ele.innerHTML.includes("+");

		let eleNxt = ele.closest(".rd__h").nextElementSibling;

		while (eleNxt) {
			// Never hide float-fixing elements
			if (eleNxt.classList.contains("float-clear")) {
				eleNxt = eleNxt.nextElementSibling;
				continue;
			}

			// For special sections, always collapse the whole thing.
			if (!isSpecial) {
				const eleToCheck = Renderer.events._handleClick_headerToggleButton_getEleToCheck(eleNxt);
				if (
					eleToCheck.classList.contains("rd__b-special")
					|| (eleToCheck.classList.contains("rd__h") && !eleToCheck.classList.contains("rd__h--3"))
					|| (eleToCheck.classList.contains("rd__b") && !eleToCheck.classList.contains("rd__b--3"))
				) break;
			}

			eleNxt.classList.toggle("rd__ele-toggled-hidden");
			eleNxt = eleNxt.nextElementSibling;
		}

		ele.innerHTML = isShow ? "[\u2013]" : "[+]";
	},

	_handleClick_headerToggleButton_getEleToCheck (eleNxt) {
		if (eleNxt.type === 3) return eleNxt; // Text nodes

		// If the element is a block with only one child which is itself a block, treat it as a "wrapper" block, and dig
		if (!eleNxt.classList.contains("rd__b") || eleNxt.classList.contains("rd__b--3")) return eleNxt;
		const childNodes = [...eleNxt.childNodes].filter(it => (it.type === 3 && (it.textContent || "").trim()) || it.type !== 3);
		if (childNodes.length !== 1) return eleNxt;
		if (childNodes[0].classList.contains("rd__b")) return Renderer.events._handleClick_headerToggleButton_getEleToCheck(childNodes[0]);
		return eleNxt;
	},

	handleLoad_inlineStatblock (ele) {
		const observer = Renderer.utils.lazy.getCreateObserver({
			observerId: "inlineStatblock",
			fnOnObserve: Renderer.events._handleLoad_inlineStatblock_fnOnObserve.bind(Renderer.events),
		});

		observer.track(ele.parentNode);
	},

	_handleLoad_inlineStatblock_fnOnObserve ({entry}) {
		const ele = entry.target;

		const tag = ele.dataset.rdTag.uq();
		const page = ele.dataset.rdPage.uq();
		const source = ele.dataset.rdSource.uq();
		const name = ele.dataset.rdName.uq();
		const displayName = ele.dataset.rdDisplayName.uq();
		const hash = ele.dataset.rdHash.uq();
		const style = ele.dataset.rdStyle.uq();

		DataLoader.pCacheAndGet(page, Parser.getTagSource(tag, source), hash)
			.then(toRender => {
				const tr = ele.closest("tr");

				if (!toRender) {
					tr.innerHTML = `<td colspan="6"><i class="text-danger">Failed to load ${tag ? Renderer.get().render(`{@${tag} ${name}|${source}${displayName ? `|${displayName}` : ""}}`) : displayName || name}!</i></td>`;
					throw new Error(`Could not find tag: "${tag}" (page/prop: "${page}") hash: "${hash}"`);
				}

				const headerName = displayName
					|| (name ?? toRender.name ?? (toRender.entries?.length ? toRender.entries?.[0]?.name : "(Unknown)"));

				const fnRender = Renderer.hover.getFnRenderCompact(page);
				const tbl = tr.closest("table");
				const nxt = e_({
					outer: Renderer.utils.getEmbeddedDataHeader(headerName, style)
						+ fnRender(toRender, {isEmbeddedEntity: true})
						+ Renderer.utils.getEmbeddedDataFooter(),
				});
				tbl.parentNode.replaceChild(
					nxt,
					tbl,
				);

				const nxtTgt = nxt.querySelector(`[data-rd-embedded-data-render-target="true"]`);

				const fnBind = Renderer.hover.getFnBindListenersCompact(page);
				if (fnBind) fnBind(toRender, nxtTgt);
			});
	},
};

Renderer.feat = {
	_mergeAbilityIncrease_getListItemText (abilityObj) {
		return Renderer.feat._mergeAbilityIncrease_getText(abilityObj);
	},

	_mergeAbilityIncrease_getListItemItem (abilityObj) {
		return {
			type: "item",
			name: "Ability Score Increase.",
			entry: Renderer.feat._mergeAbilityIncrease_getText(abilityObj),
		};
	},

	_mergeAbilityIncrease_getText (abilityObj) {
		if (!abilityObj.choose) {
			return Object.keys(abilityObj)
				.map(ab => `Increase your ${Parser.attAbvToFull(ab)} score by ${abilityObj[ab]}, to a maximum of 20.`)
				.join(" ");
		}

		if (abilityObj.choose.from.length === 6) {
			return abilityObj.choose.entry
				? Renderer.get().render(abilityObj.choose.entry) // only used in "Resilient"
				: `Increase one ability score of your choice by ${abilityObj.choose.amount ?? 1}, to a maximum of 20.`;
		}

		const abbChoicesText = abilityObj.choose.from.map(it => Parser.attAbvToFull(it)).joinConjunct(", ", " or ");
		return `Increase your ${abbChoicesText} by ${abilityObj.choose.amount ?? 1}, to a maximum of 20.`;
	},

	initFullEntries (feat) {
		if (!feat.ability || feat._fullEntries || !feat.ability.length) return;

		const abilsToDisplay = feat.ability.filter(it => !it.hidden);
		if (!abilsToDisplay.length) return;

		Renderer.utils.initFullEntries_(feat);

		const targetList = feat._fullEntries.find(e => e.type === "list");

		// FTD+ style
		if (targetList && targetList.items.every(it => it.type === "item")) {
			abilsToDisplay.forEach(abilObj => targetList.items.unshift(Renderer.feat._mergeAbilityIncrease_getListItemItem(abilObj)));
			return;
		}

		if (targetList) {
			abilsToDisplay.forEach(abilObj => targetList.items.unshift(Renderer.feat._mergeAbilityIncrease_getListItemText(abilObj)));
			return;
		}

		// this should never happen, but display sane output anyway, and throw an out-of-order exception
		abilsToDisplay.forEach(abilObj => feat._fullEntries.unshift(Renderer.feat._mergeAbilityIncrease_getListItemText(abilObj)));

		setTimeout(() => {
			throw new Error(`Could not find object of type "list" in "entries" for feat "${feat.name}" from source "${feat.source}" when merging ability scores! Reformat the feat to include a "list"-type entry.`);
		}, 1);
	},

	/**
	 * @param feat
	 * @param [opts]
	 * @param [opts.isSkipNameRow]
	 */
	getCompactRenderedString (feat, opts) {
		opts = opts || {};

		const renderer = Renderer.get().setFirstSection(true);
		const renderStack = [];

		const prerequisite = Renderer.utils.prerequisite.getHtml(feat.prerequisite);
		const ptRepeatable = Renderer.utils.getRepeatableHtml(feat);
		Renderer.feat.initFullEntries(feat);
		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: feat, dataProp: "feat", page: UrlUtil.PG_FEATS})}
			${opts.isSkipNameRow ? "" : Renderer.utils.getNameTr(feat, {page: UrlUtil.PG_FEATS})}
			<tr class="text"><td colspan="6" class="text">
			${prerequisite ? `<p>${prerequisite}</p>` : ""}
			${ptRepeatable ? `<p>${prerequisite}</p>` : ""}
		`);
		renderer.recursiveRender({entries: feat._fullEntries || feat.entries}, renderStack, {depth: 2});
		renderStack.push(`</td></tr>`);

		return renderStack.join("");
	},

	pGetFluff (feat) {
		return Renderer.utils.pGetFluff({
			entity: feat,
			fnGetFluffData: DataUtil.featFluff.loadJSON.bind(DataUtil.featFluff),
			fluffProp: "featFluff",
		});
	},
};

Renderer.class = {
	getCompactRenderedString (cls) {
		if (cls.__prop === "subclass") return Renderer.subclass.getCompactRenderedString(cls);

		const clsEntry = {
			type: "section",
			name: cls.name,
			source: cls.source,
			page: cls.page,
			entries: MiscUtil.copyFast((cls.classFeatures || []).flat()),
		};

		return Renderer.hover.getGenericCompactRenderedString(clsEntry);
	},

	getHitDiceEntry (clsHd) { return clsHd ? {toRoll: `${clsHd.number}d${clsHd.faces}`, rollable: true} : null; },
	getHitPointsAtFirstLevel (clsHd) { return clsHd ? `${clsHd.number * clsHd.faces} + your Constitution modifier` : null; },
	getHitPointsAtHigherLevels (className, clsHd, hdEntry) { return className && clsHd && hdEntry ? `${Renderer.getEntryDice(hdEntry, "Hit die")} (or ${((clsHd.number * clsHd.faces) / 2 + 1)}) + your Constitution modifier per ${className} level after 1st` : null; },

	getRenderedArmorProfs (armorProfs) { return armorProfs.map(a => Renderer.get().render(a.full ? a.full : a === "light" || a === "medium" || a === "heavy" ? `{@filter ${a} armor|items|type=${a} armor}` : a)).join(", "); },
	getRenderedWeaponProfs (weaponProfs) { return weaponProfs.map(w => Renderer.get().render(w === "simple" || w === "martial" ? `{@filter ${w} weapons|items|type=${w} weapon}` : w.optional ? `<span class="help help--hover" title="Optional Proficiency">${w.proficiency}</span>` : w)).join(", "); },
	getRenderedToolProfs (toolProfs) { return toolProfs.map(it => Renderer.get().render(it)).join(", "); },
	getRenderedSkillProfs (skills) { return `${Parser.skillProficienciesToFull(skills).uppercaseFirst()}.`; },

	getWalkerFilterDereferencedFeatures () {
		return MiscUtil.getWalker({
			keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
			isAllowDeleteObjects: true,
			isDepthFirst: true,
		});
	},

	mutFilterDereferencedClassFeatures (
		{
			walker,
			cpyCls,
			pageFilter,
			filterValues,
			isUseSubclassSources = false,
		},
	) {
		walker = walker || Renderer.class.getWalkerFilterDereferencedFeatures();

		cpyCls.classFeatures = cpyCls.classFeatures.map((lvlFeatures, ixLvl) => {
			return walker.walk(
				lvlFeatures,
				{
					object: (obj) => {
						if (!obj.source) return obj;
						const fText = obj.isClassFeatureVariant ? {isClassFeatureVariant: true} : null;

						const isDisplay = [obj.source, ...(obj.otherSources || [])
							.map(it => it.source)]
							.some(src => pageFilter.filterBox.toDisplayByFilters(
								filterValues,
								...[
									{
										filter: pageFilter.sourceFilter,
										value: isUseSubclassSources && src === cpyCls.source
											? pageFilter.getActiveSource(filterValues)
											: src,
									},
									pageFilter.levelFilter
										? {
											filter: pageFilter.levelFilter,
											value: ixLvl + 1,
										}
										: null,
									{
										filter: pageFilter.optionsFilter,
										value: fText,
									},
								].filter(Boolean),
							));

						return isDisplay ? obj : null;
					},
					array: (arr) => {
						return arr.filter(it => it != null);
					},
				},
			);
		});
	},

	mutFilterDereferencedSubclassFeatures (
		{
			walker,
			cpySc,
			pageFilter,
			filterValues,
		},
	) {
		walker = walker || Renderer.class.getWalkerFilterDereferencedFeatures();

		cpySc.subclassFeatures = cpySc.subclassFeatures.map(lvlFeatures => {
			const level = CollectionUtil.bfs(lvlFeatures, {prop: "level"});

			return walker.walk(
				lvlFeatures,
				{
					object: (obj) => {
						if (obj.entries && !obj.entries.length) return null;
						if (!obj.source) return obj;
						const fText = obj.isClassFeatureVariant ? {isClassFeatureVariant: true} : null;

						const isDisplay = [obj.source, ...(obj.otherSources || [])
							.map(it => it.source)]
							.some(src => pageFilter.filterBox.toDisplayByFilters(
								filterValues,
								...[
									{
										filter: pageFilter.sourceFilter,
										value: src,
									},
									pageFilter.levelFilter
										? {
											filter: pageFilter.levelFilter,
											value: level,
										}
										: null,
									{
										filter: pageFilter.optionsFilter,
										value: fText,
									},
								].filter(Boolean),
							));

						return isDisplay ? obj : null;
					},
					array: (arr) => {
						return arr.filter(it => it != null);
					},
				},
			);
		});
	},
};

Renderer.subclass = {
	getCompactRenderedString (sc) {
		const scEntry = {
			type: "section",
			name: sc.name,
			source: sc.source,
			page: sc.page,
			entries: MiscUtil.copyFast((sc.subclassFeatures || []).flat()),
		};

		return Renderer.hover.getGenericCompactRenderedString(scEntry);
	},
};

Renderer.spell = {
	getCompactRenderedString (spell, opts) {
		opts = opts || {};

		const renderer = Renderer.get();
		const renderStack = [];

		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: spell, dataProp: "spell", page: UrlUtil.PG_SPELLS})}
			${Renderer.utils.getNameTr(spell, {page: UrlUtil.PG_SPELLS, isEmbeddedEntity: opts.isEmbeddedEntity})}
			<tr><td colspan="6">
				<table class="w-100 summary stripe-even-table">
					<tr>
						<th colspan="1">Level</th>
						<th colspan="1">School</th>
						<th colspan="2">Casting Time</th>
						<th colspan="2">Range</th>
					</tr>
					<tr>
						<td colspan="1">${Parser.spLevelToFull(spell.level)}${Parser.spMetaToFull(spell.meta)}</td>
						<td colspan="1">${Parser.spSchoolAndSubschoolsAbvsToFull(spell.school, spell.subschools)}</td>
						<td colspan="2">${Parser.spTimeListToFull(spell.time)}</td>
						<td colspan="2">${Parser.spRangeToFull(spell.range)}</td>
					</tr>
					<tr>
						<th colspan="4">Components</th>
						<th colspan="2">Duration</th>
					</tr>
					<tr>
						<td colspan="4">${Parser.spComponentsToFull(spell.components, spell.level)}</td>
						<td colspan="2">${Parser.spDurationToFull(spell.duration)}</td>
					</tr>
				</table>
			</td></tr>
		`);

		renderStack.push(`<tr class="text"><td colspan="6" class="text">`);
		const entryList = {type: "entries", entries: spell.entries};
		renderer.recursiveRender(entryList, renderStack, {depth: 1});
		if (spell.entriesHigherLevel) {
			const higherLevelsEntryList = {type: "entries", entries: spell.entriesHigherLevel};
			renderer.recursiveRender(higherLevelsEntryList, renderStack, {depth: 2});
		}
		const fromClassList = Renderer.spell.getCombinedClasses(spell, "fromClassList");
		if (fromClassList.length) {
			const [current] = Parser.spClassesToCurrentAndLegacy(fromClassList);
			renderStack.push(`<div><span class="bold">Classes: </span>${Parser.spMainClassesToFull(current)}</div>`);
		}
		renderStack.push(`</td></tr>`);

		return renderStack.join("");
	},

	_prereleaseSourcesCache: null,
	_brewSourcesCache: null,

	populatePrereleaseLookup (brew, {isForce = false} = {}) {
		Renderer.spell._populatePrereleaseBrewLookup({brew, isForce, propCache: "_prereleaseSourcesCache"});
	},

	populateBrewLookup (brew, {isForce = false} = {}) {
		Renderer.spell._populatePrereleaseBrewLookup({brew, isForce, propCache: "_brewSourcesCache"});
	},

	_populatePrereleaseBrewLookup ({brew, propCache, isForce}) {
		if (Renderer.spell[propCache] && !isForce) return;

		const cache = Renderer.spell[propCache] = {
			classes: {},

			groups: {},

			// region Unused
			races: {},
			backgrounds: {},
			feats: {},
			optionalfeatures: {},
			// endregion
		};

		// region Load homebrew class spell list addons
		// Two formats are available: a string UID, or "class" object (object with a `className`, etc.).
		if (brew.class) {
			brew.class.forEach(c => {
				c.source = c.source || Parser.SRC_PHB;

				(c.classSpells || [])
					.forEach(itm => Renderer.spell._populatePrereleaseBrewLookup_item_classSubclass({
						cache,
						itm,
						className: c.name,
						classSource: c.source,
					}));
			});
		}

		if (brew.subclass) {
			brew.subclass.forEach(sc => {
				sc.classSource = sc.classSource || Parser.SRC_PHB;
				sc.shortName = sc.shortName || sc.name;
				sc.source = sc.source || sc.classSource;

				(sc.subclassSpells || [])
					.forEach(itm => Renderer.spell._populatePrereleaseBrewLookup_item_classSubclass({
						cache,
						itm,
						className: sc.className,
						classSource: sc.classSource,
						subclassShortName: sc.shortName,
						subclassName: sc.name,
						subclassSource: sc.source,
					}));

				Object.entries(sc.subSubclassSpells || {})
					.forEach(([subSubclassName, arr]) => {
						arr
							.forEach(itm => Renderer.spell._populatePrereleaseBrewLookup_item_classSubclass({
								cache,
								itm,
								className: sc.className,
								classSource: sc.classSource,
								subclassShortName: sc.shortName,
								subclassName: sc.name,
								subclassSource: sc.source,
								subSubclassName,
							}));
					});
			});
		}
		// endregion

		(brew.spellList || []).forEach(spellList => Renderer.spell._populatePrereleaseBrewLookup_item_group({cache, spellList}));
	},

	_populatePrereleaseBrewLookup_item_classSubclass (
		{
			cache,
			itm,
			className,
			classSource,
			subclassShortName,
			subclassName,
			subclassSource,
			subSubclassName,
		},
	) {
		const doAdd = (target) => {
			if (subclassShortName) {
				const toAdd = {
					class: {name: className, source: classSource},
					subclass: {name: subclassName || subclassShortName, shortName: subclassShortName, source: subclassSource},
				};
				if (subSubclassName) toAdd.subclass.subSubclass = subSubclassName;

				target.fromSubclass = target.fromSubclass || [];
				target.fromSubclass.push(toAdd);
				return;
			}

			const toAdd = {name: className, source: classSource};

			target.fromClassList = target.fromClassList || [];
			target.fromClassList.push(toAdd);
		};

		// region Duplicate the spell list of another class/subclass/sub-subclass
		if (itm.className) {
			cache.classes.class = cache.classes.class || {};

			const cls = itm.className.toLowerCase();
			const source = (itm.classSource || Parser.SRC_PHB).toLowerCase();

			cache.classes.class[source] = cache.classes.class[source] || {};
			cache.classes.class[source][cls] = cache.classes.class[source][cls] || {};

			return doAdd(cache.classes.class[source][cls]);
		}
		// endregion

		// region Individual spell
		cache.classes.spell = cache.classes.spell || {};

		let [name, source] = `${itm}`.toLowerCase().split("|");
		source = source || Parser.SRC_PHB.toLowerCase();

		cache.classes.spell[source] = cache.classes.spell[source] || {};
		cache.classes.spell[source][name] = cache.classes.spell[source][name] || {fromClassList: [], fromSubclass: []};

		doAdd(cache.classes.spell[source][name]);
		// endregion
	},

	_populatePrereleaseBrewLookup_item_group (
		{
			cache,
			spellList,
		},
	) {
		const spellListSourceLower = (spellList.source || "").toLowerCase();
		const spellListNameLower = (spellList.name || "").toLowerCase();

		spellList.spells
			.forEach(spell => {
				if (typeof spell === "string") {
					const {name, source} = DataUtil.proxy.unpackUid("spell", spell, "spell", {isLower: true});
					return MiscUtil.set(cache.groups, "spell", source, name, spellListSourceLower, spellListNameLower, {name: spellList.name, source: spellList.source});
				}

				// TODO(Future) implement "copy existing list"
				throw new Error(`Grouping spells based on other spell lists is not yet supported!`);
			});
	},

	prePopulateHover (data) {
		(data.spell || []).forEach(sp => Renderer.spell.initBrewSources(sp));
	},

	prePopulateHoverPrerelease (data) {
		Renderer.spell.populatePrereleaseLookup(data);
	},

	prePopulateHoverBrew (data) {
		Renderer.spell.populateBrewLookup(data);
	},

	getCombinedClasses (sp, prop) {
		return [
			...((sp.classes || {})[prop] || []),
			...((sp._tmpClasses || {})[prop] || []),
		]
			.filter(it => {
				if (!ExcludeUtil.isInitialised) return true;

				switch (prop) {
					case "fromClassList":
					case "fromClassListVariant": {
						const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](it);
						if (ExcludeUtil.isExcluded(hash, "class", it.source, {isNoCount: true})) return false;

						if (prop !== "fromClassListVariant") return true;
						if (it.definedInSource) return !ExcludeUtil.isExcluded("*", "classFeature", it.definedInSource, {isNoCount: true});

						return true;
					}
					case "fromSubclass":
					case "fromSubclassVariant": {
						const hash = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({
							name: it.subclass.name,
							shortName: it.subclass.shortName,
							source: it.subclass.source,
							className: it.class.name,
							classSource: it.class.source,
						});

						if (prop !== "fromSubclassVariant") return !ExcludeUtil.isExcluded(hash, "subclass", it.subclass.source, {isNoCount: true});
						if (it.class.definedInSource) return !Renderer.spell.isExcludedSubclassVariantSource({classDefinedInSource: it.class.definedInSource});

						return true;
					}
					default: throw new Error(`Unhandled prop "${prop}"`);
				}
			});
	},

	isExcludedSubclassVariantSource ({classDefinedInSource, subclassDefinedInSource}) {
		return (classDefinedInSource != null && ExcludeUtil.isExcluded("*", "classFeature", classDefinedInSource, {isNoCount: true}))
			|| (subclassDefinedInSource != null && ExcludeUtil.isExcluded("*", "subclassFeature", subclassDefinedInSource, {isNoCount: true}));
	},

	getCombinedGeneric (sp, {propSpell, prop}) {
		const propSpellTmp = `_tmp${propSpell.uppercaseFirst()}`;
		return [
			...(sp[propSpell] || []),
			...(sp[propSpellTmp] || []),
		]
			.filter(it => {
				if (!ExcludeUtil.isInitialised || !prop) return true;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[prop](it);
				return !ExcludeUtil.isExcluded(hash, prop, it.source, {isNoCount: true});
			})
			.sort(SortUtil.ascSortGenericEntity.bind(SortUtil));
	},

	_BREW_SOURCES_TMP_PROPS: [
		"_tmpSourcesInit",
		"_tmpClasses",
		"_tmpRaces",
		"_tmpBackgrounds",
		"_tmpFeats",
		"_tmpOptionalfeatures",
		"_tmpGroups",
	],
	uninitBrewSources (sp) {
		Renderer.spell._BREW_SOURCES_TMP_PROPS.forEach(prop => delete sp[prop]);
	},

	initBrewSources (sp) {
		if (sp._tmpSourcesInit) return;
		sp._tmpSourcesInit = true;

		sp._tmpClasses = {};
		sp._tmpRaces = [];
		sp._tmpBackgrounds = [];
		sp._tmpFeats = [];
		sp._tmpOptionalfeatures = [];
		sp._tmpGroups = [];

		const lowName = sp.name.toLowerCase();
		const lowSource = sp.source.toLowerCase();

		for (const cache of [Renderer.spell._prereleaseSourcesCache, Renderer.spell._brewSourcesCache]) {
			Renderer.spell._initBrewSources_brewClassesSubclasses({cache, sp, lowName, lowSource});
			Renderer.spell._initBrewSources_brewGeneric({cache, sp, lowName, lowSource, propSpell: "races", prop: "race"});
			Renderer.spell._initBrewSources_brewGeneric({cache, sp, lowName, lowSource, propSpell: "backgrounds", prop: "background"});
			Renderer.spell._initBrewSources_brewGeneric({cache, sp, lowName, lowSource, propSpell: "feats", prop: "feat"});
			Renderer.spell._initBrewSources_brewGeneric({cache, sp, lowName, lowSource, propSpell: "optionalfeatures", prop: "optionalfeature"});
			Renderer.spell._initBrewSources_brewGroup({cache, sp, lowName, lowSource});
		}
	},

	_initBrewSources_brewClassesSubclasses ({cache, sp, lowName, lowSource}) {
		if (!cache?.classes) return;

		if (cache.classes.spell?.[lowSource]?.[lowName]) {
			if (cache.classes.spell[lowSource][lowName].fromClassList.length) {
				sp._tmpClasses.fromClassList = sp._tmpClasses.fromClassList || [];
				sp._tmpClasses.fromClassList.push(...cache.classes.spell[lowSource][lowName].fromClassList);
			}

			if (cache.classes.spell[lowSource][lowName].fromSubclass.length) {
				sp._tmpClasses.fromSubclass = sp._tmpClasses.fromSubclass || [];
				sp._tmpClasses.fromSubclass.push(...cache.classes.spell[lowSource][lowName].fromSubclass);
			}
		}

		if (cache.classes.class && sp.classes?.fromClassList) {
			(sp._tmpClasses = sp._tmpClasses || {}).fromClassList = sp._tmpClasses.fromClassList || [];

			// speed over safety
			outer: for (const srcLower in cache.classes.class) {
				const searchForClasses = cache.classes.class[srcLower];

				for (const clsLowName in searchForClasses) {
					const spellHasClass = sp.classes?.fromClassList?.some(cls => (cls.source || "").toLowerCase() === srcLower && cls.name.toLowerCase() === clsLowName);
					if (!spellHasClass) continue;

					const fromDetails = searchForClasses[clsLowName];

					if (fromDetails.fromClassList) {
						sp._tmpClasses.fromClassList.push(...fromDetails.fromClassList);
					}

					if (fromDetails.fromSubclass) {
						sp._tmpClasses.fromSubclass = sp._tmpClasses.fromSubclass || [];
						sp._tmpClasses.fromSubclass.push(...fromDetails.fromSubclass);
					}

					// Only add it once regardless of how many classes match
					break outer;
				}
			}
		}
	},

	_initBrewSources_brewGeneric ({cache, sp, lowName, lowSource, propSpell, prop}) {
		if (!cache?.[propSpell]) return;

		const propTmp = `_tmp${propSpell.uppercaseFirst()}`;

		// If a precise spell has been specified
		if (cache[propSpell]?.spell?.[lowSource]?.[lowName]?.length) {
			(sp[propTmp] = sp[propTmp] || [])
				.push(...cache[propSpell].spell[lowSource][lowName]);
		}

		// If we have a copy of an existing entity's spells
		if (cache?.[propSpell]?.[prop] && sp[propSpell]) {
			sp[propTmp] = sp[propTmp] || [];

			// speed over safety
			outer: for (const srcLower in cache[propSpell][prop]) {
				const searchForExisting = cache[propSpell][prop][srcLower];

				for (const lowName in searchForExisting) {
					const spellHasEnt = sp[propSpell].some(it => (it.source || "").toLowerCase() === srcLower && it.name.toLowerCase() === lowName);
					if (!spellHasEnt) continue;

					const fromDetails = searchForExisting[lowName];

					sp[propTmp].push(...fromDetails);

					// Only add it once regardless of how many entities match
					break outer;
				}
			}
		}
	},

	_initBrewSources_brewGroup ({cache, sp, lowName, lowSource}) {
		if (!cache?.groups) return;

		if (cache.groups.spell?.[lowSource]?.[lowName]) {
			Object.values(cache.groups.spell[lowSource][lowName])
				.forEach(bySource => {
					Object.values(bySource)
						.forEach(byName => {
							sp._tmpGroups.push(byName);
						});
				});
		}

		// TODO(Future) implement "copy existing list"
	},

	pGetFluff (sp) {
		return Renderer.utils.pGetFluff({
			entity: sp,
			fluffBaseUrl: `data/spells/`,
			fluffProp: "spellFluff",
		});
	},
};

Renderer.condition = {
	getCompactRenderedString (cond) {
		const renderer = Renderer.get();
		const renderStack = [];

		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: cond, dataProp: cond.__prop || cond._type, page: UrlUtil.PG_CONDITIONS_DISEASES})}
			${Renderer.utils.getNameTr(cond, {page: UrlUtil.PG_CONDITIONS_DISEASES})}
			<tr class="text"><td colspan="6">
		`);
		renderer.recursiveRender({entries: cond.entries}, renderStack);
		renderStack.push(`</td></tr>`);

		return renderStack.join("");
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fnGetFluffData: it.__prop === "condition" ? DataUtil.conditionFluff.loadJSON.bind(DataUtil.conditionFluff) : null,
			fluffProp: it.__prop === "condition" ? "conditionFluff" : "diseaseFluff",
		});
	},
};

Renderer.background = {
	getCompactRenderedString (bg) {
		return Renderer.generic.getCompactRenderedString(
			bg,
			{
				dataProp: "background",
				page: UrlUtil.PG_BACKGROUNDS,
			},
		);
	},

	getSkillSummary (skillProfsArr, short, collectIn) {
		return Renderer.background._summariseProfs(skillProfsArr, short, collectIn, `skill`);
	},

	getToolSummary (toolProfsArray, short, collectIn) {
		return Renderer.background._summariseProfs(toolProfsArray, short, collectIn);
	},

	getLanguageSummary (languageProfsArray, short, collectIn) {
		return Renderer.background._summariseProfs(languageProfsArray, short, collectIn);
	},

	_summariseProfs (profGroupArr, short, collectIn, hoverTag) {
		if (!profGroupArr) return "";

		function getEntry (s) {
			return short ? s.toTitleCase() : hoverTag ? `{@${hoverTag} ${s.toTitleCase()}}` : s.toTitleCase();
		}

		function sortKeys (a, b) {
			if (a === b) return 0;
			if (a === "choose") return 1;
			if (b === "choose") return -1;
			return SortUtil.ascSort(a, b);
		}

		return profGroupArr.map(profGroup => {
			let sep = ", ";
			const toJoin = Object.keys(profGroup).sort(sortKeys).filter(k => profGroup[k]).map((k, i) => {
				if (k === "choose") {
					sep = "; ";
					const choose = profGroup[k];
					const chooseProfs = choose.from.map(s => {
						collectIn && !collectIn.includes(s) && collectIn.push(s);
						return getEntry(s);
					});
					return `${short ? `${i === 0 ? "C" : "c"}hoose ` : ""}${choose.count || 1} ${short ? `of` : `from`} ${chooseProfs.joinConjunct(", ", " or ")}`;
				} else {
					collectIn && !collectIn.includes(k) && collectIn.push(k);
					return getEntry(k);
				}
			});
			return toJoin.join(sep);
		}).join(" <i>or</i> ");
	},

	pGetFluff (bg) {
		return Renderer.utils.pGetFluff({
			entity: bg,
			fnGetFluffData: DataUtil.backgroundFluff.loadJSON.bind(DataUtil.backgroundFluff),
			fluffProp: "backgroundFluff",
		});
	},
};

Renderer.backgroundFeature = {
	getCompactRenderedString (ent) {
		return Renderer.generic.getCompactRenderedString(ent);
	},
};

Renderer.optionalfeature = {
	getListPrerequisiteLevelText (prerequisites) {
		if (!prerequisites || !prerequisites.some(it => it.level)) return "\u2014";
		const levelPart = prerequisites.find(it => it.level).level;
		return levelPart.level || levelPart;
	},

	getPreviouslyPrintedText (it) {
		return it.previousVersion ? `<tr><td colspan="6"><p class="mt-2">${Renderer.get().render(`{@i An earlier version of this ${it.featureType.map(t => Parser.optFeatureTypeToFull(t)).join("/")} is available in }${Parser.sourceJsonToFull(it.previousVersion.source)} {@i as {@optfeature ${it.previousVersion.name}|${it.previousVersion.source}}.}`)}</p></td></tr>` : "";
	},

	getTypeText (it) {
		const commonPrefix = it.featureType.length > 1 ? MiscUtil.findCommonPrefix(it.featureType.map(fs => Parser.optFeatureTypeToFull(fs)), {isRespectWordBoundaries: true}) : "";

		return [
			commonPrefix.trim() || null,
			it.featureType.map(ft => Parser.optFeatureTypeToFull(ft).substring(commonPrefix.length)).join("/"),
		].filter(Boolean).join(" ");
	},

	getCompactRenderedString (it) {
		const renderer = Renderer.get();
		const renderStack = [];

		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: it, dataProp: "optionalfeature", page: UrlUtil.PG_OPT_FEATURES})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_OPT_FEATURES})}
			<tr class="text"><td colspan="6">
			${it.prerequisite ? `<p>${Renderer.utils.prerequisite.getHtml(it.prerequisite)}</p>` : ""}
		`);
		renderer.recursiveRender({entries: it.entries}, renderStack, {depth: 1});
		renderStack.push(`</td></tr>`);
		renderStack.push(Renderer.optionalfeature.getPreviouslyPrintedText(it));
		renderStack.push(`<tr><td colspan="6"><p>${Renderer.get().render(`{@note Type: ${Renderer.optionalfeature.getTypeText(it)}}`)}</p></td></tr>`);

		return renderStack.join("");
	},
};

Renderer.reward = {
	getRenderedString: (reward) => {
		const ptSubtitle = [
			(reward.type || "").toTitleCase(),
			reward.rarity ? reward.rarity.toTitleCase() : "",
		].filter(Boolean).join(", ");
		const entries = [
			ptSubtitle ? `{@i ${ptSubtitle}}` : "",
			...reward.entries,
		].filter(Boolean);
		return `<tr class="text"><td colspan="6">${Renderer.get().setFirstSection(true).render({entries}, 1)}</td></tr>`;
	},

	getCompactRenderedString (reward) {
		return `
			${Renderer.utils.getExcludedTr({entity: reward, dataProp: "reward", page: UrlUtil.PG_REWARDS})}
			${Renderer.utils.getNameTr(reward, {page: UrlUtil.PG_REWARDS})}
			${Renderer.reward.getRenderedString(reward)}
		`;
	},
};

Renderer.race = {
	getCompactRenderedString (race, {isStatic = false} = {}) {
		const renderer = Renderer.get();
		const renderStack = [];

		const ability = Renderer.getAbilityData(race.ability);
		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: race, dataProp: "race", page: UrlUtil.PG_RACES})}
			${Renderer.utils.getNameTr(race, {page: UrlUtil.PG_RACES})}
			<tr><td colspan="6">
				<table class="w-100 summary stripe-even-table">
					<tr>
						<th class="col-4 text-center">Ability Scores</th>
						<th class="col-4 text-center">Size</th>
						<th class="col-4 text-center">Speed</th>
					</tr>
					<tr>
						<td class="text-center">${ability.asText}</td>
						<td class="text-center">${(race.size || [Parser.SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")}</td>
						<td class="text-center">${Parser.getSpeedString(race)}</td>
					</tr>
				</table>
			</td></tr>
			<tr class="text"><td colspan="6">
		`);
		race._isBaseRace
			? renderer.recursiveRender({type: "entries", entries: race._baseRaceEntries}, renderStack, {depth: 1})
			: renderer.recursiveRender({type: "entries", entries: race.entries}, renderStack, {depth: 1});
		renderStack.push("</td></tr>");

		const ptHeightWeight = Renderer.race.getHeightAndWeightPart(race, {isStatic});
		if (ptHeightWeight) renderStack.push(`<tr class="text"><td colspan="6"><hr class="rd__hr">${ptHeightWeight}</td></tr>`);

		return renderStack.join("");
	},

	getHeightAndWeightPart (race, {isStatic = false} = {}) {
		if (!race.heightAndWeight) return null;
		if (race._isBaseRace) return null;

		const colLabels = ["Base Height", "Base Weight", "Height Modifier", "Weight Modifier"];
		const colStyles = ["col-2-3 text-center", "col-2-3 text-center", "col-2-3 text-center", "col-2 text-center"];
		const row = [
			Renderer.race.getRenderedHeight(race.heightAndWeight.baseHeight),
			`${race.heightAndWeight.baseWeight} lb.`,
			`+<span data-race-heightmod="true">${race.heightAndWeight.heightMod}</span>`,
			`× <span data-race-weightmod="true">${race.heightAndWeight.weightMod || "1"}</span> lb.`,
		];

		if (!isStatic) {
			colLabels.push("");
			colStyles.push("col-3-1 text-center");
			row.push(`<div class="ve-flex-vh-center">
				<div class="ve-hidden race__disp-result-height-weight ve-flex-v-baseline">
					<div class="mr-1">=</div>
					<div class="race__disp-result-height"></div>
					<div class="mr-2">; </div>
					<div class="race__disp-result-weight mr-1"></div>
					<div class="small">lb.</div>
				</div>
				<button class="btn btn-default btn-xs my-1 race__btn-roll-height-weight">Roll</button>
			</div>`);
		}

		const entries = [
			"You may roll for your character's height and weight on the Random Height and Weight table. The roll in the Height Modifier column adds a number (in inches) to the character's base height. To get a weight, multiply the number you rolled for height by the roll in the Weight Modifier column and add the result (in pounds) to the base weight.",
			{
				type: "table",
				caption: "Random Height and Weight",
				colLabels,
				colStyles,
				rows: [row],
			},
		];

		return Renderer.get().render({entries});
	},

	getRenderedHeight (height) {
		const heightFeet = Number(Math.floor(height / 12).toFixed(3));
		const heightInches = Number((height % 12).toFixed(3));
		return `${heightFeet ? `${heightFeet}'` : ""}${heightInches ? `${heightInches}"` : ""}`;
	},

	/**
	 * @param races
	 * @param [opts] Options object.
	 * @param [opts.isAddBaseRaces] If an entity should be created for each base race.
	 */
	mergeSubraces (races, opts) {
		opts = opts || {};

		const out = [];
		races.forEach(r => {
			// FIXME(Deprecated) Backwards compatibility for old race data; remove at some point
			if (r.size && typeof r.size === "string") r.size = [r.size];

			// Ignore `"lineage": true`, as it is only used for filters
			if (r.lineage && r.lineage !== true) {
				r = MiscUtil.copyFast(r);

				if (r.lineage === "VRGR") {
					r.ability = r.ability || [
						{
							choose: {
								weighted: {
									from: [...Parser.ABIL_ABVS],
									weights: [2, 1],
								},
							},
						},
						{
							choose: {
								weighted: {
									from: [...Parser.ABIL_ABVS],
									weights: [1, 1, 1],
								},
							},
						},
					];
				} else if (r.lineage === "UA1") {
					r.ability = r.ability || [
						{
							choose: {
								weighted: {
									from: [...Parser.ABIL_ABVS],
									weights: [2, 1],
								},
							},
						},
					];
				}

				r.entries = r.entries || [];
				r.entries.push({
					type: "entries",
					name: "Languages",
					entries: ["You can speak, read, and write Common and one other language that you and your DM agree is appropriate for your character."],
				});

				r.languageProficiencies = r.languageProficiencies || [{"common": true, "anyStandard": 1}];
			}

			if (r.subraces && !r.subraces.length) delete r.subraces;

			if (r.subraces) {
				r.subraces.forEach(sr => {
					sr.source = sr.source || r.source;
					sr._isSubRace = true;
				});

				r.subraces.sort((a, b) => SortUtil.ascSortLower(a.name || "_", b.name || "_") || SortUtil.ascSortLower(Parser.sourceJsonToAbv(a.source), Parser.sourceJsonToAbv(b.source)));
			}

			if (opts.isAddBaseRaces && r.subraces) {
				const baseRace = MiscUtil.copyFast(r);

				baseRace._isBaseRace = true;

				const isAnyNoName = r.subraces.some(it => !it.name);
				if (isAnyNoName) {
					baseRace._rawName = baseRace.name;
					baseRace.name = `${baseRace.name} (Base)`;
				}

				const nameCounts = {};
				r.subraces.filter(sr => sr.name).forEach(sr => nameCounts[sr.name.toLowerCase()] = (nameCounts[sr.name.toLowerCase()] || 0) + 1);
				nameCounts._ = r.subraces.filter(sr => !sr.name).length;

				const lst = {
					type: "list",
					items: r.subraces.map(sr => {
						const count = nameCounts[(sr.name || "_").toLowerCase()];
						const idName = Renderer.race.getSubraceName(r.name, sr.name);
						return `{@race ${idName}|${sr.source}${count > 1 ? `|${idName} (<span title="${Parser.sourceJsonToFull(sr.source).escapeQuotes()}">${Parser.sourceJsonToAbv(sr.source)}</span>)` : ""}}`;
					}),
				};

				Renderer.race._mutBaseRaceEntries(baseRace, lst);
				baseRace._subraces = r.subraces.map(sr => ({name: Renderer.race.getSubraceName(r.name, sr.name), source: sr.source}));

				delete baseRace.subraces;

				out.push(baseRace);
			}

			out.push(...Renderer.race._mergeSubraces(r));
		});

		return out;
	},

	_mutMakeBaseRace (baseRace) {
		if (baseRace._isBaseRace) return;

		baseRace._isBaseRace = true;

		Renderer.race._mutBaseRaceEntries(baseRace, {type: "list", items: []});
	},

	_mutBaseRaceEntries (baseRace, lst) {
		baseRace._baseRaceEntries = [
			{
				type: "section",
				entries: [
					"This race has multiple subraces, as listed below:",
					lst,
				],
			},
			{
				type: "section",
				entries: [
					{
						type: "entries",
						entries: [
							{
								type: "entries",
								name: "Traits",
								entries: [
									...MiscUtil.copyFast(baseRace.entries),
								],
							},
						],
					},
				],
			},
		];
	},

	getSubraceName (raceName, subraceName) {
		if (!subraceName) return raceName;

		const mBrackets = /^(.*?)(\(.*?\))$/i.exec(raceName || "");
		if (!mBrackets) return `${raceName} (${subraceName})`;

		const bracketPart = mBrackets[2].substring(1, mBrackets[2].length - 1);
		return `${mBrackets[1]}(${[bracketPart, subraceName].join("; ")})`;
	},

	_mergeSubraces (race) {
		if (!race.subraces) return [race];
		return MiscUtil.copyFast(race.subraces).map(s => Renderer.race._getMergedSubrace(race, s));
	},

	_getMergedSubrace (race, s) {
		const cpy = MiscUtil.copyFast(race);
		cpy._baseName = cpy.name;
		cpy._baseSource = cpy.source;
		cpy._baseSrd = cpy.srd;
		cpy._baseBasicRules = cpy.basicRules;
		delete cpy.subraces;
		delete cpy.srd;
		delete cpy.basicRules;
		delete cpy._versions;
		delete cpy.hasFluff;
		delete cpy.hasFluffImages;

		// merge names, abilities, entries, tags
		if (s.name) {
			cpy._subraceName = s.name;

			if (s.alias) {
				cpy.alias = s.alias.map(it => Renderer.race.getSubraceName(cpy.name, it));
				delete s.alias;
			}

			cpy.name = Renderer.race.getSubraceName(cpy.name, s.name);
			delete s.name;
		}
		if (s.ability) {
			// If the base race doesn't have any ability scores, make a set of empty records
			if ((s.overwrite && s.overwrite.ability) || !cpy.ability) cpy.ability = s.ability.map(() => ({}));

			if (cpy.ability.length !== s.ability.length) throw new Error(`Race and subrace ability array lengths did not match!`);
			s.ability.forEach((obj, i) => Object.assign(cpy.ability[i], obj));
			delete s.ability;
		}
		if (s.entries) {
			s.entries.forEach(e => {
				if (e.data && e.data.overwrite) {
					const toOverwrite = cpy.entries.findIndex(it => it.name.toLowerCase().trim() === e.data.overwrite.toLowerCase().trim());
					if (~toOverwrite) cpy.entries[toOverwrite] = e;
					else cpy.entries.push(e);
				} else {
					cpy.entries.push(e);
				}
			});
			delete s.entries;
		}

		if (s.traitTags) {
			if (s.overwrite && s.overwrite.traitTags) cpy.traitTags = s.traitTags;
			else cpy.traitTags = (cpy.traitTags || []).concat(s.traitTags);
			delete s.traitTags;
		}

		if (s.languageProficiencies) {
			if (s.overwrite && s.overwrite.languageProficiencies) cpy.languageProficiencies = s.languageProficiencies;
			else cpy.languageProficiencies = cpy.languageProficiencies = (cpy.languageProficiencies || []).concat(s.languageProficiencies);
			delete s.languageProficiencies;
		}

		// TODO make a generalised merge system? Probably have one of those lying around somewhere [bestiary schema?]
		if (s.skillProficiencies) {
			// Overwrite if possible
			if (!cpy.skillProficiencies || (s.overwrite && s.overwrite["skillProficiencies"])) cpy.skillProficiencies = s.skillProficiencies;
			else {
				if (!s.skillProficiencies.length || !cpy.skillProficiencies.length) throw new Error(`No items!`);
				if (s.skillProficiencies.length > 1 || cpy.skillProficiencies.length > 1) throw new Error(`Subrace merging does not handle choices!`); // Implement if required

				// Otherwise, merge
				if (s.skillProficiencies.choose) {
					if (cpy.skillProficiencies.choose) throw new Error(`Subrace choose merging is not supported!!`); // Implement if required
					cpy.skillProficiencies.choose = s.skillProficiencies.choose;
					delete s.skillProficiencies.choose;
				}
				Object.assign(cpy.skillProficiencies[0], s.skillProficiencies[0]);
			}

			delete s.skillProficiencies;
		}

		// overwrite everything else
		Object.assign(cpy, s);

		// For any null'd out fields on the subrace, delete the field
		Object.entries(cpy)
			.forEach(([k, v]) => {
				if (v != null) return;
				delete cpy[k];
			});

		return cpy;
	},

	adoptSubraces (allRaces, subraces) {
		const nxtData = [];

		subraces.forEach(sr => {
			if (!sr.raceName || !sr.raceSource) throw new Error(`Subrace was missing parent "raceName" and/or "raceSource"!`);

			const _baseRace = allRaces.find(r => r.name === sr.raceName && r.source === sr.raceSource);
			if (!_baseRace) throw new Error(`Could not find parent race for subrace "${sr.name}" (${sr.source})!`);

			// Avoid adding duplicates, by tracking already-seen subraces
			if ((_baseRace._seenSubraces || []).some(it => it.name === sr.name && it.source === sr.source)) return;
			(_baseRace._seenSubraces = _baseRace._seenSubraces || []).push({name: sr.name, source: sr.source});

			// If this is a prerelease/homebrew "base race" which is not marked as such, upgrade it to a base race
			if (
				!_baseRace._isBaseRace
				&& (PrereleaseUtil.hasSourceJson(_baseRace.source) || BrewUtil2.hasSourceJson(_baseRace.source))
			) {
				Renderer.race._mutMakeBaseRace(_baseRace);
			}

			// If the base race is a _real_ base race, add our new subrace to its list of subraces
			if (_baseRace._isBaseRace) {
				const subraceListEntry = ((_baseRace._baseRaceEntries[0] || {}).entries || []).find(it => it.type === "list");
				subraceListEntry.items.push(`{@race ${_baseRace._rawName || _baseRace.name} (${sr.name})|${sr.source || _baseRace.source}}`);
			}

			// Attempt to graft multiple subraces from the same data set onto the same base race copy
			let baseRace = nxtData.find(r => r.name === sr.raceName && r.source === sr.raceSource);
			if (!baseRace) {
				// copy and remove base-race-specific data
				baseRace = MiscUtil.copyFast(_baseRace);
				if (baseRace._rawName) {
					baseRace.name = baseRace._rawName;
					delete baseRace._rawName;
				}
				delete baseRace._isBaseRace;
				delete baseRace._baseRaceEntries;

				nxtData.push(baseRace);
			}

			baseRace.subraces = baseRace.subraces || [];
			baseRace.subraces.push(sr);
		});

		return nxtData;
	},

	bindListenersHeightAndWeight (race, ele) {
		if (!race.heightAndWeight) return;
		if (race._isBaseRace) return;

		const $render = $(ele);

		const $dispResult = $render.find(`.race__disp-result-height-weight`);
		const $dispHeight = $render.find(`.race__disp-result-height`);
		const $dispWeight = $render.find(`.race__disp-result-weight`);

		const lock = new VeLock();
		let hasRolled = false;
		let resultHeight;
		let resultWeightMod;

		const $btnRollHeight = $render
			.find(`[data-race-heightmod="true"]`)
			.html(race.heightAndWeight.heightMod)
			.addClass("roller")
			.mousedown(evt => evt.preventDefault())
			.click(async () => {
				try {
					await lock.pLock();

					if (!hasRolled) return pDoFullRoll(true);
					await pRollHeight();
					updateDisplay();
				} finally {
					lock.unlock();
				}
			});

		const isWeightRoller = race.heightAndWeight.weightMod && isNaN(race.heightAndWeight.weightMod);
		const $btnRollWeight = $render
			.find(`[data-race-weightmod="true"]`)
			.html(isWeightRoller ? `(<span class="roller">${race.heightAndWeight.weightMod}</span>)` : race.heightAndWeight.weightMod || "1")
			.click(async () => {
				try {
					await lock.pLock();

					if (!hasRolled) return pDoFullRoll(true);
					await pRollWeight();
					updateDisplay();
				} finally {
					lock.unlock();
				}
			});
		if (isWeightRoller) $btnRollWeight.mousedown(evt => evt.preventDefault());

		const $btnRoll = $render
			.find(`button.race__btn-roll-height-weight`)
			.click(async () => pDoFullRoll());

		const pRollHeight = async () => {
			const mResultHeight = await Renderer.dice.pRoll2(race.heightAndWeight.heightMod, {
				isUser: false,
				label: "Height Modifier",
				name: race.name,
			});
			if (mResultHeight == null) return;
			resultHeight = mResultHeight;
		};

		const pRollWeight = async () => {
			const weightModRaw = race.heightAndWeight.weightMod || "1";
			const mResultWeightMod = isNaN(weightModRaw) ? await Renderer.dice.pRoll2(weightModRaw, {
				isUser: false,
				label: "Weight Modifier",
				name: race.name,
			}) : Number(weightModRaw);
			if (mResultWeightMod == null) return;
			resultWeightMod = mResultWeightMod;
		};

		const updateDisplay = () => {
			const renderedHeight = Renderer.race.getRenderedHeight(race.heightAndWeight.baseHeight + resultHeight);
			const totalWeight = race.heightAndWeight.baseWeight + (resultWeightMod * resultHeight);
			$dispHeight.text(renderedHeight);
			$dispWeight.text(Number(totalWeight.toFixed(3)));
		};

		const pDoFullRoll = async isPreLocked => {
			try {
				if (!isPreLocked) await lock.pLock();

				$btnRoll.parent().removeClass(`ve-flex-vh-center`).addClass(`split-v-center`);
				await pRollHeight();
				await pRollWeight();
				$dispResult.removeClass(`ve-hidden`);
				updateDisplay();

				hasRolled = true;
			} finally {
				if (!isPreLocked) lock.unlock();
			}
		};
	},

	bindListenersCompact (race, ele) {
		Renderer.race.bindListenersHeightAndWeight(race, ele);
	},

	pGetFluff (race) {
		return Renderer.utils.pGetFluff({
			entity: race,
			fnGetFluffData: DataUtil.raceFluff.loadJSON.bind(DataUtil.raceFluff),
			fluffProp: "raceFluff",
		});
	},
};

Renderer.raceFeature = {
	getCompactRenderedString (ent) {
		return Renderer.generic.getCompactRenderedString(ent);
	},
};

Renderer.deity = {
	_basePartTranslators: {
		"Alignment": {
			prop: "alignment",
			displayFn: (it) => it.map(a => Parser.alignmentAbvToFull(a)).join(" ").toTitleCase(),
		},
		"Pantheon": {
			prop: "pantheon",
		},
		"Category": {
			prop: "category",
			displayFn: it => typeof it === "string" ? it : it.join(", "),
		},
		"Domains": {
			prop: "domains",
			displayFn: (it) => it.join(", "),
		},
		"Province": {
			prop: "province",
		},
		"Alternate Names": {
			prop: "altNames",
			displayFn: (it) => it.join(", "),
		},
		"Symbol": {
			prop: "symbol",
		},
	},
	getOrderedParts (deity, prefix, suffix) {
		const parts = {};
		Object.entries(Renderer.deity._basePartTranslators).forEach(([k, v]) => {
			const val = deity[v.prop];
			if (val != null) {
				const outVal = v.displayFn ? v.displayFn(val) : val;
				parts[k] = outVal;
			}
		});
		if (deity.customProperties) Object.entries(deity.customProperties).forEach(([k, v]) => parts[k] = v);
		const allKeys = Object.keys(parts).sort(SortUtil.ascSortLower);
		return allKeys.map(k => `${prefix}<b>${k}: </b>${Renderer.get().render(parts[k])}${suffix}`).join("");
	},

	getCompactRenderedString (deity) {
		const renderer = Renderer.get();
		return `
			${Renderer.utils.getExcludedTr({entity: deity, dataProp: "deity", page: UrlUtil.PG_DEITIES})}
			${Renderer.utils.getNameTr(deity, {suffix: deity.title ? `, ${deity.title.toTitleCase()}` : "", page: UrlUtil.PG_DEITIES})}
			<tr><td colspan="6">
				<div class="rd__compact-stat">${Renderer.deity.getOrderedParts(deity, `<p>`, `</p>`)}</div>
			</td>
			${deity.entries ? `<tr><td colspan="6"><div class="border"></div></td></tr><tr><td colspan="6">${renderer.render({entries: deity.entries}, 1)}</td></tr>` : ""}
		`;
	},
};

Renderer.object = {
	CHILD_PROPS: ["actionEntries"],

	getCompactRenderedString (obj, opts) {
		return Renderer.object.getRenderedString(obj, {...opts, isCompact: true});
	},

	getRenderedString (obj, opts) {
		opts = opts || {};

		const renderer = Renderer.get().setFirstSection(true);

		const hasToken = obj.tokenUrl || obj.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["objs__name--token"] : null;

		return `
			${Renderer.utils.getExcludedTr({entity: obj, dataProp: "object", page: opts.page || UrlUtil.PG_OBJECTS})}
			${Renderer.utils.getNameTr(obj, {page: opts.page || UrlUtil.PG_OBJECTS, extraThClasses, isEmbeddedEntity: opts.isEmbeddedEntity})}
			<tr class="text"><td colspan="6"><i>${obj.objectType !== "GEN" ? `${Parser.sizeAbvToFull(obj.size)} ${obj.creatureType ? Parser.monTypeToFullObj(obj.creatureType).asText : "object"}` : `Variable size object`}</i><br></td></tr>
			<tr class="text"><td colspan="6">
				${obj.capCrew != null || obj.capPassenger != null ? `<b>Creature Capacity:</b> ${Renderer.vehicle.getShipCreatureCapacity(obj)}<br>` : ""}
				${obj.capCargo != null ? `<b>Cargo Capacity:</b> ${Renderer.vehicle.getShipCargoCapacity(obj)}</br>` : ""}
				${obj.ac != null ? `<b>Armor Class:</b> ${obj.ac.special ?? obj.ac}<br>` : ""}
				${obj.hp != null ? `<b>Hit Points:</b> ${obj.hp.special ?? obj.hp}<br>` : ""}
				${obj.speed != null ? `<b>Speed:</b> ${Parser.getSpeedString(obj)}<br>` : ""}
				${obj.immune != null ? `<b>Damage Immunities:</b> ${Parser.getFullImmRes(obj.immune)}<br>` : ""}
				${Parser.ABIL_ABVS.some(ab => obj[ab] != null) ? `<b>Ability Scores:</b> ${Parser.ABIL_ABVS.filter(ab => obj[ab] != null).map(ab => renderer.render(`${ab.toUpperCase()} ${Renderer.utils.getAbilityRoller(obj, ab)}`)).join(", ")}` : ""}
				${obj.resist ? `<b>Damage Resistances:</b> ${Parser.getFullImmRes(obj.resist)}<br>` : ""}
				${obj.vulnerable ? `<b>Damage Vulnerabilities:</b> ${Parser.getFullImmRes(obj.vulnerable)}<br>` : ""}
				${obj.conditionImmune ? `<b>Condition Immunities:</b> ${Parser.getFullCondImm(obj.conditionImmune)}<br>` : ""}
			</td></tr>
			<tr class="text"><td colspan="6">
			${obj.entries ? renderer.render({entries: obj.entries}, 2) : ""}
			${obj.actionEntries ? renderer.render({entries: obj.actionEntries}, 2) : ""}
			</td></tr>
		`;
	},

	getTokenUrl (obj) {
		return obj.tokenUrl || UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/objects/tokens/${Parser.sourceJsonToAbv(obj.source)}/${Parser.nameToTokenName(obj.name)}.png`);
	},

	pGetFluff (obj) {
		return Renderer.utils.pGetFluff({
			entity: obj,
			fnGetFluffData: DataUtil.objectFluff.loadJSON.bind(DataUtil.objectFluff),
			fluffProp: "objectFluff",
		});
	},
};

Renderer.trap = {
	CHILD_PROPS: ["trigger", "effect", "eActive", "eDynamic", "eConstant", "countermeasures"],

	_getTrapEntries (it) {
		return [
			// region Shared between simple/complex
			it.trigger ? {
				type: "entries",
				name: "Trigger",
				entries: it.trigger,
			} : null,
			// endregion

			// region Simple traps
			it.effect ? {
				type: "entries",
				name: "Effect",
				entries: it.effect,
			} : null,
			// endregion

			// region Complex traps
			it.initiative ? {
				type: "entries",
				name: "Initiative",
				entries: Renderer.trap.getTrapInitiativeEntries(it),
			} : null,
			it.eActive ? {
				type: "entries",
				name: "Active Elements",
				entries: it.eActive,
			} : null,
			it.eDynamic ? {
				type: "entries",
				name: "Dynamic Elements",
				entries: it.eDynamic,
			} : null,
			it.eConstant ? {
				type: "entries",
				name: "Constant Elements",
				entries: it.eConstant,
			} : null,
			// endregion

			// region Shared between simple/complex
			it.countermeasures ? {
				type: "entries",
				name: "Countermeasures",
				entries: it.countermeasures,
			} : null,
			// endregion
		].filter(Boolean);
	},

	getTrapInitiativeEntries (it) { return [`The trap acts on ${Parser.trapInitToFull(it.initiative)}${it.initiativeNote ? ` (${it.initiativeNote})` : ""}.`]; },

	getRenderedTrapPart (renderer, it) {
		const trapEntries = Renderer.trap._getTrapEntries(it);

		if (!trapEntries.length) return "";

		return renderer.render({
			entries: trapEntries,
		}, 1);
	},

	getCompactRenderedString (it, opts) {
		return Renderer.traphazard.getCompactRenderedString(it, opts);
	},
};

Renderer.hazard = {
	getCompactRenderedString (it, opts) {
		return Renderer.traphazard.getCompactRenderedString(it, opts);
	},
};

Renderer.traphazard = {
	getSubtitle (it) {
		const type = it.trapHazType || "HAZ";
		if (type === "GEN") return null;

		const parenPart = [
			it.tier ? Parser.tierToFullLevel(it.tier) : null,
			Renderer.traphazard.getTrapLevelPart(it),
			it.threat ? `${it.threat} threat` : null,
		].filter(Boolean).join(", ");

		return parenPart ? `${Parser.trapHazTypeToFull(type)} (${parenPart})` : Parser.trapHazTypeToFull(type);
	},

	getTrapLevelPart (it) {
		return it.level?.min != null && it.level?.max != null
			? `level ${it.level.min}${it.level.min !== it.level.max ? `\u2013${it.level.max}` : ""}`
			: null;
	},

	getCompactRenderedString (it, opts) {
		opts = opts || {};

		const renderer = Renderer.get();
		const subtitle = Renderer.traphazard.getSubtitle(it);
		return `
			${Renderer.utils.getExcludedTr({entity: it, dataProp: it.__prop, page: UrlUtil.PG_TRAPS_HAZARDS})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_TRAPS_HAZARDS, isEmbeddedEntity: opts.isEmbeddedEntity})}
			${subtitle ? `<tr class="text"><td colspan="6"><i>${subtitle}</i></td></tr>` : ""}
			<tr class="text"><td colspan="6">
			${renderer.render({entries: it.entries}, 2)}
			${Renderer.trap.getRenderedTrapPart(renderer, it)}
			</td></tr>
		`;
	},
};

Renderer.cultboon = {
	doRenderCultParts (it, renderer, renderStack) {
		if (it.goal || it.cultists || it.signaturespells) {
			const fauxList = {
				type: "list",
				style: "list-hang-notitle",
				items: [],
			};
			if (it.goal) {
				fauxList.items.push({
					type: "item",
					name: "Goals:",
					entry: it.goal.entry,
				});
			}

			if (it.cultists) {
				fauxList.items.push({
					type: "item",
					name: "Typical Cultists:",
					entry: it.cultists.entry,
				});
			}
			if (it.signaturespells) {
				fauxList.items.push({
					type: "item",
					name: "Signature Spells:",
					entry: it.signaturespells.entry,
				});
			}
			renderer.recursiveRender(fauxList, renderStack, {depth: 2});
		}
	},

	doRenderBoonParts (it, renderer, renderStack) {
		const benefits = {type: "list", style: "list-hang-notitle", items: []};
		if (it.ability) {
			benefits.items.push({
				type: "item",
				name: "Ability Score Adjustment:",
				entry: it.ability ? it.ability.entry : "None",
			});
		}
		if (it.signaturespells) {
			benefits.items.push({
				type: "item",
				name: "Signature Spells:",
				entry: it.signaturespells ? it.signaturespells.entry : "None",
			});
		}
		if (benefits.items.length) renderer.recursiveRender(benefits, renderStack, {depth: 1});
	},

	getCompactRenderedString (it) {
		const renderer = Renderer.get();

		const renderStack = [];
		if (it.__prop === "cult") {
			Renderer.cultboon.doRenderCultParts(it, renderer, renderStack);
			renderer.recursiveRender({entries: it.entries}, renderStack, {depth: 2});
			return `
			${Renderer.utils.getExcludedTr({entity: it, dataProp: "cult", page: UrlUtil.PG_CULTS_BOONS})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_CULTS_BOONS})}
			<tr id="text"><td class="divider" colspan="6"><div></div></td></tr>
			<tr class="text"><td colspan="6" class="text">${renderStack.join("")}</td></tr>`;
		} else if (it.__prop === "boon") {
			Renderer.cultboon.doRenderBoonParts(it, renderer, renderStack);
			renderer.recursiveRender({entries: it.entries}, renderStack, {depth: 1});
			it._displayName = it._displayName || it.name;
			return `
			${Renderer.utils.getExcludedTr({entity: it, dataProp: "boon", page: UrlUtil.PG_CULTS_BOONS})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_CULTS_BOONS})}
			<tr class="text"><td colspan="6">${renderStack.join("")}</td></tr>`;
		}
	},
};

Renderer.monster = {
	CHILD_PROPS: ["action", "bonus", "reaction", "trait", "legendary", "mythic", "variant", "spellcasting"],

	getShortName (mon, {isTitleCase = false, isSentenceCase = false, isUseDisplayName = false} = {}) {
		const name = isUseDisplayName ? (mon._displayName ?? mon.name) : mon.name;
		const shortName = isUseDisplayName ? (mon._displayShortName ?? mon.shortName) : mon.shortName;

		const prefix = mon.isNamedCreature ? "" : isTitleCase || isSentenceCase ? "The " : "the ";
		if (shortName === true) return `${prefix}${name}`;
		else if (shortName) return `${prefix}${!prefix && isTitleCase ? shortName.toTitleCase() : shortName.toLowerCase()}`;

		const out = Renderer.monster.getShortNameFromName(name, {isNamedCreature: mon.isNamedCreature});
		return `${prefix}${out}`;
	},

	getShortNameFromName (name, {isNamedCreature = false} = {}) {
		const base = name.split(",")[0];
		let out = base
			.replace(/(?:adult|ancient|young) \w+ (dragon|dracolich)/gi, "$1");
		out = isNamedCreature ? out.split(" ")[0] : out.toLowerCase();
		return out;
	},

	getLegendaryActionIntro (mon, {renderer = Renderer.get(), isUseDisplayName = false} = {}) {
		if (mon.legendaryHeader) {
			return renderer.render({entries: mon.legendaryHeader});
		} else {
			const legendaryActions = mon.legendaryActions || 3;
			const legendaryNameTitle = Renderer.monster.getShortName(mon, {isTitleCase: true, isUseDisplayName});
			return `${legendaryNameTitle} can take ${legendaryActions} legendary action${legendaryActions > 1 ? "s" : ""}, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. ${legendaryNameTitle} regains spent legendary actions at the start of its turn.`;
		}
	},

	getSectionIntro (mon, {renderer = Renderer.get(), prop}) {
		const headerProp = `${prop}Header`;
		if (mon[headerProp]) return renderer.render({entries: mon[headerProp]});
		return "";
	},

	getSave (renderer, attr, mod) {
		if (attr === "special") return renderer.render(mod);
		return renderer.render(`<span>${attr.uppercaseFirst()} {@savingThrow ${attr} ${mod}}</span>`);
	},

	dragonCasterVariant: {
		// Community-created (legacy)
		_LVL_TO_COLOR_TO_SPELLS__UNOFFICIAL: {
			2: {
				black: ["darkness", "Melf's acid arrow", "fog cloud", "scorching ray"],
				green: ["ray of sickness", "charm person", "detect thoughts", "invisibility", "suggestion"],
				white: ["ice knife|XGE", "Snilloc's snowball swarm|XGE"],
				brass: ["see invisibility", "magic mouth", "blindness/deafness", "sleep", "detect thoughts"],
				bronze: ["gust of wind", "misty step", "locate object", "blur", "witch bolt", "thunderwave", "shield"],
				copper: ["knock", "sleep", "detect thoughts", "blindness/deafness", "tasha's hideous laughter"],
			},
			3: {
				blue: ["wall of sand|XGE", "thunder step|XGE", "lightning bolt", "blink", "magic missile", "slow"],
				red: ["fireball", "scorching ray", "haste", "erupting earth|XGE", "Aganazzar's scorcher|XGE"],
				gold: ["slow", "fireball", "dispel magic", "counterspell", "Aganazzar's scorcher|XGE", "shield"],
				silver: ["sleet storm", "protection from energy", "catnap|XGE", "locate object", "identify", "Leomund's tiny hut"],
			},
			4: {
				black: ["vitriolic sphere|XGE", "sickening radiance|XGE", "Evard's black tentacles", "blight", "hunger of Hadar"],
				white: ["fire shield", "ice storm", "sleet storm"],
				brass: ["charm monster|XGE", "sending", "wall of sand|XGE", "hypnotic pattern", "tongues"],
				copper: ["polymorph", "greater invisibility", "confusion", "stinking cloud", "major image", "charm monster|XGE"],
			},
			5: {
				blue: ["telekinesis", "hold monster", "dimension door", "wall of stone", "wall of force"],
				green: ["cloudkill", "charm monster|XGE", "modify memory", "mislead", "hallucinatory terrain", "dimension door"],
				bronze: ["steel wind strike|XGE", "control winds|XGE", "watery sphere|XGE", "storm sphere|XGE", "tidal wave|XGE"],
				gold: ["hold monster", "immolation|XGE", "wall of fire", "greater invisibility", "dimension door"],
				silver: ["cone of cold", "ice storm", "teleportation circle", "skill empowerment|XGE", "creation", "Mordenkainen's private sanctum"],
			},
			6: {
				white: ["cone of cold", "wall of ice"],
				brass: ["scrying", "Rary's telepathic bond", "Otto's irresistible dance", "legend lore", "hold monster", "dream"],
			},
			7: {
				black: ["power word pain|XGE", "finger of death", "disintegrate", "hold monster"],
				blue: ["chain lightning", "forcecage", "teleport", "etherealness"],
				green: ["project image", "mirage arcane", "prismatic spray", "teleport"],
				bronze: ["whirlwind|XGE", "chain lightning", "scatter|XGE", "teleport", "disintegrate", "lightning bolt"],
				copper: ["symbol", "simulacrum", "reverse gravity", "project image", "Bigby's hand", "mental prison|XGE", "seeming"],
				silver: ["Otiluke's freezing sphere", "prismatic spray", "wall of ice", "contingency", "arcane gate"],
			},
			8: {
				gold: ["sunburst", "delayed blast fireball", "antimagic field", "teleport", "globe of invulnerability", "maze"],
			},
		},
		// From Fizban's Treasury of Dragons
		_LVL_TO_COLOR_TO_SPELLS__FTD: {
			1: {
				deep: ["command", "dissonant whispers", "faerie fire"],
			},
			2: {
				black: ["blindness/deafness", "create or destroy water"],
				green: ["invisibility", "speak with animals"],
				white: ["gust of wind"],
				brass: ["create or destroy water", "speak with animals"],
				bronze: ["beast sense", "detect thoughts", "speak with animals"],
				copper: ["lesser restoration", "phantasmal force"],
			},
			3: {
				blue: ["create or destroy water", "major image"],
				red: ["bane", "heat metal", "hypnotic pattern", "suggestion"],
				gold: ["bless", "cure wounds", "slow", "suggestion", "zone of truth"],
				silver: ["beacon of hope", "calm emotions", "hold person", "zone of truth"],
				deep: ["command", "dissonant whispers", "faerie fire", "water breathing"],
			},
			4: {
				black: ["blindness/deafness", "create or destroy water", "plant growth"],
				white: ["gust of wind"],
				brass: ["create or destroy water", "speak with animals", "suggestion"],
				copper: ["lesser restoration", "phantasmal force", "stone shape"],
			},
			5: {
				blue: ["arcane eye", "create or destroy water", "major image"],
				red: ["bane", "dominate person", "heat metal", "hypnotic pattern", "suggestion"],
				green: ["invisibility", "plant growth", "speak with animals"],
				bronze: ["beast sense", "control water", "detect thoughts", "speak with animals"],
				gold: ["bless", "commune", "cure wounds", "geas", "slow", "suggestion", "zone of truth"],
				silver: ["beacon of hope", "calm emotions", "hold person", "polymorph", "zone of truth"],
			},
			6: {
				white: ["gust of wind", "ice storm"],
				brass: ["create or destroy water", "locate creature", "speak with animals", "suggestion"],
				deep: ["command", "dissonant whispers", "faerie fire", "passwall", "water breathing"],
			},
			7: {
				black: ["blindness/deafness", "create or destroy water", "insect plague", "plant growth"],
				blue: ["arcane eye", "create or destroy water", "major image", "project image"],
				red: ["bane", "dominate person", "heat metal", "hypnotic pattern", "power word stun", "suggestion"],
				green: ["invisibility", "mass suggestion", "plant growth", "speak with animals"],
				bronze: ["beast sense", "control water", "detect thoughts", "heroes' feast", "speak with animals"],
				copper: ["lesser restoration", "move earth", "phantasmal force", "stone shape"],
				silver: ["beacon of hope", "calm emotions", "hold person", "polymorph", "teleport", "zone of truth"],
			},
			8: {
				gold: ["bless", "commune", "cure wounds", "geas", "plane shift", "slow", "suggestion", "word of recall", "zone of truth"],
			},
		},

		getAvailableColors () {
			const out = new Set();

			const add = (lookup) => Object.values(lookup).forEach(obj => Object.keys(obj).forEach(k => out.add(k)));
			add(Renderer.monster.dragonCasterVariant._LVL_TO_COLOR_TO_SPELLS__UNOFFICIAL);
			add(Renderer.monster.dragonCasterVariant._LVL_TO_COLOR_TO_SPELLS__FTD);

			return [...out].sort(SortUtil.ascSortLower);
		},

		hasCastingColorVariant (dragon) {
			// if the dragon already has a spellcasting trait specified, don't add a note about adding a spellcasting trait
			return dragon.dragonCastingColor && !dragon.spellcasting;
		},

		getMeta (dragon) {
			const chaMod = Parser.getAbilityModNumber(dragon.cha);
			const pb = Parser.crToPb(dragon.cr);
			const maxSpellLevel = Math.floor(Parser.crToNumber(dragon.cr) / 3);

			return {
				chaMod,
				pb,
				maxSpellLevel,
				spellSaveDc: pb + chaMod + 8,
				spellToHit: pb + chaMod,
				exampleSpellsUnofficial: Renderer.monster.dragonCasterVariant._getMeta_getExampleSpells({
					dragon,
					maxSpellLevel,
					spellLookup: Renderer.monster.dragonCasterVariant._LVL_TO_COLOR_TO_SPELLS__UNOFFICIAL,
				}),
				exampleSpellsFtd: Renderer.monster.dragonCasterVariant._getMeta_getExampleSpells({
					dragon,
					maxSpellLevel,
					spellLookup: Renderer.monster.dragonCasterVariant._LVL_TO_COLOR_TO_SPELLS__FTD,
				}),
			};
		},

		_getMeta_getExampleSpells ({dragon, maxSpellLevel, spellLookup}) {
			if (spellLookup[maxSpellLevel]?.[dragon.dragonCastingColor]) return spellLookup[maxSpellLevel][dragon.dragonCastingColor];

			// If there's no exact match, try to find the next lowest
			const flatKeys = Object.entries(spellLookup)
				.map(([lvl, group]) => {
					return Object.keys(group)
						.map(color => `${lvl}${color}`);
				})
				.flat()
				.mergeMap(it => ({[it]: true}));

			while (--maxSpellLevel > -1) {
				const lookupKey = `${maxSpellLevel}${dragon.dragonCastingColor}`;
				if (flatKeys[lookupKey]) return spellLookup[maxSpellLevel][dragon.dragonCastingColor];
			}
			return [];
		},

		getSpellcasterDetailsPart ({chaMod, maxSpellLevel, spellSaveDc, spellToHit, isSeeSpellsPageNote = false}) {
			const levelString = maxSpellLevel === 0 ? `${chaMod === 1 ? "This" : "These"} spells are Cantrips.` : `${chaMod === 1 ? "The" : "Each"} spell's level can be no higher than ${Parser.spLevelToFull(maxSpellLevel)}.`;

			return `This dragon can innately cast ${Parser.numberToText(chaMod)} spell${chaMod === 1 ? "" : "s"}, once per day${chaMod === 1 ? "" : " each"}, requiring no material components. ${levelString} The dragon's spell save DC is {@dc ${spellSaveDc}}, and it has {@hit ${spellToHit}} to hit with spell attacks.${isSeeSpellsPageNote ? ` See the {@filter spell page|spells|level=${[...new Array(maxSpellLevel + 1)].map((it, i) => i).join(";")}} for a list of spells the dragon is capable of casting.` : ""}`;
		},

		getVariantEntries (dragon) {
			if (!Renderer.monster.dragonCasterVariant.hasCastingColorVariant(dragon)) return [];

			const meta = Renderer.monster.dragonCasterVariant.getMeta(dragon);
			const {exampleSpellsUnofficial, exampleSpellsFtd} = meta;

			const vFtd = exampleSpellsFtd?.length ? {
				type: "variant",
				name: "Dragons as Innate Spellcasters",
				source: Parser.SRC_FTD,
				entries: [
					`${Renderer.monster.dragonCasterVariant.getSpellcasterDetailsPart(meta)}`,
					`A suggested spell list is shown below, but you can also choose spells to reflect the dragon's character. A dragon who innately casts {@filter druid|spells|class=druid} spells feels different from one who casts {@filter warlock|spells|class=warlock} spells. You can also give a dragon spells of a higher level than this rule allows, but such a tweak might increase the dragon's challenge rating\u2014especially if those spells deal damage or impose conditions on targets.`,
					{
						type: "list",
						items: exampleSpellsFtd.map(it => `{@spell ${it}}`),
					},
				],
			} : null;

			const vBasic = {
				type: "variant",
				name: "Dragons as Innate Spellcasters",
				entries: [
					"Dragons are innately magical creatures that can master a few spells as they age, using this variant.",
					`A young or older dragon can innately cast a number of spells equal to its Charisma modifier. Each spell can be cast once per day, requiring no material components, and the spell's level can be no higher than one-third the dragon's challenge rating (rounded down). The dragon's bonus to hit with spell attacks is equal to its proficiency bonus + its Charisma bonus. The dragon's spell save DC equals 8 + its proficiency bonus + its Charisma modifier.`,
					`{@note ${Renderer.monster.dragonCasterVariant.getSpellcasterDetailsPart({...meta, isSeeSpellsPageNote: true})}${exampleSpellsUnofficial?.length ? ` A selection of examples are shown below:` : ""}}`,
				],
			};
			if (dragon.source !== Parser.SRC_MM) {
				vBasic.source = Parser.SRC_MM;
				vBasic.page = 86;
			}
			if (exampleSpellsUnofficial) {
				const ls = {
					type: "list",
					style: "list-italic",
					items: exampleSpellsUnofficial.map(it => `{@spell ${it}}`),
				};
				vBasic.entries.push(ls);
			}

			return [vFtd, vBasic].filter(Boolean);
		},

		getHtml (dragon, {renderer = null} = {}) {
			const variantEntrues = Renderer.monster.dragonCasterVariant.getVariantEntries(dragon);
			if (!variantEntrues.length) return null;
			return variantEntrues.map(it => renderer.render(it)).join("");
		},
	},

	getCrScaleTarget (
		{
			win,
			$btnScale,
			initialCr,
			cbRender,
			isCompact,
		},
	) {
		const evtName = "click.cr-scaler";

		let slider;

		const $body = $(win.document.body);
		function cleanSliders () {
			$body.find(`.mon__cr_slider_wrp`).remove();
			$btnScale.off(evtName);
			if (slider) slider.destroy();
		}

		cleanSliders();

		const $wrp = $(`<div class="mon__cr_slider_wrp ${isCompact ? "mon__cr_slider_wrp--compact" : ""}"></div>`);

		const cur = Parser.CRS.indexOf(initialCr);
		if (cur === -1) throw new Error(`Initial CR ${initialCr} was not valid!`);

		const comp = BaseComponent.fromObject({
			min: 0,
			max: Parser.CRS.length - 1,
			cur,
		});
		slider = new ComponentUiUtil.RangeSlider({
			comp,
			propMin: "min",
			propMax: "max",
			propCurMin: "cur",
			fnDisplay: ix => Parser.CRS[ix],
		});
		slider.$get().appendTo($wrp);

		$btnScale.off(evtName).on(evtName, (evt) => evt.stopPropagation());
		$wrp.on(evtName, (evt) => evt.stopPropagation());
		$body.off(evtName).on(evtName, cleanSliders);

		comp._addHookBase("cur", () => {
			cbRender(Parser.crToNumber(Parser.CRS[comp._state.cur]));
			$body.off(evtName);
			cleanSliders();
		});

		$btnScale.after($wrp);
	},

	getSelSummonSpellLevel (mon) {
		if (mon.summonedBySpellLevel == null) return;

		return e_({
			tag: "select",
			clazz: "input-xs form-control form-control--minimal w-initial inline-block ve-popwindow__hidden",
			name: "mon__sel-summon-spell-level",
			children: [
				e_({tag: "option", val: "-1", text: "\u2014"}),
				...[...new Array(VeCt.SPELL_LEVEL_MAX + 1 - mon.summonedBySpellLevel)].map((_, i) => e_({
					tag: "option",
					val: i + mon.summonedBySpellLevel,
					text: i + mon.summonedBySpellLevel,
				})),
			],
		});
	},

	getSelSummonClassLevel (mon) {
		if (mon.summonedByClass == null) return;

		return e_({
			tag: "select",
			clazz: "input-xs form-control form-control--minimal w-initial inline-block ve-popwindow__hidden",
			name: "mon__sel-summon-class-level",
			children: [
				e_({tag: "option", val: "-1", text: "\u2014"}),
				...[...new Array(VeCt.LEVEL_MAX)].map((_, i) => e_({
					tag: "option",
					val: i + 1,
					text: i + 1,
				})),
			],
		});
	},

	getCompactRenderedStringSection (mon, renderer, title, key, depth) {
		if (!mon[key]) return "";

		const noteKey = `${key}Note`;

		const toRender = key === "lairActions" || key === "regionalEffects"
			? [{type: "entries", entries: mon[key]}]
			: mon[key];

		const ptHeader = mon[key] ? Renderer.monster.getSectionIntro(mon, {prop: key}) : "";

		return `<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">${title}${mon[noteKey] ? ` (<span class="ve-small">${mon[noteKey]}</span>)` : ""}</h3></td></tr>
		<tr class="text"><td colspan="6">
		${key === "legendary" && mon.legendary ? `<p>${Renderer.monster.getLegendaryActionIntro(mon)}</p>` : ""}
		${ptHeader ? `<p>${ptHeader}</p>` : ""}
		${toRender.map(it => it.rendered || renderer.render(it, depth)).join("")}
		</td></tr>`;
	},

	getTypeAlignmentPart (mon) {
		const typeObj = Parser.monTypeToFullObj(mon.type);

		return `${mon.level ? `${Parser.getOrdinalForm(mon.level)}-level ` : ""}${typeObj.asTextSidekick ? `${typeObj.asTextSidekick}; ` : ""}${Renderer.utils.getRenderedSize(mon.size)}${mon.sizeNote ? ` ${mon.sizeNote}` : ""} ${typeObj.asText}${mon.alignment ? `, ${mon.alignmentPrefix ? Renderer.get().render(mon.alignmentPrefix) : ""}${Parser.alignmentListToFull(mon.alignment).toTitleCase()}` : ""}`;
	},
	getSavesPart (mon) { return `${Object.keys(mon.save || {}).sort(SortUtil.ascSortAtts).map(s => Renderer.monster.getSave(Renderer.get(), s, mon.save[s])).join(", ")}`; },
	getSensesPart (mon) { return `${mon.senses ? `${Renderer.monster.getRenderedSenses(mon.senses)}, ` : ""}passive Perception ${mon.passive || "\u2014"}`; },

	getRenderWithPlugins ({renderer, mon, fn}) {
		return renderer.withPlugin({
			pluginTypes: [
				"dice",
			],
			fnPlugin: () => {
				if (mon.summonedBySpellLevel == null && mon._summonedByClass_level == null) return null;
				if (mon._summonedByClass_level) {
					return {
						additionalData: {
							"data-summoned-by-class-level": mon._summonedByClass_level,
						},
					};
				}
				return {
					additionalData: {
						"data-summoned-by-spell-level": mon._summonedBySpell_level ?? mon.summonedBySpellLevel,
					},
				};
			},
			fn,
		});
	},

	/**
	 * @param mon
	 * @param [opts]
	 * @param [opts.isCompact]
	 * @param [opts.isEmbeddedEntity]
	 * @param [opts.isShowScalers]
	 * @param [opts.isScaledCr]
	 * @param [opts.isScaledSpellSummon]
	 * @param [opts.isScaledClassSummon]
	 */
	getCompactRenderedString (mon, opts) {
		const renderer = Renderer.get();
		return Renderer.monster.getRenderWithPlugins({
			renderer,
			mon,
			fn: () => Renderer.monster._getCompactRenderedString(mon, renderer, opts),
		});
	},

	_getCompactRenderedString (mon, renderer, opts) {
		opts = opts || {};
		if (opts.isCompact === undefined) opts.isCompact = true;

		const renderStack = [];
		const legGroup = DataUtil.monster.getMetaGroup(mon);
		const hasToken = mon.tokenUrl || mon.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["mon__name--token"] : null;

		const isCr = Parser.crToNumber(mon.cr) !== VeCt.CR_UNKNOWN;
		const isShowSpellLevelScaler = opts.isShowScalers && !isCr && mon.summonedBySpellLevel != null;
		const isShowClassLevelScaler = opts.isShowScalers && !isShowSpellLevelScaler && mon.summonedByClass != null;

		const fnGetSpellTraits = Renderer.monster.getSpellcastingRenderedTraits.bind(Renderer.monster, renderer);
		const allTraits = Renderer.monster.getOrderedTraits(mon, {fnGetSpellTraits});
		const allActions = Renderer.monster.getOrderedActions(mon, {fnGetSpellTraits});

		let ptCrSpellLevel = `<td colspan="2">\u2014</td>`;
		if (isShowSpellLevelScaler || isShowClassLevelScaler) {
			// Note that `outerHTML` ignores the value of the select, so we cannot e.g. select the correct option
			//   here and expect to return it in the HTML.
			const selHtml = isShowSpellLevelScaler ? Renderer.monster.getSelSummonSpellLevel(mon)?.outerHTML : Renderer.monster.getSelSummonClassLevel(mon)?.outerHTML;
			ptCrSpellLevel = `<td colspan="2">${selHtml || ""}</td>`;
		} else if (isCr && ScaleCreature.isCrInScaleRange(mon)) {
			ptCrSpellLevel = `<td colspan="2">
				${Parser.monCrToFull(mon.cr, {isMythic: !!mon.mythic})}
				${opts.isShowScalers && !opts.isScaledCr && Parser.isValidCr(mon.cr ? (mon.cr.cr || mon.cr) : null) ? `
				<button title="Scale Creature By CR (Highly Experimental)" class="mon__btn-scale-cr btn btn-xs btn-default">
					<span class="glyphicon glyphicon-signal"></span>
				</button>
				` : ""}
				${opts.isScaledCr ? `
				<button title="Reset CR Scaling" class="mon__btn-reset-cr btn btn-xs btn-default">
					<span class="glyphicon glyphicon-refresh"></span>
				</button>
				` : ""}
			</td>`;
		}

		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: mon, dataProp: "monster", page: opts.page || UrlUtil.PG_BESTIARY})}
			${Renderer.utils.getNameTr(mon, {page: opts.page || UrlUtil.PG_BESTIARY, extensionData: {_scaledCr: mon._scaledCr, _scaledSpellSummonLevel: mon._scaledSpellSummonLevel, _scaledClassSummonLevel: mon._scaledClassSummonLevel}, extraThClasses, isEmbeddedEntity: opts.isEmbeddedEntity})}
			<tr><td colspan="6"><i>${Renderer.monster.getTypeAlignmentPart(mon)}</i></td></tr>
			<tr><td colspan="6"><div class="border"></div></td></tr>
			<tr><td colspan="6">
				<table class="w-100 summary-noback relative table-layout-fixed my-1">
					<tr>
						<th colspan="2">Armor Class</th>
						<th colspan="2">Hit Points</th>
						<th colspan="2">Speed</th>
						<th colspan="2">${isShowSpellLevelScaler ? "Spell Level" : isShowClassLevelScaler ? "Class Level" : "Challenge"}</th>
						${mon.pbNote || Parser.crToNumber(mon.cr) < VeCt.CR_CUSTOM ? `<th colspan="1" title="Proficiency Bonus">PB</th>` : ""}
						${hasToken && !opts.isCompact ? `<th colspan="1"></th>` : ""}
					</tr>
					<tr>
						<td colspan="2">${Parser.acToFull(mon.ac)}</td>
						<td colspan="2">${Renderer.monster.getRenderedHp(mon.hp)}</td>
						<td colspan="2">${Parser.getSpeedString(mon)}</td>
						${ptCrSpellLevel}
						${mon.pbNote || Parser.crToNumber(mon.cr) < VeCt.CR_CUSTOM ? `<td colspan="1">${mon.pbNote ?? UiUtil.intToBonus(Parser.crToPb(mon.cr), {isPretty: true})}</td>` : ""}
						${hasToken && !opts.isCompact ? `<td colspan="1"></td>` : ""}
					</tr>
				</table>
			</td></tr>
			<tr><td colspan="6"><div class="border mb-1"></div></td></tr>
			${Renderer.monster.getRenderedAbilityScores(mon)}
			<tr><td colspan="6"><div class="border mt-1"></div></td></tr>
			<tr><td colspan="6">
				<div class="rd__compact-stat mt-2">
					${mon.resource ? mon.resource.map(res => `<p><b>${res.name}</b> ${Renderer.monster.getRenderedResource(res)}</p>`).join("") : ""}
					${mon.save ? `<p><b>Saving Throws</b> ${Renderer.monster.getSavesPart(mon)}</p>` : ""}
					${mon.skill ? `<p><b>Skills</b> ${Renderer.monster.getSkillsString(renderer, mon)}</p>` : ""}
					${mon.vulnerable ? `<p><b>Damage Vuln.</b> ${Parser.getFullImmRes(mon.vulnerable)}</p>` : ""}
					${mon.resist ? `<p><b>Damage Res.</b> ${Parser.getFullImmRes(mon.resist)}</p>` : ""}
					${mon.immune ? `<p><b>Damage Imm.</b> ${Parser.getFullImmRes(mon.immune)}</p>` : ""}
					${mon.conditionImmune ? `<p><b>Condition Imm.</b> ${Parser.getFullCondImm(mon.conditionImmune)}</p>` : ""}
					${opts.isHideSenses ? "" : `<p><b>Senses</b> ${Renderer.monster.getSensesPart(mon)}</p>`}
					${opts.isHideLanguages ? "" : `<p><b>Languages</b> ${Renderer.monster.getRenderedLanguages(mon.languages)}</p>`}
				</div>
			</td></tr>
			${allTraits ? `<tr><td colspan="6"><div class="border"></div></td></tr>
			<tr class="text"><td colspan="6">
			${allTraits.map(it => it.rendered || renderer.render(it, 2)).join("")}
			</td></tr>` : ""}
			${Renderer.monster.getCompactRenderedStringSection({...mon, action: allActions}, renderer, "Actions", "action", 2)}
			${Renderer.monster.getCompactRenderedStringSection(mon, renderer, "Bonus Actions", "bonus", 2)}
			${Renderer.monster.getCompactRenderedStringSection(mon, renderer, "Reactions", "reaction", 2)}
			${Renderer.monster.getCompactRenderedStringSection(mon, renderer, "Legendary Actions", "legendary", 2)}
			${Renderer.monster.getCompactRenderedStringSection(mon, renderer, "Mythic Actions", "mythic", 2)}
			${legGroup && legGroup.lairActions ? Renderer.monster.getCompactRenderedStringSection(legGroup, renderer, "Lair Actions", "lairActions", 1) : ""}
			${legGroup && legGroup.regionalEffects ? Renderer.monster.getCompactRenderedStringSection(legGroup, renderer, "Regional Effects", "regionalEffects", 1) : ""}
			${mon.variant || (mon.dragonCastingColor && !mon.spellcasting) || mon.summonedBySpell ? `
			<tr class="text"><td colspan="6">
			${mon.variant ? mon.variant.map(it => it.rendered || renderer.render(it)).join("") : ""}
			${mon.dragonCastingColor ? Renderer.monster.dragonCasterVariant.getHtml(mon, {renderer}) : ""}
			${mon.footer ? renderer.render({entries: mon.footer}) : ""}
			${mon.summonedBySpell ? `<div><b>Summoned By:</b> ${renderer.render(`{@spell ${mon.summonedBySpell}}`)}<div>` : ""}
			</td></tr>
			` : ""}
		`);

		return renderStack.join("");
	},

	_getFormulaMax (formula) {
		return Renderer.dice.parseRandomise2(`dmax(${formula})`);
	},

	getRenderedHp: (hp, isPlainText) => {
		if (hp.special != null) return isPlainText ? Renderer.stripTags(hp.special) : Renderer.get().render(hp.special);

		if (/^\d+d1$/.exec(hp.formula)) {
			return hp.average;
		}

		if (isPlainText) return `${hp.average} (${hp.formula})`;

		const maxVal = Renderer.monster._getFormulaMax(hp.formula);
		const maxStr = maxVal ? `Maximum: ${maxVal}` : "";
		return `${maxStr ? `<span title="${maxStr}" class="help-subtle">` : ""}${hp.average}${maxStr ? "</span>" : ""} ${Renderer.get().render(`({@dice ${hp.formula}|${hp.formula}|Hit Points})`)}`;
	},

	getRenderedResource (res, isPlainText) {
		if (!res.formula) return `${res.value}`;

		if (isPlainText) return `${res.value} (${res.formula})`;

		const maxVal = Renderer.monster._getFormulaMax(res.formula);
		const maxStr = maxVal ? `Maximum: ${maxVal}` : "";
		return `${maxStr ? `<span title="${maxStr}" class="help-subtle">` : ""}${res.value}${maxStr ? "</span>" : ""} ${Renderer.get().render(`({@dice ${res.formula}|${res.formula}|${res.name}})`)}`;
	},

	getSafeAbilityScore (mon, abil, {isDefaultTen = false} = {}) {
		if (!mon) return isDefaultTen ? 10 : 0;
		if (mon[abil] == null) return isDefaultTen ? 10 : 0;
		return typeof mon[abil] === "number" ? mon[abil] : (isDefaultTen ? 10 : 0);
	},

	getRenderedAbilityScores (mon) {
		const byAbil = {};
		const byValue = {};

		Parser.ABIL_ABVS
			.forEach(ab => {
				if (mon[ab] == null || typeof mon[ab] === "number") return;

				const meta = {abil: ab, value: mon[ab].special};
				byAbil[meta.abil] = meta;
				meta.family = (byValue[meta.value] = byValue[meta.value] || []);
				meta.family.push(meta);
			});

		const seenAbs = new Set();
		const ptSpecial = Parser.ABIL_ABVS
			.map(ab => {
				const meta = byAbil[ab];
				if (!meta) return null;
				if (seenAbs.has(meta.abil)) return null;
				meta.family.forEach(meta => seenAbs.add(meta.abil));
				return `<b>${meta.family.map(meta => meta.abil.toUpperCase()).join(", ")}</b> ${meta.value}`;
			})
			.filter(Boolean)
			.map(r => `<tr><td colspan="6">${r}</td></tr>`).join("");

		if (Parser.ABIL_ABVS.every(ab => mon[ab] != null && typeof mon[ab] !== "number")) return ptSpecial;

		const absRemaining = Parser.ABIL_ABVS.filter(ab => !seenAbs.has(ab));

		return `<tr>
			${absRemaining.map(ab => `<th class="col-2 text-center bold">${ab.toUpperCase()}</th>`).join("")}
		</tr>
		<tr>
			${absRemaining.map(ab => `<td class="text-center">${Renderer.utils.getAbilityRoller(mon, ab)}</td>`).join("")}
		</tr>`;
	},

	getSpellcastingRenderedTraits: (renderer, mon, displayAsProp = "trait") => {
		const out = [];
		(mon.spellcasting || []).filter(it => (it.displayAs || "trait") === displayAsProp).forEach(entry => {
			entry.type = entry.type || "spellcasting";
			const renderStack = [];
			renderer.recursiveRender(entry, renderStack, {depth: 2});
			out.push({name: entry.name, rendered: renderStack.join("")});
		});
		return out;
	},

	getOrderedTraits (mon, {fnGetSpellTraits} = {}) {
		let traits = mon.trait ? MiscUtil.copyFast(mon.trait) : null;

		if (fnGetSpellTraits) {
			const spellTraits = fnGetSpellTraits(mon, "trait");
			if (spellTraits.length) traits = traits ? traits.concat(spellTraits) : spellTraits;
		}

		if (traits?.length) return traits.sort((a, b) => SortUtil.monTraitSort(a, b));
	},

	getOrderedActions (mon, {fnGetSpellTraits} = {}) {
		let actions = mon.action ? MiscUtil.copyFast(mon.action) : null;

		let spellActions;
		if (fnGetSpellTraits) {
			spellActions = fnGetSpellTraits(mon, "action");
		}

		if (!spellActions?.length && !actions?.length) return null;
		if (!actions?.length) return spellActions;
		if (!spellActions?.length) return actions;

		// Actions are generally ordered as:
		//  - "Multiattack"
		//  - Attack actions
		//  - Other actions (alphabetical)
		// Insert our spellcasting section into the "Other actions" part, in an alphabetically-appropriate place.

		const ixLastAttack = actions.findLastIndex(it => it.entries && it.entries.length && typeof it.entries[0] === "string" && it.entries[0].includes(`{@atk `));
		const ixNext = actions.findIndex((act, ix) => ix > ixLastAttack && act.name && SortUtil.ascSortLower(act.name, "Spellcasting") >= 0);
		if (~ixNext) actions.splice(ixNext, 0, ...spellActions);
		else actions.push(...spellActions);
		return actions;
	},

	getSkillsString (renderer, mon) {
		if (!mon.skill) return "";

		function doSortMapJoinSkillKeys (obj, keys, joinWithOr) {
			const toJoin = keys.sort(SortUtil.ascSort).map(s => `<span data-mon-skill="${s.toTitleCase()}|${obj[s]}">${renderer.render(`{@skill ${s.toTitleCase()}}`)} ${Renderer.get().render(`{@skillCheck ${s.replace(/ /g, "_")} ${obj[s]}}`)}</span>`);
			return joinWithOr ? toJoin.joinConjunct(", ", " or ") : toJoin.join(", ");
		}

		const skills = doSortMapJoinSkillKeys(mon.skill, Object.keys(mon.skill).filter(k => k !== "other" && k !== "special"));
		if (mon.skill.other || mon.skill.special) {
			const others = mon.skill.other && mon.skill.other.map(it => {
				if (it.oneOf) {
					return `plus one of the following: ${doSortMapJoinSkillKeys(it.oneOf, Object.keys(it.oneOf), true)}`;
				}
				throw new Error(`Unhandled monster "other" skill properties!`);
			});
			const special = mon.skill.special && Renderer.get().render(mon.skill.special);
			return [skills, others, special].filter(Boolean).join(", ");
		}
		return skills;
	},

	getTokenUrl (mon) {
		return mon.tokenUrl || UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/${Parser.sourceJsonToAbv(mon.source)}/${Parser.nameToTokenName(mon.name)}.png`);
	},

	postProcessFluff (mon, fluff) {
		const cpy = MiscUtil.copyFast(fluff);

		// TODO is this good enough? Should additionally check for lair blocks which are not the last, and tag them with
		//   "data": {"lairRegionals": true}, and insert the lair/regional text there if available (do the current "append" otherwise)
		const thisGroup = DataUtil.monster.getMetaGroup(mon);
		const handleGroupProp = (prop, name) => {
			if (thisGroup && thisGroup[prop]) {
				cpy.entries = cpy.entries || [];
				cpy.entries.push({
					type: "entries",
					entries: [
						{
							type: "entries",
							name,
							entries: MiscUtil.copyFast(thisGroup[prop]),
						},
					],
				});
			}
		};

		handleGroupProp("lairActions", "Lair Actions");
		handleGroupProp("regionalEffects", "Regional Effects");
		handleGroupProp("mythicEncounter", `${mon.name} as a Mythic Encounter`);

		return cpy;
	},

	_FN_TAG_SENSES: null,
	_SENSE_TAG_METAS: null,
	getRenderedSenses (senses, isPlainText) {
		if (typeof senses === "string") senses = [senses]; // handle legacy format
		if (isPlainText) return senses.join(", ");

		if (!Renderer.monster._FN_TAG_SENSES) {
			Renderer.monster._SENSE_TAG_METAS = [
				...MiscUtil.copyFast(Parser.SENSES),
				...(PrereleaseUtil.getBrewProcessedFromCache("sense") || []),
				...(BrewUtil2.getBrewProcessedFromCache("sense") || []),
			];
			Renderer.monster._SENSE_TAG_METAS.forEach(it => it._re = new RegExp(`\\b(?<sense>${it.name.escapeRegexp()})\\b`, "gi"));
			Renderer.monster._FN_TAG_SENSES = str => {
				Renderer.monster._SENSE_TAG_METAS
					.forEach(({name, source, _re}) => str = str.replace(_re, (...m) => `{@sense ${m.last().sense}|${source}}`));
				return str;
			};
		}

		const senseStr = senses
			.map(str => {
				const tagSplit = Renderer.splitByTags(str);
				str = "";
				const len = tagSplit.length;
				for (let i = 0; i < len; ++i) {
					const s = tagSplit[i];

					if (!s) continue;

					if (s.startsWith("{@")) {
						str += s;
						continue;
					}

					str += Renderer.monster._FN_TAG_SENSES(s);
				}
				return str;
			})
			.join(", ")
			.replace(/(^| |\()(blind|blinded)(\)| |$)/gi, (...m) => `${m[1]}{@condition blinded||${m[2]}}${m[3]}`);

		return Renderer.get().render(senseStr);
	},

	getRenderedLanguages (languages) {
		if (typeof languages === "string") languages = [languages]; // handle legacy format
		return languages ? languages.map(it => Renderer.get().render(it)).join(", ") : "\u2014";
	},

	initParsed (mon) {
		mon._pTypes = mon._pTypes || Parser.monTypeToFullObj(mon.type); // store the parsed type
		if (!mon._pCr) {
			if (Parser.crToNumber(mon.cr) === VeCt.CR_CUSTOM) mon._pCr = "Special";
			else if (Parser.crToNumber(mon.cr) === VeCt.CR_UNKNOWN) mon._pCr = "Unknown";
			else mon._pCr = mon.cr == null ? "\u2014" : (mon.cr.cr || mon.cr);
		}
		if (!mon._fCr) {
			mon._fCr = [mon._pCr];
			if (mon.cr) {
				if (mon.cr.lair) mon._fCr.push(mon.cr.lair);
				if (mon.cr.coven) mon._fCr.push(mon.cr.coven);
			}
		}
	},

	updateParsed (mon) {
		delete mon._pTypes;
		delete mon._pCr;
		delete mon._fCr;
		Renderer.monster.initParsed(mon);
	},

	getRenderedVariants (mon, {renderer = null} = {}) {
		renderer = renderer || Renderer.get();
		const dragonVariant = Renderer.monster.dragonCasterVariant.getHtml(mon, {renderer});
		const variants = mon.variant;
		if (!variants && !dragonVariant) return null;

		const rStack = [];
		(variants || []).forEach(v => renderer.recursiveRender(v, rStack));
		if (dragonVariant) rStack.push(dragonVariant);
		return rStack.join("");
	},

	getRenderedEnvironment (envs) { return (envs || []).sort(SortUtil.ascSortLower).map(it => it.toTitleCase()).join(", "); },

	getRenderedAltArtEntry (meta, {isPlainText = false} = {}) {
		return `${isPlainText ? "" : `<div>`}${meta.displayName || meta.name}; ${isPlainText ? "" : `<span title="${Parser.sourceJsonToFull(meta.source)}">`}${Parser.sourceJsonToAbv(meta.source)}${Renderer.utils.isDisplayPage(meta.page) ? ` p${meta.page}` : ""}${isPlainText ? "" : `</span></div>`}`;
	},

	pGetFluff (mon) {
		return Renderer.utils.pGetFluff({
			entity: mon,
			pFnPostProcess: Renderer.monster.postProcessFluff.bind(null, mon),
			fluffBaseUrl: `data/bestiary/`,
			fluffProp: "monsterFluff",
		});
	},

	// region Custom hash ID packing/unpacking
	getCustomHashId (mon) {
		if (!mon._isScaledCr && !mon._isScaledSpellSummon && !mon._scaledClassSummonLevel) return null;

		const {
			name,
			source,
			_scaledCr: scaledCr,
			_scaledSpellSummonLevel: scaledSpellSummonLevel,
			_scaledClassSummonLevel: scaledClassSummonLevel,
		} = mon;

		return [
			name,
			source,
			scaledCr ?? "",
			scaledSpellSummonLevel ?? "",
			scaledClassSummonLevel ?? "",
		].join("__").toLowerCase();
	},

	getUnpackedCustomHashId (customHashId) {
		if (!customHashId) return null;

		const [, , scaledCr, scaledSpellSummonLevel, scaledClassSummonLevel] = customHashId.split("__").map(it => it.trim());

		if (!scaledCr && !scaledSpellSummonLevel && !scaledClassSummonLevel) return null;

		return {
			_scaledCr: scaledCr ? Number(scaledCr) : null,
			_scaledSpellSummonLevel: scaledSpellSummonLevel ? Number(scaledSpellSummonLevel) : null,
			_scaledClassSummonLevel: scaledClassSummonLevel ? Number(scaledClassSummonLevel) : null,
			customHashId,
		};
	},
	// endregion

	async pGetModifiedCreature (monRaw, customHashId) {
		if (!customHashId) return monRaw;
		const {_scaledCr, _scaledSpellSummonLevel, _scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(customHashId);
		if (_scaledCr) return ScaleCreature.scale(monRaw, _scaledCr);
		if (_scaledSpellSummonLevel) return ScaleSpellSummonedCreature.scale(monRaw, _scaledSpellSummonLevel);
		if (_scaledClassSummonLevel) return ScaleClassSummonedCreature.scale(monRaw, _scaledClassSummonLevel);
		throw new Error(`Unhandled custom hash ID "${customHashId}"`);
	},

	_bindListenersScale (mon, ele) {
		const page = UrlUtil.PG_BESTIARY;
		const source = mon.source;
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BESTIARY](mon);

		const fnRender = Renderer.hover.getFnRenderCompact(page);

		const $content = $(ele);

		$content
			.find(".mon__btn-scale-cr")
			.click(evt => {
				evt.stopPropagation();
				const win = (evt.view || {}).window;

				const $btn = $(evt.target).closest("button");
				const initialCr = mon._originalCr != null ? mon._originalCr : mon.cr.cr || mon.cr;
				const lastCr = mon.cr.cr || mon.cr;

				Renderer.monster.getCrScaleTarget({
					win,
					$btnScale: $btn,
					initialCr: lastCr,
					isCompact: true,
					cbRender: async (targetCr) => {
						const original = await DataLoader.pCacheAndGet(page, source, hash);
						const toRender = Parser.numberToCr(targetCr) === initialCr
							? original
							: await ScaleCreature.scale(original, targetCr);

						$content.empty().append(fnRender(toRender));

						Renderer.monster._bindListenersScale(toRender, ele);
					},
				});
			});

		$content
			.find(".mon__btn-reset-cr")
			.click(async () => {
				const toRender = await DataLoader.pCacheAndGet(page, source, hash);
				$content.empty().append(fnRender(toRender));

				Renderer.monster._bindListenersScale(toRender, ele);
			});

		const $selSummonSpellLevel = $content
			.find(`[name="mon__sel-summon-spell-level"]`)
			.change(async () => {
				const original = await DataLoader.pCacheAndGet(page, source, hash);
				const spellLevel = Number($selSummonSpellLevel.val());

				const toRender = ~spellLevel
					? await ScaleSpellSummonedCreature.scale(original, spellLevel)
					: original;

				$content.empty().append(fnRender(toRender));

				Renderer.monster._bindListenersScale(toRender, ele);
			})
			.val(mon._summonedBySpell_level != null ? `${mon._summonedBySpell_level}` : "-1");

		const $selSummonClassLevel = $content
			.find(`[name="mon__sel-summon-class-level"]`)
			.change(async () => {
				const original = await DataLoader.pCacheAndGet(page, source, hash);
				const classLevel = Number($selSummonClassLevel.val());

				const toRender = ~classLevel
					? await ScaleClassSummonedCreature.scale(original, classLevel)
					: original;

				$content.empty().append(fnRender(toRender));

				Renderer.monster._bindListenersScale(toRender, ele);
			})
			.val(mon._summonedByClass_level != null ? `${mon._summonedByClass_level}` : "-1");
	},

	bindListenersCompact (mon, ele) {
		Renderer.monster._bindListenersScale(mon, ele);
	},
};
Renderer.monster.CHILD_PROPS_EXTENDED = [...Renderer.monster.CHILD_PROPS, "lairActions", "regionalEffects"];

Renderer.monster.CHILD_PROPS_EXTENDED.forEach(prop => {
	const propFull = `monster${prop.uppercaseFirst()}`;
	Renderer[propFull] = {
		getCompactRenderedString (ent) {
			return Renderer.generic.getCompactRenderedString(ent);
		},
	};
});

Renderer.legendaryGroup = {
	getCompactRenderedString (legGroup, opts) {
		opts = opts || {};

		const ent = Renderer.legendaryGroup.getSummaryEntry(legGroup);
		if (!ent) return "";

		return `
		${Renderer.utils.getNameTr(legGroup, {isEmbeddedEntity: opts.isEmbeddedEntity})}
		<tr class="text"><td colspan="6">
		${Renderer.get().setFirstSection(true).render(ent)}
		</td></tr>
		${Renderer.utils.getPageTr(legGroup)}`;
	},

	getSummaryEntry (legGroup) {
		if (!legGroup || (!legGroup.lairActions && !legGroup.regionalEffects && !legGroup.mythicEncounter)) return null;

		return {
			type: "section",
			entries: [
				legGroup.lairActions ? {name: "Lair Actions", type: "entries", entries: legGroup.lairActions} : null,
				legGroup.regionalEffects ? {name: "Regional Effects", type: "entries", entries: legGroup.regionalEffects} : null,
				legGroup.mythicEncounter ? {name: "As a Mythic Encounter", type: "entries", entries: legGroup.mythicEncounter} : null,
			].filter(Boolean),
		};
	},
};

Renderer.item = {
	_sortProperties (a, b) {
		return SortUtil.ascSort(Renderer.item.propertyMap[a]?.name || "", Renderer.item.propertyMap[b]?.name || "");
	},

	_getPropertiesText (item, {renderer = null} = {}) {
		renderer = renderer || Renderer.get();

		if (!item.property) {
			const parts = [];
			if (item.dmg2) parts.push(`alt. ${Renderer.item._renderDamage(item.dmg2, {renderer})}`);
			if (item.range) parts.push(`range ${item.range} ft.`);
			return `${item.dmg1 && parts.length ? " - " : ""}${parts.join(", ")}`;
		}

		let renderedDmg2 = false;

		const renderedProperties = item.property
			.sort(Renderer.item._sortProperties)
			.map(prop => {
				const fullProp = Renderer.item.propertyMap[prop];

				if (fullProp.template) {
					const toRender = Renderer.utils.applyTemplate(
						item,
						fullProp.template,
						{
							fnPreApply: (fullMatch, variablePath) => {
								if (variablePath === "item.dmg2") renderedDmg2 = true;
							},
							mapCustom: {"prop_name": fullProp.name},
						},
					);

					return renderer.render(toRender);
				} else return fullProp.name;
			});

		if (!renderedDmg2 && item.dmg2) renderedProperties.unshift(`alt. ${Renderer.item._renderDamage(item.dmg2, {renderer})}`);

		return `${item.dmg1 && renderedProperties.length ? " - " : ""}${renderedProperties.join(", ")}`;
	},

	_getTaggedDamage (dmg, {renderer = null} = {}) {
		if (!dmg) return "";

		renderer = renderer || Renderer.get();

		Renderer.stripTags(dmg.trim());

		return renderer.render(`{@damage ${dmg}}`);
	},

	_renderDamage (dmg, {renderer = null} = {}) {
		renderer = renderer || Renderer.get();
		return renderer.render(Renderer.item._getTaggedDamage(dmg, {renderer}));
	},

	getDamageAndPropertiesText (item, {renderer = null} = {}) {
		renderer = renderer || Renderer.get();

		const damagePartsPre = [];
		const damageParts = [];

		if (item.mastery) damagePartsPre.push(`Mastery: ${item.mastery.map(it => renderer.render(`{@itemMastery ${it}}`)).join(", ")}`);

		if (item.dmg1) damageParts.push(Renderer.item._renderDamage(item.dmg1, {renderer}));

		// armor
		if (item.ac != null) {
			const prefix = item.type === "S" ? "+" : "";
			const suffix = item.type === "LA" || (item.type === "MA" && item.dexterityMax === null) ? " + Dex" : item.type === "MA" ? " + Dex (max 2)" : "";
			damageParts.push(`AC ${prefix}${item.ac}${suffix}`);
		}
		if (item.acSpecial != null) damageParts.push(item.ac != null ? item.acSpecial : `AC ${item.acSpecial}`);

		// mounts
		if (item.speed != null) damageParts.push(`Speed: ${item.speed}`);
		if (item.carryingCapacity) damageParts.push(`Carrying Capacity: ${item.carryingCapacity} lb.`);

		// vehicles
		if (item.vehSpeed || item.capCargo || item.capPassenger || item.crew || item.crewMin || item.crewMax || item.vehAc || item.vehHp || item.vehDmgThresh || item.travelCost || item.shippingCost) {
			const vehPartUpper = item.vehSpeed ? `Speed: ${Parser.numberToVulgar(item.vehSpeed)} mph` : null;

			const vehPartMiddle = item.capCargo || item.capPassenger ? `Carrying Capacity: ${[item.capCargo ? `${Parser.numberToFractional(item.capCargo)} ton${item.capCargo === 0 || item.capCargo > 1 ? "s" : ""} cargo` : null, item.capPassenger ? `${item.capPassenger} passenger${item.capPassenger === 1 ? "" : "s"}` : null].filter(Boolean).join(", ")}` : null;

			const {travelCostFull, shippingCostFull} = Parser.itemVehicleCostsToFull(item);

			// These may not be present in homebrew
			const vehPartLower = [
				item.crew ? `Crew ${item.crew}` : null,
				item.crewMin && item.crewMax ? `Crew ${item.crewMin}-${item.crewMax}` : null,
				item.vehAc ? `AC ${item.vehAc}` : null,
				item.vehHp ? `HP ${item.vehHp}${item.vehDmgThresh ? `, Damage Threshold ${item.vehDmgThresh}` : ""}` : null,
			].filter(Boolean).join(", ");

			damageParts.push([
				vehPartUpper,
				vehPartMiddle,

				// region ~~Dammit Mercer~~ Additional fields present in EGW
				travelCostFull ? `Personal Travel Cost: ${travelCostFull} per mile per passenger` : null,
				shippingCostFull ? `Shipping Cost: ${shippingCostFull} per 100 pounds per mile` : null,
				// endregion

				vehPartLower,
			].filter(Boolean).join(renderer.getLineBreak()));
		}

		const damage = [
			damagePartsPre.join(", "),
			damageParts.join(", "),
		]
			.filter(Boolean)
			.join(renderer.getLineBreak());
		const damageType = item.dmgType ? Parser.dmgTypeToFull(item.dmgType) : "";
		const propertiesTxt = Renderer.item._getPropertiesText(item, {renderer});

		return [damage, damageType, propertiesTxt];
	},

	getTypeRarityAndAttunementText (item) {
		const typeRarity = [
			item._typeHtml === "other" ? "" : item._typeHtml,
			(item.rarity && Renderer.item.doRenderRarity(item.rarity) ? item.rarity : ""),
		].filter(Boolean).join(", ");

		return [
			item.reqAttune ? `${typeRarity} ${item._attunement}` : typeRarity,
			item._subTypeHtml || "",
			item.tier ? `${item.tier} tier` : "",
		];
	},

	getAttunementAndAttunementCatText (item, prop = "reqAttune") {
		let attunement = null;
		let attunementCat = VeCt.STR_NO_ATTUNEMENT;
		if (item[prop] != null && item[prop] !== false) {
			if (item[prop] === true) {
				attunementCat = "Requires Attunement";
				attunement = "(requires attunement)";
			} else if (item[prop] === "optional") {
				attunementCat = "Attunement Optional";
				attunement = "(attunement optional)";
			} else if (item[prop].toLowerCase().startsWith("by")) {
				attunementCat = "Requires Attunement By...";
				attunement = `(requires attunement ${Renderer.get().render(item[prop])})`;
			} else {
				attunementCat = "Requires Attunement"; // throw any weird ones in the "Yes" category (e.g. "outdoors at night")
				attunement = `(requires attunement ${Renderer.get().render(item[prop])})`;
			}
		}
		return [attunement, attunementCat];
	},

	getHtmlAndTextTypes (item) {
		const typeHtml = [];
		const typeListText = [];
		const subTypeHtml = [];

		let showingBase = false;
		if (item.wondrous) {
			typeHtml.push(`wondrous item${item.tattoo ? ` (tattoo)` : ""}`);
			typeListText.push("wondrous item");
		}
		if (item.tattoo) {
			typeListText.push("tattoo");
		}
		if (item.staff) {
			typeHtml.push("staff");
			typeListText.push("staff");
		}
		if (item.ammo) {
			typeHtml.push(`ammunition`);
			typeListText.push("ammunition");
		}
		if (item.firearm) {
			subTypeHtml.push("firearm");
			typeListText.push("firearm");
		}
		if (item.age) {
			subTypeHtml.push(item.age);
			typeListText.push(item.age);
		}
		if (item.weaponCategory) {
			typeHtml.push(`weapon${item.baseItem ? ` (${Renderer.get().render(`{@item ${item.baseItem}}`)})` : ""}`);
			subTypeHtml.push(`${item.weaponCategory} weapon`);
			typeListText.push(`${item.weaponCategory} weapon`);
			showingBase = true;
		}
		if (item.staff && (item.type !== "M" && item.typeAlt !== "M")) { // DMG p140: "Unless a staff's description says otherwise, a staff can be used as a quarterstaff."
			subTypeHtml.push("melee weapon");
			typeListText.push("melee weapon");
		}
		if (item.type) Renderer.item._getHtmlAndTextTypes_type({type: item.type, typeHtml, typeListText, subTypeHtml, showingBase, item});
		if (item.typeAlt) Renderer.item._getHtmlAndTextTypes_type({type: item.typeAlt, typeHtml, typeListText, subTypeHtml, showingBase, item});
		if (item.poison) {
			typeHtml.push(`poison${item.poisonTypes ? ` (${item.poisonTypes.joinConjunct(", ", " or ")})` : ""}`);
			typeListText.push("poison");
		}
		return [typeListText, typeHtml.join(", "), subTypeHtml.join(", ")];
	},

	_getHtmlAndTextTypes_type ({type, typeHtml, typeListText, subTypeHtml, showingBase, item}) {
		const fullType = Renderer.item.getItemTypeName(type);

		const isSub = (typeListText.some(it => it.includes("weapon")) && fullType.includes("weapon"))
			|| (typeListText.some(it => it.includes("armor")) && fullType.includes("armor"));

		if (!showingBase && !!item.baseItem) (isSub ? subTypeHtml : typeHtml).push(`${fullType} (${Renderer.get().render(`{@item ${item.baseItem}}`)})`);
		else if (type === "S") (isSub ? subTypeHtml : typeHtml).push(Renderer.get().render(`armor ({@item shield|phb})`));
		else (isSub ? subTypeHtml : typeHtml).push(fullType);

		typeListText.push(fullType);
	},

	_GET_RENDERED_ENTRIES_WALKER: null,

	/**
	 * @param item
	 * @param isCompact
	 * @param wrappedTypeAllowlist An optional set of: `"note", "type", "property", "variant"`
	 */
	getRenderedEntries (item, {isCompact = false, wrappedTypeAllowlist = null} = {}) {
		const renderer = Renderer.get();

		Renderer.item._GET_RENDERED_ENTRIES_WALKER = Renderer.item._GET_RENDERED_ENTRIES_WALKER || MiscUtil.getWalker({
			keyBlocklist: new Set([
				...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
				"data",
			]),
		});

		const handlersName = {
			string: (str) => Renderer.item._getRenderedEntries_handlerConvertNamesToItalics.bind(Renderer.item, item, item.name)(str),
		};

		const handlersVariantName = item._variantName == null ? null : {
			string: (str) => Renderer.item._getRenderedEntries_handlerConvertNamesToItalics.bind(Renderer.item, item, item._variantName)(str),
		};

		const renderStack = [];
		if (item._fullEntries || item.entries?.length) {
			const entry = MiscUtil.copyFast({type: "entries", entries: item._fullEntries || item.entries});
			let procEntry = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(entry, handlersName);
			if (handlersVariantName) procEntry = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(entry, handlersVariantName);
			if (wrappedTypeAllowlist) procEntry.entries = procEntry.entries.filter(it => !it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG] || wrappedTypeAllowlist.has(it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]));
			renderer.recursiveRender(procEntry, renderStack, {depth: 1});
		}

		if (item._fullAdditionalEntries || item.additionalEntries) {
			const additionEntries = MiscUtil.copyFast({type: "entries", entries: item._fullAdditionalEntries || item.additionalEntries});
			let procAdditionEntries = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(additionEntries, handlersName);
			if (handlersVariantName) procAdditionEntries = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(additionEntries, handlersVariantName);
			if (wrappedTypeAllowlist) procAdditionEntries.entries = procAdditionEntries.entries.filter(it => !it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG] || wrappedTypeAllowlist.has(it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]));
			renderer.recursiveRender(procAdditionEntries, renderStack, {depth: 1});
		}

		if (!isCompact && item.lootTables) {
			renderStack.push(`<div><span class="bold">Found On: </span>${item.lootTables.sort(SortUtil.ascSortLower).map(tbl => renderer.render(`{@table ${tbl}}`)).join(", ")}</div>`);
		}

		return renderStack.join("").trim();
	},

	_getRenderedEntries_handlerConvertNamesToItalics (item, baseName, str) {
		if (item._fIsMundane) return str;

		const stack = [];
		let depth = 0;

		const tgtLen = baseName.length;
		// Only accept title-case names for sentient items (e.g. Wave)
		const tgtName = item.sentient ? baseName : baseName.toLowerCase();

		const tgtLenPlural = baseName.length + 1;
		const tgtNamePlural = `${tgtName}s`;

		// e.g. "Orb of Shielding (Fernian Basalt)" -> "Orb of Shielding"
		const tgtNameNoBraces = tgtName.replace(/ \(.*$/, "");
		const tgtLenNoBraces = tgtNameNoBraces.length;

		const len = str.length;
		for (let i = 0; i < len; ++i) {
			const c = str[i];

			switch (c) {
				case "{": {
					if (str[i + 1] === "@") depth++;
					stack.push(c);
					break;
				}
				case "}": {
					if (depth) depth--;
					stack.push(c);
					break;
				}
				default: stack.push(c); break;
			}

			if (depth) continue;

			if (stack.slice(-tgtLen).join("")[item.sentient ? "toString" : "toLowerCase"]() === tgtName) {
				stack.splice(stack.length - tgtLen, tgtLen, `{@i ${stack.slice(-tgtLen).join("")}}`);
			} else if (stack.slice(-tgtLenPlural).join("")[item.sentient ? "toString" : "toLowerCase"]() === tgtNamePlural) {
				stack.splice(stack.length - tgtLenPlural, tgtLenPlural, `{@i ${stack.slice(-tgtLenPlural).join("")}}`);
			} else if (stack.slice(-tgtLenNoBraces).join("")[item.sentient ? "toString" : "toLowerCase"]() === tgtNameNoBraces) {
				stack.splice(stack.length - tgtLenNoBraces, tgtLenNoBraces, `{@i ${stack.slice(-tgtLenNoBraces).join("")}}`);
			}
		}

		return stack.join("");
	},

	getCompactRenderedString (item, opts) {
		opts = opts || {};

		const [damage, damageType, propertiesTxt] = Renderer.item.getDamageAndPropertiesText(item);
		const [typeRarityText, subTypeText, tierText] = Renderer.item.getTypeRarityAndAttunementText(item);

		return `
		${Renderer.utils.getExcludedTr({entity: item, dataProp: "item", page: UrlUtil.PG_ITEMS})}
		${Renderer.utils.getNameTr(item, {page: UrlUtil.PG_ITEMS, isEmbeddedEntity: opts.isEmbeddedEntity})}
		<tr><td class="rd-item__type-rarity-attunement" colspan="6">${Renderer.item.getTypeRarityAndAttunementHtml(typeRarityText, subTypeText, tierText)}</td></tr>
		<tr>
			<td colspan="2">${[Parser.itemValueToFullMultiCurrency(item), Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst()}</td>
			<td class="text-right" colspan="4">${damage} ${damageType} ${propertiesTxt}</td>
		</tr>
		${Renderer.item.hasEntries(item) ? `${Renderer.utils.getDividerTr()}<tr class="text"><td colspan="6" class="text">${Renderer.item.getRenderedEntries(item, {isCompact: true})}</td></tr>` : ""}`;
	},

	hasEntries (item) {
		return item._fullAdditionalEntries?.length || item._fullEntries?.length || item.entries?.length;
	},

	getTypeRarityAndAttunementHtml (typeRarityText, subTypeText, tierText) {
		return `<div class="ve-flex-col">
			${typeRarityText || tierText ? `<div class="split ${subTypeText ? "mb-1" : ""}">
				<div class="italic">${(typeRarityText || "").uppercaseFirst()}</div>
				<div class="no-wrap ${tierText ? `ml-2` : ""}">${(tierText || "").uppercaseFirst()}</div>
			</div>` : ""}
			${subTypeText ? `<div class="italic">${subTypeText.uppercaseFirst()}</div>` : ""}
		</div>`;
	},

	_hiddenRarity: new Set(["none", "unknown", "unknown (magic)", "varies"]),
	doRenderRarity (rarity) {
		return !Renderer.item._hiddenRarity.has(rarity);
	},

	// ---

	propertyMap: {},
	_addProperty (prt) {
		if (Renderer.item.propertyMap[prt.abbreviation]) return;
		const cpy = MiscUtil.copyFast(prt);
		Renderer.item.propertyMap[prt.abbreviation] = prt.name ? cpy : {
			...cpy,
			name: (prt.entries || prt.entriesTemplate)[0].name.toLowerCase(),
		};
	},

	getProperty (abbv) { return Renderer.item.propertyMap[abbv]; },

	// ---

	typeMap: {},
	_addType (typ) {
		if (Renderer.item.typeMap[typ.abbreviation]?.entries || Renderer.item.typeMap[typ.abbreviation]?.entriesTemplate) return;
		const cpy = MiscUtil.copyFast(typ);
		Renderer.item.typeMap[typ.abbreviation] = typ.name ? cpy : {
			...cpy,
			name: (typ.entries || typ.entriesTemplate)[0].name.toLowerCase(),
		};
	},

	getType (abbv) { return Renderer.item.typeMap[abbv]; },

	// ---

	entryMap: {},
	_addEntry (ent) {
		if (Renderer.item.entryMap[ent.source]?.[ent.name]) return;
		MiscUtil.set(Renderer.item.entryMap, ent.source, ent.name, ent);
	},

	// ---

	_additionalEntriesMap: {},
	_addAdditionalEntries (ent) {
		if (Renderer.item._additionalEntriesMap[ent.appliesTo]) return;
		Renderer.item._additionalEntriesMap[ent.appliesTo] = MiscUtil.copyFast(ent.entries);
	},

	// ---

	_masteryMap: {},
	_addMastery (ent) {
		const lookupSource = ent.source.toLowerCase();
		const lookupName = ent.name.toLowerCase();
		if (Renderer.item._masteryMap[lookupSource]?.[lookupName]) return;
		MiscUtil.set(Renderer.item._masteryMap, lookupSource, lookupName, ent);
	},

	_getMastery (uid) {
		const {name, source} = DataUtil.proxy.unpackUid("itemMastery", uid, "itemMastery", {isLower: true});
		return MiscUtil.get(Renderer.item._masteryMap, source, name);
	},

	// ---

	async _pAddPrereleaseBrewPropertiesAndTypes () {
		if (typeof PrereleaseUtil !== "undefined") await this._pAddPrereleaseBrewPropertiesAndTypes_({brewUtil: PrereleaseUtil});
		if (typeof BrewUtil2 !== "undefined") await this._pAddPrereleaseBrewPropertiesAndTypes_({brewUtil: BrewUtil2});
	},

	async _pAddPrereleaseBrewPropertiesAndTypes_ ({brewUtil}) {
		const brew = await brewUtil.pGetBrewProcessed();
		(brew.itemProperty || []).forEach(p => Renderer.item._addProperty(p));
		(brew.itemType || []).forEach(t => Renderer.item._addType(t));
		(brew.itemEntry || []).forEach(it => Renderer.item._addEntry(it));
		(brew.itemTypeAdditionalEntries || []).forEach(it => Renderer.item._addAdditionalEntries(it));
		(brew.itemMastery || []).forEach(it => Renderer.item._addMastery(it));
	},

	_addBasePropertiesAndTypes (baseItemData) {
		Object.entries(Parser.ITEM_TYPE_JSON_TO_ABV).forEach(([abv, name]) => Renderer.item._addType({abbreviation: abv, name}));

		// Convert the property and type list JSONs into look-ups, i.e. use the abbreviation as a JSON property name
		(baseItemData.itemProperty || []).forEach(it => Renderer.item._addProperty(it));
		(baseItemData.itemType || []).forEach(it => {
			// air/water vehicles share a type
			if (it.abbreviation === "SHP") Renderer.item._addType({...MiscUtil.copyFast(it), abbreviation: "AIR"});
			Renderer.item._addType(it);
		});
		(baseItemData.itemEntry || []).forEach(it => Renderer.item._addEntry(it));
		(baseItemData.itemTypeAdditionalEntries || []).forEach(it => Renderer.item._addAdditionalEntries(it));
		(baseItemData.itemMastery || []).forEach(it => Renderer.item._addMastery(it));

		baseItemData.baseitem.forEach(it => it._isBaseItem = true);
	},

	async _pGetSiteUnresolvedRefItems_pLoadItems () {
		const itemData = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/items.json`);
		const items = itemData.item;
		itemData.itemGroup.forEach(it => it._isItemGroup = true);
		return [...items, ...itemData.itemGroup];
	},

	async pGetSiteUnresolvedRefItems () {
		const itemList = await Renderer.item._pGetSiteUnresolvedRefItems_pLoadItems();
		const baseItemsJson = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/items-base.json`);
		const baseItems = await Renderer.item._pGetAndProcBaseItems(baseItemsJson);
		const {genericVariants, linkedLootTables} = await Renderer.item._pGetCacheSiteGenericVariants();
		const specificVariants = Renderer.item._createSpecificVariants(baseItems, genericVariants, {linkedLootTables});
		const allItems = [...itemList, ...baseItems, ...genericVariants, ...specificVariants];
		Renderer.item._enhanceItems(allItems);

		return {
			item: allItems,
			itemEntry: baseItemsJson.itemEntry,
		};
	},

	_pGettingSiteGenericVariants: null,
	async _pGetCacheSiteGenericVariants () {
		Renderer.item._pGettingSiteGenericVariants = Renderer.item._pGettingSiteGenericVariants || (async () => {
			const [genericVariants, linkedLootTables] = Renderer.item._getAndProcGenericVariants(await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/magicvariants.json`));
			return {genericVariants, linkedLootTables};
		})();
		return Renderer.item._pGettingSiteGenericVariants;
	},

	async pBuildList () {
		return DataLoader.pCacheAndGetAllSite(UrlUtil.PG_ITEMS);
	},

	async _pGetAndProcBaseItems (baseItemData) {
		Renderer.item._addBasePropertiesAndTypes(baseItemData);
		await Renderer.item._pAddPrereleaseBrewPropertiesAndTypes();
		return baseItemData.baseitem;
	},

	_getAndProcGenericVariants (variantData) {
		variantData.magicvariant.forEach(Renderer.item._genericVariants_addInheritedPropertiesToSelf);
		return [variantData.magicvariant, variantData.linkedLootTables];
	},

	_initFullEntries (item) {
		Renderer.utils.initFullEntries_(item);
	},

	_initFullAdditionalEntries (item) {
		Renderer.utils.initFullEntries_(item, {propEntries: "additionalEntries", propFullEntries: "_fullAdditionalEntries"});
	},

	/**
	 * @param baseItems
	 * @param genericVariants
	 * @param [opts]
	 * @param [opts.linkedLootTables]
	 */
	_createSpecificVariants (baseItems, genericVariants, opts) {
		opts = opts || {};

		const genericAndSpecificVariants = [];
		baseItems.forEach((curBaseItem) => {
			curBaseItem._category = "Basic";
			if (curBaseItem.entries == null) curBaseItem.entries = [];

			if (curBaseItem.packContents) return; // e.g. "Arrows (20)"

			genericVariants.forEach((curGenericVariant) => {
				if (!Renderer.item._createSpecificVariants_hasRequiredProperty(curBaseItem, curGenericVariant)) return;
				if (Renderer.item._createSpecificVariants_hasExcludedProperty(curBaseItem, curGenericVariant)) return;

				genericAndSpecificVariants.push(Renderer.item._createSpecificVariants_createSpecificVariant(curBaseItem, curGenericVariant, opts));
			});
		});
		return genericAndSpecificVariants;
	},

	_createSpecificVariants_hasRequiredProperty (baseItem, genericVariant) {
		return genericVariant.requires.some(req => Renderer.item._createSpecificVariants_isRequiresExcludesMatch(baseItem, req, "every"));
	},

	_createSpecificVariants_hasExcludedProperty (baseItem, genericVariant) {
		const curExcludes = genericVariant.excludes || {};
		return Renderer.item._createSpecificVariants_isRequiresExcludesMatch(baseItem, genericVariant.excludes, "some");
	},

	_createSpecificVariants_isRequiresExcludesMatch (baseItem, toMatch, method) {
		if (!toMatch) return false;

		return Object.entries(toMatch)[method](([k, v]) => {
			if (v instanceof Array) {
				return baseItem[k] instanceof Array
					? baseItem[k].some(it => v.includes(it))
					: v.includes(baseItem[k]);
			}

			return baseItem[k] instanceof Array
				? baseItem[k].some(it => v === it)
				: v === baseItem[k];
		});
	},

	/**
	 * @param baseItem
	 * @param genericVariant
	 * @param [opts]
	 * @param [opts.linkedLootTables]
	 */
	_createSpecificVariants_createSpecificVariant (baseItem, genericVariant, opts) {
		const inherits = genericVariant.inherits;
		const specificVariant = MiscUtil.copyFast(baseItem);

		// Update prop
		specificVariant.__prop = "item";

		// Remove "base item" flag
		delete specificVariant._isBaseItem;

		// Reset enhancements/entry cache
		specificVariant._isEnhanced = false;
		delete specificVariant._fullEntries;

		specificVariant._baseName = baseItem.name;
		specificVariant._baseSrd = baseItem.srd;
		specificVariant._baseBasicRules = baseItem.basicRules;
		if (baseItem.source !== inherits.source) specificVariant._baseSource = baseItem.source;

		specificVariant._variantName = genericVariant.name;

		// Magic items do not inherit the value of the non-magical item
		delete specificVariant.value;

		// Magic variants apply their own SRD info; page info
		delete specificVariant.srd;
		delete specificVariant.basicRules;
		delete specificVariant.page;

		// Remove fluff specifiers
		delete specificVariant.hasFluff;
		delete specificVariant.hasFluffImages;

		specificVariant._category = "Specific Variant";
		Object.entries(inherits)
			.forEach(([inheritedProperty, val]) => {
				switch (inheritedProperty) {
					case "namePrefix": specificVariant.name = `${val}${specificVariant.name}`; break;
					case "nameSuffix": specificVariant.name = `${specificVariant.name}${val}`; break;
					case "entries": {
						Renderer.item._initFullEntries(specificVariant);

						const appliedPropertyEntries = Renderer.applyAllProperties(val, Renderer.item._getInjectableProps(baseItem, inherits));
						appliedPropertyEntries.forEach((ent, i) => specificVariant._fullEntries.splice(i, 0, ent));
						break;
					}
					case "vulnerable":
					case "resist":
					case "immune": {
						// Handled below
						break;
					}
					case "conditionImmune": {
						specificVariant[inheritedProperty] = [...specificVariant[inheritedProperty] || [], ...val].unique();
						break;
					}
					case "nameRemove": {
						specificVariant.name = specificVariant.name.replace(new RegExp(val.escapeRegexp(), "g"), "");

						break;
					}
					case "weightExpression":
					case "valueExpression": {
						const exp = Renderer.item._createSpecificVariants_evaluateExpression(baseItem, specificVariant, inherits, inheritedProperty);

						const result = Renderer.dice.parseRandomise2(exp);
						if (result != null) {
							switch (inheritedProperty) {
								case "weightExpression": specificVariant.weight = result; break;
								case "valueExpression": specificVariant.value = result; break;
							}
						}

						break;
					}
					case "barding": {
						specificVariant.bardingType = baseItem.type;
						break;
					}
					case "propertyAdd": {
						specificVariant.property = [
							...(specificVariant.property || []),
							...val.filter(it => !specificVariant.property || !specificVariant.property.includes(it)),
						];
						break;
					}
					case "propertyRemove": {
						if (specificVariant.property) {
							specificVariant.property = specificVariant.property.filter(it => !val.includes(it));
							if (!specificVariant.property.length) delete specificVariant.property;
						}
						break;
					}
					default: specificVariant[inheritedProperty] = val;
				}
			});

		Renderer.item._createSpecificVariants_mergeVulnerableResistImmune({specificVariant, inherits});

		// track the specific variant on the parent generic, to later render as part of the stats
		genericVariant.variants = genericVariant.variants || [];
		if (!genericVariant.variants.some(it => it.base?.name === baseItem.name && it.base?.source === baseItem.source)) genericVariant.variants.push({base: baseItem, specificVariant});

		// add reverse link to get generic from specific--primarily used for indexing
		specificVariant.genericVariant = {
			name: genericVariant.name,
			source: genericVariant.source,
		};

		// add linked loot tables
		if (opts.linkedLootTables && opts.linkedLootTables[specificVariant.source] && opts.linkedLootTables[specificVariant.source][specificVariant.name]) {
			(specificVariant.lootTables = specificVariant.lootTables || []).push(...opts.linkedLootTables[specificVariant.source][specificVariant.name]);
		}

		if (baseItem.source !== Parser.SRC_PHB && baseItem.source !== Parser.SRC_DMG) {
			Renderer.item._initFullEntries(specificVariant);
			specificVariant._fullEntries.unshift({
				type: "wrapper",
				wrapped: `{@note The {@item ${baseItem.name}|${baseItem.source}|base item} can be found in ${Parser.sourceJsonToFull(baseItem.source)}${baseItem.page ? `, page ${baseItem.page}` : ""}.}`,
				data: {
					[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "note",
				},
			});
		}

		return specificVariant;
	},

	_createSpecificVariants_evaluateExpression (baseItem, specificVariant, inherits, inheritedProperty) {
		return inherits[inheritedProperty].replace(/\[\[([^\]]+)]]/g, (...m) => {
			const propPath = m[1].split(".");
			return propPath[0] === "item"
				? MiscUtil.get(specificVariant, ...propPath.slice(1))
				: propPath[0] === "baseItem"
					? MiscUtil.get(baseItem, ...propPath.slice(1))
					: MiscUtil.get(specificVariant, ...propPath);
		});
	},

	_PROPS_VULN_RES_IMMUNE: [
		"vulnerable",
		"resist",
		"immune",
	],
	_createSpecificVariants_mergeVulnerableResistImmune ({specificVariant, inherits}) {
		const fromBase = {};
		Renderer.item._PROPS_VULN_RES_IMMUNE
			.filter(prop => specificVariant[prop])
			.forEach(prop => fromBase[prop] = [...specificVariant[prop]]);

		// For each `inherits` prop, remove matching values from non-matching props in base item (i.e., a value should be
		//   unique across all three arrays).
		Renderer.item._PROPS_VULN_RES_IMMUNE
			.forEach(prop => {
				const val = inherits[prop];

				// Retain existing from base item
				if (val === undefined) return;

				// Delete from base item
				if (val == null) return delete fromBase[prop];

				const valSet = new Set();
				val.forEach(it => {
					if (typeof it === "string") valSet.add(it);
					if (!it?.[prop]?.length) return;
					it?.[prop].forEach(itSub => {
						if (typeof itSub === "string") valSet.add(itSub);
					});
				});

				Renderer.item._PROPS_VULN_RES_IMMUNE
					.filter(it => it !== prop)
					.forEach(propOther => {
						if (!fromBase[propOther]) return;

						fromBase[propOther] = fromBase[propOther]
							.filter(it => {
								if (typeof it === "string") return !valSet.has(it);

								if (it?.[propOther]?.length) {
									it[propOther] = it[propOther].filter(itSub => {
										if (typeof itSub === "string") return !valSet.has(itSub);
										return true;
									});
								}

								return true;
							});

						if (!fromBase[propOther].length) delete fromBase[propOther];
					});
			});

		Renderer.item._PROPS_VULN_RES_IMMUNE
			.forEach(prop => {
				if (fromBase[prop] || inherits[prop]) specificVariant[prop] = [...(fromBase[prop] || []), ...(inherits[prop] || [])].unique();
				else delete specificVariant[prop];
			});
	},

	_enhanceItems (allItems) {
		allItems.forEach((item) => Renderer.item.enhanceItem(item));
		return allItems;
	},

	/**
	 * @param genericVariants
	 * @param opts
	 * @param [opts.additionalBaseItems]
	 * @param [opts.baseItems]
	 * @param [opts.isSpecificVariantsOnly]
	 */
	async pGetGenericAndSpecificVariants (genericVariants, opts) {
		opts = opts || {};

		let baseItems;
		if (opts.baseItems) {
			baseItems = opts.baseItems;
		} else {
			const baseItemData = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/items-base.json`);
			Renderer.item._addBasePropertiesAndTypes(baseItemData);
			baseItems = [...baseItemData.baseitem, ...(opts.additionalBaseItems || [])];
		}

		await Renderer.item._pAddPrereleaseBrewPropertiesAndTypes();
		genericVariants.forEach(Renderer.item._genericVariants_addInheritedPropertiesToSelf);
		const specificVariants = Renderer.item._createSpecificVariants(baseItems, genericVariants);
		const outSpecificVariants = Renderer.item._enhanceItems(specificVariants);

		if (opts.isSpecificVariantsOnly) return outSpecificVariants;

		const outGenericVariants = Renderer.item._enhanceItems(genericVariants);
		return [...outGenericVariants, ...outSpecificVariants];
	},

	_getInjectableProps (baseItem, inherits) {
		return {
			baseName: baseItem.name,
			dmgType: baseItem.dmgType ? Parser.dmgTypeToFull(baseItem.dmgType) : null,
			bonusAc: inherits.bonusAc,
			bonusWeapon: inherits.bonusWeapon,
			bonusWeaponAttack: inherits.bonusWeaponAttack,
			bonusWeaponDamage: inherits.bonusWeaponDamage,
			bonusWeaponCritDamage: inherits.bonusWeaponCritDamage,
			bonusSpellAttack: inherits.bonusSpellAttack,
			bonusSpellSaveDc: inherits.bonusSpellSaveDc,
			bonusSavingThrow: inherits.bonusSavingThrow,
		};
	},

	_INHERITED_PROPS_BLOCKLIST: new Set([
		// region Specific merge strategy
		"entries",
		"rarity",
		// endregion

		// region Meaningless on merged item
		"namePrefix",
		"nameSuffix",
		// endregion
	]),
	_genericVariants_addInheritedPropertiesToSelf (genericVariant) {
		if (genericVariant._isInherited) return;
		genericVariant._isInherited = true;

		for (const prop in genericVariant.inherits) {
			if (Renderer.item._INHERITED_PROPS_BLOCKLIST.has(prop)) continue;

			const val = genericVariant.inherits[prop];

			if (val == null) delete genericVariant[prop];
			else if (genericVariant[prop]) {
				if (genericVariant[prop] instanceof Array && val instanceof Array) genericVariant[prop] = MiscUtil.copyFast(genericVariant[prop]).concat(val);
				else genericVariant[prop] = val;
			} else genericVariant[prop] = genericVariant.inherits[prop];
		}

		if (!genericVariant.entries && genericVariant.inherits.entries) {
			genericVariant.entries = MiscUtil.copyFast(Renderer.applyAllProperties(genericVariant.inherits.entries, genericVariant.inherits));
		}

		if (genericVariant.inherits.rarity == null) delete genericVariant.rarity;
		else if (genericVariant.inherits.rarity === "varies") {
			/* No-op, i.e., use current rarity */
		} else genericVariant.rarity = genericVariant.inherits.rarity;

		if (genericVariant.requires.armor) genericVariant.armor = genericVariant.requires.armor;
	},

	getItemTypeName (t) {
		const fullType = Renderer.item.typeMap[t];
		if (!fullType) throw new Error(`Item type ${t} not found. You probably meant to load the property/type reference first; see \`Renderer.item.pPopulatePropertyAndTypeReference()\`.`);
		return fullType.name || t;
	},

	enhanceItem (item) {
		if (item._isEnhanced) return;
		item._isEnhanced = true;
		if (item.noDisplay) return;
		if (item.type === "GV") item._category = "Generic Variant";
		if (item._category == null) item._category = "Other";
		if (item.entries == null) item.entries = [];
		if (item.type && (Renderer.item.typeMap[item.type]?.entries || Renderer.item.typeMap[item.type]?.entriesTemplate)) {
			Renderer.item._initFullEntries(item);

			const propetyEntries = Renderer.item._enhanceItem_getItemPropertyTypeEntries({item, ent: Renderer.item.typeMap[item.type]});
			propetyEntries.forEach(e => item._fullEntries.push({type: "wrapper", wrapped: e, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}}));
		}
		if (item.property) {
			item.property.forEach(p => {
				const entProperty = Renderer.item.propertyMap[p];

				if (!entProperty) throw new Error(`Item property ${p} not found. You probably meant to load the property/type reference first; see \`Renderer.item.pPopulatePropertyAndTypeReference()\`.`);

				if (!entProperty.entries && !entProperty.entriesTemplate) return;

				Renderer.item._initFullEntries(item);

				const propetyEntries = Renderer.item._enhanceItem_getItemPropertyTypeEntries({item, ent: entProperty});
				propetyEntries.forEach(e => item._fullEntries.push({type: "wrapper", wrapped: e, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "property"}}));
			});
		}
		// The following could be encoded in JSON, but they depend on more than one JSON property; maybe fix if really bored later
		if (item.type === "LA" || item.type === "MA" || item.type === "HA") {
			if (item.stealth) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push({type: "wrapper", wrapped: "The wearer has disadvantage on Dexterity ({@skill Stealth}) checks.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
			}
			if (item.type === "HA" && item.strength) {
				Renderer.item._initFullEntries(item);
				item._fullEntries.push({type: "wrapper", wrapped: `If the wearer has a Strength score lower than ${item.strength}, their speed is reduced by 10 feet.`, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
			}
		}
		if (item.type === "SCF") {
			if (item._isItemGroup) {
				if (item.scfType === "arcane" && item.source !== Parser.SRC_ERLW) {
					Renderer.item._initFullEntries(item);
					item._fullEntries.push({type: "wrapper", wrapped: "An arcane focus is a special item\u2014an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item\u2014designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
				if (item.scfType === "druid") {
					Renderer.item._initFullEntries(item);
					item._fullEntries.push({type: "wrapper", wrapped: "A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
				if (item.scfType === "holy") {
					Renderer.item._initFullEntries(item);
					item._fullEntries.push({type: "wrapper", wrapped: "A holy symbol is a representation of a god or pantheon. It might be an amulet depicting a symbol representing a deity, the same symbol carefully engraved or inlaid as an emblem on a shield, or a tiny box holding a fragment of a sacred relic. A cleric or paladin can use a holy symbol as a spellcasting focus. To use the symbol in this way, the caster must hold it in hand, wear it visibly, or bear it on a shield.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
			} else {
				if (item.scfType === "arcane") {
					Renderer.item._initFullEntries(item);
					item._fullEntries.push({type: "wrapper", wrapped: "An arcane focus is a special item designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
				if (item.scfType === "druid") {
					Renderer.item._initFullEntries(item);
					item._fullEntries.push({type: "wrapper", wrapped: "A druid can use this object as a spellcasting focus.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
				if (item.scfType === "holy") {
					Renderer.item._initFullEntries(item);

					item._fullEntries.push({type: "wrapper", wrapped: "A holy symbol is a representation of a god or pantheon.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
					item._fullEntries.push({type: "wrapper", wrapped: "A cleric or paladin can use a holy symbol as a spellcasting focus. To use the symbol in this way, the caster must hold it in hand, wear it visibly, or bear it on a shield.", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
				}
			}
		}

		(item.mastery || [])
			.forEach(uid => {
				const mastery = Renderer.item._getMastery(uid);

				if (!mastery) throw new Error(`Item mastery ${uid} not found. You probably meant to load the property/type reference first; see \`Renderer.item.pPopulatePropertyAndTypeReference()\`.`);
				if (!mastery.entries && !mastery.entriesTemplate) return;

				Renderer.item._initFullEntries(item);

				item._fullEntries.push({
					type: "wrapper",
					wrapped: {
						type: "entries",
						name: `Mastery: ${mastery.name}`,
						source: mastery.source,
						page: mastery.page,
						entries: Renderer.item._enhanceItem_getItemPropertyTypeEntries({item, ent: mastery}),
					},
					data: {
						[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "mastery",
					},
				});
			});

		// add additional entries based on type (e.g. XGE variants)
		if (item.type === "T" || item.type === "AT" || item.type === "INS" || item.type === "GS") { // tools, artisan's tools, instruments, gaming sets
			Renderer.item._initFullAdditionalEntries(item);
			item._fullAdditionalEntries.push({type: "wrapper", wrapped: {type: "hr"}, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
			item._fullAdditionalEntries.push({type: "wrapper", wrapped: `{@note See the {@variantrule Tool Proficiencies|XGE} entry for more information.}`, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
		}

		// Add additional sources for all instruments and gaming sets
		if (item.type === "INS" || item.type === "GS") item.additionalSources = item.additionalSources || [];
		if (item.type === "INS") {
			if (!item.additionalSources.find(it => it.source === "XGE" && it.page === 83)) item.additionalSources.push({"source": "XGE", "page": 83});
		} else if (item.type === "GS") {
			if (!item.additionalSources.find(it => it.source === "XGE" && it.page === 81)) item.additionalSources.push({"source": "XGE", "page": 81});
		}

		if (item.type && Renderer.item._additionalEntriesMap[item.type]) {
			Renderer.item._initFullAdditionalEntries(item);
			const additional = Renderer.item._additionalEntriesMap[item.type];
			item._fullAdditionalEntries.push({type: "wrapper", wrapped: {type: "entries", entries: additional}, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}});
		}

		// bake in types
		const [typeListText, typeHtml, subTypeHtml] = Renderer.item.getHtmlAndTextTypes(item);
		item._typeListText = typeListText;
		item._typeHtml = typeHtml;
		item._subTypeHtml = subTypeHtml;

		// bake in attunement
		const [attune, attuneCat] = Renderer.item.getAttunementAndAttunementCatText(item);
		item._attunement = attune;
		item._attunementCategory = attuneCat;

		if (item.reqAttuneAlt) {
			const [attuneAlt, attuneCatAlt] = Renderer.item.getAttunementAndAttunementCatText(item, "reqAttuneAlt");
			item._attunementCategory = [attuneCat, attuneCatAlt];
		}

		// handle item groups
		if (item._isItemGroup) {
			Renderer.item._initFullEntries(item);
			item._fullEntries.push({type: "wrapper", wrapped: "Multiple variations of this item exist, as listed below:", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "magicvariant"}});
			item._fullEntries.push({
				type: "wrapper",
				wrapped: {
					type: "list",
					items: item.items.map(it => typeof it === "string" ? `{@item ${it}}` : `{@item ${it.name}|${it.source}}`),
				},
				data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "magicvariant"},
			});
		}

		// region Add base items list
		// item.variants was added during generic variant creation
		if (item.variants && item.variants.length) {
			Renderer.item._initFullEntries(item);
			item._fullEntries.push({
				type: "wrapper",
				wrapped: {
					type: "entries",
					name: "Base items",
					entries: [
						"This item variant can be applied to the following base items:",
						{
							type: "list",
							items: item.variants.map(({base, specificVariant}) => {
								return `{@item ${base.name}|${base.source}} ({@item ${specificVariant.name}|${specificVariant.source}})`;
							}),
						},
					],
				},
				data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "magicvariant"},
			});
		}
		// endregion
	},

	_enhanceItem_getItemPropertyTypeEntries ({item, ent}) {
		if (!ent.entriesTemplate) return MiscUtil.copyFast(ent.entries);
		return MiscUtil
			.getWalker({
				keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
			})
			.walk(
				MiscUtil.copyFast(ent.entriesTemplate),
				{
					string: (str) => {
						return Renderer.utils.applyTemplate(
							item,
							str,
						);
					},
				},
			);
	},

	unenhanceItem (item) {
		if (!item._isEnhanced) return;
		delete item._isEnhanced;
		delete item._fullEntries;
	},

	async pGetSiteUnresolvedRefItemsFromPrereleaseBrew ({brewUtil, brew = null}) {
		if (brewUtil == null && brew == null) return [];

		brew = brew || await brewUtil.pGetBrewProcessed();

		(brew.itemProperty || []).forEach(p => Renderer.item._addProperty(p));
		(brew.itemType || []).forEach(t => Renderer.item._addType(t));
		(brew.itemEntry || []).forEach(it => Renderer.item._addEntry(it));
		(brew.itemTypeAdditionalEntries || []).forEach(it => Renderer.item._addAdditionalEntries(it));

		let items = [...(brew.baseitem || []), ...(brew.item || [])];

		if (brew.itemGroup) {
			const itemGroups = MiscUtil.copyFast(brew.itemGroup);
			itemGroups.forEach(it => it._isItemGroup = true);
			items = [...items, ...itemGroups];
		}

		Renderer.item._enhanceItems(items);

		let isReEnhanceVariants = false;

		// Get specific variants for brew base items, using official generic variants
		if (brew.baseitem && brew.baseitem.length) {
			isReEnhanceVariants = true;

			const {genericVariants} = await Renderer.item._pGetCacheSiteGenericVariants();

			const variants = await Renderer.item.pGetGenericAndSpecificVariants(
				genericVariants,
				{baseItems: brew.baseitem || [], isSpecificVariantsOnly: true},
			);
			items = [...items, ...variants];
		}

		// Get specific and generic variants for official and brew base items, using brew generic variants
		if (brew.magicvariant && brew.magicvariant.length) {
			isReEnhanceVariants = true;

			const variants = await Renderer.item.pGetGenericAndSpecificVariants(
				brew.magicvariant,
				{additionalBaseItems: brew.baseitem || []},
			);
			items = [...items, ...variants];
		}

		// Regenerate the full entries for the generic variants, as there may be more specific variants to add to their
		//   specific variant lists.
		if (isReEnhanceVariants) {
			const {genericVariants} = await Renderer.item._pGetCacheSiteGenericVariants();
			genericVariants.forEach(item => {
				item.variants.sort((a, b) => SortUtil.ascSortLower(a.base.name, b.base.name) || SortUtil.ascSortLower(a.base.source, b.base.source));
				Renderer.item.unenhanceItem(item);
				Renderer.item.enhanceItem(item);
			});
		}

		return items;
	},

	async pGetItemsFromPrerelease () {
		return DataLoader.pCacheAndGetAllPrerelease(UrlUtil.PG_ITEMS);
	},

	async pGetItemsFromBrew () {
		return DataLoader.pCacheAndGetAllBrew(UrlUtil.PG_ITEMS);
	},

	_pPopulatePropertyAndTypeReference: null,
	pPopulatePropertyAndTypeReference: () => {
		return Renderer.item._pPopulatePropertyAndTypeReference || (async () => {
			const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/items-base.json`);

			Object.entries(Parser.ITEM_TYPE_JSON_TO_ABV).forEach(([abv, name]) => Renderer.item._addType({abbreviation: abv, name}));
			data.itemProperty.forEach(p => Renderer.item._addProperty(p));
			data.itemType.forEach(t => Renderer.item._addType(t));
			data.itemEntry.forEach(it => Renderer.item._addEntry(it));
			data.itemTypeAdditionalEntries.forEach(e => Renderer.item._addAdditionalEntries(e));

			await Renderer.item._pAddPrereleaseBrewPropertiesAndTypes();
		})();
	},

	// fetch every possible indexable item from official data
	async getAllIndexableItems (rawVariants, rawBaseItems) {
		const basicItems = await Renderer.item._pGetAndProcBaseItems(rawBaseItems);
		const [genericVariants, linkedLootTables] = await Renderer.item._getAndProcGenericVariants(rawVariants);
		const specificVariants = Renderer.item._createSpecificVariants(basicItems, genericVariants, {linkedLootTables});

		[...genericVariants, ...specificVariants].forEach(item => {
			if (item.variants) delete item.variants; // prevent circular references
		});

		return specificVariants;
	},

	isMundane (item) { return item.rarity === "none" || item.rarity === "unknown" || item._category === "basic"; },

	isExcluded (item, {hash = null} = {}) {
		const name = item.name;
		const source = item.source || item.inherits?.source;

		hash = hash || UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name, source});

		if (ExcludeUtil.isExcluded(hash, "item", source)) return true;

		if (item._isBaseItem) return ExcludeUtil.isExcluded(hash, "baseitem", source);
		if (item._isItemGroup) return ExcludeUtil.isExcluded(hash, "itemGroup", source);
		if (item._variantName) {
			if (ExcludeUtil.isExcluded(hash, "_specificVariant", source)) return true;

			const baseHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name: item._baseName, source: item._baseSource || source});
			if (ExcludeUtil.isExcluded(baseHash, "baseitem", item._baseSource || source)) return true;

			const variantHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS]({name: item._variantName, source: source});
			return ExcludeUtil.isExcluded(variantHash, "magicvariant", source);
		}
		if (item.type === "GV") return ExcludeUtil.isExcluded(hash, "magicvariant", source);

		return false;
	},

	pGetFluff (item) {
		return Renderer.utils.pGetFluff({
			entity: item,
			fnGetFluffData: DataUtil.itemFluff.loadJSON.bind(DataUtil.itemFluff),
			fluffProp: "itemFluff",
		});
	},
};

Renderer.psionic = {
	enhanceMode: (mode) => {
		if (!mode.enhanced) {
			mode.name = [mode.name, getModeSuffix(mode, false)].filter(Boolean).join(" ");

			if (mode.submodes) {
				mode.submodes.forEach(sm => {
					sm.name = [sm.name, getModeSuffix(sm, true)].filter(Boolean).join(" ");
				});
			}

			mode.enhanced = true;
		}

		function getModeSuffix (mode, subMode) {
			subMode = subMode == null ? false : subMode;
			const modeTitleArray = [];
			const bracketPart = getModeTitleBracketPart();
			if (bracketPart != null) modeTitleArray.push(bracketPart);
			if (subMode) return `${modeTitleArray.join(" ")}`;
			else return `${modeTitleArray.join(" ")}`;

			function getModeTitleBracketPart () {
				const modeTitleBracketArray = [];

				if (mode.cost) modeTitleBracketArray.push(getModeTitleCost());
				if (mode.concentration) modeTitleBracketArray.push(getModeTitleConcentration());

				if (modeTitleBracketArray.length === 0) return null;
				return `(${modeTitleBracketArray.join("; ")})`;

				function getModeTitleCost () {
					const costMin = mode.cost.min;
					const costMax = mode.cost.max;
					const costString = costMin === costMax ? costMin : `${costMin}-${costMax}`;
					return `${costString} psi`;
				}

				function getModeTitleConcentration () {
					return `conc., ${mode.concentration.duration} ${mode.concentration.unit}.`;
				}
			}
		}
	},

	getBodyText (psi, renderer) {
		const renderStack = [];
		if (psi.entries) Renderer.get().recursiveRender(({entries: psi.entries, type: "entries"}), renderStack);
		if (psi.focus) renderStack.push(Renderer.psionic.getFocusString(psi, renderer));
		if (psi.modes) renderStack.push(...psi.modes.map(mode => Renderer.psionic.getModeString(mode, renderer)));
		return renderStack.join("");
	},

	getDescriptionString: (psionic, renderer) => {
		return `<p>${renderer.render({type: "inline", entries: [psionic.description]})}</p>`;
	},

	getFocusString: (psionic, renderer) => {
		return `<p><span class="psi-focus-title">Psychic Focus.</span> ${renderer.render({type: "inline", entries: [psionic.focus]})}</p>`;
	},

	getModeString: (mode, renderer) => {
		Renderer.psionic.enhanceMode(mode);

		const renderStack = [];
		renderer.recursiveRender(mode, renderStack, {depth: 2});
		const modeString = renderStack.join("");
		if (mode.submodes == null) return modeString;
		const subModeString = Renderer.psionic.getSubModeString(mode.submodes, renderer);
		return `${modeString}${subModeString}`;
	},

	getSubModeString (subModes, renderer) {
		const fauxEntry = {
			type: "list",
			style: "list-hang-notitle",
			items: [],
		};

		for (let i = 0; i < subModes.length; ++i) {
			fauxEntry.items.push({
				type: "item",
				name: subModes[i].name,
				entry: subModes[i].entries.join("<br>"),
			});
		}
		const renderStack = [];
		renderer.recursiveRender(fauxEntry, renderStack, {depth: 2});
		return renderStack.join("");
	},

	getTypeOrderString (psi) {
		const typeMeta = Parser.psiTypeToMeta(psi.type);
		// if "isAltDisplay" is true, render as e.g. "Greater Discipline (Awakened)" rather than "Awakened Greater Discipline"
		return typeMeta.hasOrder
			? typeMeta.isAltDisplay ? `${typeMeta.full} (${psi.order})` : `${psi.order} ${typeMeta.full}`
			: typeMeta.full;
	},

	getCompactRenderedString (psi) {
		return `
			${Renderer.utils.getExcludedTr({entity: psi, dataProp: "psionic", page: UrlUtil.PG_PSIONICS})}
			${Renderer.utils.getNameTr(psi, {page: UrlUtil.PG_PSIONICS})}
			<tr class="text"><td colspan="6">
			<p><i>${Renderer.psionic.getTypeOrderString(psi)}</i></p>
			${Renderer.psionic.getBodyText(psi, Renderer.get().setFirstSection(true))}
			</td></tr>
		`;
	},
};

Renderer.rule = {
	getCompactRenderedString (rule) {
		return `
			<tr><td colspan="6">
			${Renderer.get().setFirstSection(true).render(rule)}
			</td></tr>
		`;
	},
};

Renderer.variantrule = {
	getCompactRenderedString (rule) {
		const cpy = MiscUtil.copyFast(rule);
		delete cpy.name;
		return `
			${Renderer.utils.getExcludedTr({entity: rule, dataProp: "variantrule", page: UrlUtil.PG_VARIANTRULES})}
			${Renderer.utils.getNameTr(rule, {page: UrlUtil.PG_VARIANTRULES})}
			<tr><td colspan="6">
			${Renderer.get().setFirstSection(true).render(cpy)}
			</td></tr>
		`;
	},
};

Renderer.table = {
	getCompactRenderedString (it) {
		it.type = it.type || "table";
		const cpy = MiscUtil.copyFast(it);
		delete cpy.name;
		return `
			${Renderer.utils.getExcludedTr({entity: it, dataProp: "table", page: UrlUtil.PG_TABLES})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_TABLES})}
			<tr><td colspan="6">
			${Renderer.get().setFirstSection(true).render(it)}
			</td></tr>
		`;
	},

	getConvertedEncounterOrNamesTable ({group, tableRaw, fnGetNameCaption, colLabel1}) {
		const getPadded = (number) => {
			if (tableRaw.diceExpression === "d100") return String(number).padStart(2, "0");
			return String(number);
		};

		const nameCaption = fnGetNameCaption(group, tableRaw);
		return {
			name: nameCaption,
			type: "table",
			source: group?.source,
			page: group?.page,
			caption: nameCaption,
			colLabels: [
				`{@dice ${tableRaw.diceExpression}}`,
				colLabel1,
				tableRaw.rollAttitude ? `Attitude` : null,
			].filter(Boolean),
			colStyles: [
				"col-2 text-center",
				tableRaw.rollAttitude ? "col-8" : "col-10",
				tableRaw.rollAttitude ? `col-2 text-center` : null,
			].filter(Boolean),
			rows: tableRaw.table.map(it => [
				`${getPadded(it.min)}${it.max != null && it.max !== it.min ? `-${getPadded(it.max)}` : ""}`,
				it.result,
				tableRaw.rollAttitude ? it.resultAttitude || "\u2014" : null,
			].filter(Boolean)),
			footnotes: tableRaw.footnotes,
		};
	},

	getConvertedEncounterTableName (group, tableRaw) {
		return `${group.name}${/\bencounters?\b/i.test(group.name) ? "" : " Encounters"}${tableRaw.minlvl && tableRaw.maxlvl ? ` (Levels ${tableRaw.minlvl}\u2014${tableRaw.maxlvl})` : ""}`;
	},

	getConvertedNameTableName (group, tableRaw) {
		return `${group.name} Names \u2013 ${tableRaw.option}`;
	},

	getHeaderRowMetas (ent) {
		if (!ent.colLabels?.length && !ent.colLabelGroups?.length) return null;

		if (ent.colLabels?.length) return [ent.colLabels];

		const maxHeight = Math.max(...ent.colLabelGroups.map(clg => clg.colLabels?.length || 0));

		const padded = ent.colLabelGroups
			.map(clg => {
				const out = [...(clg.colLabels || [])];
				while (out.length < maxHeight) out.unshift("");
				return out;
			});

		return [...new Array(maxHeight)]
			.map((_, i) => padded.map(lbls => lbls[i]));
	},

	_RE_TABLE_ROW_DASHED_NUMBERS: /^\d+([-\u2012\u2013]\d+)?/,
	getAutoConvertedRollMode (table, {headerRowMetas} = {}) {
		if (headerRowMetas === undefined) headerRowMetas = Renderer.table.getHeaderRowMetas(table);

		if (!headerRowMetas || headerRowMetas.last().length < 2) return RollerUtil.ROLL_COL_NONE;

		const rollColMode = RollerUtil.getColRollType(headerRowMetas.last()[0]);
		if (!rollColMode) return RollerUtil.ROLL_COL_NONE;

		// scan the first column to ensure all rollable
		if (!table.rows.every(it => {
			if (it?.[0] == null) return false;
			if (it?.[0]?.roll) return true;

			if (typeof it[0] === "number") return Number.isInteger(it[0]);

			// u2012 = figure dash; u2013 = en-dash
			return typeof it[0] === "string" && Renderer.table._RE_TABLE_ROW_DASHED_NUMBERS.test(it[0]);
		})) return RollerUtil.ROLL_COL_NONE;

		return rollColMode;
	},
};

Renderer.vehicle = {
	CHILD_PROPS: ["movement", "weapon", "other", "action", "trait", "reaction", "control", "actionStation"],

	getCompactRenderedString (veh, opts) {
		return Renderer.vehicle.getRenderedString(veh, {...opts, isCompact: true});
	},

	getRenderedString (veh, opts) {
		opts = opts || {};

		if (veh.upgradeType) return Renderer.vehicle._getRenderedString_upgrade(veh, opts);

		veh.vehicleType = veh.vehicleType || "SHIP";
		switch (veh.vehicleType) {
			case "SHIP": return Renderer.vehicle._getRenderedString_ship(veh, opts);
			case "SPELLJAMMER": return Renderer.vehicle._getRenderedString_spelljammer(veh, opts);
			case "INFWAR": return Renderer.vehicle._getRenderedString_infwar(veh, opts);
			case "CREATURE": return Renderer.monster.getCompactRenderedString(veh, {...opts, isHideLanguages: true, isHideSenses: true, isCompact: false, page: UrlUtil.PG_VEHICLES});
			case "OBJECT": return Renderer.object.getCompactRenderedString(veh, {...opts, isCompact: false, page: UrlUtil.PG_VEHICLES});
			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}
	},

	getUpgradeSummary (it) {
		return [
			it.upgradeType ? it.upgradeType.map(t => Parser.vehicleTypeToFull(t)) : null,
			it.prerequisite ? Renderer.utils.prerequisite.getHtml(it.prerequisite) : "",
		].filter(Boolean).join(", ");
	},

	_getRenderedString_upgrade (it, opts) {
		return $$`${Renderer.utils.getExcludedTr({entity: it, dataProp: "vehicleUpgrade", page: UrlUtil.PG_VEHICLES})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_VEHICLES})}
			<tr><td colspan="6"><i>${Renderer.vehicle.getUpgradeSummary(it)}</i></td></tr>
			<tr><td class="divider" colspan="6"><div></div></td></tr>
			<tr><td colspan="6">${Renderer.get().render({entries: it.entries}, 1)}</td></tr>`;
	},

	ship: {
		getLocomotionEntries (loc) {
			return {
				type: "list",
				style: "list-hang-notitle",
				items: [
					{
						type: "item",
						name: `Locomotion (${loc.mode})`,
						entries: loc.entries,
					},
				],
			};
		},

		getSpeedEntries (spd) {
			return {
				type: "list",
				style: "list-hang-notitle",
				items: [
					{
						type: "item",
						name: `Speed (${spd.mode})`,
						entries: spd.entries,
					},
				],
			};
		},

		getActionPart_ (renderer, veh) {
			return renderer.render({entries: veh.action});
		},

		getSectionTitle_ (title) {
			return `<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">${title}</h3></td></tr>`;
		},

		getSectionHpPart_ (renderer, sect, each) {
			if (!sect.ac && !sect.hp) return "";
			return `
				<div><b>Armor Class</b> ${sect.ac}</div>
				<div><b>Hit Points</b> ${sect.hp}${each ? ` each` : ""}${sect.dt ? ` (damage threshold ${sect.dt})` : ""}${sect.hpNote ? `; ${renderer.render(sect.hpNote)}` : ""}</div>
			`;
		},

		getControlSection_ (renderer, control) {
			if (!control) return "";
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">Control: ${control.name}</h3></td></tr>
				<tr><td colspan="6" class="mon__sect-row-inner">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, control)}
				<div class="rd__b--1">${renderer.render({entries: control.entries})}</div>
				</td></tr>
			`;
		},

		getMovementSection_ (renderer, move) {
			if (!move) return "";

			function getLocomotionSection (loc) {
				const asList = Renderer.vehicle.ship.getLocomotionEntries(loc);
				return `<div class="rd__b--1">${renderer.render(asList)}</div>`;
			}

			function getSpeedSection (spd) {
				const asList = Renderer.vehicle.ship.getSpeedEntries(spd);
				return `<div class="rd__b--1">${renderer.render(asList)}</div>`;
			}

			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">${move.isControl ? `Control and ` : ""}Movement: ${move.name}</h3></td></tr>
				<tr><td colspan="6" class="mon__sect-row-inner">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, move)}
				${(move.locomotion || []).map(getLocomotionSection)}
				${(move.speed || []).map(getSpeedSection)}
				</td></tr>
			`;
		},

		getWeaponSection_ (renderer, weap) {
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">Weapons: ${weap.name}${weap.count ? ` (${weap.count})` : ""}</h3></td></tr>
				<tr><td colspan="6" class="mon__sect-row-inner">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, weap, !!weap.count)}
				${renderer.render({entries: weap.entries})}
				</td></tr>
			`;
		},

		getOtherSection_ (renderer, oth) {
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">${oth.name}</h3></td></tr>
				<tr><td colspan="6" class="mon__sect-row-inner">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, oth)}
				${renderer.render({entries: oth.entries})}
				</td></tr>
			`;
		},

		getSizeDimensionsSection_ (renderer, veh) {
			return `<tr class="text"><td colspan="6"><i>${Parser.sizeAbvToFull(veh.size)} vehicle${veh.dimensions ? ` (${veh.dimensions.join(" by ")})` : ""}</i><br></td></tr>`;
		},

		getCrewCargoPageSection_ (renderer, veh) {
			if (veh.capCrew == null && veh.capCargo == null && veh.pace == null) return "";

			return `<tr class="text"><td colspan="6">
				${veh.capCrew != null || veh.capPassenger != null ? `<div><b>Creature Capacity</b> ${Renderer.vehicle.getShipCreatureCapacity(veh)}</div>` : ""}
				${veh.capCargo != null ? `<div><b>Cargo Capacity</b> ${Renderer.vehicle.getShipCargoCapacity(veh)}</div>` : ""}
				${veh.pace != null ? `<div><b>Travel Pace</b> ${veh.pace} miles per hour (${veh.pace * 24} miles per day)</div>
				<div class="ve-muted ve-small help-subtle ml-2" title="Based on &quot;Special Travel Pace,&quot; DMG p242">[<b>Speed</b> ${veh.pace * 10} ft.]</div>` : ""}
			</td></tr>`;
		},
	},

	spelljammer: {
		getSummarySection_ (renderer, veh) {
			const ptAc = veh.hull?.ac
				? `${veh.hull.ac}${veh.hull.acFrom ? ` (${veh.hull.acFrom.join(", ")})` : ""}`
				: "\u2014";

			const ptSpeed = veh.speed != null
				? Parser.getSpeedString(veh, {isSkipZeroWalk: true})
				: "";
			const ptPace = Renderer.vehicle.spelljammer._getPtPace(renderer, veh);

			const ptSpeedPace = [ptSpeed, ptPace].filter(Boolean).join(" ");

			return `<tr><td colspan="6">
				<table class="w-100 summary stripe-odd-table">
					<tr>
						<td class="col-6"><b>Armor Class:</b> ${ptAc}</td>
						<td class="col-6"><b>Cargo:</b> ${veh.capCargo ? `${veh.capCargo} ton${veh.capCargo === 1 ? "" : "s"}` : "\u2014"}</td>
					</tr>
					<tr>
						<td class="col-6"><b>Hit Points:</b> ${veh.hull?.hp ?? "\u2014"}</td>
						<td class="col-6"><b>Crew:</b> ${veh.capCrew ?? "\u2014"}${veh.capCrewNote ? ` ${renderer.render(veh.capCrewNote)}` : ""}</td>
					</tr>
					<tr>
						<td class="col-6"><b>Damage Threshold:</b> ${veh.hull?.dt ?? "\u2014"}</td>
						<td class="col-6"><b>Keel/Beam:</b> ${(veh.dimensions || ["\u2014"]).join("/")}</td>
					</tr>
					<tr>
						<td class="col-6"><b>Speed:</b> ${ptSpeedPace}</td>
						<td class="col-6"><b>Cost:</b> ${veh.cost != null ? Parser.vehicleCostToFull(veh) : "\u2014"}</td>
					</tr>
				</table>
			</td></tr>`;
		},

		_getPtPace (renderer, veh) {
			if (!veh.pace) return "";

			const isMulti = Object.keys(veh.pace).length > 1;

			const out = Parser.SPEED_MODES
				.map(mode => {
					const pace = veh.pace[mode];
					if (!pace) return null;

					const asNum = Parser.vulgarToNumber(pace);
					return `<span class="help-subtle" title="${asNum * 24} miles per day">${isMulti && mode !== "walk" ? `${mode} ` : ""}${pace} mph</span>`;
				})
				.filter(Boolean)
				.join(", ");

			return `(${out})`;
		},

		getWeaponSection_ (renderer, weap) {
			const isMultiple = weap.count != null && weap.count > 1;
			const ptAction = weap.action?.length
				? weap.action.map(act => `<div class="mt-1">${renderer.render(act, 2)}</div>`).join("")
				: "";
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">${isMultiple ? `${weap.count} ` : ""}${weap.name}${weap.crew ? ` (Crew: ${weap.crew}${isMultiple ? " each" : ""})` : ""}</h3></td></tr>
				<tr><td colspan="6" class="mon__sect-row-inner">
				${Renderer.vehicle.spelljammer.getSectionHpCostPart_(renderer, weap)}
				${weap.entries?.length ? `<div>${renderer.render({entries: weap.entries})}</div>` : ""}
				${ptAction}
				</td></tr>
			`;
		},

		getSectionHpCostPart_ (renderer, sect) {
			const ptCosts = sect.costs?.length
				? sect.costs.map(cost => {
					return `${Parser.vehicleCostToFull(cost) || "\u2014"}${cost.note ? `  (${renderer.render(cost.note)})` : ""}`;
				}).join(", ")
				: "\u2014";
			return `
				<div><b>Armor Class:</b> ${sect.ac == null ? "\u2014" : sect.ac}</div>
				<div><b>Hit Points:</b> ${sect.hp == null ? "\u2014" : sect.hp}</div>
				<div class="mb-2"><b>Cost:</b> ${ptCosts}</div>
			`;
		},
	},

	_getAbilitySection (veh) {
		return Parser.ABIL_ABVS.some(it => veh[it] != null) ? `<tr><td colspan="6">
			<table class="w-100 summary stripe-even-table">
				<tr>
					<th class="col-2 text-center">STR</th>
					<th class="col-2 text-center">DEX</th>
					<th class="col-2 text-center">CON</th>
					<th class="col-2 text-center">INT</th>
					<th class="col-2 text-center">WIS</th>
					<th class="col-2 text-center">CHA</th>
				</tr>
				<tr>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "str")}</td>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "dex")}</td>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "con")}</td>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "int")}</td>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "wis")}</td>
					<td class="text-center">${Renderer.utils.getAbilityRoller(veh, "cha")}</td>
				</tr>
			</table>
		</td></tr>` : "";
	},

	_getResImmVulnSection (veh) {
		if (!veh.immune && !veh.conditionImmune) return "";

		return `<tr class="text"><td colspan="6">
			${veh.immune ? `<div><b>Damage Immunities</b> ${Parser.getFullImmRes(veh.immune)}</div>` : ""}
			${veh.conditionImmune ? `<div><b>Condition Immunities</b> ${Parser.getFullCondImm(veh.conditionImmune)}</div>` : ""}
		</td></tr>`;
	},

	_getTraitSection (renderer, veh) {
		return veh.trait ? `<tr class="mon__stat-header-underline"><td colspan="6"><h3 class="mon__sect-header-inner">Traits</h3></td></tr>
		<tr><td colspan="6"><div class="border"></div></td></tr>
		<tr class="text"><td colspan="6">
		${Renderer.monster.getOrderedTraits(veh, renderer).map(it => it.rendered || renderer.render(it, 2)).join("")}
		</td></tr>` : "";
	},

	_getRenderedString_ship (veh, opts) {
		const renderer = Renderer.get();

		// Render UA ship actions at the top, to match later printed layout
		const otherSectionActions = (veh.other || []).filter(it => it.name === "Actions");
		const otherSectionOthers = (veh.other || []).filter(it => it.name !== "Actions");

		const hasToken = veh.tokenUrl || veh.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["veh__name--token"] : null;

		return `
			${Renderer.utils.getExcludedTr({entity: veh, dataProp: "vehicle", page: UrlUtil.PG_VEHICLES})}
			${Renderer.utils.getNameTr(veh, {extraThClasses, page: UrlUtil.PG_VEHICLES})}
			${Renderer.vehicle.ship.getSizeDimensionsSection_(renderer, veh)}
			${Renderer.vehicle.ship.getCrewCargoPageSection_(renderer, veh)}
			${Renderer.vehicle._getAbilitySection(veh)}
			${Renderer.vehicle._getResImmVulnSection(veh)}
			${veh.action ? Renderer.vehicle.ship.getSectionTitle_("Actions") : ""}
			${veh.action ? `<tr><td colspan="6" class="mon__sect-row-inner">${Renderer.vehicle.ship.getActionPart_(renderer, veh)}</td></tr>` : ""}
			${otherSectionActions.map(Renderer.vehicle.ship.getOtherSection_.bind(this, renderer)).join("")}
			${veh.hull ? `${Renderer.vehicle.ship.getSectionTitle_("Hull")}
			<tr><td colspan="6" class="mon__sect-row-inner">
			${Renderer.vehicle.ship.getSectionHpPart_(renderer, veh.hull)}
			</td></tr>` : ""}
			${Renderer.vehicle._getTraitSection(renderer, veh)}
			${(veh.control || []).map(Renderer.vehicle.ship.getControlSection_.bind(this, renderer)).join("")}
			${(veh.movement || []).map(Renderer.vehicle.ship.getMovementSection_.bind(this, renderer)).join("")}
			${(veh.weapon || []).map(Renderer.vehicle.ship.getWeaponSection_.bind(this, renderer)).join("")}
			${otherSectionOthers.map(Renderer.vehicle.ship.getOtherSection_.bind(this, renderer)).join("")}
		`;
	},

	getShipCreatureCapacity (veh) {
		return [
			veh.capCrew ? `${veh.capCrew} crew` : null,
			veh.capPassenger ? `${veh.capPassenger} passenger${veh.capPassenger === 1 ? "" : "s"}` : null,
		].filter(Boolean).join(", ");
	},
	getShipCargoCapacity (veh) { return typeof veh.capCargo === "string" ? veh.capCargo : `${veh.capCargo} ton${veh.capCargo === 1 ? "" : "s"}`; },

	_getRenderedString_spelljammer (veh, opts) {
		const renderer = Renderer.get();

		const hasToken = veh.tokenUrl || veh.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["veh__name--token"] : null;

		return `
			${Renderer.utils.getExcludedTr({entity: veh, dataProp: "vehicle", page: UrlUtil.PG_VEHICLES})}
			${Renderer.utils.getNameTr(veh, {extraThClasses, page: UrlUtil.PG_VEHICLES})}
			${Renderer.vehicle.spelljammer.getSummarySection_(renderer, veh)}
			${(veh.weapon || []).map(Renderer.vehicle.spelljammer.getWeaponSection_.bind(this, renderer)).join("")}
		`;
	},

	_getRenderedString_infwar (veh, opts) {
		const renderer = Renderer.get();
		const dexMod = Parser.getAbilityModNumber(veh.dex);

		const hasToken = veh.tokenUrl || veh.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["veh__name--token"] : null;

		return `
			${Renderer.utils.getExcludedTr({entity: veh, datProp: "vehicle", page: UrlUtil.PG_VEHICLES})}
			${Renderer.utils.getNameTr(veh, {extraThClasses, page: UrlUtil.PG_VEHICLES})}
			<tr class="text"><td colspan="6"><i>${Parser.sizeAbvToFull(veh.size)} vehicle (${veh.weight.toLocaleString()} lb.)</i><br></td></tr>
			<tr class="text"><td colspan="6">
				<div><b>Creature Capacity</b> ${Renderer.vehicle.getInfwarCreatureCapacity(veh)}</div>
				<div><b>Cargo Capacity</b> ${Parser.weightToFull(veh.capCargo)}</div>
				<div><b>Armor Class</b> ${dexMod === 0 ? `19` : `${19 + dexMod} (19 while motionless)`}</div>
				<div><b>Hit Points</b> ${veh.hp.hp} (damage threshold ${veh.hp.dt}, mishap threshold ${veh.hp.mt})</div>
				<div><b>Speed</b> ${veh.speed} ft.</div>
				<div class="ve-muted ve-small help-subtle ml-2" title="Based on &quot;Special Travel Pace,&quot; DMG p242">[<b>Travel Pace</b> ${Math.floor(veh.speed / 10)} miles per hour (${Math.floor(veh.speed * 24 / 10)} miles per day)]</div>
			</td></tr>
			${Renderer.vehicle._getAbilitySection(veh)}
			${Renderer.vehicle._getResImmVulnSection(veh)}
			${Renderer.vehicle._getTraitSection(renderer, veh)}
			${Renderer.monster.getCompactRenderedStringSection(veh, renderer, "Action Stations", "actionStation", 2)}
			${Renderer.monster.getCompactRenderedStringSection(veh, renderer, "Reactions", "reaction", 2)}
		`;
	},

	getInfwarCreatureCapacity (veh) { return `${veh.capCreature} Medium creatures`; },

	pGetFluff (veh) {
		return Renderer.utils.pGetFluff({
			entity: veh,
			fnGetFluffData: DataUtil.vehicleFluff.loadJSON.bind(DataUtil.vehicleFluff),
			fluffProp: "vehicleFluff",
		});
	},

	getTokenUrl (veh) {
		return veh.tokenUrl || UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/vehicles/tokens/${Parser.sourceJsonToAbv(veh.source)}/${Parser.nameToTokenName(veh.name)}.png`);
	},
};

Renderer.action = {
	getCompactRenderedString (it) {
		const cpy = MiscUtil.copyFast(it);
		delete cpy.name;
		return `${Renderer.utils.getExcludedTr({entity: it, dataProp: "action", page: UrlUtil.PG_ACTIONS})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_ACTIONS})}
		<tr><td colspan="6">${Renderer.get().setFirstSection(true).render(cpy)}</td></tr>`;
	},
};

Renderer.language = {
	getCompactRenderedString (it) {
		return Renderer.language.getRenderedString(it);
	},

	getRenderedString (it, {isSkipNameRow = false} = {}) {
		const allEntries = [];

		const hasMeta = it.typicalSpeakers || it.script;

		if (it.entries) allEntries.push(...it.entries);
		if (it.dialects) {
			allEntries.push(`This language is a family which includes the following dialects: ${it.dialects.sort(SortUtil.ascSortLower).join(", ")}. Creatures that speak different dialects of the same language can communicate with one another.`);
		}

		if (!allEntries.length && !hasMeta) allEntries.push("{@i No information available.}");

		return `
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "language", page: UrlUtil.PG_LANGUAGES})}
		${isSkipNameRow ? "" : Renderer.utils.getNameTr(it, {page: UrlUtil.PG_LANGUAGES})}
		${it.type ? `<tr class="text"><td colspan="6" class="pt-0"><i>${it.type.toTitleCase()} language</i></td></tr>` : ""}
		${hasMeta ? `<tr class="text"><td colspan="6">
		${it.typicalSpeakers ? `<div><b>Typical Speakers</b> ${Renderer.get().render(it.typicalSpeakers.join(", "))}</b>` : ""}
		${it.script ? `<div><b>Script</b> ${Renderer.get().render(it.script)}</div>` : ""}
		<div></div>
		</td></tr>` : ""}
		${allEntries.length ? `<tr class="text"><td colspan="6">
		${Renderer.get().setFirstSection(true).render({entries: allEntries})}
		</td></tr>` : ""}`;
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fnGetFluffData: DataUtil.languageFluff.loadJSON.bind(DataUtil.languageFluff),
			fluffProp: "languageFluff",
		});
	},
};

Renderer.adventureBook = {
	getEntryIdLookup (bookData, doThrowError = true) {
		const out = {};
		const titlesRel = {};

		let chapIx;
		const depthStack = [];
		const handlers = {
			object: (obj) => {
				Renderer.ENTRIES_WITH_ENUMERATED_TITLES
					.forEach(meta => {
						if (obj.type !== meta.type) return;

						const curDepth = depthStack.length ? depthStack.last() : 0;
						const nxtDepth = meta.depth ? meta.depth : meta.depthIncrement ? curDepth + meta.depthIncrement : curDepth;

						depthStack.push(
							Math.min(
								nxtDepth,
								2,
							),
						);

						if (obj.id) {
							if (out[obj.id]) {
								(out.__BAD = out.__BAD || []).push(obj.id);
							} else {
								out[obj.id] = {
									chapter: chapIx,
									entry: obj,
									depth: depthStack.last(),
								};

								if (obj.name) {
									const cleanName = obj.name.toLowerCase();
									titlesRel[cleanName] = titlesRel[cleanName] || 0;
									out[obj.id].ixTitleRel = titlesRel[cleanName]++;
									out[obj.id].nameClean = cleanName;
								}
							}
						}
					});

				return obj;
			},
			postObject: (obj) => {
				Renderer.ENTRIES_WITH_ENUMERATED_TITLES
					.forEach(meta => {
						if (obj.type !== meta.type) return;

						depthStack.pop();
					});
			},
		};

		bookData.forEach((chap, _chapIx) => {
			chapIx = _chapIx;
			MiscUtil.getWalker({isNoModification: true}).walk(chap, handlers);
		});

		if (doThrowError) if (out.__BAD) throw new Error(`IDs were already in storage: ${out.__BAD.map(it => `"${it}"`).join(", ")}`);

		return out;
	},

	_isAltMissingCoverUsed: false,
	getCoverUrl (contents) {
		return contents.coverUrl
			|| `${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/covers/blank${Math.random() <= 0.05 && !Renderer.adventureBook._isAltMissingCoverUsed && (Renderer.adventureBook._isAltMissingCoverUsed = true) ? "-alt" : ""}.png`;
	},
};

Renderer.charoption = {
	getCompactRenderedString (it) {
		const prerequisite = Renderer.utils.prerequisite.getHtml(it.prerequisite);
		const preText = Renderer.charoption.getOptionTypePreText(it.optionType);
		return `
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "charoption", page: UrlUtil.PG_CHAR_CREATION_OPTIONS})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_CHAR_CREATION_OPTIONS})}
		<tr class="text"><td colspan="6">
		${prerequisite ? `<p>${prerequisite}</p>` : ""}
		${preText || ""}${Renderer.get().setFirstSection(true).render({type: "entries", entries: it.entries})}
		</td></tr>
		`;
	},

	_OPTION_TYPE_ENTRIES: {
		"RF:B": `{@note You may replace the standard feature of your background with this feature.}`,
		"CS": `{@note See the {@adventure Character Secrets|IDRotF|0|character secrets} section for more information.}`,
	},
	getOptionTypePreText (optionTypes) {
		const mapped = optionTypes.map(it => Renderer.charoption._OPTION_TYPE_ENTRIES[it]).filter(Boolean);
		return mapped.length ? Renderer.get().render({type: "entries", entries: mapped}) : "";
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fnGetFluffData: DataUtil.charoptionFluff.loadJSON.bind(DataUtil.charoptionFluff),
			fluffProp: "charoptionFluff",
		});
	},
};

Renderer.recipe = {
	getCompactRenderedString (it) {
		return `${Renderer.utils.getExcludedTr({entity: it, dataProp: "recipe", page: UrlUtil.PG_RECIPES})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_RECIPES})}
		<tr><td colspan="6">
		${Renderer.recipe.getBodyHtml(it)}
		</td></tr>`;
	},

	getBodyHtml (it) {
		const {ptMakes, ptServes} = Renderer.recipe._getMakesServesHtml(it);

		return `<div class="ve-flex w-100 rd-recipes__wrp-recipe">
			<div class="ve-flex-1 ve-flex-col br-1p pr-2">
				${ptMakes || ""}
				${ptServes || ""}

				<div class="rd-recipes__wrp-ingredients ${ptMakes || ptServes ? "mt-1" : ""}">${Renderer.get().render({entries: it._fullIngredients}, 0)}</div>

				${it._fullEquipment?.length ? `<div class="rd-recipes__wrp-ingredients mt-4"><div class="ve-flex-vh-center bold mb-1 small-caps">Equipment</div><div>${Renderer.get().render({entries: it._fullEquipment})}</div></div>` : ""}

				${it.noteCook ? `<div class="w-100 ve-flex-col mt-4"><div class="ve-flex-vh-center bold mb-1 small-caps">Cook's Notes</div><div class="italic">${Renderer.get().render({entries: it.noteCook})}</div></div>` : ""}
			</div>

			<div class="pl-2 ve-flex-2 rd-recipes__wrp-instructions">
				${Renderer.get().setFirstSection(true).render({entries: it.instructions}, 2)}
			</div>
		</div>`;
	},

	_getMakesServesHtml (it) {
		const ptMakes = it.makes ? `<div class="mb-2 ve-flex-v-center">
			<div class="bold small-caps mr-2">Makes</div>
			<div>${it._scaleFactor ? `${it._scaleFactor}× ` : ""}${Renderer.get().render(it.makes || it.serves)}</div>
		</div>` : null;

		const ptServes = it.serves ? `<div class="mb-2 ve-flex-v-center">
			<div class="bold small-caps mr-2">Serves</div>
			<div>${it.serves.min ?? it.serves.exact}${it.serves.min != null ? " to " : ""}${it.serves.max ?? ""}</div>
		</div>` : null;

		return {ptMakes, ptServes};
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fnGetFluffData: DataUtil.recipeFluff.loadJSON.bind(DataUtil.recipeFluff),
			fluffProp: "recipeFluff",
		});
	},

	populateFullIngredients (r) {
		r._fullIngredients = Renderer.applyAllProperties(MiscUtil.copyFast(r.ingredients));
		if (r.equipment) r._fullEquipment = Renderer.applyAllProperties(MiscUtil.copyFast(r.equipment));
	},

	_RE_AMOUNT: /(?<tagAmount>{=amount\d+(?:\/[^}]+)?})/g,
	getScaledRecipe (r, scaleFactor) {
		const cpyR = MiscUtil.copyFast(r);

		["ingredients", "equipment"]
			.forEach(prop => {
				if (!cpyR[prop]) return;

				MiscUtil.getWalker({keyBlocklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST}).walk(
					cpyR[prop],
					{
						object: (obj) => {
							if (obj.type !== "ingredient") return obj;

							const objOriginal = MiscUtil.copyFast(obj);

							Object.keys(obj)
								.filter(k => /^amount\d+/.test(k))
								.forEach(k => {
									let base = obj[k];

									if (Math.round(base) !== base && base < 20) {
										const divOneSixth = obj[k] / 0.166;
										if (Math.abs(divOneSixth - Math.round(divOneSixth)) < 0.05) base = (1 / 6) * Math.round(divOneSixth);
									}

									let scaled = base * scaleFactor;
									if (Math.abs(scaled - Math.round(scaled)) < 0.1) {
										scaled = Math.round(scaled);
									}
									obj[k] = scaled;
								});

							// region Attempt to singleize/pluralize units
							const amountsOriginal = Object.keys(objOriginal).filter(k => /^amount\d+$/.test(k)).map(k => objOriginal[k]);
							const amountsScaled = Object.keys(obj).filter(k => /^amount\d+$/.test(k)).map(k => obj[k]);

							const entryParts = obj.entry.split(Renderer.recipe._RE_AMOUNT).filter(Boolean);
							const entryPartsOut = entryParts.slice(0, entryParts.findIndex(it => Renderer.recipe._RE_AMOUNT.test(it)) + 1);
							let ixAmount = 0;
							for (let i = entryPartsOut.length; i < entryParts.length; ++i) {
								let pt = entryParts[i];

								if (Renderer.recipe._RE_AMOUNT.test(pt)) {
									ixAmount++;
									entryPartsOut.push(pt);
									continue;
								}

								if (amountsOriginal[ixAmount] == null || amountsScaled[ixAmount] == null) {
									entryPartsOut.push(pt);
									continue;
								}

								const isSingleToPlural = amountsOriginal[ixAmount] <= 1 && amountsScaled[ixAmount] > 1;
								const isPluralToSingle = amountsOriginal[ixAmount] > 1 && amountsScaled[ixAmount] <= 1;

								if (!isSingleToPlural && !isPluralToSingle) {
									entryPartsOut.push(pt);
									continue;
								}

								if (isSingleToPlural) pt = Renderer.recipe._getPluralizedUnits(pt);
								else if (isPluralToSingle) pt = Renderer.recipe._getSingleizedUnits(pt);
								entryPartsOut.push(pt);
							}

							obj.entry = entryPartsOut.join("");
							// endregion

							Renderer.recipe._mutWrapOriginalAmounts({obj, objOriginal});

							return obj;
						},
					},
				);
			});

		Renderer.recipe.populateFullIngredients(cpyR);

		if (cpyR.serves) {
			if (cpyR.serves.min) cpyR.serves.min *= scaleFactor;
			if (cpyR.serves.max) cpyR.serves.max *= scaleFactor;
			if (cpyR.serves.exact) cpyR.serves.exact *= scaleFactor;
		}

		cpyR._displayName = `${cpyR.name} (×${scaleFactor})`;
		cpyR._scaleFactor = scaleFactor;

		return cpyR;
	},

	_UNITS_SINGLE_TO_PLURAL_S: [
		"bundle",
		"cup",
		"handful",
		"ounce",
		"piece",
		"pound",
		"slice",
		"sprig",
		"square",
		"strip",
		"tablespoon",
		"teaspoon",
		"wedge",
	],
	_UNITS_SINGLE_TO_PLURAL_ES: [
		"dash",
		"inch",
	],
	_FNS_SINGLE_TO_PLURAL: [],
	_FNS_PLURAL_TO_SINGLE: [],

	_getSingleizedUnits (str) {
		if (!Renderer.recipe._FNS_PLURAL_TO_SINGLE.length) {
			Renderer.recipe._FNS_PLURAL_TO_SINGLE = [
				...Renderer.recipe._UNITS_SINGLE_TO_PLURAL_S.map(word => str => str.replace(new RegExp(`\\b${word.escapeRegexp()}s\\b`, "gi"), (...m) => m[0].slice(0, -1))),
				...Renderer.recipe._UNITS_SINGLE_TO_PLURAL_ES.map(word => str => str.replace(new RegExp(`\\b${word.escapeRegexp()}es\\b`, "gi"), (...m) => m[0].slice(0, -2))),
			];
		}

		Renderer.recipe._FNS_PLURAL_TO_SINGLE.forEach(fn => str = fn(str));

		return str;
	},

	_getPluralizedUnits (str) {
		if (!Renderer.recipe._FNS_SINGLE_TO_PLURAL.length) {
			Renderer.recipe._FNS_SINGLE_TO_PLURAL = [
				...Renderer.recipe._UNITS_SINGLE_TO_PLURAL_S.map(word => str => str.replace(new RegExp(`\\b${word.escapeRegexp()}\\b`, "gi"), (...m) => `${m[0]}s`)),
				...Renderer.recipe._UNITS_SINGLE_TO_PLURAL_ES.map(word => str => str.replace(new RegExp(`\\b${word.escapeRegexp()}\\b`, "gi"), (...m) => `${m[0]}es`)),
			];
		}

		Renderer.recipe._FNS_SINGLE_TO_PLURAL.forEach(fn => str = fn(str));

		return str;
	},

	/** Only apply the `@help` note to standalone amounts, i.e. those not in other tags. */
	_mutWrapOriginalAmounts ({obj, objOriginal}) {
		const parts = [];
		let stack = "";
		let depth = 0;
		for (let i = 0; i < obj.entry.length; ++i) {
			const c = obj.entry[i];
			switch (c) {
				case "{": {
					depth++;
					stack += c;
					break;
				}
				case "}": {
					depth--;
					stack += c;
					if (!depth && stack) {
						parts.push(stack);
						stack = "";
					}
					break;
				}
				default: stack += c;
			}
		}
		if (stack) parts.push(stack);
		obj.entry = parts
			.map(pt => pt.replace(Renderer.recipe._RE_AMOUNT, (...m) => {
				const ixStart = m.slice(-3, -2)[0];
				if (ixStart !== 0 || m[0].length !== pt.length) return m[0];

				const originalValue = Renderer.applyProperties(m.last().tagAmount, objOriginal);
				return `{@help ${m.last().tagAmount}|In the original recipe: ${originalValue}}`;
			}))
			.join("");
	},

	// region Custom hash ID packing/unpacking
	getCustomHashId (it) {
		if (!it._scaleFactor) return null;

		const {
			name,
			source,
			_scaleFactor: scaleFactor,
		} = it;

		return [
			name,
			source,
			scaleFactor ?? "",
		].join("__").toLowerCase();
	},

	getUnpackedCustomHashId (customHashId) {
		if (!customHashId) return null;

		const [, , scaleFactor] = customHashId.split("__").map(it => it.trim());

		if (!scaleFactor) return null;

		return {
			_scaleFactor: scaleFactor ? Number(scaleFactor) : null,
			customHashId,
		};
	},
	// endregion
};

Renderer.card = {
	getFullEntries (ent) {
		const entries = [...ent.entries || []];
		if (ent.suit && (ent.valueName || ent.value)) {
			const suitAndValue = `${((ent.valueName || "") || Parser.numberToText(ent.value)).toTitleCase()} of ${ent.suit.toTitleCase()}`;
			if (suitAndValue.toLowerCase() !== ent.name.toLowerCase()) entries.unshift(`{@i ${suitAndValue}}`);
		}
		return entries;
	},

	getCompactRenderedString (ent) {
		const fullEntries = Renderer.card.getFullEntries(ent);
		return `
			${Renderer.utils.getNameTr(ent)}
			<tr class="text"><td colspan="6">
			${Renderer.get().setFirstSection(true).render({...ent.face, maxHeight: 40, maxHeightUnits: "vh"})}
			${fullEntries?.length ? `<hr class="hr-3">
			${Renderer.get().setFirstSection(true).render({type: "entries", entries: fullEntries}, 1)}` : ""}
			</td></tr>
		`;
	},
};

Renderer.deck = {
	getCompactRenderedString (ent) {
		const lstCards = {
			name: "Cards",
			entries: [
				{
					type: "list",
					columns: 3,
					items: ent.cards.map(card => `{@card ${card.name}|${card.set}|${card.source}}`),
				},
			],
		};

		return `
			${Renderer.utils.getNameTr(ent)}
			<tr class="text"><td colspan="6">
			${Renderer.get().setFirstSection(true).render({type: "entries", entries: ent.entries}, 1)}
			<hr class="hr-3">
			${Renderer.get().setFirstSection(true).render(lstCards, 1)}
			</td></tr>
		`;
	},
};

Renderer.skill = {
	getCompactRenderedString (ent) {
		return Renderer.generic.getCompactRenderedString(ent);
	},
};

Renderer.sense = {
	getCompactRenderedString (ent) {
		return Renderer.generic.getCompactRenderedString(ent);
	},
};

Renderer.itemMastery = {
	getCompactRenderedString (ent) {
		return Renderer.generic.getCompactRenderedString(ent);
	},
};

Renderer.generic = {
	/**
	 * @param it
	 * @param [opts]
	 * @param [opts.isSkipNameRow]
	 * @param [opts.isSkipPageRow]
	 * @param [opts.dataProp]
	 * @param [opts.page]
	 */
	getCompactRenderedString (it, opts) {
		opts = opts || {};
		const prerequisite = Renderer.utils.prerequisite.getHtml(it.prerequisite);

		return `
		${opts.dataProp && opts.page ? Renderer.utils.getExcludedTr({entity: it, dataProp: opts.dataProp, page: opts.page}) : ""}
		${opts.isSkipNameRow ? "" : Renderer.utils.getNameTr(it, {page: opts.page})}
		<tr class="text"><td colspan="6">
		${prerequisite ? `<p>${prerequisite}</p>` : ""}
		${Renderer.get().setFirstSection(true).render({entries: it.entries})}
		</td></tr>
		${opts.isSkipPageRow ? "" : Renderer.utils.getPageTr(it)}`;
	},
};

Renderer.hover = {
	LinkMeta: function () {
		this.isHovered = false;
		this.isLoading = false;
		this.isPermanent = false;
		this.windowMeta = null;
	},

	_BAR_HEIGHT: 16,

	_linkCache: {},
	_eleCache: new Map(),
	_entryCache: {},
	_isInit: false,
	_dmScreen: null,
	_lastId: 0,
	_contextMenu: null,
	_contextMenuLastClicked: null,

	bindDmScreen (screen) { this._dmScreen = screen; },

	_getNextId () { return ++Renderer.hover._lastId; },

	_doInit () {
		if (!Renderer.hover._isInit) {
			Renderer.hover._isInit = true;

			$(document.body).on("click", () => Renderer.hover.cleanTempWindows());

			Renderer.hover._contextMenu = ContextUtil.getMenu([
				new ContextUtil.Action(
					"Maximize All",
					() => {
						const $permWindows = $(`.hoverborder[data-perm="true"]`);
						$permWindows.attr("data-display-title", "false");
					},
				),
				new ContextUtil.Action(
					"Minimize All",
					() => {
						const $permWindows = $(`.hoverborder[data-perm="true"]`);
						$permWindows.attr("data-display-title", "true");
					},
				),
				null,
				new ContextUtil.Action(
					"Close Others",
					() => {
						const hoverId = Renderer.hover._contextMenuLastClicked?.hoverId;
						Renderer.hover._doCloseAllWindows({hoverIdBlocklist: new Set([hoverId])});
					},
				),
				new ContextUtil.Action(
					"Close All",
					() => Renderer.hover._doCloseAllWindows(),
				),
			]);
		}
	},

	cleanTempWindows () {
		for (const [ele, meta] of Renderer.hover._eleCache.entries()) {
			if (!meta.isPermanent && meta.windowMeta && !document.body.contains(ele)) {
				meta.windowMeta.doClose();
			} else if (!meta.isPermanent && meta.isHovered && meta.windowMeta) {
				// Check if any elements have failed to clear their hovering status on mouse move
				const bounds = ele.getBoundingClientRect();
				if (EventUtil._mouseX < bounds.x
					|| EventUtil._mouseY < bounds.y
					|| EventUtil._mouseX > bounds.x + bounds.width
					|| EventUtil._mouseY > bounds.y + bounds.height) {
					meta.windowMeta.doClose();
				}
			}
		}
	},

	_doCloseAllWindows ({hoverIdBlocklist = null} = {}) {
		Object.entries(Renderer.hover._WINDOW_METAS)
			.filter(([hoverId, meta]) => hoverIdBlocklist == null || !hoverIdBlocklist.has(Number(hoverId)))
			.forEach(([, meta]) => meta.doClose());
	},

	_getSetMeta (ele) {
		if (!Renderer.hover._eleCache.has(ele)) Renderer.hover._eleCache.set(ele, new Renderer.hover.LinkMeta());
		return Renderer.hover._eleCache.get(ele);
	},

	_handleGenericMouseOverStart (evt, ele) {
		// Don't open on small screens unless forced
		if (Renderer.hover.isSmallScreen(evt) && !evt.shiftKey) return;

		Renderer.hover.cleanTempWindows();

		const meta = Renderer.hover._getSetMeta(ele);
		if (meta.isHovered || meta.isLoading) return; // Another hover is already in progress

		// Set the cursor to a waiting spinner
		ele.style.cursor = "progress";

		meta.isHovered = true;
		meta.isLoading = true;
		meta.isPermanent = evt.shiftKey;

		return meta;
	},

	// (Baked into render strings)
	async pHandleLinkMouseOver (evt, ele, opts) {
		Renderer.hover._doInit();

		let page, source, hash, preloadId, customHashId, isFauxPage;
		if (opts) {
			page = opts.page;
			source = opts.source;
			hash = opts.hash;
			preloadId = opts.preloadId;
			customHashId = opts.customHashId;
			isFauxPage = !!opts.isFauxPage;
		} else {
			page = ele.dataset.vetPage;
			source = ele.dataset.vetSource;
			hash = ele.dataset.vetHash;
			preloadId = ele.dataset.vetPreloadId;
			isFauxPage = ele.dataset.vetIsFauxPage;
		}

		let meta = Renderer.hover._handleGenericMouseOverStart(evt, ele);
		if (meta == null) return;

		if ((evt.ctrlKey || evt.metaKey) && Renderer.hover._pageToFluffFn(page)) meta.isFluff = true;

		let toRender;
		if (preloadId != null) { // FIXME(Future) remove in favor of `customHashId`
			switch (page) {
				case UrlUtil.PG_BESTIARY: {
					const {_scaledCr: scaledCr, _scaledSpellSummonLevel: scaledSpellSummonLevel, _scaledClassSummonLevel: scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(preloadId);

					const baseMon = await DataLoader.pCacheAndGet(page, source, hash);
					if (scaledCr != null) {
						toRender = await ScaleCreature.scale(baseMon, scaledCr);
					} else if (scaledSpellSummonLevel != null) {
						toRender = await ScaleSpellSummonedCreature.scale(baseMon, scaledSpellSummonLevel);
					} else if (scaledClassSummonLevel != null) {
						toRender = await ScaleClassSummonedCreature.scale(baseMon, scaledClassSummonLevel);
					}
					break;
				}
			}
		} else if (customHashId) {
			toRender = await DataLoader.pCacheAndGet(page, source, hash);
			toRender = await Renderer.hover.pApplyCustomHashId(page, toRender, customHashId);
		} else {
			if (meta.isFluff) toRender = await Renderer.hover.pGetHoverableFluff(page, source, hash);
			else toRender = await DataLoader.pCacheAndGet(page, source, hash);
		}

		meta.isLoading = false;

		if (opts?.isDelay) {
			meta.isDelayed = true;
			ele.style.cursor = "help";
			await MiscUtil.pDelay(1100);
			meta.isDelayed = false;
		}

		// Reset cursor
		ele.style.cursor = "";

		// Check if we're still hovering the entity
		if (!meta || (!meta.isHovered && !meta.isPermanent)) return;

		const tmpEvt = meta._tmpEvt;
		delete meta._tmpEvt;

		// TODO(Future) avoid rendering e.g. creature scaling controls if `win?._IS_POPOUT`
		const win = (evt.view || {}).window;

		const $content = meta.isFluff
			? Renderer.hover.$getHoverContent_fluff(page, toRender)
			: Renderer.hover.$getHoverContent_stats(page, toRender);

		// FIXME(Future) replace this with something maintainable
		const compactReferenceData = {
			page,
			source,
			hash,
		};

		if (meta.windowMeta && !meta.isPermanent) {
			meta.windowMeta.doClose();
			meta.windowMeta = null;
		}

		meta.windowMeta = Renderer.hover.getShowWindow(
			$content,
			Renderer.hover.getWindowPositionFromEvent(tmpEvt || evt, {isPreventFlicker: !meta.isPermanent}),
			{
				title: toRender ? toRender.name : "",
				isPermanent: meta.isPermanent,
				pageUrl: isFauxPage ? null : `${Renderer.get().baseUrl}${page}#${hash}`,
				cbClose: () => meta.isHovered = meta.isPermanent = meta.isLoading = meta.isFluff = false,
				isBookContent: page === UrlUtil.PG_RECIPES,
				compactReferenceData,
				sourceData: toRender,
			},
		);

		if (!meta.isFluff && !win?._IS_POPOUT) {
			const fnBind = Renderer.hover.getFnBindListenersCompact(page);
			if (fnBind) fnBind(toRender, $content);
		}
	},

	async pGetHoverableFluff (page, source, hash, opts) {
		// Try to fetch the fluff directly
		let toRender = await DataLoader.pCacheAndGet(`${page}Fluff`, source, hash, opts);

		if (!toRender) {
			// Fall back on fluff attached to the object itself
			const entity = await DataLoader.pCacheAndGet(page, source, hash, opts);

			const pFnGetFluff = Renderer.hover._pageToFluffFn(page);
			if (!pFnGetFluff && opts?.isSilent) return null;

			toRender = await pFnGetFluff(entity);
		}

		if (!toRender) return toRender;

		// For inline homebrew fluff, populate the name/source
		if (toRender && (!toRender.name || !toRender.source)) {
			const toRenderParent = await DataLoader.pCacheAndGet(page, source, hash, opts);
			toRender = MiscUtil.copyFast(toRender);
			toRender.name = toRenderParent.name;
			toRender.source = toRenderParent.source;
		}

		return toRender;
	},

	// (Baked into render strings)
	handleLinkMouseLeave (evt, ele) {
		const meta = Renderer.hover._eleCache.get(ele);
		ele.style.cursor = "";

		if (!meta || meta.isPermanent) return;

		if (evt.shiftKey) {
			meta.isPermanent = true;
			meta.windowMeta.setIsPermanent(true);
			return;
		}

		meta.isHovered = false;
		if (meta.windowMeta) {
			meta.windowMeta.doClose();
			meta.windowMeta = null;
		}
	},

	// (Baked into render strings)
	handleLinkMouseMove (evt, ele) {
		const meta = Renderer.hover._eleCache.get(ele);
		if (!meta || meta.isPermanent) return;

		// If loading has finished, but we're not displaying the element yet (e.g. because it has been delayed)
		if (meta.isDelayed) {
			meta._tmpEvt = evt;
			return;
		}

		if (!meta.windowMeta) return;

		meta.windowMeta.setPosition(Renderer.hover.getWindowPositionFromEvent(evt, {isPreventFlicker: !evt.shiftKey && !meta.isPermanent}));

		if (evt.shiftKey && !meta.isPermanent) {
			meta.isPermanent = true;
			meta.windowMeta.setIsPermanent(true);
		}
	},

	/**
	 * (Baked into render strings)
	 * @param evt
	 * @param ele
	 * @param entryId
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [opts.isLargeBookContent]
	 */
	handlePredefinedMouseOver (evt, ele, entryId, opts) {
		opts = opts || {};

		const meta = Renderer.hover._handleGenericMouseOverStart(evt, ele);
		if (meta == null) return;

		Renderer.hover.cleanTempWindows();

		const toRender = Renderer.hover._entryCache[entryId];

		meta.isLoading = false;
		// Check if we're still hovering the entity
		if (!meta.isHovered && !meta.isPermanent) return;

		const $content = Renderer.hover.$getHoverContent_generic(toRender, opts);
		meta.windowMeta = Renderer.hover.getShowWindow(
			$content,
			Renderer.hover.getWindowPositionFromEvent(evt, {isPreventFlicker: !meta.isPermanent}),
			{
				title: toRender.data && toRender.data.hoverTitle != null ? toRender.data.hoverTitle : toRender.name,
				isPermanent: meta.isPermanent,
				cbClose: () => meta.isHovered = meta.isPermanent = meta.isLoading = false,
				sourceData: toRender,
			},
		);

		// Reset cursor
		ele.style.cursor = "";
	},

	// (Baked into render strings)
	handlePredefinedMouseLeave (evt, ele) { return Renderer.hover.handleLinkMouseLeave(evt, ele); },

	// (Baked into render strings)
	handlePredefinedMouseMove (evt, ele) { return Renderer.hover.handleLinkMouseMove(evt, ele); },

	_WINDOW_POSITION_PROPS_FROM_EVENT: [
		"isFromBottom",
		"isFromRight",
		"clientX",
		"window",
		"isPreventFlicker",
		"bcr",
	],

	getWindowPositionFromEvent (evt, {isPreventFlicker = false} = {}) {
		const ele = evt.target;
		const win = evt?.view?.window || window;

		const bcr = ele.getBoundingClientRect().toJSON();

		const isFromBottom = bcr.top > win.innerHeight / 2;
		const isFromRight = bcr.left > win.innerWidth / 2;

		return {
			mode: "autoFromElement",
			isFromBottom,
			isFromRight,
			clientX: EventUtil.getClientX(evt),
			window: win,
			isPreventFlicker,
			bcr,
		};
	},

	getWindowPositionExact (x, y, evt = null) {
		return {
			window: evt?.view?.window || window,
			mode: "exact",
			x,
			y,
		};
	},

	getWindowPositionExactVisibleBottom (x, y, evt = null) {
		return {
			...Renderer.hover.getWindowPositionExact(x, y, evt),
			mode: "exactVisibleBottom",
		};
	},

	_WINDOW_METAS: {},
	MIN_Z_INDEX: 200,
	_MAX_Z_INDEX: 300,
	_DEFAULT_WIDTH_PX: 600,
	_BODY_SCROLLER_WIDTH_PX: 15,

	_getZIndex () {
		const zIndices = Object.values(Renderer.hover._WINDOW_METAS).map(it => it.zIndex);
		if (!zIndices.length) return Renderer.hover.MIN_Z_INDEX;
		return Math.max(...zIndices);
	},

	_getNextZIndex (hoverId) {
		const cur = Renderer.hover._getZIndex();
		// If we're already the highest index, continue to use this index
		if (hoverId != null && Renderer.hover._WINDOW_METAS[hoverId].zIndex === cur) return cur;
		// otherwise, go one higher
		const out = cur + 1;

		// If we've broken through the max z-index, try to free up some z-indices
		if (out > Renderer.hover._MAX_Z_INDEX) {
			const sortedWindowMetas = Object.entries(Renderer.hover._WINDOW_METAS)
				.sort(([kA, vA], [kB, vB]) => SortUtil.ascSort(vA.zIndex, vB.zIndex));

			if (sortedWindowMetas.length >= (Renderer.hover._MAX_Z_INDEX - Renderer.hover.MIN_Z_INDEX)) {
				// If we have too many window open, collapse them into one z-index
				sortedWindowMetas.forEach(([k, v]) => {
					v.setZIndex(Renderer.hover.MIN_Z_INDEX);
				});
			} else {
				// Otherwise, ensure one consistent run from min to max z-index
				sortedWindowMetas.forEach(([k, v], i) => {
					v.setZIndex(Renderer.hover.MIN_Z_INDEX + i);
				});
			}

			return Renderer.hover._getNextZIndex(hoverId);
		} else return out;
	},

	_isIntersectRect (r1, r2) {
		return r1.left <= r2.right
			&& r2.left <= r1.right
			&& r1.top <= r2.bottom
			&& r2.top <= r1.bottom;
	},

	/**
	 * @param $content Content to append to the window.
	 * @param position The position of the window. Can be specified in various formats.
	 * @param [opts] Options object.
	 * @param [opts.isPermanent] If the window should have the expanded toolbar of a "permanent" window.
	 * @param [opts.title] The window title.
	 * @param [opts.isBookContent] If the hover window contains book content. Affects the styling of borders.
	 * @param [opts.pageUrl] A page URL which is navigable via a button in the window header
	 * @param [opts.cbClose] Callback to run on window close.
	 * @param [opts.width] An initial width for the window.
	 * @param [opts.height] An initial height fot the window.
	 * @param [opts.$pFnGetPopoutContent] A function which loads content for this window when it is popped out.
	 * @param [opts.fnGetPopoutSize] A function which gets a `{width: ..., height: ...}` object with dimensions for a
	 * popout window.
	 * @param [opts.isPopout] If the window should be immediately popped out.
	 * @param [opts.compactReferenceData] Reference (e.g. page/source/hash/others) which can be used to load the contents into the DM screen.
	 * @param [opts.sourceData] Source JSON (as raw as possible) used to construct this popout.
	 */
	getShowWindow ($content, position, opts) {
		opts = opts || {};

		Renderer.hover._doInit();

		const initialWidth = opts.width == null ? Renderer.hover._DEFAULT_WIDTH_PX : opts.width;
		const initialZIndex = Renderer.hover._getNextZIndex();

		const $body = $(position.window.document.body);
		const $hov = $(`<div class="hwin"></div>`)
			.css({
				"right": -initialWidth,
				"width": initialWidth,
				"zIndex": initialZIndex,
			});
		const $wrpContent = $(`<div class="hwin__wrp-table"></div>`);
		if (opts.height != null) $wrpContent.css("height", opts.height);
		const $hovTitle = $(`<span class="window-title min-w-0 overflow-ellipsis" title="${`${opts.title || ""}`.qq()}">${opts.title || ""}</span>`);

		const hoverWindow = {};
		const hoverId = Renderer.hover._getNextId();
		Renderer.hover._WINDOW_METAS[hoverId] = hoverWindow;
		const mouseUpId = `mouseup.${hoverId} touchend.${hoverId}`;
		const mouseMoveId = `mousemove.${hoverId} touchmove.${hoverId}`;
		const resizeId = `resize.${hoverId}`;
		const drag = {};

		const $brdrTopRightResize = $(`<div class="hoverborder__resize-ne"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 1}));

		const $brdrRightResize = $(`<div class="hoverborder__resize-e"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 2}));

		const $brdrBottomRightResize = $(`<div class="hoverborder__resize-se"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 3}));

		const $brdrBtm = $(`<div class="hoverborder hoverborder--btm ${opts.isBookContent ? "hoverborder-book" : ""}"><div class="hoverborder__resize-s"></div></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 4}));

		const $brdrBtmLeftResize = $(`<div class="hoverborder__resize-sw"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 5}));

		const $brdrLeftResize = $(`<div class="hoverborder__resize-w"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 6}));

		const $brdrTopLeftResize = $(`<div class="hoverborder__resize-nw"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 7}));

		const $brdrTopResize = $(`<div class="hoverborder__resize-n"></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 8}));

		const $brdrTop = $(`<div class="hoverborder hoverborder--top ${opts.isBookContent ? "hoverborder-book" : ""}" ${opts.isPermanent ? `data-perm="true"` : ""}></div>`)
			.on("mousedown touchstart", (evt) => Renderer.hover._getShowWindow_handleDragMousedown({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type: 9}))
			.on("contextmenu", (evt) => {
				Renderer.hover._contextMenuLastClicked = {
					hoverId,
				};
				ContextUtil.pOpenMenu(evt, Renderer.hover._contextMenu);
			});

		$(position.window.document)
			.on(mouseUpId, (evt) => {
				if (drag.type) {
					if (drag.type < 9) {
						$wrpContent.css("max-height", "");
						$hov.css("max-width", "");
					}
					Renderer.hover._getShowWindow_adjustPosition({$hov, $wrpContent, position});

					if (drag.type === 9) {
						// handle mobile button touches
						if (EventUtil.isUsingTouch() && evt.target.classList.contains("hwin__top-border-icon")) {
							evt.preventDefault();
							drag.type = 0;
							$(evt.target).click();
							return;
						}

						// handle DM screen integration
						if (this._dmScreen && opts.compactReferenceData) {
							const panel = this._dmScreen.getPanelPx(EventUtil.getClientX(evt), EventUtil.getClientY(evt));
							if (!panel) return;
							this._dmScreen.setHoveringPanel(panel);
							const target = panel.getAddButtonPos();

							if (Renderer.hover._getShowWindow_isOverHoverTarget({evt, target})) {
								panel.doPopulate_Stats(opts.compactReferenceData.page, opts.compactReferenceData.source, opts.compactReferenceData.hash);
								Renderer.hover._getShowWindow_doClose({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow});
							}
							this._dmScreen.resetHoveringButton();
						}
					}
					drag.type = 0;
				}
			})
			.on(mouseMoveId, (evt) => {
				const args = {$wrpContent, $hov, drag, evt};
				switch (drag.type) {
					case 1: Renderer.hover._getShowWindow_handleNorthDrag(args); Renderer.hover._getShowWindow_handleEastDrag(args); break;
					case 2: Renderer.hover._getShowWindow_handleEastDrag(args); break;
					case 3: Renderer.hover._getShowWindow_handleSouthDrag(args); Renderer.hover._getShowWindow_handleEastDrag(args); break;
					case 4: Renderer.hover._getShowWindow_handleSouthDrag(args); break;
					case 5: Renderer.hover._getShowWindow_handleSouthDrag(args); Renderer.hover._getShowWindow_handleWestDrag(args); break;
					case 6: Renderer.hover._getShowWindow_handleWestDrag(args); break;
					case 7: Renderer.hover._getShowWindow_handleNorthDrag(args); Renderer.hover._getShowWindow_handleWestDrag(args); break;
					case 8: Renderer.hover._getShowWindow_handleNorthDrag(args); break;
					case 9: {
						const diffX = drag.startX - EventUtil.getClientX(evt);
						const diffY = drag.startY - EventUtil.getClientY(evt);
						$hov.css("left", drag.baseLeft - diffX)
							.css("top", drag.baseTop - diffY);
						drag.startX = EventUtil.getClientX(evt);
						drag.startY = EventUtil.getClientY(evt);
						drag.baseTop = parseFloat($hov.css("top"));
						drag.baseLeft = parseFloat($hov.css("left"));

						// handle DM screen integration
						if (this._dmScreen) {
							const panel = this._dmScreen.getPanelPx(EventUtil.getClientX(evt), EventUtil.getClientY(evt));
							if (!panel) return;
							this._dmScreen.setHoveringPanel(panel);
							const target = panel.getAddButtonPos();

							if (Renderer.hover._getShowWindow_isOverHoverTarget({evt, target})) this._dmScreen.setHoveringButton(panel);
							else this._dmScreen.resetHoveringButton();
						}
						break;
					}
				}
			});
		$(position.window).on(resizeId, () => Renderer.hover._getShowWindow_adjustPosition({$hov, $wrpContent, position}));

		$brdrTop.attr("data-display-title", false);
		$brdrTop.on("dblclick", () => Renderer.hover._getShowWindow_doToggleMinimizedMaximized({$brdrTop, $hov}));
		$brdrTop.append($hovTitle);
		const $brdTopRhs = $(`<div class="ve-flex ml-auto no-shrink"></div>`).appendTo($brdrTop);

		if (opts.pageUrl && !position.window._IS_POPOUT && !Renderer.get().isInternalLinksDisabled()) {
			const $btnGotoPage = $(`<a class="hwin__top-border-icon glyphicon glyphicon-modal-window" title="Go to Page" href="${opts.pageUrl}"></a>`)
				.appendTo($brdTopRhs);
		}

		if (!position.window._IS_POPOUT && !opts.isPopout) {
			const $btnPopout = $(`<span class="hwin__top-border-icon glyphicon glyphicon-new-window hvr__popout" title="Open as Popup Window"></span>`)
				.on("click", evt => {
					evt.stopPropagation();
					return Renderer.hover._getShowWindow_pDoPopout({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow, $content}, {evt});
				})
				.appendTo($brdTopRhs);
		}

		if (opts.sourceData) {
			const btnPopout = e_({
				tag: "span",
				clazz: `hwin__top-border-icon hwin__top-border-icon--text`,
				title: "Show Source Data",
				text: "{}",
				click: evt => {
					evt.stopPropagation();
					evt.preventDefault();

					const $content = Renderer.hover.$getHoverContent_statsCode(opts.sourceData);
					Renderer.hover.getShowWindow(
						$content,
						Renderer.hover.getWindowPositionFromEvent(evt),
						{
							title: [opts.sourceData._displayName || opts.sourceData.name, "Source Data"].filter(Boolean).join(" \u2014 "),
							isPermanent: true,
							isBookContent: true,
						},
					);
				},
			});
			$brdTopRhs.append(btnPopout);
		}

		const $btnClose = $(`<span class="hwin__top-border-icon glyphicon glyphicon-remove" title="Close (CTRL to Close All)"></span>`)
			.on("click", (evt) => {
				evt.stopPropagation();

				if (evt.ctrlKey || evt.metaKey) {
					Renderer.hover._doCloseAllWindows();
					return;
				}

				Renderer.hover._getShowWindow_doClose({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow});
			}).appendTo($brdTopRhs);

		$wrpContent.append($content);

		$hov.append($brdrTopResize).append($brdrTopRightResize).append($brdrRightResize).append($brdrBottomRightResize)
			.append($brdrBtmLeftResize).append($brdrLeftResize).append($brdrTopLeftResize)

			.append($brdrTop)
			.append($wrpContent)
			.append($brdrBtm);

		$body.append($hov);

		Renderer.hover._getShowWindow_setPosition({$hov, $wrpContent, position}, position);

		hoverWindow.$windowTitle = $hovTitle;
		hoverWindow.zIndex = initialZIndex;
		hoverWindow.setZIndex = Renderer.hover._getNextZIndex.bind(this, {$hov, hoverWindow});

		hoverWindow.setPosition = Renderer.hover._getShowWindow_setPosition.bind(this, {$hov, $wrpContent, position});
		hoverWindow.setIsPermanent = Renderer.hover._getShowWindow_setIsPermanent.bind(this, {opts, $brdrTop});
		hoverWindow.doClose = Renderer.hover._getShowWindow_doClose.bind(this, {$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow});
		hoverWindow.doMaximize = Renderer.hover._getShowWindow_doMaximize.bind(this, {$brdrTop, $hov});
		hoverWindow.doZIndexToFront = Renderer.hover._getShowWindow_doZIndexToFront.bind(this, {$hov, hoverWindow, hoverId});

		if (opts.isPopout) pDoPopout().then(null);

		return hoverWindow;
	},

	_getShowWindow_doClose ({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow}) {
		$hov.remove();
		$(position.window.document).off(mouseUpId);
		$(position.window.document).off(mouseMoveId);
		$(position.window).off(resizeId);

		delete Renderer.hover._WINDOW_METAS[hoverId];

		if (opts.cbClose) opts.cbClose(hoverWindow);
	},

	_getShowWindow_handleDragMousedown ({hoverWindow, hoverId, $hov, drag, $wrpContent}, {evt, type}) {
		if (evt.which === 0 || evt.which === 1) evt.preventDefault();
		hoverWindow.zIndex = Renderer.hover._getNextZIndex(hoverId);
		$hov.css({
			"z-index": hoverWindow.zIndex,
			"animation": "initial",
		});
		drag.type = type;
		drag.startX = EventUtil.getClientX(evt);
		drag.startY = EventUtil.getClientY(evt);
		drag.baseTop = parseFloat($hov.css("top"));
		drag.baseLeft = parseFloat($hov.css("left"));
		drag.baseHeight = $wrpContent.height();
		drag.baseWidth = parseFloat($hov.css("width"));
		if (type < 9) {
			$wrpContent.css({
				"height": drag.baseHeight,
				"max-height": "initial",
			});
			$hov.css("max-width", "initial");
		}
	},

	_getShowWindow_isOverHoverTarget ({evt, target}) {
		return EventUtil.getClientX(evt) >= target.left
			&& EventUtil.getClientX(evt) <= target.left + target.width
			&& EventUtil.getClientY(evt) >= target.top
			&& EventUtil.getClientY(evt) <= target.top + target.height;
	},

	_getShowWindow_handleNorthDrag ({$wrpContent, $hov, drag, evt}) {
		const diffY = Math.max(drag.startY - EventUtil.getClientY(evt), 80 - drag.baseHeight); // prevent <80 height, as this will cause the box to move downwards
		$wrpContent.css("height", drag.baseHeight + diffY);
		$hov.css("top", drag.baseTop - diffY);
		drag.startY = EventUtil.getClientY(evt);
		drag.baseHeight = $wrpContent.height();
		drag.baseTop = parseFloat($hov.css("top"));
	},

	_getShowWindow_handleEastDrag ({$wrpContent, $hov, drag, evt}) {
		const diffX = drag.startX - EventUtil.getClientX(evt);
		$hov.css("width", drag.baseWidth - diffX);
		drag.startX = EventUtil.getClientX(evt);
		drag.baseWidth = parseFloat($hov.css("width"));
	},

	_getShowWindow_handleSouthDrag ({$wrpContent, $hov, drag, evt}) {
		const diffY = drag.startY - EventUtil.getClientY(evt);
		$wrpContent.css("height", drag.baseHeight - diffY);
		drag.startY = EventUtil.getClientY(evt);
		drag.baseHeight = $wrpContent.height();
	},

	_getShowWindow_handleWestDrag ({$wrpContent, $hov, drag, evt}) {
		const diffX = Math.max(drag.startX - EventUtil.getClientX(evt), 150 - drag.baseWidth);
		$hov.css("width", drag.baseWidth + diffX)
			.css("left", drag.baseLeft - diffX);
		drag.startX = EventUtil.getClientX(evt);
		drag.baseWidth = parseFloat($hov.css("width"));
		drag.baseLeft = parseFloat($hov.css("left"));
	},

	_getShowWindow_doToggleMinimizedMaximized ({$brdrTop, $hov}) {
		const curState = $brdrTop.attr("data-display-title");
		const isNextMinified = curState === "false";
		$brdrTop.attr("data-display-title", isNextMinified);
		$brdrTop.attr("data-perm", true);
		$hov.toggleClass("hwin--minified", isNextMinified);
	},

	_getShowWindow_doMaximize ({$brdrTop, $hov}) {
		$brdrTop.attr("data-display-title", false);
		$hov.toggleClass("hwin--minified", false);
	},

	async _getShowWindow_pDoPopout ({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow, $content}, {evt}) {
		const dimensions = opts.fnGetPopoutSize ? opts.fnGetPopoutSize() : {width: 600, height: $content.height()};
		const win = window.open(
			"",
			opts.title || "",
			`width=${dimensions.width},height=${dimensions.height}location=0,menubar=0,status=0,titlebar=0,toolbar=0`,
		);

		// If this is a new window, bootstrap general page elements/variables.
		// Otherwise, we can skip straight to using the window.
		if (!win._IS_POPOUT) {
			win._IS_POPOUT = true;
			win.document.write(`
				<!DOCTYPE html>
				<html lang="en" class="ve-popwindow ${typeof styleSwitcher !== "undefined" ? styleSwitcher.getDayNightClassNames() : ""}"><head>
					<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
					<title>${opts.title}</title>
					${$(`link[rel="stylesheet"][href]`).map((i, e) => e.outerHTML).get().join("\n")}
					<!-- Favicons -->
					<link rel="icon" type="image/svg+xml" href="favicon.svg">
					<link rel="icon" type="image/png" sizes="256x256" href="favicon-256x256.png">
					<link rel="icon" type="image/png" sizes="144x144" href="favicon-144x144.png">
					<link rel="icon" type="image/png" sizes="128x128" href="favicon-128x128.png">
					<link rel="icon" type="image/png" sizes="64x64" href="favicon-64x64.png">
					<link rel="icon" type="image/png" sizes="48x48" href="favicon-48x48.png">
					<link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
					<link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png">

					<!-- Chrome Web App Icons -->
					<link rel="manifest" href="manifest.webmanifest">
					<meta name="application-name" content="5etools">
					<meta name="theme-color" content="#006bc4">

					<!-- Windows Start Menu tiles -->
					<meta name="msapplication-config" content="browserconfig.xml"/>
					<meta name="msapplication-TileColor" content="#006bc4">

					<!-- Apple Touch Icons -->
					<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon-180x180.png">
					<link rel="apple-touch-icon" sizes="360x360" href="apple-touch-icon-360x360.png">
					<link rel="apple-touch-icon" sizes="167x167" href="apple-touch-icon-167x167.png">
					<link rel="apple-touch-icon" sizes="152x152" href="apple-touch-icon-152x152.png">
					<link rel="apple-touch-icon" sizes="120x120" href="apple-touch-icon-120x120.png">
					<meta name="apple-mobile-web-app-title" content="5etools">

					<!-- macOS Safari Pinned Tab and Touch Bar -->
					<link rel="mask-icon" href="safari-pinned-tab.svg" color="#006bc4">

					<style>
						html, body { width: 100%; height: 100%; }
						body { overflow-y: scroll; }
						.hwin--popout { max-width: 100%; max-height: 100%; box-shadow: initial; width: 100%; overflow-y: auto; }
					</style>
				</head><body class="rd__body-popout">
				<div class="hwin hoverbox--popout hwin--popout"></div>
				<script type="text/javascript" src="js/parser.js"></script>
				<script type="text/javascript" src="js/utils.js"></script>
				<script type="text/javascript" src="lib/jquery.js"></script>
				</body></html>
			`);

			win.Renderer = Renderer;

			let ticks = 50;
			while (!win.document.body && ticks-- > 0) await MiscUtil.pDelay(5);

			win.$wrpHoverContent = $(win.document).find(`.hoverbox--popout`);
		}

		let $cpyContent;
		if (opts.$pFnGetPopoutContent) {
			$cpyContent = await opts.$pFnGetPopoutContent();
		} else {
			$cpyContent = $content.clone(true, true);
		}

		$cpyContent.appendTo(win.$wrpHoverContent.empty());

		Renderer.hover._getShowWindow_doClose({$hov, position, mouseUpId, mouseMoveId, resizeId, hoverId, opts, hoverWindow});
	},

	_getShowWindow_setPosition ({$hov, $wrpContent, position}, positionNxt) {
		switch (positionNxt.mode) {
			case "autoFromElement": {
				const bcr = $hov[0].getBoundingClientRect();

				if (positionNxt.isFromBottom) $hov.css("top", positionNxt.bcr.top - (bcr.height + 10));
				else $hov.css("top", positionNxt.bcr.top + positionNxt.bcr.height + 10);

				if (positionNxt.isFromRight) $hov.css("left", (positionNxt.clientX || positionNxt.bcr.left) - (bcr.width + 10));
				else $hov.css("left", (positionNxt.clientX || (positionNxt.bcr.left + positionNxt.bcr.width)) + 10);

				// region Sync position info when updating
				if (position !== positionNxt) {
					Renderer.hover._WINDOW_POSITION_PROPS_FROM_EVENT
						.forEach(prop => {
							position[prop] = positionNxt[prop];
						});
				}
				// endregion

				break;
			}
			case "exact": {
				$hov.css({
					"left": positionNxt.x,
					"top": positionNxt.y,
				});
				break;
			}
			case "exactVisibleBottom": {
				$hov.css({
					"left": positionNxt.x,
					"top": positionNxt.y,
					"animation": "initial", // Briefly remove the animation so we can calculate the height
				});

				let yPos = positionNxt.y;

				const {bottom: posBottom, height: winHeight} = $hov[0].getBoundingClientRect();
				const height = position.window.innerHeight;
				if (posBottom > height) {
					yPos = position.window.innerHeight - winHeight;
					$hov.css({
						"top": yPos,
						"animation": "",
					});
				}

				break;
			}
			default: throw new Error(`Positiong mode unimplemented: "${positionNxt.mode}"`);
		}

		Renderer.hover._getShowWindow_adjustPosition({$hov, $wrpContent, position});
	},

	_getShowWindow_adjustPosition ({$hov, $wrpContent, position}) {
		const eleHov = $hov[0];
		const wrpContent = $wrpContent[0];

		const bcr = eleHov.getBoundingClientRect().toJSON();
		const screenHeight = position.window.innerHeight;
		const screenWidth = position.window.innerWidth;

		// readjust position...
		// ...if vertically clipping off screen
		if (bcr.top < 0) {
			bcr.top = 0;
			bcr.bottom = bcr.top + bcr.height;
			eleHov.style.top = `${bcr.top}px`;
		} else if (bcr.top >= screenHeight - Renderer.hover._BAR_HEIGHT) {
			bcr.top = screenHeight - Renderer.hover._BAR_HEIGHT;
			bcr.bottom = bcr.top + bcr.height;
			eleHov.style.top = `${bcr.top}px`;
		}

		// ...if horizontally clipping off screen
		if (bcr.left < 0) {
			bcr.left = 0;
			bcr.right = bcr.left + bcr.width;
			eleHov.style.left = `${bcr.left}px`;
		} else if (bcr.left + bcr.width + Renderer.hover._BODY_SCROLLER_WIDTH_PX > screenWidth) {
			bcr.left = Math.max(screenWidth - bcr.width - Renderer.hover._BODY_SCROLLER_WIDTH_PX, 0);
			bcr.right = bcr.left + bcr.width;
			eleHov.style.left = `${bcr.left}px`;
		}

		// Prevent window "flickering" when hovering a link
		if (
			position.isPreventFlicker
			&& Renderer.hover._isIntersectRect(bcr, position.bcr)
		) {
			if (position.isFromBottom) {
				bcr.height = position.bcr.top - 5;
				wrpContent.style.height = `${bcr.height}px`;
			} else {
				bcr.height = screenHeight - position.bcr.bottom - 5;
				wrpContent.style.height = `${bcr.height}px`;
			}
		}
	},

	_getShowWindow_setIsPermanent ({opts, $brdrTop}, isPermanent) {
		opts.isPermanent = isPermanent;
		$brdrTop.attr("data-perm", isPermanent);
	},

	_getShowWindow_setZIndex ({$hov, hoverWindow}, zIndex) {
		$hov.css("z-index", zIndex);
		hoverWindow.zIndex = zIndex;
	},

	_getShowWindow_doZIndexToFront ({$hov, hoverWindow, hoverId}) {
		const nxtZIndex = Renderer.hover._getNextZIndex(hoverId);
		Renderer.hover._getNextZIndex({$hov, hoverWindow}, nxtZIndex);
	},

	/**
	 * @param entry
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [opts.isLargeBookContent]
	 * @param [opts.depth]
	 * @param [opts.id]
	 */
	getMakePredefinedHover (entry, opts) {
		opts = opts || {};

		const id = opts.id ?? Renderer.hover._getNextId();
		Renderer.hover._entryCache[id] = entry;
		return {
			id,
			html: `onmouseover="Renderer.hover.handlePredefinedMouseOver(event, this, ${id}, ${JSON.stringify(opts).escapeQuotes()})" onmousemove="Renderer.hover.handlePredefinedMouseMove(event, this)" onmouseleave="Renderer.hover.handlePredefinedMouseLeave(event, this)" ${Renderer.hover.getPreventTouchString()}`,
			mouseOver: (evt, ele) => Renderer.hover.handlePredefinedMouseOver(evt, ele, id, opts),
			mouseMove: (evt, ele) => Renderer.hover.handlePredefinedMouseMove(evt, ele),
			mouseLeave: (evt, ele) => Renderer.hover.handlePredefinedMouseLeave(evt, ele),
			touchStart: (evt, ele) => Renderer.hover.handleTouchStart(evt, ele),
		};
	},

	updatePredefinedHover (id, entry) {
		Renderer.hover._entryCache[id] = entry;
	},

	getPreventTouchString () {
		return `ontouchstart="Renderer.hover.handleTouchStart(event, this)"`;
	},

	handleTouchStart (evt, ele) {
		// on large touchscreen devices only (e.g. iPads)
		if (!Renderer.hover.isSmallScreen(evt)) {
			// cache the link location and redirect it to void
			$(ele).data("href", $(ele).data("href") || $(ele).attr("href"));
			$(ele).attr("href", "javascript:void(0)");
			// restore the location after 100ms; if the user long-presses the link will be restored by the time they
			//   e.g. attempt to open a new tab
			setTimeout(() => {
				const data = $(ele).data("href");
				if (data) {
					$(ele).attr("href", data);
					$(ele).data("href", null);
				}
			}, 100);
		}
	},

	// region entry fetching
	getEntityLink (
		ent,
		{
			displayText = null,
			prop = null,
			isLowerCase = false,
			isTitleCase = false,
		} = {},
	) {
		if (isLowerCase && isTitleCase) throw new Error(`"isLowerCase" and "isTitleCase" are mutually exclusive!`);

		const name = isLowerCase ? ent.name.toLowerCase() : isTitleCase ? ent.name.toTitleCase() : ent.name;

		let parts = [
			name,
			ent.source,
			displayText || "",
		];

		switch (prop || ent.__prop) {
			case "monster": {
				if (ent._isScaledCr) {
					parts.push(`${VeCt.HASH_SCALED}=${Parser.numberToCr(ent._scaledCr)}`);
				}

				if (ent._isScaledSpellSummon) {
					parts.push(`${VeCt.HASH_SCALED_SPELL_SUMMON}=${ent._scaledSpellSummonLevel}`);
				}

				if (ent._isScaledClassSummon) {
					parts.push(`${VeCt.HASH_SCALED_CLASS_SUMMON}=${ent._scaledClassSummonLevel}`);
				}

				break;
			}

			// TODO recipe?

			case "deity": {
				parts.splice(1, 0, ent.pantheon);
				break;
			}
		}

		while (parts.length && !parts.last()?.length) parts.pop();

		return Renderer.get().render(`{@${Parser.getPropTag(prop || ent.__prop)} ${parts.join("|")}}`);
	},

	getRefMetaFromTag (str) {
		// convert e.g. `"{#itemEntry Ring of Resistance|DMG}"`
		//   to `{type: "refItemEntry", "itemEntry": "Ring of Resistance|DMG"}`
		str = str.slice(2, -1);
		const [tag, ...refParts] = str.split(" ");
		const ref = refParts.join(" ");
		const type = `ref${tag.uppercaseFirst()}`;
		return {type, [tag]: ref};
	},
	// endregion

	// region Apply custom hash IDs
	async pApplyCustomHashId (page, ent, customHashId) {
		switch (page) {
			case UrlUtil.PG_BESTIARY: {
				if (!customHashId) {
					Renderer.monster.initParsed(ent);
					return ent;
				}

				const {_scaledCr, _scaledSpellSummonLevel, _scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(customHashId);
				if (_scaledCr != null) ent = await ScaleCreature.scale(ent, _scaledCr);
				else if (_scaledSpellSummonLevel != null) ent = await ScaleSpellSummonedCreature.scale(ent, _scaledSpellSummonLevel);
				else if (_scaledClassSummonLevel != null) ent = await ScaleClassSummonedCreature.scale(ent, _scaledClassSummonLevel);

				Renderer.monster.updateParsed(ent);

				return ent;
			}

			case UrlUtil.PG_RECIPES: {
				if (!customHashId) return ent;
				const {_scaleFactor} = Renderer.recipe.getUnpackedCustomHashId(customHashId);
				if (_scaleFactor == null) return ent;
				return Renderer.recipe.getScaledRecipe(ent, _scaleFactor);
			}

			default: return ent;
		}
	},
	// endregion

	getGenericCompactRenderedString (entry, depth = 0) {
		return `
			<tr class="text homebrew-hover"><td colspan="6">
			${Renderer.get().setFirstSection(true).render(entry, depth)}
			</td></tr>
		`;
	},

	getFnRenderCompact (page, {isStatic = false} = {}) {
		switch (page) {
			case "generic":
			case "hover": return Renderer.hover.getGenericCompactRenderedString;
			case UrlUtil.PG_QUICKREF: return Renderer.hover.getGenericCompactRenderedString;
			case UrlUtil.PG_CLASSES: return Renderer.class.getCompactRenderedString;
			case UrlUtil.PG_SPELLS: return Renderer.spell.getCompactRenderedString;
			case UrlUtil.PG_ITEMS: return Renderer.item.getCompactRenderedString;
			case UrlUtil.PG_BESTIARY: return it => Renderer.monster.getCompactRenderedString(it, {isShowScalers: !isStatic, isScaledCr: it._originalCr != null, isScaledSpellSummon: it._isScaledSpellSummon, isScaledClassSummon: it._isScaledClassSummon});
			case UrlUtil.PG_CONDITIONS_DISEASES: return Renderer.condition.getCompactRenderedString;
			case UrlUtil.PG_BACKGROUNDS: return Renderer.background.getCompactRenderedString;
			case UrlUtil.PG_FEATS: return Renderer.feat.getCompactRenderedString;
			case UrlUtil.PG_OPT_FEATURES: return Renderer.optionalfeature.getCompactRenderedString;
			case UrlUtil.PG_PSIONICS: return Renderer.psionic.getCompactRenderedString;
			case UrlUtil.PG_REWARDS: return Renderer.reward.getCompactRenderedString;
			case UrlUtil.PG_RACES: return it => Renderer.race.getCompactRenderedString(it, {isStatic});
			case UrlUtil.PG_DEITIES: return Renderer.deity.getCompactRenderedString;
			case UrlUtil.PG_OBJECTS: return Renderer.object.getCompactRenderedString;
			case UrlUtil.PG_TRAPS_HAZARDS: return Renderer.traphazard.getCompactRenderedString;
			case UrlUtil.PG_VARIANTRULES: return Renderer.variantrule.getCompactRenderedString;
			case UrlUtil.PG_CULTS_BOONS: return Renderer.cultboon.getCompactRenderedString;
			case UrlUtil.PG_TABLES: return Renderer.table.getCompactRenderedString;
			case UrlUtil.PG_VEHICLES: return Renderer.vehicle.getCompactRenderedString;
			case UrlUtil.PG_ACTIONS: return Renderer.action.getCompactRenderedString;
			case UrlUtil.PG_LANGUAGES: return Renderer.language.getCompactRenderedString;
			case UrlUtil.PG_CHAR_CREATION_OPTIONS: return Renderer.charoption.getCompactRenderedString;
			case UrlUtil.PG_RECIPES: return Renderer.recipe.getCompactRenderedString;
			case UrlUtil.PG_CLASS_SUBCLASS_FEATURES: return Renderer.hover.getGenericCompactRenderedString;
			case UrlUtil.PG_DECKS: return Renderer.deck.getCompactRenderedString;
			// region props
			case "classfeature":
			case "classFeature":
				return Renderer.hover.getGenericCompactRenderedString;
			case "subclassfeature":
			case "subclassFeature":
				return Renderer.hover.getGenericCompactRenderedString;
			// endregion
			default:
				if (Renderer[page]?.getCompactRenderedString) return Renderer[page].getCompactRenderedString;
				return null;
		}
	},

	getFnBindListenersCompact (page) {
		switch (page) {
			case UrlUtil.PG_BESTIARY: return Renderer.monster.bindListenersCompact;
			case UrlUtil.PG_RACES: return Renderer.race.bindListenersCompact;
			default: return null;
		}
	},

	_pageToFluffFn (page) {
		switch (page) {
			case UrlUtil.PG_BESTIARY: return Renderer.monster.pGetFluff;
			case UrlUtil.PG_ITEMS: return Renderer.item.pGetFluff;
			case UrlUtil.PG_CONDITIONS_DISEASES: return Renderer.condition.pGetFluff;
			case UrlUtil.PG_SPELLS: return Renderer.spell.pGetFluff;
			case UrlUtil.PG_RACES: return Renderer.race.pGetFluff;
			case UrlUtil.PG_BACKGROUNDS: return Renderer.background.pGetFluff;
			case UrlUtil.PG_FEATS: return Renderer.feat.pGetFluff;
			case UrlUtil.PG_LANGUAGES: return Renderer.language.pGetFluff;
			case UrlUtil.PG_VEHICLES: return Renderer.vehicle.pGetFluff;
			case UrlUtil.PG_CHAR_CREATION_OPTIONS: return Renderer.charoption.pGetFluff;
			case UrlUtil.PG_RECIPES: return Renderer.recipe.pGetFluff;
			default: return null;
		}
	},

	isSmallScreen (evt) {
		if (typeof window === "undefined") return false;

		evt = evt || {};
		const win = (evt.view || {}).window || window;
		return win.innerWidth <= 768;
	},

	/**
	 * @param page
	 * @param toRender
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [opts.isStatic] If this content is to be "static," i.e. display only, containing minimal interactive UI.
	 * @param [opts.fnRender]
	 * @param [renderFnOpts]
	 */
	$getHoverContent_stats (page, toRender, opts, renderFnOpts) {
		opts = opts || {};
		if (page === UrlUtil.PG_RECIPES) opts = {...MiscUtil.copyFast(opts), isBookContent: true};

		const fnRender = opts.fnRender || Renderer.hover.getFnRenderCompact(page, {isStatic: opts.isStatic});
		const $out = $$`<table class="w-100 stats ${opts.isBookContent ? `stats--book` : ""}">${fnRender(toRender, renderFnOpts)}</table>`;

		if (!opts.isStatic) {
			const fnBind = Renderer.hover.getFnBindListenersCompact(page);
			if (fnBind) fnBind(toRender, $out[0]);
		}

		return $out;
	},

	/**
	 * @param page
	 * @param toRender
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [renderFnOpts]
	 */
	$getHoverContent_fluff (page, toRender, opts, renderFnOpts) {
		opts = opts || {};
		if (page === UrlUtil.PG_RECIPES) opts = {...MiscUtil.copyFast(opts), isBookContent: true};

		if (!toRender) {
			return $$`<table class="w-100 stats ${opts.isBookContent ? `stats--book` : ""}"><tr class="text"><td colspan="6" class="p-2 text-center">${Renderer.utils.HTML_NO_INFO}</td></tr></table>`;
		}

		toRender = MiscUtil.copyFast(toRender);

		if (toRender.images && toRender.images.length) {
			const cachedImages = MiscUtil.copyFast(toRender.images);
			delete toRender.images;

			toRender.entries = toRender.entries || [];
			const hasText = toRender.entries.length > 0;
			// Add the first image at the top
			if (hasText) toRender.entries.unshift({type: "hr"});
			cachedImages[0].maxHeight = 33;
			cachedImages[0].maxHeightUnits = "vh";
			toRender.entries.unshift(cachedImages[0]);

			// Add any other images at the bottom
			if (cachedImages.length > 1) {
				if (hasText) toRender.entries.push({type: "hr"});
				toRender.entries.push(...cachedImages.slice(1));
			}
		}

		return $$`<table class="w-100 stats ${opts.isBookContent ? `stats--book` : ""}">${Renderer.generic.getCompactRenderedString(toRender, renderFnOpts)}</table>`;
	},

	$getHoverContent_statsCode (toRender, {isSkipClean = false, title = null} = {}) {
		const cleanCopy = isSkipClean ? toRender : DataUtil.cleanJson(MiscUtil.copyFast(toRender));
		return Renderer.hover.$getHoverContent_miscCode(
			title || [cleanCopy.name, "Source Data"].filter(Boolean).join(" \u2014 "),
			JSON.stringify(cleanCopy, null, "\t"),
		);
	},

	$getHoverContent_miscCode (name, code) {
		const toRenderCode = {
			type: "code",
			name,
			preformatted: code,
		};
		return $$`<table class="w-100 stats stats--book">${Renderer.get().render(toRenderCode)}</table>`;
	},

	/**
	 * @param toRender
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [opts.isLargeBookContent]
	 * @param [opts.depth]
	 */
	$getHoverContent_generic (toRender, opts) {
		opts = opts || {};

		return $$`<table class="w-100 stats ${opts.isBookContent || opts.isLargeBookContent ? "stats--book" : ""} ${opts.isLargeBookContent ? "stats--book-large" : ""}">${Renderer.hover.getGenericCompactRenderedString(toRender, opts.depth || 0)}</table>`;
	},

	/**
	 * @param evt
	 * @param entity
	 */
	doPopoutCurPage (evt, entity) {
		const page = UrlUtil.getCurrentPage();
		const $content = Renderer.hover.$getHoverContent_stats(page, entity);
		Renderer.hover.getShowWindow(
			$content,
			Renderer.hover.getWindowPositionFromEvent(evt),
			{
				pageUrl: `#${UrlUtil.autoEncodeHash(entity)}`,
				title: entity._displayName || entity.name,
				isPermanent: true,
				isBookContent: page === UrlUtil.PG_RECIPES,
				sourceData: entity,
			},
		);
	},
};

/**
 * Recursively find all the names of entries, useful for indexing
 * @param nameStack an array to append the names to
 * @param entry the base entry
 * @param [opts] Options object.
 * @param [opts.maxDepth] Maximum depth to search for
 * @param [opts.depth] Start depth (used internally when recursing)
 * @param [opts.typeBlocklist] A set of entry types to avoid.
 */
Renderer.getNames = function (nameStack, entry, opts) {
	opts = opts || {};
	if (opts.maxDepth == null) opts.maxDepth = false;
	if (opts.depth == null) opts.depth = 0;

	if (opts.typeBlocklist && entry.type && opts.typeBlocklist.has(entry.type)) return;

	if (opts.maxDepth !== false && opts.depth > opts.maxDepth) return;
	if (entry.name) nameStack.push(Renderer.stripTags(entry.name));
	if (entry.entries) {
		let nextDepth = entry.type === "section" ? -1 : entry.type === "entries" ? opts.depth + 1 : opts.depth;
		for (const eX of entry.entries) {
			const nxtOpts = {...opts};
			nxtOpts.depth = nextDepth;
			Renderer.getNames(nameStack, eX, nxtOpts);
		}
	} else if (entry.items) {
		for (const eX of entry.items) {
			Renderer.getNames(nameStack, eX, opts);
		}
	}
};

Renderer.getNumberedNames = function (entry) {
	const renderer = new Renderer().setTrackTitles(true);
	renderer.render(entry);
	const titles = renderer.getTrackedTitles();
	const out = {};
	Object.entries(titles).forEach(([k, v]) => {
		v = Renderer.stripTags(v);
		out[v] = Number(k);
	});
	return out;
};

// dig down until we find a name, as feature names can be nested
Renderer.findName = function (entry) { return CollectionUtil.dfs(entry, {prop: "name"}); };
Renderer.findSource = function (entry) { return CollectionUtil.dfs(entry, {prop: "source"}); };
Renderer.findEntry = function (entry) { return CollectionUtil.dfs(entry, {fnMatch: obj => obj.name && obj?.entries?.length}); };

Renderer.stripTags = function (str) {
	if (!str) return str;
	let nxtStr = Renderer._stripTagLayer(str);
	while (nxtStr.length !== str.length) {
		str = nxtStr;
		nxtStr = Renderer._stripTagLayer(str);
	}
	return nxtStr;
};

Renderer._stripTagLayer = function (str) {
	if (str.includes("{@")) {
		const tagSplit = Renderer.splitByTags(str);
		return tagSplit.filter(it => it).map(it => {
			if (it.startsWith("{@")) {
				let [tag, text] = Renderer.splitFirstSpace(it.slice(1, -1));
				const tagInfo = Renderer.tag.TAG_LOOKUP[tag];
				if (!tagInfo) throw new Error(`Unhandled tag: "${tag}"`);
				return tagInfo.getStripped(tag, text);
			} else return it;
		}).join("");
	} return str;
};

/**
 * This assumes validation has been done in advance.
 * @param row
 * @param [opts]
 * @param [opts.cbErr]
 * @param [opts.isForceInfiniteResults]
 * @param [opts.isFirstRow] Used it `isForceInfiniteResults` is specified.
 * @param [opts.isLastRow] Used it `isForceInfiniteResults` is specified.
 */
Renderer.getRollableRow = function (row, opts) {
	opts = opts || {};

	if (
		row[0]?.type === "cell"
		&& (
			row[0]?.roll?.exact != null
			|| (row[0]?.roll?.min != null && row[0]?.roll?.max != null)
		)
	) return row;

	row = MiscUtil.copyFast(row);
	try {
		const cleanRow = String(row[0]).trim();

		// format: "20 or lower"; "99 or higher"
		const mLowHigh = /^(\d+) or (lower|higher)$/i.exec(cleanRow);
		if (mLowHigh) {
			row[0] = {type: "cell", entry: cleanRow}; // Preseve the original text

			if (mLowHigh[2].toLowerCase() === "lower") {
				row[0].roll = {
					min: -Renderer.dice.POS_INFINITE,
					max: Number(mLowHigh[1]),
				};
			} else {
				row[0].roll = {
					min: Number(mLowHigh[1]),
					max: Renderer.dice.POS_INFINITE,
				};
			}

			return row;
		}

		// format: "95-00" or "12"
		// u2012 = figure dash; u2013 = en-dash
		const m = /^(\d+)([-\u2012\u2013](\d+))?$/.exec(cleanRow);
		if (m) {
			if (m[1] && !m[2]) {
				row[0] = {
					type: "cell",
					roll: {
						exact: Number(m[1]),
					},
				};
				if (m[1][0] === "0") row[0].roll.pad = true;
				Renderer.getRollableRow._handleInfiniteOpts(row, opts);
			} else {
				row[0] = {
					type: "cell",
					roll: {
						min: Number(m[1]),
						max: Number(m[3]),
					},
				};
				if (m[1][0] === "0" || m[3][0] === "0") row[0].roll.pad = true;
				Renderer.getRollableRow._handleInfiniteOpts(row, opts);
			}
		} else {
			// format: "12+"
			const m = /^(\d+)\+$/.exec(row[0]);
			row[0] = {
				type: "cell",
				roll: {
					min: Number(m[1]),
					max: Renderer.dice.POS_INFINITE,
				},
			};
		}
	} catch (e) {
		if (opts.cbErr) opts.cbErr(row[0], e);
	}
	return row;
};
Renderer.getRollableRow._handleInfiniteOpts = function (row, opts) {
	if (!opts.isForceInfiniteResults) return;

	const isExact = row[0].roll.exact != null;

	if (opts.isFirstRow) {
		if (!isExact) row[0].roll.displayMin = row[0].roll.min;
		row[0].roll.min = -Renderer.dice.POS_INFINITE;
	}

	if (opts.isLastRow) {
		if (!isExact) row[0].roll.displayMax = row[0].roll.max;
		row[0].roll.max = Renderer.dice.POS_INFINITE;
	}
};

Renderer.initLazyImageLoaders = function () {
	const images = document.querySelectorAll(`img[data-src]`);

	Renderer.utils.lazy.destroyObserver({observerId: "images"});

	const observer = Renderer.utils.lazy.getCreateObserver({
		observerId: "images",
		fnOnObserve: ({entry}) => {
			const $img = $(entry.target);
			$img.attr("src", $img.attr("data-src")).removeAttr("data-src");
		},
	});

	images.forEach(img => observer.track(img));
};

Renderer.HEAD_NEG_1 = "rd__b--0";
Renderer.HEAD_0 = "rd__b--1";
Renderer.HEAD_1 = "rd__b--2";
Renderer.HEAD_2 = "rd__b--3";
Renderer.HEAD_2_SUB_VARIANT = "rd__b--4";
Renderer.DATA_NONE = "data-none";

// ************************************************************************* //
// Strict mode should not be used, as the roll20 script depends on this file //
// ************************************************************************* //

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
function Renderer () {
	this.wrapperTag = "div";
	this.baseUrl = "";
	this.baseMediaUrls = {};

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
	this.setInternalLinksDisabled = function (bool) {
		this._isInternalLinksDisabled = bool;
		return this;
	};

	this.isInternalLinksDisabled = function () {
		return !!this._isInternalLinksDisabled;
	};

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
		return MiscUtil.copy(this._trackTitles.titles);
	};

	this.getTrackedTitlesInverted = function () {
		// `this._trackTitles.titles` is a map of `{[data-title-index]: "<name>"}`
		// Invert it such that we have a map of `{"<name>": ["data-title-index-0", ..., "data-title-index-n"]}`
		const trackedTitlesInverse = {};
		Object.entries(this._trackTitles.titles || {}).forEach(([titleIx, titleName]) => {
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
		if (entry.name && this._depthTracker) {
			this._lastDepthTrackerInheritedProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
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
		}
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
	 */
	this.recursiveRender = function (entry, textStack, meta, options) {
		if (entry instanceof Array) {
			entry.forEach(nxt => this.recursiveRender(nxt, textStack, meta, options));
			setTimeout(() => { throw new Error(`Array passed to renderer! The renderer only guarantees support for primitives and basic objects.`); });
			return;
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

				// entire data records
				case "dataCreature": this._renderDataCreature(entry, textStack, meta, options); break;
				case "dataSpell": this._renderDataSpell(entry, textStack, meta, options); break;
				case "dataTrapHazard": this._renderDataTrapHazard(entry, textStack, meta, options); break;
				case "dataObject": this._renderDataObject(entry, textStack, meta, options); break;
				case "dataItem": this._renderDataItem(entry, textStack, meta, options); break;
				case "dataLegendaryGroup": this._renderDataLegendaryGroup(entry, textStack, meta, options); break;

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
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<div class="float-clear"></div>`;
		textStack[0] += `<div class="${meta._typeStack.includes("gallery") ? "rd__wrp-gallery-image" : ""}">`;

		const href = this._renderImage_getUrl(entry);
		const svg = this._lazyImages && entry.width != null && entry.height != null
			? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${entry.width}" height="${entry.height}"><rect width="100%" height="100%" fill="#ccc3"></rect></svg>`)}`
			: null;
		textStack[0] += `<div class="${this._renderImage_getWrapperClasses(entry, meta)}" ${entry.title && this._isHeaderIndexIncludeImageTitles ? `data-title-index="${this._headerIndex++}"` : ""}>
			<a href="${href}" target="_blank" rel="noopener noreferrer" ${entry.title ? `title="${Renderer.stripTags(entry.title)}"` : ""}>
				<img class="${this._renderImage_getImageClasses(entry, meta)}" src="${svg || href}" ${entry.altText || entry.title ? `alt="${(entry.altText || entry.title).qq()}"` : ""} ${svg ? `data-src="${href}"` : `loading="lazy"`} ${this._renderImage_getStylePart(entry)}>
			</a>
		</div>`;

		if (entry.title || entry.mapRegions) {
			textStack[0] += `<div class="rd__image-title">
				${entry.title && !entry.mapRegions ? `<div class="rd__image-title-inner ${entry.title && entry.mapRegions ? "mr-2" : ""}">${this.render(entry.title)}</div>` : ""}
				${entry.mapRegions ? `<button class="btn btn-xs btn-default rd__image-btn-viewer" onclick="RenderMap.pShowViewer(event, this)" data-rd-packed-map="${this._renderImage_getMapRegionData(entry)}" ${entry.title ? `title="Open Dynamic Viewer"` : ""}><span class="glyphicon glyphicon-picture"></span> ${entry.title || "Dynamic Viewer"}</button>` : ""}
			</div>`;
		} else if (entry._galleryTitlePad) {
			textStack[0] += `<div class="rd__image-title">&nbsp;</div>`;
		}

		textStack[0] += `</div>`;
		this._renderSuffix(entry, textStack, meta, options);
		if (entry.imageType === "map" || entry.imageType === "mapPlayer") textStack[0] += `</div>`;
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

		textStack[0] += `<table class="rd__table ${entry.style || ""} ${entry.isStriped === false ? "" : "stripe-odd-table"}">`;

		const autoRollMode = Renderer.getAutoConvertedTableRollMode(entry);
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
				bodyStack[0] += `<td ${this._renderTable_makeTableTdClassText(entry, ixCell)} ${this._renderTable_getCellDataStr(roRender[ixCell])} ${roRender[ixCell].width ? `colspan="${roRender[ixCell].width}"` : ""}>`;
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
		textStack[0] += "<thead>";
		textStack[0] += "<tr>";
		if (entry.colLabels) {
			const len = entry.colLabels.length;
			for (let i = 0; i < len; ++i) {
				const lbl = entry.colLabels[i];
				textStack[0] += `<th ${this._renderTable_getTableThClassText(entry, i)} data-rd-isroller="${rollCols[i]}" ${entry.isNameGenerator ? `data-rd-namegeneratorrolls="${(entry.colLabels || []).length - 1}"` : ""}>`;
				this._recursiveRender(autoRollMode && i === 0 ? RollerUtil.getFullRollCol(lbl) : lbl, textStack, meta);
				textStack[0] += `</th>`;
			}
		}
		textStack[0] += "</tr>";
		textStack[0] += "</thead>";

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

	this._inlineHeaderTerminators = new Set([".", ",", "!", "?", ";", ":"]);
	this._renderEntriesSubtypes = function (entry, textStack, meta, options, incDepth) {
		const type = entry.type || "entries";
		const isInlineTitle = meta.depth >= 2;
		const isAddPeriod = isInlineTitle && entry.name && !this._inlineHeaderTerminators.has(entry.name[entry.name.length - 1]);
		const pagePart = !isInlineTitle ? this._getPagePart(entry) : "";
		const partExpandCollapse = !isInlineTitle ? `<span class="rd__h-toggle ml-2 clickable" data-rd-h-toggle-button="true">[\u2013]</span>` : "";
		const partPageExpandCollapse = pagePart || partExpandCollapse
			? `<span class="flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`
			: "";
		const nextDepth = incDepth && meta.depth < 2 ? meta.depth + 1 : meta.depth;
		const styleString = this._renderEntriesSubtypes_getStyleString(entry, meta, isInlineTitle);
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		if (entry.name != null && Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);

		const headerEle = "span" || `h${Math.min(Math.max(meta.depth + 1, 1), 6)}`; // FIXME(Future) use `h<N>` tags; fix CSS across the board (and external uses)
		const headerClass = `rd__h--${meta.depth + 1}`; // adjust as the CSS is 0..4 rather than -1..3

		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, meta.depth);

		const pluginDataNamePrefix = this._getPlugins(`${type}_namePrefix`).map(plugin => plugin(entry, textStack, meta, options)).filter(Boolean);

		const headerSpan = entry.name ? `<${headerEle} class="rd__h ${headerClass}" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}> <span class="entry-title-inner${!pagePart && entry.source ? ` help-subtle` : ""}"${!pagePart && entry.source ? ` title="Source: ${Parser.sourceJsonToFull(entry.source)}${entry.page ? `, p${entry.page}` : ""}"` : ""}>${pluginDataNamePrefix.join("")}${this.render({type: "inline", entries: [entry.name]})}${isAddPeriod ? "." : ""}</span>${partPageExpandCollapse}</${headerEle}> ` : "";

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

					const out = {...ent, type: "item"};
					if (ent.name) out.name = this._inlineHeaderTerminators.has(ent.name[ent.name.length - 1]) ? out.name : `${out.name}.`;
					return out;
				}),
			};
			this._renderList(fauxEntry, textStack, meta, options);
		} else this._renderEntriesSubtypes(entry, textStack, meta, options, false);
	};

	this._renderList = function (entry, textStack, meta, options) {
		if (entry.items) {
			if (entry.name) textStack[0] += `<div class="rd__list-name">${entry.name}</div>`;
			const cssClasses = this._renderList_getListCssClasses(entry, textStack, meta, options);
			textStack[0] += `<ul ${cssClasses ? `class="${cssClasses}"` : ""}>`;
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
			textStack[0] += "</ul>";
		}
	};

	this._renderInset = function (entry, textStack, meta, options) {
		const dataString = this._renderEntriesSubtypes_getDataString(entry);
		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-inset ${entry.style || ""}" ${dataString}>`;

		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">${entry.name}</span>${partPageExpandCollapse}</span>`;
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

		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">${entry.name}</span>${this._getPagePart(entry, true)}</span>`;
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
		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		const pagePart = this._getPagePart(entry, true);
		const partExpandCollapse = `<span class="rd__h-toggle ml-2 clickable" data-rd-h-special-toggle-button="true">[\u2013]</span>`;
		const partPageExpandCollapse = `<span class="flex-vh-center">${[pagePart, partExpandCollapse].filter(Boolean).join("")}</span>`;

		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-inset" ${dataString}>`;
		textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">Variant: ${entry.name}</span>${partPageExpandCollapse}</span>`;
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
		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		textStack[0] += `<${this.wrapperTag} class="rd__b-inset-inner" ${dataString}>`;
		textStack[0] += `<span class="rd__h rd__h--2-inset" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">${entry.name}</span></span>`;
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
		const toRender = [{type: "entries", name: entry.name, entries: entry.headerEntries ? MiscUtil.copy(entry.headerEntries) : []}];

		if (entry.constant || entry.will || entry.rest || entry.daily || entry.weekly || entry.yearly || entry.ritual) {
			const tempList = {type: "list", style: "list-hang-notitle", items: [], data: {isSpellList: true}};
			if (entry.constant && !hidden.has("constant")) tempList.items.push({type: "itemSpell", name: `Constant:`, entry: this._renderSpellcasting_getRenderableList(entry.constant).join(", ")});
			if (entry.will && !hidden.has("will")) tempList.items.push({type: "itemSpell", name: `At will:`, entry: this._renderSpellcasting_getRenderableList(entry.will).join(", ")});

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

	this._renderSpellcasting_getEntries_procPerDuration = function ({entry, hidden, tempList, prop, durationText}) {
		if (!entry[prop] || hidden.has(prop)) return;

		for (let lvl = 9; lvl > 0; lvl--) {
			const perDur = entry[prop];
			if (perDur[lvl]) tempList.items.push({type: "itemSpell", name: `${lvl}${durationText}:`, entry: this._renderSpellcasting_getRenderableList(perDur[lvl]).join(", ")});
			const lvlEach = `${lvl}e`;
			if (perDur[lvlEach]) {
				const isHideEach = !perDur[lvl] && perDur[lvlEach].length === 1;
				tempList.items.push({type: "itemSpell", name: `${lvl}${durationText}${isHideEach ? "" : ` each`}:`, entry: this._renderSpellcasting_getRenderableList(perDur[lvlEach]).join(", ")});
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
			if (entry.by) this._recursiveRender(entry.by, tempStack, meta);
			textStack[0] += `<span class="rd__quote-by">\u2014 ${entry.by ? tempStack.join("") : ""}${entry.by && entry.from ? `, ` : ""}${entry.from ? `<i>${entry.from}</i>` : ""}</span>`;
			textStack[0] += `</p>`;
		}
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
		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
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
		textStack[0] += `<p class="rd__p-list-item"><span class="${entry.style || "bold"} rd__list-item-name">${this.render(entry.name)}</span> `;
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
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `<p class="rd__p-list-item"><span class="italic rd__list-item-name">${entry.name}</span> `, suffix: "</p>"});
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderItemSpell = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `<p>${entry.name} `, suffix: "</p>"});
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataCreature = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataCreature.name);
		textStack[0] += Renderer.monster.getCompactRenderedString(entry.dataCreature, this, {isEmbeddedEntity: true});
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataSpell = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataSpell.name);
		textStack[0] += Renderer.spell.getCompactRenderedString(entry.dataSpell, {isEmbeddedEntity: true});
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataTrapHazard = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataTrapHazard.name);
		textStack[0] += Renderer.traphazard.getCompactRenderedString(entry.dataTrapHazard, {isEmbeddedEntity: true});
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataObject = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataObject.name);
		textStack[0] += Renderer.object.getCompactRenderedString(entry.dataObject, {isEmbeddedEntity: true});
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataItem = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataItem.name);
		const id = CryptUtil.uid();
		const asString = JSON.stringify(entry.dataItem);
		textStack[0] += `<script id="dataItem-${id}">Renderer.item.populatePropertyAndTypeReference().then(() => {const dataItem = ${asString}; Renderer.item.enhanceItem(dataItem); $("#dataItem-${id}").replaceWith(Renderer.item.getCompactRenderedString(dataItem,  {isEmbeddedEntity: true}))})</script>`;
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataLegendaryGroup = function (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._renderDataHeader(textStack, entry.dataLegendaryGroup.name);
		textStack[0] += Renderer.monster.getCompactRenderedStringLegendaryGroup(entry.dataLegendaryGroup, {isEmbeddedEntity: true});
		this._renderDataFooter(textStack);
		this._renderSuffix(entry, textStack, meta, options);
	};

	this._renderDataHeader = function (textStack, name) {
		textStack[0] += `<table class="rd__b-special rd__b-data">`;
		textStack[0] += `<thead><tr><th class="rd__data-embed-header" colspan="6" data-rd-data-embed-header="true"><span style="display: none;" class="rd__data-embed-name">${name}</span><span class="rd__data-embed-toggle">[\u2013]</span></th></tr></thead><tbody>`;
	};

	this._renderDataFooter = function (textStack) {
		textStack[0] += `</tbody></table>`;
	};

	this._renderGallery = function (entry, textStack, meta, options) {
		textStack[0] += `<div class="rd__wrp-gallery">`;
		const len = entry.images.length;
		const anyNamed = entry.images.find(it => it.title);
		for (let i = 0; i < len; ++i) {
			const img = MiscUtil.copy(entry.images[i]);
			if (anyNamed && !img.title) img._galleryTitlePad = true; // force untitled images to pad to match their siblings
			delete img.imageType;
			this._recursiveRender(img, textStack, meta, options);
		}
		textStack[0] += `</div>`;
	};

	this._renderFlowchart = function (entry, textStack, meta, options) {
		// TODO style this
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
		textStack[0] += `<${this.wrapperTag} class="rd__b-special rd__b-flow" ${dataString}>`;

		const cachedLastDepthTrackerProps = MiscUtil.copy(this._lastDepthTrackerInheritedProps);
		this._handleTrackDepth(entry, 1);

		if (entry.name != null) {
			if (Renderer.ENTRIES_WITH_ENUMERATED_TITLES_LOOKUP[entry.type]) this._handleTrackTitles(entry.name);
			textStack[0] += `<span class="rd__h rd__h--2-flow-block" data-title-index="${this._headerIndex++}" ${this._getEnumeratedTitleRel(entry.name)}><span class="entry-title-inner">${entry.name}</span></span>`;
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
			<div class="flex-col h-100">
				<div class="flex no-shrink pt-1">
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
			if (SourceUtil.isNonstandardSource(entry.source)) outList.push("spicy-sauce");
			if (BrewUtil.hasSourceJson(entry.source)) outList.push("refreshing-brew");
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
			case "@note":
				textStack[0] += `<i class="ve-muted">`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `</i>`;
				break;
			case "@atk":
				textStack[0] += `<i>${Renderer.attackTagToFull(text)}</i>`;
				break;
			case "@h":
				textStack[0] += `<i>Hit:</i> `;
				break;
			case "@color": {
				const [toDisplay, color] = Renderer.splitTagByPipe(text);
				const scrubbedColor = BrewUtil.getValidColor(color);

				textStack[0] += `<span class="rd__color" style="color: #${scrubbedColor}">`;
				this._recursiveRender(toDisplay, textStack, meta);
				textStack[0] += `</span>`;
				break;
			}
			case "@highlight": {
				const [toDisplay, color] = Renderer.splitTagByPipe(text);
				const scrubbedColor = color ? BrewUtil.getValidColor(color) : null;

				textStack[0] += scrubbedColor ? `<span style="background-color: #${scrubbedColor}">` : `<span class="rd__highlight">`;
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
				textStack[0] += `DC <span class="rd__dc">${text}</span>`;
				break;
			}

			// DICE ////////////////////////////////////////////////////////////////////////////////////////////
			case "@dice":
			case "@damage":
			case "@hit":
			case "@d20":
			case "@chance":
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
			case "@skill":
			case "@sense": {
				const expander = tag === "@skill" ? Parser.skillToExplanation : tag === "@sense" ? Parser.senseToExplanation : null;
				const [name, displayText] = Renderer.splitTagByPipe(text);
				const hoverMeta = Renderer.hover.getMakePredefinedHover({
					type: "entries",
					name: name.toTitleCase(),
					entries: expander(name),
				});
				textStack[0] += `<span class="help help--hover" ${hoverMeta.html}>${displayText || name}</span>`;

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
				const {name, path} = this._renderString_getLoaderTagMeta(text);
				textStack[0] += `<span onclick="BrewUtil.handleLoadbrewClick(this)" data-rd-loader-path="${path.escapeQuotes()}" data-rd-loader-name="${name.escapeQuotes()}" class="rd__wrp-loadbrew--ready" title="Click to install homebrew">${name}<span class="glyphicon glyphicon-download-alt rd__loadbrew-icon rd__loadbrew-icon"></span></span>`;
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
				const {name, source, displayText, others, page, hash, hashPreEncoded, pageHover, hashHover, hashPreEncodedHover, preloadId, linkText, subhashes, subhashesHover} = Renderer.utils.getTagMeta(tag, text);

				const fauxEntry = {
					type: "link",
					href: {
						type: "internal",
						path: page,
						hash,
						hover: {
							page,
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

	this._renderString_getLoaderTagMeta = function (text) {
		const [name, file] = Renderer.splitTagByPipe(text);
		const path = /^.*?:\/\//.test(file) ? file : `https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/${file}`;
		return {name, path};
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

		return `onmouseover="Renderer.hover.pHandleLinkMouseOver(event, this)" onmouseleave="Renderer.hover.handleLinkMouseLeave(event, this)" onmousemove="Renderer.hover.handleLinkMouseMove(event, this)" data-vet-page="${entry.href.hover.page.qq()}" data-vet-source="${entry.href.hover.source.qq()}" data-vet-hash="${procHash.qq()}" ${entry.href.hover.preloadId != null ? `data-vet-preload-id="${`${entry.href.hover.preloadId}`.qq()}"` : ""} ${Renderer.hover.getPreventTouchString()}`;
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
}

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
		$ele.find(".rd__data-embed-name").toggle();
		$ele.find(".rd__data-embed-toggle").text($ele.text().includes("+") ? "[\u2013]" : "[+]");
		$ele.closest("table").find("tbody").toggle();
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
	const toPack = MiscUtil.copy(entry);
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

	return `<span class="roller render-roller" ${titlePart} ${handlerPart} ${additionalDataPart}>${toDisplay}</span>`;
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
	function getDiceAsStr () {
		if (entry.successThresh) return `${entry.successThresh} percent`;
		else if (typeof entry.toRoll === "string") return entry.toRoll;
		else {
			// handle legacy format
			return Renderer.legacyDiceToString(entry.toRoll);
		}
	}

	return entry.displayText ? entry.displayText : getDiceAsStr();
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

Renderer.getAbilityData = function (abArr) {
	function doRenderOuter (abObj) {
		const mainAbs = [];
		const asCollection = [];
		const areNegative = [];
		const toConvertToText = [];
		const toConvertToShortText = [];

		if (abObj != null) {
			handleAllAbilities(abObj);
			handleAbilitiesChoose();
			return new Renderer._AbilityData(toConvertToText.join("; "), toConvertToShortText.join("; "), asCollection, areNegative);
		}

		return new Renderer._AbilityData("", "", [], []);

		function handleAllAbilities (abObj, targetList) {
			MiscUtil.copy(Parser.ABIL_ABVS)
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
					let cntProcessed = 0;

					const areIncreaseShort = [];
					const areIncrease = w.weights.filter(it => it >= 0).sort(SortUtil.ascSort).reverse().map(it => {
						areIncreaseShort.push(`+${it}`);
						if (isAny) return `${cntProcessed ? "choose " : ""}any ${cntProcessed++ ? `other ` : ""}+${it}`;
						return `one ${cntProcessed++ ? `other ` : ""}ability to increase by ${it}`;
					});

					const areReduceShort = [];
					const areReduce = w.weights.filter(it => it < 0).map(it => -it).sort(SortUtil.ascSort).map(it => {
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
	}

	const outerStack = (abArr || [null]).map(it => doRenderOuter(it));
	if (outerStack.length <= 1) return outerStack[0];
	return new Renderer._AbilityData(
		`Choose one of: ${outerStack.map((it, i) => `(${Parser.ALPHABET[i].toLowerCase()}) ${it.asText}`).join(" ")}`,
		`${outerStack.map((it, i) => `(${Parser.ALPHABET[i].toLowerCase()}) ${it.asTextShort}`).join(" ")}`,
		[...new Set(outerStack.map(it => it.asCollection).flat())],
		[...new Set(outerStack.map(it => it.areNegative).flat())],
	);
};

Renderer._AbilityData = function (asText, asTextShort, asCollection, areNegative) {
	this.asText = asText;
	this.asTextShort = asTextShort;
	this.asCollection = asCollection;
	this.areNegative = areNegative;
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

Renderer.utils = {
	getBorderTr: (optText) => {
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
			if (opts.isEmbeddedEntity) Renderer.hover.addEmbeddedToCache(opts.page, it.source, hash, MiscUtil.copy(it));
		}

		const tagPartSourceStart = `<${pageLinkPart ? `a href="${Renderer.get().baseUrl}${pageLinkPart}"` : "span"}`;
		const tagPartSourceEnd = `</${pageLinkPart ? "a" : "span"}>`;

		const ptBrewSourceLink = BrewUtil.hasSourceJson(it.source) && BrewUtil.sourceJsonToSource(it.source)?.url
			? `<a href="${BrewUtil.sourceJsonToSource(it.source).url}" title="View Homebrew Source" class="self-flex-center ml-2 ve-muted rd__stats-name-brew-link" target="_blank" rel="noopener noreferrer"><span class="	glyphicon glyphicon-share"></span></a>`
			: "";

		// Add data-page/source/hash attributes for external script use (e.g. Rivet)
		const $ele = $$`<tr>
			<th class="rnd-name ${opts.extraThClasses ? opts.extraThClasses.join(" ") : ""}" colspan="6" ${dataPart}>
				<div class="name-inner">
					<div class="flex-v-center">
						<h1 class="stats-name copyable m-0" onmousedown="event.preventDefault()" onclick="Renderer.utils._pHandleNameClick(this)">${opts.prefix || ""}${it._displayName || it.name}${opts.suffix || ""}</h1>
						${opts.controlRhs || ""}
						${!IS_VTT && ExtensionUtil.ACTIVE && opts.page ? `<button title="Send to Foundry (SHIFT for Temporary Import)" class="btn btn-xs btn-default btn-stats-name mx-2 mb-2 self-flex-end" onclick="ExtensionUtil.pDoSendStats(event, this)"><span class="glyphicon glyphicon-send"></span></button>` : ""}
					</div>
					<div class="stats-source flex-v-baseline">
						${tagPartSourceStart} class="help-subtle ${it.source ? `${Parser.sourceJsonToColor(it.source)}" title="${Parser.sourceJsonToFull(it.source)}${Renderer.utils.getSourceSubText(it)}` : ""}" ${BrewUtil.sourceJsonToStyle(it.source)}>${it.source ? Parser.sourceJsonToAbv(it.source) : ""}${tagPartSourceEnd}

						${Renderer.utils.isDisplayPage(it.page) ? ` ${tagPartSourceStart} class="rd__stats-name-page ml-1" title="Page ${it.page}">p${it.page}${tagPartSourceEnd}` : ""}

						${ptBrewSourceLink}
					</div>
				</div>
			</th>
		</tr>`;

		if (opts.asJquery) return $ele;
		else return $ele[0].outerHTML;
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
			isExcluded = isExcluded || ExcludeUtil.isExcluded(hash, dataProp, entity.source);
		}
		return isExcluded ? `<div class="text-center text-danger"><b><i>Warning: This content has been <a href="blacklist.html">blacklisted</a>.</i></b></div>` : "";
	},

	getSourceAndPageTrHtml (it) {
		const html = Renderer.utils.getSourceAndPageHtml(it);
		return html ? `<b>Source:</b> ${html}` : "";
	},

	_getAltSourceHtmlOrText (it, prop, introText, isText) {
		if (!it[prop] || !it[prop].length) return "";

		return `${introText} ${it[prop].map(as => {
			if (as.entry) return Renderer.get().render(isText ? Renderer.stripTags(as.entry) : as.entry);
			return `${isText ? "" : `<i title="${Parser.sourceJsonToFull(as.source)}">`}${Parser.sourceJsonToAbv(as.source)}${isText ? "" : `</i>`}${Renderer.utils.isDisplayPage(as.page) ? `, page ${as.page}` : ""}`;
		}).join("; ")}`;
	},

	getSourceAndPageHtml (it) { return this._getSourceAndPageHtmlOrText(it); },
	getSourceAndPageText (it) { return this._getSourceAndPageHtmlOrText(it, true); },

	_getSourceAndPageHtmlOrText (it, isText) {
		const sourceSub = Renderer.utils.getSourceSubText(it);
		const baseText = `${isText ? `` : `<i title="${Parser.sourceJsonToFull(it.source)}${sourceSub}">`}${Parser.sourceJsonToAbv(it.source)}${sourceSub}${isText ? "" : `</i>`}${Renderer.utils.isDisplayPage(it.page) ? `, page ${it.page}` : ""}`;
		const addSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "additionalSources", "Additional information from", isText);
		const otherSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "otherSources", "Also found in", isText);
		const externalSourceText = Renderer.utils._getAltSourceHtmlOrText(it, "externalSources", "External sources:", isText);

		const srdText = it.srd ? `${isText ? "" : `the <span title="Systems Reference Document">`}SRD${isText ? "" : `</span>`}${typeof it.srd === "string" ? ` (as &quot;${it.srd}&quot;)` : ""}` : "";
		const basicRulesText = it.basicRules ? `the Basic Rules${typeof it.basicRules === "string" ? ` (as &quot;${it.basicRules}&quot;)` : ""}` : "";
		const srdAndBasicRulesText = (srdText || basicRulesText) ? `Available in ${[srdText, basicRulesText].filter(it => it).join(" and ")}` : "";

		return `${[baseText, addSourceText, otherSourceText, srdAndBasicRulesText, externalSourceText].filter(it => it).join(". ")}${baseText && (addSourceText || otherSourceText || srdAndBasicRulesText || externalSourceText) ? "." : ""}`;
	},

	async _pHandleNameClick (ele) {
		await MiscUtil.pCopyTextToClipboard($(ele).text());
		JqueryUtil.showCopiedEffect($(ele));
	},

	getPageTr (it) {
		return `<tr><td colspan=6>${Renderer.utils.getSourceAndPageTrHtml(it)}</td></tr>`;
	},

	getAbilityRoller (statblock, ability) {
		if (statblock[ability] == null) return "\u2014";
		return Renderer.get().render(`{@ability ${ability} ${statblock[ability]}}`);
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
	bindTabButtons ({tabButtons, tabLabelReference}) {
		Renderer.utils._tabs = {};
		Renderer.utils._curTab = null;

		const $content = $("#pagecontent");
		const $wrpTab = $(`#stat-tabs`);

		$wrpTab.find(`.stat-tab-gen`).remove();

		tabButtons.forEach((tb, i) => {
			tb.ix = i;

			tb.$t = $(`<span class="ui-tab__btn-tab-head btn btn-default stat-tab-gen">${tb.label}</span>`)
				.click(() => tb.fnActivateTab({isUserInput: true}));

			tb.fnActivateTab = ({isUserInput = false} = {}) => {
				const curTab = Renderer.utils._curTab;
				const tabs = Renderer.utils._tabs;

				if (!curTab || curTab.label !== tb.label) {
					if (curTab) curTab.$t.removeClass(`ui-tab__btn-tab-head--active`);
					Renderer.utils._curTab = tb;
					tb.$t.addClass(`ui-tab__btn-tab-head--active`);
					if (curTab) tabs[curTab.label].$content = $content.children().detach();

					tabs[tb.label] = tb;
					if (!tabs[tb.label].$content && tb.fnPopulate) tb.fnPopulate();
					else $content.append(tabs[tb.label].$content);
					if (tb.fnChange) tb.fnChange();
				}

				// If the user clicked a tab, save it as their chosen tab
				if (isUserInput) Renderer.utils._tabsPreferredLabel = tb.label;
			};
		});

		// Avoid displaying a tab button for single tabs
		if (tabButtons.length !== 1) tabButtons.slice().reverse().forEach(tb => $wrpTab.prepend(tb.$t));

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

	hasFluffText (entity, prop) {
		return entity.hasFluff || (Renderer.utils.getPredefinedFluff(entity, prop)?.entries?.length || 0) > 0;
	},

	hasFluffImages (entity, prop) {
		return entity.hasFluffImages || ((Renderer.utils.getPredefinedFluff(entity, prop)?.images?.length || 0) > 0);
	},

	/**
	 * @param entry Data entry to search for fluff on, e.g. a monster
	 * @param prop The fluff index reference prop, e.g. `"monsterFluff"`
	 */
	getPredefinedFluff (entry, prop) {
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
			const fromList = (BrewUtil.homebrew[prop] || []).find(it =>
				it.name === entry.fluff[mappedProp].name
				&& it.source === entry.fluff[mappedProp].source,
			);
			if (fromList) {
				assignPropsIfExist(fromList, "name", "type", "entries", "images");
			}
		}

		if (entry.fluff[mappedPropAppend]) {
			const fromList = (BrewUtil.homebrew[prop] || []).find(it => it.name === entry.fluff[mappedPropAppend].name && it.source === entry.fluff[mappedPropAppend].source);
			if (fromList) {
				if (fromList.entries) {
					fluff.entries = MiscUtil.copy(fluff.entries || []);
					fluff.entries.push(...MiscUtil.copy(fromList.entries));
				}
				if (fromList.images) {
					fluff.images = MiscUtil.copy(fluff.images || []);
					fluff.images.push(...MiscUtil.copy(fromList.images));
				}
			}
		}

		return fluff;
	},

	async pGetFluff ({entity, pFnPostProcess, fluffUrl, fluffBaseUrl, fluffProp} = {}) {
		let predefinedFluff = Renderer.utils.getPredefinedFluff(entity, fluffProp);
		if (predefinedFluff) {
			if (pFnPostProcess) predefinedFluff = await pFnPostProcess(predefinedFluff);
			return predefinedFluff;
		}
		if (!fluffBaseUrl && !fluffUrl) return null;

		const fluffIndex = fluffBaseUrl ? await DataUtil.loadJSON(`${Renderer.get().baseUrl}${fluffBaseUrl}fluff-index.json`) : null;
		if (fluffIndex && !fluffIndex[entity.source]) return null;

		const data = fluffIndex && fluffIndex[entity.source]
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

		const fluff = MiscUtil.copy((await pFnGetFluff(entity)) || {});
		fluff.entries = fluff.entries || [Renderer.utils.HTML_NO_INFO];
		fluff.images = fluff.images || [Renderer.utils.HTML_NO_IMAGES];

		$td.fastSetHtml(Renderer.utils.getFluffTabContent({entity, fluff, isImageTab}));
	},

	getFluffTabContent ({entity, fluff, isImageTab = false}) {
		Renderer.get().setFirstSection(true);
		return fluff[isImageTab ? "images" : "entries"].map((ent, i) => {
			if (isImageTab) return Renderer.get().render(ent);

			// If the first entry has a name, and it matches the name of the statblock, remove it to avoid having two
			//   of the same title stacked on top of each other.
			if (i === 0 && ent.name && entity.name && (Renderer.utils._TITLE_SKIP_TYPES).has(ent.type)) {
				const entryLowName = ent.name.toLowerCase().trim();
				const entityLowName = entity.name.toLowerCase().trim();

				if (entryLowName.includes(entityLowName) || entityLowName.includes(entryLowName)) {
					const cpy = MiscUtil.copy(ent);
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

	_prereqWeights: {
		level: 0,
		pact: 1,
		patron: 2,
		spell: 3,
		race: 4,
		ability: 5,
		proficiency: 6,
		spellcasting: 7,
		feature: 8,
		item: 9,
		other: 10,
		otherSummary: 11,
		[undefined]: 12,
	},
	_getPrerequisiteHtml_getShortClassName (className) {
		// remove all the vowels except the first
		const ixFirstVowel = /[aeiou]/.exec(className).index;
		const start = className.slice(0, ixFirstVowel + 1);
		let end = className.slice(ixFirstVowel + 1);
		end = end.replace().replace(/[aeiou]/g, "");
		return `${start}${end}`.toTitleCase();
	},
	getPrerequisiteHtml: (prerequisites, {isListMode = false, blacklistKeys = new Set(), isTextOnly = false, isSkipPrefix = false} = {}) => {
		if (!prerequisites) return isListMode ? "\u2014" : "";

		let cntPrerequisites = 0;
		const listOfChoices = prerequisites.map(pr => {
			return Object.entries(pr)
				.sort(([kA], [kB]) => Renderer.utils._prereqWeights[kA] - Renderer.utils._prereqWeights[kB])
				.map(([k, v]) => {
					if (blacklistKeys.has(k)) return false;

					cntPrerequisites += 1;

					switch (k) {
						case "level": {
							// a generic level requirement
							if (typeof v === "number") {
								if (isListMode) return `Lvl ${v}`;
								else return `${Parser.getOrdinalForm(v)} level`;
							} else if (!v.class && !v.subclass) {
								if (isListMode) return `Lvl ${v.level}`;
								else return `${Parser.getOrdinalForm(v.level)} level`;
							}

							const isSubclassVisible = v.subclass && v.subclass.visible;
							const isClassVisible = v.class && (v.class.visible || isSubclassVisible); // force the class name to be displayed if there's a subclass being displayed
							if (isListMode) {
								const shortNameRaw = isClassVisible ? Renderer.utils._getPrerequisiteHtml_getShortClassName(v.class.name) : null;
								return `${isClassVisible ? `${shortNameRaw.slice(0, 4)}${isSubclassVisible ? "*" : "."} ` : ""} Lvl ${v.level}`;
							} else {
								let classPart = "";
								if (isClassVisible && isSubclassVisible) classPart = ` ${v.class.name} (${v.subclass.name})`;
								else if (isClassVisible) classPart = ` ${v.class.name}`;
								else if (isSubclassVisible) classPart = ` &lt;remember to insert class name here&gt; (${v.subclass.name})`; // :^)
								return `${Parser.getOrdinalForm(v.level)} level${isClassVisible ? ` ${classPart}` : ""}`;
							}
						}
						case "pact": return Parser.prereqPactToFull(v);
						case "patron": return isListMode ? `${Parser.prereqPatronToShort(v)} patron` : `${v} patron`;
						case "spell":
							return isListMode
								? v.map(x => x.split("#")[0].split("|")[0].toTitleCase()).join("/")
								: v.map(sp => Parser.prereqSpellToFull(sp, {isTextOnly})).joinConjunct(", ", " or ");
						case "feat":
							return isListMode
								? v.map(x => x.split("|")[0].toTitleCase()).join("/")
								: v.map(it => Renderer.get().render(`{@feat ${it}} feat`)).joinConjunct(", ", " or ");
						case "feature":
							return isListMode
								? v.map(x => Renderer.stripTags(x).toTitleCase()).join("/")
								: v.map(it => isTextOnly ? Renderer.stripTags(it) : Renderer.get().render(it)).joinConjunct(", ", " or ");
						case "item":
							return isListMode ? v.map(x => x.toTitleCase()).join("/") : v.joinConjunct(", ", " or ");
						case "otherSummary":
							return isListMode ? (v.entrySummary || Renderer.stripTags(v.entry)) : (isTextOnly ? Renderer.stripTags(v.entry) : Renderer.get().render(v.entry));
						case "other": return isListMode ? "Special" : (isTextOnly ? Renderer.stripTags(v) : Renderer.get().render(v));
						case "race": {
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
						case "ability": {
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
						case "proficiency": {
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
						case "spellcasting": return isListMode ? "Spellcasting" : "The ability to cast at least one spell";
						case "spellcasting2020": return isListMode ? "Spellcasting" : "Spellcasting or Pact Magic feature";
						case "psionics": return isListMode ? "Psionics" : (isTextOnly ? Renderer.stripTags : Renderer.get().render.bind(Renderer.get()))("Psionic Talent feature or {@feat Wild Talent|UA2020PsionicOptionsRevisited} feat");
						default: throw new Error(`Unhandled key: ${k}`);
					}
				})
				.filter(Boolean)
				.join(", ");
		}).filter(Boolean);

		if (!listOfChoices.length) return isListMode ? "\u2014" : "";
		return isListMode ? listOfChoices.join("/") : `${isSkipPrefix ? "" : `Prerequisite${cntPrerequisites === 1 ? "" : "s"}: `}${listOfChoices.joinConjunct("; ", " or ")}`;
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
					case "@dice": {
						// format: {@dice 1d2 + 3 + 4d5 - 6}
						fauxEntry.toRoll = rollText;
						if (!fauxEntry.displayText && (rollText || "").includes(";")) fauxEntry.displayText = rollText.replace(/;/g, "/");
						if ((!fauxEntry.displayText && (rollText || "").includes("#$")) || (fauxEntry.displayText && fauxEntry.displayText.includes("#$"))) fauxEntry.displayText = (fauxEntry.displayText || rollText).replace(/#\$prompt_number[^$]*\$#/g, "(n)");
						return fauxEntry;
					}
					case "@damage": {
						fauxEntry.toRoll = rollText;
						fauxEntry.subType = "damage";
						return fauxEntry;
					}
					case "@d20":
					case "@hit": {
						// format: {@hit +1} or {@hit -2}
						let mod;
						if (!isNaN(rollText)) {
							const n = Number(rollText);
							mod = `${n >= 0 ? "+" : ""}${n}`;
						} else mod = rollText;
						fauxEntry.displayText = fauxEntry.displayText || mod;
						fauxEntry.toRoll = `1d20${mod}`;
						fauxEntry.subType = "d20";
						fauxEntry.d20mod = mod;
						if (tag === "@hit") fauxEntry.context = {type: "hit"};
						return fauxEntry;
					}
					case "@chance": {
						// format: {@chance 25|display text|rollbox rollee name}
						fauxEntry.toRoll = `1d100`;
						fauxEntry.successThresh = Number(rollText);
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
				const mod = isNaN(bonusPart) ? bonusPart : UiUtil.intToBonus(Number(bonusPart) || 0);

				fauxEntry.context.skill = skill;
				fauxEntry.displayText = displayText || mod;

				if (name) fauxEntry.name = name;
				else fauxEntry.name = skill.toTitleCase();

				fauxEntry.toRoll = `1d20${mod}`;
				fauxEntry.d20mod = mod;

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
				const hash = `${name}${HASH_LIST_SEP}${pantheon}${HASH_LIST_SEP}${source}`;

				return {
					name,
					displayText,
					others,

					page: UrlUtil.PG_DEITIES,
					source,
					hash,
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

			default: return Renderer.utils._getTagMeta_generic(tag, text);
		}
	},

	_getTagMeta_generic (tag, text) {
		const {name, source, displayText, others} = DataUtil.generic.unpackUid(text, tag);
		const hash = `${name}${HASH_LIST_SEP}${source}`;

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

					const classStateOpts = {
						subclass: {
							shortName: subclassShortName.trim(),
							source: subclassSource
								// Subclass state uses the abbreviated form of the source for URL shortness
								? Parser.sourceJsonToAbv(subclassSource.trim())
								: SRC_PHB,
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

					const cpyObj = MiscUtil.copy(obj);

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
				: `Increase one ability score of your choice by ${abilityObj.choose.amount}, to a maximum of 20.`;
		}

		const abbChoicesText = abilityObj.choose.from.map(it => Parser.attAbvToFull(it)).joinConjunct(", ", " or ");
		return `Increase your ${abbChoicesText} by ${abilityObj.choose.amount}, to a maximum of 20.`;
	},

	mergeAbilityIncrease: function (feat) {
		if (!feat.ability || feat._hasMergedAbility || !feat.ability.length) return;

		feat._hasMergedAbility = true;
		const abilsToDisplay = feat.ability.filter(it => !it.hidden);
		if (!abilsToDisplay.length) return;

		const targetList = feat.entries.find(e => e.type === "list");

		// FTD+ style
		if (targetList.items.every(it => it.type === "item")) {
			abilsToDisplay.forEach(abilObj => targetList.items.unshift(Renderer.feat._mergeAbilityIncrease_getListItemItem(abilObj)));
			return;
		}

		if (targetList) {
			abilsToDisplay.forEach(abilObj => targetList.items.unshift(Renderer.feat._mergeAbilityIncrease_getListItemText(abilObj)));
			return;
		}

		// this should never happen, but display sane output anyway, and throw an out-of-order exception
		abilsToDisplay.forEach(abilObj => feat.entries.unshift(Renderer.feat._mergeAbilityIncrease_getListItemText(abilObj)));

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

		const prerequisite = Renderer.utils.getPrerequisiteHtml(feat.prerequisite);
		Renderer.feat.mergeAbilityIncrease(feat);
		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: feat, dataProp: "feat", page: UrlUtil.PG_FEATS})}
			${opts.isSkipNameRow ? "" : Renderer.utils.getNameTr(feat, {page: UrlUtil.PG_FEATS})}
			<tr class="text"><td colspan="6" class="text">
			${prerequisite ? `<p><i>${prerequisite}</i></p>` : ""}
		`);
		renderer.recursiveRender({entries: feat.entries}, renderStack, {depth: 2});
		renderStack.push(`</td></tr>`);

		return renderStack.join("");
	},
};

Renderer.get = () => {
	if (!Renderer.defaultRenderer) Renderer.defaultRenderer = new Renderer();
	return Renderer.defaultRenderer;
};

Renderer.class = {
	getHitDiceEntry (clsHd) { return clsHd ? {toRoll: `${clsHd.number}d${clsHd.faces}`, rollable: true} : null; },
	getHitPointsAtFirstLevel (clsHd) { return clsHd ? `${clsHd.number * clsHd.faces} + your Constitution modifier` : null; },
	getHitPointsAtHigherLevels (className, clsHd, hdEntry) { return className && clsHd && hdEntry ? `${Renderer.getEntryDice(hdEntry, "Hit die")} (or ${((clsHd.number * clsHd.faces) / 2 + 1)}) + your Constitution modifier per ${className} level after 1st` : null; },

	getRenderedArmorProfs (armorProfs) { return armorProfs.map(a => Renderer.get().render(a.full ? a.full : a === "light" || a === "medium" || a === "heavy" ? `{@filter ${a} armor|items|type=${a} armor}` : a)).join(", "); },
	getRenderedWeaponProfs (weaponProfs) { return weaponProfs.map(w => Renderer.get().render(w === "simple" || w === "martial" ? `{@filter ${w} weapons|items|type=${w} weapon}` : w.optional ? `<span class="help help--hover" title="Optional Proficiency">${w.proficiency}</span>` : w)).join(", "); },
	getRenderedToolProfs (toolProfs) { return toolProfs.map(it => Renderer.get().render(it)).join(", "); },
	getRenderedSkillProfs (skills) { return `${Parser.skillProficienciesToFull(skills).uppercaseFirst()}.`; },
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
				<table class="summary stripe-even-table">
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

	_isBrewSpellClassesInit: false,
	brewSpellClasses: {},
	brewSpellRaces: {},
	populateHomebrewLookup (homebrew, {isForce = false} = {}) {
		if (Renderer.spell._isBrewSpellClassesInit && !isForce) return;
		Renderer.spell._isBrewSpellClassesInit = true;

		if (isForce) {
			Renderer.spell.brewSpellClasses = {};
			Renderer.spell.brewSpellRaces = {};
		}

		// region Load homebrew class spell list addons
		// Three formats are available. A string (shorthand for "spell" format with source "PHB"), "spell" format (object
		//   with a `name` and a `source`), and "class" format (object with a `class` and a `source`).
		if (homebrew.class) {
			homebrew.class.forEach(c => {
				c.source = c.source || SRC_PHB;

				if (c.classSpells) c.classSpells.forEach(it => Renderer.spell._populateHomebrewLookup_handleSpellListItem(it, c.name, c.source));
			});
		}

		if (homebrew.subclass) {
			homebrew.subclass.forEach(sc => {
				sc.classSource = sc.classSource || SRC_PHB;
				sc.shortName = sc.shortName || sc.name;
				sc.source = sc.source || sc.classSource;

				if (sc.subclassSpells) sc.subclassSpells.forEach(it => Renderer.spell._populateHomebrewLookup_handleSpellListItem(it, sc.className, sc.classSource, sc.shortName, sc.source));
				if (sc.subSubclassSpells) Object.entries(sc.subSubclassSpells).forEach(([ssC, arr]) => arr.forEach(it => Renderer.spell._populateHomebrewLookup_handleSpellListItem(it, sc.className, sc.classSource, sc.shortName, sc.source, ssC)));
			});
		}
		// endregion

		// region Load homebrew race spell list addons
		// Three formats are available. A string (shorthand for "spell" format with source "PHB"), "spell" format (object
		//   with a `name` and a `source`), and "race" format (object with a `race` and a `source`).
		if (homebrew.race) {
			homebrew.race.forEach(r => {
				if (r.raceSpells) r.raceSpells.forEach(it => Renderer.spell._populateHomebrewLookup_handleSpellListItemRace(it, r.name, r.source));
			});
		}

		if (homebrew.subrace) {
			homebrew.subrace.forEach(sr => {
				if (sr.raceSpells) {
					if (!sr.race?.name || !sr.race?.source || !sr.source) return;
					const srName = Renderer.race.getSubraceName(sr.race.name, sr.name);
					sr.raceSpells.forEach(it => Renderer.spell._populateHomebrewLookup_handleSpellListItemRace(it, srName, sr.source, sr.race.name, sr.race.source));
				}
			});
		}
		// endregion
	},

	_populateHomebrewLookup_handleSpellListItem (it, className, classSource, subclassShortName, subclassSource, subSubclassName) {
		const doAdd = (target) => {
			if (subclassShortName) {
				const toAdd = {
					class: {name: className, source: classSource},
					subclass: {name: subclassShortName, source: subclassSource},
				};
				if (subSubclassName) toAdd.subclass.subSubclass = subSubclassName;

				target.fromSubclass = target.fromSubclass || [];
				target.fromSubclass.push(toAdd);
			} else {
				const toAdd = {name: className, source: classSource};

				target.fromClassList = target.fromClassList || [];
				target.fromClassList.push(toAdd);
			}
		};

		if (it.className) {
			Renderer.spell.brewSpellClasses.class = Renderer.spell.brewSpellClasses.class || {};

			const cls = it.className.toLowerCase();
			const source = (it.classSource || SRC_PHB).toLowerCase();

			Renderer.spell.brewSpellClasses.class[source] = Renderer.spell.brewSpellClasses.class[source] || {};
			Renderer.spell.brewSpellClasses.class[source][cls] = Renderer.spell.brewSpellClasses.class[source][cls] || {};

			doAdd(Renderer.spell.brewSpellClasses.class[source][cls]);
		} else {
			Renderer.spell.brewSpellClasses.spell = Renderer.spell.brewSpellClasses.spell || {};

			let [name, source] = `${it}`.toLowerCase().split("|");
			source = source || SRC_PHB.toLowerCase();

			Renderer.spell.brewSpellClasses.spell[source] = Renderer.spell.brewSpellClasses.spell[source] || {};
			Renderer.spell.brewSpellClasses.spell[source][name] = Renderer.spell.brewSpellClasses.spell[source][name] || {fromClassList: [], fromSubclass: []};

			doAdd(Renderer.spell.brewSpellClasses.spell[source][name]);
		}
	},

	_populateHomebrewLookup_handleSpellListItemRace (it, raceName, raceSource, raceBaseName, raceBaseSource) {
		const toAdd = {
			name: raceName,
			source: raceSource,
		};
		if (raceBaseName) toAdd.baseName = raceBaseName;
		if (raceBaseSource) toAdd.baseSource = raceBaseSource;

		if (it.race) {
			const race = it.race.toLowerCase();
			const source = (it.source || SRC_PHB).toLowerCase();

			const tgt = MiscUtil.set(Renderer.spell, "brewSpellRaces", "race", source, race, []);

			tgt.push(toAdd);
		} else {
			const name = (typeof it === "string" ? it : it.name).toLowerCase();
			const source = (typeof it === "string" ? "PHB" : it.source).toLowerCase();

			const tgt = MiscUtil.set(Renderer.spell, "brewSpellRaces", "spell", source, name, []);

			tgt.push(toAdd);
		}
	},

	prePopulateHover (data, opts) {
		if (opts && opts.isBrew) Renderer.spell.populateHomebrewLookup(data);
		(data.spell || []).forEach(sp => Renderer.spell.initClasses(sp));
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

	getCombinedRaces (sp, {prop = "races", propTmp = "_tmpRaces"} = {}) {
		return [
			...(sp[prop] || []),
			...(sp[propTmp] || []),
		]
			.filter(it => {
				if (!ExcludeUtil.isInitialised) return true;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES](it);
				return !ExcludeUtil.isExcluded(hash, "race", it.source, {isNoCount: true});
			});
	},

	getCombinedBackgrounds (sp) {
		return [
			...(sp.backgrounds || []),
			...(sp._tmpBackgrounds || []),
		]
			.filter(it => {
				if (!ExcludeUtil.isInitialised) return true;
				const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS](it);
				return !ExcludeUtil.isExcluded(hash, "background", it.source, {isNoCount: true});
			});
	},

	_initClasses_getSpellMeta ({spell, className, classSource}) {
		classSource = classSource || SRC_PHB;

		const isClassSpell = spell.classes && spell.classes.fromClassList && spell.classes.fromClassList.some(c => c.name === className && c.source === classSource);
		const variantClassSpells = (spell?.classes?.fromClassListVariant || []).filter(c => c.name === className && c.source === classSource);
		return {isClassSpell, variantClassSpells};
	},

	// TODO(Future)
	//   - Pre-generate this information, and load it as a JSON file?
	//   - Allow the user to filter for e.g. "variant subclass" spells, "variant race" spells?
	//     - Should have "Include Class Variants" and "Include Subclass Variants" toggle buttons for subclass filter
	//     - Should have "Include Class Variants" and "Include Race Variants" toggle buttons for race filter
	initClasses (spell) {
		if (spell._tmpClasses || spell._tmpRaces) return;
		spell._tmpClasses = {};
		spell._tmpRaces = [];

		const {isClassSpell: isWizardSpell, variantClassSpells: variantWizardSpells} = Renderer.spell._initClasses_getSpellMeta({spell, className: Renderer.spell.STR_WIZARD});
		const {isClassSpell: isClericSpell, variantClassSpells: variantClericSpells} = Renderer.spell._initClasses_getSpellMeta({spell, className: Renderer.spell.STR_CLERIC});
		const {isClassSpell: isDruidSpell, variantClassSpells: variantDruidSpells} = Renderer.spell._initClasses_getSpellMeta({spell, className: Renderer.spell.STR_DRUID});
		const {isClassSpell: isWarlockSpell, variantClassSpells: variantWarlockSpells} = Renderer.spell._initClasses_getSpellMeta({spell, className: Renderer.spell.STR_WARLOCK});
		const {isClassSpell: isSorcererSpell, variantClassSpells: variantSorcererSpells} = Renderer.spell._initClasses_getSpellMeta({spell, className: Renderer.spell.STR_SORCERER});

		const hashFighterEldritchKnight = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_FIGHTER, classSource: SRC_PHB, name: Renderer.spell.STR_ELD_KNIGHT, source: SRC_PHB});
		const hashRogueArcaneTrickster = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_ROGUE, classSource: SRC_PHB, name: Renderer.spell.STR_ARC_TCKER, source: SRC_PHB});
		const hashSorcererDivineSoul = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_SORCERER, classSource: SRC_PHB, name: Renderer.spell.STR_DIV_SOUL, source: SRC_XGE});
		const hashSorcererFavoredSoulUaV2 = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_SORCERER, classSource: SRC_PHB, name: Renderer.spell.STR_FAV_SOUL_V2, source: SRC_UAS});
		const hashSorcererFavoredSoulUaV3 = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_SORCERER, classSource: SRC_PHB, name: Renderer.spell.STR_FAV_SOUL_V3, source: SRC_UARSC});
		const hashClericArcana = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_CLERIC, classSource: SRC_PHB, name: "Arcana", source: SRC_SCAG});
		const hashClericNature = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_CLERIC, classSource: SRC_PHB, name: "Nature", source: SRC_PHB});
		const hashClericDeath = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_CLERIC, classSource: SRC_PHB, name: "Death", source: SRC_DMG});
		const hashSorcererAberrantMind = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_SORCERER, classSource: SRC_PHB, name: Renderer.spell.STR_ABERRANT_MIND, source: SRC_TCE});
		const hashSorcererClockworkSoul = UrlUtil.URL_TO_HASH_BUILDER["subclass"]({className: Renderer.spell.STR_SORCERER, classSource: SRC_PHB, name: Renderer.spell.STR_CLOCKWORK_SOUL, source: SRC_TCE});

		const hashElfHigh = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_RACES]({name: "Elf (High)", source: SRC_PHB});

		// add eldritch knight and arcane trickster
		if (isWizardSpell || variantWizardSpells.length) {
			const isExcludedEk = ExcludeUtil.isExcluded(hashFighterEldritchKnight, "subclass", SRC_PHB, {isNoCount: true});
			const isExcludedArc = ExcludeUtil.isExcluded(hashRogueArcaneTrickster, "subclass", SRC_PHB, {isNoCount: true});

			if (!isExcludedEk) {
				if (isWizardSpell) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_FIGHTER,
						subclassName: Renderer.spell.STR_ELD_KNIGHT,
					});
				}

				if (variantWizardSpells.length) {
					Renderer.spell._initClasses_addVariantSubclassSpells({
						spell,
						variantClassSpells: variantWizardSpells,
						className: Renderer.spell.STR_FIGHTER,
						subclassName: Renderer.spell.STR_ELD_KNIGHT,
					});
				}
			}

			if (!isExcludedArc) {
				if (isWizardSpell) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_ROGUE,
						subclassName: Renderer.spell.STR_ARC_TCKER,
					});
				}

				if (variantWizardSpells.length) {
					Renderer.spell._initClasses_addVariantSubclassSpells({
						spell,
						variantClassSpells: variantWizardSpells,
						className: Renderer.spell.STR_ROGUE,
						subclassName: Renderer.spell.STR_ARC_TCKER,
					});
				}
			}

			if (!isExcludedEk || !isExcludedArc) {
				if (spell.level > 4) spell._scrollNote = true;
			}
		}

		// add divine soul, favored soul v2, favored soul v3
		if (isClericSpell || variantClericSpells.length) {
			const isExcludedDivSoul = ExcludeUtil.isExcluded(hashSorcererDivineSoul, "subclass", SRC_PHB, {isNoCount: true});
			const isExcludedFavSoulv2 = ExcludeUtil.isExcluded(hashSorcererFavoredSoulUaV2, "subclass", SRC_PHB, {isNoCount: true});
			const isExcludedFavSoulv3 = ExcludeUtil.isExcluded(hashSorcererFavoredSoulUaV3, "subclass", SRC_PHB, {isNoCount: true});

			if (!isExcludedDivSoul) {
				if (isClericSpell) {
					const isExistingDivSoul = spell.classes.fromSubclass && spell.classes.fromSubclass.some(it => it.class.name === Renderer.spell.STR_SORCERER && it.class.source === SRC_PHB && it.subclass.name === Renderer.spell.STR_DIV_SOUL && it.subclass.source === SRC_XGE);
					if (!isExistingDivSoul) {
						Renderer.spell._initClasses_addSubclassSpell({
							spell,
							className: Renderer.spell.STR_SORCERER,
							subclassName: Renderer.spell.STR_DIV_SOUL,
							subclassSource: SRC_XGE,
						});
					}
				}

				if (variantClericSpells.length) {
					Renderer.spell._initClasses_addVariantSubclassSpells({
						spell,
						variantClassSpells: variantClericSpells,
						className: Renderer.spell.STR_SORCERER,
						subclassName: Renderer.spell.STR_DIV_SOUL,
						subclassSource: SRC_XGE,
					});
				}
			}

			if (!isExcludedFavSoulv2) {
				if (isClericSpell) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_SORCERER,
						subclassName: Renderer.spell.STR_FAV_SOUL_V2,
						subclassSource: SRC_UAS,
					});
				}
			}

			if (!isExcludedFavSoulv3) {
				if (isClericSpell) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_SORCERER,
						subclassName: Renderer.spell.STR_FAV_SOUL_V3,
						subclassSource: SRC_UARSC,
					});
				}
			}
		}

		// Add Arcana Cleric
		if (isWizardSpell || variantWizardSpells.length) {
			const isExcludedArcana = ExcludeUtil.isExcluded(hashClericArcana, "subclass", SRC_PHB, {isNoCount: true});

			if (spell.level === 0) {
				const isExcludedHighElf = ExcludeUtil.isExcluded(hashElfHigh, "race", SRC_PHB, {isNoCount: true});

				if (!isExcludedHighElf) {
					if (isWizardSpell) {
						Renderer.spell._initClasses_addRaceSpell({
							spell,
							raceName: "Elf (High)",
							raceBaseName: "Elf",
						});
					}

					if (variantWizardSpells.length) {
						Renderer.spell._initClasses_addVariantRaceSpells({
							spell,
							variantClassSpells: variantWizardSpells,
							raceName: "Elf (High)",
							raceBaseName: "Elf",
						});
					}
				}

				if (!isExcludedArcana) {
					if (isWizardSpell) {
						Renderer.spell._initClasses_addSubclassSpell({
							spell,
							className: Renderer.spell.STR_CLERIC,
							subclassName: "Arcana",
							subclassSource: SRC_SCAG,
						});
					}

					if (variantWizardSpells.length) {
						Renderer.spell._initClasses_addVariantSubclassSpells({
							spell,
							variantClassSpells: variantWizardSpells,
							className: Renderer.spell.STR_CLERIC,
							subclassName: "Arcana",
							subclassSource: SRC_SCAG,
						});
					}
				}
			}

			if (!isExcludedArcana && spell.level >= 6) {
				if (isWizardSpell) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_CLERIC,
						subclassName: "Arcana",
						subclassSource: SRC_SCAG,
					});
				}

				if (variantWizardSpells.length) {
					Renderer.spell._initClasses_addVariantSubclassSpells({
						spell,
						variantClassSpells: variantWizardSpells,
						className: Renderer.spell.STR_CLERIC,
						subclassName: "Arcana",
						subclassSource: SRC_SCAG,
					});
				}
			}
		}

		// Add Nature cleric
		if (isDruidSpell || variantDruidSpells.length) {
			if (spell.level === 0) {
				const isExcludedNature = ExcludeUtil.isExcluded(hashClericNature, "subclass", SRC_PHB, {isNoCount: true});

				if (!isExcludedNature) {
					if (isDruidSpell) {
						Renderer.spell._initClasses_addSubclassSpell({
							spell,
							className: Renderer.spell.STR_CLERIC,
							subclassName: "Nature",
						});
					}

					if (variantDruidSpells.length) {
						Renderer.spell._initClasses_addVariantSubclassSpells({
							spell,
							variantClassSpells: variantDruidSpells,
							className: Renderer.spell.STR_CLERIC,
							subclassName: "Nature",
						});
					}
				}
			}
		}

		// region Add Death Cleric
		if (spell.level === 0 && spell.school === SKL_ABV_NEC) {
			const isDeathDomain = ExcludeUtil.isExcluded(hashClericDeath, "subclass", SRC_DMG, {isNoCount: true});

			if (!isDeathDomain) {
				const isExisting = spell.classes.fromSubclass && spell.classes.fromSubclass.some(it => it.class.name === Renderer.spell.STR_CLERIC && it.class.source === SRC_PHB && it.subclass.name === Renderer.spell.STR_DEATH && it.subclass.source === SRC_DMG);
				if (!isExisting) {
					Renderer.spell._initClasses_addSubclassSpell({
						spell,
						className: Renderer.spell.STR_CLERIC,
						subclassName: "Death",
						subclassSource: SRC_DMG,
					});
				}
			}
		}
		// endregion

		// region Add Aberrant Mind Sorcerer and Clockwork Soul Sorcerer
		// Level 0-5, as the feature allows retraining only learned spell levels (and Aberrant Mind has the Mind Sliver cantrip)
		if (
			spell.level <= 5
			&& (isWizardSpell || isWarlockSpell || isSorcererSpell || variantWizardSpells.length || variantWarlockSpells.length || variantSorcererSpells.length)
		) {
			if (spell.school === SKL_ABV_DIV || spell.school === SKL_ABV_ENC) {
				const isExcludedAberrantMind = ExcludeUtil.isExcluded(hashSorcererAberrantMind, "subclass", SRC_TCE, {isNoCount: true});

				if (!isExcludedAberrantMind) {
					const isExisting = spell.classes.fromSubclass && spell.classes.fromSubclass.some(it => it.class.name === Renderer.spell.STR_SORCERER && it.class.source === SRC_PHB && it.subclass.name === Renderer.spell.STR_ABERRANT_MIND && it.subclass.source === SRC_TCE);

					if (!isExisting) {
						if (isWizardSpell || isWarlockSpell || isSorcererSpell) {
							Renderer.spell._initClasses_addSubclassSpell({
								spell,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_ABERRANT_MIND,
								subclassSource: SRC_TCE,
							});
						}

						if (variantWizardSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantWizardSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_ABERRANT_MIND,
								subclassSource: SRC_TCE,
							});
						}

						if (variantWarlockSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantWarlockSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_ABERRANT_MIND,
								subclassSource: SRC_TCE,
							});
						}

						if (variantSorcererSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantSorcererSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_ABERRANT_MIND,
								subclassSource: SRC_TCE,
							});
						}
					}
				}
			}

			// Clockwork Soul doesn't get a cantrip
			if (spell.level > 0 && (spell.school === SKL_ABV_ABJ || spell.school === SKL_ABV_TRA)) {
				const isExcludedClockworkSoul = ExcludeUtil.isExcluded(hashSorcererClockworkSoul, "subclass", SRC_TCE, {isNoCount: true});

				if (!isExcludedClockworkSoul) {
					const isExisting = spell.classes.fromSubclass && spell.classes.fromSubclass.some(it => it.class.name === Renderer.spell.STR_SORCERER && it.class.source === SRC_PHB && it.subclass.name === Renderer.spell.STR_CLOCKWORK_SOUL && it.subclass.source === SRC_TCE);

					if (!isExisting) {
						if (isWizardSpell || isWarlockSpell || isSorcererSpell) {
							Renderer.spell._initClasses_addSubclassSpell({
								spell,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_CLOCKWORK_SOUL,
								subclassSource: SRC_TCE,
							});
						}

						if (variantWizardSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantWizardSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_CLOCKWORK_SOUL,
								subclassSource: SRC_TCE,
							});
						}

						if (variantWarlockSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantWarlockSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_CLOCKWORK_SOUL,
								subclassSource: SRC_TCE,
							});
						}

						if (variantSorcererSpells.length) {
							Renderer.spell._initClasses_addVariantSubclassSpells({
								spell,
								variantClassSpells: variantSorcererSpells,
								className: Renderer.spell.STR_SORCERER,
								subclassName: Renderer.spell.STR_CLOCKWORK_SOUL,
								subclassSource: SRC_TCE,
							});
						}
					}
				}
			}
		}
		// endregion

		const lowName = spell.name.toLowerCase();
		const lowSource = spell.source.toLowerCase();

		// region Add homebrew class/subclass
		if (Renderer.spell.brewSpellClasses) {
			if (Renderer.spell.brewSpellClasses.spell) {
				if (Renderer.spell.brewSpellClasses.spell[lowSource] && Renderer.spell.brewSpellClasses.spell[lowSource][lowName]) {
					if (Renderer.spell.brewSpellClasses.spell[lowSource][lowName].fromClassList.length) {
						spell._tmpClasses.fromClassList = spell._tmpClasses.fromClassList || [];
						spell._tmpClasses.fromClassList.push(...Renderer.spell.brewSpellClasses.spell[lowSource][lowName].fromClassList);
					}
					if (Renderer.spell.brewSpellClasses.spell[lowSource][lowName].fromSubclass.length) {
						spell._tmpClasses.fromSubclass = spell._tmpClasses.fromSubclass || [];
						spell._tmpClasses.fromSubclass.push(...Renderer.spell.brewSpellClasses.spell[lowSource][lowName].fromSubclass);
					}
				}
			}

			if (Renderer.spell.brewSpellClasses.class && spell.classes && spell.classes.fromClassList) {
				(spell._tmpClasses = spell._tmpClasses || {}).fromClassList = spell._tmpClasses.fromClassList || [];

				// speed over safety
				outer: for (const srcLower in Renderer.spell.brewSpellClasses.class) {
					const searchForClasses = Renderer.spell.brewSpellClasses.class[srcLower];

					for (const clsLowName in searchForClasses) {
						const spellHasClass = spell.classes.fromClassList.some(cls => (cls.source || "").toLowerCase() === srcLower && cls.name.toLowerCase() === clsLowName);
						if (!spellHasClass) continue;

						const fromDetails = searchForClasses[clsLowName];

						if (fromDetails.fromClassList) {
							spell._tmpClasses.fromClassList.push(...fromDetails.fromClassList);
						}

						if (fromDetails.fromSubclass) {
							spell._tmpClasses.fromSubclass = spell._tmpClasses.fromSubclass || [];
							spell._tmpClasses.fromSubclass.push(...fromDetails.fromSubclass);
						}

						// Only add it once regardless of how many classes match
						break outer;
					}
				}
			}
		}
		// endregion

		// region Add homebrew races/subraces
		if (Renderer.spell.brewSpellRaces) {
			if (Renderer.spell.brewSpellRaces.spell?.[lowSource]?.[lowName]?.length) {
				spell._tmpRaces = spell._tmpRaces || [];
				spell._tmpRaces.push(...Renderer.spell.brewSpellRaces.spell[lowSource][lowName]);
			}

			if (Renderer.spell.brewSpellRaces?.race && spell.races) {
				spell._tmpRaces = spell._tmpRaces || [];

				// speed over safety
				outer: for (const srcLower in Renderer.spell.brewSpellRaces.race) {
					const searchForRaces = Renderer.spell.brewSpellRaces.race[srcLower];

					for (const raceLowName in searchForRaces) {
						const spellHasRace = spell.races.some(r => (r.source || "").toLowerCase() === srcLower && r.name.toLowerCase() === raceLowName);
						if (!spellHasRace) continue;

						const fromDetails = searchForRaces[raceLowName];

						spell._tmpRaces.push(...fromDetails);

						// Only add it once regardless of how many classes match
						break outer;
					}
				}
			}
		}
		// endregion
	},
	STR_WIZARD: "Wizard",
	STR_FIGHTER: "Fighter",
	STR_ROGUE: "Rogue",
	STR_CLERIC: "Cleric",
	STR_SORCERER: "Sorcerer",
	STR_WARLOCK: "Warlock",
	STR_DRUID: "Druid",
	STR_ELD_KNIGHT: "Eldritch Knight",
	STR_ARC_TCKER: "Arcane Trickster",
	STR_DIV_SOUL: "Divine Soul",
	STR_FAV_SOUL_V2: "Favored Soul v2 (UA)",
	STR_FAV_SOUL_V3: "Favored Soul v3 (UA)",
	STR_ABERRANT_MIND: "Aberrant Mind",
	STR_CLOCKWORK_SOUL: "Clockwork Soul",
	STR_DEATH: "Death",

	_initClasses_addSubclassSpell ({spell, className, classSource, subclassName, subclassSource}) {
		classSource = classSource || SRC_PHB;
		subclassSource = subclassSource || SRC_PHB;

		(spell._tmpClasses.fromSubclass = spell._tmpClasses.fromSubclass || []).push({
			class: {name: className, source: classSource},
			subclass: {name: subclassName, source: subclassSource},
		});
	},

	_initClasses_addVariantSubclassSpells ({spell, variantClassSpells, className, classSource, subclassName, subclassSource}) {
		classSource = classSource || SRC_PHB;
		subclassSource = subclassSource || SRC_PHB;

		(variantClassSpells || []).forEach(it => {
			(spell._tmpClasses.fromSubclassVariant = spell._tmpClasses.fromSubclassVariant || []).push({
				class: {name: className, source: classSource, definedInSource: it.definedInSource},
				subclass: {name: subclassName, source: subclassSource},
			});
		});
	},

	_initClasses_addRaceSpell ({spell, raceName, raceSource, raceBaseName, raceBaseSource}) {
		raceSource = raceSource || SRC_PHB;
		raceBaseSource = raceBaseSource || SRC_PHB;

		(spell._tmpRaces = spell._tmpRaces || []).push({
			name: raceName,
			source: raceSource,
			baseName: raceBaseName,
			baseSource: raceBaseSource,
		});
	},

	_initClasses_addVariantRaceSpells ({spell, variantClassSpells, raceName, raceSource, raceBaseName, raceBaseSource}) {
		raceSource = raceSource || SRC_PHB;
		raceBaseSource = raceBaseSource || SRC_PHB;

		(variantClassSpells || []).forEach(it => {
			(spell._tmpRacesVariant = spell._tmpRacesVariant || []).push({
				name: raceName,
				source: raceSource,
				baseName: raceBaseName,
				baseSource: raceBaseSource,
				classDefinedInSource: it.definedInSource,
			});
		});
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
			fluffUrl: `data/fluff-conditionsdiseases.json`,
			fluffProp: it.__prop === "condition" ? "conditionFluff" : "diseaseFluff",
		});
	},
};

Renderer.background = {
	getCompactRenderedString (bg) {
		return `
		${Renderer.utils.getExcludedTr({entity: bg, dataProp: "background", page: UrlUtil.PG_BACKGROUNDS})}
		${Renderer.utils.getNameTr(bg, {page: UrlUtil.PG_BACKGROUNDS})}
		<tr class="text"><td colspan="6">
		${Renderer.get().render({type: "entries", entries: bg.entries})}
		</td></tr>
		`;
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
			fluffUrl: "data/fluff-backgrounds.json",
			fluffProp: "backgroundFluff",
		});
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
		const commonPrefix = it.featureType.length > 1 ? MiscUtil.findCommonPrefix(it.featureType.map(fs => Parser.optFeatureTypeToFull(fs))) : "";

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
			${it.prerequisite ? `<p><i>${Renderer.utils.getPrerequisiteHtml(it.prerequisite)}</i></p>` : ""}
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
	getCompactRenderedString (race) {
		const renderer = Renderer.get();
		const renderStack = [];

		const ability = Renderer.getAbilityData(race.ability);
		renderStack.push(`
			${Renderer.utils.getExcludedTr({entity: race, dataProp: "race", page: UrlUtil.PG_RACES})}
			${Renderer.utils.getNameTr(race, {page: UrlUtil.PG_RACES})}
			<tr><td colspan="6">
				<table class="summary stripe-even-table">
					<tr>
						<th class="col-4 text-center">Ability Scores</th>
						<th class="col-4 text-center">Size</th>
						<th class="col-4 text-center">Speed</th>
					</tr>
					<tr>
						<td class="text-center">${ability.asText}</td>
						<td class="text-center">${(race.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")}</td>
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

		return renderStack.join("");
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
				r = MiscUtil.copy(r);

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
				const baseRace = MiscUtil.copy(r);

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
											...MiscUtil.copy(baseRace.entries),
										],
									},
								],
							},
						],
					},
				];

				delete baseRace.subraces;

				out.push(baseRace);
			}

			out.push(...Renderer.race._mergeSubraces(r));
		});

		return out;
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
		return MiscUtil.copy(race.subraces).map(s => Renderer.race._getMergedSubrace(race, s));
	},

	_getMergedSubrace (race, s) {
		const cpy = MiscUtil.copy(race);
		cpy._baseName = cpy.name;
		cpy._baseSource = cpy.source;
		cpy._baseSrd = cpy.srd;
		delete cpy.subraces;
		delete cpy.srd;

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
			if (!sr.race || !sr.race.name || !sr.race.source) throw new Error(`Subrace was missing parent race!`);

			const _baseRace = allRaces.find(r => r.name === sr.race.name && r.source === sr.race.source);
			if (!_baseRace) throw new Error(`Could not find parent race for subrace!`);

			// If the base race is a _real_ base race, add our new subrace to its list of subraces
			if (_baseRace._isBaseRace) {
				const subraceListEntry = ((_baseRace._baseRaceEntries[0] || {}).entries || []).find(it => it.type === "list");
				subraceListEntry.items.push(`{@race ${_baseRace._rawName || _baseRace.name} (${sr.name})|${sr.source || _baseRace.source}}`);
			}

			// Attempt to graft multiple subraces from the same data set onto the same base race copy
			let baseRace = nxtData.find(r => r.name === sr.race.name && r.source === sr.race.source);
			if (!baseRace) {
				// copy and remove base-race-specific data
				baseRace = MiscUtil.copy(_baseRace);
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

	async pPostProcessFluff (race, raceFluff) {
		if (!(raceFluff.uncommon || raceFluff.monstrous)) return raceFluff;

		raceFluff = MiscUtil.copy(raceFluff);

		const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/fluff-races.json`);

		if (raceFluff.uncommon) {
			raceFluff.entries = raceFluff.entries || [];
			raceFluff.entries.push(MiscUtil.copy(data.raceFluffMeta.uncommon));
		}

		if (raceFluff.monstrous) {
			raceFluff.entries = raceFluff.entries || [];
			raceFluff.entries.push(MiscUtil.copy(data.raceFluffMeta.monstrous));
		}

		return raceFluff;
	},

	pGetFluff (race) {
		return Renderer.utils.pGetFluff({
			entity: race,
			fluffProp: "raceFluff",
			fluffUrl: `data/fluff-races.json`,
			pFnPostProcess: Renderer.race.pPostProcessFluff.bind(null, race),
		});
	},
};

Renderer.deity = {
	_basePartTranslators: {
		"Alignment": {
			prop: "alignment",
			displayFn: (it) => it.map(a => Parser.alignmentAbvToFull(a)).join(" "),
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
	getCompactRenderedString (obj, opts) {
		return Renderer.object.getRenderedString(obj, {...opts, isCompact: true});
	},

	getRenderedString (obj, opts) {
		opts = opts || {};

		const renderer = Renderer.get();

		const hasToken = obj.tokenUrl || obj.hasToken;
		const extraThClasses = !opts.isCompact && hasToken ? ["objs__name--token"] : null;

		return `
			${Renderer.utils.getExcludedTr({entity: obj, dataProp: "object", page: opts.page || UrlUtil.PG_OBJECTS})}
			${Renderer.utils.getNameTr(obj, {page: opts.page || UrlUtil.PG_OBJECTS, extraThClasses, isEmbeddedEntity: opts.isEmbeddedEntity})}
			<tr class="text"><td colspan="6"><i>${obj.objectType !== "GEN" ? `${Parser.sizeAbvToFull(obj.size)} ${obj.creatureType ? Parser.monTypeToFullObj(obj.creatureType).asText : "object"}` : `Variable size object`}</i><br></td></tr>
			<tr class="text"><td colspan="6">
				${obj.capCrew != null ? `<b>Creature Capacity:</b> ${Renderer.vehicle.getShipCreatureCapacity(obj)}<br>` : ""}
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
				entries: Renderer.traphazard.getTrapInitiativeEntries(it),
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
		const trapEntries = Renderer.traphazard._getTrapEntries(it);

		if (!trapEntries.length) return "";

		return renderer.render({
			entries: trapEntries,
		}, 1);
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
			${Renderer.traphazard.getRenderedTrapPart(renderer, it)}
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
	getShortName (mon, isTitleCase) {
		const prefix = mon.isNamedCreature ? "" : isTitleCase ? "The " : "the ";
		if (mon.shortName === true) return `${prefix}${mon.name}`;
		else if (mon.shortName) return `${prefix}${!prefix && isTitleCase ? mon.shortName.toTitleCase() : mon.shortName.toLowerCase()}`;

		const base = mon.name.split(",")[0];
		let out = base
			.replace(/(?:adult|ancient|young) \w+ (dragon|dracolich)/gi, "$1");
		out = mon.isNamedCreature ? out.split(" ")[0] : out.toLowerCase();

		return `${prefix}${out}`;
	},

	getLegendaryActionIntro (mon, renderer = Renderer.get()) {
		if (mon.legendaryHeader) {
			return renderer.render({entries: mon.legendaryHeader});
		} else {
			const legendaryActions = mon.legendaryActions || 3;
			const legendaryNameTitle = Renderer.monster.getShortName(mon, true);
			return `${legendaryNameTitle} can take ${legendaryActions} legendary action${legendaryActions > 1 ? "s" : ""}, choosing from the options below. Only one legendary action can be used at a time and only at the end of another creature's turn. ${legendaryNameTitle} regains spent legendary actions at the start of its turn.`;
		}
	},

	getMythicActionIntro (mon, renderer = Renderer.get()) {
		if (mon.mythicHeader) return renderer.render({entries: mon.mythicHeader});
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
				source: SRC_FTD,
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
			if (dragon.source !== SRC_MM) {
				vBasic.source = SRC_MM;
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
		if (mon._summonedBySpell_levelBase == null) return;

		return e_({
			tag: "select",
			clazz: "input-xs form-control form-control--minimal w-initial inline-block",
			name: "mon__sel-summon-spell-level",
			children: [
				e_({tag: "option", val: "-1", text: "\u2014"}),
				...[...new Array(VeCt.SPELL_LEVEL_MAX + 1 - mon._summonedBySpell_levelBase)].map((_, i) => e_({
					tag: "option",
					val: i + mon._summonedBySpell_levelBase,
					text: i + mon._summonedBySpell_levelBase,
				})),
			],
		});
	},

	getSelSummonClassLevel (mon) {
		if (mon.summonedByClass == null) return;

		return e_({
			tag: "select",
			clazz: "input-xs form-control form-control--minimal w-initial inline-block",
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

		return `<tr class="mon__stat-header-underline"><td colspan="6"><span class="mon__sect-header-inner">${title}${mon[noteKey] ? ` (<span class="ve-small">${mon[noteKey]}</span>)` : ""}</span></td></tr>
		<tr class="text"><td colspan="6">
		${key === "legendary" && mon.legendary ? `<p>${Renderer.monster.getLegendaryActionIntro(mon)}</p>` : ""}
		${key === "mythic" && mon.mythic ? `<p>${Renderer.monster.getMythicActionIntro(mon)}</p>` : ""}
		${toRender.map(it => it.rendered || renderer.render(it, depth)).join("")}
		</td></tr>`;
	},

	getTypeAlignmentPart (mon) { return `${mon.level ? `${Parser.getOrdinalForm(mon.level)}-level ` : ""}${Parser.sizeAbvToFull(mon.size)}${mon.sizeNote ? ` ${mon.sizeNote}` : ""} ${Parser.monTypeToFullObj(mon.type).asText}${mon.alignment ? `, ${mon.alignmentPrefix ? Renderer.get().render(mon.alignmentPrefix) : ""}${Parser.alignmentListToFull(mon.alignment)}` : ""}`; },
	getSavesPart (mon) { return `${Object.keys(mon.save).sort(SortUtil.ascSortAtts).map(s => Renderer.monster.getSave(Renderer.get(), s, mon.save[s])).join(", ")}`; },
	getSensesPart (mon) { return `${mon.senses ? `${Renderer.monster.getRenderedSenses(mon.senses)}, ` : ""}passive Perception ${mon.passive || "\u2014"}`; },

	getRenderWithPlugins ({renderer, mon, fn}) {
		return renderer.withPlugin({
			pluginTypes: [
				"dice",
			],
			fnPlugin: () => {
				if (mon._summonedBySpell_levelBase == null && mon._summonedByClass_level == null) return null;
				if (mon._summonedByClass_level) {
					return {
						additionalData: {
							"data-summoned-by-class-level": mon._summonedByClass_level,
						},
					};
				}
				return {
					additionalData: {
						"data-summoned-by-spell-level": mon._summonedBySpell_level ?? mon._summonedBySpell_levelBase,
					},
				};
			},
			fn,
		});
	},

	/**
	 * @param mon
	 * @param renderer
	 * @param [opts]
	 * @param [opts.isCompact]
	 * @param [opts.isEmbeddedEntity]
	 * @param [opts.isShowScalers]
	 * @param [opts.isScaledCr]
	 * @param [opts.isScaledSpellSummon]
	 * @param [opts.isScaledClassSummon]
	 */
	getCompactRenderedString (mon, renderer, opts) {
		renderer = renderer || Renderer.get();
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
		const isShowSpellLevelScaler = opts.isShowScalers && !isCr && mon._summonedBySpell_levelBase != null;
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
				<table class="summary-noback relative table-layout-fixed">
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
						${mon.pbNote || Parser.crToNumber(mon.cr) < VeCt.CR_CUSTOM ? `<td colspan="1">${mon.pbNote ?? UiUtil.intToBonus(Parser.crToPb(mon.cr))}</td>` : ""}
						${hasToken && !opts.isCompact ? `<td colspan="1"></td>` : ""}
					</tr>
				</table>
			</td></tr>
			<tr><td colspan="6"><div class="border"></div></td></tr>
			<tr><td colspan="6">
				<table class="summary stripe-even-table">
					<tr>
						<th class="col-2 text-center">STR</th>
						<th class="col-2 text-center">DEX</th>
						<th class="col-2 text-center">CON</th>
						<th class="col-2 text-center">INT</th>
						<th class="col-2 text-center">WIS</th>
						<th class="col-2 text-center">CHA</th>
					</tr>
					<tr>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "str")}</td>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "dex")}</td>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "con")}</td>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "int")}</td>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "wis")}</td>
						<td class="text-center">${Renderer.utils.getAbilityRoller(mon, "cha")}</td>
					</tr>
				</table>
			</td></tr>
			<tr><td colspan="6"><div class="border"></div></td></tr>
			<tr><td colspan="6">
				<div class="rd__compact-stat">
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

	getRenderedHp: (hp, isPlainText) => {
		function getMaxStr () {
			const mHp = /^(\d+)d(\d+)([-+]\d+)?$/i.exec(hp.formula);
			if (mHp) {
				const num = Number(mHp[1]);
				const faces = Number(mHp[2]);
				const mod = mHp[3] ? Number(mHp[3]) : 0;
				return `Maximum: ${(num * faces) + mod}`;
			} else return "";
		}
		if (hp.special != null) return isPlainText ? Renderer.stripTags(hp.special) : Renderer.get().render(hp.special);
		if (/^\d+d1$/.exec(hp.formula)) {
			return hp.average;
		} else {
			const maxStr = getMaxStr(hp.formula);
			if (isPlainText) return `${hp.average} (${hp.formula})`;
			return `${maxStr ? `<span title="${maxStr}" class="help-subtle">` : ""}${hp.average}${maxStr ? "</span>" : ""} ${Renderer.get().render(`({@dice ${hp.formula}|${hp.formula}|Hit Points})`)}`;
		}
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
		let traits = mon.trait ? MiscUtil.copy(mon.trait) : null;

		if (fnGetSpellTraits) {
			const spellTraits = fnGetSpellTraits(mon, "trait");
			if (spellTraits.length) traits = traits ? traits.concat(spellTraits) : spellTraits;
		}

		if (traits?.length) return traits.sort((a, b) => SortUtil.monTraitSort(a, b));
	},

	getOrderedActions (mon, {fnGetSpellTraits} = {}) {
		let actions = mon.action ? MiscUtil.copy(mon.action) : null;

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
		actions.splice(ixNext, 0, ...spellActions);
		return actions;
	},

	getSkillsString (renderer, mon) {
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
		} else return skills;
	},

	getTokenUrl (mon) {
		return mon.tokenUrl || UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/${Parser.sourceJsonToAbv(mon.source)}/${Parser.nameToTokenName(mon.name)}.png`);
	},

	postProcessFluff (mon, fluff) {
		const cpy = MiscUtil.copy(fluff);

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
							entries: MiscUtil.copy(thisGroup[prop]),
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

	getRenderedSenses (senses, isPlainText) {
		if (typeof senses === "string") senses = [senses]; // handle legacy format
		if (isPlainText) return senses.join(", ");
		const reSenses = new RegExp(`(^| |\\()(${["tremorsense", "blindsight", "truesight", "darkvision", ...Object.keys(BrewUtil.homebrewMeta?.senses || []).map(it => it.escapeRegexp())].join("|")})(\\)| |$)`, "gi");
		const senseStr = senses
			.join(", ")
			.replace(reSenses, (...m) => `${m[1]}{@sense ${m[2]}}${m[3]}`)
			.replace(/(^| |\()(blind|blinded)(\)| |$)/gi, (...m) => `${m[1]}{@condition blinded||${m[2]}}${m[3]}`)
		;
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

	getCompactRenderedStringLegendaryGroup (legGroup, opts) {
		opts = opts || {};

		const ent = Renderer.monster.getLegendaryGroupSummaryEntry(legGroup);
		if (!ent) return "";

		return `
		${Renderer.utils.getNameTr(legGroup, {isEmbeddedEntity: opts.isEmbeddedEntity})}
		<tr class="text"><td colspan="6">
		${Renderer.get().setFirstSection(true).render(ent)}
		</td></tr>
		${Renderer.utils.getPageTr(legGroup)}`;
	},

	getLegendaryGroupSummaryEntry (legGroup) {
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

	pGetFluff (mon) {
		return Renderer.utils.pGetFluff({
			entity: mon,
			pFnPostProcess: Renderer.monster.postProcessFluff.bind(null, mon),
			fluffBaseUrl: `data/bestiary/`,
			fluffProp: "monsterFluff",
		});
	},

	doBindCompactContentHandlers (
		{
			$content,
			sourceData,
			toRender,
			fnRender,
			page,
			source,
			hash,
			meta,
		},
	) {
		$content
			.find(".mon__btn-scale-cr")
			.click(evt => {
				evt.stopPropagation();
				const win = (evt.view || {}).window;

				const $btn = $(evt.target).closest("button");
				const initialCr = toRender._originalCr != null ? toRender._originalCr : toRender.cr.cr || toRender.cr;
				const lastCr = toRender.cr.cr || toRender.cr;

				Renderer.monster.getCrScaleTarget({
					win,
					$btnScale: $btn,
					initialCr: lastCr,
					isCompact: true,
					cbRender: async (targetCr) => {
						const original = await Renderer.hover.pCacheAndGet(page, source, hash);
						if (Parser.numberToCr(targetCr) === initialCr) {
							toRender = original;
							sourceData.type = "stats";
							delete sourceData.crNumber;
						} else {
							toRender = await ScaleCreature.scale(original, targetCr);
							sourceData.type = "statsCreatureScaledCr";
							sourceData.crNumber = targetCr;
						}

						$content.empty().append(fnRender(toRender));
						meta.windowMeta.$windowTitle.text(toRender._displayName || toRender.name);

						Renderer.monster.doBindCompactContentHandlers({
							$content,
							sourceData,
							toRender,
							fnRender,
							page,
							source,
							hash,
							meta,
						});
					},
				});
			});

		$content
			.find(".mon__btn-reset-cr")
			.click(async () => {
				toRender = await Renderer.hover.pCacheAndGet(page, source, hash);
				$content.empty().append(fnRender(toRender));
				meta.windowMeta.$windowTitle.text(toRender._displayName || toRender.name);

				Renderer.monster.doBindCompactContentHandlers({
					$content,
					sourceData,
					toRender,
					fnRender,
					page,
					source,
					hash,
					meta,
				});
			});

		const $selSummonSpellLevel = $content
			.find(`[name="mon__sel-summon-spell-level"]`)
			.change(async () => {
				const original = await Renderer.hover.pCacheAndGet(page, source, hash);
				const spellLevel = Number($selSummonSpellLevel.val());
				if (~spellLevel) {
					toRender = await ScaleSpellSummonedCreature.scale(original, spellLevel);
					sourceData.type = "statsCreatureScaledSpellSummonLevel";
					sourceData.summonSpellLevel = spellLevel;
				} else {
					toRender = original;
					sourceData.type = "stats";
					delete sourceData.summonSpellLevel;
				}

				$content.empty().append(fnRender(toRender));
				meta.windowMeta.$windowTitle.text(toRender._displayName || toRender.name);

				Renderer.monster.doBindCompactContentHandlers({
					$content,
					sourceData,
					toRender,
					fnRender,
					page,
					source,
					hash,
					meta,
				});
			})
			.val(toRender._summonedBySpell_level != null ? `${toRender._summonedBySpell_level}` : "-1");

		const $selSummonClassLevel = $content
			.find(`[name="mon__sel-summon-class-level"]`)
			.change(async () => {
				const original = await Renderer.hover.pCacheAndGet(page, source, hash);
				const classLevel = Number($selSummonClassLevel.val());
				if (~classLevel) {
					toRender = await ScaleClassSummonedCreature.scale(original, classLevel);
					sourceData.type = "statsCreatureScaledClassSummonLevel";
					sourceData.summonClassLevel = classLevel;
				} else {
					toRender = original;
					sourceData.type = "stats";
					delete sourceData.summonClassLevel;
				}

				$content.empty().append(fnRender(toRender));
				meta.windowMeta.$windowTitle.text(toRender._displayName || toRender.name);

				Renderer.monster.doBindCompactContentHandlers({
					$content,
					sourceData,
					toRender,
					fnRender,
					page,
					source,
					hash,
					meta,
				});
			})
			.val(toRender._summonedByClass_level != null ? `${toRender._summonedByClass_level}` : "-1");
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
};

Renderer.item = {
	_sortProperties (a, b) {
		return SortUtil.ascSort(Renderer.item.propertyMap[a].name, Renderer.item.propertyMap[b].name);
	},

	_getPropertiesText (item) {
		if (item.property) {
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

						return Renderer.get().render(toRender);
					} else return fullProp.name;
				});

			if (!renderedDmg2 && item.dmg2) renderedProperties.unshift(`alt. ${Renderer.item._renderDamage(item.dmg2)}`);

			return `${item.dmg1 && renderedProperties.length ? " - " : ""}${renderedProperties.join(", ")}`;
		} else {
			const parts = [];
			if (item.dmg2) parts.push(`alt. ${Renderer.item._renderDamage(item.dmg2)}`);
			if (item.range) parts.push(`range ${item.range} ft.`);
			return `${item.dmg1 && parts.length ? " - " : ""}${parts.join(", ")}`;
		}
	},

	_getTaggedDamage (dmg) {
		if (!dmg) return "";
		dmg = dmg.trim();
		const mDice = /^{@dice ([^}]+)}$/i.exec(dmg);
		if (mDice) return Renderer.get().render(`{@damage ${mDice[1]}}`);
		return dmg.replace(RollerUtil.DICE_REGEX, (...m) => `{@damage ${m[1]}}`);
	},

	_renderDamage (dmg) {
		return Renderer.get().render(Renderer.item._getTaggedDamage(dmg));
	},

	getDamageAndPropertiesText: function (item) {
		const damageParts = [];

		if (item.dmg1) damageParts.push(Renderer.item._renderDamage(item.dmg1));

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
			].filter(Boolean).join("<br>"));
		}

		const damage = damageParts.join(", ");
		const damageType = item.dmgType ? Parser.dmgTypeToFull(item.dmgType) : "";
		const propertiesTxt = Renderer.item._getPropertiesText(item);

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

	/**
	 * @param item
	 * @param isCompact
	 * @param wrappedTypeWhitelist An optional set of: `"note", "type", "property", "variant"`
	 */
	getRenderedEntries (item, {isCompact = false, wrappedTypeWhitelist = null} = {}) {
		const renderer = Renderer.get();

		const handlersName = {
			string: (str) => Renderer.item._getRenderedEntries_handlerConvertNamesToItalics.bind(Renderer.item, item, item.name)(str),
		};

		const handlersVariantName = item._variantName == null ? null : {
			string: (str) => Renderer.item._getRenderedEntries_handlerConvertNamesToItalics.bind(Renderer.item, item, item._variantName)(str),
		};

		const renderStack = [];
		if (item._fullEntries || (item.entries && item.entries.length)) {
			const entry = MiscUtil.copy({type: "entries", entries: item._fullEntries || item.entries});
			let procEntry = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(entry, handlersName);
			if (handlersVariantName) procEntry = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(entry, handlersVariantName);
			if (wrappedTypeWhitelist) procEntry.entries = procEntry.entries.filter(it => !it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG] || wrappedTypeWhitelist.has(it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]));
			renderer.recursiveRender(procEntry, renderStack, {depth: 1});
		}

		if (item._fullAdditionalEntries || item.additionalEntries) {
			const additionEntries = MiscUtil.copy({type: "entries", entries: item._fullAdditionalEntries || item.additionalEntries});
			let procAdditionEntries = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(additionEntries, handlersName);
			if (handlersVariantName) procAdditionEntries = Renderer.item._GET_RENDERED_ENTRIES_WALKER.walk(additionEntries, handlersVariantName);
			if (wrappedTypeWhitelist) procAdditionEntries.entries = procAdditionEntries.entries.filter(it => !it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG] || wrappedTypeWhitelist.has(it?.data?.[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]));
			renderer.recursiveRender(procAdditionEntries, renderStack, {depth: 1});
		}

		if (!isCompact && item.lootTables) {
			renderStack.push(`<div><span class="bold">Found On: </span>${item.lootTables.sort(SortUtil.ascSortLower).map(tbl => renderer.render(`{@table ${tbl}}`)).join(", ")}</div>`);
		}

		return renderStack.join("").trim();
	},

	_GET_RENDERED_ENTRIES_WALKER: MiscUtil.getWalker({
		keyBlacklist: new Set(["caption", "type", "colLabels", "dataCreature", "dataSpell", "dataItem", "dataObject", "dataTrapHazard", "name"]),
	}),
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

		const hasEntries = (item._fullAdditionalEntries && item._fullAdditionalEntries.length) || (item._fullEntries && item._fullEntries.length) || (item.entries && item.entries.length);

		return `
		${Renderer.utils.getExcludedTr({entity: item, dataProp: "item", page: UrlUtil.PG_ITEMS})}
		${Renderer.utils.getNameTr(item, {page: UrlUtil.PG_ITEMS, isEmbeddedEntity: opts.isEmbeddedEntity})}
		<tr><td class="rd-item__type-rarity-attunement" colspan="6">${Renderer.item.getTypeRarityAndAttunementHtml(typeRarityText, subTypeText, tierText)}</td></tr>
		<tr>
			<td colspan="2">${[Parser.itemValueToFullMultiCurrency(item), Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst()}</td>
			<td class="text-right" colspan="4">${damage} ${damageType} ${propertiesTxt}</td>
		</tr>
		${hasEntries ? `${Renderer.utils.getDividerTr()}<tr class="text"><td colspan="6" class="text">${Renderer.item.getRenderedEntries(item, {isCompact: true})}</td></tr>` : ""}`;
	},

	getTypeRarityAndAttunementHtml (typeRarityText, subTypeText, tierText) {
		return `<div class="flex-col">
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

	_builtLists: {},
	propertyMap: {},
	typeMap: {},
	entryMap: {},
	_additionalEntriesMap: {},
	_addProperty (p) {
		if (Renderer.item.propertyMap[p.abbreviation]) return;
		Renderer.item.propertyMap[p.abbreviation] = p.name ? MiscUtil.copy(p) : {
			name: p.entries[0].name.toLowerCase(),
			entries: p.entries,
			template: p.template,
		};
	},
	_addType (t) {
		if (Renderer.item.typeMap[t.abbreviation]) return;
		Renderer.item.typeMap[t.abbreviation] = t.name ? MiscUtil.copy(t) : {
			name: t.entries[0].name.toLowerCase(),
			entries: t.entries,
		};
	},
	_addEntry (ent) {
		if (Renderer.item.entryMap[ent.source]?.[ent.name]) return;
		MiscUtil.set(Renderer.item.entryMap, ent.source, ent.name, ent);
	},
	_addAdditionalEntries (e) {
		if (Renderer.item._additionalEntriesMap[e.appliesTo]) return;
		Renderer.item._additionalEntriesMap[e.appliesTo] = MiscUtil.copy(e.entries);
	},
	async _pAddBrewPropertiesAndTypes () {
		const brew = await BrewUtil.pAddBrewData();
		(brew.itemProperty || []).forEach(p => Renderer.item._addProperty(p));
		(brew.itemType || []).forEach(t => Renderer.item._addType(t));
		(brew.itemEntry || []).forEach(t => Renderer.item._addEntry(t));
	},
	_addBasePropertiesAndTypes (baseItemData) {
		Object.entries(Parser.ITEM_TYPE_JSON_TO_ABV).forEach(([abv, name]) => Renderer.item._addType({abbreviation: abv, name}));
		// Convert the property and type list JSONs into look-ups, i.e. use the abbreviation as a JSON property name
		baseItemData.itemProperty.forEach(p => Renderer.item._addProperty(p));
		baseItemData.itemType.forEach(t => {
			// air/water vehicles share a type
			if (t.abbreviation === "SHP") {
				const cpy = MiscUtil.copy(t);
				cpy.abbreviation = "AIR";
				Renderer.item._addType(cpy);
			}
			Renderer.item._addType(t);
		});
		baseItemData.itemEntry.forEach(ent => Renderer.item._addEntry(ent));
		baseItemData.itemTypeAdditionalEntries.forEach(e => Renderer.item._addAdditionalEntries(e));

		baseItemData.baseitem.forEach(it => it._isBaseItem = true);
	},

	_lockBuildList: null,
	async _pLockBuildList () {
		while (Renderer.item._lockBuildList) await Renderer.item._lockBuildList.lock;
		let unlock = null;
		const lock = new Promise(resolve => unlock = resolve);
		Renderer.item._lockBuildList = {
			lock,
			unlock,
		};
	},

	_unlockBuildList () {
		const lockMeta = Renderer.item._lockBuildList;
		if (Renderer.item._lockBuildList) {
			delete Renderer.item._lockBuildList;
			lockMeta.unlock();
		}
	},

	/**
	 * Runs callback with itemList as argument
	 * @param [opts] Options object.
	 * @param [opts.fnCallback] Run with args: allItems.
	 * @param [opts.urls] Overrides for default URLs.
	 * @param [opts.isAddGroups] Whether item groups should be included.
	 */
	async pBuildList ({isAddGroups = false, urls = {}, fnCallback = null} = {}) {
		await Renderer.item._pLockBuildList();

		const kBuildList = "builtList";
		if (Renderer.item._builtLists[kBuildList]) {
			const cached = isAddGroups ? Renderer.item._builtLists[kBuildList] : Renderer.item._builtLists[kBuildList].filter(it => !it._isItemGroup);

			Renderer.item._unlockBuildList();
			if (fnCallback) return fnCallback(cached);
			return cached;
		}

		// allows URLs to be overridden (used by roll20 script)
		const itemUrl = urls.items || `${Renderer.get().baseUrl}data/items.json`;
		const baseItemUrl = urls.baseitems || `${Renderer.get().baseUrl}data/items-base.json`;
		const magicVariantUrl = urls.magicvariants || `${Renderer.get().baseUrl}data/magicvariants.json`;

		const itemList = await pLoadItems();
		const baseItems = await Renderer.item._pGetAndProcBaseItems(await DataUtil.loadJSON(baseItemUrl));
		const [genericVariants, linkedLootTables] = Renderer.item._getAndProcGenericVariants(await DataUtil.loadJSON(magicVariantUrl));
		Renderer.item._builtLists["genericVariants"] = genericVariants; // Cache generic variants to use with homebrew later
		const specificVariants = Renderer.item._createSpecificVariants(baseItems, genericVariants, {linkedLootTables});
		const allItems = [...itemList, ...baseItems, ...genericVariants, ...specificVariants];
		Renderer.item._enhanceItems(allItems);
		Renderer.item._builtLists[kBuildList] = allItems;

		// region Find-replace references
		const itemsWithRefs = allItems.filter(it => it.hasRefs);
		await Renderer.hover.pDoDereferenceNestedAndCache(itemsWithRefs, "itemEntry", UrlUtil.URL_TO_HASH_BUILDER["itemEntry"], {isMutateOriginal: true, entryProp: "entries"});
		await Renderer.hover.pDoDereferenceNestedAndCache(itemsWithRefs, "itemEntry", UrlUtil.URL_TO_HASH_BUILDER["itemEntry"], {isMutateOriginal: true, entryProp: "_fullEntries"});
		// endregion

		Renderer.item._unlockBuildList();
		if (fnCallback) return fnCallback(allItems);
		return allItems;

		async function pLoadItems () {
			const itemData = await DataUtil.loadJSON(itemUrl);
			const items = itemData.item;
			itemData.itemGroup.forEach(it => it._isItemGroup = true);
			return [...items, ...itemData.itemGroup];
		}
	},

	async _pGetAndProcBaseItems (baseItemData) {
		Renderer.item._addBasePropertiesAndTypes(baseItemData);
		await Renderer.item._pAddBrewPropertiesAndTypes();
		return baseItemData.baseitem;
	},

	_getAndProcGenericVariants (variantData) {
		variantData.variant.forEach(Renderer.item._genericVariants_addInheritedPropertiesToSelf);
		return [variantData.variant, variantData.linkedLootTables];
	},

	_initFullEntries (item) {
		item._fullEntries = item._fullEntries || (item.entries ? MiscUtil.copy(item.entries) : []);
	},

	_initFullAdditionalEntries (item) {
		item._fullAdditionalEntries = item._fullAdditionalEntries || (item.additionalEntries ? MiscUtil.copy(item.additionalEntries) : []);
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
		return genericVariant.requires.some(req => Object.entries(req).every(([k, v]) => baseItem[k] === v));
	},

	_createSpecificVariants_hasExcludedProperty (baseItem, genericVariant) {
		const curExcludes = genericVariant.excludes || {};
		return !!Object.keys(curExcludes).find(key => {
			if (curExcludes[key] instanceof Array) {
				return (baseItem[key] instanceof Array ? baseItem[key].find(it => curExcludes[key].includes(it)) : curExcludes[key].includes(baseItem[key]));
			}
			return baseItem[key] instanceof Array ? baseItem[key].find(it => curExcludes[key] === it) : curExcludes[key] === baseItem[key];
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
		const specificVariant = MiscUtil.copy(baseItem);

		// Remove "base item" flag
		delete specificVariant._isBaseItem;

		// Reset enhancements/entry cache
		specificVariant._isEnhanced = false;
		delete specificVariant._fullEntries;

		specificVariant._baseName = baseItem.name;
		specificVariant._baseSrd = baseItem.srd;
		if (baseItem.source !== inherits.source) specificVariant._baseSource = baseItem.source;

		specificVariant._variantName = genericVariant.name;

		// Magic items do not inherit the value of the non-magical item
		delete specificVariant.value;

		// Magic variants apply their own SRD info; page info
		delete specificVariant.srd;
		delete specificVariant.page;

		specificVariant._category = "Specific Variant";
		Object.keys(inherits).forEach((inheritedProperty) => {
			switch (inheritedProperty) {
				case "namePrefix": specificVariant.name = `${inherits.namePrefix}${specificVariant.name}`; break;
				case "nameSuffix": specificVariant.name = `${specificVariant.name}${inherits.nameSuffix}`; break;
				case "entries": {
					Renderer.item._initFullEntries(specificVariant);

					const appliedPropertyEntries = Renderer.applyAllProperties(inherits.entries, Renderer.item._getInjectableProps(baseItem, inherits));
					appliedPropertyEntries.forEach((ent, i) => specificVariant._fullEntries.splice(i, 0, ent));
					break;
				}
				case "nameRemove": {
					specificVariant.name = specificVariant.name.replace(new RegExp(inherits[inheritedProperty].escapeRegexp(), "g"), "");

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
				default: specificVariant[inheritedProperty] = inherits[inheritedProperty];
			}
		});

		// track the specific variant on the parent generic, to later render as part of the stats
		genericVariant.variants = genericVariant.variants || [];
		genericVariant.variants.push({base: baseItem, specificVariant});

		// add reverse link to get generic from specific--primarily used for indexing
		specificVariant.genericVariant = {
			name: genericVariant.name,
			source: genericVariant.source,
		};

		// add linked loot tables
		if (opts.linkedLootTables && opts.linkedLootTables[specificVariant.source] && opts.linkedLootTables[specificVariant.source][specificVariant.name]) {
			(specificVariant.lootTables = specificVariant.lootTables || []).push(...opts.linkedLootTables[specificVariant.source][specificVariant.name]);
		}

		if (baseItem.source !== SRC_PHB && baseItem.source !== SRC_DMG) {
			Renderer.item._initFullEntries(specificVariant);
			specificVariant._fullEntries.unshift({
				type: "wrapper",
				wrapped: `{@note The {@item ${baseItem.name}|${baseItem.source}|base item} can be found in ${Parser.sourceJsonToFull(baseItem.source)}${baseItem.page ? `, page ${baseItem.page}` : ""}.}`,
				data: {
					[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "note",
				},
			});
		}

		// Create a uniqueId for this specific variant if the "parent" generic variant has one (i.e., if it's homebrew),
		//   using only the name/source and the parent UID. This avoids changes to the base item from affecting the UID
		//   of the specific variant.
		if (genericVariant.uniqueId) {
			specificVariant.uniqueId = CryptUtil.md5(JSON.stringify({
				name: specificVariant.name,
				source: specificVariant.source,
				genericVariantUniqueId: genericVariant.uniqueId,
			}));
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

	_enhanceItems (allItems) {
		allItems.forEach((item) => Renderer.item.enhanceItem(item));
		return allItems;
	},

	/**
	 * @param genericVariants
	 * @param opts
	 * @param [opts.baseItemsUrl]
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
			opts.baseItemsUrl = opts.baseItemsUrl || `${Renderer.get().baseUrl}data/items-base.json`;
			const baseItemData = await DataUtil.loadJSON(opts.baseItemsUrl);
			Renderer.item._addBasePropertiesAndTypes(baseItemData);
			baseItems = [...baseItemData.baseitem, ...(opts.additionalBaseItems || [])];
		}

		await Renderer.item._pAddBrewPropertiesAndTypes();
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

	_INHERITED_PROPS_BLACKLIST: new Set([
		"entries", // Entries have specific merging
		"namePrefix", // Name prefix/suffix are meaningless
		"nameSuffix",
	]),
	_genericVariants_addInheritedPropertiesToSelf (genericVariant) {
		if (genericVariant._isInherited) return;
		genericVariant._isInherited = true;

		for (const prop in genericVariant.inherits) {
			if (Renderer.item._INHERITED_PROPS_BLACKLIST.has(prop)) continue;

			const val = genericVariant.inherits[prop];

			if (val == null) delete genericVariant[prop];
			else if (genericVariant[prop]) {
				if (genericVariant[prop] instanceof Array && val instanceof Array) genericVariant[prop] = MiscUtil.copy(genericVariant[prop]).concat(val);
				else genericVariant[prop] = val;
			} else genericVariant[prop] = genericVariant.inherits[prop];
		}

		if (!genericVariant.entries && genericVariant.inherits.entries) {
			genericVariant.entries = MiscUtil.copy(Renderer.applyAllProperties(genericVariant.inherits.entries, genericVariant.inherits));
		}
		if (genericVariant.requires.armor) genericVariant.armor = genericVariant.requires.armor;
	},

	getItemTypeName (t) {
		const fullType = Renderer.item.typeMap[t];
		if (!fullType) throw new Error(`Item type ${t} not found. You probably meant to load the property/type reference first; see \`Renderer.item.populatePropertyAndTypeReference()\`.`);
		return fullType.name || t;
	},

	enhanceItem (item) {
		if (item._isEnhanced) return;
		item._isEnhanced = true;
		if (item.noDisplay) return;
		if (item.type === "GV") item._category = "Generic Variant";
		if (item._category == null) item._category = "Other";
		if (item.entries == null) item.entries = [];
		if (item.type && Renderer.item.typeMap[item.type] && Renderer.item.typeMap[item.type].entries) {
			Renderer.item._initFullEntries(item);
			Renderer.item.typeMap[item.type].entries.forEach(e => item._fullEntries.push({type: "wrapper", wrapped: e, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "type"}}));
		}
		if (item.property) {
			item.property.forEach(p => {
				if (!Renderer.item.propertyMap[p]) throw new Error(`Item property ${p} not found. You probably meant to load the property/type reference first; see \`Renderer.item.populatePropertyAndTypeReference()\`.`);
				if (Renderer.item.propertyMap[p].entries) {
					Renderer.item._initFullEntries(item);
					Renderer.item.propertyMap[p].entries.forEach(e => item._fullEntries.push({type: "wrapper", wrapped: e, data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "property"}}));
				}
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
				if (item.scfType === "arcane" && item.source !== SRC_ERLW) {
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
			item._fullEntries.push({type: "wrapper", wrapped: "Multiple variations of this item exist, as listed below:", data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "variant"}});
			item._fullEntries.push({
				type: "wrapper",
				wrapped: {
					type: "list",
					items: item.items.map(it => typeof it === "string" ? `{@item ${it}}` : `{@item ${it.name}|${it.source}}`),
				},
				data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "variant"},
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
				data: {[VeCt.ENTDATA_ITEM_MERGED_ENTRY_TAG]: "variant"},
			});
		}
		// endregion
	},

	unenhanceItem (item) {
		if (!item._isEnhanced) return;
		delete item._isEnhanced;
		delete item._fullEntries;
	},

	async pGetItemsFromHomebrew (homebrew) {
		(homebrew.itemProperty || []).forEach(p => Renderer.item._addProperty(p));
		(homebrew.itemType || []).forEach(t => Renderer.item._addType(t));
		(homebrew.itemEntry || []).forEach(it => Renderer.item._addEntry(it));
		let items = [...(homebrew.baseitem || []), ...(homebrew.item || [])];

		if (homebrew.itemGroup) {
			const itemGroups = MiscUtil.copy(homebrew.itemGroup);
			itemGroups.forEach(it => it._isItemGroup = true);
			items = [...items, ...itemGroups];
		}

		Renderer.item._enhanceItems(items);

		let isReEnhanceVariants = false;

		// Get specific variants for brew base items, using official generic variants
		if (homebrew.baseitem && homebrew.baseitem.length) {
			isReEnhanceVariants = true;

			if (!Renderer.item._builtLists["genericVariants"]) await Renderer.item.pBuildList(); // Build an item list to populate the cache

			const variants = await Renderer.item.pGetGenericAndSpecificVariants(
				Renderer.item._builtLists["genericVariants"],
				{baseItems: homebrew.baseitem || [], isSpecificVariantsOnly: true},
			);
			items = [...items, ...variants];
		}

		// Get specific and generic variants for official and brew base items, using brew generic variants
		if (homebrew.variant && homebrew.variant.length) {
			isReEnhanceVariants = true;

			const variants = await Renderer.item.pGetGenericAndSpecificVariants(
				homebrew.variant,
				{additionalBaseItems: homebrew.baseitem || []},
			);
			items = [...items, ...variants];
		}

		// Regenerate the full entries for the generic variants, as there may be more specific variants to add to their
		//   specific variant lists.
		if (isReEnhanceVariants && Renderer.item._builtLists["genericVariants"]) {
			Renderer.item._builtLists["genericVariants"].forEach(item => {
				item.variants.sort((a, b) => SortUtil.ascSortLower(a.base.name, b.base.name) || SortUtil.ascSortLower(a.base.source, b.base.source));
				Renderer.item.unenhanceItem(item);
				Renderer.item.enhanceItem(item);
			});
		}

		// region Find-replace references
		const itemsWithRefs = items.filter(it => it.hasRefs);
		await Renderer.hover.pDoDereferenceNestedAndCache(itemsWithRefs, "itemEntry", UrlUtil.URL_TO_HASH_BUILDER["itemEntry"], {isMutateOriginal: true, entryProp: "entries"});
		await Renderer.hover.pDoDereferenceNestedAndCache(itemsWithRefs, "itemEntry", UrlUtil.URL_TO_HASH_BUILDER["itemEntry"], {isMutateOriginal: true, entryProp: "_fullEntries"});
		// endregion

		return items;
	},

	// flip e.g. "longsword +1" to "+1 longsword"
	modifierPostToPre (item) {
		const m = /^(.*)(?:,)? (\+\d+)$/.exec(item.name);
		if (m) return Object.assign(MiscUtil.copy(item), {name: `${m[2]} ${m[1]}`});
		else return null;
	},

	_isRefPopulated: false,
	populatePropertyAndTypeReference: () => {
		if (Renderer.item._isRefPopulated) return Promise.resolve();
		return new Promise((resolve, reject) => {
			DataUtil.loadJSON(`${Renderer.get().baseUrl}data/items-base.json`)
				.then(data => {
					if (Renderer.item._isRefPopulated) {
						resolve();
					} else {
						try {
							Object.entries(Parser.ITEM_TYPE_JSON_TO_ABV).forEach(([abv, name]) => Renderer.item._addType({abbreviation: abv, name}));
							data.itemProperty.forEach(p => Renderer.item._addProperty(p));
							data.itemType.forEach(t => Renderer.item._addType(t));
							data.itemEntry.forEach(it => Renderer.item._addEntry(it));
							data.itemTypeAdditionalEntries.forEach(e => Renderer.item._addAdditionalEntries(e));
							Renderer.item._pAddBrewPropertiesAndTypes()
								.then(() => {
									Renderer.item._isRefPopulated = true;
									resolve();
								});
						} catch (e) {
							reject(e);
						}
					}
				});
		});
	},

	// fetch every possible indexable item from official data
	async getAllIndexableItems (rawVariants, rawBaseItems) {
		const basicItems = await Renderer.item._pGetAndProcBaseItems(rawBaseItems);
		const [genericVariants, linkedLootTables] = await Renderer.item._getAndProcGenericVariants(rawVariants);
		const specificVariants = Renderer.item._createSpecificVariants(basicItems, genericVariants, {linkedLootTables});

		const revNames = [];
		[...genericVariants, ...specificVariants].forEach(item => {
			if (item.variants) delete item.variants; // prevent circular references
			const revName = Renderer.item.modifierPostToPre(MiscUtil.copy(item));
			if (revName) revNames.push(revName);
		});

		specificVariants.push(...revNames);

		return specificVariants;
	},

	isMundane (item) { return item.rarity === "none" || item.rarity === "unknown" || item._category === "basic"; },

	isExcluded (item, {hash = null} = {}) {
		hash = hash || UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);

		if (ExcludeUtil.isExcluded(hash, "item", item.source)) return true;

		if (item._isBaseItem) return ExcludeUtil.isExcluded(hash, "baseitem", item.source);
		if (item._isItemGroup) return ExcludeUtil.isExcluded(hash, "itemGroup", item.source);
		if (item._variantName) {
			if (ExcludeUtil.isExcluded(hash, "_specificVariant", item.source)) return true;

			const baseHash = UrlUtil.autoEncodeHash({name: item._baseName, source: item._baseSource || item.source});
			if (ExcludeUtil.isExcluded(baseHash, "baseitem", item._baseSource || item.source)) return true;

			const variantHash = UrlUtil.autoEncodeHash({name: item._variantName, source: item.source});
			return ExcludeUtil.isExcluded(variantHash, "variant", item.source);
		}
		if (item.type === "GV") return ExcludeUtil.isExcluded(hash, "variant", item.source);

		return false;
	},

	pGetFluff (item) {
		return Renderer.utils.pGetFluff({
			entity: item,
			fluffProp: "itemFluff",
			fluffUrl: `data/fluff-items.json`,
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
		const cpy = MiscUtil.copy(rule);
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
		const cpy = MiscUtil.copy(it);
		delete cpy.name;
		return `
			${Renderer.utils.getExcludedTr({entity: it, dataProp: "table", page: UrlUtil.PG_TABLES})}
			${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_TABLES})}
			<tr><td colspan="6">
			${Renderer.get().setFirstSection(true).render(it)}
			</td></tr>
		`;
	},
};

Renderer.vehicle = {
	getCompactRenderedString (veh, opts) {
		return Renderer.vehicle.getRenderedString(veh, {...opts, isCompact: true});
	},

	getRenderedString (veh, opts) {
		opts = opts || {};

		if (veh.upgradeType) return Renderer.vehicle._getRenderedString_upgrade(veh, opts);

		veh.vehicleType = veh.vehicleType || "SHIP";
		switch (veh.vehicleType) {
			case "SHIP": return Renderer.vehicle._getRenderedString_ship(veh, opts);
			case "INFWAR": return Renderer.vehicle._getRenderedString_infwar(veh, opts);
			case "CREATURE": return Renderer.monster.getCompactRenderedString(veh, null, {...opts, isHideLanguages: true, isHideSenses: true, isCompact: false, page: UrlUtil.PG_VEHICLES});
			case "OBJECT": return Renderer.object.getCompactRenderedString(veh, {...opts, isCompact: false, page: UrlUtil.PG_VEHICLES});
			default: throw new Error(`Unhandled vehicle type "${veh.vehicleType}"`);
		}
	},

	getUpgradeSummary (it) {
		return [
			it.upgradeType ? it.upgradeType.map(t => Parser.vehicleTypeToFull(t)) : null,
			it.prerequisite ? Renderer.utils.getPrerequisiteHtml(it.prerequisite) : "",
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
			return `<tr class="mon__stat-header-underline"><td colspan="6"><span>${title}</span></td></tr>`;
		},

		getSectionHpPart_ (renderer, sect, each) {
			if (!sect.ac && !sect.hp) return "";
			return `
				<div><b>Armor Class</b> ${sect.ac}</div>
				<div><b>Hit Points</b> ${sect.hp}${each ? ` each` : ""}${sect.dt ? ` (damage threshold ${sect.dt})` : ""}${sect.hpNote ? `; ${sect.hpNote}` : ""}</div>
			`;
		},

		getControlSection_ (renderer, control) {
			if (!control) return "";
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><span>Control: ${control.name}</span></td></tr>
				<tr><td colspan="6">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, control)}
				<div>${renderer.render({entries: control.entries})}</div>
				</td></tr>
			`;
		},

		getMovementSection_ (renderer, move) {
			if (!move) return "";

			function getLocomotionSection (loc) {
				const asList = Renderer.vehicle.ship.getLocomotionEntries(loc);
				return `<div>${renderer.render(asList)}</div>`;
			}

			function getSpeedSection (spd) {
				const asList = Renderer.vehicle.ship.getSpeedEntries(spd);
				return `<div>${renderer.render(asList)}</div>`;
			}

			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><span>${move.isControl ? `Control and ` : ""}Movement: ${move.name}</span></td></tr>
				<tr><td colspan="6">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, move)}
				${(move.locomotion || []).map(getLocomotionSection)}
				${(move.speed || []).map(getSpeedSection)}
				</td></tr>
			`;
		},

		getWeaponSection_ (renderer, weap) {
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><span>Weapons: ${weap.name}${weap.count ? ` (${weap.count})` : ""}</span></td></tr>
				<tr><td colspan="6">
				${Renderer.vehicle.ship.getSectionHpPart_(renderer, weap, !!weap.count)}
				${renderer.render({entries: weap.entries})}
				</td></tr>
			`;
		},

		getOtherSection_ (renderer, oth) {
			return `
				<tr class="mon__stat-header-underline"><td colspan="6"><span>${oth.name}</span></td></tr>
				<tr><td colspan="6">
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
				${veh.capCrew != null ? `<div><b>Creature Capacity</b> ${Renderer.vehicle.getShipCreatureCapacity(veh)}</div>` : ""}
				${veh.capCargo != null ? `<div><b>Cargo Capacity</b> ${Renderer.vehicle.getShipCargoCapacity(veh)}</div>` : ""}
				${veh.pace != null ? `<div><b>Travel Pace</b> ${veh.pace} miles per hour (${veh.pace * 24} miles per day)</div>
				<div class="ve-muted ve-small help-subtle ml-2" title="Based on &quot;Special Travel Pace,&quot; DMG p242">[<b>Speed</b> ${veh.pace * 10} ft.]</div>` : ""}
			</td></tr>`;
		},
	},

	_getAbilitySection (veh) {
		return Parser.ABIL_ABVS.some(it => veh[it] != null) ? `<tr><td colspan="6">
			<table class="summary stripe-even-table">
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
		return veh.trait ? `<tr class="mon__stat-header-underline"><td colspan="6"><span>Traits</span></td></tr>
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
			${veh.action ? `<tr><td colspan="6">${Renderer.vehicle.ship.getActionPart_(renderer, veh)}</td></tr>` : ""}
			${otherSectionActions.map(Renderer.vehicle.ship.getOtherSection_.bind(this, renderer)).join("")}
			${veh.hull ? `${Renderer.vehicle.ship.getSectionTitle_("Hull")}
			<tr><td colspan="6">
			${Renderer.vehicle.ship.getSectionHpPart_(renderer, veh.hull)}
			</td></tr>` : ""}
			${Renderer.vehicle._getTraitSection(renderer, veh)}
			${(veh.control || []).map(Renderer.vehicle.ship.getControlSection_.bind(this, renderer)).join("")}
			${(veh.movement || []).map(Renderer.vehicle.ship.getMovementSection_.bind(this, renderer)).join("")}
			${(veh.weapon || []).map(Renderer.vehicle.ship.getWeaponSection_.bind(this, renderer)).join("")}
			${otherSectionOthers.map(Renderer.vehicle.ship.getOtherSection_.bind(this, renderer)).join("")}
		`;
	},

	getShipCreatureCapacity (veh) { return `${veh.capCrew} crew${veh.capPassenger ? `, ${veh.capPassenger} passenger${veh.capPassenger === 1 ? "" : "s"}` : ""}`; },
	getShipCargoCapacity (veh) { return typeof veh.capCargo === "string" ? veh.capCargo : `${veh.capCargo} ton${veh.capCargo === 1 ? "" : "s"}`; },

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
			fluffProp: "vehicleFluff",
			fluffUrl: `data/fluff-vehicles.json`,
		});
	},

	getTokenUrl (veh) {
		return veh.tokenUrl || UrlUtil.link(`${Renderer.get().baseMediaUrls["img"] || Renderer.get().baseUrl}img/vehicles/tokens/${Parser.sourceJsonToAbv(veh.source)}/${Parser.nameToTokenName(veh.name)}.png`);
	},
};

Renderer.action = {
	getCompactRenderedString (it) {
		const cpy = MiscUtil.copy(it);
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
			fluffProp: "languageFluff",
			fluffUrl: `data/fluff-languages.json`,
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
};

Renderer.charoption = {
	getCompactRenderedString (it) {
		const preText = Renderer.charoption.getOptionTypePreText(it.optionType);
		return `
		${Renderer.utils.getExcludedTr({entity: it, dataProp: "charoption", page: UrlUtil.PG_CHAR_CREATION_OPTIONS})}
		${Renderer.utils.getNameTr(it, {page: UrlUtil.PG_CHAR_CREATION_OPTIONS})}
		<tr class="text"><td colspan="6">
		${preText || ""}${Renderer.get().setFirstSection(true).render({type: "entries", entries: it.entries})}
		</td></tr>
		`;
	},

	getOptionTypePreText (optionType) {
		if (optionType !== "RF:B") return "";
		return Renderer.get().render({type: "entries", entries: [`{@note You may replace the standard feature of your background with this feature.}`]});
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fluffUrl: "data/fluff-charcreationoptions.json",
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

		return `<div class="flex w-100 rd-recipes__wrp-recipe">
			<div class="flex-1 flex-col br-1p pr-2">
				${ptMakes || ""}
				${ptServes || ""}

				<div class="rd-recipes__wrp-ingredients ${ptMakes || ptServes ? "mt-1" : ""}">${Renderer.get().render({entries: it._fullIngredients}, 0)}</div>

				${it.noteCook ? `<div class="w-100 flex-col mt-4"><div class="flex-vh-center bold mb-1 small-caps">Cook's Notes</div><div class="italic">${Renderer.get().render({entries: it.noteCook})}</div></div>` : ""}
			</div>

			<div class="pl-2 flex-2 rd-recipes__wrp-instructions">
				${Renderer.get().setFirstSection(true).render({entries: it.instructions}, 2)}
			</div>
		</div>`;
	},

	_getMakesServesHtml (it) {
		const ptMakes = it.makes ? `<div class="mb-2 flex-v-center">
			<div class="bold small-caps mr-2">Makes</div>
			<div>${it._scaleFactor ? `${it._scaleFactor}× ` : ""}${Renderer.get().render(it.makes || it.serves)}</div>
		</div>` : null;

		const ptServes = it.serves ? `<div class="mb-2 flex-v-center">
			<div class="bold small-caps mr-2">Serves</div>
			<div>${it.serves.min ?? it.serves.exact}${it.serves.min != null ? " to " : ""}${it.serves.max ?? ""}</div>
		</div>` : null;

		return {ptMakes, ptServes};
	},

	pGetFluff (it) {
		return Renderer.utils.pGetFluff({
			entity: it,
			fluffUrl: "data/fluff-recipes.json",
			fluffProp: "recipeFluff",
		});
	},

	populateFullIngredients (r) {
		r._fullIngredients = Renderer.applyAllProperties(MiscUtil.copy(r.ingredients));
	},

	getScaledRecipe (r, scaleFactor) {
		const cpyR = MiscUtil.copy(r);

		MiscUtil.getWalker({keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST}).walk(
			cpyR.ingredients,
			{
				object: (obj) => {
					if (obj.type !== "ingredient") return obj;

					obj.entry = obj.entry.replace(/{=amount\d+(?:\/[^}]+)?}/g, (...m) => {
						const originalValue = Renderer.applyProperties(m[0], obj);
						return `{@help ${m[0]}|In the original recipe: ${originalValue}}`;
					});

					Object.keys(obj)
						.filter(k => /^amount\d+/.test(k))
						.forEach(k => {
							let base = obj[k];
							const divOneSixth = obj[k] / 0.166;
							if (Math.abs(divOneSixth - Math.round(divOneSixth)) < 0.05) base = (1 / 6) * Math.round(divOneSixth);

							let scaled = base * scaleFactor;
							if (Math.abs(scaled - Math.round(scaled)) < 0.1) {
								scaled = Math.round(scaled);
							}
							obj[k] = scaled;
						});

					return obj;
				},
			},
		);

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

Renderer.generic = {
	/**
	 * @param it
	 * @param [opts]
	 * @param [opts.isSkipNameRow]
	 * @param [opts.isSkipPageRow]
	 */
	getCompactRenderedString (it, opts) {
		opts = opts || {};
		return `
		${opts.isSkipNameRow ? "" : Renderer.utils.getNameTr(it)}
		<tr class="text"><td colspan="6">
		${Renderer.get().setFirstSection(true).render({entries: it.entries})}
		</td></tr>
		${opts.isSkipPageRow ? "" : Renderer.utils.getPageTr(it)}`;
	},
};

Renderer.hover = {
	TAG_TO_PAGE: {
		"spell": UrlUtil.PG_SPELLS,
		"item": UrlUtil.PG_ITEMS,
		"creature": UrlUtil.PG_BESTIARY,
		"condition": UrlUtil.PG_CONDITIONS_DISEASES,
		"disease": UrlUtil.PG_CONDITIONS_DISEASES,
		"background": UrlUtil.PG_BACKGROUNDS,
		"race": UrlUtil.PG_RACES,
		"optfeature": UrlUtil.PG_OPT_FEATURES,
		"reward": UrlUtil.PG_REWARDS,
		"feat": UrlUtil.PG_FEATS,
		"psionic": UrlUtil.PG_PSIONICS,
		"object": UrlUtil.PG_OBJECTS,
		"cult": UrlUtil.PG_CULTS_BOONS,
		"boon": UrlUtil.PG_CULTS_BOONS,
		"trap": UrlUtil.PG_TRAPS_HAZARDS,
		"hazard": UrlUtil.PG_TRAPS_HAZARDS,
		"deity": UrlUtil.PG_DEITIES,
		"variantrule": UrlUtil.PG_VARIANTRULES,
		"charoption": UrlUtil.PG_CHAR_CREATION_OPTIONS,
		"vehicle": UrlUtil.PG_VEHICLES,
		"vehupgrade": UrlUtil.PG_VEHICLES,
		"class": UrlUtil.PG_CLASSES,
		"action": UrlUtil.PG_ACTIONS,
		"language": UrlUtil.PG_LANGUAGES,
		"classFeature": UrlUtil.PG_CLASSES,
		"subclassFeature": UrlUtil.PG_CLASSES,
		"recipe": UrlUtil.PG_RECIPES,
	},

	LinkMeta: function () {
		this.isHovered = false;
		this.isLoading = false;
		this.isPermanent = false;
		this.windowMeta = null;
	},

	_BAR_HEIGHT: 16,

	_linkCache: {},
	_hasBrewSourceBeenAttemptedCache: {},
	_eleCache: new Map(),
	_entryCache: {},
	_isInit: false,
	_dmScreen: null,
	_lastId: 0,
	_contextMenu: null,
	_contextMenuLastClickedHeader: null,

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
						const $thisHoverClose = $(Renderer.hover._contextMenuLastClickedHeader).closest(`.hoverborder--top`).find(`.hvr__close`);
						$(`.hvr__close`).not($thisHoverClose).click();
					},
				),
				new ContextUtil.Action(
					"Close All",
					() => $(`.hvr__close`).click(),
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

		let page, source, hash, preloadId;
		if (opts) {
			page = opts.page;
			source = opts.source;
			hash = opts.hash;
			preloadId = opts.preloadId;
		} else {
			page = ele.dataset.vetPage;
			source = ele.dataset.vetSource;
			hash = ele.dataset.vetHash;
			preloadId = ele.dataset.vetPreloadId;
		}

		let meta = Renderer.hover._handleGenericMouseOverStart(evt, ele);
		if (meta == null) return;

		if (evt.ctrlKey && Renderer.hover._pageToFluffFn(page)) meta.isFluff = true;

		let toRender;
		if (preloadId != null) {
			switch (page) {
				case UrlUtil.PG_BESTIARY: {
					const {_scaledCr: scaledCr, _scaledSpellSummonLevel: scaledSpellSummonLevel, _scaledClassSummonLevel: scaledClassSummonLevel} = Renderer.monster.getUnpackedCustomHashId(preloadId);

					const baseMon = await Renderer.hover.pCacheAndGet(page, source, hash);
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
		} else {
			if (meta.isFluff) toRender = await Renderer.hover.pGetHoverableFluff(page, source, hash);
			else toRender = await Renderer.hover.pCacheAndGet(page, source, hash);
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

		const $content = meta.isFluff
			? Renderer.hover.$getHoverContent_fluff(page, toRender)
			: Renderer.hover.$getHoverContent_stats(page, toRender);
		const sourceData = {
			type: "stats",
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
			Renderer.hover.getWindowPositionFromEvent(tmpEvt || evt),
			{
				title: toRender ? toRender.name : "",
				isPermanent: meta.isPermanent,
				pageUrl: `${Renderer.get().baseUrl}${page}#${hash}`,
				cbClose: () => meta.isHovered = meta.isPermanent = meta.isLoading = meta.isFluff = false,
				isBookContent: page === UrlUtil.PG_RECIPES,
			},
			sourceData,
		);

		if (page === UrlUtil.PG_BESTIARY && !meta.isFluff) {
			const win = (evt.view || {}).window;
			if (win._IS_POPOUT) {
				$content.find(`.mon__btn-scale-cr`).remove();
				$content.find(`.mon__btn-reset-cr`).remove();
			} else {
				switch (page) {
					case UrlUtil.PG_BESTIARY: {
						Renderer.monster.doBindCompactContentHandlers({
							$content,
							sourceData,
							toRender,
							fnRender: Renderer.hover.getFnRenderCompact(page),
							page,
							source,
							hash,
							meta,
						});
					}
				}
			}
		}
	},

	async pGetHoverableFluff (page, source, hash) {
		// Try to fetch the fluff directly
		let toRender = await Renderer.hover.pCacheAndGet(`fluff__${page}`, source, hash);
		// Fall back on fluff attached to the object itself
		const entity = await Renderer.hover.pCacheAndGet(page, source, hash);
		const pFnGetFluff = Renderer.hover._pageToFluffFn(page);
		toRender = await pFnGetFluff(entity);

		if (!toRender) return toRender;

		// For inline homebrew fluff, populate the name/source
		if (toRender && (!toRender.name || !toRender.source)) {
			const toRenderParent = await Renderer.hover.pCacheAndGet(page, source, hash);
			toRender = MiscUtil.copy(toRender);
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

		meta.windowMeta.setPosition(Renderer.hover.getWindowPositionFromEvent(evt));

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
			Renderer.hover.getWindowPositionFromEvent(evt),
			{
				title: toRender.data && toRender.data.hoverTitle != null ? toRender.data.hoverTitle : toRender.name,
				isPermanent: meta.isPermanent,
				cbClose: () => meta.isHovered = meta.isPermanent = meta.isLoading = false,
			},
		);

		// Reset cursor
		ele.style.cursor = "";
	},

	// (Baked into render strings)
	handlePredefinedMouseLeave (evt, ele) { return Renderer.hover.handleLinkMouseLeave(evt, ele); },

	// (Baked into render strings)
	handlePredefinedMouseMove (evt, ele) { return Renderer.hover.handleLinkMouseMove(evt, ele); },

	getWindowPositionFromEvent (evt) {
		const ele = evt.target;

		const offset = $(ele).offset();
		const vpOffsetT = offset.top - $(document).scrollTop();
		const vpOffsetL = offset.left - $(document).scrollLeft();

		const fromBottom = vpOffsetT > window.innerHeight / 2;
		const fromRight = vpOffsetL > window.innerWidth / 2;

		return {
			mode: "autoFromElement",
			vpOffsetT,
			vpOffsetL,
			fromBottom,
			fromRight,
			eleHeight: $(ele).height(),
			eleWidth: $(ele).width(),
			clientX: EventUtil.getClientX(evt),
			window: (evt.view || {}).window || window,
		};
	},

	getWindowPositionExact (x, y, evt = null) {
		return {
			window: ((evt || {}).view || {}).window || window,
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
	 * @param [sourceData] Source data which can be used to load the contents into the DM screen.
	 * @param [sourceData.type]
	 */
	getShowWindow ($content, position, opts, sourceData) {
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
		const $hovTitle = $(`<span class="window-title">${opts.title || ""}</span>`);

		const out = {};
		const hoverId = Renderer.hover._getNextId();
		Renderer.hover._WINDOW_METAS[hoverId] = out;
		const mouseUpId = `mouseup.${hoverId} touchend.${hoverId}`;
		const mouseMoveId = `mousemove.${hoverId} touchmove.${hoverId}`;
		const resizeId = `resize.${hoverId}`;

		const doClose = () => {
			$hov.remove();
			$(position.window.document).off(mouseUpId);
			$(position.window.document).off(mouseMoveId);
			$(position.window).off(resizeId);

			delete Renderer.hover._WINDOW_METAS[hoverId];

			if (opts.cbClose) opts.cbClose(out);
		};

		let drag = {};
		function handleDragMousedown (evt, type) {
			if (evt.which === 0 || evt.which === 1) evt.preventDefault();
			out.zIndex = Renderer.hover._getNextZIndex(hoverId);
			$hov.css({
				"z-index": out.zIndex,
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
		}

		const $brdrTopRightResize = $(`<div class="hoverborder__resize-ne"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 1));

		const $brdrRightResize = $(`<div class="hoverborder__resize-e"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 2));

		const $brdrBottomRightResize = $(`<div class="hoverborder__resize-se"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 3));

		const $brdrBtm = $(`<div class="hoverborder hoverborder--btm ${opts.isBookContent ? "hoverborder-book" : ""}"><div class="hoverborder__resize-s"></div></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 4));

		const $brdrBtmLeftResize = $(`<div class="hoverborder__resize-sw"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 5));

		const $brdrLeftResize = $(`<div class="hoverborder__resize-w"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 6));

		const $brdrTopLeftResize = $(`<div class="hoverborder__resize-nw"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 7));

		const $brdrTopResize = $(`<div class="hoverborder__resize-n"></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 8));

		const $brdrTop = $(`<div class="hoverborder hoverborder--top ${opts.isBookContent ? "hoverborder-book" : ""}" ${opts.isPermanent ? `data-perm="true"` : ""}></div>`)
			.on("mousedown touchstart", (evt) => handleDragMousedown(evt, 9))
			.on("contextmenu", (evt) => {
				Renderer.hover._contextMenuLastClickedHeader = $brdrTop[0];
				ContextUtil.pOpenMenu(evt, Renderer.hover._contextMenu);
			});

		function isOverHoverTarget (evt, target) {
			return EventUtil.getClientX(evt) >= target.left
				&& EventUtil.getClientX(evt) <= target.left + target.width
				&& EventUtil.getClientY(evt) >= target.top
				&& EventUtil.getClientY(evt) <= target.top + target.height;
		}

		function handleNorthDrag (evt) {
			const diffY = Math.max(drag.startY - EventUtil.getClientY(evt), 80 - drag.baseHeight); // prevent <80 height, as this will cause the box to move downwards
			$wrpContent.css("height", drag.baseHeight + diffY);
			$hov.css("top", drag.baseTop - diffY);
			drag.startY = EventUtil.getClientY(evt);
			drag.baseHeight = $wrpContent.height();
			drag.baseTop = parseFloat($hov.css("top"));
		}

		function handleEastDrag (evt) {
			const diffX = drag.startX - EventUtil.getClientX(evt);
			$hov.css("width", drag.baseWidth - diffX);
			drag.startX = EventUtil.getClientX(evt);
			drag.baseWidth = parseFloat($hov.css("width"));
		}

		function handleSouthDrag (evt) {
			const diffY = drag.startY - EventUtil.getClientY(evt);
			$wrpContent.css("height", drag.baseHeight - diffY);
			drag.startY = EventUtil.getClientY(evt);
			drag.baseHeight = $wrpContent.height();
		}

		function handleWestDrag (evt) {
			const diffX = Math.max(drag.startX - EventUtil.getClientX(evt), 150 - drag.baseWidth);
			$hov.css("width", drag.baseWidth + diffX)
				.css("left", drag.baseLeft - diffX);
			drag.startX = EventUtil.getClientX(evt);
			drag.baseWidth = parseFloat($hov.css("width"));
			drag.baseLeft = parseFloat($hov.css("left"));
		}

		$(position.window.document)
			.on(mouseUpId, (evt) => {
				if (drag.type) {
					if (drag.type < 9) {
						$wrpContent.css("max-height", "");
						$hov.css("max-width", "");
					}
					adjustPosition();

					if (drag.type === 9) {
						// handle mobile button touches
						if (evt.target.classList.contains("hvr__close") || evt.target.classList.contains("hvr__popout")) {
							evt.preventDefault();
							drag.type = 0;
							$(evt.target).click();
							return;
						}

						// handle DM screen integration
						if (this._dmScreen && sourceData) {
							const panel = this._dmScreen.getPanelPx(EventUtil.getClientX(evt), EventUtil.getClientY(evt));
							if (!panel) return;
							this._dmScreen.setHoveringPanel(panel);
							const target = panel.getAddButtonPos();

							if (isOverHoverTarget(evt, target)) {
								switch (sourceData.type) {
									case "stats": {
										panel.doPopulate_Stats(sourceData.page, sourceData.source, sourceData.hash);
										break;
									}
									case "statsCreatureScaledCr": {
										panel.doPopulate_StatsScaledCr(sourceData.page, sourceData.source, sourceData.hash, sourceData.crNumber);
										break;
									}
									case "statsCreatureScaledSpellSummonLevel": {
										panel.doPopulate_StatsScaledSpellSummonLevel(sourceData.page, sourceData.source, sourceData.hash, sourceData.summonSpellLevel);
										break;
									}
									case "statsCreatureScaledClassSummonLevel": {
										panel.doPopulate_StatsScaledClassSummonLevel(sourceData.page, sourceData.source, sourceData.hash, sourceData.summonClassLevel);
										break;
									}
								}
								doClose();
							}
							this._dmScreen.resetHoveringButton();
						}
					}
					drag.type = 0;
				}
			})
			.on(mouseMoveId, (evt) => {
				switch (drag.type) {
					case 1: handleNorthDrag(evt); handleEastDrag(evt); break;
					case 2: handleEastDrag(evt); break;
					case 3: handleSouthDrag(evt); handleEastDrag(evt); break;
					case 4: handleSouthDrag(evt); break;
					case 5: handleSouthDrag(evt); handleWestDrag(evt); break;
					case 6: handleWestDrag(evt); break;
					case 7: handleNorthDrag(evt); handleWestDrag(evt); break;
					case 8: handleNorthDrag(evt); break;
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

							if (isOverHoverTarget(evt, target)) this._dmScreen.setHoveringButton(panel);
							else this._dmScreen.resetHoveringButton();
						}
						break;
					}
				}
			});
		$(position.window).on(resizeId, () => adjustPosition(true));

		const doToggleMinimizedMaximized = () => {
			const curState = $brdrTop.attr("data-display-title");
			const isNextMinified = curState === "false";
			$brdrTop.attr("data-display-title", isNextMinified);
			$brdrTop.attr("data-perm", true);
			$hov.toggleClass("hwin--minified", isNextMinified);
		};

		const doMaximize = () => {
			$brdrTop.attr("data-display-title", false);
			$hov.toggleClass("hwin--minified", false);
		};

		$brdrTop.attr("data-display-title", false);
		$brdrTop.on("dblclick", () => doToggleMinimizedMaximized());
		$brdrTop.append($hovTitle);
		const $brdTopRhs = $(`<div class="flex" style="margin-left: auto;"></div>`).appendTo($brdrTop);

		if (opts.pageUrl && !position.window._IS_POPOUT && !Renderer.get().isInternalLinksDisabled()) {
			const $btnGotoPage = $(`<a class="top-border-icon glyphicon glyphicon-modal-window" style="margin-right: 2px;" title="Go to Page" href="${opts.pageUrl}"></a>`)
				.appendTo($brdTopRhs);
		}

		if (!position.window._IS_POPOUT) {
			const $btnPopout = $(`<span class="top-border-icon glyphicon glyphicon-new-window hvr__popout" style="margin-right: 2px;" title="Open as Popup Window"></span>`)
				.on("click", async evt => {
					evt.stopPropagation();

					const dimensions = opts.fnGetPopoutSize ? opts.fnGetPopoutSize() : {width: 600, height: $content.height()};
					const win = window.open(
						"",
						opts.title || "",
						`width=${dimensions.width},height=${dimensions.height}location=0,menubar=0,status=0,titlebar=0,toolbar=0`,
					);

					win._IS_POPOUT = true;
					win.document.write(`
						<!DOCTYPE html>
						<html lang="en" class="${typeof styleSwitcher !== "undefined" ? styleSwitcher.getDayNightClassNames() : ""}"><head>
							<meta name="viewport" content="width=device-width, initial-scale=1">
							<title>${opts.title}</title>
							${$(`link[rel="stylesheet"][href]`).map((i, e) => e.outerHTML).get().join("\n")}
							<!-- Favicons -->
							<link rel="icon" type="image/svg+xml" href="favicon.svg?v=1.115">
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

					let $cpyContent;
					if (opts.$pFnGetPopoutContent) {
						$cpyContent = await opts.$pFnGetPopoutContent();
					} else {
						$cpyContent = $content.clone(true, true);
						$cpyContent.find(`.mon__btn-scale-cr`).remove();
						$cpyContent.find(`.mon__btn-reset-cr`).remove();
					}

					let ticks = 50;
					while (!win.document.body && ticks-- > 0) await MiscUtil.pDelay(5);

					$cpyContent.appendTo($(win.document).find(`.hoverbox--popout`));

					win.Renderer = Renderer;

					doClose();
				}).appendTo($brdTopRhs);
		}

		const $btnClose = $(`<span class="delete-icon glyphicon glyphicon-remove hvr__close" title="Close"></span>`)
			.on("click", (evt) => {
				evt.stopPropagation();
				doClose();
			}).appendTo($brdTopRhs);

		$wrpContent.append($content);

		$hov.append($brdrTopResize).append($brdrTopRightResize).append($brdrRightResize).append($brdrBottomRightResize)
			.append($brdrBtmLeftResize).append($brdrLeftResize).append($brdrTopLeftResize)

			.append($brdrTop)
			.append($wrpContent)
			.append($brdrBtm);

		$body.append($hov);

		const setPosition = (pos) => {
			switch (pos.mode) {
				case "autoFromElement": {
					if (pos.fromBottom) $hov.css("top", pos.vpOffsetT - ($hov.height() + 10));
					else $hov.css("top", pos.vpOffsetT + pos.eleHeight + 10);

					if (pos.fromRight) $hov.css("left", (pos.clientX || pos.vpOffsetL) - (parseFloat($hov.css("width")) + 10));
					else $hov.css("left", (pos.clientX || (pos.vpOffsetL + pos.eleWidth)) + 10);
					break;
				}
				case "exact": {
					$hov.css({
						"left": pos.x,
						"top": pos.y,
					});
					break;
				}
				case "exactVisibleBottom": {
					$hov.css({
						"left": pos.x,
						"top": pos.y,
						"animation": "initial", // Briefly remove the animation so we can calculate the height
					});

					let yPos = pos.y;

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
				default: throw new Error(`Positiong mode unimplemented: "${pos.mode}"`);
			}

			adjustPosition(true);
		};

		setPosition(position);

		function adjustPosition () {
			const eleHov = $hov[0];
			// use these pre-computed values instead of forcing redraws for speed (saves ~100ms)
			const hvTop = parseFloat(eleHov.style.top);
			const hvLeft = parseFloat(eleHov.style.left);
			const hvWidth = parseFloat(eleHov.style.width);
			const screenHeight = position.window.innerHeight;
			const screenWidth = position.window.innerWidth;

			// readjust position...
			// ...if vertically clipping off screen
			if (hvTop < 0) eleHov.style.top = `0px`;
			else if (hvTop >= screenHeight - Renderer.hover._BAR_HEIGHT) {
				$hov.css("top", screenHeight - Renderer.hover._BAR_HEIGHT);
			}

			// ...if horizontally clipping off screen
			if (hvLeft < 0) $hov.css("left", 0);
			else if (hvLeft + hvWidth + Renderer.hover._BODY_SCROLLER_WIDTH_PX > screenWidth) {
				$hov.css("left", Math.max(screenWidth - hvWidth - Renderer.hover._BODY_SCROLLER_WIDTH_PX, 0));
			}
		}

		const setIsPermanent = (isPermanent) => {
			opts.isPermanent = isPermanent;
			$brdrTop.attr("data-perm", isPermanent);
		};

		const setZIndex = (zIndex) => {
			$hov.css("z-index", zIndex);
			out.zIndex = zIndex;
		};

		const doZIndexToFront = () => {
			const nxtZIndex = Renderer.hover._getNextZIndex(hoverId);
			setZIndex(nxtZIndex);
		};

		out.$windowTitle = $hovTitle;
		out.zIndex = initialZIndex;
		out.setZIndex = setZIndex;

		out.setPosition = setPosition;
		out.setIsPermanent = setIsPermanent;
		out.doClose = doClose;
		out.doMaximize = doMaximize;
		out.doZIndexToFront = doZIndexToFront;

		return out;
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
	addEmbeddedToCache (page, source, hash, entity) {
		Renderer.hover._addToCache(page, source, hash, entity);
	},

	_addToCache: (page, source, hash, entity) => {
		page = page.toLowerCase();
		source = source.toLowerCase();
		hash = hash.toLowerCase();

		((Renderer.hover._linkCache[page] =
			Renderer.hover._linkCache[page] || {})[source] =
			Renderer.hover._linkCache[page][source] || {})[hash] = entity;
	},

	getFromCache: (page, source, hash, {isCopy = false} = {}) => {
		page = page.toLowerCase();
		source = source.toLowerCase();
		hash = hash.toLowerCase();

		const out = MiscUtil.get(Renderer.hover._linkCache, page, source, hash);
		if (isCopy && out != null) return MiscUtil.copy(out);
		return out;
	},

	isCached (page, source, hash) {
		page = page.toLowerCase();
		source = source.toLowerCase();
		hash = hash.toLowerCase();
		return !!(Renderer.hover._linkCache[page] && Renderer.hover._linkCache[page][source] && Renderer.hover._linkCache[page][source][hash]);
	},

	isPageSourceCached (page, source) {
		return !!(Renderer.hover._linkCache[page.toLowerCase()] && Renderer.hover._linkCache[page][source.toLowerCase()]);
	},

	_hasBrewSourceBeenAttempted (source) { return !!Renderer.hover._hasBrewSourceBeenAttemptedCache[source]; },
	_setHasBrewSourceBeenAttempted (source) { Renderer.hover._hasBrewSourceBeenAttemptedCache[source] = true; },

	_pDoLoadFromBrew_cachedSources: null,
	async _pDoLoadFromBrew (page, source, hash) {
		// Cache the sources, so we can do case-insensitve lookups
		if (!Renderer.hover._pDoLoadFromBrew_cachedSources) {
			let sourceIndex;
			try {
				sourceIndex = await DataUtil.brew.pLoadSourceIndex();
			} catch (e) {
				setTimeout(() => { throw e; });
			}
			if (!sourceIndex) return false;

			Renderer.hover._pDoLoadFromBrew_cachedSources = {};
			Object.keys(sourceIndex)
				.forEach((source) => {
					Renderer.hover._pDoLoadFromBrew_cachedSources[source.toLowerCase()] = source;
				});
		}

		const sourceJsonCorrectCase = Renderer.hover._pDoLoadFromBrew_cachedSources[source];
		if (!sourceJsonCorrectCase) return false;

		// This loads the brew as a side effect
		const brewJson = await DataUtil.pLoadBrewBySource(sourceJsonCorrectCase);
		return !!brewJson;
	},

	_psCacheLoading: {},
	_flagsCacheLoaded: {},
	_locks: {},
	_flags: {},

	/**
	 * @param page
	 * @param hash
	 * @param [opts] Options object.
	 * @param [opts.isCopy] If a copy, rather than the original entity, should be returned.
	 */
	async pCacheAndGetHash (page, hash, opts) {
		const source = UrlUtil.decodeHash(hash).last();
		return Renderer.hover.pCacheAndGet(page, source, hash, opts);
	},

	/**
	 * @param page
	 * @param source
	 * @param hash
	 * @param [opts] Options object.
	 * @param [opts.isCopy] If a copy, rather than the original entity, should be returned.
	 */
	async pCacheAndGet (page, source, hash, opts) {
		opts = opts || {};

		page = page.toLowerCase();
		source = source.toLowerCase();
		hash = hash.toLowerCase();

		const existingOut = Renderer.hover.getFromCache(page, source, hash, opts);
		if (existingOut) return existingOut;

		switch (page) {
			case "generic":
			case "hover": return null;
			case "subclass":
			case UrlUtil.PG_CLASSES: return Renderer.hover._pCacheAndGet_pLoadClasses(page, source, hash, opts);
			case UrlUtil.PG_SPELLS: return Renderer.hover._pCacheAndGet_pLoadMultiSource(page, source, hash, opts, `data/spells/`, "spell", Renderer.spell.prePopulateHover);
			case UrlUtil.PG_BESTIARY: return Renderer.hover._pCacheAndGet_pLoadBestiary(page, source, hash, opts);
			case UrlUtil.PG_ITEMS: return Renderer.hover._pCacheAndGet_pLoadItems(page, source, hash, opts);
			case UrlUtil.PG_BACKGROUNDS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "backgrounds.json", "background");
			case "raw_feat":
			case UrlUtil.PG_FEATS: return Renderer.hover._pCacheAndGet_pLoadSimple(UrlUtil.PG_FEATS, source, hash, opts, "feats.json", "feat");
			case "raw_optionalfeature":
			case UrlUtil.PG_OPT_FEATURES: return Renderer.hover._pCacheAndGet_pLoadSimple(UrlUtil.PG_OPT_FEATURES, source, hash, opts, "optionalfeatures.json", "optionalfeature");
			case UrlUtil.PG_PSIONICS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "psionics.json", "psionic");
			case "raw_reward":
			case UrlUtil.PG_REWARDS: return Renderer.hover._pCacheAndGet_pLoadSimple(UrlUtil.PG_REWARDS, source, hash, opts, "rewards.json", "reward");
			case UrlUtil.PG_RACES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "races.json", ["race", "subrace"], null, "race", {isAddBaseRaces: true});
			case UrlUtil.PG_DEITIES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "deities.json", "deity", null, "deity");
			case UrlUtil.PG_OBJECTS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "objects.json", "object");
			case UrlUtil.PG_TRAPS_HAZARDS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "trapshazards.json", ["trap", "hazard"]);
			case UrlUtil.PG_VARIANTRULES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "variantrules.json", "variantrule", null, "variantrule");
			case UrlUtil.PG_CULTS_BOONS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "cultsboons.json", ["cult", "boon"], (listProp, item) => item.__prop = listProp);
			case UrlUtil.PG_CONDITIONS_DISEASES: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "conditionsdiseases.json", ["condition", "disease", "status"], (listProp, item) => item.__prop = listProp);
			case UrlUtil.PG_TABLES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "tables.json", ["table", "tableGroup"], (listProp, item) => item.__prop = listProp, "table");
			case UrlUtil.PG_VEHICLES: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "vehicles.json", ["vehicle", "vehicleUpgrade"]);
			case UrlUtil.PG_ACTIONS: return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "actions.json", "action");
			case UrlUtil.PG_LANGUAGES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "languages.json", "language", null, "language");
			case "raw_charoption":
			case UrlUtil.PG_CHAR_CREATION_OPTIONS: return Renderer.hover._pCacheAndGet_pLoadSimple(UrlUtil.PG_CHAR_CREATION_OPTIONS, source, hash, opts, "charcreationoptions.json", "charoption");
			case UrlUtil.PG_RECIPES: return Renderer.hover._pCacheAndGet_pLoadCustom(page, source, hash, opts, "recipes.json", "recipe", null, "recipe");
			case UrlUtil.PG_CLASS_SUBCLASS_FEATURES: return Renderer.hover._pCacheAndGet_pLoadClassSubclassFeatures(page, source, hash, opts);

			// region adventure/books/references
			case UrlUtil.PG_QUICKREF: return Renderer.hover._pCacheAndGet_pLoadQuickref(page, source, hash, opts);
			case UrlUtil.PG_ADVENTURE: return Renderer.hover._pCacheAndGet_pLoadAdventure(page, source, hash, opts);
			// enregion

			// region per-page fluff
			case `fluff__${UrlUtil.PG_BESTIARY}`: return Renderer.hover._pCacheAndGet_pLoadMultiSourceFluff(page, source, hash, opts, `data/bestiary/`, "monsterFluff");
			case `fluff__${UrlUtil.PG_SPELLS}`: return Renderer.hover._pCacheAndGet_pLoadMultiSourceFluff(page, source, hash, opts, `data/spells/`, "spellFluff");
			case `fluff__${UrlUtil.PG_BACKGROUNDS}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-backgrounds.json", "backgroundFluff");
			case `fluff__${UrlUtil.PG_ITEMS}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-items.json", "itemFluff");
			case `fluff__${UrlUtil.PG_CONDITIONS_DISEASES}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-conditionsdiseases.json", ["conditionFluff", "diseaseFluff"]);
			case `fluff__${UrlUtil.PG_RACES}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-races.json", "raceFluff");
			case `fluff__${UrlUtil.PG_LANGUAGES}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-languages.json", "languageFluff");
			case `fluff__${UrlUtil.PG_VEHICLES}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-vehicles.json", "vehicleFluff");
			case `fluff__${UrlUtil.PG_CHAR_CREATION_OPTIONS}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-charcreationoptions.json", "charoptionFluff");
			case `fluff__${UrlUtil.PG_RECIPES}`: return Renderer.hover._pCacheAndGet_pLoadSimpleFluff(page, source, hash, opts, "fluff-recipes.json", "recipeFluff");
			// endregion

			// region props
			case "classfeature": return Renderer.hover._pCacheAndGet_pLoadClassFeatures(page, source, hash, opts);
			case "subclassfeature": return Renderer.hover._pCacheAndGet_pLoadSubclassFeatures(page, source, hash, opts);

			case "raw_class":
			case "raw_subclass": return Renderer.hover._pCacheAndGet_pLoadClassesRaw(page, source, hash, opts);

			case "raw_classfeature": return Renderer.hover._pCacheAndGet_pLoadClassFeatures(page, source, hash, opts);
			case "raw_subclassfeature": return Renderer.hover._pCacheAndGet_pLoadSubclassFeatures(page, source, hash, opts);

			case "legendarygroup": return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "bestiary/legendarygroups.json", "legendaryGroup");

			case "itementry": return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, opts, "items-base.json", "itemEntry");
			// endregion

			default: throw new Error(`No load function defined for page ${page}`);
		}
	},

	async _pCacheAndGet_pDoLoadWithLock (page, source, hash, loadKey, pFnLoad) {
		if (Renderer.hover._psCacheLoading[loadKey]) await Renderer.hover._psCacheLoading[loadKey];

		if (!Renderer.hover._flagsCacheLoaded[loadKey] || !Renderer.hover.isCached(page, source, hash)) {
			Renderer.hover._psCacheLoading[loadKey] = (async () => {
				await pFnLoad();

				Renderer.hover._flagsCacheLoaded[loadKey] = true;
			})();
			await Renderer.hover._psCacheLoading[loadKey];
		}

		if (!Renderer.hover.isCached(page, source, hash) && !Renderer.hover._hasBrewSourceBeenAttempted(source)) {
			Renderer.hover._setHasBrewSourceBeenAttempted(source);
			return Renderer.hover._pDoLoadFromBrew(page, source, hash);
		}
	},

	/**
	 * @param data the data
	 * @param listProp list property in the data
	 * @param [opts]
	 * @param [opts.fnMutateItem] optional function to run per item; takes listProp and an item as parameters
	 * @param [opts.fnGetHash]
	 */
	_pCacheAndGet_populate (page, data, listProp, opts) {
		opts = opts || {};

		data[listProp].forEach(it => {
			it.__prop = listProp;
			const itHash = (opts.fnGetHash || UrlUtil.URL_TO_HASH_BUILDER[page])(it);
			if (opts.fnMutateItem) opts.fnMutateItem(listProp, it);
			Renderer.hover._addToCache(page, it.source, itHash, it);

			DataUtil.proxy.getVersions(listProp, it)
				.forEach(v => {
					const vHash = (opts.fnGetHash || UrlUtil.URL_TO_HASH_BUILDER[page])(v);
					if (opts.fnMutateItem) opts.fnMutateItem(listProp, v);
					Renderer.hover._addToCache(page, v.source, vHash, v);
				});
		});
	},

	async _pCacheAndGet_pLoadMultiSource (page, source, hash, opts, baseUrl, listProp, fnPrePopulate = null) {
		const loadKey = `${page}${source}`;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const brewData = await BrewUtil.pAddBrewData();
				if (fnPrePopulate) fnPrePopulate(brewData, {isBrew: true});
				if (brewData[listProp]) Renderer.hover._pCacheAndGet_populate(page, brewData, listProp, {fnGetHash: opts.fnGetHash});
				const index = await DataUtil.loadJSON(`${Renderer.get().baseUrl}${baseUrl}${opts.isFluff ? "fluff-" : ""}index.json`);
				const officialSources = {};
				Object.entries(index).forEach(([k, v]) => officialSources[k.toLowerCase()] = v);

				const officialSource = officialSources[source.toLowerCase()];
				if (officialSource) {
					const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}${baseUrl}${officialSource}`);
					if (fnPrePopulate) fnPrePopulate(data, {isBrew: false});
					Renderer.hover._pCacheAndGet_populate(page, data, listProp, {fnGetHash: opts.fnGetHash});
				}
				// (else source to load is 3rd party, which was already handled)
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadMultiSourceFluff (page, source, hash, opts, baseUrl, listProp, fnPrePopulate = null) {
		const nxtOpts = MiscUtil.copy(opts);
		nxtOpts.isFluff = true;
		nxtOpts.fnGetHash = it => UrlUtil.encodeForHash([it.name, it.source]);
		return Renderer.hover._pCacheAndGet_pLoadMultiSource(page, source, hash, nxtOpts, baseUrl, listProp);
	},

	async _pCacheAndGet_pLoadSingleBrew (page, opts, listProps, fnMutateItem) {
		const brewData = await BrewUtil.pAddBrewData();
		Renderer.hover._pCacheAndGet_doCacheBrewData(brewData, page, opts, listProps, fnMutateItem);
	},

	async _pCacheAndGet_pLoadCustomBrew (page, opts, listProps, fnMutateItem, loader) {
		const brewData = await DataUtil[loader].loadBrew();
		Renderer.hover._pCacheAndGet_doCacheBrewData(brewData, page, opts, listProps, fnMutateItem);
	},

	_pCacheAndGet_doCacheBrewData (brewData, page, opts, listProps, fnMutateItem) {
		listProps = listProps instanceof Array ? listProps : [listProps];
		listProps.forEach(lp => {
			if (brewData[lp]) Renderer.hover._pCacheAndGet_populate(page, brewData, lp, {fnMutateItem, fnGetHash: opts.fnGetHash});
		});
	},

	_pCacheAndGet_handleSingleData (page, opts, data, listProps, fnMutateItem) {
		if (listProps instanceof Array) listProps.forEach(prop => data[prop] && Renderer.hover._pCacheAndGet_populate(page, data, prop, {fnMutateItem, fnGetHash: opts.fnGetHash}));
		else Renderer.hover._pCacheAndGet_populate(page, data, listProps, {fnMutateItem, fnGetHash: opts.fnGetHash});
	},

	async _pCacheAndGet_pLoadSimple (page, source, hash, opts, jsonFile, listProps, fnMutateItem) {
		const loadKey = jsonFile;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				await Renderer.hover._pCacheAndGet_pLoadSingleBrew(page, opts, listProps, fnMutateItem);
				const data = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/${jsonFile}`);
				Renderer.hover._pCacheAndGet_handleSingleData(page, opts, data, listProps, fnMutateItem);
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadSimpleFluff (page, source, hash, opts, jsonFile, listProps, fnMutateItem) {
		const nxtOpts = MiscUtil.copy(opts);
		nxtOpts.isFluff = true;
		nxtOpts.fnGetHash = it => UrlUtil.encodeForHash([it.name, it.source]);
		return Renderer.hover._pCacheAndGet_pLoadSimple(page, source, hash, nxtOpts, jsonFile, listProps, fnMutateItem);
	},

	async _pCacheAndGet_pLoadCustom (page, source, hash, opts, jsonFile, listProps, itemModifier, loader, loaderLoadJsonArgs = {}, loaderLoadBrewArgs = {}) {
		const loadKey = jsonFile;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				if (DataUtil[loader].loadBrew) await Renderer.hover._pCacheAndGet_pLoadCustomBrew(page, opts, listProps, itemModifier, loader, loaderLoadBrewArgs);
				else await Renderer.hover._pCacheAndGet_pLoadSingleBrew(page, opts, listProps, itemModifier);

				const data = await DataUtil[loader].loadJSON(loaderLoadJsonArgs);
				Renderer.hover._pCacheAndGet_handleSingleData(page, opts, data, listProps, itemModifier);
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadBestiary (page, source, hash, opts) {
		await DataUtil.monster.pPreloadMeta();
		return Renderer.hover._pCacheAndGet_pLoadMultiSource(page, source, hash, opts, `data/bestiary/`, "monster", data => DataUtil.monster.populateMetaReference(data));
	},

	async _pCacheAndGet_pLoadItems (page, source, hash, opts) {
		const loadKey = UrlUtil.PG_ITEMS;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const allItems = await Renderer.item.pBuildList({
					isAddGroups: true,
				});
				// populate brew once the main item properties have been loaded
				const brewData = await BrewUtil.pAddBrewData();
				const itemList = await Renderer.item.pGetItemsFromHomebrew(brewData);
				itemList.forEach(it => {
					const itHash = UrlUtil.URL_TO_HASH_BUILDER[page](it);
					Renderer.hover._addToCache(page, it.source, itHash, it);
					const revName = Renderer.item.modifierPostToPre(it);
					if (revName) Renderer.hover._addToCache(page, it.source, UrlUtil.URL_TO_HASH_BUILDER[page](revName), it);
				});

				allItems.forEach(item => {
					const itemHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);
					Renderer.hover._addToCache(page, item.source, itemHash, item);
					const revName = Renderer.item.modifierPostToPre(item);
					if (revName) Renderer.hover._addToCache(page, item.source, UrlUtil.URL_TO_HASH_BUILDER[page](revName), item);
				});
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadQuickref (page, source, hash, opts) {
		const loadKey = UrlUtil.PG_QUICKREF;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/generated/bookref-quick.json`);

				json.data["bookref-quick"].forEach((chapter, ixChapter) => {
					const metas = IndexableFileQuickReference.getChapterNameMetas(chapter);

					metas.forEach(nameMeta => {
						const hashParts = [
							"bookref-quick",
							ixChapter,
							UrlUtil.encodeForHash(nameMeta.name.toLowerCase()),
						];
						if (nameMeta.ixBook) hashParts.push(nameMeta.ixBook);

						const hash = hashParts.join(HASH_PART_SEP);

						Renderer.hover._addToCache(page, nameMeta.source, hash, nameMeta.entry);
					});
				});
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadAdventure (page, source, hash, opts) {
		const loadKey = `${page}${source}`;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				// region Brew
				const brew = await BrewUtil.pAddBrewData();

				// Get only the ids that exist in both data + contents
				const brewDataIds = (brew.adventureData || []).filter(it => it.id).map(it => it.id);
				const brewContentsIds = new Set(...(brew.adventure || []).filter(it => it.id).map(it => it.id));
				const matchingBrewIds = brewDataIds.filter(id => brewContentsIds.has(id));

				matchingBrewIds.forEach(id => {
					const brewData = (brew.adventureData || []).find(it => it.id === id);
					const brewContents = (brew.adventure || []).find(it => it.id === id);

					const pack = {
						adventure: brewContents,
						adventureData: brewData,
					};

					const hash = UrlUtil.URL_TO_HASH_BUILDER[page](brewContents);
					Renderer.hover._addToCache(page, brewContents.source, hash, pack);
				});
				// endregion

				const index = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/adventures.json`);
				const fromIndex = index.adventure.find(it => UrlUtil.URL_TO_HASH_BUILDER[page](it) === hash);
				if (fromIndex) {
					const json = await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/adventure/adventure-${hash}.json`);

					const pack = {
						adventure: fromIndex,
						adventureData: json,
					};

					Renderer.hover._addToCache(page, fromIndex.source, hash, pack);
				}
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadClasses (page, source, hash, opts) {
		const loadKey = UrlUtil.PG_CLASSES;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const classData = await DataUtil.class.loadJSON();
				const brewData = await BrewUtil.pAddBrewData();
				await Promise.all((brewData.class || []).map(cc => Renderer.hover._pCacheAndGet_pLoadClasses_addToIndex(cc)));
				for (const sc of (brewData.subclass || [])) await Renderer.hover._pCacheAndGet_pLoadClasses_addSubclassToIndex(sc);
				await Promise.all(classData.class.map(cc => Renderer.hover._pCacheAndGet_pLoadClasses_addToIndex(cc)));
				for (const sc of (classData.subclass || [])) await Renderer.hover._pCacheAndGet_pLoadClasses_addSubclassToIndex(sc);
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadClasses_addToIndex (cls, {isRaw = false} = {}) {
		// add class
		const clsHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES](cls);

		if (isRaw) {
			Renderer.hover._addToCache("raw_class", cls.source || SRC_PHB, clsHash, cls);
			return;
		}

		cls = await DataUtil.class.pGetDereferencedClassData(cls);
		const clsEntries = {
			name: cls.name,
			type: "section",
			entries: MiscUtil.copy((cls.classFeatures || []).flat()),
			data: {
				class: MiscUtil.copy(cls),
			},
		};
		Renderer.hover._addToCache(UrlUtil.PG_CLASSES, cls.source || SRC_PHB, clsHash, clsEntries);

		// add all class features
		UrlUtil.class.getIndexedClassEntries(cls).forEach(it => Renderer.hover._addToCache(UrlUtil.PG_CLASSES, it.source, it.hash, it.entry));
	},

	async _pCacheAndGet_pLoadClasses_addSubclassToIndex (sc, {isRaw = false} = {}) {
		const clsHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_CLASSES]({name: sc.className, source: sc.classSource});

		const scHash = `${clsHash}${HASH_PART_SEP}${UrlUtil.getClassesPageStatePart({subclass: sc})}`;

		if (isRaw) {
			Renderer.hover._addToCache("raw_subclass", sc.source || SRC_PHB, scHash, sc);
			return;
		}

		sc = await DataUtil.class.pGetDereferencedSubclassData(sc);

		const scEntries = {
			type: "section",
			entries: MiscUtil.copy((sc.subclassFeatures || []).flat()),
			data: {
				class: {name: sc.className, source: sc.classSource},
				subclass: MiscUtil.copy(sc),
			},
		};

		// Always use the class source where available, as these are all keyed as sub-hashes on the classes page
		Renderer.hover._addToCache(UrlUtil.PG_CLASSES, sc.classSource || sc.source || SRC_PHB, scHash, scEntries);

		// Add a copy using the subclass source, for omnisearch results
		Renderer.hover._addToCache(UrlUtil.PG_CLASSES, sc.source || SRC_PHB, scHash, scEntries);

		// add all class/subclass features
		UrlUtil.class.getIndexedSubclassEntries(sc).forEach(it => Renderer.hover._addToCache(UrlUtil.PG_CLASSES, it.source, it.hash, it.entry));
	},

	async _pCacheAndGet_pLoadClassesRaw (page, source, hash, opts) {
		const loadKey = "raw_class";

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const classData = await DataUtil.class.loadRawJSON();
				const brewData = await BrewUtil.pAddBrewData();
				await Promise.all((brewData.class || []).map(cc => Renderer.hover._pCacheAndGet_pLoadClasses_addToIndex(cc, {isRaw: true})));
				for (const sc of (brewData.subclass || [])) await Renderer.hover._pCacheAndGet_pLoadClasses_addSubclassToIndex(sc, {isRaw: true});
				await Promise.all(classData.class.map(cc => Renderer.hover._pCacheAndGet_pLoadClasses_addToIndex(cc, {isRaw: true})));
				for (const sc of (classData.subclass || [])) await Renderer.hover._pCacheAndGet_pLoadClasses_addSubclassToIndex(sc, {isRaw: true});
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadClassSubclassFeatures (page, source, hash, opts) {
		const uid = UrlUtil.decodeHash(hash).join("|");
		if (DataUtil.class.isValidSubclassFeatureUid(uid)) return Renderer.hover._pCacheAndGet_pLoadClassFeatures("subclassfeature", source, hash, opts);
		return Renderer.hover._pCacheAndGet_pLoadClassFeatures("classfeature", source, hash, opts);
	},

	async _pCacheAndGet_pLoadClassFeatures (page, source, hash, opts) {
		const loadKey = page;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const brewData = await BrewUtil.pAddBrewData();
				await Renderer.hover.pDoDereferenceNestedAndCache(brewData.classFeature, "classFeature", UrlUtil.URL_TO_HASH_BUILDER["classFeature"]);
				await Renderer.hover._pCacheAndGet_pLoadOfficialClassAndSubclassFeatures();
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	async _pCacheAndGet_pLoadSubclassFeatures (page, source, hash, opts) {
		const loadKey = page;

		const isNotLoadedAndIsSourceAvailableBrew = await Renderer.hover._pCacheAndGet_pDoLoadWithLock(
			page,
			source,
			hash,
			loadKey,
			async () => {
				const brewData = await BrewUtil.pAddBrewData();
				await Renderer.hover.pDoDereferenceNestedAndCache(brewData.subclassFeature, "subclassFeature", UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"]);
				await Renderer.hover._pCacheAndGet_pLoadOfficialClassAndSubclassFeatures();
			},
		);

		if (isNotLoadedAndIsSourceAvailableBrew) return Renderer.hover.pCacheAndGet(page, source, hash);
		return Renderer.hover.getFromCache(page, source, hash, opts);
	},

	_REF_TYPES: new Set([
		"refClassFeature",
		"refSubclassFeature",
		"refOptionalfeature",
		"refItemEntry",
	]),
	async pDoDereferenceNestedAndCache (entities, page, fnGetHash, {isMutateOriginal = false, entryProp = "entries"} = {}) {
		if (!entities || !entities.length) return;

		const entriesWithRefs = {};
		const entriesWithoutRefs = {};
		const ptrHasRef = {_: false};

		const walker = MiscUtil.getWalker({
			keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
			isNoModification: true,
		});
		const walkerMod = MiscUtil.getWalker({
			keyBlacklist: MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLACKLIST,
		});

		const handlers = {
			object: (obj) => {
				if (ptrHasRef._) return obj;
				if (Renderer.hover._REF_TYPES.has(obj.type)) ptrHasRef._ = true;
				return obj;
			},
			string: (str) => {
				if (ptrHasRef._) return str;
				if (str.startsWith("{#") && str.endsWith("}")) ptrHasRef._ = true;
				return str;
			},
		};

		entities.forEach(ent => {
			// Cache the raw version
			//  ...unless we're mutating, in which case, skip it, as this is currently unused
			const hash = fnGetHash(ent);
			if (!isMutateOriginal) Renderer.hover._addToCache(`raw_${page}`, ent.source, hash, ent);

			ptrHasRef._ = false;
			walker.walk(ent[entryProp], handlers);

			(ptrHasRef._ ? entriesWithRefs : entriesWithoutRefs)[hash] = isMutateOriginal
				? ent
				: ptrHasRef._ ? MiscUtil.copy(ent) : ent;
		});

		let cntDerefLoops = 0;
		while (Object.keys(entriesWithRefs).length && cntDerefLoops < 25) { // conservatively avoid infinite looping
			const hashes = Object.keys(entriesWithRefs);
			for (const hash of hashes) {
				const ent = entriesWithRefs[hash];

				const toReplaceMetas = [];
				walker.walk(
					ent[entryProp],
					{
						array: (arr) => {
							for (let i = 0; i < arr.length; ++i) {
								const it = arr[i];
								if (Renderer.hover._REF_TYPES.has(it.type)) {
									toReplaceMetas.push({
										...it,
										array: arr,
										ix: i,
									});
								} else if (typeof it === "string" && it.startsWith("{#") && it.endsWith("}")) {
									toReplaceMetas.push({
										string: it,
										array: arr,
										ix: i,
									});
								}
							}
							return arr;
						},
					},
				);

				let cntReplaces = 0;
				for (let iReplace = 0; iReplace < toReplaceMetas.length; ++iReplace) {
					const toReplaceMeta = Renderer.hover._pDoDereferenceNestedAndCache_getToReplaceMeta(toReplaceMetas[iReplace]);

					switch (toReplaceMeta.type) {
						case "refClassFeature":
						case "refSubclassFeature": {
							const prop = toReplaceMeta.type === "refClassFeature" ? "classFeature" : "subclassFeature";
							const refUnpacked = toReplaceMeta.type === "refClassFeature"
								? DataUtil.class.unpackUidClassFeature(toReplaceMeta.classFeature)
								: DataUtil.class.unpackUidSubclassFeature(toReplaceMeta.subclassFeature);
							const refHash = UrlUtil.URL_TO_HASH_BUILDER[prop](refUnpacked);

							// Skip blacklisted
							if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(refHash, prop, refUnpacked.source, {isNoCount: true})) {
								cntReplaces++;
								toReplaceMeta.array[toReplaceMeta.ix] = {};
								break;
							}

							// Homebrew can e.g. reference cross-file
							const cpy = entriesWithoutRefs[refHash]
								? MiscUtil.copy(entriesWithoutRefs[refHash])
								: Renderer.hover.getFromCache(prop, refUnpacked.source, refHash, {isCopy: true});

							if (cpy) {
								cntReplaces++;
								delete cpy.className;
								delete cpy.classSource;
								delete cpy.subclassShortName;
								delete cpy.subclassSource;
								delete cpy.level;
								delete cpy.header;
								if (ent.source === cpy.source) delete cpy.source;
								if (ent.page === cpy.page) delete cpy.page;
								if (toReplaceMeta.name) cpy.name = toReplaceMeta.name;
								toReplaceMeta.array[toReplaceMeta.ix] = cpy;
							}

							break;
						}

						case "refOptionalfeature": {
							const refUnpacked = DataUtil.generic.unpackUid(toReplaceMeta.optionalfeature, "optfeature");
							const refHash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_OPT_FEATURES](refUnpacked);

							// Skip blacklisted
							if (ExcludeUtil.isInitialised && ExcludeUtil.isExcluded(refHash, "optionalfeature", refUnpacked.source, {isNoCount: true})) {
								cntReplaces++;
								toReplaceMeta.array[toReplaceMeta.ix] = {};
								break;
							}

							const cpy = await Renderer.hover.pCacheAndGetHash(UrlUtil.PG_OPT_FEATURES, refHash, {isCopy: true});
							if (cpy) {
								cntReplaces++;
								delete cpy.featureType;
								delete cpy.prerequisite;
								if (ent.source === cpy.source) delete cpy.source;
								if (ent.page === cpy.page) delete cpy.page;
								if (toReplaceMeta.name) cpy.name = toReplaceMeta.name;
								toReplaceMeta.array[toReplaceMeta.ix] = cpy;
							}

							break;
						}

						case "refItemEntry": {
							const refUnpacked = DataUtil.generic.unpackUid(toReplaceMeta.itemEntry, "itemEntry");
							const refHash = UrlUtil.URL_TO_HASH_BUILDER["itemEntry"](refUnpacked);

							const cpy = await Renderer.hover.pCacheAndGetHash("itemEntry", refHash, {isCopy: true});
							if (cpy) {
								cntReplaces++;

								cpy.entriesTemplate = walkerMod.walk(
									cpy.entriesTemplate,
									{
										string: (str) => {
											return Renderer.utils.applyTemplate(
												ent,
												str,
											);
										},
									},
								);

								toReplaceMeta.array.splice(toReplaceMeta.ix, 1, ...cpy.entriesTemplate);

								// Offset by the length of the array we just merged in (minus one, since we replaced an
								//   element)
								toReplaceMetas.slice(iReplace + 1).forEach(it => it.ix += cpy.entriesTemplate.length - 1);
							}

							break;
						}
					}
				}

				if (cntReplaces === toReplaceMetas.length) {
					delete entriesWithRefs[hash];
					entriesWithoutRefs[hash] = ent;
				}
			}

			cntDerefLoops++;
		}

		Object.values(entriesWithoutRefs).forEach(ent => {
			Renderer.hover._addToCache(page, ent.source, fnGetHash(ent), ent);
		});

		// Add the failed-to-resolve entities to the cache nonetheless
		const entriesWithRefsVals = Object.values(entriesWithRefs);
		if (entriesWithRefsVals.length) {
			// this._handleReferenceError(`Failed to load "subclassFeature" reference "${ent.subclassFeature}"`);
			const missingRefSets = {};
			walker.walk(
				entriesWithRefsVals,
				{
					object: (obj) => {
						switch (obj.type) {
							case "refClassFeature": (missingRefSets["classFeature"] = missingRefSets["classFeature"] || new Set()).add(obj.classFeature); break;
							case "refSubclassFeature": (missingRefSets["subclassFeature"] = missingRefSets["subclassFeature"] || new Set()).add(obj.subclassFeature); break;
							case "refOptionalfeature": (missingRefSets["optionalfeature"] = missingRefSets["optionalfeature"] || new Set()).add(obj.optionalfeature); break;
							case "refItemEntry": (missingRefSets["itemEntry"] = missingRefSets["itemEntry"] || new Set()).add(obj.itemEntry); break;
						}
					},
				},
			);

			const printableRefs = Object.entries(missingRefSets).map(([k, v]) => {
				return `${k}: ${[...v].sort(SortUtil.ascSortLower).join(", ")}`;
			}).join("; ");

			JqueryUtil.doToast({type: "danger", content: `Failed to load references for ${entriesWithRefsVals.length} entr${entriesWithRefsVals.length === 1 ? "y" : "ies"}! Reference types and values were: ${printableRefs}`});
		}

		entriesWithRefsVals.forEach(ent => {
			Renderer.hover._addToCache(page, ent.source, fnGetHash(ent), ent);
		});
	},

	_pDoDereferenceNestedAndCache_getToReplaceMeta (toReplaceMetaRaw) {
		if (toReplaceMetaRaw.string == null) return toReplaceMetaRaw;

		const str = toReplaceMetaRaw.string;
		delete toReplaceMetaRaw.string;
		return {...toReplaceMetaRaw, ...Renderer.hover.getRefMetaFromTag(str)};
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

	async _pCacheAndGet_pLoadOfficialClassAndSubclassFeatures () {
		const lockKey = "classFeature__subclassFeature";
		if (Renderer.hover._flags[lockKey]) return;
		if (!Renderer.hover._locks[lockKey]) Renderer.hover._locks[lockKey] = new VeLock();
		await Renderer.hover._locks[lockKey].pLock();
		if (Renderer.hover._flags[lockKey]) return;

		try {
			const rawClassData = await DataUtil.class.loadRawJSON();

			await Renderer.hover.pDoDereferenceNestedAndCache(rawClassData.classFeature, "classFeature", UrlUtil.URL_TO_HASH_BUILDER["classFeature"]);
			await Renderer.hover.pDoDereferenceNestedAndCache(rawClassData.subclassFeature, "subclassFeature", UrlUtil.URL_TO_HASH_BUILDER["subclassFeature"]);

			Renderer.hover._flags[lockKey] = true;
		} finally {
			Renderer.hover._locks[lockKey].unlock();
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
			case UrlUtil.PG_QUICKREF:
			case UrlUtil.PG_CLASSES: return Renderer.hover.getGenericCompactRenderedString;
			case UrlUtil.PG_SPELLS: return Renderer.spell.getCompactRenderedString;
			case UrlUtil.PG_ITEMS: return Renderer.item.getCompactRenderedString;
			case UrlUtil.PG_BESTIARY: return it => Renderer.monster.getCompactRenderedString(it, null, {isShowScalers: !isStatic, isScaledCr: it._originalCr != null, isScaledSpellSummon: it._isScaledSpellSummon, isScaledClassSummon: it._isScaledClassSummon});
			case UrlUtil.PG_CONDITIONS_DISEASES: return Renderer.condition.getCompactRenderedString;
			case UrlUtil.PG_BACKGROUNDS: return Renderer.background.getCompactRenderedString;
			case UrlUtil.PG_FEATS: return Renderer.feat.getCompactRenderedString;
			case UrlUtil.PG_OPT_FEATURES: return Renderer.optionalfeature.getCompactRenderedString;
			case UrlUtil.PG_PSIONICS: return Renderer.psionic.getCompactRenderedString;
			case UrlUtil.PG_REWARDS: return Renderer.reward.getCompactRenderedString;
			case UrlUtil.PG_RACES: return Renderer.race.getCompactRenderedString;
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
			// region props
			case "classfeature":
			case "classFeature":
				return Renderer.hover.getGenericCompactRenderedString;
			case "subclassfeature":
			case "subclassFeature":
				return Renderer.hover.getGenericCompactRenderedString;
			// endregion
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
			case UrlUtil.PG_LANGUAGES: return Renderer.language.pGetFluff;
			case UrlUtil.PG_VEHICLES: return Renderer.vehicle.pGetFluff;
			case UrlUtil.PG_CHAR_CREATION_OPTIONS: return Renderer.charoption.pGetFluff;
			case UrlUtil.PG_RECIPES: return Renderer.recipe.pGetFluff;
			default: return null;
		}
	},

	isSmallScreen (evt) {
		evt = evt || {};
		const win = (evt.view || {}).window || window;
		return win.innerWidth <= 768;
	},

	/**
	 * @param $btnPop
	 * @param toList
	 * @param [opts]
	 * @param [opts.handlerGenerator]
	 * @param [opts.title]
	 * @param [opts.fnGetToRender]
	 */
	bindPopoutButton ($btnPop, toList, opts) {
		opts = opts || {};

		$btnPop
			.off("click")
			.title(opts.title || "Popout Window (SHIFT for Source Data)");

		$btnPop.on(
			"click",
			opts.handlerGenerator
				? opts.handlerGenerator(toList)
				: (evt) => {
					if (Hist.lastLoadedId !== null) {
						const toRender = opts.fnGetToRender ? opts.fnGetToRender() : toList[Hist.lastLoadedId];

						if (evt.shiftKey) {
							const $content = Renderer.hover.$getHoverContent_statsCode(toRender);
							Renderer.hover.getShowWindow(
								$content,
								Renderer.hover.getWindowPositionFromEvent(evt),
								{
									title: `${toRender.name} \u2014 Source Data`,
									isPermanent: true,
									isBookContent: true,
								},
							);
						} else {
							Renderer.hover.doPopoutCurPage(evt, toRender);
						}
					}
				},
		);
	},

	/**
	 * @param page
	 * @param toRender
	 * @param [opts]
	 * @param [opts.isBookContent]
	 * @param [opts.isStatic] If this content is to be "static," i.e. display only, containing minimal interactive UI.
	 * @param [renderFnOpts]
	 */
	$getHoverContent_stats (page, toRender, opts, renderFnOpts) {
		opts = opts || {};
		if (page === UrlUtil.PG_RECIPES) opts = {...MiscUtil.copy(opts), isBookContent: true};

		const renderFn = Renderer.hover.getFnRenderCompact(page, {isStatic: opts.isStatic});
		return $$`<table class="stats ${opts.isBookContent ? `stats--book` : ""}">${renderFn(toRender, renderFnOpts)}</table>`;
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
		if (page === UrlUtil.PG_RECIPES) opts = {...MiscUtil.copy(opts), isBookContent: true};

		if (!toRender) {
			return $$`<table class="stats ${opts.isBookContent ? `stats--book` : ""}"><tr class="text"><td colspan="6" class="p-2 text-center">${Renderer.utils.HTML_NO_INFO}</td></tr></table>`;
		}

		toRender = MiscUtil.copy(toRender);

		if (toRender.images && toRender.images.length) {
			const cachedImages = MiscUtil.copy(toRender.images);
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

		return $$`<table class="stats ${opts.isBookContent ? `stats--book` : ""}">${Renderer.generic.getCompactRenderedString(toRender, renderFnOpts)}</table>`;
	},

	$getHoverContent_statsCode (toRender) {
		const cleanCopy = DataUtil.cleanJson(MiscUtil.copy(toRender));
		return Renderer.hover.$getHoverContent_miscCode(
			`${cleanCopy.name} \u2014 Source Data`,
			JSON.stringify(cleanCopy, null, "\t"),
		);
	},

	$getHoverContent_miscCode (name, code) {
		const toRenderCode = {
			type: "code",
			name,
			preformatted: code,
		};
		return $$`<table class="stats stats--book">${Renderer.get().render(toRenderCode)}</table>`;
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

		return $$`<table class="stats ${opts.isBookContent || opts.isLargeBookContent ? "stats--book" : ""} ${opts.isLargeBookContent ? "stats--book-large" : ""}">${Renderer.hover.getGenericCompactRenderedString(toRender, opts.depth || 0)}</table>`;
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
 * @param [opts.typeBlacklist] A set of entry types to avoid.
 */
Renderer.getNames = function (nameStack, entry, opts) {
	opts = opts || {};
	if (opts.maxDepth == null) opts.maxDepth = false;
	if (opts.depth == null) opts.depth = 0;

	if (opts.typeBlacklist && entry.type && opts.typeBlacklist.has(entry.type)) return;

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
Renderer.findName = function (entry) { return CollectionUtil.dfs(entry, "name"); };
Renderer.findSource = function (entry) { return CollectionUtil.dfs(entry, "source"); };

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
				text = text.replace(/<\$([^$]+)\$>/gi, ""); // remove any variable tags
				switch (tag) {
					case "@b":
					case "@bold":
					case "@i":
					case "@italic":
					case "@s":
					case "@strike":
					case "@u":
					case "@underline":
						return text;

					case "@h": return "Hit: ";

					case "@dc": return `DC ${text}`;

					case "@atk": return Renderer.attackTagToFull(text);

					case "@chance":
					case "@d20":
					case "@damage":
					case "@dice":
					case "@hit":
					case "@recharge":
					case "@ability":
					case "@savingThrow":
					case "@skillCheck": {
						const [rollText, displayText] = Renderer.splitTagByPipe(text);
						switch (tag) {
							case "@damage":
							case "@dice": {
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
								const [abil, rawScore] = rollText.split(" ").map(it => it.trim().toLowerCase()).filter(Boolean);
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

					case "@scaledice":
					case "@scaledamage": {
						const [baseRoll, progression, addPerProgress, renderMode] = Renderer.splitTagByPipe(text);
						return addPerProgress;
					}

					case "@hitYourSpellAttack": return "your spell attack modifier";

					case "@comic":
					case "@comicH1":
					case "@comicH2":
					case "@comicH3":
					case "@comicH4":
					case "@comicNote":
					case "@note":
					case "@sense":
					case "@skill": {
						return text;
					}

					case "@5etools":
					case "@adventure":
					case "@book":
					case "@filter":
					case "@footnote":
					case "@link":
					case "@loader":
					case "@color":
					case "@highlight":
					case "@help": {
						const parts = Renderer.splitTagByPipe(text);
						return parts[0];
					}

					case "@area": {
						const [compactText, areaId, flags, ...others] = Renderer.splitTagByPipe(text);

						return flags && flags.includes("x")
							? compactText
							: `${flags && flags.includes("u") ? "A" : "a"}rea ${compactText}`;
					}

					case "@action":
					case "@background":
					case "@boon":
					case "@charoption":
					case "@class":
					case "@condition":
					case "@creature":
					case "@cult":
					case "@disease":
					case "@feat":
					case "@hazard":
					case "@item":
					case "@language":
					case "@object":
					case "@optfeature":
					case "@psionic":
					case "@race":
					case "@recipe":
					case "@reward":
					case "@vehicle":
					case "@vehupgrade":
					case "@spell":
					case "@status":
					case "@table":
					case "@trap":
					case "@variantrule": {
						const parts = Renderer.splitTagByPipe(text);
						return parts.length >= 3 ? parts[2] : parts[0];
					}

					case "@deity": {
						const parts = Renderer.splitTagByPipe(text);
						return parts.length >= 4 ? parts[3] : parts[0];
					}

					case "@classFeature": {
						const parts = Renderer.splitTagByPipe(text);
						return parts.length >= 6 ? parts[5] : parts[0];
					}

					case "@subclassFeature": {
						const parts = Renderer.splitTagByPipe(text);
						return parts.length >= 8 ? parts[7] : parts[0];
					}

					case "@homebrew": {
						const [newText, oldText] = Renderer.splitTagByPipe(text);
						if (newText && oldText) {
							return `${newText} [this is a homebrew addition, replacing the following: "${oldText}"]`;
						} else if (newText) {
							return `${newText} [this is a homebrew addition]`;
						} else if (oldText) {
							return `[the following text has been removed due to homebrew: ${oldText}]`;
						} else throw new Error(`Homebrew tag had neither old nor new text!`);
					}

					default: throw new Error(`Unhandled tag: "${tag}"`);
				}
			} else return it;
		}).join("");
	} return str;
};

Renderer.getAutoConvertedTableRollMode = function (table) {
	if (!table.colLabels || table.colLabels.length < 2) return RollerUtil.ROLL_COL_NONE;

	const rollColMode = RollerUtil.getColRollType(table.colLabels[0]);
	if (!rollColMode) return RollerUtil.ROLL_COL_NONE;

	// scan the first column to ensure all rollable
	if (table.rows.some(it => {
		try {
			if (typeof it[0] === "number" && Number.isInteger(it[0])) return false;
			// u2012 = figure dash; u2013 = en-dash
			return typeof it[0] !== "string" || !/^\d+([-\u2012\u2013]\d+)?/.exec(it[0]);
		} catch (e) {
			return true;
		}
	})) return RollerUtil.ROLL_COL_NONE;

	return rollColMode;
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
	row = MiscUtil.copy(row);
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
	} catch (e) { if (opts.cbErr) opts.cbErr(row[0], e); }
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
	function onIntersection (obsEntries) {
		obsEntries.forEach(entry => {
			if (entry.intersectionRatio > 0) { // filter observed entries for those that intersect
				Renderer._imageObserver.unobserve(entry.target);
				const $img = $(entry.target);
				$img.attr("src", $img.attr("data-src")).removeAttr("data-src");
			}
		});
	}

	let printListener = null;
	const $images = $(`img[data-src]`);
	const config = {
		rootMargin: "150px 0px", // if the image gets within 150px of the viewport
		threshold: 0.01,
	};

	if (Renderer._imageObserver) {
		Renderer._imageObserver.disconnect();
		window.removeEventListener("beforeprint", printListener);
	}

	Renderer._imageObserver = new IntersectionObserver(onIntersection, config);
	$images.each((i, image) => Renderer._imageObserver.observe(image));

	// If we try to print a page with un-loaded images, attempt to load them all first
	printListener = () => {
		alert(`All images in the page will now be loaded. This may take a while.`);
		$images.each((i, image) => {
			Renderer._imageObserver.unobserve(image);
			const $img = $(image);
			$img.attr("src", $img.attr("data-src")).removeAttr("data-src");
		});
	};
	window.addEventListener("beforeprint", printListener);
};
Renderer._imageObserver = null;

Renderer.HEAD_NEG_1 = "rd__b--0";
Renderer.HEAD_0 = "rd__b--1";
Renderer.HEAD_1 = "rd__b--2";
Renderer.HEAD_2 = "rd__b--3";
Renderer.HEAD_2_SUB_VARIANT = "rd__b--4";
Renderer.DATA_NONE = "data-none";

if (typeof module !== "undefined") {
	module.exports.Renderer = Renderer;
	global.Renderer = Renderer;
}

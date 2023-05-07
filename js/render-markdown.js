"use strict";

// TODO implement remaining methods
class RendererMarkdown {
	static async pInit () {
		const settings = await StorageUtil.pGet("bookViewSettingsMarkdown") || Object.entries(RendererMarkdown._CONFIG).mergeMap(([k, v]) => ({[k]: v.default}));
		Object.assign(RendererMarkdown, settings);
		RendererMarkdown._isInit = true;
	}

	static checkInit () {
		if (!RendererMarkdown._isInit) throw new Error(`RendererMarkdown has not been initialised!`);
	}

	getLineBreak () { return "\n"; }

	constructor () {
		// FIXME this is awful
		const renderer = new Renderer();
		this.__super = {};
		for (const k in renderer) {
			if (this[k] === undefined) {
				if (typeof renderer[k] === "function") this[k] = renderer[k].bind(this);
				else this[k] = MiscUtil.copy(renderer[k]);
			} else {
				if (typeof renderer[k] === "function") this.__super[k] = renderer[k].bind(this);
				else this.__super[k] = MiscUtil.copy(renderer[k]);
			}
		}

		this._isSkipStylingItemLinks = false;
	}

	set isSkipStylingItemLinks (val) { this._isSkipStylingItemLinks = val; }

	static get () {
		RendererMarkdown.checkInit();

		return new RendererMarkdown().setFnPostProcess(RendererMarkdown._fnPostProcess);
	}

	static _fnPostProcess (str) {
		return str
			.trim()
			.replace(/\n\n+/g, "\n\n")
			.replace(/(>\n>\n)+/g, ">\n");
	}

	static _getNextPrefix (options, prefix) {
		return options.prefix === ">" || options.prefix === ">>" ? `${options.prefix}${prefix || ""}` : prefix || "";
	}

	// region recursive
	/*
	_renderEntries (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderEntriesSubtypes (entry, textStack, meta, options, incDepth) {
		const isInlineTitle = meta.depth >= 2;
		const nextDepth = incDepth && meta.depth < 2 ? meta.depth + 1 : meta.depth;

		const nxtPrefix = RendererMarkdown._getNextPrefix(options);
		if (entry.name) {
			if (isInlineTitle) {
				textStack[0] += `${nxtPrefix}***${Renderer.stripTags(entry.name)}.*** `;
			} else {
				const hashCount = meta._typeStack.length === 1 && meta.depth === -1 ? 1 : Math.min(6, meta.depth + 3);
				textStack[0] += `\n${nxtPrefix}${"#".repeat(hashCount)} ${Renderer.stripTags(entry.name)}\n\n`;
			}
		}

		if (entry.entries) {
			this._renderEntriesSubtypes_renderPreReqText(entry, textStack, meta);
			const cacheDepth = meta.depth;
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				meta.depth = nextDepth;
				const isFirstInline = i === 0 && entry.name && isInlineTitle;
				const suffix = meta.isStatblockInlineMonster ? `  \n` : `\n\n`;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: isFirstInline ? "" : RendererMarkdown._getNextPrefix(options), suffix});
			}
			if (meta.isStatblockInlineMonster) textStack[0] += "\n";
			meta.depth = cacheDepth;
		}
	}

	_renderEntriesSubtypes_renderPreReqText (entry, textStack, meta) {
		if (entry.prerequisite) {
			textStack[0] += `*Prerequisite: `;
			this._recursiveRender({type: "inline", entries: [entry.prerequisite]}, textStack, meta);
			textStack[0] += `*\n\n`;
		}
	}

	/*
	_renderOptions (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderList (entry, textStack, meta, options) {
		if (!entry.items) return;

		if (textStack[0] && textStack[0].slice(-1) !== "\n") textStack[0] += "\n";

		const listDepth = Math.max(meta._typeStack.filter(it => it === "list").length - 1, 0);

		if (entry.name) textStack[0] += `##### ${entry.name}`;
		const indentSpaces = "  ".repeat(listDepth);
		const len = entry.items.length;

		// Special formatting for spellcasting lists (data attrib added by main renderer spellcasting -> entries)
		if (entry.data && entry.data.isSpellList) {
			textStack[0] += `${RendererMarkdown._getNextPrefix(options)}\n`;
			for (let i = 0; i < len; ++i) {
				textStack[0] += `${RendererMarkdown._getNextPrefix(options)}${indentSpaces}`;
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(entry.items[i], textStack, meta, {suffix: "\n"});
				meta.depth = cacheDepth;
			}
		} else {
			for (let i = 0; i < len; ++i) {
				const item = entry.items[i];
				// Special case for child lists -- avoid double-hyphen-prefixing
				textStack[0] += `${RendererMarkdown._getNextPrefix(options)}${indentSpaces}${item.type === "list" ? "" : `- `}`;

				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(entry.items[i], textStack, meta, {suffix: "\n"});
				if (textStack[0].slice(-2) === "\n\n") textStack[0] = textStack[0].slice(0, -1);
				meta.depth = cacheDepth;
			}
		}

		textStack[0] += "\n";
	}

	_renderTable (entry, textStack, meta, options) {
		if (entry.intro) for (const ent of entry.intro) this._recursiveRender(ent, textStack, meta);

		textStack[0] += "\n";

		if (entry.caption) textStack[0] += `##### ${entry.caption}\n`;

		const headerRowMetas = Renderer.table.getHeaderRowMetas(entry);

		const hasLabels = headerRowMetas != null;
		// If there's no data, render a stub table.
		if (!hasLabels && (!entry.rows || !entry.rows.length)) {
			textStack[0] += `|   |\n`;
			textStack[0] += `|---|\n`;
			textStack[0] += `|   |\n`;
			return;
		}

		// Labels are required for Markdown tables
		let labelRows = MiscUtil.copyFast(headerRowMetas || []);
		if (!hasLabels) {
			const numCells = Math.max(...entry.rows.map(r => r.length));
			labelRows = [
				[...new Array(numCells)].map(() => ""),
			];
		}

		// Pad labels to style width
		if (entry.colStyles) {
			labelRows
				.filter(labelRow => labelRow.length < entry.colStyles.length)
				.forEach(labelRow => {
					labelRow.push(
						...[...new Array(entry.colStyles.length - labelRow.length)].map(() => ""),
					);
				});
		}

		// region Prepare styles
		let styles = null;
		if (entry.colStyles) {
			styles = [...entry.colStyles];
			// Pad styles to label width
			labelRows
				.forEach(labelRow => {
					if (labelRow.length > styles.length) {
						styles = styles.concat([...new Array(labelRow.length - styles.length)].map(() => ""));
					}
				});
		}
		// endregion

		const mdHeaderRows = labelRows.map(labelRow => labelRow.map(label => ` ${Renderer.stripTags(label)} `));

		// Get per-cell max width
		const widths = [
			...new Array(
				Math.max(...mdHeaderRows.map(mdHeaderRow => mdHeaderRow.length)),
			),
		]
			.map((_, i) => Math.max(...mdHeaderRows.map(mdHeaderRow => (mdHeaderRow[i] || "").length)));

		// region Build 2d array of table cells
		const mdTable = [];

		const numRows = entry.rows.length;
		for (let ixRow = 0; ixRow < numRows; ++ixRow) {
			const row = entry.rows[ixRow];

			const rowRender = row.type === "row" ? row.row : row;

			const numCells = rowRender.length;
			for (let ixCell = 0; ixCell < numCells; ++ixCell) {
				const cell = rowRender[ixCell];

				let toRenderCell;

				if (cell.type === "cell") {
					if (cell.roll) {
						if (cell.roll.entry) toRenderCell = cell.roll.entry;
						else if (cell.roll.exact != null) toRenderCell = cell.roll.pad ? StrUtil.padNumber(cell.roll.exact, 2, "0") : cell.roll.exact;
						else {
							toRenderCell = cell.roll.pad
								? `${StrUtil.padNumber(cell.roll.min, 2, "0")}-${StrUtil.padNumber(cell.roll.max, 2, "0")}`
								: `${cell.roll.min}-${cell.roll.max}`;
						}
					} else if (cell.entry) {
						toRenderCell = cell.entry;
					}
				} else {
					toRenderCell = cell;
				}

				const textStackCell = [""];
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(toRenderCell, textStackCell, meta);
				meta.depth = cacheDepth;

				const mdCell = ` ${textStackCell.join("").trim()} `
					// Markdown tables can't handle multi-line cells, so HTML linebreaks must be used
					.split(/\n+/)
					.join("<br>");

				widths[ixCell] = Math.max(widths[ixCell] || 0, mdCell.length);
				(mdTable[ixRow] = mdTable[ixRow] || [])[ixCell] = mdCell;
			}
		}
		// endregion

		const mdHeaderRowsPadded = mdHeaderRows
			.map(mdHeaderRow => {
				return mdHeaderRow
					.map((header, ixCell) => RendererMarkdown._md_getPaddedTableText({text: header, width: widths[ixCell], ixCell, styles}));
			});

		// region Build style headers
		const mdStyles = [];
		if (styles) {
			styles.forEach((style, i) => {
				const w = widths[i];

				if (style.includes("text-center")) mdStyles.push(`:${"-".repeat(Math.max(w - 2, 3))}:`);
				else if (style.includes("text-right")) mdStyles.push(`${"-".repeat(Math.max(w - 1, 3))}:`);
				else mdStyles.push("-".repeat(Math.max(w, 3)));
			});
		}
		// endregion

		// region Assemble the table
		for (const mdHeaderRowPadded of mdHeaderRowsPadded) {
			textStack[0] += `|${mdHeaderRowPadded.join("|")}|\n`;
		}
		if (mdStyles.length) textStack[0] += `|${mdStyles.join("|")}|\n`;
		for (const mdRow of mdTable) {
			textStack[0] += "|";

			const numCells = mdRow.length;
			for (let ixCell = 0; ixCell < numCells; ++ixCell) {
				textStack[0] += RendererMarkdown._md_getPaddedTableText({text: mdRow[ixCell], width: widths[ixCell], ixCell, styles});
				textStack[0] += "|";
			}

			textStack[0] += "\n";
		}
		// endregion

		if (entry.footnotes) {
			for (const ent of entry.footnotes) {
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(ent, textStack, meta);
				meta.depth = cacheDepth;
			}
		}
		if (entry.outro) for (const ent of entry.outro) this._recursiveRender(ent, textStack, meta);

		if (!entry.rows) {
			textStack[0] += `||\n`;
			return;
		}

		textStack[0] += "\n";
	}

	static _md_getPaddedTableText ({text, width, ixCell, styles}) {
		if (text.length >= width) return text;

		if (styles?.[ixCell]?.includes("text-center")) return text.padStart(Math.floor((width - text.length) / 2) + text.length, " ").padEnd(width, " ");
		if (styles?.[ixCell]?.includes("text-right")) return text.padStart(width, " ");
		return text.padEnd(width, " ");
	}

	/*
	_renderTableGroup (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderInset (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `> ##### ${entry.name}\n>\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: ">", suffix: "\n>\n"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `\n`;
	}

	_renderInsetReadaloud (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `>> ##### ${entry.name}\n>>\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: ">>", suffix: "\n>>\n"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `\n`;
	}

	_renderVariant (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `> ##### Variant: ${entry.name}\n>\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: ">", suffix: "\n>\n"});
				meta.depth = cacheDepth;
			}
		}
		if (entry.source) textStack[0] += `>${RendererMarkdown.utils.getPageText({source: entry.source, page: entry.page})}\n`;
		textStack[0] += "\n";
	}

	_renderVariantSub (entry, textStack, meta, options) {
		if (entry.name) textStack[0] += `*${entry.name}.* `;

		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: RendererMarkdown._getNextPrefix(options), suffix: "\n>\n"});
			}
		}
	}

	_renderSpellcasting (entry, textStack, meta, options) {
		const toRender = this._renderSpellcasting_getEntries(entry);
		this._recursiveRender({type: "entries", entries: toRender}, textStack, meta, {prefix: RendererMarkdown._getNextPrefix(options), suffix: "\n"});
	}

	_renderQuote (entry, textStack, meta, options) {
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: RendererMarkdown._getNextPrefix(options, "*"), suffix: "*"});
			if (i !== entry.entries.length - 1) textStack[0] += `\n\n`;
		}
		const byArr = this._renderQuote_getBy(entry);
		if (byArr) {
			const tempStack = [""];
			for (let i = 0, len = byArr.length; i < len; ++i) {
				const by = byArr[i];
				this._recursiveRender(by, tempStack, meta);
				if (i < len - 1) tempStack[0] += "\n";
			}
			textStack[0] += `\u2014 ${tempStack.join("")}${entry.from ? `, *${entry.from}*` : ""}`;
		}
	}

	/*
	_renderOptfeature (entry, textStack, meta, options) {
		// (Use base implementation)
	}

	_renderPatron (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	// endregion
	*/

	// region block
	_renderAbilityDc (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `**${entry.name} save DC** = 8 + your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}`;
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderAbilityAttackMod (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `**${entry.name} attack modifier** = your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}`;
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderAbilityGeneric (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `${entry.name ? `**${entry.name}**  = ` : ""}${entry.text}${entry.attributes ? ` ${Parser.attrChooseToFull(entry.attributes)}` : ""}`;
		this._renderSuffix(entry, textStack, meta, options);
	}
	// endregion

	/*
	// region inline
	_renderInline (entry, textStack, meta, options) {
		// (Use base implementation)
	}

	_renderInlineBlock (entry, textStack, meta, options) {
		// (Use base implementation)
	}

	_renderBonus (entry, textStack, meta, options) {
		// (Use base implementation)
	}

	_renderBonusSpeed (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderDice (entry, textStack, meta, options) {
		textStack[0] += Renderer.getEntryDiceDisplayText(entry, entry.name);
	}

	_renderLink (entry, textStack, meta, options) {
		const href = this._renderLink_getHref(entry);
		textStack[0] += `[${href}](${this.render(entry.text)})`;
	}

	/*
	_renderActions (entry, textStack, meta, options) {
		// TODO
	}

	_renderAttack (entry, textStack, meta, options) {
		// TODO
	}

	_renderIngredient (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	// endregion

	*/
	// region list items
	_renderItem (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `**${this.render(entry.name)}** `;
		let addedNewline = false;
		if (entry.entry) this._recursiveRender(entry.entry, textStack, meta);
		else if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const nxtPrefix = RendererMarkdown._getNextPrefix(options, i > 0 ? "  " : "");
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: nxtPrefix, suffix: "\n"});
			}
			addedNewline = true;
		}
		if (!addedNewline) textStack[0] += "\n";
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderItemSub (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		const nxtPrefix = RendererMarkdown._getNextPrefix(options, `*${this.render(entry.name)}* `);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: nxtPrefix, suffix: "\n"});
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderItemSpell (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: RendererMarkdown._getNextPrefix(options, `${entry.name} `), suffix: "  \n"});
		this._renderSuffix(entry, textStack, meta, options);
	}
	// endregion

	// region embedded entities
	/**
	 * Note that unlike the HTML equivalent, this cannot async defer rendering by leveraging the DOM. Therefore, any
	 * inline data passed to this method is assumed to be complete, i.e., require no further loading or mutating.
	 */
	_renderStatblockInline (entry, textStack, meta, options) {
		const fnGetRenderCompact = RendererMarkdown.hover.getFnRenderCompact(entry.dataType);

		if (!fnGetRenderCompact) {
			this._renderPrefix(entry, textStack, meta, options);
			textStack[0] += `**Cannot render "${entry.type}"\u2014unknown type "${entry.dataType}"!**\n`;
			this._renderSuffix(entry, textStack, meta, options);
			return;
		}

		this._renderPrefix(entry, textStack, meta, options);
		// Pass `entry` here to allow e.g. `legendaryGroup` to be included when rendering creatures
		textStack[0] += fnGetRenderCompact(entry.data, {...entry, meta});
		this._renderSuffix(entry, textStack, meta, options);
	}

	/*
	_renderStatblock (entry, textStack, meta, options) {
		// TODO assume the entity is pre-cached, and sync fetch it from the cache?
	}
	*/
	// endregion

	// region images
	_renderImage (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		const href = this._renderImage_getUrl(entry);
		textStack[0] += `![${entry.title || ""}](${href})`;
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderGallery (entry, textStack, meta, options) {
		const len = entry.images.length;
		for (let i = 0; i < len; ++i) {
			const img = MiscUtil.copyFast(entry.images[i]);
			this._recursiveRender(img, textStack, meta);
		}
	}
	// endregion

	// region flowchart
	_renderFlowchart (entry, textStack, meta, options) {
		const len = entry.blocks.length;
		for (let i = 0; i < len; ++i) {
			this._recursiveRender(entry.blocks[i], textStack, meta, options);
		}
	}

	_renderFlowBlock (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `> ##### ${entry.name}\n>\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: ">", suffix: "\n>\n"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `\n`;
	}
	// endregion

	// region homebrew
	_renderHomebrew (entry, textStack, meta, options) {
		if (entry.oldEntries) {
			let markerText;
			if (entry.movedTo) {
				markerText = "*Homebrew:* The following content has been moved:";
			} else if (entry.entries) {
				markerText = "*Homebrew:* The following content has been replaced:";
			} else {
				markerText = "*Homebrew:* The following content has been removed:";
			}

			textStack[0] += `##### ${markerText}\n`;
			this._recursiveRender({type: "entries", entries: entry.oldEntries}, textStack, meta, {suffix: "\n"});
		}

		if (entry.entries) {
			const len = entry.entries.length;
			if (entry.oldEntries) textStack[0] += `*The replacement is as follows:*\n`;
			for (let i = 0; i < len; ++i) this._recursiveRender(entry.entries[i], textStack, meta, {suffix: "\n"});
		} else if (entry.movedTo) {
			textStack[0] += `*This content has been moved to ${entry.movedTo}.*\n`;
		} else {
			textStack[0] += "*This content has been deleted.*\n";
		}
	}
	// endregion

	// region misc
	_renderCode (entry, textStack, meta, options) {
		textStack[0] += "\n```\n";
		textStack[0] += entry.preformatted;
		textStack[0] += "\n```\n";
	}

	_renderHr (entry, textStack, meta, options) {
		textStack[0] += `\n---\n`;
	}
	// endregion

	// region primitives
	_renderString (entry, textStack, meta, options) {
		switch (RendererMarkdown._tagRenderMode || 0) {
			// render tags where possible
			case 0: {
				this._renderString_renderMode0(entry, textStack, meta, options);
				break;
			}
			// leave tags as-is
			case 1: {
				textStack[0] += entry;
				break;
			}
			// strip tags
			case 2: {
				textStack[0] += Renderer.stripTags(entry);
				break;
			}
		}
	}

	_renderString_renderMode0 (entry, textStack, meta, options) {
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
	}

	_renderString_renderTag (textStack, meta, options, tag, text) {
		switch (tag) {
			// BASIC STYLES/TEXT ///////////////////////////////////////////////////////////////////////////////
			case "@b":
			case "@bold":
				textStack[0] += `**`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `**`;
				break;
			case "@i":
			case "@italic":
				textStack[0] += `*`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `*`;
				break;
			case "@s":
			case "@strike":
				textStack[0] += `~~`;
				this._recursiveRender(text, textStack, meta);
				textStack[0] += `~~`;
				break;
			case "@atk": textStack[0] += `*${Renderer.attackTagToFull(text)}*`; break;
			case "@h": textStack[0] += `*Hit:* `; break;

			// DCs /////////////////////////////////////////////////////////////////////////////////////////////
			case "@dc": {
				const [dcText, displayText] = Renderer.splitTagByPipe(text);
				textStack[0] += `DC ${displayText || dcText}`;
				break;
			}

			// DICE ////////////////////////////////////////////////////////////////////////////////////////////
			case "@dice":
			case "@damage":
			case "@hit":
			case "@d20":
			case "@chance":
			case "@recharge":
			case "@coinflip":
				textStack[0] += Renderer.stripTags(`{${tag} ${text}}`); break;

			// SCALE DICE //////////////////////////////////////////////////////////////////////////////////////
			case "@scaledice":
			case "@scaledamage":
				textStack[0] += Renderer.stripTags(`{${tag} ${text}}`); break;

			// LINKS ///////////////////////////////////////////////////////////////////////////////////////////
			case "@filter":
				textStack[0] += Renderer.stripTags(`{${tag} ${text}}`); break;

			case "@link":
			case "@5etools":
				this.__super._renderString_renderTag(textStack, meta, options, tag, text); break;

			// OTHER HOVERABLES ////////////////////////////////////////////////////////////////////////////////
			case "@footnote":
			case "@homebrew":
			case "@skill":
			case "@sense":
			case "@area":
				textStack[0] += Renderer.stripTags(`{${tag} ${text}}`); break;

			// HOMEBREW LOADING ////////////////////////////////////////////////////////////////////////////////
			case "@loader": {
				// FIXME this does not respect the user's homebrew base URL setting
				const {name, path} = this._renderString_getLoaderTagMeta(text, {isDefaultUrl: true});
				textStack[0] += `[${name}](${path})`;
				break;
			}

			// CONTENT TAGS ////////////////////////////////////////////////////////////////////////////////////
			case "@book":
			case "@adventure":
				textStack[0] += `*${Renderer.stripTags(`{${tag} ${text}}`)}*`; break;

			case "@deity":
				textStack[0] += `**${Renderer.stripTags(`{${tag} ${text}}`)}**`; break;

			default: {
				switch (tag) {
					case "@item": {
						if (this._isSkipStylingItemLinks) textStack[0] += `${Renderer.stripTags(`{${tag} ${text}}`)}`;
						else textStack[0] += `*${Renderer.stripTags(`{${tag} ${text}}`)}*`;
						break;
					}

					case "@spell":
					case "@psionic":
						textStack[0] += `*${Renderer.stripTags(`{${tag} ${text}}`)}*`; break;
					case "@creature":
						textStack[0] += `**${Renderer.stripTags(`{${tag} ${text}}`)}**`; break;
					default:
						textStack[0] += Renderer.stripTags(`{${tag} ${text}}`); break;
				}
			}
		}
	}

	_renderPrimitive (entry, textStack, meta, options) { textStack[0] += `${entry}`; }
	// endregion

	// region Static options
	static async pShowSettingsModal () {
		RendererMarkdown.checkInit();

		const {$modalInner} = UiUtil.getShowModal({
			title: "Markdown Settings",
			cbClose: () => RendererMarkdown.__$wrpSettings.detach(),
		});
		if (!RendererMarkdown.__$wrpSettings) {
			const _compMarkdownSettings = BaseComponent.fromObject({
				_tagRenderMode: RendererMarkdown._tagRenderMode,
				_isAddColumnBreaks: RendererMarkdown._isAddColumnBreaks,
			});
			const compMarkdownSettings = _compMarkdownSettings.getPod();
			const saveMarkdownSettingsDebounced = MiscUtil.debounce(() => StorageUtil.pSet("bookViewSettingsMarkdown", _compMarkdownSettings.toObject()), 100);
			compMarkdownSettings.addHookAll(() => {
				Object.assign(RendererMarkdown, compMarkdownSettings.getState());
				saveMarkdownSettingsDebounced();
			});

			const $rows = Object.entries(RendererMarkdown._CONFIG)
				.map(([k, v]) => {
					let $ipt;
					switch (v.type) {
						case "boolean": {
							$ipt = ComponentUiUtil.$getCbBool(_compMarkdownSettings, k).addClass("mr-1");
							break;
						}
						case "enum": {
							$ipt = ComponentUiUtil.$getSelEnum(_compMarkdownSettings, k, {values: v.values, fnDisplay: v.fnDisplay});
							break;
						}
						default: throw new Error(`Unhandled input type!`);
					}

					return $$`<div class="m-1 stripe-even"><label class="split-v-center">
						<div class="w-100 mr-2">${v.name}</div>
						${$ipt.addClass("max-w-33")}
					</label></div>`;
				});

			RendererMarkdown.__$wrpSettings = $$`<div class="ve-flex-v-col w-100 h-100">${$rows}</div>`;
		}
		RendererMarkdown.__$wrpSettings.appendTo($modalInner);
	}
	// endregion

	static getSetting (key) { return this[`_${key}`]; }
}
RendererMarkdown._isInit = false;
RendererMarkdown.CHARS_PER_PAGE = 5500;
RendererMarkdown.__$wrpSettings = null;
RendererMarkdown._TAG_RENDER_MODES = ["Convert to Markdown", "Leave As-Is", "Convert to Text"];
RendererMarkdown._CONFIG = {
	_tagRenderMode: {default: 0, name: "Tag Handling (<code>@tag</code>)", fnDisplay: ix => RendererMarkdown._TAG_RENDER_MODES[ix], type: "enum", values: [0, 1, 2]},
	_isAddColumnBreaks: {default: false, name: "Add GM Binder Column Breaks (<code>\\columnbreak</code>)", type: "boolean"},
	_isAddPageBreaks: {default: false, name: "Add GM Binder Page Breaks (<code>\\pagebreak</code>)", type: "boolean"},
};

if (typeof window !== "undefined") window.addEventListener("load", () => RendererMarkdown.pInit());

RendererMarkdown.utils = class {
	static getPageText (it) {
		const sourceSub = Renderer.utils.getSourceSubText(it);
		const baseText = Renderer.utils.isDisplayPage(it.page) ? `**Source:** *${Parser.sourceJsonToAbv(it.source)}${sourceSub}*, page ${it.page}` : "";
		const addSourceText = this._getPageText_getAltSourceText(it, "additionalSources", "Additional information from");
		const otherSourceText = this._getPageText_getAltSourceText(it, "otherSources", "Also found in");
		const externalSourceText = this._getPageText_getAltSourceText(it, "externalSources", "External sources:");

		return `${[baseText, addSourceText, otherSourceText, externalSourceText].filter(it => it).join(". ")}${baseText && (addSourceText || otherSourceText || externalSourceText) ? "." : ""}`;
	}

	static _getPageText_getAltSourceText (it, prop, introText) {
		if (!it[prop] || !it[prop].length) return "";

		return `${introText} ${it[prop].map(as => {
			if (as.entry) return Renderer.get().render(as.entry);
			else return `*${Parser.sourceJsonToAbv(as.source)}*${Renderer.utils.isDisplayPage(as.page) ? `, page ${as.page}` : ""}`;
		}).join("; ")}`;
	}
};

RendererMarkdown.monster = class {
	static getCompactRenderedString (mon, opts = {}) {
		const legendaryGroup = opts.legendaryGroup;
		const meta = opts.meta || {};

		let addedStatblockInline;
		if (!meta.isStatblockInlineMonster) {
			meta.isStatblockInlineMonster = true;
			addedStatblockInline = true;
		}

		const monTypes = Parser.monTypeToFullObj(mon.type);
		RendererMarkdown.get().isSkipStylingItemLinks = true;
		const acPart = Parser.acToFull(mon.ac, RendererMarkdown.get());
		RendererMarkdown.get().isSkipStylingItemLinks = false;
		const resourcePart = mon.resource?.length
			? mon.resource
				.map(res => `\n>- **${res.name}** ${Renderer.monster.getRenderedResource(res, true)}`)
				.join("")
			: "";
		const savePart = mon.save ? `\n>- **Saving Throws** ${Object.keys(mon.save).sort(SortUtil.ascSortAtts).map(it => RendererMarkdown.monster.getSave(it, mon.save[it])).join(", ")}` : "";
		const skillPart = mon.skill ? `\n>- **Skills** ${RendererMarkdown.monster.getSkillsString(mon)}` : "";
		const damVulnPart = mon.vulnerable ? `\n>- **Damage Vulnerabilities** ${Parser.getFullImmRes(mon.vulnerable)}` : "";
		const damResPart = mon.resist ? `\n>- **Damage Resistances** ${Parser.getFullImmRes(mon.resist)}` : "";
		const damImmPart = mon.immune ? `\n>- **Damage Immunities** ${Parser.getFullImmRes(mon.immune)}` : "";
		const condImmPart = mon.conditionImmune ? `\n>- **Condition Immunities** ${Parser.getFullCondImm(mon.conditionImmune, true)}` : "";

		const fnGetSpellTraits = RendererMarkdown.monster.getSpellcastingRenderedTraits.bind(RendererMarkdown.monster, meta);
		const traitArray = Renderer.monster.getOrderedTraits(mon, {fnGetSpellTraits});
		const actionArray = Renderer.monster.getOrderedActions(mon, {fnGetSpellTraits});

		const traitsPart = traitArray?.length
			? `\n${RendererMarkdown.monster._getRenderedSection({prop: "trait", entries: traitArray, depth: 1, meta})}`
			: "";

		const actionsPart = actionArray?.length
			? `${RendererMarkdown.monster._getRenderedSectionHeader({mon, title: "Actions", prop: "action"})}${RendererMarkdown.monster._getRenderedSection({mon, prop: "action", entries: actionArray, depth: 1, meta})}`
			: "";
		const bonusActionsPart = mon.bonus
			? `${RendererMarkdown.monster._getRenderedSectionHeader({mon, title: "Bonus Actions", prop: "bonus"})}${RendererMarkdown.monster._getRenderedSection({mon, prop: "bonus", entries: mon.bonus, depth: 1, meta})}`
			: "";
		const reactionsPart = mon.reaction
			? `${RendererMarkdown.monster._getRenderedSectionHeader({mon, title: "Reactions", prop: "reaction"})}${RendererMarkdown.monster._getRenderedSection({mon, prop: "reaction", entries: mon.reaction, depth: 1, meta})}`
			: "";
		const legendaryActionsPart = mon.legendary
			? `${RendererMarkdown.monster._getRenderedSectionHeader({mon, title: "Legendary Actions", prop: "legendary"})}>${Renderer.monster.getLegendaryActionIntro(mon, {renderer: RendererMarkdown.get()})}\n>\n${RendererMarkdown.monster._getRenderedLegendarySection(mon.legendary, 1, meta)}`
			: "";
		const mythicActionsPart = mon.mythic
			? `${RendererMarkdown.monster._getRenderedSectionHeader({mon, title: "Mythic Actions", prop: "mythic"})}>${Renderer.monster.getSectionIntro(mon, {renderer: RendererMarkdown.get(), prop: "mythic"})}\n>\n${RendererMarkdown.monster._getRenderedLegendarySection(mon.mythic, 1, meta)}`
			: "";

		const legendaryGroupLairPart = legendaryGroup?.lairActions ? `\n>### Lair Actions\n${RendererMarkdown.monster._getRenderedSection({prop: "lairaction", entries: legendaryGroup.lairActions, depth: -1, meta})}` : "";
		const legendaryGroupRegionalPart = legendaryGroup?.regionalEffects ? `\n>### Regional Effects\n${RendererMarkdown.monster._getRenderedSection({prop: "regionaleffect", entries: legendaryGroup.regionalEffects, depth: -1, meta})}` : "";

		const footerPart = mon.footer ? `\n${RendererMarkdown.monster._getRenderedSectionEntries(mon.footer, 0, meta)}` : "";

		const unbreakablePart = `___
>## ${mon._displayName || mon.name}
>*${mon.level ? `${Parser.getOrdinalForm(mon.level)}-level ` : ""}${Renderer.utils.getRenderedSize(mon.size)} ${monTypes.asText}${mon.alignment ? `, ${mon.alignmentPrefix ? RendererMarkdown.get().render(mon.alignmentPrefix) : ""}${Parser.alignmentListToFull(mon.alignment)}` : ""}*
>___
>- **Armor Class** ${acPart}
>- **Hit Points** ${Renderer.monster.getRenderedHp(mon.hp, true)}${resourcePart}
>- **Speed** ${Parser.getSpeedString(mon)}
>___
>|${Parser.ABIL_ABVS.map(it => `${it.toUpperCase()}|`).join("")}
>|:---:|:---:|:---:|:---:|:---:|:---:|
>|${Parser.ABIL_ABVS.map(ab => `${mon[ab]} (${Parser.getAbilityModifier(mon[ab])})|`).join("")}
>___${savePart}${skillPart}${damVulnPart}${damResPart}${damImmPart}${condImmPart}
>- **Senses** ${mon.senses ? `${Renderer.monster.getRenderedSenses(mon.senses, true)}, ` : ""}passive Perception ${mon.passive || "\u2014"}
>- **Languages** ${Renderer.monster.getRenderedLanguages(mon.languages)}
>- **Challenge** ${mon.cr ? Parser.monCrToFull(mon.cr, {isMythic: !!mon.mythic}) : "\u2014"}
${mon.pbNote || Parser.crToNumber(mon.cr) < VeCt.CR_CUSTOM ? `>- **Proficiency Bonus** ${mon.pbNote ?? UiUtil.intToBonus(Parser.crToPb(mon.cr), {isPretty: true})}` : ""}
>___`;

		let breakablePart = `${traitsPart}${actionsPart}${bonusActionsPart}${reactionsPart}${legendaryActionsPart}${mythicActionsPart}${legendaryGroupLairPart}${legendaryGroupRegionalPart}${footerPart}`;

		if (RendererMarkdown.getSetting("isAddColumnBreaks")) {
			let charAllowanceFirstCol = 2200 - unbreakablePart.length;

			const breakableLines = breakablePart.split("\n");
			for (let i = 0; i < breakableLines.length; ++i) {
				const l = breakableLines[i];
				if ((charAllowanceFirstCol -= l.length) < 0) {
					breakableLines.splice(i, 0, ">", "> \\columnbreak", ">");
					break;
				}
			}
			breakablePart = breakableLines.join("\n");
		}

		const str = `${unbreakablePart}${breakablePart}`;

		const monRender = str.trim().split("\n").map(it => it.trim() ? it : `>`).join("\n");
		const out = `\n${monRender}\n\n`;

		if (addedStatblockInline) delete meta.isStatblockInlineMonster;

		return out;
	}

	static getSave (attr, mod) {
		if (attr === "special") return Renderer.stripTags(mod);
		return `${attr.uppercaseFirst()} ${mod}`;
	}

	static getSkillsString (mon) {
		function doSortMapJoinSkillKeys (obj, keys, joinWithOr) {
			const toJoin = keys.sort(SortUtil.ascSort).map(s => `${s.toTitleCase()} ${obj[s]}`);
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
			const special = mon.skill.special && Renderer.stripTags(mon.skill.special);
			return [skills, others, special].filter(Boolean).join(", ");
		} else return skills;
	}

	static _getRenderedSectionHeader ({mon, title, prop}) {
		const propNote = `${prop}Note`;
		const ptTitle = `\n>### ${title}`;
		if (!mon[propNote]) return `${ptTitle}\n`;
		return `${ptTitle} (${mon[propNote]})\n`;
	}

	static _getRenderedSection ({mon = null, prop, entries, depth = 1, meta}) {
		const ptHeader = mon
			? Renderer.monster.getSectionIntro(mon, {renderer: RendererMarkdown.get(), prop})
			: "";

		return `${ptHeader ? `>${ptHeader}\n>\n` : ""}${this._getRenderedSectionEntries(entries, depth, meta)}`;
	}

	static _getRenderedSectionEntries (sectionEntries, sectionLevel, meta) {
		const renderer = RendererMarkdown.get();
		const renderStack = [""];
		sectionEntries.forEach(e => {
			if (e.rendered) renderStack[0] += e.rendered;
			else {
				const cacheDepth = meta.depth;
				meta.depth = sectionLevel + 1;
				renderer._recursiveRender(e, renderStack, meta, {prefix: ">"});
				meta.depth = cacheDepth;
			}
		});
		return renderStack.join("");
	}

	static _getRenderedLegendarySection (sectionEntries, sectionLevel, meta) {
		const renderer = RendererMarkdown.get();
		const renderStack = [""];

		const cpy = MiscUtil.copyFast(sectionEntries).map(it => {
			if (it.name && it.entries) {
				it.name = `${it.name}.`;
				it.type = it.type || "item";
			}
			return it;
		});

		const toRender = {type: "list", style: "list-hang-notitle", items: cpy};
		const cacheDepth = meta.depth;
		meta.depth = sectionLevel;
		renderer._recursiveRender(toRender, renderStack, meta, {prefix: ">"});
		meta.depth = cacheDepth;

		return renderStack.join("");
	}

	static getSpellcastingRenderedTraits (meta, mon, displayAsProp = "trait") {
		const renderer = RendererMarkdown.get();
		const out = [];
		const cacheDepth = meta.depth;
		meta.depth = 2;
		(mon.spellcasting || []).filter(it => (it.displayAs || "trait") === displayAsProp).forEach(entry => {
			entry.type = entry.type || "spellcasting";
			const renderStack = [""];
			renderer._recursiveRender(entry, renderStack, meta, {prefix: ">"});
			out.push({name: entry.name, rendered: renderStack.join("")});
		});
		meta.depth = cacheDepth;
		return out;
	}

	// region Exporting
	static async pGetMarkdownDoc (monsters) {
		const asEntries = (await Promise.all(monsters
			.map(async (mon, i) => {
				const monEntry = ({type: "statblockInline", dataType: "monster", data: mon});

				const fluff = await Renderer.monster.pGetFluff(mon);

				const fluffEntries = (fluff || {}).entries || [];

				RendererMarkdown.get().setFirstSection(true);
				const fluffText = fluffEntries.map(ent => RendererMarkdown.get().render(ent)).join("\n\n");

				const out = [monEntry];

				const isAddPageBreaks = RendererMarkdown.getSetting("isAddPageBreaks");
				if (fluffText) {
					// Insert a page break before every fluff section
					if (isAddPageBreaks) out.push("", "\\pagebreak", "");

					out.push(`## ${mon.name}`);

					// Split into runs of <X characters, and join these with page breaks
					let stack = [];
					let charLimit = RendererMarkdown.CHARS_PER_PAGE;
					fluffText.split("\n").forEach(l => {
						if ((charLimit -= l.length) < 0) {
							out.push(stack.join("\n"));
							if (isAddPageBreaks) out.push("", "\\pagebreak", "");
							stack = [];
							charLimit = RendererMarkdown.CHARS_PER_PAGE - l.length;
						}
						stack.push(l);
					});
					if (stack.length) out.push(stack.join("\n"));
				}

				// Insert a page break after every creature statblock or fluff section
				if (i !== monsters.length - 1 && isAddPageBreaks) out.push("", "\\pagebreak", "");
				return out;
			})))
			.flat();

		return RendererMarkdown.get().render({entries: asEntries});
	}
	// endregion
};

RendererMarkdown.spell = class {
	static getCompactRenderedString (sp, opts = {}) {
		const meta = opts.meta || {};

		const subStack = [""];

		subStack[0] += `#### ${sp._displayName || sp.name}
*${Parser.spLevelSchoolMetaToFull(sp.level, sp.school, sp.meta, sp.subschools)}*
___
- **Casting Time:** ${Parser.spTimeListToFull(sp.time)}
- **Range:** ${Parser.spRangeToFull(sp.range)}
- **Components:** ${Parser.spComponentsToFull(sp.components, sp.level, {isPlainText: true})}
- **Duration:** ${Parser.spDurationToFull(sp.duration)}
---\n`;

		const cacheDepth = meta.depth;
		meta.depth = 2;
		RendererMarkdown.get().recursiveRender({entries: sp.entries}, subStack, meta, {suffix: "\n"});
		if (sp.entriesHigherLevel) {
			RendererMarkdown.get().recursiveRender({entries: sp.entriesHigherLevel}, subStack, meta, {suffix: "\n"});
		}
		meta.depth = cacheDepth;

		const spellRender = subStack.join("").trim();
		return `\n${spellRender}\n\n`;
	}
};

RendererMarkdown.item = class {
	static getCompactRenderedString (item, opts = {}) {
		const meta = opts.meta || {};

		const subStack = [""];

		const [damage, damageType, propertiesTxt] = Renderer.item.getDamageAndPropertiesText(item, {renderer: RendererMarkdown.get()});
		const [typeRarityText, subTypeText, tierText] = RendererMarkdown.item.getTypeRarityAndAttunementText(item);

		const typeRarityTierValueWeight = [typeRarityText, subTypeText, tierText, Parser.itemValueToFullMultiCurrency(item), Parser.itemWeightToFull(item)].filter(Boolean).join(", ").uppercaseFirst();
		const damageProperties = [damage, damageType, propertiesTxt].filter(Boolean).join(" ").uppercaseFirst();

		const ptSubtitle = [typeRarityTierValueWeight, damageProperties].filter(Boolean).join("\n\n");

		subStack[0] += `#### ${item._displayName || item.name}${ptSubtitle ? `\n\n${ptSubtitle}` : ""}\n\n${ptSubtitle ? `---\n\n` : ""}`;

		if (Renderer.item.hasEntries(item)) {
			const cacheDepth = meta.depth;

			if (item._fullEntries || (item.entries?.length)) {
				const entry = {type: "entries", entries: item._fullEntries || item.entries};
				meta.depth = 1;
				RendererMarkdown.get().recursiveRender(entry, subStack, meta, {suffix: "\n"});
			}

			if (item._fullAdditionalEntries || item.additionalEntries) {
				const additionEntries = {type: "entries", entries: item._fullAdditionalEntries || item.additionalEntries};
				meta.depth = 1;
				RendererMarkdown.get().recursiveRender(additionEntries, subStack, meta, {suffix: "\n"});
			}

			meta.depth = cacheDepth;
		}

		const itemRender = subStack.join("").trim();
		return `\n${itemRender}\n\n`;
	}

	static getTypeRarityAndAttunementText (item) {
		const typeRarity = [
			item._typeHtml === "other" ? "" : $(`<div></div>`).html(item._typeHtml).text(),
			(item.rarity && Renderer.item.doRenderRarity(item.rarity) ? item.rarity : ""),
		].filter(Boolean).join(", ");

		return [
			item.reqAttune ? `${typeRarity} ${item._attunement}` : typeRarity,
			item._subTypeHtml || "",
			item.tier ? `${item.tier} tier` : "",
		];
	}
};

RendererMarkdown.legendaryGroup = class {
	static getCompactRenderedString (lg, opts = {}) {
		const meta = opts.meta || {};

		const subEntry = Renderer.legendaryGroup.getSummaryEntry(lg);
		if (!subEntry) return "";

		const subStack = [""];

		subStack[0] += `## ${lg._displayName || lg.name}`;
		RendererMarkdown.get().recursiveRender(subEntry, subStack, meta, {suffix: "\n"});

		const lgRender = subStack.join("").trim();
		return `\n${lgRender}\n\n`;
	}
};

RendererMarkdown.hover = class {
	static getFnRenderCompact (prop) {
		return RendererMarkdown[prop]?.getCompactRenderedString;
	}
};

class MarkdownConverter {
	static getEntries (mdStr) {
		mdStr = mdStr.trim();
		if (!mdStr) return [];

		mdStr = this._getCleanGmBinder(mdStr);

		const buf = mdStr.split("\n").map(line => line.trimEnd());

		this._coalesceCreatures(buf);
		this._convertCreatures(buf);

		this._coalesceInsetsReadalouds(buf);
		this._convertInsetsReadalouds(buf);

		this._coalesceTables(buf);
		this._convertTables(buf);

		this._coalesceLists(buf);
		this._convertLists(buf);

		this._coalesceHeaders(buf);

		this._convertInlineStyling(buf);
		this._cleanEmptyLines(buf);
		this._cleanEntries(buf);

		return buf;
	}

	static _getCleanGmBinder (mdStr) {
		// Replace any GMB-specific markers
		mdStr = mdStr.replace(/(^|\n)\s*\\(pagebreakNum|pagebreak|columnbreak)/gi, "");

		// Scrub HTML
		try {
			const $jq = $(`<div>${mdStr}</div>`);
			$jq.find("*").remove();
			mdStr = $jq.text();
		} catch (e) {
			setTimeout(() => { throw e; });
		}

		return mdStr;
	}

	static _coalesceCreatures (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i].trim();

			if (line === "___" || line === "---") {
				let j = 1;

				// Skip forwards until we run out of lines, or until we hit a line that isn't part of the block
				for (; i + j < buf.length; ++j) {
					const nxt = buf[i + j];
					if (!nxt || !nxt.startsWith(">")) break;
				}

				const creatureLines = buf.slice(i, i + j);
				// Remove any creature markers with no following content
				if (creatureLines.length === 1) {
					buf.splice(i, 1);
					i--;
				} else buf.splice(i, j, {mdType: "creature", lines: creatureLines});
			}
		}
	}

	static _convertCreatures (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i];
			if (typeof line === "string") continue;

			if (line.mdType === "creature") {
				buf[i] = {
					type: "inset",
					name: "(To convert creature stat blocks, please use the Text Converter utility)",
					entries: line.lines.slice(1).map(it => it.slice(1).trim()),
				};
			}
		}
	}

	static _coalesce_getLastH5Index (line, i, curCaptionIx) {
		if (typeof line === "string") {
			if (line.trim()) {
				if (line.startsWith("##### ")) return i;
				else return -1;
			}
		} else return -1;
		return curCaptionIx;
	}

	/**
	 * Apply an array-modifying function recursively.
	 * @param obj The object to apply the function to.
	 * @param fn The function to apply. Note that it must modify the array in-place.
	 */
	static _coalesceConvert_doRecurse (obj, fn) {
		if (typeof obj !== "object") throw new TypeError(`Non-object ${obj} passed to object handler!`);

		if (obj instanceof Array) {
			fn(obj);

			obj.forEach(it => {
				if (typeof it !== "object") return;
				this._coalesceConvert_doRecurse(it, fn);
			});
		} else {
			if (obj.type) {
				const childMeta = Renderer.ENTRIES_WITH_CHILDREN.find(it => it.type === obj.type && obj[it.key]);
				if (childMeta) {
					this._coalesceConvert_doRecurse(obj[childMeta.key], fn);
				}
			}
		}
	}

	static _coalesceTables (buf) {
		let lastCaptionIx = -1;

		for (let i = 0; i < buf.length; ++i) {
			// Track the last caption position, so we can hoover it up later
			if (i > 0) {
				const lPrev = buf[i - 1];
				lastCaptionIx = this._coalesce_getLastH5Index(lPrev, i - 1, lastCaptionIx);
			}

			let l1 = buf[i];
			let l2 = buf[i + 1];

			// If we find valid table headers, start scanning in rows until we find something not table-like.
			// This can be a `#` header line; a `>` inset line; or a line that doesn't contain a pipe.
			// Additionally, if we find a pre-processed object (e.g. a creature), we're done.
			if (typeof l1 === "string" && typeof l2 === "string"
				&& l1.includes("|") && l2.includes("|")
				&& l2.includes("---") && /^[ |:-]+$/gi.exec(l2)
			) {
				l1 = l1.trim();
				l2 = l2.trim();

				let j = 2;
				for (; j < buf.length; ++j) {
					const lNxt = buf[i + j];
					if (!lNxt || !this._coalesceTables_isTableLine(lNxt)) break;
				}

				if (lastCaptionIx != null && ~lastCaptionIx) {
					const lines = buf.slice(lastCaptionIx, i + j);
					buf.splice(
						lastCaptionIx,
						j + (i - lastCaptionIx),
						{mdType: "table", caption: lines[0].replace("##### ", ""), lines: lines.slice(1)},
					);
				} else {
					const lines = buf.slice(i, i + j);
					buf.splice(i, j, {mdType: "table", lines});
				}
			}
		}
	}

	static _convertTables (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i];
			if (typeof line === "string") continue;

			if (!line.mdType) {
				this._coalesceConvert_doRecurse(line, this._convertTables.bind(this));
			} else {
				if (line.mdType !== "table") continue;

				buf[i] = this.getConvertedTable(line.lines, line.caption);
			}
		}
	}

	static _coalesceTables_isTableLine (l) {
		if (typeof l !== "string") return false;
		l = l.trim();
		if (!l.includes("|")) return false;
		return !/^#+ /.test(l) && !l.startsWith("> ") && !/^[-*+]/.test(l);
	}

	static _coalesceLists (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i];

			if (typeof line !== "string") {
				this._coalesceConvert_doRecurse(line, this._coalesceLists.bind(this));
			} else {
				const liM = this._coalesceLists_isListItem(line);
				if (liM) {
					let j = 1;
					let blankCount = 0;

					// Skip forwards until we run out of lines, or until we hit a line that isn't part of the block
					for (; i + j < buf.length; ++j) {
						const nxt = buf[i + j];
						if (!nxt || !nxt.trim()) {
							// Allow a max of one blank line before breaking into another list
							if (blankCount++ < 1) continue;
							else break;
						}
						blankCount = 0;
						if (typeof nxt !== "string") break;
						if (!this._coalesceLists_isListItem(nxt)) break;
					}

					const listLines = buf.slice(i, i + j);
					buf.splice(i, j, {mdType: "list", lines: listLines.filter(it => it.trim())});
				}
			}
		}
	}

	static _coalesceLists_isListItem (line) { return /^(\s*)\* /.test(line) || /^(\s*)- /.test(line) || /^(\s*)\+ /.test(line); }

	static _convertLists (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i];
			if (typeof line === "string") continue;

			if (!line.mdType) {
				this._coalesceConvert_doRecurse(line, this._convertLists.bind(this));
			} else {
				if (line.mdType !== "list") continue;

				// Normalise line depths
				line.lines = this._convertLists_doNormalise(line.lines);

				const stack = [];

				const getStackDepth = () => {
					if (!stack.length) return null;
					return stack.length - 1;
				};

				line.lines.forEach(l => {
					const depth = l.length - l.trimStart().length;
					const lText = l.trim();

					if (getStackDepth() == null) {
						const list = {type: "list", items: [lText]};
						stack.push(list);
					} else {
						if (depth === getStackDepth()) stack.last().items.push(lText);
						else if (depth > getStackDepth()) {
							const list = {type: "list", items: [lText]};
							stack.last().items.push(list);
							stack.push(list);
						} else if (depth < getStackDepth()) {
							while (depth < getStackDepth()) stack.pop();

							if (stack.length) stack.last().items.push(lText);
							else stack.push({type: "list", items: [lText]});
						}
					}
				});

				buf.splice(i, 1, stack[0]);
			}
		}
	}

	static _convertLists_doNormalise (lst) {
		const getCleanLine = l => l.replace(/^\s*[-+*]\s*/, "");

		// Allow +/- 1 depth range
		const isInDepthRange = (depthRange, depth) => (depthRange[0] == null && depthRange[1] == null) || (depth >= depthRange[0] - 1 && depth <= depthRange[1] + 1);

		const setDepthRange = (depthRange, depth) => depthRange[0] = depthRange[1] = depth;
		const expandDepthRange = (depthRange, depth) => {
			if (depthRange[0] == null && depthRange[1] == null) {
				depthRange[0] = depth;
				depthRange[1] = depth;
			} else {
				depthRange[0] = Math.min(depthRange[0], depth);
				depthRange[1] = Math.max(depthRange[1], depth);
			}
		};

		// Normalise leading whitespace
		let targetDepth = 0;

		const depthRange = [null, null];

		return lst.map(l => {
			const depth = l.length - l.trimStart().length;

			if (isInDepthRange(depthRange, depth)) {
				expandDepthRange(depthRange, depth);
			} else if (depth > depthRange[1]) {
				targetDepth++;
				setDepthRange(depthRange, depth);
			} else if (depth < depthRange[0]) {
				// If the depth is below where we're at, step our targetDepth by an appropriate count of 2-spaces
				const targetDepthReduction = Math.floor((depthRange[0] - depth) / 2);
				targetDepth = Math.max(0, targetDepth - targetDepthReduction);
				setDepthRange(depthRange, depth);
			}
			return `${" ".repeat(targetDepth)}${getCleanLine(l)}`;
		});
	}

	static _coalesceInsetsReadalouds (buf) {
		const getCleanLine = l => l.replace(/^>>?\s*/, "");

		for (let i = 0; i < buf.length; ++i) {
			let line = buf[i];

			if (typeof line !== "string") {
				this._coalesceConvert_doRecurse(line, this._coalesceInsetsReadalouds.bind(this));
			} else {
				line = line.trim();

				if (this._coalesceInsets_isInsetLine(line) || this._coalesceInsets_isReadaloudLine(line)) {
					let type = this._coalesceInsets_isReadaloudLine(line) ? "insetReadaloud" : "inset";

					let j = 1;
					const header = /^>\s*#####\s+/.test(line) ? line.replace(/^>\s*#####\s+/, "") : null;

					for (; j < buf.length; ++j) {
						const lNxt = buf[i + j];
						if (typeof lNxt === "object") continue;
						if (!lNxt) break;
						if (type === "insetReadaloud" && !this._coalesceInsets_isReadaloudLine(lNxt)) break;
						if (type === "inset" && !this._coalesceInsets_isInsetLine(lNxt)) break;
					}

					const lines = buf.slice(i, i + j).map(getCleanLine);
					const out = {mdType: type, lines};
					if (header) {
						out.name = header;
						lines.shift();
					}
					buf.splice(i, j, out);
				}
			}
		}
	}

	static _coalesceInsets_isReadaloudLine (l) {
		return l.trim().startsWith(">>");
	}

	static _coalesceInsets_isInsetLine (l) {
		return l.trim().startsWith(">");
	}

	static _convertInsetsReadalouds (buf) {
		for (let i = 0; i < buf.length; ++i) {
			const line = buf[i];
			if (typeof line === "string") continue;

			if (line.mdType === "inset" || line.mdType === "insetReadaloud") {
				const out = {
					type: line.mdType,
					name: line.name,
					entries: line.lines,
				};
				if (!out.name || !out.name.trim()) delete out.name;
				buf[i] = out;
			}
		}
	}

	static _coalesceHeaders (buf) {
		const stack = [];

		const i = {_: 0};
		for (; i._ < buf.length; ++i._) {
			let line = buf[i._];

			if (typeof line !== "string") {
				if (!stack.length) continue;
				else {
					buf.splice(i._--, 1);

					stack.last().entries.push(line);
					continue;
				}
			} else line = line.trim();

			const mHashes = /^(#+) /.exec(line);
			const mInlineHeaderStars = /\*\*\*\s*([^.?!:]+[.?!:])\s*\*\*\*(.*)/.exec(line);
			const mInlineHeaderUnders = /___\s*([^.?!:]+[.?!:])\s*___(.*)/.exec(line);
			if (mHashes) {
				const name = line.replace(/^#+ /, "");
				const numHashes = line.length - (name.length + 1); // Add back one since we stripped a space
				switch (numHashes) {
					// # => "chapter" section, which should start a new section
					// ## => "regular" section, which should be embedded in a root section if possible
					case 1: this._coalesceHeaders_addBlock(buf, i, stack, -2, name); break;
					case 2: this._coalesceHeaders_addBlock(buf, i, stack, -1, name); break;
					// ### => l0 entries
					case 3: this._coalesceHeaders_addBlock(buf, i, stack, 0, name); break;
					// #### => l1 entries
					// ##### => l1 entries (TODO this should be something else? Is a bold small-caps header)
					case 4: this._coalesceHeaders_addBlock(buf, i, stack, 1, name); break;
					case 5: this._coalesceHeaders_addBlock(buf, i, stack, 1, name); break;
				}
			} else if (mInlineHeaderStars || mInlineHeaderUnders) {
				const mInline = mInlineHeaderStars || mInlineHeaderUnders;
				const name = mInline[1];
				const text = mInline[2];
				this._coalesceHeaders_addBlock(buf, i, stack, 2, name.replace(/[.?!:]\s*$/, ""));
				stack.last().entries.push(text);
			} else {
				if (!stack.length) continue;

				buf.splice(i._--, 1);
				stack.last().entries.push(line);
			}
		}
	}

	static _coalesceHeaders_getStackDepth (stack) {
		if (!stack.length) return null;

		let count = 0;
		let start = 0;
		for (let i = stack.length - 1; i >= 0; --i) {
			const ent = stack[i];
			if (ent.type === "section") {
				start = -1;
				break;
			} else {
				count++;
			}
		}

		return start + count;
	}

	static _coalesceHeaders_addBlock (buf, i, stack, depth, name) {
		const targetDepth = depth === -2 ? -1 : depth;

		const curDepth = this._coalesceHeaders_getStackDepth(stack);
		if (curDepth == null || depth === -2) { // -2 = new root section
			// If we're adding a new chapter, clear the stack
			while (stack.length) stack.pop();

			buf[i._] = this._coalesceHeaders_getRoot(stack, depth);
			if (depth <= 0) stack.last().name = name;
			else this._coalesceHeaders_handleTooShallow(stack, targetDepth, name);
		} else {
			if (curDepth === targetDepth) {
				this._coalesceHeaders_handleEqual(buf, i, stack, depth, targetDepth, name);
			} else if (curDepth < targetDepth) {
				buf.splice(i._--, 1);
				this._coalesceHeaders_handleTooShallow(stack, targetDepth, name);
			} else if (curDepth > targetDepth) {
				this._coalesceHeaders_handleTooDeep(buf, i, stack, depth, targetDepth, name);
			}
		}
	}

	static _coalesceHeaders_getRoot (stack, depth) {
		const root = {type: depth < 0 ? "section" : "entries", name: "", entries: []};
		stack.push(root);
		return root;
	}

	static _coalesceHeaders_handleEqual (buf, i, stack, depth, targetDepth, name) {
		if (stack.length > 1) stack.pop();
		else if (targetDepth !== -1) {
			// If we only have a root, and encounter an entry at the same level as our root, we need to turn the root into a section
			const nuRoot = {
				type: "section",
				entries: [
					stack[0],
				],
			};
			const ixRoot = buf.indexOf(stack[0]);
			if (~ixRoot) throw new Error(`Could not find root in buffer!`);
			buf[ixRoot] = nuRoot;
			stack.pop();
			stack.push(nuRoot);
		}

		if (stack.length) {
			buf.splice(i._--, 1);
			const nxtBlock = {type: depth < 0 ? "section" : "entries", name, entries: []};
			stack.last().entries.push(nxtBlock);
			stack.push(nxtBlock);
		} else {
			buf[i._] = this._coalesceHeaders_getRoot(stack, depth);
			stack.last().name = name;
		}
	}

	static _coalesceHeaders_handleTooShallow (stack, targetDepth, name) {
		while (this._coalesceHeaders_getStackDepth(stack) < targetDepth) {
			const nxt = {type: "entries", name: "", entries: []};
			stack.last().entries.push(nxt);
			stack.push(nxt);
		}
		stack.last().name = name;
	}

	static _coalesceHeaders_handleTooDeep (buf, i, stack, depth, targetDepth, name) {
		// Protect the first entry on the stack
		while (this._coalesceHeaders_getStackDepth(stack) > targetDepth && stack.length > 1) stack.pop();
		this._coalesceHeaders_handleEqual(buf, i, stack, depth, targetDepth, name);
	}

	static _convertInlineStyling (buf) {
		const handlers = {
			object: (obj) => {
				for (const meta of Renderer.ENTRIES_WITH_CHILDREN) {
					if (obj.type !== meta.type) continue;
					if (!obj[meta.key]) continue;

					obj[meta.key] = obj[meta.key].map(ent => {
						if (typeof ent !== "string") return ent;

						// Handle "emphasis" markers (*italic*/**bold**/***bold+italic***)
						ent = ent.replace(/(\*+)(.+?)(\*+)|(_+)(.+?)(_+)/g, (...m) => {
							const [open, text, close] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]];

							const minLen = Math.min(open.length, close.length);
							const cleanOpen = open.slice(minLen);
							const cleanClose = close.slice(minLen);

							if (minLen === 1) return `{@i ${cleanOpen}${text}${cleanClose}}`;
							else if (minLen === 2) return `{@b ${cleanOpen}${text}${cleanClose}}`;
							else return `{@b {@i ${cleanOpen}${text}${cleanClose}}}`;
						});

						// Strikethrough
						ent = ent.replace(/~~(.+?)~~/g, (...m) => `{@s ${m[1]}}`);

						// Links (basic inline only)
						ent = ent.replace(/\[(.+?)]\((.+?)\)/g, (...m) => `{@link ${m[1]}|${m[2]}}`);

						return ent;
					});
				}
				return obj;
			},
		};
		const nxtBuf = MiscUtil.getWalker().walk(buf, handlers);
		while (buf.length) buf.pop();
		buf.push(...nxtBuf);
	}

	static _cleanEmptyLines (buf) {
		const handlersDoTrim = {
			array: (arr) => arr.map(it => typeof it === "string" ? it.trim() : it),
		};
		const nxtBufTrim = MiscUtil.getWalker().walk(buf, handlersDoTrim);
		while (buf.length) buf.pop();
		buf.push(...nxtBufTrim);

		const handlersRmEmpty = {
			array: (arr) => arr.filter(it => it && (typeof it !== "string" || it.trim())),
		};
		const nxtBufRmEmpty = MiscUtil.getWalker().walk(buf, handlersRmEmpty);
		while (buf.length) buf.pop();
		buf.push(...nxtBufRmEmpty);
	}

	static _cleanEntries (buf) {
		function recursiveClean (obj) {
			if (typeof obj === "object") {
				if (obj instanceof Array) {
					obj.forEach(x => recursiveClean(x));
				} else {
					if ((obj.type === "section" || obj.type === "entries") && obj.name != null && !obj.name.trim()) delete obj.name;
					if (obj.entries && !obj.entries.length) delete obj.entries;

					Object.values(obj).forEach(v => recursiveClean(v));
				}
			}
		}

		recursiveClean(buf);
	}

	// region Table Conversion
	static getConvertedTable (lines, caption) {
		// trim leading/trailing pipes if they're uniformly present
		const contentLines = lines.filter(l => l && l.trim());
		if (contentLines.every(l => l.trim().startsWith("|"))) lines = lines.map(l => l.replace(/^\s*\|(.*?)$/, "$1"));
		if (contentLines.every(l => l.trim().endsWith("|"))) lines = lines.map(l => l.replace(/^(.*?)\|\s*$/, "$1"));

		const tbl = {
			type: "table",
			caption,
			colLabels: [],
			colStyles: [],
			rows: [],
		};

		let seenHeaderBreak = false;
		let alignment = [];
		lines.map(l => l.trim()).filter(Boolean).forEach(l => {
			const cells = l.split("|").map(it => it.trim());
			if (cells.length) {
				if (cells.every(c => !c || !!/^:?\s*---+\s*:?$/.exec(c))) { // a header break
					alignment = cells.map(c => {
						if (c.startsWith(":") && c.endsWith(":")) {
							return "text-center";
						} else if (c.startsWith(":")) {
							return "text-align-left";
						} else if (c.endsWith(":")) {
							return "text-right";
						} else {
							return "";
						}
					});
					seenHeaderBreak = true;
				} else if (seenHeaderBreak) {
					tbl.rows.push(cells);
				} else {
					tbl.colLabels = cells;
				}
			}
		});

		tbl.colStyles = alignment;
		this.postProcessTable(tbl);
		return tbl;
	}

	/**
	 * @param tbl The table to process.
	 * @param [opts] Options object. Defaults assume statblock parsing.
	 * @param [opts.tableWidth] The table width, in characters. 80 is good for statblocks, 150 is good for books.
	 * @param [opts.diceColWidth] The width (in 12ths) of any leading rollable dice column. 1 for statblocks, 2 for books.
	 */
	static postProcessTable (tbl, opts) {
		opts = opts || {};
		opts.tableWidth = opts.tableWidth || 80;
		opts.diceColWidth = opts.diceColWidth || 1;

		tbl.colStyles = tbl.colStyles || [];

		// Post-processing
		(function normalizeCellCounts () {
			// pad all rows to max width
			const maxWidth = Math.max((tbl.colLabels || []).length, ...tbl.rows.map(it => it.length));
			tbl.rows.forEach(row => {
				while (row.length < maxWidth) row.push("");
			});
		})();

		let isDiceCol0 = true;
		(function doCheckDiceOrNumericCol0 () {
			// check if first column is all strictly number-like
			tbl.rows.forEach(r => {
				const r0Clean = Renderer.stripTags((r[0] || "").trim());
				// u2012 = figure dash; u2013 = en-dash
				if (!/^[-+*/×÷x^.,0-9\u2012\u2013]+(?:st|nd|rd|th)?$/i.exec(r0Clean)) return isDiceCol0 = false;
			});
		})();

		(function doCalculateWidths () {
			const BASE_CHAR_CAP = opts.tableWidth; // assume tables are approx 80 characters wide

			// Get the average/max width of each column
			let isAllBelowCap = true;
			const widthMeta = (() => {
				if (!tbl.rows.length) return null;

				const outAvgWidths = [...new Array(tbl.rows[0].length)].map(() => 0);
				// Include the headers in "max width" calculations
				const outMaxWidths = [...new Array(tbl.rows[0].length)].map((_, i) => tbl.colLabels[i] ? tbl.colLabels[i].length : 0);

				tbl.rows.forEach(r => {
					r.forEach((cell, i) => {
						// This assumes the cells are always strings, which may be faulty
						const cellStripped = Renderer.stripTags(cell);
						if (cellStripped.length > BASE_CHAR_CAP) isAllBelowCap = false;
						outAvgWidths[i] += Math.min(BASE_CHAR_CAP, cellStripped.length);
						outMaxWidths[i] = Math.max(outMaxWidths[i], cellStripped.length);
					});
				});

				return {
					avgWidths: outAvgWidths.map(it => it / tbl.rows.length),
					maxWidths: outMaxWidths,
				};
			})();

			if (widthMeta == null) return;
			const {avgWidths, maxWidths} = widthMeta;

			// If we have a relatively sparse table, give each column enough to fit its max
			const assignColWidths = (widths) => {
				// Reserve some space for the dice column, if we have one
				const splitInto = isDiceCol0 ? 12 - opts.diceColWidth : 12;
				if (isDiceCol0) widths = widths.slice(1);

				const totalWidths = widths.reduce((a, b) => a + b, 0);
				const redistributedWidths = (() => {
					const MIN = totalWidths / splitInto;
					const sorted = widths.map((it, i) => ({ix: i, val: it})).sort((a, b) => SortUtil.ascSort(a.val, b.val));

					for (let i = 0; i < sorted.length - 1; ++i) {
						const it = sorted[i];
						if (it.val < MIN) {
							const diff = MIN - it.val;
							sorted[i].val = MIN;
							const toSteal = diff / sorted.length - (i + 1);
							for (let j = i + 1; j < sorted.length; ++j) {
								sorted[j].val -= toSteal;
							}
						}
					}

					return sorted.sort((a, b) => SortUtil.ascSort(a.ix, b.ix)).map(it => it.val);
				})();

				let nmlxWidths = redistributedWidths.map(it => it / totalWidths);
				while (nmlxWidths.reduce((a, b) => a + b, 0) > 1) {
					const diff = 1 - nmlxWidths.reduce((a, b) => a + b, 0);
					nmlxWidths = nmlxWidths.map(it => it + diff / nmlxWidths.length);
				}
				const twelfthWidths = nmlxWidths.map(it => Math.round(it * splitInto));

				if (isDiceCol0) tbl.colStyles[0] = `col-${opts.diceColWidth}`;
				twelfthWidths.forEach((it, i) => {
					const widthPart = `col-${it}`;
					const iOffset = isDiceCol0 ? i + 1 : i;

					tbl.colStyles[iOffset] = tbl.colStyles[iOffset] ? `${tbl.colStyles[iOffset]} ${widthPart}` : widthPart;
				});
			};

			assignColWidths(isAllBelowCap ? maxWidths : avgWidths);
		})();

		if (isDiceCol0 && !tbl.colStyles.includes("text-center")) tbl.colStyles[0] += " text-center";

		(function doCheckNumericCols () {
			if (isDiceCol0 && tbl.colStyles.length === 2) return; // don't apply this step for generic rollable tables

			tbl.colStyles.forEach((col, i) => {
				if (col.includes("text-center") || col.includes("text-right")) return;

				const counts = {number: 0, text: 0};

				tbl.rows.forEach(r => {
					if (typeof r[i] !== "string") return counts.text++;
					const clean = Renderer.stripTags(r[i])
						.replace(/[.,]/g, "") // Remove number separators
						.replace(/(^| )(cp|sp|gp|pp|lb\.|ft\.)( |$)/g, "") // Remove units
						.trim();
					counts[isNaN(Number(clean)) ? "text" : "number"]++;
				});

				// If most of the cells in this column contain number data, right-align
				// Unless it's the first column, in which case, center-align
				if ((counts.number / tbl.rows.length) >= 0.80) {
					if (i === 0) tbl.colStyles[i] += ` text-center`;
					else tbl.colStyles[i] += ` text-right`;
				}
			});
		})();

		// If there are columns which have a limited number of words, center these
		let isFewWordsCol1 = false;
		(function doCheckFewWordsCols () {
			if (isDiceCol0 && tbl.colStyles.length === 2) return; // don't apply this step for generic rollable tables

			// Do this in reverse order, as the style of the first column depends on the others
			for (let i = tbl.colStyles.length - 1; i >= 0; --i) {
				const col = tbl.colStyles[i];

				// If we're the first column and other columns are not center-aligned, don't center
				if (i === 0 && tbl.colStyles.length > 1 && tbl.colStyles.filter((_, i) => i !== 0).some(it => !it.includes("text-center"))) continue;

				const counts = {short: 0, long: 0};

				tbl.rows.forEach(r => {
					const cell = r[i];
					if (typeof cell !== "string") return counts.long++;
					const words = Renderer.stripTags(cell).split(" ");
					counts[words.length <= 3 ? "short" : "long"]++;
				});

				// If most of the cells in this column contain short text, center-align
				if ((counts.short / tbl.rows.length) >= 0.80) {
					if (i === 1) isFewWordsCol1 = true;
					if (col.includes("text-center") || col.includes("text-right")) continue;
					tbl.colStyles[i] += ` text-center`;
				}
			}
		})();

		this._doCleanTable(tbl);

		(function doEvenCenteredColumns () {
			if (!isDiceCol0) return;
			if (tbl.colStyles.length === 2 && isFewWordsCol1) {
				tbl.colStyles = ["col-6 text-center", "col-6 text-center"];
			}
		})();

		// Convert "--" cells to long-dashes
		tbl.rows = tbl.rows.map(r => {
			return r.map(cell => {
				if (cell === "--") return "\u2014";
				return cell;
			});
		});
	}

	static _doCleanTable (tbl) {
		if (!tbl.caption) delete tbl.caption;
		if (tbl.colLabels && !tbl.colLabels.some(Boolean)) delete tbl.colLabels;
		if (tbl.colStyles && !tbl.colStyles.some(Boolean)) delete tbl.colStyles;
	}
	// endregion
}

globalThis.RendererMarkdown = RendererMarkdown;
globalThis.MarkdownConverter = MarkdownConverter;

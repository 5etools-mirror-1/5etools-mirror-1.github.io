"use strict";

class RendererCard {
	constructor () {
		// FIXME this is awful
		const renderer = new Renderer();
		for (const k in renderer) {
			if (this[k] === undefined) {
				if (typeof renderer[k] === "function") this[k] = renderer[k].bind(this);
				else this[k] = MiscUtil.copy(renderer[k]);
			}
		}
	}

	static get () {
		return new RendererCard().setFnPostProcess(RendererCard._fnPostProcess);
	}

	static _fnPostProcess (str) {
		return str.replace(/\n\n+/g, "\n\n");
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

		if (entry.name) {
			if (isInlineTitle) {
				textStack[0] += `description | ${Renderer.stripTags(entry.name)} | `;
				if (entry.entries) {
					const cacheDepth = meta.depth;
					meta.depth = nextDepth;
					this._recursiveRender(entry.entries[0], textStack, meta, {suffix: "\n"});
					meta.depth = cacheDepth;
				}
			} else {
				textStack[0] += `section | ${Renderer.stripTags(entry.name)}\n`;
			}
		}

		if (entry.entries) {
			this._renderEntriesSubtypes_renderPreReqText(entry, textStack, meta);
			const cacheDepth = meta.depth;
			const len = entry.entries.length;
			for (let i = entry.name && isInlineTitle ? 1 : 0; i < len; ++i) {
				meta.depth = nextDepth;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
			}
			meta.depth = cacheDepth;
		}
	}

	_renderEntriesSubtypes_renderPreReqText (entry, textStack, meta) {
		if (entry.prerequisite) {
			textStack[0] += `text | <i>Prerequisite: `;
			this._recursiveRender({type: "inline", entries: [entry.prerequisite]}, textStack, meta);
			textStack[0] += `</i>\n`;
		}
	}

	/*
	_renderOptions (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderList (entry, textStack, meta, options) {
		if (!entry.items) return;

		if (entry.name) textStack[0] += `text | <b>${entry.name}</b>\n`;

		const len = entry.items.length;
		for (let i = 0; i < len; ++i) {
			const cacheDepth = this._adjustDepth(meta, 1);
			const item = entry.items[i];
			if (item.type === "itemSpell" || item.type === "itemSub") {
				this._recursiveRender(item, textStack, meta);
			} else this._recursiveRender(item, textStack, meta, {prefix: `bullet | `, suffix: "\n"});
			meta.depth = cacheDepth;
		}
	}

	_renderTable (entry, textStack, meta, options) {
		const _VERTICAL_LINE = "｜"; // "FULLWIDTH VERTICAL LINE" character

		if (entry.intro) for (const ent of entry.intro) this._recursiveRender(ent, textStack, meta, {prefix: "text | ", suffix: "\n"});

		textStack[0] += "\n";

		if (entry.caption) textStack[0] += `text | <b>${entry.caption}</b>\n`;

		const headerRowMetas = Renderer.table.getHeaderRowMetas(entry);
		if (headerRowMetas) {
			for (let ixRow = 0; ixRow < headerRowMetas.length; ++ixRow) {
				textStack[0] += `text | `;

				const headerRowMeta = headerRowMetas[ixRow];
				for (let ixCell = 0; ixCell < headerRowMeta.length; ++ixCell) {
					const label = headerRowMeta[ixCell];
					this._recursiveRender(label, textStack, meta);
					if (ixCell !== headerRowMeta.length - 1) textStack[0] += _VERTICAL_LINE;
				}

				textStack[0] += `\n`;
			}
		}

		if (!entry.rows || !entry.rows.length) return;

		for (const row of entry.rows) {
			textStack[0] += "text | ";

			const rowRender = row.type === "row" ? row.row : row;

			for (let i = 0; i < rowRender.length; ++i) {
				const cell = rowRender[i];
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

				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(toRenderCell, textStack, meta);
				meta.depth = cacheDepth;
				if (i !== rowRender.length - 1) textStack[0] += _VERTICAL_LINE;
			}
			textStack[0] += "\n";
		}

		if (entry.footnotes) {
			for (const ent of entry.footnotes) {
				const cacheDepth = this._adjustDepth(meta, 1);
				this._recursiveRender(ent, textStack, meta);
				meta.depth = cacheDepth;
			}
		}
		if (entry.outro) for (const ent of entry.intro) this._recursiveRender(ent, textStack, meta, {prefix: "text | ", suffix: "\n"});
	}

	/*
	_renderTableGroup (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	*/

	_renderInset (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `section | ${entry.name}\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `\n`;
	}

	_renderInsetReadaloud (entry, textStack, meta, options) {
		this._renderInset(entry, textStack, meta, options);
	}

	_renderVariant (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `section | Variant: ${entry.name}\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
				meta.depth = cacheDepth;
			}
		}
		if (entry.source) textStack[0] += `${RenderCard.utils.getPageText({source: entry.source, page: entry.page})}\n`;
		textStack[0] += "\n";
	}

	_renderVariantSub (entry, textStack, meta, options) {
		if (entry.name) {
			textStack[0] += `text | <i>${entry.name}.</i> `;
			if (entry.entries) {
				this._recursiveRender(entry.entries[0], textStack, meta, {suffix: "\n"});
			}
		}

		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = entry.name ? 1 : 0; i < len; ++i) {
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
			}
		}
	}

	_renderSpellcasting (entry, textStack, meta, options) {
		const toRender = this._renderSpellcasting_getEntries(entry);
		this._recursiveRender({type: "entries", entries: toRender}, textStack, meta, {prefix: "text | ", suffix: "\n"});
	}

	_renderQuote (entry, textStack, meta, options) {
		const len = entry.entries.length;
		for (let i = 0; i < len; ++i) {
			this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | <i>", suffix: "</i>"});
			textStack[0] += `\n`;
		}
		const byArr = this._renderQuote_getBy(entry);
		if (byArr) {
			const tempStack = [];
			for (let i = 0, len = byArr.length; i < len; ++i) {
				const by = byArr[i];
				tempStack[0] += `text | ${!i ? `\u2014 ` : ""}`;
				this._recursiveRender(by, tempStack, meta);
				if (i < len - 1) tempStack[0] += "\n";
			}
			textStack[0] += `${tempStack.join("")}${entry.from ? `, <i>${entry.from}</i>` : ""}\n`;
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
		textStack[0] += `<b>${entry.name} save DC</b> = 8 + your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}`;
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderAbilityAttackMod (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<b>${entry.name} attack modifier</b> = your proficiency bonus + your ${Parser.attrChooseToFull(entry.attributes)}`;
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderAbilityGeneric (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `${entry.name ? `<b>${entry.name}</b> = ` : ""}${entry.text}${entry.attributes ? ` ${Parser.attrChooseToFull(entry.attributes)}` : ""}`;
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
		textStack[0] += Renderer.getEntryDiceDisplayText(entry);
	}

	_renderLink (entry, textStack, meta, options) {
		this._recursiveRender(entry.text, textStack, meta);
	}

	/*
	_renderActions (entry, textStack, meta, options) {
		// TODO?
	}

	_renderAttack (entry, textStack, meta, options) {
		// TODO?
	}

	_renderIngredient (entry, textStack, meta, options) {
		// (Use base implementation)
	}
	// endregion

	*/
	// region list items
	_renderItem (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		textStack[0] += `<b>${this.render(entry.name)}</b> `;
		if (entry.entry) this._recursiveRender(entry.entry, textStack, meta);
		else if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				if (i === 0) this._recursiveRender(entry.entries[i], textStack, meta, {suffix: "\n"});
				else this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
			}
		}
		textStack[0] += "\n";
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderItemSub (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `bullet | <i>${this.render(entry.name)}</i> `, suffix: "\n"});
		this._renderSuffix(entry, textStack, meta, options);
	}

	_renderItemSpell (entry, textStack, meta, options) {
		this._renderPrefix(entry, textStack, meta, options);
		this._recursiveRender(entry.entry, textStack, meta, {prefix: `bullet | ${entry.name} `, suffix: "\n"});
		this._renderSuffix(entry, textStack, meta, options);
	}
	// endregion

	// region embedded entities
	_renderStatblockInline (entry, textStack, meta, options) {
		textStack[0] += `text | (Inline stat block rendering within cards is not supported.)\n`;
	}

	_renderStatblock (entry, textStack, meta, options) {
		textStack[0] += `text | (Inline stat block rendering within cards is not supported.)\n`;
	}
	// endregion

	// region images
	_renderImage (entry, textStack, meta, options) {
		textStack[0] += `text | (Image rendering within cards is not supported.)\n`;
	}

	_renderGallery (entry, textStack, meta, options) {
		textStack[0] += `text | (Image gallery rendering within cards is not supported.)\n`;
	}
	// endregion

	// region flowchart
	_renderFlowchart (entry, textStack, meta, options) {
		const len = entry.blocks.length;
		for (let i = 0; i < len; ++i) this._recursiveRender(entry.blocks[i], textStack, meta, options);
	}

	_renderFlowBlock (entry, textStack, meta, options) {
		textStack[0] += "\n";
		if (entry.name != null) textStack[0] += `section | ${entry.name}\n`;
		if (entry.entries) {
			const len = entry.entries.length;
			for (let i = 0; i < len; ++i) {
				const cacheDepth = meta.depth;
				meta.depth = 2;
				this._recursiveRender(entry.entries[i], textStack, meta, {prefix: "text | ", suffix: "\n"});
				meta.depth = cacheDepth;
			}
		}
		textStack[0] += `\n`;
	}
	// endregion

	// region homebrew
	_renderHomebrew (entry, textStack, meta, options) {
		textStack[0] += `text | (Homebrew rendering within cards is not supported.)\n`;
	}
	// endregion

	// region misc
	_renderCode (entry, textStack, meta, options) {
		textStack[0] += `text | (Code rendering within cards is not supported.)`;
	}

	_renderHr (entry, textStack, meta, options) {
		textStack[0] += `rule\n`;
	}
	// endregion

	// region primitives
	_renderString (entry, textStack, meta, options) {
		const tagSplit = Renderer.splitByTags(entry);
		const len = tagSplit.length;
		for (let i = 0; i < len; ++i) {
			const s = tagSplit[i];
			if (!s) continue;
			if (s.startsWith("{@")) {
				const [tag, text] = Renderer.splitFirstSpace(s.slice(1, -1));
				if (!this._renderString_renderTag_card(textStack, meta, options, tag, text)) this._renderString_renderTag(textStack, meta, options, tag, text);
			} else {
				if (textStack[0].last() === "\n" || !textStack[0].last()) textStack[0] += `text | `;
				textStack[0] += s;
			}
		}
	}

	_renderString_renderTag_card (textStack, meta, options, tag, text) {
		switch (tag) {
			case "@dc": {
				const [dcText, displayText] = Renderer.splitTagByPipe(text);
				textStack[0] += `DC ${displayText || dcText}`;
				return true;
			}
			default: return false;
		}
	}

	_renderPrimitive (entry, textStack, meta, options) {
		if (textStack[0].last() === "\n" || !textStack[0].last()) textStack[0] += `text | `;
		textStack[0] += `${entry}`;
	}
	// endregion
}
RendererCard.utils = class {
	static getPageText (it) {
		const sourceSub = Renderer.utils.getSourceSubText(it);
		const baseText = Renderer.utils.isDisplayPage(it.page) ? `text | <b>Source:</b> <i>${Parser.sourceJsonToAbv(it.source)}${sourceSub}</i>, page ${it.page}` : "";
		const addSourceText = this._getPageText_getAltSourceText(it, "additionalSources", "Additional information from");
		const otherSourceText = this._getPageText_getAltSourceText(it, "otherSources", "Also found in");
		const externalSourceText = this._getPageText_getAltSourceText(it, "externalSources", "External sources:");

		return `${[baseText, addSourceText, otherSourceText, externalSourceText].filter(it => it).join(". ")}${baseText && (addSourceText || otherSourceText || externalSourceText) ? "." : ""}\n`;
	}

	static _getPageText_getAltSourceText (it, prop, introText) {
		if (!it[prop] || !it[prop].length) return "";

		return `${introText} ${it[prop].map(as => {
			if (as.entry) return Renderer.get().render(as.entry);
			else return `<i>${Parser.sourceJsonToAbv(as.source)}</i>>${Renderer.utils.isDisplayPage(as.page) ? `, page ${as.page}` : ""}`;
		}).join("; ")}`;
	}
};

class RenderSpells {
	static $getRenderedSpell (sp, subclassLookup) {
		const renderer = Renderer.get();

		const renderStack = [];
		renderer.setFirstSection(true);

		renderStack.push(`
			${Renderer.utils.getBorderTr()}
			${Renderer.utils.getExcludedTr({entity: sp, dataProp: "spell", page: UrlUtil.PG_SPELLS})}
			${Renderer.utils.getNameTr(sp, {page: UrlUtil.PG_SPELLS})}
			<tr><td class="rd-spell__level-school-ritual" colspan="6"><span>${Parser.spLevelSchoolMetaToFull(sp.level, sp.school, sp.meta, sp.subschools)}</span></td></tr>
			<tr><td colspan="6"><span class="bold">Casting Time: </span>${Parser.spTimeListToFull(sp.time)}</td></tr>
			<tr><td colspan="6"><span class="bold">Range: </span>${Parser.spRangeToFull(sp.range)}</td></tr>
			<tr><td colspan="6"><span class="bold">Components: </span>${Parser.spComponentsToFull(sp.components, sp.level)}</td></tr>
			<tr><td colspan="6"><span class="bold">Duration: </span>${Parser.spDurationToFull(sp.duration)}</td></tr>
			${Renderer.utils.getDividerTr()}
		`);

		const entryList = {type: "entries", entries: sp.entries};
		renderStack.push(`<tr class="text"><td colspan="6" class="text">`);
		renderer.recursiveRender(entryList, renderStack, {depth: 1});
		if (sp.entriesHigherLevel) {
			const higherLevelsEntryList = {type: "entries", entries: sp.entriesHigherLevel};
			renderer.recursiveRender(higherLevelsEntryList, renderStack, {depth: 2});
		}
		renderStack.push(`</td></tr>`);

		const stackFroms = [];

		const fromClassList = Renderer.spell.getCombinedClasses(sp, "fromClassList");
		if (fromClassList.length) {
			const [current, legacy] = Parser.spClassesToCurrentAndLegacy(fromClassList);
			stackFroms.push(`<div><span class="bold">Classes: </span>${Parser.spMainClassesToFull(current)}</div>`);
			if (legacy.length) stackFroms.push(`<div class="text-muted"><span class="bold">Classes (legacy): </span>${Parser.spMainClassesToFull(legacy)}</div>`);
		}

		const fromSubclass = Renderer.spell.getCombinedClasses(sp, "fromSubclass");
		if (fromSubclass.length) {
			const [current, legacy] = Parser.spSubclassesToCurrentAndLegacyFull(sp, subclassLookup);
			stackFroms.push(`<div><span class="bold">Subclasses: </span>${current}</div>`);
			if (legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Subclasses (legacy): </span>${legacy}</div>`);
			}
		}

		const fromClassListVariant = Renderer.spell.getCombinedClasses(sp, "fromClassListVariant");
		if (fromClassListVariant.length) {
			const [current, legacy] = Parser.spVariantClassesToCurrentAndLegacy(fromClassListVariant);
			if (current.length) {
				stackFroms.push(`<div><span class="bold">Optional/Variant Classes: </span>${Parser.spMainClassesToFull(current)}</div>`);
			}
			if (legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Optional/Variant Classes (legacy): </span>${Parser.spMainClassesToFull(legacy)}</div>`);
			}
		}

		const fromSubclassVariant = Renderer.spell.getCombinedClasses(sp, "fromSubclassVariant");
		if (fromSubclassVariant.length) {
			const [current, legacy] = Parser.spVariantSubclassesToCurrentAndLegacyFull(sp, subclassLookup);
			if (current.length) {
				stackFroms.push(`<div><span class="bold">Optional/Variant Subclasses: </span>${current}</div>`);
			}
			if (legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Subclasses (legacy): </span>${legacy}</div>`);
			}
		}

		const fromRaces = Renderer.spell.getCombinedRaces(sp);
		if (fromRaces.length) {
			fromRaces.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
			stackFroms.push(`<div><span class="bold">Races: </span>${fromRaces.map(r => `${SourceUtil.isNonstandardSource(r.source) ? `<span class="text-muted">` : ``}${renderer.render(`{@race ${r.name}|${r.source}}`)}${SourceUtil.isNonstandardSource(r.source) ? `</span>` : ``}`).join(", ")}</div>`);
		}

		const fromRacesVariant = Renderer.spell.getCombinedRaces(sp, {prop: "racesVariant", propTmp: "_tmpRacesVariant"});
		if (fromRacesVariant.length) {
			fromRacesVariant.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
			stackFroms.push(`<div><span class="bold">Optional/Variant Races: </span>${fromRacesVariant.map(r => `<span ${SourceUtil.isNonstandardSource(r.source) ? `class="text-muted"` : ``} title="From a class sSpell list defined in: ${Parser.sourceJsonToFull(r.classDefinedInSource)}">${renderer.render(`{@race ${r.name}|${r.source}}`)}</span>`).join(", ")}</div>`);
		}

		const fromBackgrounds = Renderer.spell.getCombinedBackgrounds(sp);
		if (fromBackgrounds.length) {
			fromBackgrounds.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
			stackFroms.push(`<div><span class="bold">Backgrounds: </span>${fromBackgrounds.map(r => `${SourceUtil.isNonstandardSource(r.source) ? `<span class="text-muted">` : ``}${renderer.render(`{@background ${r.name}|${r.source}}`)}${SourceUtil.isNonstandardSource(r.source) ? `</span>` : ``}`).join(", ")}</div>`);
		}

		if (sp.eldritchInvocations) {
			sp.eldritchInvocations.sort((a, b) => SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source));
			stackFroms.push(`<div><span class="bold">Eldritch Invocations: </span>${sp.eldritchInvocations.map(r => `${SourceUtil.isNonstandardSource(r.source) ? `<span class="text-muted">` : ``}${renderer.render(`{@optfeature ${r.name}|${r.source}}`)}${SourceUtil.isNonstandardSource(r.source) ? `</span>` : ``}`).join(", ")}</div>`);
		}

		if (stackFroms.length) {
			renderStack.push(`<tr class="text"><td colspan="6">${stackFroms.join("")}</td></tr>`);
		}

		if (sp._scrollNote) {
			renderStack.push(`<tr class="text"><td colspan="6"><section class="text-muted">`);
			renderer.recursiveRender(`{@italic Note: Both the {@class fighter||${Renderer.spell.STR_FIGHTER} (${Renderer.spell.STR_ELD_KNIGHT})|eldritch knight} and the {@class rogue||${Renderer.spell.STR_ROGUE} (${Renderer.spell.STR_ARC_TCKER})|arcane trickster} spell lists include all {@class ${Renderer.spell.STR_WIZARD}} spells. Spells of 5th level or higher may be cast with the aid of a spell scroll or similar.}`, renderStack, {depth: 2});
			renderStack.push(`</section></td></tr>`);
		}

		renderStack.push(`
			${Renderer.utils.getPageTr(sp)}
			${Renderer.utils.getBorderTr()}
		`);

		return $(renderStack.join(""));
	}
}

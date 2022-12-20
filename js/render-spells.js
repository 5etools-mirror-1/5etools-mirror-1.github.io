class RenderSpells {
	static SETTINGS = {
		isDisplayClasses: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Show Classes",
			help: `Whether or not "Classes" should be shown for a spell.`,
			defaultVal: true,
		}),
		isDisplayClassesLegacy: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Show Classes (Legacy)",
			help: `Whether or not "Classes (legacy)" should be shown for a spell.`,
			defaultVal: false,
		}),

		isDisplaySubclasses: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Show Subclasses",
			help: `Whether or not "Subclasses" should be shown for a spell.`,
			defaultVal: true,
		}),
		isDisplaySubclassesLegacy: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Show Subclasses (Legacy)",
			help: `Whether or not "Subclasses (legacy)" should be shown for a spell.`,
			defaultVal: false,
		}),

		isDisplayVariantClasses: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Optional/Variant Classes",
			help: `Whether or not "Optional/Variant Classes" should be shown for a spell.`,
			defaultVal: true,
		}),
		isDisplayVariantClassesLegacy: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Optional/Variant Classes (Legacy)",
			help: `Whether or not "Optional/Variant Classes (legacy)" should be shown for a spell.`,
			defaultVal: false,
		}),

		isDisplayRaces: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Races",
			help: `Whether or not "Races" should be shown for a spell.`,
			defaultVal: true,
		}),

		isDisplayBackgrounds: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Backgrounds",
			help: `Whether or not "Backgrounds" should be shown for a spell.`,
			defaultVal: true,
		}),

		isDisplayFeats: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Feats",
			help: `Whether or not "Feats" should be shown for a spell.`,
			defaultVal: true,
		}),

		isDisplayOptionalfeatures: new SettingsUtil.Setting({
			type: "boolean",
			name: "Spell Sources: Other Options/Features",
			help: `Whether or not "Other Options/Features" should be shown for a spell.`,
			defaultVal: true,
		}),
	};

	static $getRenderedSpell (sp, subclassLookup, {isSkipExcludesRender = false, settings} = {}) {
		if (settings == null) settings = SettingsUtil.getDefaultSettings(this.SETTINGS);

		const renderer = Renderer.get();

		const renderStack = [];
		renderer.setFirstSection(true);

		renderStack.push(`
			${Renderer.utils.getBorderTr()}
			${!isSkipExcludesRender ? Renderer.utils.getExcludedTr({entity: sp, dataProp: "spell", page: UrlUtil.PG_SPELLS}) : ""}
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
			if (settings.isDisplayClasses) {
				stackFroms.push(`<div><span class="bold">Classes: </span>${Parser.spMainClassesToFull(current)}</div>`);
			}
			if (settings.isDisplayClassesLegacy && legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Classes (legacy): </span>${Parser.spMainClassesToFull(legacy)}</div>`);
			}
		}

		const fromSubclass = Renderer.spell.getCombinedClasses(sp, "fromSubclass");
		if (fromSubclass.length) {
			const [current, legacy] = Parser.spSubclassesToCurrentAndLegacyFull(sp, subclassLookup);
			if (settings.isDisplaySubclasses) {
				stackFroms.push(`<div><span class="bold">Subclasses: </span>${current}</div>`);
			}
			if (settings.isDisplaySubclassesLegacy && legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Subclasses (legacy): </span>${legacy}</div>`);
			}
		}

		const fromClassListVariant = Renderer.spell.getCombinedClasses(sp, "fromClassListVariant");
		if (fromClassListVariant.length) {
			const [current, legacy] = Parser.spVariantClassesToCurrentAndLegacy(fromClassListVariant);
			if (settings.isDisplayVariantClasses && current.length) {
				stackFroms.push(`<div><span class="bold">Optional/Variant Classes: </span>${Parser.spMainClassesToFull(current)}</div>`);
			}
			if (settings.isDisplayVariantClassesLegacy && legacy.length) {
				stackFroms.push(`<div class="text-muted"><span class="bold">Optional/Variant Classes (legacy): </span>${Parser.spMainClassesToFull(legacy)}</div>`);
			}
		}

		if (settings.isDisplayRaces) this._mutStackPtSpellSource({sp, stackFroms, renderer, title: "Races", propSpell: "races", prop: "race", tag: "race"});
		if (settings.isDisplayBackgrounds) this._mutStackPtSpellSource({sp, stackFroms, renderer, title: "Backgrounds", propSpell: "backgrounds", prop: "background", tag: "background"});
		if (settings.isDisplayFeats) this._mutStackPtSpellSource({sp, stackFroms, renderer, title: "Feats", propSpell: "feats", prop: "feat", tag: "feat"});
		if (settings.isDisplayOptionalfeatures) this._mutStackPtSpellSource({sp, stackFroms, renderer, title: "Other Options/Features", propSpell: "optionalfeatures", prop: "optionalfeature", tag: "optfeature"});

		if (stackFroms.length) {
			renderStack.push(`<tr class="text"><td colspan="6">${stackFroms.join("")}</td></tr>`);
		}

		if (
			sp.level >= 5
			&& fromClassList?.some(it => it.name === "Wizard" && it?.source === SRC_PHB)
		) {
			renderStack.push(`<tr class="text"><td colspan="6"><section class="text-muted">`);
			renderer.recursiveRender(`{@italic Note: Both the {@class fighter||Fighter (Eldritch Knight)|eldritch knight} and the {@class rogue||Rogue (Arcane Trickster)|arcane trickster} spell lists include all {@class Wizard} spells. Spells of 5th level or higher may be cast with the aid of a spell scroll or similar.}`, renderStack, {depth: 2});
			renderStack.push(`</section></td></tr>`);
		}

		renderStack.push(`
			${Renderer.utils.getPageTr(sp)}
			${Renderer.utils.getBorderTr()}
		`);

		return $(renderStack.join(""));
	}

	static _mutStackPtSpellSource ({sp, stackFroms, renderer, title, propSpell, prop, tag}) {
		const froms = Renderer.spell.getCombinedGeneric(sp, {propSpell, prop});
		if (!froms.length) return;

		stackFroms.push(`<div><span class="bold">${title}: </span>${froms.map(it => `${SourceUtil.isNonstandardSource(it.source) ? `<span class="text-muted">` : ``}${renderer.render(`{@${tag} ${it.name}|${it.source}}`)}${SourceUtil.isNonstandardSource(it.source) ? `</span>` : ``}`).join(", ")}</div>`);
	}
}

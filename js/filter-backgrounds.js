"use strict";

class PageFilterBackgrounds extends PageFilter {
	static _getToolDisplayText (tool) {
		if (tool === "anyArtisansTool") return "Any Artisan's Tool";
		if (tool === "anyMusicalInstrument") return "Any Musical Instrument";
		return tool.toTitleCase();
	}

	constructor () {
		super();

		this._skillFilter = new Filter({header: "Skill Proficiencies", displayFn: StrUtil.toTitleCase});
		this._toolFilter = new Filter({header: "Tool Proficiencies", displayFn: PageFilterBackgrounds._getToolDisplayText.bind(PageFilterBackgrounds)});
		this._languageFilter = new Filter({header: "Language Proficiencies", displayFn: it => it === "anyStandard" ? "Any Standard" : StrUtil.toTitleCase(it)});
		this._asiFilter = new AbilityScoreFilter({header: "Ability Scores"});
		this._otherBenefitsFilter = new Filter({header: "Other Benefits"});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["Has Info", "Has Images", "SRD", "Basic Rules"], isMiscFilter: true});
	}

	static mutateForFilters (bg) {
		bg._fSources = SourceFilter.getCompleteFilterSources(bg);
		const skillDisplay = Renderer.background.getSkillSummary(bg.skillProficiencies, true, bg._fSkills = []);
		Renderer.background.getToolSummary(bg.toolProficiencies, true, bg._fTools = []);
		Renderer.background.getLanguageSummary(bg.languageProficiencies, true, bg._fLangs = []);
		bg._fMisc = [];
		if (bg.srd) bg._fMisc.push("SRD");
		if (bg.basicRules) bg._fMisc.push("Basic Rules");
		if (bg.hasFluff || bg.fluff?.entries) bg._fMisc.push("Has Info");
		if (bg.hasFluffImages || bg.fluff?.images) bg._fMisc.push("Has Images");
		bg._fOtherBenifits = [];
		if (bg.feats) bg._fOtherBenifits.push("Feat");
		if (bg.additionalSpells) bg._fOtherBenifits.push("Additional Spells");
		bg._skillDisplay = skillDisplay;
	}

	addToFilters (bg, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(bg._fSources);
		this._skillFilter.addItem(bg._fSkills);
		this._toolFilter.addItem(bg._fTools);
		this._languageFilter.addItem(bg._fLangs);
		this._asiFilter.addItem(bg.ability);
		this._otherBenefitsFilter.addItem(bg._fOtherBenifits);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._skillFilter,
			this._toolFilter,
			this._languageFilter,
			this._asiFilter,
			this._otherBenefitsFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, bg) {
		return this._filterBox.toDisplay(
			values,
			bg._fSources,
			bg._fSkills,
			bg._fTools,
			bg._fLangs,
			bg.ability,
			bg._fOtherBenifits,
			bg._fMisc,
		);
	}
}

globalThis.PageFilterBackgrounds = PageFilterBackgrounds;

class ModalFilterBackgrounds extends ModalFilter {
	/**
	 * @param opts
	 * @param opts.namespace
	 * @param [opts.isRadio]
	 * @param [opts.allData]
	 */
	constructor (opts) {
		opts = opts || {};
		super({
			...opts,
			modalTitle: `Background${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterBackgrounds(),
		});
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "4"},
			{sort: "skills", text: "Skills", width: "6"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pLoadAllData () {
		return [
			...(await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/backgrounds.json`)).background,
			...((await PrereleaseUtil.pGetBrewProcessed()).background || []),
			...((await BrewUtil2.pGetBrewProcessed()).background || []),
		];
	}

	_getListItem (pageFilter, bg, bgI) {
		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 ve-flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS](bg);
		const source = Parser.sourceJsonToAbv(bg.source);

		eleRow.innerHTML = `<div class="w-100 ve-flex-vh-center lst--border veapp__list-row no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 ve-flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 ve-flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-4 ${bg._versionBase_isVersion ? "italic" : ""} ${this._getNameStyle()}">${bg._versionBase_isVersion ? `<span class="px-3"></span>` : ""}${bg.name}</div>
			<div class="col-6">${bg._skillDisplay}</div>
			<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(bg.source)}" title="${Parser.sourceJsonToFull(bg.source)}" ${Parser.sourceJsonToStyle(bg.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			bgI,
			eleRow,
			bg.name,
			{
				hash,
				source,
				sourceJson: bg.source,
				skills: bg._skillDisplay,
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_BACKGROUNDS, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}

globalThis.ModalFilterBackgrounds = ModalFilterBackgrounds;

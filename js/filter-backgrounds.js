"use strict";

class PageFilterBackgrounds extends PageFilter {
	constructor () {
		super();

		this._skillFilter = new Filter({header: "Skill Proficiencies", displayFn: StrUtil.toTitleCase});
		this._toolFilter = new Filter({header: "Tool Proficiencies", displayFn: StrUtil.toTitleCase});
		this._languageFilter = new Filter({header: "Language Proficiencies", displayFn: it => it === "anyStandard" ? "Any Standard" : StrUtil.toTitleCase(it)});
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
		if (bg.hasFluff) bg._fMisc.push("Has Info");
		if (bg.hasFluffImages) bg._fMisc.push("Has Images");
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
		this._otherBenefitsFilter.addItem(bg._fOtherBenifits);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._skillFilter,
			this._toolFilter,
			this._languageFilter,
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
			bg._fOtherBenifits,
			bg._fMisc,
		);
	}
}

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
		const brew = await BrewUtil.pAddBrewData();
		const fromData = (await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/backgrounds.json`)).background;
		const fromBrew = brew.background || [];
		return [...fromData, ...fromBrew];
	}

	_getListItem (pageFilter, bg, bgI) {
		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_BACKGROUNDS](bg);
		const source = Parser.sourceJsonToAbv(bg.source);

		eleRow.innerHTML = `<div class="w-100 flex-vh-center lst--border no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-4 ${this._getNameStyle()}">${bg.name}</div>
			<div class="col-6">${bg._skillDisplay}</div>
			<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(bg.source)}" title="${Parser.sourceJsonToFull(bg.source)}" ${BrewUtil.sourceJsonToStyle(bg.source)}>${source}</div>
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

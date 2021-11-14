"use strict";

class PageFilterFeats extends PageFilter {
	// region static
	// endregion

	constructor () {
		super();

		this._asiFilter = new Filter({
			header: "Ability Bonus",
			items: [
				"str",
				"dex",
				"con",
				"int",
				"wis",
				"cha",
			],
			displayFn: Parser.attAbvToFull,
			itemSortFn: null,
		});
		this._otherPrereqFilter = new Filter({
			header: "Other",
			items: ["Ability", "Race", "Psionics", "Proficiency", "Special", "Spellcasting"],
		});
		this._levelFilter = new Filter({
			header: "Level",
			itemSortFn: SortUtil.ascSortNumericalSuffix,
		});
		this._prerequisiteFilter = new MultiFilter({header: "Prerequisite", filters: [this._otherPrereqFilter, this._levelFilter]});
		this._benefitsFilter = new Filter({
			header: "Benefits",
			items: [
				"Armor Proficiency",
				"Language Proficiency",
				"Skill Proficiency",
				"Spellcasting",
				"Tool Proficiency",
				"Weapon Proficiency",
			],
		});
		this._miscFilter = new Filter({header: "Miscellaneous", items: ["SRD"], isSrdFilter: true});
	}

	static mutateForFilters (feat) {
		const ability = Renderer.getAbilityData(feat.ability);
		feat._fAbility = ability.asCollection.filter(a => !ability.areNegative.includes(a)); // used for filtering

		const prereqText = Renderer.utils.getPrerequisiteHtml(feat.prerequisite, {isListMode: true}) || VeCt.STR_NONE;

		const preSet = new Set();
		(feat.prerequisite || []).forEach(it => preSet.add(...Object.keys(it)));
		feat._fPrereqOther = [...preSet].map(it => (it === "other" ? "special" : it === "spellcasting2020" ? "spellcasting" : it).uppercaseFirst());
		if (feat.prerequisite) feat._fPrereqLevel = feat.prerequisite.filter(it => it.level != null).map(it => `Level ${it.level.level}`);
		feat._fBenifits = [
			feat.resist ? "Damage Resistance" : null,
			feat.immune ? "Damage Immunity" : null,
			feat.conditionImmune ? "Condition Immunity" : null,
			feat.skillProficiencies ? "Skill Proficiency" : null,
			feat.additionalSpells ? "Spellcasting" : null,
			feat.armorProficiencies ? "Armor Proficiency" : null,
			feat.weaponProficiencies ? "Weapon Proficiency" : null,
			feat.toolProficiencies ? "Tool Proficiency" : null,
			feat.languageProficiencies ? "Language Proficiency" : null,
		].filter(it => it);
		feat._fBenifits.push(...(feat.proficiencyTags || []));
		feat._fMisc = feat.srd ? ["SRD"] : [];

		feat._slAbility = ability.asText || VeCt.STR_NONE;
		feat._slPrereq = prereqText;
	}

	addToFilters (feat, isExcluded) {
		if (isExcluded) return;

		this._sourceFilter.addItem(feat.source);
		if (feat.prerequisite) this._levelFilter.addItem(feat._fPrereqLevel);
	}

	async _pPopulateBoxOptions (opts) {
		opts.filters = [
			this._sourceFilter,
			this._asiFilter,
			this._prerequisiteFilter,
			this._benefitsFilter,
			this._miscFilter,
		];
	}

	toDisplay (values, ft) {
		return this._filterBox.toDisplay(
			values,
			ft.source,
			ft._fAbility,
			[
				ft._fPrereqOther,
				ft._fPrereqLevel,
			],
			ft._fBenifits,
			ft._fMisc,
		);
	}
}

class ModalFilterFeats extends ModalFilter {
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
			modalTitle: `Feat${opts.isRadio ? "" : "s"}`,
			pageFilter: new PageFilterFeats(),
		});
	}

	_$getColumnHeaders () {
		const btnMeta = [
			{sort: "name", text: "Name", width: "4"},
			{sort: "ability", text: "Ability", width: "3"},
			{sort: "prerequisite", text: "Prerequisite", width: "3"},
			{sort: "source", text: "Source", width: "1"},
		];
		return ModalFilter._$getFilterColumnHeaders(btnMeta);
	}

	async _pLoadAllData () {
		const brew = await BrewUtil.pAddBrewData();
		const fromData = (await DataUtil.loadJSON(`${Renderer.get().baseUrl}data/feats.json`)).feat;
		const fromBrew = brew.feat || [];
		return [...fromData, ...fromBrew];
	}

	_getListItem (pageFilter, feat, ftI) {
		const eleRow = document.createElement("div");
		eleRow.className = "px-0 w-100 flex-col no-shrink";

		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_FEATS](feat);
		const source = Parser.sourceJsonToAbv(feat.source);

		eleRow.innerHTML = `<div class="w-100 flex-vh-center lst--border no-select lst__wrp-cells">
			<div class="col-0-5 pl-0 flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="no-events">` : `<input type="checkbox" class="no-events">`}</div>

			<div class="col-0-5 px-1 flex-vh-center">
				<div class="ui-list__btn-inline px-2" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>

			<div class="col-4 ${this._getNameStyle()}">${feat.name}</div>
			<span class="col-3 ${feat._slAbility === VeCt.STR_NONE ? "italic" : ""}">${feat._slAbility}</span>
				<span class="col-3 ${feat._slPrereq === VeCt.STR_NONE ? "italic" : ""}">${feat._slPrereq}</span>
			<div class="col-1 pr-0 text-center ${Parser.sourceJsonToColor(feat.source)}" title="${Parser.sourceJsonToFull(feat.source)}" ${BrewUtil.sourceJsonToStyle(feat.source)}>${source}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;

		const listItem = new ListItem(
			ftI,
			eleRow,
			feat.name,
			{
				hash,
				source,
				sourceJson: feat.source,
				ability: feat._slAbility,
				prerequisite: feat._slPrereq,
			},
			{
				cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild,
				btnShowHidePreview,
			},
		);

		ListUiUtil.bindPreviewButton(UrlUtil.PG_FEATS, this._allData, listItem, btnShowHidePreview);

		return listItem;
	}
}

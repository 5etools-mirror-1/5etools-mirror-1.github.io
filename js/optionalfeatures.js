"use strict";

class OptionalFeaturesSublistManager extends SublistManager {
	constructor () {
		super({
			sublistClass: "suboptfeatures",
			sublistListOptions: {
				fnSort: PageFilterOptionalFeatures.sortOptionalFeatures,
			},
		});
	}

	pGetSublistItem (it, hash) {
		const prerequisite = Renderer.utils.prerequisite.getHtml(it.prerequisite, {isListMode: true, blocklistKeys: new Set(["level"])});
		const level = Renderer.optionalfeature.getListPrerequisiteLevelText(it.prerequisite);

		const $ele = $(`<div class="lst__row lst__row--sublist ve-flex-col">
			<a href="#${hash}" class="lst--border lst__row-inner">
				<span class="bold col-4 pl-0">${it.name}</span>
				<span class="col-2 ve-text-center" title="${it._dFeatureType}">${it._lFeatureType}</span>
				<span class="col-4-5 ${prerequisite === "\u2014" ? "ve-text-center" : ""}">${prerequisite}</span>
				<span class="col-1-5 ve-text-center pr-0">${level}</span>
			</a>
		</div>`)
			.contextmenu(evt => this._handleSublistItemContextMenu(evt, listItem))
			.click(evt => this._listSub.doSelect(listItem, evt));

		const listItem = new ListItem(
			hash,
			$ele,
			it.name,
			{
				hash,
				type: it._lFeatureType,
				prerequisite,
				level,
			},
			{
				entity: it,
			},
		);
		return listItem;
	}
}

class OptionalFeaturesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterOptionalFeatures();

		super({
			dataSource: DataUtil.optionalfeature.loadJSON.bind(DataUtil.optionalfeature),

			pageFilter,

			listClass: "optfeatures",
			listOptions: {
				fnSort: PageFilterOptionalFeatures.sortOptionalFeatures,
			},

			dataProps: ["optionalfeature"],

			bookViewOptions: {
				namePlural: "optional features",
				pageTitle: "Optional Features Book View",
			},

			isPreviewable: true,
		});
	}

	getListItem (it, ivI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(it, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row ve-flex-col ${isExcluded ? "lst__row--blocklisted" : ""}`;

		const source = Parser.sourceJsonToAbv(it.source);
		const hash = UrlUtil.autoEncodeHash(it);
		const prerequisite = Renderer.utils.prerequisite.getHtml(it.prerequisite, {isListMode: true, blocklistKeys: new Set(["level"])});
		const level = Renderer.optionalfeature.getListPrerequisiteLevelText(it.prerequisite);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="col-0-3 px-0 ve-flex-vh-center lst__btn-toggle-expand ve-self-flex-stretch">[+]</span>
			<span class="bold col-3 px-1">${it.name}</span>
			<span class="col-1-5 ve-text-center" title="${it._dFeatureType}">${it._lFeatureType}</span>
			<span class="col-4-7 ve-text-center">${prerequisite}</span>
			<span class="col-1 ve-text-center">${level}</span>
			<span class="col-1-5 ${Parser.sourceJsonToColor(it.source)} ve-text-center pr-0" title="${Parser.sourceJsonToFull(it.source)}" ${Parser.sourceJsonToStyle(it.source)}>${source}</span>
		</a>
		<div class="ve-flex ve-hidden relative lst__wrp-preview">
			<div class="vr-0 absolute lst__vr-preview"></div>
			<div class="ve-flex-col py-3 ml-4 lst__wrp-preview-inner"></div>
		</div>`;

		const listItem = new ListItem(
			ivI,
			eleLi,
			it.name,
			{
				hash,
				source,
				prerequisite,
				level,
				type: it._lFeatureType,
			},
			{
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => this._openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	_renderStats_doBuildStatsTab ({ent}) {
		this._$wrpTabs.find(`.opt-feature-type`).remove();
		const $wrpOptFeatType = $(`<div class="opt-feature-type"/>`).prependTo(this._$wrpTabs);

		const commonPrefix = ent.featureType.length > 1 ? MiscUtil.findCommonPrefix(ent.featureType.map(fs => Parser.optFeatureTypeToFull(fs)), {isRespectWordBoundaries: true}) : "";
		if (commonPrefix) $wrpOptFeatType.append(`${commonPrefix.trim()} `);

		ent.featureType.forEach((ft, i) => {
			if (i > 0) $wrpOptFeatType.append("/");
			$(`<span class="roller">${Parser.optFeatureTypeToFull(ft).substring(commonPrefix.length)}</span>`)
				.click(() => {
					this._filterBox.setFromValues({"Feature Type": {[ft]: 1}});
					this.handleFilterChange();
				})
				.appendTo($wrpOptFeatType);
		});

		this._$pgContent.empty().append(RenderOptionalFeatures.$getRenderedOptionalFeature(ent));
	}
}

const optionalFeaturesPage = new OptionalFeaturesPage();
optionalFeaturesPage.sublistManager = new OptionalFeaturesSublistManager();
window.addEventListener("load", () => optionalFeaturesPage.pOnLoad());

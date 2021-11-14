"use strict";

class RacesPage extends ListPage {
	constructor () {
		const pageFilter = new PageFilterRaces();
		super({
			dataSource: DataUtil.race.loadJSON.bind(DataUtil.race, {isAddBaseRaces: true}),
			dataSourceFluff: "data/fluff-races.json",

			pageFilter,

			listClass: "races",

			sublistClass: "subraces",

			dataProps: ["race"],

			hasAudio: true,
		});
	}

	_addData (data) {
		if (data.race && data.race.length) super._addData(data);
		if (!data.subrace || !data.subrace.length) return;

		// Attach each subrace to a parent race, and recurse
		const nxtData = Renderer.race.adoptSubraces(this._dataList, data.subrace);

		if (nxtData.length) this._addData({race: Renderer.race.mergeSubraces(nxtData)});
	}

	async _pHandleBrew (homebrew) {
		if (homebrew.race) {
			homebrew = MiscUtil.copy(homebrew);
			homebrew.race = Renderer.race.mergeSubraces(homebrew.race, {isAddBaseRaces: true});
		}
		return super._pHandleBrew(homebrew);
	}

	/**
	 * For a given homebrew race, fetch entries that have been expanded from its "subraces" array.
	 * @param uniqueId
	 */
	getMergedSubraces (uniqueId) {
		const race = this._dataList.find(it => it.uniqueId === uniqueId);
		if (!race || !race._isBaseRace) return [];
		// Note that this may include other subraces which were not on the original
		return this._dataList.filter(it => it._baseName === race.name && it._baseSource === race.source);
	}

	getListItem (race, rcI, isExcluded) {
		this._pageFilter.mutateAndAddToFilters(race, isExcluded);

		const eleLi = document.createElement("div");
		eleLi.className = `lst__row flex-col ${isExcluded ? "lst__row--blacklisted" : ""}`;

		const hash = UrlUtil.autoEncodeHash(race);
		const ability = race.ability ? Renderer.getAbilityData(race.ability) : {asTextShort: "None"};
		const size = (race.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/");
		const source = Parser.sourceJsonToAbv(race.source);

		eleLi.innerHTML = `<a href="#${hash}" class="lst--border lst__row-inner">
			<span class="bold col-4 pl-0">${race.name}</span>
			<span class="col-4">${ability.asTextShort}</span>
			<span class="col-2 text-center">${size}</span>
			<span class="col-2 text-center ${Parser.sourceJsonToColor(race.source)} pr-0" title="${Parser.sourceJsonToFull(race.source)}" ${BrewUtil.sourceJsonToStyle(race.source)}>${source}</span>
		</a>`;

		const listItem = new ListItem(
			rcI,
			eleLi,
			race.name,
			{
				hash,
				ability: ability.asTextShort,
				size,
				source,
				cleanName: PageFilterRaces.getInvertedName(race.name) || "",
				alias: PageFilterRaces.getListAliases(race),
			},
			{
				uniqueId: race.uniqueId ? race.uniqueId : rcI,
				isExcluded,
			},
		);

		eleLi.addEventListener("click", (evt) => this._list.doSelect(listItem, evt));
		eleLi.addEventListener("contextmenu", (evt) => ListUtil.openContextMenu(evt, this._list, listItem));

		return listItem;
	}

	handleFilterChange () {
		const f = this._pageFilter.filterBox.getValues();
		this._list.filter(it => this._pageFilter.toDisplay(f, this._dataList[it.ix]));
		FilterBox.selectFirstVisible(this._dataList);
	}

	pGetSublistItem (race, ix) {
		const hash = UrlUtil.autoEncodeHash(race);

		const $ele = $(`<div class="lst__row lst__row--sublist flex-col">
				<a href="#${UrlUtil.autoEncodeHash(race)}" class="lst--border lst__row-inner">
					<span class="bold col-5 pl-0">${race.name}</span>
					<span class="col-5">${race._slAbility}</span>
					<span class="col-2 text-center pr-0">${(race.size || [SZ_VARIES]).map(sz => Parser.sizeAbvToFull(sz)).join("/")}</span>
				</a>
			</div>
		`)
			.contextmenu(evt => ListUtil.openSubContextMenu(evt, listItem))
			.click(evt => ListUtil.sublist.doSelect(listItem, evt));

		const listItem = new ListItem(
			ix,
			$ele,
			race.name,
			{
				hash,
				ability: race._slAbility,
			},
		);
		return listItem;
	}

	doLoadHash (id) {
		const renderer = this._renderer;
		renderer.setFirstSection(true);
		this._$pgContent.empty();
		const race = this._dataList[id];

		const buildStatsTab = () => {
			this._$pgContent.append(RenderRaces.$getRenderedRace(race));
		};

		const buildFluffTab = (isImageTab) => {
			return Renderer.utils.pBuildFluffTab({
				isImageTab,
				$content: this._$pgContent,
				entity: race,
				pFnGetFluff: Renderer.race.pGetFluff,
			});
		};

		const tabMetas = [
			new Renderer.utils.TabButton({
				label: "Traits",
				fnPopulate: buildStatsTab,
				isVisible: true,
			}),
			new Renderer.utils.TabButton({
				label: "Info",
				fnPopulate: buildFluffTab,
				isVisible: Renderer.utils.hasFluffText(race, "raceFluff"),
			}),
			new Renderer.utils.TabButton({
				label: "Images",
				fnPopulate: buildFluffTab.bind(null, true),
				isVisible: Renderer.utils.hasFluffImages(race, "raceFluff"),
			}),
		];

		Renderer.utils.bindTabButtons({
			tabButtons: tabMetas.filter(it => it.isVisible),
			tabLabelReference: tabMetas.map(it => it.label),
		});

		ListUtil.updateSelected();
	}
}

const racesPage = new RacesPage();
window.addEventListener("load", () => racesPage.pOnLoad());
